/**
 * Pyramid — процедурна сцена з пірамід.
 *
 * На оригіналі це .glb-моделі з кількома рівнями деталізації (LOD) для
 * переднього, середнього й заднього планів. Тут ту саму ідею зроблено кодом:
 *  - одна велика «геройська» скляна піраміда (MeshPhysicalMaterial з transmission);
 *  - рій дрібних пірамід (InstancedMesh: один draw call на всі копії),
 *    розкиданий по глибині, щоб depth-of-field мав що розмивати.
 *
 * Важливо: цей клас нічого не знає про скрол. Він лише читає SceneState
 * щокадру. Скрол, інтро і мишу GSAP перетворює на числа в SceneState.
 */
import * as THREE from "three";
import type { SceneState } from "./state";

/** Квадратна піраміда з пласким шейдингом (кожна грань має власну нормаль). */
export function createPyramidGeometry(height = 1.25) {
  // ConeGeometry з 4 радіальними сегментами і є квадратною пірамідою.
  const geo = new THREE.ConeGeometry(1, height, 4, 1);
  geo.rotateY(Math.PI / 4); // ребром до камери виглядає цікавіше
  const flat = geo.toNonIndexed(); // без спільних вершин, щоб нормалі не усереднювалися
  flat.computeVertexNormals();
  geo.dispose();
  return flat;
}

type Instance = {
  base: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  scale: number;
  phase: number;
};

export class PyramidField {
  group = new THREE.Group();
  hero: THREE.Mesh;
  private heroEdges: THREE.LineSegments;
  private swarm: THREE.InstancedMesh;
  private instances: Instance[] = [];
  private dummy = new THREE.Object3D();

  constructor({ count }: { count: number }) {
    const geo = createPyramidGeometry();

    // Скло: transmission заломлює те, що позаду, iridescence дає райдужний відблиск.
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.08,
      transmission: 1,
      thickness: 1.6,
      ior: 1.45,
      iridescence: 1,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [200, 800],
      envMapIntensity: 1.4,
      flatShading: true,
    });
    this.hero = new THREE.Mesh(geo, glass);
    this.hero.scale.setScalar(1.7);
    this.group.add(this.hero);

    // Тонкі світлі ребра роблять форму читабельною навіть у розфокусі.
    this.heroEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 30),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
    );
    this.hero.add(this.heroEdges);

    // Рій: transmission на сотнях копій дорогий, тому тут дзеркально-перламутровий матеріал.
    const swarmMat = new THREE.MeshPhysicalMaterial({
      color: 0xa79fe0,
      metalness: 0.75,
      roughness: 0.22,
      iridescence: 1,
      iridescenceThicknessRange: [300, 900],
      envMapIntensity: 1.2,
      flatShading: true,
    });
    this.swarm = new THREE.InstancedMesh(geo, swarmMat, count);
    this.swarm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.swarm);

    // Детермінований псевдовипадковий генератор: однакова розкладка при кожному завантаженні.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    for (let i = 0; i < count; i++) {
      // Точки в «оболонці» навколо героя, витягнуті по Z: це передній, середній і задній плани.
      const r = 3.2 + rand() * 9;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const base = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta) * 1.4,
        r * Math.cos(phi) * 0.8,
        r * Math.sin(phi) * Math.sin(theta) * 1.2,
      );
      this.instances.push({
        base,
        rot: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
        spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.6),
        scale: 0.08 + Math.pow(rand(), 2.5) * 0.45,
        phase: rand() * Math.PI * 2,
      });
    }
  }

  update(time: number, s: SceneState) {
    // Герой: базове обертання від скролу плюс повільний «дрейф» у часі.
    this.hero.rotation.set(s.heroTiltX, s.heroRotY + time * 0.12, 0);
    this.hero.position.y = s.heroY + Math.sin(time * 0.8) * 0.06;
    this.hero.scale.setScalar(1.7 * s.heroScale * (0.6 + 0.4 * s.intro));

    for (let i = 0; i < this.instances.length; i++) {
      const it = this.instances[i];
      // spread розсуває рій від центру; intro збирає його з «вибуху».
      const k = s.spread * (1 + (1 - s.intro) * 1.5);
      this.dummy.position.set(
        it.base.x * k,
        it.base.y * k + Math.sin(time * 0.6 + it.phase) * 0.25,
        it.base.z * k,
      );
      this.dummy.rotation.set(
        it.rot.x + time * it.spin.x,
        it.rot.y + time * it.spin.y + s.heroRotY * 0.5,
        it.rot.z + time * it.spin.z,
      );
      this.dummy.scale.setScalar(it.scale * s.intro);
      this.dummy.updateMatrix();
      this.swarm.setMatrixAt(i, this.dummy.matrix);
    }
    this.swarm.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.hero.geometry.dispose();
    (this.hero.material as THREE.Material).dispose();
    this.heroEdges.geometry.dispose();
    (this.heroEdges.material as THREE.Material).dispose();
    (this.swarm.material as THREE.Material).dispose();
    this.swarm.dispose();
  }
}
