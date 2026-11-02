/**
 * Цільові форми для частинок: власні математичні генератори (не запечені текстури оригіналу).
 *
 * Кожна форма повертає N точок (x, y, z). Для щільних форм (мозок, лампочка, глобус)
 * використано Poisson-disk: між точками є мінімальна відстань, тож трикутники лягають
 * рівномірно, без накладань і «пухнастих» згустків.
 */
export type ShapeName = "brain" | "scatter" | "bulb" | "globe";
export const SHAPES: ShapeName[] = ["brain", "scatter", "bulb", "globe"];

const r = Math.random;
const TAU = Math.PI * 2;

function unit(): [number, number, number] {
  const u = r() * TAU;
  const z = r() * 2 - 1;
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(u), z, s * Math.sin(u)];
}

/** Ridged-шум: гострі гребені = звивини, глибокі канавки = борозни. */
const ridge = (x: number, y: number, z: number) => {
  const a = 1 - Math.abs(Math.sin(x * 5.1 + Math.sin(y * 3.7 + z * 2.3) * 1.6));
  const b = 1 - Math.abs(Math.sin(y * 6.3 + Math.sin(z * 4.1 + x * 2.9) * 1.4));
  const c = 1 - Math.abs(Math.sin(z * 5.7 + Math.sin(x * 3.3 + y * 4.7) * 1.5));
  return (a * b + b * c + c * a) / 3;
};

type Gen = (out: Float32Array, i: number) => void;

const brain: Gen = (out, i) => {
  const k = r();
  let x: number, y: number, z: number;
  if (k < 0.07) {
    // мозочок: дрібні паралельні складки
    const [dx, dy, dz] = unit();
    const sh = r() < 0.9 ? 0.93 + 0.07 * r() : Math.cbrt(r()) * 0.9;
    const fol = 1 + 0.07 * Math.sin(dy * 34 + dx * 3);
    x = -0.62 + 0.4 * dx * sh * fol;
    y = -0.5 + 0.2 * dy * sh * fol;
    z = 0.44 * dz * sh * fol;
  } else if (k < 0.11) {
    // стовбур
    const a = r() * TAU;
    const rad = 0.095 * (0.8 + 0.4 * r());
    x = -0.18 + Math.cos(a) * rad;
    z = Math.sin(a) * rad;
    y = -0.5 - r() * 0.85;
  } else {
    const side = r() < 0.5 ? -1 : 1;
    let [dx, dy, dz] = unit();
    // у канавках частинок немає: лишаються звивини з темними борознами
    for (let t = 0; t < 8; t++) {
      const g = ridge(dx * 2.3 + 1.7, dy * 2.3, dz * 2.3 - 0.9);
      const central = Math.abs(dx * 0.9 - dy * 0.35 + 0.1) < 0.025 ? 0 : 1;
      if (central && r() < 0.18 + 0.82 * Math.min(1, Math.max(0, (g - 0.18) / 0.4))) break;
      [dx, dy, dz] = unit();
    }
    let bx = 0, by = 0, bz = 0, rx = 1, ry = 0.84, rz = 0.55;
    if (k < 0.24) {
      // скронева частка
      bx = 0.15; by = -0.2; bz = side * 0.36; rx = 0.5; ry = 0.24; rz = 0.24;
    }
    const sh = r() < 0.95 ? 0.96 + 0.04 * r() : Math.cbrt(r()) * 0.92;
    const f = 1 + 0.14 * (ridge(dx * 1.2, dy * 1.2, dz * 1.2) - 0.5) + 0.025 * Math.sin(dx * 21 + dz * 13);
    let px = bx + dx * rx * sh * f;
    let py = by + (dy > 0 ? dy : dy * 0.68) * ry * sh * f;
    let pz = bz + dz * rz * sh * f;
    if (!bx) {
      pz = side * (0.085 + Math.abs(dz) * 0.5 * sh * f); // серединна щілина
      py -= 0.04;
      py -= 0.05 * Math.exp(-Math.pow((py + 0.1) / 0.05, 2)) * (px > -0.25 ? 1 : 0.3); // сільвієва борозна
      if (px > 0.5) py += (px - 0.5) * 0.12; // лобова частка підіймається
    }
    if (py < -0.28) px *= 0.94;
    x = px; y = py; z = pz;
  }
  out[i] = x; out[i + 1] = y; out[i + 2] = z;
};

