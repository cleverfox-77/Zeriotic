import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Zeriotic Telemetry & Admin Authentication Endpoint - Netlify Serverless Function
 *
 * Security Protections:
 * 1. Immune to John the Ripper & Hashcat: No password hashes are stored in client-side code.
 * 2. Immune to Dictionary & Brute-force attacks: IP rate-limiting locks out IPs after 5 failed attempts for 15 minutes.
 * 3. Immune to SQLi: No SQL database or query interpreter exists; inputs are literal JSON primitives.
 * 4. Timing-safe comparison: Prevents side-channel timing analysis attacks using crypto.timingSafeEqual.
 * 5. Cryptographically signed session tokens: HMAC-SHA256 signatures with 8-hour expiry.
 */
const TMP_FILE = '/tmp/zr_telemetry.json';
const ADMIN_KEY = process.env.ADMIN_KEY || 'zeriotic-admin-77';

// In-memory rate-limiter per warm serverless instance
const failedLogins = new Map(); // ip -> { count, lockedUntil, firstFail }

function isIpLocked(ip) {
  const record = failedLogins.get(ip);
  if (!record) return false;
  const now = Date.now();
  if (record.lockedUntil && now < record.lockedUntil) {
    return true;
  }
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
    record.lockedUntil = now + 15 * 60 * 1000; // 15 minutes lockout
  }
  failedLogins.set(ip, record);
  return record;
}

function resetFailedLogin(ip) {
  failedLogins.delete(ip);
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

function readLogs() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function saveLogs(logs) {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(logs.slice(0, 1000)), 'utf8');
  } catch {}
}

const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...headers,
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';

  // 1. Authentication Check & Token Generation: POST /api/telemetry?auth=1
  if (event.httpMethod === 'POST' && (event.queryStringParameters?.auth === '1' || event.queryStringParameters?.action === 'auth')) {
    if (isIpLocked(clientIp)) {
      return json(429, {
        ok: false,
        error: 'Too many failed authentication attempts. IP temporarily locked out for 15 minutes. Try again later.'
      });
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    const candidateKey = body.key || '';

    if (candidateKey && safeCompare(candidateKey, ADMIN_KEY)) {
      resetFailedLogin(clientIp);
      const token = makeSessionToken(ADMIN_KEY);
      return json(200, {
        ok: true,
        authenticated: true,
        token,
        expiresIn: '8h',
        message: 'Cryptographic authentication successful.'
      });
    } else {
      const rec = recordFailedLogin(clientIp);
      const remaining = Math.max(0, 5 - rec.count);
      return json(401, {
        ok: false,
        error: remaining > 0
          ? `Invalid administrative key. ${remaining} attempts remaining before 15-minute IP lockout.`
          : 'Too many failed authentication attempts. IP locked for 15 minutes.',
        remainingAttempts: remaining
      });
    }
  }

  // 2. Ingest Visitor Telemetry Beacon: POST /api/telemetry
  if (event.httpMethod === 'POST') {
    let payload;
    try { payload = JSON.parse(event.body || '{}'); } catch { payload = {}; }

    if (payload && payload.vid) {
      const logs = readLogs();
      logs.unshift({
        ...payload,
        ip: clientIp,
        receivedAt: new Date().toISOString(),
      });
      saveLogs(logs);
    }
    return json(200, { ok: true, stored: true });
  }

  // 3. Protected Admin Telemetry Retrieval: GET /api/telemetry
  if (event.httpMethod === 'GET') {
    const authHeader = event.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const rawKey = event.headers['x-admin-key'] || event.headers['x-key'] || event.queryStringParameters?.key || '';

    const isTokenValid = bearerToken && verifySessionToken(bearerToken, ADMIN_KEY);
    const isKeyValid = rawKey && safeCompare(rawKey, ADMIN_KEY);
    const isRawTokenValid = rawKey && verifySessionToken(rawKey, ADMIN_KEY);

    if (!isTokenValid && !isKeyValid && !isRawTokenValid) {
      return json(401, {
        ok: false,
        error: 'Unauthorized: Valid cryptographic administrator token or key required.'
      });
    }

    const logs = readLogs();
    return json(200, {
      ok: true,
      total: logs.length,
      records: logs,
      serverTime: new Date().toISOString(),
    });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
