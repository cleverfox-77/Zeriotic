/**
 * Audit a deployed site the way a non-JavaScript crawler sees it.
 *
 *   "verify:live": "node scripts/verify-live.mjs"
 *
 *   npm run verify:live                    # against production
 *   npm run verify:live -- --origin=...    # against a preview deployment
 *
 * WHY IT EXISTS: chat assistants repeatedly report that a site "returns the
 * homepage" or "is blocked", and those claims are usually a stale retrieval
 * cache on their side. This makes settling it one command, so the next such
 * claim takes thirty seconds to confirm or refute with real evidence.
 *
 * Reads the URL list from the GENERATED dist/sitemap.xml, so it always checks
 * exactly what was published. For each URL it asserts a 200, a
 * self-referential canonical, and real crawler-visible text — which together
 * are the whole claim: this page is readable without running JavaScript.
 *
 * Exit 1 separates "unreachable" from "wrong content". A dropped connection is
 * not evidence that a page is broken and must never be reported as though it
 * were.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── configure ───────────────────────────────────────────────────────────────
const ORIGIN = "https://zeriotic.com"; // the canonical origin in your sitemap
const DIST_DIR = "dist";               // build output folder
const MIN_FALLBACK_CHARS = 500;        // floor for crawler-visible text
// This site has no per-route prerender markers; measuring the whole <body> is
// the weaker but correct mode here (it still catches an empty shell).
const MARKERS = null;
// ────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", DIST_DIR);

// A real crawler UA: the point is to check what GPTBot and friends actually get.
const UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";

/**
 * Read --name=value from argv, falling back to npm's own config env var.
 *
 * WHY THE FALLBACK: `npm run verify:live -- --origin=x` does not forward the
 * flag to argv on every npm/shell combination. On Windows npm swallows it as
 * config and exposes it as npm_config_origin instead, so argv-only parsing
 * silently fell back to production. That is the worst possible failure for
 * this script: you ask it to check a preview deployment and it cheerfully
 * tells you production is fine.
 */
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split("=").slice(1).join("=");
  return process.env[`npm_config_${name}`] || fallback;
};

const TRIES = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Strip the way a text extractor does: scripts out, tags out, whitespace collapsed. */
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fallbackBlock = (html) => {
  if (!MARKERS) {
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    return body ? body[1] : null;
  }
  const re = new RegExp(`${MARKERS.start}([\\s\\S]*?)${MARKERS.end}`);
  const m = html.match(re);
  return m ? m[1] : null;
};

async function fetchWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
      // Retry 5xx: a cold CDN edge is not evidence of a broken page.
      if (res.status >= 500 && attempt < TRIES) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(attempt * 750);
        continue;
      }
      return { res, html: await res.text(), attempts: attempt };
    } catch (err) {
      lastErr = err;
      if (attempt < TRIES) await sleep(attempt * 750);
    }
  }
  return { error: lastErr, attempts: TRIES };
}

async function main() {
  const origin = arg("origin", ORIGIN).replace(/\/$/, "");
  let sitemap;
  try {
    sitemap = await fs.readFile(path.join(DIST, "sitemap.xml"), "utf8");
  } catch {
    console.error(`[verify-live] ${DIST_DIR}/sitemap.xml not found. Run \`npm run build\` first.`);
    process.exit(1);
  }

  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(ORIGIN, origin));
  if (!urls.length) {
    console.error("[verify-live] no <loc> entries in the sitemap");
    process.exit(1);
  }

  console.log(`[verify-live] ${urls.length} urls against ${origin}, as GPTBot\n`);
  const bad = [];
  const unreachable = [];
  // Cache buster so a CDN edge cannot answer with something older than the deploy.
  const cb = Date.now();

  for (const url of urls) {
    const label = url.replace(origin, "") || "/";
    const { res, html, error, attempts } = await fetchWithRetry(`${url}?cb=${cb}`);

    if (error) {
      unreachable.push({ label, reason: error.message });
      console.log(`  ERR  ---  ${label.padEnd(52)} unreachable after ${attempts} tries: ${error.message}`);
      continue;
    }

    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim() ?? "";
    const canonical = (html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/) || [])[1] ?? "";
    // The canonical must name this page (normalize the two origins first).
    const selfCanonical = canonical.replace(origin, ORIGIN) === url.replace(origin, ORIGIN);
    // And the page must carry real crawler-visible text, not just a correct head
    // on top of an empty shell.
    const block = fallbackBlock(html);
    const chars = block ? textOf(block).length : 0;

    const why = [];
    if (!res.ok) why.push(`HTTP ${res.status}`);
    if (!selfCanonical) why.push(`canonical=${canonical || "none"}`);
    if (!block) why.push("no crawler-visible body");
    else if (chars < MIN_FALLBACK_CHARS) why.push(`only ${chars} chars of crawler content`);

    if (why.length) bad.push({ label, status: res.status, why: why.join(", ") });
    const flag = why.length ? "FAIL" : attempts > 1 ? "ok/r" : "ok  ";
    console.log(
      `  ${flag} ${res.status} ${String(html.length).padStart(7)}b ${String(chars).padStart(6)}t  ${label.padEnd(52)} ${title.slice(0, 40)}`,
    );
  }

  const good = urls.length - bad.length - unreachable.length;
  console.log(`\n[verify-live] ${good}/${urls.length} correct.`);

  if (unreachable.length) {
    console.error(`[verify-live] ${unreachable.length} url(s) unreachable (network, not necessarily the site):`);
    for (const u of unreachable) console.error(`  ${u.label}  ${u.reason}`);
  }
  if (bad.length) {
    console.error("[verify-live] wrong content:");
    for (const b of bad) console.error(`  ${b.label}  status=${b.status}  ${b.why}`);
  }
  if (bad.length || unreachable.length) process.exit(1);

  console.log(
    `[verify-live] every url serves its own content, self-referential canonical, min ${MIN_FALLBACK_CHARS} chars without JavaScript.`,
  );
}

main().catch((err) => {
  console.error("[verify-live] failed:", err);
  process.exit(1);
});

