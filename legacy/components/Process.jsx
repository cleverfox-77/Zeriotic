// Process — 4 steps
const STEPS = [
  {
    num: "Phase 01",
    title: <>Discover <span className="italic">&amp; define</span></>,
    desc: "We interrogate the problem. Stakeholder interviews, audit of existing systems, competitive mapping and a clear success metric before a single pixel is drawn.",
    dur: "1–2 wks",
  },
  {
    num: "Phase 02",
    title: <>Design <span className="italic">the system</span></>,
    desc: "Product architecture, user flows, a full design system and prototype. We pressure-test every decision against the success metric from phase one.",
    dur: "2–4 wks",
  },
  {
    num: "Phase 03",
    title: <><span className="italic">Engineer</span> &amp; ship</>,
    desc: "Senior engineers only. We build in weekly slices, against a staging environment you can click through from day one. No black-box development.",
    dur: "4–10 wks",
  },
  {
    num: "Phase 04",
    title: <>Iterate <span className="italic">in the open</span></>,
    desc: "Launch is the midpoint, not the finish line. We instrument, measure, iterate — and retain ownership-grade documentation so the product outlives the engagement.",
    dur: "Ongoing",
  },
];

function Process(){
  return (
    <div className="proc-rail">
      {STEPS.map((s, i) => (
        <div key={i} className="proc-step" data-cursor="phase">
          <span className="proc-num">{s.num}</span>
          <h3 className="proc-title">{s.title}</h3>
          <p className="proc-desc">{s.desc}</p>
          <div className="proc-dur"><span>Duration</span><b>{s.dur}</b></div>
        </div>
      ))}
    </div>
  );
}
window.Process = Process;
