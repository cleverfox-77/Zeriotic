// Mount all React bits into their slots
function mount(id, Comp){
  const el = document.getElementById(id);
  if (!el || !Comp) return;
  ReactDOM.createRoot(el).render(<Comp/>);
}

mount("work-slots", window.Work);
mount("tech-slot",  window.Tech);
mount("process-slot", window.Process);
mount("voices-slot", window.Voices);
mount("studio-slot", window.Studio);
mount("contact-slot", window.Contact);
mount("footer-slot", window.Footer);
