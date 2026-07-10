// Tech stack grid
const TECH = [
  ["Framework", "Next.js"],
  ["Framework", "Remix"],
  ["Framework", "Astro"],
  ["Runtime", "Node.js"],
  ["Runtime", "Bun"],
  ["Runtime", "Deno"],
  ["Database", "Postgres"],
  ["Database", "MongoDB"],
  ["Database", "Redis"],
  ["Infra", "Vercel"],
  ["Infra", "Cloudflare"],
  ["Infra", "AWS"],
  ["Payments", "Stripe"],
  ["Payments", "Paddle"],
  ["Auth", "Clerk"],
  ["Auth", "Auth.js"],
  ["AI", "OpenAI"],
  ["AI", "Anthropic"],
  ["Design", "Figma"],
  ["Design", "Linear"],
  ["Analytics", "PostHog"],
  ["Motion", "GSAP"],
  ["Motion", "Framer"],
  ["3D", "Three.js"],
];

function Tech(){
  return (
    <div className="tech-grid">
      {TECH.map(([kind, name], i) => (
        <div key={i} className="tech-cell" data-cursor="stack">
          <span className="lt-label">{kind}</span>
          <span className="tech-name">{name}</span>
          <span className="tech-kind">/ {String(i+1).padStart(2,"0")}</span>
        </div>
      ))}
    </div>
  );
}
window.Tech = Tech;
