/**
 * Experience — точка входу WebGL: renderer, камера, світло, оточення і кадр.
 *
 * Потік даних за кадр (викликається з gsap.ticker, тобто в тому ж тіку,
 * що й Lenis і ScrollTrigger, тож скрол і 3D ніколи не розсинхронізуються):
 *
 *   скрол/інтро → GSAP → SceneState → update() → камера/меші → BokehPass → екран
 */
import * as THREE from "three";
import { BokehPass } from "./BokehPass";
import { ParticleField } from "./ParticleField";
import { initialState, type SceneState } from "./state";
import { Mouse } from "../mouse";

export class Experience {
  state: SceneState = initialState();
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private rig = new THREE.Group(); // обертається від миші, сама камера рухається від скролу
  private field: ParticleField;
  private bokeh: BokehPass | null;
  private mouse = new Mouse();
  private mouseWorld = new THREE.Vector3();
  private ray = new THREE.Vector3();
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

    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.rig.add(this.camera);
    this.scene.add(this.rig);

    // Тетраедри: 100×100 = 10 000 на десктопі, 84×84 ≈ 7 000 на мобільних (як і в оригіналі).
    this.field = new ParticleField(this.renderer, { size: isMobile ? 84 : 100, isMobile });
    this.scene.add(this.field.group, this.field.floaterMesh);

    // На мобільних bokeh вимкнено: 48 вибірок на піксель надто дорого для слабких GPU.
    this.bokeh = isMobile ? null : new BokehPass(1, 1, { samples: 4 });
    if (isMobile) this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.resize();
    window.addEventListener("resize", this.resize);
  }

  /**
   * Задачі для прелоадера. Шейдери компілюються заздалегідь, інакше перший кадр «стрибає».
   * Форми й симуляція вже створені в конструкторі (генерація точок синхронна).
   */
  loadTasks(): Promise<unknown>[] {
    return [this.renderer.compileAsync(this.scene, this.camera)];
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

    // Курсор → точка на площині z=0 у світових координатах (для відштовхування частинок на GPU).
    this.camera.updateMatrixWorld();
    this.ray.set(this.mouse.current.x, this.mouse.current.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const hit = -this.camera.position.z / this.ray.z;
    const hasMouse = this.mouse.target.x !== 0 || this.mouse.target.y !== 0;
    this.mouseWorld.copy(this.camera.position).addScaledVector(this.ray, hit);
    this.field.update(time, dt, s, hasMouse ? this.mouseWorld : null);
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
    this.renderer.dispose();
  }
}
