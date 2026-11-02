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

/**
 * Кадр сцени для кожної секції після hero (hero = initialState).
 * morph: 0 мозок → 1 розсип → 2 лампочка → 3 глобус; partX/partScale ставлять форму поруч із текстом.
 */
const keyframes: Partial<SceneState>[] = [
  // 01 «Ясність»: мозок розсипається, хмара йде на середину
  { partX: 0, partY: 0, partScale: 1.5, partRotX: 0, partRotY: 0.4, morph: 1, focus: 9, aperture: 0.8 },
  // 02 «Глибина»: збирається лампочка ліворуч; фокус ближче, дальні тетраедри розпливаються
  { partX: -1.9, partY: -0.1, partScale: 2.1, partRotX: 0, partRotY: 0.35, morph: 2, focus: 9, aperture: 1.2 },
  // 03 «Фокус»: глобус праворуч, велика різкість на ньому
  { partX: 1.9, partY: 0, partScale: 1.9, partRotX: 0.25, partRotY: 1.6, morph: 3, focus: 9, aperture: 0.7, exposure: 1.1 },
  // 04 слайдер: глобус відходить угору й тьмяніє, щоб не заважати контенту
  { partX: 0, partY: 1.1, partScale: 1.1, partRotX: 0.1, partRotY: 3.0, morph: 3, focus: 9, aperture: 1.6, exposure: 0.5 },
  // 05 CTA: форма «перемотується» назад у мозок
  { partX: 0, partY: 0, partScale: 1.9, partRotX: 0.12, partRotY: 6.1, morph: 0, focus: 9, aperture: 0.6, exposure: 1 },
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
