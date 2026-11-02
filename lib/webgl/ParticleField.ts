/**
 * ParticleField — ~10 000 тетраедрів, позиції яких рахує GPU.
 *
 * Схема (GPGPU, ping-pong через GPUComputationRenderer):
 *   textureVelocity: швидкість кожної частинки, шейдер пружини до цільової форми;
 *   texturePosition: інтегрування позиції.
 * Цільова форма береться з 4 DataTexture (мозок, розсип, лампочка, глобус) і змішується
 * за uMorph (0…3). Затримка старту залежить від рангу частинки (хвиля), див. buildRanks.
 *
 * Рендер: InstancedBufferGeometry. Кожен інстанс читає свою позицію з текстури симуляції
 * за атрибутом `ref` (UV текселя). CPU після init() позиції більше не торкається.
 */
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { SHAPES, buildRanks, buildShape } from "./shapes";
import type { SceneState } from "./state";

const SIM_COMMON = /* glsl */ `
  uniform sampler2D tS0; uniform sampler2D tS1; uniform sampler2D tS2; uniform sampler2D tS3;
  uniform sampler2D tRank;
  uniform float uMorph, uTime, uDt, uExplode, uMouseStr;
  uniform vec3 uMouse;

  vec3 shapeAt(int i, vec2 uv) {
    if (i == 0) return texture2D(tS0, uv).xyz;
    if (i == 1) return texture2D(tS1, uv).xyz;
    if (i == 2) return texture2D(tS2, uv).xyz;
    return texture2D(tS3, uv).xyz;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;

const VELOCITY = /* glsl */ `
  ${SIM_COMMON}
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    vec4 rk = texture2D(tRank, uv);

    // Поточна пара форм (i → i+1) і прогрес f усередині пари.
    float m = clamp(uMorph, 0.0, 2.9999);
    int i = int(floor(m));
    float f = m - float(i);
    float rankB = i == 0 ? rk.g : (i == 1 ? rk.b : rk.a);

    // stagger: загальний прогрес розтягується так, що остання за рангом частинка стартує пізніше.
    const float SPREAD = 0.55;
    float t = clamp(f * (1.0 + SPREAD) - SPREAD * rankB, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 target = mix(shapeAt(i, uv), shapeAt(i + 1, uv), t);

    // Пружина: жорсткість у кожної частинки трохи інша, тому вони перелітають по-різному.
    float k = 5.0 + 6.0 * hash(uv);
    vec3 acc = (target - pos) * k;

    // Легке «дихання» навколо цілі.
    acc += 0.25 * vec3(sin(uTime * 0.7 + uv.x * 40.0), cos(uTime * 0.6 + uv.y * 37.0), sin(uTime * 0.5 + (uv.x + uv.y) * 31.0));

    // Вибух (інтро): відштовхування від центру.
    acc += normalize(pos + vec3(1e-3)) * uExplode * 9.0;

    // Миша: розштовхує частинки поблизу.
    vec3 dm = pos - uMouse;
    float dd = length(dm);
    acc += dm / (dd + 1e-3) * smoothstep(0.6, 0.0, dd) * uMouseStr * 26.0;

    vel = (vel + acc * uDt) * exp(-3.4 * uDt);
    gl_FragColor = vec4(vel, 1.0);
  }
`;

const POSITION = /* glsl */ `
  uniform float uDt;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    gl_FragColor = vec4(pos + vel * uDt, 1.0);
  }
`;

const PALETTE = /* glsl */ `
  vec3 palette(float c) {
    if (c < 0.42) return vec3(1.0, 0.72, 0.16);
    if (c < 0.66) return vec3(1.0, 0.93, 0.97);
    if (c < 0.84) return vec3(0.52, 0.32, 1.0);
    if (c < 0.93) return vec3(0.10, 0.85, 0.70);
    return vec3(1.0, 0.35, 0.70);
  }
  float hash1(float n) { return fract(sin(n) * 43758.5453); }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec3 vBary;
  void main() {
    // Контур грані через barycentric + слабка заливка: тетраедри читаються як «скляні».
    vec3 d = fwidth(vBary);
    vec3 a = smoothstep(vec3(0.0), d * 1.5, vBary);
    float edge = 1.0 - min(min(a.x, a.y), a.z);
    gl_FragColor = vec4(vColor, vAlpha * (edge + 0.07));
  }
