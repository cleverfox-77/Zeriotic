/**
 * Post-build gate on dist/.
 *
 * WHY: static-site regressions are invisible in a browser — the WebGL/React
 * experience renders perfectly on top of a broken page. A canonical that
 * points at the homepage, a title that was never rewritten, JSON-LD that does
 * not parse, an FAQ answer that no longer matches the schema, a stat that only
 * exists in JavaScript. Every one of those turned into a failed build here.
 *
 *   "verify:seo": "node scripts/verify-seo.mjs"   (standalone, against dist/)
 *   also called at the end of scripts/geo.mjs, so a bad build fails immediately
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ORIGIN, PAGES, SITEMAP_PAGES } from "./routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

/** Strip the way a text extractor does: scripts AND styles out, tags out, whitespace collapsed. */
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const norm = (s) => String(s).replace(/\s+/g, " ").trim();

/** Parse every ld+json block; return all nodes, walking @graph arrays. */
export function jsonLdNodes(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const data = JSON.parse(m[1]);
    for (const n of Array.isArray(data) ? data : [data]) {
      for (const x of n["@graph"] || [n]) nodes.push(x);
    }
  }
  return nodes;
}

/** The availability window the build should state: current + next quarter, UTC. */
export function availabilityText(when = new Date()) {
  const q = Math.ceil((when.getUTCMonth() + 1) / 3);
  const y = when.getUTCFullYear();
  const next = q === 4 ? `Q1 ${y + 1}` : `Q${q + 1} ${y}`;
  return `Available Q${q} ${y} / ${next}`;
}

function fail(problems, msg) {
  problems.push(msg);
}

async function checkRoute(p, problems) {
  const rel = p.out;
  const file = path.join(DIST, rel);
  const label = p.canonical.replace(ORIGIN, "") || "/";
  let html;
  try {
    html = await fs.readFile(file, "utf8");
  } catch {
    fail(problems, `${label}: ${rel} is missing — the route silently fell out of the build`);
    return;
  }

  // 1. Exactly one canonical, and it names this page.
  const canonicals = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  if (canonicals.length !== 1) fail(problems, `${label}: ${canonicals.length} canonical tags (need exactly 1)`);
  else if (canonicals[0] !== p.canonical) fail(problems, `${label}: canonical is ${canonicals[0]}, expected ${p.canonical}`);

  // 2. A real title, and not some other page's.
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim() ?? "";
  if (!title) fail(problems, `${label}: no <title>`);
  else if (p.title && title !== p.title) fail(problems, `${label}: title is "${title}", expected "${p.title}"`);

  // 3. A meta description of its own.
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1];
  if (!desc || !desc.trim()) fail(problems, `${label}: missing meta description`);

  // 4. Real crawler-visible content (scripts AND styles stripped).
  const chars = textOf(html).length;
  if (chars < p.minChars) fail(problems, `${label}: only ${chars} chars of crawler-visible text (floor ${p.minChars})`);

  // 5. JSON-LD parses and required types are present.
  let nodes = [];
  try {
    nodes = jsonLdNodes(html);
  } catch (e) {
    fail(problems, `${label}: JSON-LD does not parse (${e.message})`);
  }
  if (p.schema.length) {
    const types = nodes.flatMap((n) => (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]));
    for (const t of p.schema) {
      if (!types.includes(t)) fail(problems, `${label}: JSON-LD missing required type ${t} (found: ${types.join(", ") || "none"})`);
    }
  }

  // 6. FAQPage answers must match the visible page, word for word.
  const faq = nodes.find((n) => n["@type"] === "FAQPage");
  if (faq) {
    const visible = textOf(html);
    for (const q of faq.mainEntity || []) {
      if (!visible.includes(norm(q.name))) fail(problems, `${label}: FAQ question in schema not visible on page: "${q.name}"`);
      const answer = q.acceptedAnswer?.text;
      if (!answer || !visible.includes(norm(answer))) fail(problems, `${label}: FAQ answer in schema not visible on page: "${norm(answer || "").slice(0, 60)}..."`);
    }
  }

  // 7. altFile (the /privacy duplicate served from the rollup input) claims the same canonical.
  if (p.altFile) {
    const alt = await fs.readFile(path.join(DIST, p.altFile), "utf8").catch(() => null);
    if (!alt) fail(problems, `${label}: alt file ${p.altFile} missing`);
    else {
      const c = (alt.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/) || [])[1];
      if (c !== p.canonical) fail(problems, `${p.altFile}: canonical is ${c || "none"}, expected ${p.canonical}`);
    }
  }
}

