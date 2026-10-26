/**
 * BokehPass — власний depth-of-field (боке) у два кроки:
 *
 *  1. Сцена рендериться не на екран, а в WebGLRenderTarget з HDR-кольором і depth-текстурою.
 *  2. Повноекранний шейдер для кожного пікселя рахує «коло нерізкості» (CoC):
 *     що далі піксель від площини фокусу, то більший радіус розмиття. Потім він
 *     збирає сусідні пікселі по спіралі із золотим кутом (gather-bokeh).
 *     Яскраві точки отримують більшу вагу, тому розмиті відблиски стають
 *     круглими «бульбашками», як в об'єктиві.
 *  Наприкінці: tone mapping, sRGB, плівкове зерно й віньєтка.
 *
 * Обмеження gather-підходу: розмитий передній план не «наповзає» на різкий фон.
 * Для навчального прикладу (і для більшості лендінгів) цього достатньо.
 */
import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <packing>

  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uMaxBlur;
  uniform float uTime;
  varying vec2 vUv;

  #define SAMPLES 48
  #define GOLDEN_ANGLE 2.39996323

  float linearDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return -perspectiveDepthToViewZ(d, uNear, uFar);
  }

  // Коло нерізкості в пікселях. Ділимо на z, щоб далекий фон не розмивався безмежно.
  float coc(vec2 uv) {
    float z = linearDepth(uv);
    return clamp(abs(z - uFocus) / z * uAperture, 0.0, 1.0) * uMaxBlur;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float radius = coc(vUv);
    vec3 color = texture2D(tColor, vUv).rgb;
    vec3 acc = color;
    float total = 1.0;

    if (radius > 0.5) {
      for (int i = 1; i < SAMPLES; i++) {
        // Спіраль Фогеля: рівномірне заповнення диска без регулярного візерунка.
        float r = sqrt(float(i) / float(SAMPLES)) * radius;
        float a = float(i) * GOLDEN_ANGLE;
        vec2 suv = vUv + vec2(cos(a), sin(a)) * r / uResolution;
        vec3 s = texture2D(tColor, suv).rgb;
        // Сусід внесок дає, лише якщо його власне коло дотягується до нас.
        // Так різкі об'єкти не розмазуються на розмитий фон.
        float w = clamp(coc(suv) - r + 1.0, 0.0, 1.0);
        // Підсилення яскравих точок дає «бульбашки» боке.
        w *= 1.0 + pow(luminance(s), 2.0) * 3.0;
        acc += s * w;
        total += w;
      }
      color = acc / total;
    }

    gl_FragColor = vec4(color, 1.0);

    // Ті самі tone mapping і sRGB, що застосовує three.js при рендері на екран.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    // Плівкове зерно (оригінал робить це текстурою noise.jpg) і м'яка віньєтка.
    float grain = hash(vUv * uResolution + fract(uTime) * 100.0) - 0.5;
    gl_FragColor.rgb += grain * 0.045;
    float vig = smoothstep(1.25, 0.35, length(vUv - 0.5) * 1.6);
    gl_FragColor.rgb *= mix(0.72, 1.0, vig);
  }
`;

export class BokehPass {
  target: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(width: number, height: number, { samples = 4 } = {}) {
    this.target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType, // HDR: яскраві відблиски > 1.0 переживають до tone mapping
      samples,
      depthTexture: new THREE.DepthTexture(width, height, THREE.UnsignedIntType),
    });

    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tColor: { value: this.target.texture },
          tDepth: { value: this.target.depthTexture },
          uResolution: { value: new THREE.Vector2(width, height) },
          uNear: { value: 0.1 },
          uFar: { value: 100 },
          uFocus: { value: 9 },
          uAperture: { value: 1 },
          uMaxBlur: { value: 14 },
          uTime: { value: 0 },
        },
      }),
    );
    this.quad.frustumCulled = false;
  }

  setSize(width: number, height: number, pixelRatio: number) {
    const w = Math.floor(width * pixelRatio);
    const h = Math.floor(height * pixelRatio);
    this.target.setSize(w, h);
    this.quad.material.uniforms.uResolution.value.set(w, h);
    // Радіус розмиття задано в «CSS-пікселях», щоб на retina боке не ставало вдвічі меншим.
    this.quad.material.uniforms.uMaxBlur.value = 14 * pixelRatio;
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    { focus, aperture, time }: { focus: number; aperture: number; time: number },
  ) {
    const u = this.quad.material.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocus.value = focus;
    u.uAperture.value = aperture;
    u.uTime.value = time;

    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.quad, this.quadCamera);
  }

  dispose() {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}
