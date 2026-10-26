/**
 * splitLines — розбиває текст на рядки для reveal-анімації «з-під маски».
 *
 * 1. Кожне слово обгортається у <span>.
 * 2. Слова групуються за offsetTop: однаковий top означає той самий візуальний рядок.
 * 3. Кожен рядок кладеться у .line-mask (overflow: hidden) > .line.
 * Потім GSAP зсуває .line з yPercent: 110 до 0, і текст «виїжджає» з-під маски.
 *
 * Рядки залежать від ширини екрана. Тут split робиться один раз, бо reveal
 * одноразовий (once: true). Якщо анімація повторювана, перерахунок треба
 * робити на resize (або взяти GSAP SplitText з autoSplit).
 */
export function splitLines(el: HTMLElement): HTMLElement[] {
  if (el.dataset.split === "done") return Array.from(el.querySelectorAll<HTMLElement>(".line"));

  const words = (el.textContent ?? "").trim().split(/\s+/);
  el.textContent = "";
  const spans = words.map((w) => {
    const s = document.createElement("span");
    s.textContent = w;
    s.style.display = "inline-block";
    el.append(s, " ");
    return s;
  });

  const rows: HTMLSpanElement[][] = [];
  let lastTop: number | null = null;
  for (const s of spans) {
    if (lastTop === null || Math.abs(s.offsetTop - lastTop) > 2) {
      rows.push([]);
      lastTop = s.offsetTop;
    }
    rows[rows.length - 1].push(s);
  }

  el.textContent = "";
  const lines = rows.map((row) => {
    const mask = document.createElement("span");
    mask.className = "line-mask";
    const line = document.createElement("span");
    line.className = "line";
    line.textContent = row.map((s) => s.textContent).join(" ");
    mask.append(line);
    el.append(mask);
    return line;
  });

  el.dataset.split = "done";
  return lines;
}
