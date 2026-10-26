import Scene from "@/components/Scene";
import InfiniteSlider, { type SlideItem } from "@/components/InfiniteSlider";

const slides: SlideItem[] = [
  { title: "Аналітика", meta: "01 / Кейс", hue: 250 },
  { title: "Платформа", meta: "02 / Кейс", hue: 20 },
  { title: "Бренд", meta: "03 / Кейс", hue: 300 },
  { title: "Мобайл", meta: "04 / Кейс", hue: 190 },
  { title: "Дані", meta: "05 / Кейс", hue: 40 },
  { title: "Пошук", meta: "06 / Кейс", hue: 140 },
];

export default function Home() {
  return (
    <>
      {/* Прелоадер: лічильник керується lib/loader.ts, після 100 шторка їде вгору. */}
      <div className="loader" data-loader>
        <span className="loader__label t-caps">Завантаження</span>
        <span className="loader__count">
          <span data-loader-count>0</span>
          <span className="loader__total">/100</span>
        </span>
      </div>

      <Scene />

      <header className="nav">
        <a href="#" className="nav__logo">
          Prisma
        </a>
        <nav className="nav__links">
          <a href="#clarity">Підхід</a>
          <a href="#work">Кейси</a>
          <a href="#contact" className="btn">
            Зв&apos;язатися
          </a>
        </nav>
      </header>

      {/* data-scroll-root: межі master-timeline. Кожна <section> дорівнює одному кадру сцени. */}
      <main data-scroll-root>
        <section className="section section--hero" data-hero>
          <h1 className="t-display" data-reveal="lines">
            Складні ідеї в ясній формі
          </h1>
          <p className="lead" data-intro="fade">
            Прокрутіть вниз: камера, фокус і світло прив&apos;язані до скролу.
          </p>
          <span className="scroll-hint t-caps" data-intro="fade">
            Скрол
          </span>
        </section>

        <section className="section section--right" id="clarity">
          <span className="eyebrow t-caps" data-reveal="fade">
            01 / Ясність
          </span>
          <h2 className="t-h2" data-reveal="lines">
            Бачити головне серед шуму
          </h2>
          <p className="body" data-reveal="fade">
            Камера відходить убік, рій розходиться, а фокус тримається на центральній формі.
          </p>
        </section>

        <section className="section section--left">
          <span className="eyebrow t-caps" data-reveal="fade">
            02 / Глибина
          </span>
          <h2 className="t-h2" data-reveal="lines">
            Пролітаємо крізь шари
          </h2>
          <p className="body" data-reveal="fade">
            Фокус переходить на передній план, і дальні піраміди розпливаються в боке.
          </p>
        </section>

        <section className="section section--center">
          <span className="eyebrow t-caps" data-reveal="fade">
            03 / Фокус
          </span>
          <h2 className="t-h2" data-reveal="lines">
            Одне рішення в центрі уваги
          </h2>
        </section>

        <section className="section section--slider" id="work">
          <div className="section__head">
            <span className="eyebrow t-caps" data-reveal="fade">
              04 / Кейси
            </span>
            <h2 className="t-h2" data-reveal="lines">
              Тягніть стрічку
            </h2>
          </div>
          <div data-reveal="fade">
            <InfiniteSlider items={slides} />
          </div>
        </section>

        <section className="section section--cta" id="contact">
          <h2 className="t-display" data-reveal="lines">
            Почнімо разом
          </h2>
          <a href="mailto:hello@example.com" className="btn btn--lg" data-reveal="fade">
            Написати нам
          </a>
        </section>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Prisma</span>
        <span>Навчальна демо-реалізація</span>
      </footer>
    </>
  );
}
