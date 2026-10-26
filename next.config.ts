import type { NextConfig } from "next";

// Статичний експорт для GitHub Pages. basePath приходить з workflow
// (сайт живе за адресою /<repo>/), локально він порожній.
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