async function checkGlobals(problems) {
  // Generated llms-full.txt: the file answer engines quote. It must exist and
  // actually contain case study text, not only links.
  const llms = await fs.readFile(path.join(DIST, "llms.txt"), "utf8").catch(() => null);
  if (!llms) fail(problems, "dist/llms.txt missing");
  else {
    if (!llms.includes("## Key facts")) fail(problems, "llms.txt has no Key facts section");
    if (!llms.includes("/llms-full.txt")) fail(problems, "llms.txt does not point at llms-full.txt");
  }

  const full = await fs.readFile(path.join(DIST, "llms-full.txt"), "utf8").catch(() => null);
  if (!full) fail(problems, "dist/llms-full.txt missing — it must be generated at build time");
  else {
    if (full.length < 8000) fail(problems, `llms-full.txt is only ${full.length} chars — case study text did not get inlined`);
    for (const p of PAGES.filter((x) => x.out.startsWith("work/"))) {
      const name = p.title.replace(" | Zeriotic", "");
      if (!full.includes(name)) fail(problems, `llms-full.txt does not contain the case study "${name}"`);
    }
  }

  // robots.txt: AI crawlers must be explicitly welcomed, sitemap linked.
  const robots = await fs.readFile(path.join(DIST, "robots.txt"), "utf8").catch(() => null);
  if (!robots) fail(problems, "dist/robots.txt missing");
  else {
    for (const ua of ["GPTBot", "ClaudeBot", "PerplexityBot", "OAI-SearchBot"]) {
      if (!robots.includes(`User-agent: ${ua}`)) fail(problems, `robots.txt does not explicitly allow ${ua}`);
    }
    if (!robots.includes("Sitemap:")) fail(problems, "robots.txt has no Sitemap line");
  }

  // sitemap.xml: generated, and exactly the published set.
  const sitemap = await fs.readFile(path.join(DIST, "sitemap.xml"), "utf8").catch(() => null);
  if (!sitemap) fail(problems, "dist/sitemap.xml missing");
  else {
    for (const p of SITEMAP_PAGES) {
      if (!sitemap.includes(`<loc>${p.canonical}</loc>`)) fail(problems, `sitemap.xml is missing ${p.canonical}`);
    }
  }

  // 404.html must exist for Netlify to serve a real 404 status.
  const notFound = await fs.readFile(path.join(DIST, "404.html"), "utf8").catch(() => null);
  if (!notFound) fail(problems, "dist/404.html missing — unknown paths would have no real 404");
  else if (!/noindex/i.test(notFound)) fail(problems, "404.html is not noindex");

  // Google Search Console verification file must ship byte-intact at the site root.
  const gsc = await fs.readFile(path.join(DIST, "googlea61f030e59885cd3.html"), "utf8").catch(() => null);
  if (!gsc) fail(problems, "dist/googlea61f030e59885cd3.html missing — Search Console verification would fail");
  else if (!gsc.includes("google-site-verification: googlea61f030e59885cd3.html")) {
    fail(problems, "dist/googlea61f030e59885cd3.html does not carry the expected verification token");
  }

  // Availability: the build regenerates it, so any stale quarter in the HTML
  // means the generator broke.
  const home = await fs.readFile(path.join(DIST, "index.html"), "utf8");
  const availRe = /Available Q\d \d{4} \/ Q\d \d{4}/g;
  const found = home.match(availRe) || [];
  const expected = availabilityText();
  if (!found.length) fail(problems, "index.html states no availability window");
  for (const f of found) {
    if (f !== expected) fail(problems, `index.html says "${f}" but the build window is "${expected}"`);
  }

  // Cross-surface fact: the OctaDezx automation figure must agree everywhere.
  const octa = await fs.readFile(path.join(DIST, "work/octadezx.html"), "utf8").catch(() => null);
  if (octa) {
    for (const [label, f] of [["index.html", home], ["work/octadezx.html", octa]]) {
      if (f.includes("80% of tier-1") || f.includes("80% queries")) fail(problems, `${label}: stale "80%" automation claim (the agreed figure is 78%)`);
    }
    if (!octa.includes("78%")) fail(problems, "work/octadezx.html lost the 78% automation figure");
  }
}

/** @param {typeof PAGES} expected */
export async function verifySeo(expected, { quiet = false } = {}) {
  const problems = [];
  for (const p of expected) await checkRoute(p, problems);
  await checkGlobals(problems);

  if (problems.length) {
    console.error(`\n[verify-seo] ${problems.length} problem(s) across ${expected.length} routes:`);
    for (const p of problems) console.error(`  ${p}`);
    console.error("");
    const err = new Error(`[verify-seo] ${problems.length} check(s) failed verification`);
    err.problems = problems;
    throw err;
  }
  if (!quiet) {
    console.log(`[verify-seo] ${expected.length} routes OK (canonical, title, description, content, schema, facts, llms, robots, 404).`);
  }
}

// Standalone entry: `npm run verify:seo` against whatever is in dist/.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await verifySeo(PAGES);
  } catch (err) {
    if (!err.problems) console.error(err.message);
    process.exit(1);
  }
}


