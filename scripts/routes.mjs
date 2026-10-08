/**
 * Single source of truth for the public routes of zeriotic.com.
 *
 * geo.mjs (sitemap generation), verify-seo.mjs (post-build gate) and
 * verify-live.mjs (live audit) all read this list, so they cannot disagree
 * about what should exist. A hand-maintained list in three places is the
 * exact failure mode this file exists to prevent.
 */
export const ORIGIN = "https://zeriotic.com";

/**
 * out       dist-relative file path ("index.html" = homepage)
 * canonical URL the page must claim (self-referential)
 * title     exact expected <title> (catches a page cloned but never rewritten)
 * minChars  floor for crawler-visible text (strip scripts AND styles)
 * schema    @type values that must be present in the page's JSON-LD
 */
export const PAGES = [
  {
    out: "index.html",
    canonical: `${ORIGIN}/`,
    title: "Zeriotic — Premium Web Development Studio",
    minChars: 2000,
    schema: ["ProfessionalService", "WebSite", "WebPage", "FAQPage"],
  },
  {
    out: "work/variant3d.html",
    canonical: `${ORIGIN}/work/variant3d`,
    title: "Variant3D - Knitwear, rendered thread by thread | Zeriotic",
    minChars: 500,
    schema: ["CreativeWork", "BreadcrumbList"],
  },
  {
    out: "work/mira.html",
    canonical: `${ORIGIN}/work/mira`,
    title: "Mira INC - A product site that computes itself | Zeriotic",
    minChars: 500,
    schema: ["CreativeWork", "BreadcrumbList"],
  },
  {
    out: "work/melem-tokyo.html",
    canonical: `${ORIGIN}/work/melem-tokyo`,
    title: "Melem Tokyo - Tokyo precision, shipped worldwide | Zeriotic",
    minChars: 500,
    schema: ["CreativeWork", "BreadcrumbList"],
  },
  {
    out: "work/octadezx.html",
    canonical: `${ORIGIN}/work/octadezx`,
    title: "OctaDezx - The 24/7 sales brain | Zeriotic",
    minChars: 500,
    schema: ["CreativeWork", "BreadcrumbList"],
  },
  {
    out: "work/accert-one.html",
    canonical: `${ORIGIN}/work/accert-one`,
    title: "Accert One - Next-Gen Motorsport Simulator | Zeriotic",
    minChars: 600,
    schema: ["VideoGame", "CreativeWork", "BreadcrumbList"],
  },
  {
    out: "work/how-zeriotic-renders.html",
    canonical: `${ORIGIN}/work/how-zeriotic-renders`,
    title: "How zeriotic.com Renders - A Technical Case Study | Zeriotic",
    minChars: 700,
    schema: ["TechArticle", "BreadcrumbList"],
  },
  {
    out: "compare/zeriotic-vs-agencies.html",
    canonical: `${ORIGIN}/compare/zeriotic-vs-agencies`,
    title: "Zeriotic vs a typical agency - what's actually different | Zeriotic",
    minChars: 1200,
    schema: ["WebPage", "BreadcrumbList", "FAQPage"],
  },
  {
    out: "privacy/index.html",
    altFile: "privacy.html",
    canonical: `${ORIGIN}/privacy/`,
    title: "Privacy Policy | Zeriotic Studio",
    minChars: 200,
    schema: [],
  },
];

/** The sitemap lists indexable pages only (the privacy page is crawlable but thin). */
export const SITEMAP_PAGES = PAGES.filter((p) => !p.out.startsWith("privacy"));
