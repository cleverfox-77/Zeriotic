import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
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
const TELEMETRY_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'telemetry_data.json');

function loadTelemetryFile() {
  try {
    if (fs.existsSync(TELEMETRY_FILE)) {
      return JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function saveTelemetryFile(data) {
  try {
    fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(data.slice(0, 2000)), 'utf8');
  } catch {}
}

const telemetryBuffer = loadTelemetryFile();
const MAX_TELEMETRY_LOGS = 2000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'zeriotic-admin-77';

// Rate limiter for login brute force prevention
const failedLogins = new Map();

function isIpLocked(ip) {
  const record = failedLogins.get(ip);
  if (!record) return false;
  const now = Date.now();
  if (record.lockedUntil && now < record.lockedUntil) return true;
  if (record.lockedUntil && now >= record.lockedUntil) {
    failedLogins.delete(ip);
    return false;
  }
  if (now - record.firstFail > 15 * 60 * 1000) {
    failedLogins.delete(ip);
    return false;
  }
  return false;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = failedLogins.get(ip) || { count: 0, firstFail: now, lockedUntil: null };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15 mins lock
  }
  failedLogins.set(ip, record);
  return record;
}

function safeCompare(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function makeSessionToken(secret) {
  const expiresAt = Date.now() + 8 * 3600 * 1000; // 8 hours
  const payload = `ZR_ADMIN_${expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const bufA = crypto.createHash('sha256').update(sig).digest();
  const bufB = crypto.createHash('sha256').update(expectedSig).digest();
  if (!crypto.timingSafeEqual(bufA, bufB)) return false;

  const match = payload.match(/^ZR_ADMIN_(\d+)$/);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  return Date.now() < expiresAt;
}

// 1. Auth Endpoint: POST /api/telemetry?auth=1
app.post('/api/telemetry', (req, res) => {
  const isAuthRequest = req.query.auth === '1' || req.query.action === 'auth';

  if (isAuthRequest) {
    if (isIpLocked(req.ip)) {
      return res.status(429).json({
        ok: false,
        error: 'Too many failed authentication attempts. IP locked for 15 minutes.'
      });
    }

    const candidateKey = req.body?.key || '';
    if (candidateKey && safeCompare(candidateKey, ADMIN_KEY)) {
      failedLogins.delete(req.ip);
      const token = makeSessionToken(ADMIN_KEY);
      return res.json({
        ok: true,
        authenticated: true,
        token,
        expiresIn: '8h',
        message: 'Cryptographic authentication successful.'
      });
    } else {
      const rec = recordFailedLogin(req.ip);
      const remaining = Math.max(0, 5 - rec.count);
      return res.status(401).json({
        ok: false,
        error: remaining > 0
          ? `Invalid administrative key. ${remaining} attempts remaining before 15-minute IP lockout.`
          : 'Too many failed authentication attempts. IP locked for 15 minutes.',
        remainingAttempts: remaining
      });
    }
  }

  // Regular telemetry beacon ingestion
  const data = req.body;
  if (data && data.vid) {
    telemetryBuffer.unshift({
      ...data,
      ip: req.ip,
      receivedAt: new Date().toISOString()
    });
    if (telemetryBuffer.length > MAX_TELEMETRY_LOGS) telemetryBuffer.pop();
    saveTelemetryFile(telemetryBuffer);
  }
  res.json({ ok: true, stored: true });
});

app.get('/api/telemetry', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const rawKey = req.headers['x-admin-key'] || req.headers['x-key'] || req.query.key || '';

  const isTokenValid = bearerToken && verifySessionToken(bearerToken, ADMIN_KEY);
  const isKeyValid = rawKey && safeCompare(rawKey, ADMIN_KEY);
  const isRawTokenValid = rawKey && verifySessionToken(rawKey, ADMIN_KEY);

  if (!isTokenValid && !isKeyValid && !isRawTokenValid) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: Valid cryptographic administrator token or key required.'
    });
  }

  res.json({
    ok: true,
    total: telemetryBuffer.length,
    records: telemetryBuffer,
    serverTime: new Date().toISOString()
  });
});

// ---- production: serve the built site from the same process ----
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`[zeriotic] api + site listening on :${port}`));
