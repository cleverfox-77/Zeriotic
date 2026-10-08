# Zeriotic Website — Improvement Plan

*Based on a full audit of `D:\Zeriotic\Zeriotic` (v2.x — Three.js/Vite/GSAP/Lenis single-page experience + Node/Netlify contact API).*

---

## 0. Verdict

The 3D engineering is genuinely best-in-class for an independent studio site:

- **On-demand rendering** — the composer only draws when something changed; the GPU idles while visitors read solid sections (`Experience.js`)
- **Real closed-loop dynamic resolution** driven by `EXT_disjoint_timer_query_webgl2` GPU timings, with an rAF-median fallback for Safari/Firefox
- **SMAA-for-stills / FXAA-for-motion swap**, half-res bloom, one merged final pass (CA + grain + vignette)
- **A single-draw-call particle field** (30k–120k points by GPU tier) whose vertex shader morphs between seven sculpted targets, with per-particle stagger, drift, and pointer repulsion
- Deep-link/mid-load state recovery via `onRefresh` mirroring, transparent-at-creation materials to avoid program-cache traps, honeypot + rate-limited mail API

**So the problem is not craft. The problem is that the site wins the portfolio review and loses the procurement decision.** It proves *taste* but not *outcomes*, barely *converts*, and *cannot be found*. Every recommendation below serves one of those three gaps — without touching the mono/ember identity or downgrading the 3D bar.

---

## 1. Pillar One — PROOF: turn the work section from illustration into evidence

### What's actually there today
All four case studies (Variant3D, Mira INC, Melem Tokyo, OctaDezx) are presented as **CSS-built device mockups** — browser windows and phone frames made of divs, gradients and scripted fake chat logs. Nowhere on the page can a visitor **click through to a single shipped product**. Not the case titles, not the testimonial companies, nothing. Outcome claims exist only buried inside quotes ("time-on-page more than doubled"). For a studio charging premium rates, the strongest commercial section is the weakest evidence.

### Do this
1. **Replace or augment each mockup with real captures** — short WebM/MP4 loops or scroll-scrubbed image sequences of the actual shipped products, framed inside the existing device chrome (keep the chrome, change the pixels). The Atropos tilt layer already exists and works on real media.
2. **Add an outcomes row to every case**: one hard metric with baseline → result → timeframe (e.g. `Demo requests: 1.0× → 2.3× in 90 days`). Move the buried claims out of testimonials into structured data.
3. **Link everything out.** Case titles, "Visit live site →", testimonial company names — all to the real URLs, `rel="noopener"`, tracked as outbound events (see Pillar 5). A studio whose work can't be inspected is a studio assumed to be exaggerating.
4. **Client logo strip** near the stats band (stats themselves: see §6 — several are unverifiable as displayed).
5. **Build `/work/[slug]` case-study pages** (600–900 words each): problem → approach → 2–3 concrete architecture decisions → measured outcome → stack → pull-quote. These double as sales artifacts you can send in threads and as the SEO/AI-search surface the homepage can never provide alone.
6. **Publish the meta case study: this website itself.** "How zeriotic.com renders" — on-demand render policy, timer-query DRS, morph pipeline, why SMAA swaps to FXAA mid-scroll. It is the single most credible artifact you own, and it costs only writing time. Studios like Lusion and Active Theory win enterprise clients precisely this way.

---

## 2. Pillar Two — THE 3D STORY: spend the spectacle where the money is

### What's actually there today
The particle field performs beautifully through Hero → Manifesto → Services (knot → lattice → wave), but in **#work — the longest, most commercial stretch of the page — it dims to 0.25 and sits on a generic crystal**. The biggest scroll real estate gets the least 3D attention. Meanwhile the contact section already lands the perfect closing beat (field re-converges into the chrome Z).

### Do this
1. **Give each case study its own particle target.** The infrastructure already exists — `World._targets` + `MeshSurfaceSampler` + `setState()` + `PALETTES` ride-along. Sample new targets from artifacts that belong to each client and retarget on case-in-view:
   - Variant3D → a **torus of stitch loops** (knitwear, literally thread-by-thread)
   - Mira → a **console waveform / signal grid**
   - Melem → the existing **ribbon** (editorial drape)
   - OctaDezx → the existing **lattice** (the "sales brain")
   Each with its own ember-family palette temperature. Only new Float32Array targets + ScrollTriggers are needed — zero new draw calls, zero shader changes. This converts the work section into **four consecutive signature moments** and makes the 3D argue for the studio's services instead of decorating them.
