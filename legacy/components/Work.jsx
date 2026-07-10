// Featured work — 3 cases, full-bleed alternating
const WORK_CASES = [
  {
    tag: "AI Sales Assistant",
    client: "OctaDezx",
    title: <>The <span className="italic">24/7</span> sales brain.</>,
    lede: "An AI-powered sales assistant that handles customer inquiries and takes orders around the clock. It ingests policies, product catalogs and knowledge bases to deliver intelligent, personalized responses in multiple languages — built as a universal platform for e-commerce, SaaS, agencies and restaurants worldwide.",
    kv: [
      ["Domain", "AI / SaaS"],
      ["Stack", "Next.js · RAG · Edge"],
      ["Launch", "2025"],
      ["Region", "Worldwide"],
    ],
    stage: "octa",
  },
  {
    tag: "E-Commerce Platform",
    client: "Wholesale Products BD",
    title: <><span className="italic">Wholesale</span>, rebuilt for scale.</>,
    lede: "A wholesale e-commerce marketplace connecting suppliers with buyers — featuring real-time inventory, tiered bulk pricing, and order management that scales from small shops to nationwide distribution.",
    kv: [
      ["Domain", "B2B Commerce"],
      ["Stack", "Headless · Postgres"],
      ["Launch", "2024"],
      ["Region", "Bangladesh"],
    ],
    stage: "wholesale",
    flip: true,
  },
  {
    tag: "E-Commerce Website",
    client: "DezxLeather",
    title: <>Leather, <span className="italic">storied</span>.</>,
    lede: "A premium leather goods e-commerce store with elegant product showcases, a smooth custom checkout, and editorial brand storytelling that positions craftsmanship above price.",
    kv: [
      ["Domain", "D2C Retail"],
      ["Stack", "Astro · Stripe"],
      ["Launch", "2024"],
      ["Region", "International"],
    ],
    stage: "leather",
  },
];

