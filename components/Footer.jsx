function Footer(){
  return (
    <div className="footer-wrap">
      <div className="footer-grid">
        <div className="footer-col">
          <h4>Studio</h4>
          <p>Zeriotic is a premium web development studio building high-performance applications, e-commerce platforms and SaaS products for a handful of clients each year.</p>
        </div>
        <div className="footer-col">
          <h4>Services</h4>
          <a href="#services" data-cursor="→">Web applications</a>
          <a href="#services" data-cursor="→">E-commerce</a>
          <a href="#services" data-cursor="→">SaaS products</a>
          <a href="#services" data-cursor="→">Design systems</a>
        </div>
        <div className="footer-col">
          <h4>Studio</h4>
          <a href="#work" data-cursor="→">Work</a>
          <a href="#process" data-cursor="→">Process</a>
          <a href="#studio" data-cursor="→">About</a>
          <a href="#contact" data-cursor="→">Contact</a>
        </div>
        <div className="footer-col">
          <h4>Elsewhere</h4>
          <a href="#" data-cursor="↗">LinkedIn</a>
          <a href="#" data-cursor="↗">GitHub</a>
          <a href="#" data-cursor="↗">Dribbble</a>
          <a href="#" data-cursor="↗">Are.na</a>
        </div>
      </div>
      <div className="footer-big" aria-hidden="true">
        Zeri<span className="italic">otic</span>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Zeriotic Studio</span>
        <span>Rajshahi — 24.36°N / 88.61°E</span>
        <span>Crafted in-house</span>
      </div>
    </div>
  );
}
window.Footer = Footer;
