"use client";

/**
 * Scene — збирає все докупи на клієнті:
 *   Lenis (плавний скрол) → ScrollTrigger → GSAP-таймлайни → Experience (WebGL).
 *
 * Ключовий момент: усе працює в ОДНОМУ циклі gsap.ticker. Lenis рахує скрол,
 * ScrollTrigger оновлює scrub-таймлайни, і лише потім рендериться кадр Three.js.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { Experience } from "@/lib/webgl/Experience";
import { runPreloader } from "@/lib/loader";
import { createIntro, createReveals, createSceneTimeline } from "@/lib/scroll/timeline";

gsap.registerPlugin(ScrollTrigger);

export default function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = document.querySelector<HTMLElement>("[data-scroll-root]");
    const loader = document.querySelector<HTMLElement>("[data-loader]");
    const counter = document.querySelector<HTMLElement>("[data-loader-count]");
    const hero = document.querySelector<HTMLElement>("[data-hero]");
    if (!canvas || !root || !loader || !counter || !hero) return;

    let cancelled = false; // React StrictMode монтує ефект двічі
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    const experience = new Experience(canvas, { isMobile });
    const lenis = reduced ? null : new Lenis({ autoRaf: false, lerp: 0.09 });
    lenis?.on("scroll", ScrollTrigger.update);
    lenis?.stop(); // скрол заблоковано, поки йде прелоадер
    // Інтро завжди починається з hero: браузер не повинен відновлювати стару позицію.
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const tick = (time: number, deltaMs: number) => {
      lenis?.raf(time * 1000);
      experience.update(time, Math.min(deltaMs / 1000, 0.1));
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {});

    runPreloader(
      [document.fonts.ready, ...experience.loadTasks()],
      (v) => (counter.textContent = String(v)),
      { minDuration: reduced ? 0.2 : 1.6 },
    ).then(() => {
      if (cancelled) return;
      ctx.add(() => {
        createSceneTimeline(experience.state, root);
        if (reduced) {
          experience.state.intro = 1;
          gsap.set(loader, { autoAlpha: 0 });
        } else {
          createReveals(root);
          createIntro(experience.state, loader, hero);
        }
      });
      lenis?.start();
      ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      ctx.revert();
      gsap.ticker.remove(tick);
      lenis?.destroy();
      experience.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className="webgl" aria-hidden="true" />;
}
