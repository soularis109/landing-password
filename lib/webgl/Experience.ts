/**
 * Experience — точка входу WebGL: renderer, камера, світло, оточення і кадр.
 *
 * Потік даних за кадр (викликається з gsap.ticker, тобто в тому ж тіку,
 * що й Lenis і ScrollTrigger, тож скрол і 3D ніколи не розсинхронізуються):
 *
 *   скрол/інтро → GSAP → SceneState → update() → камера/меші → BokehPass → екран
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BokehPass } from "./BokehPass";
import { PyramidField } from "./Pyramid";
import { initialState, type SceneState } from "./state";
import { Mouse } from "../mouse";

export class Experience {
  state: SceneState = initialState();
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private rig = new THREE.Group(); // обертається від миші, сама камера рухається від скролу
  private field: PyramidField;
  private bokeh: BokehPass | null;
  private mouse = new Mouse();
  private envRT: THREE.WebGLRenderTarget | null = null;
  private isMobile: boolean;

  constructor(canvas: HTMLCanvasElement, { isMobile }: { isMobile: boolean }) {
    this.isMobile = isMobile;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // MSAA робить render target у BokehPass
      powerPreference: "high-performance",
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));

    this.scene.background = new THREE.Color(0x0a0a10);
    this.scene.fog = new THREE.Fog(0x0a0a10, 14, 30);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.rig.add(this.camera);
    this.scene.add(this.rig);

    // Кольорові «студійні» джерела: їхні відблиски на гранях стають кулями боке.
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 6, 5);
    const warm = new THREE.PointLight(0xff8a5c, 40, 30);
    warm.position.set(-5, -2, 3);
    const cool = new THREE.PointLight(0x6b7cff, 50, 30);
    cool.position.set(5, 3, -4);
    this.scene.add(key, warm, cool);

    this.field = new PyramidField({ count: isMobile ? 60 : 160 });
    this.scene.add(this.field.group);

    // На мобільних bokeh вимкнено: 48 вибірок на піксель надто дорого для слабких GPU.
    this.bokeh = isMobile ? null : new BokehPass(1, 1, { samples: 4 });
    if (isMobile) this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.resize();
    window.addEventListener("resize", this.resize);
  }

  /**
   * Задачі для прелоадера. В оригіналі це завантаження .glb/KTX/EXR;
   * тут це генерація оточення і попередня компіляція шейдерів.
   * Компіляція й дає «ривок» першого кадру, якщо її не зробити заздалегідь.
   */
  loadTasks(): Promise<unknown>[] {
    const env = new Promise<void>((resolve) => {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      this.scene.environment = this.envRT.texture;
      pmrem.dispose();
      resolve();
    });
    const compile = env.then(() => this.renderer.compileAsync(this.scene, this.camera));
    return [env, compile];
  }

  resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // На вузьких екранах трохи ширший кут, щоб піраміда влазила в кадр.
    this.camera.fov = w < h ? 48 : 35;
    this.camera.updateProjectionMatrix();
    this.bokeh?.setSize(w, h, this.renderer.getPixelRatio());
  };

  update(time: number, dt: number) {
    const s = this.state;

    this.mouse.update(dt);
    this.rig.rotation.y = this.mouse.current.x * 0.12;
    this.rig.rotation.x = this.mouse.current.y * 0.06;

    // Інтро: камера «прилітає» здалеку, поки intro іде від 0 до 1.
    const introPush = (1 - s.intro) * 10;
    this.camera.position.set(s.camX, s.camY, s.camZ + introPush);
    this.camera.lookAt(0, s.lookY, 0);

    this.field.update(time, s);
    this.renderer.toneMappingExposure = s.exposure * s.intro;

    if (this.bokeh) {
      this.bokeh.render(this.renderer, this.scene, this.camera, {
        focus: s.focus + introPush,
        aperture: s.aperture,
        time,
      });
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    window.removeEventListener("resize", this.resize);
    this.mouse.destroy();
    this.field.dispose();
    this.bokeh?.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();
  }
}
