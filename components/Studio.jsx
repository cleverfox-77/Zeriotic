const TEAM = [
  { name: "Zubayer Hossain", role: "Founder · Engineering", bio: "Formerly lead engineer on high-traffic commerce platforms. Specialises in performance and architecture." },
  { name: "Ahona Siddiqua", role: "Design Director", bio: "Twelve years designing interfaces for SaaS and luxury retail. Brand, systems, and typographic obsession." },
  { name: "Rayan Chowdhury", role: "Principal Engineer", bio: "Full-stack, infra-first. Loves Postgres, caches, and anything that makes a server respond faster." },
  { name: "Noor Tasnim", role: "Motion & 3D", bio: "Brings interfaces to life. WebGL, GSAP, and the discipline to know when to cut motion entirely." },
];

function Studio(){
  return (
    <div className="studio-layout">
      <div className="studio-copy">
        <span className="lt-label">The studio — since 2022</span>
        <h3 className="studio-headline">
          A small, senior team. <span className="italic">By design.</span>
        </h3>
        <p className="studio-body">
          Zeriotic is an independent studio of four. We take on a handful of engagements each year — enough to stay sharp, few enough that senior people do the actual work. No account managers, no subcontractor shuffle, no juniors learning on your budget.
        </p>
        <p className="studio-body">
          We work with founders who want a partner that treats their product like our own, and teams who want the polish of a design house with the rigour of a product engineering group.
        </p>
        <div className="studio-kv">
          <div><span className="lt-label">Founded</span><b>2022</b></div>
          <div><span className="lt-label">Team size</span><b>4</b></div>
          <div><span className="lt-label">HQ</span><b>Rajshahi, BD</b></div>
          <div><span className="lt-label">Serves</span><b>Worldwide</b></div>
        </div>
      </div>
      <div className="team-grid">
        {TEAM.map((m, i) => (
          <div key={i} className="team-member" data-cursor="team">
            <span className="team-avatar"/>
            <span className="team-role">{m.role}</span>
            <h4 className="team-name">{m.name}</h4>
            <p className="team-bio">{m.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
window.Studio = Studio;
