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
    title: "Zeriotic | Software Development Studio, Dhaka and Worldwide",
    minChars: 2000,
    schema: ["ProfessionalService", "WebSite", "WebPage", "FAQPage"],
  },
  {
    out: "work/variant3d.html",
    canonical: `${ORIGIN}/work/variant3d`,
    title: "Variant3D | Interactive knitwear showcase | Zeriotic",
    minChars: 900,
    schema: ["CreativeWork", "BreadcrumbList"],
  },
  {
    out: "work/mira.html",
    canonical: `${ORIGIN}/work/mira`,
    title: "Mira INC | Interactive product website | Zeriotic",
    minChars: 850,
    schema: ["CreativeWork", "BreadcrumbList"],
  },
  {
    out: "work/melem-tokyo.html",
    canonical: `${ORIGIN}/work/melem-tokyo`,
    title: "Melem Tokyo | Global streetwear storefront | Zeriotic",
    minChars: 850,
    schema: ["CreativeWork", "BreadcrumbList"],
  },
  {
    out: "work/octadezx.html",
    canonical: `${ORIGIN}/work/octadezx`,
    title: "OctaDezx | The AI support agent that checks its work | Zeriotic",
    minChars: 1500,
    schema: ["CreativeWork", "BreadcrumbList", "FAQPage"],
  },
  {
    out: "work/accert-one.html",
    canonical: `${ORIGIN}/work/accert-one`,
    title: "Accert One | Single-seater racing for iOS and Android | Zeriotic",
    minChars: 1000,
    schema: ["VideoGame", "CreativeWork", "BreadcrumbList", "FAQPage"],
  },
  {
    out: "work/cybersecurity-audit.html",
    canonical: `${ORIGIN}/work/cybersecurity-audit`,
    title: "Security Testing and AI Assurance | Zeriotic",
    minChars: 1300,
    schema: ["Service", "BreadcrumbList", "FAQPage"],
  },
  {
    out: "compare/zeriotic-vs-agencies.html",
    canonical: `${ORIGIN}/compare/zeriotic-vs-agencies`,
    title: "Zeriotic vs a typical agency: what's actually different | Zeriotic",
    minChars: 2600,
    schema: ["WebPage", "BreadcrumbList", "FAQPage"],
  },
  {
    out: "blog/php-vulnerability-login-without-password.html",
    canonical: `${ORIGIN}/blog/php-vulnerability-login-without-password`,
    title: "PHP Authentication Bypass: How Hackers Login Without Passwords | Zeriotic",
    minChars: 6000,
    schema: ["BlogPosting", "TechArticle", "BreadcrumbList"],
  },
  {
    out: "blog/how-uncensored-ai-agents-increase-hacking.html",
    canonical: `${ORIGIN}/blog/how-uncensored-ai-agents-increase-hacking`,
    title: "How Uncensored AI Agents Are Accelerating Cyberattacks | Zeriotic",
    minChars: 5500,
    schema: ["BlogPosting", "TechArticle", "BreadcrumbList"],
  },
  {
    out: "privacy/index.html",
    altFile: "privacy.html",
    canonical: `${ORIGIN}/privacy/`,
    title: "Privacy Policy | Zeriotic Studio",
    minChars: 1500,
    schema: [],
  },
];

/** The sitemap lists indexable pages only (the privacy page is crawlable but thin). */
export const SITEMAP_PAGES = PAGES.filter((p) => !p.out.startsWith("privacy"));
