/**
 * SceneState — головний прийом усієї анімації.
 *
 * GSAP не знає про Three.js. Він анімує звичайні числа в цьому об'єкті:
 *   - scroll-timeline (ScrollTrigger зі scrub) змінює camZ, focus, heroRotY…;
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
  heroRotY: number;
  heroTiltX: number;
  heroY: number;
  heroScale: number;
  spread: number;
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
  heroRotY: 0,
  heroTiltX: 0,
  heroY: 0,
  heroScale: 1,
  spread: 1,
  focus: 9,
  aperture: 1,
  exposure: 1,
  intro: 0,
});
