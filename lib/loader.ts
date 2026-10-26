/**
 * Preloader — лічильник «0 → 100» на основі реальних задач.
 *
 * Кожна задача (шрифти, оточення, компіляція шейдерів, у справжньому проєкті
 * ще й моделі/текстури через THREE.LoadingManager) по завершенню додає свою частку.
 * Число на екрані не стрибає, а «доганяє» реальний прогрес через GSAP-твін,
 * плюс є мінімальна тривалість, щоб інтро не промайнуло за один кадр.
 */
import gsap from "gsap";

export function runPreloader(
  tasks: Promise<unknown>[],
  onUpdate: (value: number) => void,
  { minDuration = 1.6 } = {},
): Promise<void> {
  const shown = { value: 0 };
  let done = 0;
  let tween: gsap.core.Tween | null = null;

  const animateTo = (target: number, duration: number) => {
    tween?.kill();
    tween = gsap.to(shown, {
      value: target,
      duration,
      ease: "power2.out",
      onUpdate: () => onUpdate(Math.round(shown.value)),
    });
    return tween;
  };

  // Поки задачі виконуються, лічильник повільно повзе, але не далі 90%.
  animateTo(90, minDuration * 2);

  tasks.forEach((t) =>
    t.finally(() => {
      done++;
      // Реальний прогрес лише «підштовхує» лічильник уперед, назад він не їде.
      const real = (done / tasks.length) * 90;
      if (real > shown.value) animateTo(Math.max(real, shown.value), 0.4);
    }),
  );

  const minTime = new Promise((r) => setTimeout(r, minDuration * 1000));

  return Promise.all([Promise.allSettled(tasks), minTime]).then(
    () =>
      new Promise<void>((resolve) => {
        animateTo(100, 0.6).eventCallback("onComplete", () => resolve());
      }),
  );
}
