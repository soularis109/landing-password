"use client";

/**
 * InfiniteSlider — нескінченна стрічка карток з drag, інерцією і Prev/Next.
 *
 * Ідея: є одне число offset. Кожна картка ставиться в
 *   x = wrap(i * itemWidth + offset)
 * де wrap «загортає» значення в діапазон [-itemWidth, totalWidth - itemWidth).
 * Картка, що виїхала ліворуч, миттєво з'являється праворуч, і стрічка не має кінця.
 * Перетягування змінює target, current доганяє його через lerp, а швидкість
 * (current - previous) дає легкий нахил карток, як на сайтах студії.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

export type SlideItem = { title: string; meta: string; hue: number };

export default function InfiniteSlider({ items }: { items: SlideItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const api = useRef({ prev: () => {}, next: () => {} });

  // Дублюємо набір, щоб стрічка гарантовано перекривала ширину екрана.
  const slides = [...items, ...items];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];

    let itemW = 0;
    let totalW = 0;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      itemW = cards[0].offsetWidth + gap;
      totalW = itemW * cards.length;
    };
    measure();

    const s = { target: 0, current: 0, last: 0, dragging: false, startX: 0, startTarget: 0 };
    const snap = () => (s.target = Math.round(s.target / itemW) * itemW);

    const onDown = (e: PointerEvent) => {
      s.dragging = true;
      s.startX = e.clientX;
      s.startTarget = s.target;
      track.setPointerCapture(e.pointerId);
      track.classList.add("is-dragging");
    };
    const onMove = (e: PointerEvent) => {
      if (s.dragging) s.target = s.startTarget + (e.clientX - s.startX) * 1.4;
    };
    const onUp = () => {
      if (!s.dragging) return;
      s.dragging = false;
      track.classList.remove("is-dragging");
      snap();
    };

    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
    track.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", measure);

    api.current.prev = () => {
      snap();
      s.target += itemW;
    };
    api.current.next = () => {
      snap();
      s.target -= itemW;
    };

    const tick = (_t: number, deltaMs: number) => {
      const k = 1 - Math.pow(1 - 0.085, (deltaMs / 1000) * 60);
      s.current += (s.target - s.current) * k;
      const velocity = s.current - s.last;
      s.last = s.current;

      const wrap = gsap.utils.wrap(-itemW, totalW - itemW);
      const skew = gsap.utils.clamp(-8, 8, velocity * 0.25);
      cards.forEach((card, i) => {
        const x = wrap(i * itemW + s.current);
        card.style.transform = `translate3d(${x}px,0,0) skewX(${-skew}deg)`;
      });
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
      track.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div className="slider">
      <div className="slider__track" ref={trackRef}>
        {slides.map((item, i) => (
          <article
            className="slider__card"
            key={i}
            aria-hidden={i >= items.length}
            style={{ "--hue": item.hue } as React.CSSProperties}
          >
            <div className="slider__media">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <path d="M50 14 L86 82 L14 82 Z" />
                <path d="M50 14 L58 82" />
              </svg>
            </div>
            <h3 className="slider__title">{item.title}</h3>
            <p className="slider__meta">{item.meta}</p>
          </article>
        ))}
      </div>
      <div className="slider__controls">
        <button type="button" className="btn btn--ghost" onClick={() => api.current.prev()}>
          Назад
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => api.current.next()}>
          Далі
        </button>
      </div>
    </div>
  );
}
