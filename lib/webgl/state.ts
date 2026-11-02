/**
 * SceneState — головний прийом усієї анімації.
 *
 * GSAP не знає про Three.js. Він анімує звичайні числа в цьому об'єкті:
 *   - scroll-timeline (ScrollTrigger зі scrub) змінює camZ, focus, morph, partX…;
 *   - intro-timeline після прелоадера змінює intro від 0 до 1;
 *   - render loop щокадру читає ці числа й застосовує їх до камери, мешів і шейдерів.
 *
 * Тому анімації можна налаштовувати в одному місці (lib/scroll/timeline.ts),
 * а WebGL-код лишається простим.
 */
export type SceneState = {
  camX: number;
  camY: number;
  camZ: number;
  lookY: number;
  /** Позиція, масштаб і обертання хмари частинок. */
  partX: number;
  partY: number;
  partScale: number;
  partRotX: number;
  partRotY: number;
  /** Прогрес морфінгу між формами: 0 мозок, 1 розсип, 2 лампочка, 3 глобус. */
  morph: number;
  /** Дистанція фокусу (у світових одиницях від камери). */
  focus: number;
  /** Сила розмиття поза фокусом. */
  aperture: number;
  exposure: number;
  /** 0 до прелоадера, 1 після інтро. */
  intro: number;
};

export const initialState = (): SceneState => ({
  camX: 0,
  camY: 0.2,
  camZ: 9,
  lookY: 0,
  partX: 1.7,
  partY: -0.1,
  partScale: 2.1,
  partRotX: 0.12,
  partRotY: -0.5,
  morph: 0,
  focus: 9,
  aperture: 0.6,
  exposure: 1,
  intro: 0,
});
