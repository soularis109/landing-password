/**
 * Усі таймлайни сторінки.
 *
 * 1. createSceneTimeline: ОДИН master-timeline зі scrub, прив'язаний до висоти
 *    всієї сторінки. Кожна секція займає 1 одиницю часу в таймлайні, тож
 *    прогрес скролу між секціями N і N+1 відповідає твіну до кадру N+1.
 *    scrub: 1.2 означає, що 3D «доганяє» скрол ~1.2 с, і рух виходить інерційним.
 *
 * 2. createReveals: одноразові (once: true) появи тексту, ease "expo.out".
 *    Такий самий підхід використано на оригіналі.
 *
 * 3. createIntro: те, що відбувається після прелоадера.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { SceneState } from "../webgl/state";
import { splitLines } from "./splitLines";

gsap.registerPlugin(ScrollTrigger);

/** Кадр сцени для кожної секції після hero (hero = initialState). */
const keyframes: Partial<SceneState>[] = [
  // 01 «Ясність»: камера відходить праворуч, фокус на герої, рій трохи розходиться
  { camX: 2.6, camY: 0.6, camZ: 10.5, heroRotY: Math.PI * 0.5, heroTiltX: 0.15, spread: 1.15, focus: 10.6, aperture: 1.2 },
  // 02 «Глибина»: проліт крізь рій; фокус переходить на передній план, герой розмивається
  { camX: -1.8, camY: -0.4, camZ: 5.2, heroRotY: Math.PI * 1.1, heroTiltX: -0.2, spread: 0.85, focus: 3.2, aperture: 2.4 },
  // 03 «Фокус»: великий план героя, глибока різкість на ньому
  { camX: 0, camY: 0.2, camZ: 4.6, lookY: 0.15, heroRotY: Math.PI * 1.75, heroTiltX: 0, heroScale: 1.15, spread: 1.4, focus: 4.6, aperture: 1.6, exposure: 1.15 },
  // 04 слайдер: герой «пливе» вгору, сцена тьмяніє, щоб не заважати контенту
  { camX: 0, camY: -1.2, camZ: 12, lookY: -0.6, heroRotY: Math.PI * 2.2, heroY: 1.2, heroScale: 0.9, spread: 1.8, focus: 12, aperture: 2.8, exposure: 0.55 },
  // 05 CTA: піраміда повертається в центр, як фінальний «логотип»
  { camX: 0, camY: 0, camZ: 8, lookY: 0, heroRotY: Math.PI * 3, heroY: 0, heroScale: 1, spread: 0.9, focus: 8, aperture: 1, exposure: 1 },
];

export function createSceneTimeline(state: SceneState, root: HTMLElement) {
  const tl = gsap.timeline({
    defaults: { ease: "power1.inOut", duration: 1 },
    scrollTrigger: {
      trigger: root,
      start: "top top",
      end: "bottom bottom",
      scrub: 1.2,
    },
  });
  keyframes.forEach((kf) => tl.to(state, kf));
  return tl;
}

export function createReveals(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-reveal='lines']").forEach((el) => {
    // Hero-заголовок показує інтро, а не скрол.
    if (el.closest("[data-hero]")) return;
    const lines = splitLines(el);
    gsap.from(lines, {
      yPercent: 110,
      duration: 1.6,
      ease: "expo.out",
      stagger: 0.08,
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
  });

  root.querySelectorAll<HTMLElement>("[data-reveal='fade']").forEach((el) => {
    gsap.from(el, {
      autoAlpha: 0,
      y: 40,
      duration: 1.4,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });
}

export function createIntro(state: SceneState, loader: HTMLElement, hero: HTMLElement) {
  const heroLines = Array.from(hero.querySelectorAll<HTMLElement>("[data-reveal='lines']")).flatMap(splitLines);
  const heroFades = hero.querySelectorAll<HTMLElement>("[data-intro='fade']");
  gsap.set(heroLines, { yPercent: 110 });
  gsap.set(heroFades, { autoAlpha: 0, y: 20 });

  return gsap
    .timeline()
    .to(loader, { yPercent: -100, duration: 1.2, ease: "expo.inOut" })
    .to(state, { intro: 1, duration: 2.6, ease: "expo.out" }, "-=0.6")
    .to(heroLines, { yPercent: 0, duration: 1.6, ease: "expo.out", stagger: 0.1 }, "<0.2")
    .to(heroFades, { autoAlpha: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.1 }, "<0.4");
}