`;

const PARTICLE_VERT = /* glsl */ `
  attribute vec2 ref;
  attribute vec4 aR;      // x: seed, y: розмір, z: -, w: колір
  attribute vec3 bary;
  uniform sampler2D tPos;
  uniform sampler2D tVel;
  uniform float uTime, uSize, uAlpha, uRim, uGrad, uRand;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec3 vBary;
  ${PALETTE}

  void main() {
    vec3 pos = texture2D(tPos, ref).xyz;
    vec3 vel = texture2D(tVel, ref).xyz;
    float speed = length(vel);

    // Орієнтація: вершиною по нормалі поверхні (як луска). У польоті й у розсипі частинки перевертаються.
    float rand = clamp(uRand + smoothstep(0.4, 2.5, speed), 0.0, 1.0);
    vec3 nrm0 = normalize(pos + vec3(1e-4));
    vec3 rndN = normalize(vec3(hash1(aR.x * 3.1), hash1(aR.x * 7.7), hash1(aR.x * 5.3)) * 2.0 - 1.0 + 0.3 * vec3(sin(uTime * 0.3 + aR.x * 30.0), cos(uTime * 0.25 + aR.x * 20.0), 0.0) + vec3(1e-3));
    vec3 n = normalize(mix(nrm0, rndN, rand));
    vec3 up = abs(n.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 tt = normalize(cross(n, up));
    vec3 bb = cross(n, tt);
    float roll = aR.x * 6.2831 + uTime * (0.2 + aR.w * 0.4) * (0.15 + rand);
    float cr = cos(roll), sr = sin(roll);
    vec3 t2 = tt * cr + bb * sr;
    vec3 b2 = -tt * sr + bb * cr;
    vec3 local = (t2 * position.x + b2 * position.y + n * position.z * mix(0.6, 1.0, rand)) * aR.y * uSize * (1.0 + min(speed, 3.0) * 0.2);

    vec4 mv = modelViewMatrix * vec4(pos + local, 1.0);
    gl_Position = projectionMatrix * mv;
    vBary = bary;

    // Колір: у мозку жовтий по силуету і різнокольоровий усередині; у лампочці градієнт знизу догори.
    vec3 nv = normalize(mat3(modelViewMatrix) * nrm0);
    float stem = smoothstep(-0.65, -0.45, pos.y);
    float rim = pow(1.0 - abs(nv.z), 1.6) * mix(0.25, 1.0, stem);
    vec3 innerP = aR.w < 0.38 ? vec3(1.0, 0.92, 0.98) : aR.w < 0.6 ? vec3(0.58, 0.38, 1.0) : aR.w < 0.78 ? vec3(0.12, 0.88, 0.72) : aR.w < 0.9 ? vec3(1.0, 0.45, 0.78) : vec3(1.0, 0.74, 0.14);
    vec3 inner = mix(vec3(0.95, 0.9, 1.0), innerP, 0.8);
    vec3 rimCol = mix(vec3(1.0, 0.74, 0.12), innerP, aR.w < 0.12 ? 0.6 : 0.08);
    vec3 brainCol = mix(inner, rimCol, smoothstep(0.28, 0.75, rim));
    vec3 col = mix(palette(aR.w), brainCol, uRim);

    float h = clamp((pos.y + 1.1) / 2.3, 0.0, 1.0);
    vec3 purple = vec3(0.52, 0.32, 1.0), white = vec3(1.0, 0.93, 0.97), yellow = vec3(1.0, 0.72, 0.16), teal = vec3(0.1, 0.85, 0.7);
    vec3 g = mix(mix(teal, purple, smoothstep(0.0, 0.22, h)), white, smoothstep(0.2, 0.62, h));
    g = mix(g, yellow, smoothstep(0.6, 1.0, h));
    vColor = mix(col, g, uGrad) * (1.0 + speed * 0.35);

    // Задні частинки мозку згасають (імітація оклюзії), силует світиться сильніше.
    float front = mix(1.0, 0.1 + 0.9 * smoothstep(-0.35, 0.3, nv.z), uRim * stem);
    vAlpha = front * (1.0 + 1.3 * rim * uRim) * uAlpha * (0.55 + 0.45 * hash1(aR.x * 9.0));
  }
`;

const FLOATER_VERT = /* glsl */ `
  attribute vec3 offset;
  attribute vec4 aR;
  attribute vec3 bary;
  uniform float uTime, uAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec3 vBary;
  ${PALETTE}

  mat3 rot(vec3 a, float ang) {
    float s = sin(ang), c = cos(ang), o = 1.0 - c;
    return mat3(
      o*a.x*a.x + c,     o*a.x*a.y + a.z*s, o*a.z*a.x - a.y*s,
      o*a.x*a.y - a.z*s, o*a.y*a.y + c,     o*a.y*a.z + a.x*s,
      o*a.z*a.x + a.y*s, o*a.y*a.z - a.x*s, o*a.z*a.z + c);
  }

  void main() {
    vec3 p = offset + 0.35 * vec3(sin(uTime * 0.15 + aR.x * 40.0), cos(uTime * 0.12 + aR.x * 23.0), sin(uTime * 0.1 + aR.x * 31.0));
    vec3 axis = normalize(vec3(hash1(aR.x * 3.0), hash1(aR.x * 5.0), hash1(aR.x * 7.0)) + vec3(0.2));
    vec3 local = rot(axis, uTime * (0.1 + aR.w * 0.25) + aR.x * 6.2831) * position * aR.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p + local, 1.0);
    vBary = bary;
    vColor = palette(aR.w);
    vAlpha = uAlpha * (0.5 + 0.5 * hash1(aR.x * 13.0));
  }