2. **Contact-section pointer attraction.** Invert the existing `uMouse` repulsion into gentle attraction while `#contact` is live, so the Z assembles *around the visitor's cursor trail*. Small shader conditional, memorable payoff at the exact moment of decision.
3. **Honor `prefers-reduced-motion` in JavaScript, not just CSS.** Today only four CSS keyframes stop; the WebGL choreography (camera sweeps, orbit, morphs, Lenis smoothing) ignores the setting entirely. Contract: static composed frame (or the poster), no scrub choreography, instant anchor jumps, caption cross-fades without motion. Vestibular accessibility is table stakes for award-tier sites — and juries check.
4. **Handle `webglcontextlost` / `webglcontextrestored`.** `Renderer.js` registers no listener; a driver reset (common on Windows Chrome) currently leaves a frozen black void behind the DOM with a dead preloader state. On loss: dissolve to the poster fallback + show content. On restore: rebuild and resume. This is a 20-line fix for the worst possible failure mode the site has.
5. **Preloader hard timeout.** If the GLBs stall on a slow connection, "COMPILING THE EXPERIENCE · 47%" sits there forever. Add a 10–12s ceiling that dissolves into the working DOM regardless.
6. **Crispness on high tier.** `Quality.maxPixelRatio` is `tier === 'low' ? 1 : 1.0` — a dead ternary pinning even desktops to 1× DPR, so the iridescent chrome Z renders soft on retina panels. Because of the on-demand policy, still frames are cheap: allow **1.5× DPR for stills on the high tier**, keep the DRS scaler governing live sections exactly as-is.
7. **Gate SplitType on `document.fonts.ready`.** Character/word splitting currently races JetBrains Mono's swap; late font arrival skews measurements and reveals can end micro-offset. One `await` fixes a whole class of glitch reports.
8. **Mobile viewport units.** Panels use `min-height: 100vh`; iOS toolbar collapse resizes the viewport mid-scroll and forces ScrollTrigger refresh jumps through the pinned 340vh services track. Switch panels/tracks to `svh` (with a `vh` fallback line above).
9. **Pause the OctaDezx chat loop when invisible.** Its `setInterval` re-renders innerHTML every 2.6s forever — even on other tabs and while the user reads other sections. Gate it on IntersectionObserver + `visibilitychange`.

---

## 3. Pillar Three — CONVERSION: qualify instead of collect

### What's actually there today
A three-field form (name/email/message), honeypot, rate limit, SMTP delivery, graceful failure copy. Solid plumbing — but zero **qualification** (budget, timeline, project type), no scheduling path, and the availability promise ("Available Q2 / Q3 2026") is hardcoded in two places of copy.

### Do this
1. **Two qualifying fields, both skippable:** project-type chips (Web app / Commerce / SaaS / AI / Something else) and a budget band select. Premium studios lose weeks per quarter to threads that were never viable; filtering is a kindness to both sides.
2. **Calendar handoff on success:** replace the static "Sent ✓" state with success + "Grab 30 minutes →" (Cal.com/Calendly). The reply-within-24h promise then becomes a same-day booked call.
3. **Dynamic availability as a single source of truth:** one JSON constant (or `/api/availability`) feeding the hero eyebrow, the contact cells, and JSON-LD. Update once per quarter, never touch copy again. Scarcity signals only work if they're visibly current.
4. **Form polish:** inline field-level errors (not one status line), `aria-live` already present via `role="status"` — keep it, preserve the message text on failed send, render the mailto fallback as an actual button on failure. **Bump input font-size to ≥16px on touch devices** — at `0.8rem` (12.8px), iOS Safari auto-zooms the viewport on focus, which reads as breakage inside a Lenis-smoothed page.
5. **FAQ block before contact** (engagement shapes, typical timelines, IP/handover, who does the work): answers the exact questions procurement asks, and feeds `FAQPage` schema.
6. **Proof hygiene:** fix the `Mira INC` / `Mira Inc` capitalization split between case tag and testimonial; link team members to LinkedIn/GitHub; either populate or drop the Facebook/Instagram placeholders.

---

## 4. Pillar Four — FINDABILITY: one page cannot carry a studio

### What's actually there today
One HTML file targeting one keyword cluster. No `sitemap.xml`, no `robots.txt`, no `llms.txt`. `ProfessionalService` JSON-LD exists (good) but has no `sameAs`, no service entities, no per-case markup. Social links point at Facebook/Instagram while a dev studio's GitHub is nowhere.