const scatter: Gen = (out, i) => {
  out[i] = (r() * 2 - 1) * 5.2;
  out[i + 1] = (r() * 2 - 1) * 3.2;
  out[i + 2] = (r() * 2 - 1) * 3.4;
};

const bulb: Gen = (out, i) => {
  const k = r();
  let x: number, y: number, z: number;
  if (k < 0.72) {
    let d: [number, number, number];
    do d = unit(); while (d[1] < -0.5);
    const sh = r() < 0.9 ? 0.95 + 0.05 * r() : Math.cbrt(r()) * 0.9;
    x = d[0] * 0.85 * sh; y = 0.35 + d[1] * 0.85 * sh; z = d[2] * 0.85 * sh;
  } else if (k < 0.85) {
    const t = r();
    const rad = 0.62 - 0.3 * t;
    const a = r() * TAU;
    x = Math.cos(a) * rad; z = Math.sin(a) * rad; y = -0.12 - t * 0.53;
  } else {
    const t = r();
    const a = r() * TAU;
    const rad = 0.32 + 0.025 * Math.sin(t * 60);
    x = Math.cos(a) * rad; z = Math.sin(a) * rad; y = -0.65 - t * 0.45;
  }
  out[i] = x; out[i + 1] = y - 0.05; out[i + 2] = z;
};

const globe: Gen = (out, i) => {
  const [dx, dy, dz] = unit();
  const sh = r() < 0.92 ? 0.97 + 0.03 * r() : Math.cbrt(r()) * 0.9;
  out[i] = dx * sh; out[i + 1] = dy * sh; out[i + 2] = dz * sh;
};

const GEN: Record<ShapeName, Gen> = { brain, scatter, bulb, globe };
/** Мінімальна відстань Poisson-disk (одиниці форми). Для scatter не потрібна. */
const MIN_DIST: Partial<Record<ShapeName, number>> = { brain: 0.028, bulb: 0.034, globe: 0.034 };

export function buildShape(shape: ShapeName, count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const fn = GEN[shape];
  const md = MIN_DIST[shape];
  if (!md) {
    for (let n = 0; n < count; n++) fn(out, n * 3);
    return out;
  }
  const grid = new Map<number, number[]>();
  const key = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  const tmp = new Float32Array(3);
  const md2 = md * md;
  let n = 0;
  for (let tries = 0; n < count && tries < count * 50; tries++) {
    fn(tmp, 0);
    const cx = Math.floor(tmp[0] / md), cy = Math.floor(tmp[1] / md), cz = Math.floor(tmp[2] / md);
    let ok = true;
    for (let dx = -1; ok && dx <= 1; dx++)
      for (let dy = -1; ok && dy <= 1; dy++)
        for (let dz = -1; ok && dz <= 1; dz++) {
          const cell = grid.get(key(cx + dx, cy + dy, cz + dz));
          if (!cell) continue;
          for (const j of cell) {
            const ex = out[j] - tmp[0], ey = out[j + 1] - tmp[1], ez = out[j + 2] - tmp[2];
            if (ex * ex + ey * ey + ez * ez < md2) { ok = false; break; }
          }
        }
    if (!ok) continue;
    out.set(tmp, n * 3);
    const k = key(cx, cy, cz);
    const bucket = grid.get(k);
    if (bucket) bucket.push(n * 3);
    else grid.set(k, [n * 3]);
    n++;
  }
  for (; n < count; n++) fn(out, n * 3); // залишок: випадково
  return out;
}

/**
 * Порядок частинок для «хвилі»: для кожної форми ранг за висотою (зверху вниз), нормалізований до 0..1.
 * Перехід A→B стартує з затримкою за рангом у формі B, тож морфінг прокочується хвилею, а не стрибає разом.
 */
export function buildRanks(shapes: Float32Array[], count: number): Float32Array {
  const out = new Float32Array(count * 4);
  shapes.forEach((pts, s) => {
    const idx = Array.from({ length: count }, (_, i) => i).sort((a, b) => pts[b * 3 + 1] - pts[a * 3 + 1]);
    idx.forEach((particle, rank) => {
      out[particle * 4 + s] = rank / (count - 1);
    });
  });
  return out;
}
