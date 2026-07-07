const VOICES = [
  {
    quote: "Zeriotic rebuilt our commerce stack in half the time our previous agency quoted. TTFB dropped from 900ms to 40ms and conversion lifted 31% in the first quarter.",
    name: "Farah Ahmed",
    role: "Founder, Wholesale Products BD",
    initials: "FA",
  },
  {
    quote: "They engineer the way a product team engineers — not the way an agency engineers. Our AI assistant launched with real observability and an upgrade path from day one.",
    name: "Tanvir Rahman",
    role: "CEO, OctaDezx",
    initials: "TR",
  },
  {
    quote: "The team treated our brand with the reverence a luxury product deserves. Every interaction on the storefront feels considered. Sales have tripled.",
    name: "Lina Dezful",
    role: "Creative Director, DezxLeather",
    initials: "LD",
  },
];

function Voices(){
  return (
    <div className="voices-rail">
      {VOICES.map((v, i) => (
        <figure key={i} className="voice" data-cursor="testimonial">
          <div className="voice-quote-mark">“</div>
          <blockquote className="voice-quote">{v.quote}</blockquote>
          <figcaption className="voice-who">
            <div className="voice-avatar">{v.initials}</div>
            <div className="voice-meta">
              <span className="voice-name">{v.name}</span>
              <span className="voice-role">{v.role}</span>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
window.Voices = Voices;
