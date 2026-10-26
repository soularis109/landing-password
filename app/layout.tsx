import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

// Відкрита альтернатива платному гротеску з оригіналу.
const font = Inter_Tight({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "600"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Prisma: scroll-driven WebGL",
  description: "Навчальна реконструкція техніки: Three.js + GSAP ScrollTrigger + Lenis + bokeh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
