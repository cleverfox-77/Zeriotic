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
 * SMTP credentials live in .env (gitignored) - see .env.example.
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

// naive per-IP limiter - enough to stop a dumb loop hammering the mailbox
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const windowHits = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  windowHits.push(now);
  hits.set(ip, windowHits);
  return windowHits.length > 5;
}

app.post('/api/contact', async (req, res) => {
  const { name = '', email = '', type = '', budget = '', message = '', company = '' } = req.body || {};

  // honeypot: real users never see the "company" field - bots fill it
  if (company) return res.json({ ok: true });

  if (limited(req.ip)) return res.status(429).json({ ok: false, error: 'Too many requests' });
  // Accert One pre-order: an email address and nothing else.
  if (req.body?.source === 'accert-one-preorder') {
    if (!/.+@.+\..+/.test(email) || email.length > 200) return res.status(400).json({ ok: false, error: 'Invalid email' });
    try {
      await transporter.sendMail({
        from: `"Zeriotic Website" <${process.env.SMTP_USER}>`,
        to: process.env.PREORDER_TO || process.env.CONTACT_TO || process.env.SMTP_USER,
        replyTo: email,
        subject: 'Accert One pre-order',
        text: `Pre-order email: ${email}`,
      });
      return res.json({ ok: true });
    } catch (err) {
      console.error('[preorder] send failed:', err.code || err.name, '-', err.message);
      return res.status(502).json({ ok: false, error: 'Mail transport failed' });
    }
  }

  if (!name.trim() || !/.+@.+\..+/.test(email) || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid fields' });
  }

  try {
    await transporter.sendMail({
      from: `"Zeriotic Website" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO || process.env.SMTP_USER,
      replyTo: `"${name.replace(/["\\<>]/g, '')}" <${email}>`,
      subject: `New enquiry - ${name}${type ? ` [${type}]` : ''}`.slice(0, 140),
      text: `Name: ${name}\nEmail: ${email}\nProject Type: ${type || 'Not specified'}\nBudget Band: ${budget || 'Not specified'}\n\nMessage:\n${message}`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err.message);
    res.status(502).json({ ok: false, error: 'Mail transport failed' });
  }
});

// Telemetry buffer & admin reporting endpoint
const telemetryBuffer = [];
const MAX_TELEMETRY_LOGS = 2000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'zeriotic-admin-77';

app.post('/api/telemetry', (req, res) => {
  const data = req.body;
  if (data && data.vid) {
    telemetryBuffer.unshift({
      ...data,
      ip: req.ip,
      receivedAt: new Date().toISOString()
    });
    if (telemetryBuffer.length > MAX_TELEMETRY_LOGS) telemetryBuffer.pop();
  }
  res.json({ ok: true, stored: true });
});

app.get('/api/telemetry', (req, res) => {
  const key = req.headers['x-admin-key'] || req.headers['x-key'] || req.query.key;
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Valid administrator authentication key required.' });
  }
  res.json({ ok: true, total: telemetryBuffer.length, records: telemetryBuffer, serverTime: new Date().toISOString() });
});

// ---- production: serve the built site from the same process ----
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`[zeriotic] api + site listening on :${port}`));
