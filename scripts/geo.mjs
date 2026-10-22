/**
 * Build post-processor: `vite build && node scripts/geo.mjs`
 *
 * Runs after the bundler and turns dist/ from "what Vite emitted" into
 * "what should be published":
 *
 *   1. Regenerates the availability window in dist/index.html from the build
 *      date, so the static HTML can never go stale (it did before).
 *   2. Generates dist/sitemap.xml from scripts/routes.mjs.
 *   3. Generates dist/llms-full.txt: the llms.txt corpus with the full text of
 *      every case study inlined — the file answer engines quote.
 *   4. Runs the verify-seo gate so a bad build fails instead of deploying.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ORIGIN, PAGES, SITEMAP_PAGES } from "./routes.mjs";
import { verifySeo, availabilityText } from "./verify-seo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

/** Strip scripts, styles, tags and extra whitespace — how a text extractor reads a page. */
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function regenerateAvailability() {
  const file = path.join(DIST, "index.html");
  let html = await fs.readFile(file, "utf8");
  const avail = availabilityText();
  const next = html.replace(/(<(span|b) data-availability>)[^<]*(<)/g, `$1${avail}$3`);
  if (next !== html) {
    await fs.writeFile(file, next);
    console.log(`[geo] regenerated availability window (${avail})`);
  } else {
    console.log(`[geo] availability already current (${avail})`);
  }
}

async function generateSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = SITEMAP_PAGES.map(
    (p) => `  <url><loc>${p.canonical}</loc><lastmod>${today}</lastmod></url>`,
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  await fs.writeFile(path.join(DIST, "sitemap.xml"), xml);
  console.log(`[geo] regenerated sitemap.xml (${SITEMAP_PAGES.length} urls)`);
}

async function generateLlmsFull() {
  const file = path.join(DIST, "llms-full.txt");
  let full = await fs.readFile(path.join(DIST, "llms.txt"), "utf8");
  const marker = "\n## Full case study text\n";
  if (full.includes(marker)) {
    console.log("[geo] llms-full.txt already carries the corpus; skipping append");
    return;
  }
  let corpus = "";
  for (const p of PAGES.filter((x) => x.out.startsWith("work/") || x.out.startsWith("compare/") || x.out.startsWith("blog/"))) {
    const html = await fs.readFile(path.join(DIST, p.out), "utf8");
    const name = p.title.replace(" | Zeriotic", "");
    corpus += `\n### ${name}\n\n${textOf(html)}\n`;
  }
  full += marker + corpus;
  await fs.writeFile(file, full);
  console.log(`[geo] regenerated llms-full.txt (${corpus.length} chars of case study text inlined)`);
}

try {
  await regenerateAvailability();
  await generateSitemap();
  await generateLlmsFull();
  await verifySeo(PAGES);
} catch (err) {
  if (!err.problems) console.error("[geo] failed:", err.message);
  process.exit(1);
}