function CaseOcta(){
  const [msg, setMsg] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setMsg(m => (m + 1) % 3), 2200);
    return () => clearInterval(t);
  }, []);
  const messages = [
    { u: "Do you ship to Berlin?", a: "Yes — 3-day express via DHL, €12 flat." },
    { u: "Any discount for 50+ units?", a: "20% on orders above 50 — I can draft the quote." },
    { u: "Is the leather vegan?", a: "Our Nova line uses plant-based leather. Full spec →" },
  ];
  return (
    <div className="device browser" style={{maxWidth: 580}}>
      <div className="browser-chrome">
        <div className="browser-dots"><i/><i/><i/></div>
        <div className="browser-url">octadezx.ai / assistant</div>
        <span>●&nbsp;live</span>
      </div>
      <div className="browser-body" style={{background: "var(--bg)", padding: 18, display:"grid", gridTemplateRows:"auto 1fr auto", gap: 14}}>
        <div style={{display:"flex", alignItems:"center", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--line)"}}>
          <div style={{width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", display:"grid", placeItems:"center", color:"var(--accent-ink)", fontFamily:"var(--mono)", fontSize: 11, fontWeight: 700}}>O</div>
          <div style={{display:"grid"}}>
            <span style={{fontSize: 13, fontWeight: 500}}>OctaDezx</span>
            <span style={{fontFamily:"var(--mono)", fontSize: 9, color:"var(--accent)", letterSpacing:".1em", textTransform:"uppercase"}}>online · 4 languages</span>
          </div>
        </div>
        <div style={{display:"grid", gap: 10, alignContent:"end"}}>
          {messages.slice(0, msg + 1).map((m, i) => (
            <React.Fragment key={i}>
              <div style={{justifySelf:"end", maxWidth:"70%", background: "var(--bg-3)", padding: "8px 12px", borderRadius: "10px 10px 2px 10px", fontSize: 12, color:"var(--fg)"}}>{m.u}</div>
              <div style={{justifySelf:"start", maxWidth:"70%", background: "var(--accent)", color:"var(--accent-ink)", padding: "8px 12px", borderRadius: "10px 10px 10px 2px", fontSize: 12}}>{m.a}</div>
            </React.Fragment>
          ))}
          <div style={{justifySelf:"end", color:"var(--fg-3)", fontFamily:"var(--mono)", fontSize: 9, letterSpacing:".1em"}}>typing…</div>
        </div>
        <div style={{display:"flex", gap: 8, alignItems:"center", paddingTop: 10, borderTop: "1px solid var(--line)"}}>
          <div style={{flex: 1, background:"var(--bg-3)", border:"1px solid var(--line)", borderRadius: 8, padding:"8px 12px", fontSize: 12, color:"var(--fg-3)"}}>Ask anything about our products…</div>
          <div style={{width: 32, height: 32, borderRadius: 8, background:"var(--accent)", display:"grid", placeItems:"center", color:"var(--accent-ink)"}}>↑</div>
        </div>
      </div>
    </div>
  );
}

function CaseWholesale(){
  return (
    <div className="device browser" style={{maxWidth: 620}}>
      <div className="browser-chrome">
        <div className="browser-dots"><i/><i/><i/></div>
        <div className="browser-url">wholesaleproductsbd.com / catalog</div>
      </div>
      <div className="browser-body" style={{background: "var(--bg)", padding: 18, display:"grid", gridTemplateRows: "auto 1fr", gap: 14}}>
        <div style={{display:"flex", gap: 10, fontFamily:"var(--mono)", fontSize: 9, color:"var(--fg-3)", letterSpacing:".1em", textTransform:"uppercase"}}>
          <span style={{padding:"4px 10px", border:"1px solid var(--accent)", color:"var(--accent)", borderRadius: 4}}>All 12,842</span>
          <span style={{padding:"4px 10px"}}>Electronics</span>
          <span style={{padding:"4px 10px"}}>Apparel</span>
          <span style={{padding:"4px 10px"}}>Home</span>
          <span style={{marginLeft:"auto", padding:"4px 10px", background:"var(--bg-3)", borderRadius: 4}}>MOQ 50+</span>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 10}}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{background:"var(--bg-3)", border:"1px solid var(--line)", borderRadius: 4, display:"grid", gridTemplateRows:"1fr auto"}}>
              <div style={{
                background: i%2
                  ? "repeating-linear-gradient(135deg, rgba(111,227,255,0.10) 0 4px, transparent 4px 8px), linear-gradient(180deg, var(--bg-2), var(--bg-3))"
                  : "repeating-linear-gradient(45deg, rgba(143,169,255,0.10) 0 4px, transparent 4px 8px), linear-gradient(180deg, var(--bg-3), var(--bg-2))",
                minHeight: 48,
              }}/>
              <div style={{padding:"6px 8px", display:"flex", justifyContent:"space-between", fontFamily:"var(--mono)", fontSize: 8, color:"var(--fg-2)", letterSpacing:".08em"}}>
                <span>SKU/{String(i*142).padStart(4,"0")}</span>
                <span style={{color:"var(--accent)"}}>৳{i*120}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CaseLeather(){
  return (
    <div style={{display:"flex", gap: 30, alignItems:"center"}}>
      <div className="device phone">
        <div className="phone-screen" style={{display:"grid", gridTemplateRows:"auto 1fr auto"}}>
          <div style={{padding:"40px 16px 12px", fontFamily:"var(--serif)", fontSize: 22, letterSpacing:"-.01em"}}>DezxLeather</div>
          <div style={{
            margin:"0 16px",
            borderRadius: 6,
            background:"repeating-linear-gradient(135deg, rgba(255,181,97,0.14) 0 4px, transparent 4px 8px), linear-gradient(180deg, var(--bg-3), var(--bg-2))",
            border:"1px solid var(--line)",
            display:"grid", placeItems:"end", padding: 14,
          }}>
            <div style={{color:"var(--fg)", fontFamily:"var(--serif)", fontSize: 14, lineHeight: 1.2}}>The Nova<br/>Weekender</div>
          </div>
          <div style={{padding: 16, display:"grid", gap: 10}}>
            <div style={{display:"flex", justifyContent:"space-between", fontFamily:"var(--mono)", fontSize: 9, color:"var(--fg-2)", letterSpacing:".1em", textTransform:"uppercase"}}>
              <span>Full-grain</span>
              <span style={{color:"var(--accent)"}}>$ 428</span>
            </div>
            <div style={{padding:"10px", background:"var(--accent)", color:"var(--accent-ink)", borderRadius: 6, fontFamily:"var(--mono)", fontSize: 10, letterSpacing:".1em", textTransform:"uppercase", textAlign:"center", fontWeight: 600}}>Add to bag</div>
          </div>
        </div>
      </div>
      <div style={{display:"grid", gap: 12}}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            width: 64, height: 64, borderRadius: 4, border:"1px solid var(--line-2)",
            background: i===1
              ? "repeating-linear-gradient(135deg, rgba(255,181,97,0.2) 0 4px, transparent 4px 8px), var(--bg-3)"
              : i===2
              ? "repeating-linear-gradient(45deg, rgba(111,227,255,0.2) 0 4px, transparent 4px 8px), var(--bg-3)"
              : "repeating-linear-gradient(90deg, rgba(143,169,255,0.2) 0 4px, transparent 4px 8px), var(--bg-3)",
          }}/>
        ))}
      </div>
    </div>
  );
}

function Work(){
  return (
    <>
      {WORK_CASES.map((c, i) => (
        <article key={i} className={"case" + (c.flip ? " flip" : "")}>
          <div className="case-copy">
            <div className="case-tag">
              <span className="mono">{c.tag}</span>
              <span className="mono"><b>{c.client}</b></span>
            </div>
            <h3 className="case-title">{c.title}</h3>
            <p className="case-lede">{c.lede}</p>
            <div className="case-kv">
              {c.kv.map(([k, v], j) => (
                <div key={j} className="case-kv-row">
                  <span className="lt-label">{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            <a className="case-cta magnetic" href="#" data-cursor="case study">
              <span className="mono">Read case study</span>
              <svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            </a>
          </div>
          <div className="case-stage">
            <span className="case-marker">( {String(i+1).padStart(2,"0")} / 03 )</span>
            <span className="case-marker right">{c.client}</span>
            {c.stage === "octa" && <CaseOcta/>}
            {c.stage === "wholesale" && <CaseWholesale/>}
            {c.stage === "leather" && <CaseLeather/>}
            <span className="case-marker bottom"><span className="mono">▲ live capture</span></span>
          </div>
        </article>
      ))}
    </>
  );
}

window.Work = Work;
