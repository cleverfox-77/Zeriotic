import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Zeriotic contact API + production static host.
 *
 *   dev:  `npm run api`   (Vite proxies /api → :8787)
 *   prod: `npm run start` (serves dist/ AND /api on one port)
 *
 * SMTP credentials live in .env (gitignored) — see .env.example.
 */
const app = express();
app.use(express.json({ limit: '32kb' }));

const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.privateemail.com',
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,          // 465 = implicit TLS · 587 = STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// naive per-IP limiter — enough to stop a dumb loop hammering the mailbox
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const windowHits = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  windowHits.push(now);
  hits.set(ip, windowHits);
  return windowHits.length > 5;
}

app.post('/api/contact', async (req, res) => {
  const { name = '', email = '', message = '', company = '' } = req.body || {};

  // honeypot: real users never see the "company" field — bots fill it
  if (company) return res.json({ ok: true });

  if (limited(req.ip)) return res.status(429).json({ ok: false, error: 'Too many requests' });
  if (!name.trim() || !/.+@.+\..+/.test(email) || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid fields' });
  }

  try {
    await transporter.sendMail({
      from: `"Zeriotic Website" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO || process.env.SMTP_USER,
      replyTo: `"${name.replace(/["\\<>]/g, '')}" <${email}>`,
      subject: `New enquiry — ${name}`.slice(0, 140),
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err.message);
    res.status(502).json({ ok: false, error: 'Mail transport failed' });
  }
});

// ---- production: serve the built site from the same process ----
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`[zeriotic] api + site listening on :${port}`));
