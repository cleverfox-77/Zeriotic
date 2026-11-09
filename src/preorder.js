/**
 * preorder.js - the Accert One pre-order box.
 * Sends the email to the same endpoint as the contact form. It only reports
 * success once the server has actually accepted the address.
 */
export function initPreorder() {
  document.querySelectorAll('.js-preorder').forEach((form) => {
    const status = form.querySelector('.js-preorder-status');
    const btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (form.elements.email?.value || '').trim();
      if (!/.+@.+\..+/.test(email)) {
        status.textContent = 'Please enter a valid email address.';
        form.elements.email?.focus();
        return;
      }
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Sending';
      status.textContent = '';
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'accert-one-preorder',
            email,
            company: form.elements.company?.value || '',
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error('rejected');
        form.classList.add('is-done');
        btn.textContent = 'Pre-ordered';
        status.textContent = 'You are on the list. We will email you the moment it is ready.';
        form.reset();
        window.__track?.('preorder_submit');
      } catch {
        btn.disabled = false;
        btn.innerHTML = original;
        status.textContent = 'That did not go through. Please try again, or email hello@zeriotic.com.';
      }
    });
  });
}

initPreorder();
