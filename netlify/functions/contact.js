import nodemailer from 'nodemailer';

/**
 * Zeriotic contact endpoint — Netlify serverless function.
 *
 * Production path: the frontend POSTs to /api/contact, which netlify.toml
 * rewrites to this function. SMTP credentials come from Netlify environment
 * variables (Site settings → Environment variables) — never committed.
 *
 * (Local dev still uses server/index.js via `npm run api` + the Vite proxy.)
 */
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);

function makeTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.privateemail.com',
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,          // 465 = implicit TLS · 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// best-effort in-memory limiter (per warm instance) — the honeypot is the
// real bot defence, since serverless instances don't share memory reliably
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const window = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  window.push(now);
  hits.set(ip, window);
  return window.length > 5;
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { data = {}; }
  const { name = '', email = '', type = '', budget = '', message = '', company = '' } = data;

  // honeypot: real users never see the "company" field — bots fill it
  if (company) return json(200, { ok: true });

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
  if (limited(ip)) return json(429, { ok: false, error: 'Too many requests' });

  if (!name.trim() || !/.+@.+\..+/.test(email) || !message.trim()) {
    return json(400, { ok: false, error: 'Missing or invalid fields' });
  }

  try {
    const transporter = makeTransport();
    await transporter.sendMail({
      from: `"Zeriotic Website" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO || process.env.SMTP_USER,
      replyTo: `"${name.replace(/["\\<>]/g, '')}" <${email}>`,
      subject: `New enquiry — ${name}${type ? ` [${type}]` : ''}`.slice(0, 140),
      text: `Name: ${name}\nEmail: ${email}\nProject Type: ${type || 'Not specified'}\nBudget Band: ${budget || 'Not specified'}\n\nMessage:\n${message}`,
    });
    return json(200, { ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err.code || err.name, '-', err.message);
    return json(502, { ok: false, error: 'Mail transport failed' });
  }
};
