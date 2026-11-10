import fs from 'node:fs';
import path from 'node:path';

/**
 * Zeriotic Telemetry Endpoint - Netlify Serverless Function
 *
 * POST /api/telemetry: Ingests visitor activity & telemetry beacons
 * GET  /api/telemetry: Protected admin retrieval requiring x-admin-key or ?key=
 */
const TMP_FILE = '/tmp/zr_telemetry.json';
const ADMIN_KEY = process.env.ADMIN_KEY || 'zeriotic-admin-77';

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
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...headers,
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  // 1. Ingest visitor telemetry beacon
  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      payload = {};
    }

    if (payload && payload.vid) {
      const logs = readLogs();
      const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
      logs.unshift({
        ...payload,
        ip: clientIp,
        receivedAt: new Date().toISOString(),
      });
      saveLogs(logs);
    }
    return json(200, { ok: true, stored: true });
  }

  // 2. Protected Admin Retrieval
  if (event.httpMethod === 'GET') {
    const key = event.headers['x-admin-key'] || event.headers['x-key'] || event.queryStringParameters?.key;
    if (!key || key !== ADMIN_KEY) {
      return json(401, {
        ok: false,
        error: 'Unauthorized: Valid administrator authentication key required.'
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