`;

/** Тетраедр: вершина вздовж +z. Не індексована геометрія (4 грані) + barycentric для контурів. */
function tetraGeometry() {
  const R = 0.9428;
  const v = [
    [0, 0, 1],
    [R, 0, -1 / 3],
    [-R / 2, (R * Math.sqrt(3)) / 2, -1 / 3],
    [-R / 2, -(R * Math.sqrt(3)) / 2, -1 / 3],
  ];
  const faces = [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]];
  const pos = new Float32Array(faces.length * 9);
  const bary = new Float32Array(faces.length * 9);
  faces.forEach((f, fi) =>
    f.forEach((vi, k) => {
      pos.set(v[vi], fi * 9 + k * 3);
      bary[fi * 9 + k * 3 + k] = 1;
    }),
  );
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("bary", new THREE.BufferAttribute(bary, 3));
  return geo;
}

const material = (vertexShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

export class ParticleField {
  group = new THREE.Group();
  readonly count: number;
  private gpu: GPUComputationRenderer;
  private velVar: ReturnType<GPUComputationRenderer["addVariable"]>;
  private posVar: ReturnType<GPUComputationRenderer["addVariable"]>;
  private cloud: THREE.Mesh;
  private floaters: THREE.Mesh;
  private textures: THREE.DataTexture[] = [];
  private cloudUniforms: Record<string, THREE.IUniform>;
  private floaterUniforms: Record<string, THREE.IUniform>;
  private tmp = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer, { size, isMobile }: { size: number; isMobile: boolean }) {
    const S = size;
    this.count = S * S;

    // 1. Цільові форми → DataTexture (RGBA32F, S×S). Ранги — п'ята текстура.
    const shapes = SHAPES.map((name) => buildShape(name, this.count));
    const makeTex = (data: Float32Array) => {
      const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.FloatType);
      tex.minFilter = tex.magFilter = THREE.NearestFilter;
      tex.needsUpdate = true;
      this.textures.push(tex);
      return tex;
    };
    const shapeTex = shapes.map((pts) => {
      const rgba = new Float32Array(this.count * 4);
      for (let i = 0; i < this.count; i++) {
        rgba[i * 4] = pts[i * 3];
        rgba[i * 4 + 1] = pts[i * 3 + 1];
        rgba[i * 4 + 2] = pts[i * 3 + 2];
        rgba[i * 4 + 3] = 1;
      }
      return makeTex(rgba);
    });
    const rankTex = makeTex(buildRanks(shapes, this.count));

    // 2. Симуляція. Стартові позиції: стиснута «насінина» мозку (інтро її розкидає вибухом).
    this.gpu = new GPUComputationRenderer(S, S, renderer);
    this.gpu.setDataType(isMobile ? THREE.HalfFloatType : THREE.FloatType);
    const pos0 = this.gpu.createTexture();
    const vel0 = this.gpu.createTexture();
    for (let i = 0; i < this.count; i++) {
      pos0.image.data![i * 4] = shapes[0][i * 3] * 0.05;
      pos0.image.data![i * 4 + 1] = shapes[0][i * 3 + 1] * 0.05;
      pos0.image.data![i * 4 + 2] = shapes[0][i * 3 + 2] * 0.05;
    }
    this.velVar = this.gpu.addVariable("textureVelocity", VELOCITY, vel0);
    this.posVar = this.gpu.addVariable("texturePosition", POSITION, pos0);
    this.gpu.setVariableDependencies(this.velVar, [this.velVar, this.posVar]);
    this.gpu.setVariableDependencies(this.posVar, [this.velVar, this.posVar]);

    const simUniforms = (v: typeof this.velVar) => {
      const u = v.material.uniforms;
      u.tS0 = { value: shapeTex[0] }; u.tS1 = { value: shapeTex[1] };
      u.tS2 = { value: shapeTex[2] }; u.tS3 = { value: shapeTex[3] };
      u.tRank = { value: rankTex };
      u.uMorph = { value: 0 }; u.uTime = { value: 0 }; u.uDt = { value: 0.016 };
      u.uExplode = { value: 0 }; u.uMouseStr = { value: 0 }; u.uMouse = { value: new THREE.Vector3(99, 99, 99) };
    };
    simUniforms(this.velVar);
    this.posVar.material.uniforms.uDt = { value: 0.016 };
    const err = this.gpu.init();
    if (err) console.error("GPUComputationRenderer:", err);

    // 3. Рендер: один інстанс на частинку; `ref` вказує на її тексель у симуляції.
    const geo = tetraGeometry();
    geo.instanceCount = this.count;
    const ref = new Float32Array(this.count * 2);
    const aR = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      ref[i * 2] = ((i % S) + 0.5) / S;
      ref[i * 2 + 1] = (Math.floor(i / S) + 0.5) / S;
      aR[i * 4] = Math.random();
      aR[i * 4 + 1] = 0.022 + Math.random() * 0.018;
      aR[i * 4 + 3] = Math.random();
    }
    geo.setAttribute("ref", new THREE.InstancedBufferAttribute(ref, 2));
    geo.setAttribute("aR", new THREE.InstancedBufferAttribute(aR, 4));
    this.cloudUniforms = {
      tPos: { value: null }, tVel: { value: null },
      uTime: { value: 0 }, uSize: { value: 1 }, uAlpha: { value: 0.3 },
      uRim: { value: 1 }, uGrad: { value: 0 }, uRand: { value: 0 },
    };
    this.cloud = new THREE.Mesh(geo, material(PARTICLE_VERT, this.cloudUniforms));
    this.cloud.frustumCulled = false;
    this.group.add(this.cloud);

    // 4. Великі напівпрозорі тетраедри на різній глибині: їх розмиває боке.
    const FN = isMobile ? 60 : 130;
    const fgeo = tetraGeometry();
    fgeo.instanceCount = FN;
    const off = new Float32Array(FN * 3);
    const far = new Float32Array(FN * 4);
    for (let i = 0; i < FN; i++) {
      off[i * 3] = (Math.random() * 2 - 1) * 7;
      off[i * 3 + 1] = (Math.random() * 2 - 1) * 4;
      off[i * 3 + 2] = -5 + Math.random() * 8;
      far[i * 4] = Math.random();
      far[i * 4 + 1] = 0.06 + Math.pow(Math.random(), 2) * 0.28;
      far[i * 4 + 3] = Math.random();
    }
    fgeo.setAttribute("offset", new THREE.InstancedBufferAttribute(off, 3));
    fgeo.setAttribute("aR", new THREE.InstancedBufferAttribute(far, 4));
    this.floaterUniforms = { uTime: { value: 0 }, uAlpha: { value: 0.5 } };
    this.floaters = new THREE.Mesh(fgeo, material(FLOATER_VERT, this.floaterUniforms));
    this.floaters.frustumCulled = false;
    // Не в group: на них не діють трансформації форми (позиція, масштаб, обертання від скролу).
  }

  /** Додає великі «плавучі» тетраедри в сцену (окремо від групи частинок). */
  get floaterMesh() {
    return this.floaters;
  }

  update(time: number, dt: number, s: SceneState, mouseWorld: THREE.Vector3 | null) {
    const vu = this.velVar.material.uniforms;
    const pu = this.posVar.material.uniforms;
    const stepDt = Math.min(dt, 1 / 30);
    vu.uMorph.value = s.morph;
    vu.uTime.value = time;
    vu.uDt.value = stepDt;
    pu.uDt.value = stepDt;
    vu.uExplode.value = (1 - s.intro) * 0.9;

    // Мишу переводимо в локальні координати групи, бо симуляція живе в просторі форми.
    if (mouseWorld) {
      this.group.updateMatrixWorld();
      vu.uMouse.value.copy(this.group.worldToLocal(this.tmp.copy(mouseWorld)));
      vu.uMouseStr.value = 1;
    } else {
      vu.uMouseStr.value = 0;
    }

    this.gpu.compute();

    // Трансформація групи від скролу.
    this.group.position.set(s.partX, s.partY, 0);
    this.group.scale.setScalar(s.partScale * (0.55 + 0.45 * s.intro));
    this.group.rotation.set(s.partRotX, s.partRotY + Math.sin(time * 0.3) * 0.08, 0, "YXZ");

    const cu = this.cloudUniforms;
    cu.tPos.value = this.gpu.getCurrentRenderTarget(this.posVar).texture;
    cu.tVel.value = this.gpu.getCurrentRenderTarget(this.velVar).texture;
    cu.uTime.value = time;
    cu.uAlpha.value = 0.13 * s.intro;
    // Вага «мозку» (жовтий обідок) і «лампочки» (градієнт) з поточного morph.
    cu.uRim.value = 1 - THREE.MathUtils.smoothstep(s.morph, 0.0, 0.7);
    cu.uGrad.value = Math.max(0, 1 - Math.abs(s.morph - 2));
    cu.uRand.value = Math.max(0, 1 - Math.abs(s.morph - 1) * 1.6);
    this.floaterUniforms.uTime.value = time;
    this.floaterUniforms.uAlpha.value = 0.5 * s.intro;
  }

  dispose() {
    this.cloud.geometry.dispose();
    (this.cloud.material as THREE.Material).dispose();
    this.floaters.geometry.dispose();
    (this.floaters.material as THREE.Material).dispose();
    this.textures.forEach((t) => t.dispose());
    this.gpu.dispose();
  }
}
