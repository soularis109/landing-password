/**
 * Mouse — плавний паралакс за курсором.
 *
 * target одразу отримує положення курсора в діапазоні -1…1, а current
 * щокадру «доганяє» його лінійною інтерполяцією (lerp). Саме ця затримка
 * робить рух камери «важким» і дорогим на вигляд.
 * Коефіцієнт залежить від dt, тому на 60 Гц і на 120 Гц швидкість однакова.
 */
export class Mouse {
  target = { x: 0, y: 0 };
  current = { x: 0, y: 0 };

  constructor() {
    window.addEventListener("pointermove", this.onMove, { passive: true });
  }

  private onMove = (e: PointerEvent) => {
    this.target.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.target.y = -((e.clientY / window.innerHeight) * 2 - 1);
  };

  update(dt: number, ease = 0.05) {
    const k = 1 - Math.pow(1 - ease, dt * 60);
    this.current.x += (this.target.x - this.current.x) * k;
    this.current.y += (this.target.y - this.current.y) * k;
  }

  destroy() {
    window.removeEventListener("pointermove", this.onMove);
  }
}
