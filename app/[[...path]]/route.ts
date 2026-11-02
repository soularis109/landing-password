/**
 * Локальний референс: віддає завантажену копію dala.craftedbygc.com з диска.
 *
 * Файли НЕ лежать у цьому репозиторії: вони читаються з DALA_REF_DIR
 * (за замовчуванням ~/Desktop/dala-reference). Це чужий сайт, і він потрібен
 * лише для особистого вивчення, тому в production-збірці роут вимкнено.
 */
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(process.env.DALA_REF_DIR ?? path.join(homedir(), "Desktop", "dala-reference"));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
  ".exr": "image/x-exr",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

export async function GET(_req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });

  const { path: segments = [] } = await ctx.params;
  const rel = segments.length ? segments.join("/") : "index.html";
  const file = path.resolve(ROOT, rel);

  // Захист від виходу за межі папки референсу (../).
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return new Response("Forbidden", { status: 403 });

  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