### Do this
1. **Ship the subpage layer:** `/services/web-applications`, `/services/ecommerce`, `/services/saas` + the four `/work/[slug]` pages + a `/writing` hub seeded with the self-case-study. Each with its own title/description/canonical and `Service` / `Article` / `CaseStudy`-style schema. Interlink: cases ↔ services ↔ process.
2. **Technical hygiene batch:** `sitemap.xml`, `robots.txt` pointing at it, `llms.txt` (a tight studio summary + facts — increasingly how AI answer engines pick who to cite), recompress `og-image.png` (551 KB → under 200 KB), add `apple-touch-icon` + `site.webmanifest`.
3. **Netlify `[headers]` block:** CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. A studio selling "production-grade engineering" should demonstrably run production-grade headers.
4. **GitHub presence strategy:** for this positioning, an empty GitHub is worse than none. Pin 2–3 polished repos — ideally including the site itself, open-sourced. That single move feeds Pillar One (proof), Pillar Four (links, sameAs), and recruiting simultaneously.

---

## 5. Pillar Five — MEASUREMENT: instrument before opining

There is **no analytics of any kind** on the site today. Everything above is currently flying blind.

1. **Cookieless analytics** (Plausible or Umami) — preserves the brutalist purity, no consent banner required.
2. **Event set (small and deliberate):**
   - `section_view` per `data-screen-label` (they already exist as hooks)
   - `services_beat` 01/02/03 — measures whether the 340vh pinned scrub is read or fled
   - `case_view`, `outbound_case_click`
   - `form_start`, `form_submit_success`, `form_submit_failure`, `cal_open`
   - scroll depth per panel
3. **RUM for Core Web Vitals + error tracking** (Sentry or similar), capturing `webglcontextlost` frequency — which also tells you how much the Pillar-Two fix matters in the wild.
4. **Define the funnel now:** visit → hero read → work reached → case clicked → contact started → sent. Review monthly; promote or cut sections on evidence. If `services_beat` completion is low, compress the 340vh track toward ~220vh rather than debating taste.

---

## 6. Honesty pass on the numbers

`47 products shipped · 98% retention · 12 ms median TTFB · 4.9 rating` — displayed as fact, sourced nowhere, and a "rating" with no platform citation reads as invented. Options, best first: (a) replace with per-case verified outcomes (Pillar One), (b) keep but footnote the basis ("across 2022–2025 engagements"), (c) cite the actual review platform for the rating. Unverifiable big numbers quietly tax the credibility of the verifiable ones.

---

## 7. Sequencing

| Phase | Scope | Effort | Payoff |
|---|---|---|---|
| **0 — Weekend hardening** | contextlost handler, preloader timeout, svh units, fonts.ready gate, chat pause, 16px inputs, focus-visible styles, og-image compression, icons/manifest, Mira naming | ~1 day | Kills every silent failure mode |
| **1 — Proof** | Real captures, outcome rows, outbound links, logo strip | 1–2 wks | The credibility unlock |
| **2 — Signature** | Per-case particle targets + palettes, contact pointer attraction, reduced-motion JS contract | ~1 wk | The thing people screenshot |
| **3 — Conversion** | Qualified form, calendar handoff, dynamic availability, FAQ | 2–4 days | Shorter, better sales cycles |
| **4 — Surface** | Case + service pages, writing hub, sitemap/robots/llms.txt, headers, GitHub | 1–2 wks | Compounding inbound |
| **5 — Loop** | Analytics events, RUM, monthly funnel review | ongoing | Evidence drives v3 |

Phases 0–3 don't wait on each other's design decisions; 4 benefits from 1's assets being final.

---

## 8. Anti-plan — what NOT to do

- **Don't lengthen the homepage.** It's already dense; depth belongs in subpages, not more sections.
- **Don't retheme.** Mono + ember + void is coherent and ownable; resist the second accent color.
- **Don't rebuild in React/Next.** Vanilla + Vite is correct for this architecture; new pages ship as static routes, not a framework migration.
- **Don't add a consent-banner tracking stack.** Cookieless or nothing.
- **Don't chase more 3D features over 3D relevance.** The engine outruns the story right now — point the existing engine at the work (Pillar Two) before adding tech.
- **Don't let the mockups survive Phase 1.** A CSS phone pretending to be Melem Tokyo is the single biggest credibility leak on the page.
