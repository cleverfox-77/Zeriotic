function Contact(){
  return (
    <div className="contact-wrap">
      <span className="mono contact-eyebrow">( 07 ) — ready when you are</span>
      <h2 className="contact-title">
        Let's build <span className="italic">something</span><br/>
        that outlasts <span className="italic">the trend.</span>
      </h2>
      <p className="contact-sub">
        We take on new engagements each quarter. If you're shipping something ambitious, we'd love to hear the shape of it.
      </p>
      <a href="mailto:hello@zeriotic.com" className="contact-cta magnetic" data-cursor="say hi">
        <span>hello@zeriotic.com</span>
        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      </a>
      <div className="contact-grid">
        <div className="contact-cell">
          <span className="lt-label">Email</span>
          <span className="contact-val">hello@zeriotic.com</span>
        </div>
        <div className="contact-cell">
          <span className="lt-label">New work</span>
          <span className="contact-val">Available Q2 / Q3 2026</span>
        </div>
        <div className="contact-cell">
          <span className="lt-label">Response</span>
          <span className="contact-val">Within 24 hours</span>
        </div>
      </div>
    </div>
  );
}
window.Contact = Contact;
