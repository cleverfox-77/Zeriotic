/**
 * Zeriotic Extreme Visitor Activity Tracker & Cookie Consent Suite
 *
 * Implements:
 * 1. GDPR/ePrivacy compliant brutalist Cookie Consent Banner:
 *    - "Accept all cookies" -> Activates extreme visitor telemetry & cookies.
 *    - "Accept necessary cookies only" -> Strictly necessary preference cookie only; zero tracking.
 *    - Granular preferences drawer (Necessary, Analytics & Telemetry, Attribution).
 *    - Reopenable at any time via .js-cookie-settings in footer or window.ZerioticTracker.openPreferences().
 * 2. Extreme Visitor Activity Tracking Engine (when consent granted):
 *    - Persistent visitor UUID (_zr_vid, 365d).
 *    - Rolling session UUID (_zr_sid, 30m rolling activity refresh).
 *    - Visit count (_zr_visit_count) & first/last seen timestamps (_zr_first_seen, _zr_last_seen).
 *    - Ingress attribution (_zr_ref, _zr_landing, _zr_utm: source, medium, campaign, gclid, fbclid).
 *    - Scroll depth telemetry milestones: 25%, 50%, 75%, 90%, 100% (_zr_depth).
 *    - Section visibility & dwell time telemetry (IntersectionObserver on major chapters).
 *    - Interaction & click telemetry (CTAs, outbound links, audio toggle, email mailto, FAQs).
 *    - Form engagement & completion telemetry (#enquiry & Accert One pre-order).
 *    - Device & environment telemetry (resolution, viewport, DPR, timezone, network, hardware concurrency).
 *    - Rolling action stream (_zr_act).
 *    - Inspectable developer console API: window.ZerioticTracker.
 */

// --- Cookie Primitives ---
const COOKIE_PREFIX = '_zr_';
const CONSENT_COOKIE = 'zr_consent';
const CONSENT_PREFS_COOKIE = 'zr_prefs';

function setCookie(name, value, days, sameSite = 'Lax') {
  try {
    let expires = '';
    if (typeof days === 'number') {
      const d = new Date();
      d.setTime(d.getTime() + days * 86400000);
      expires = `; expires=${d.toUTCString()}; max-age=${Math.round(days * 86400)}`;
    }
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expires}; path=/; SameSite=${sameSite}${secure}`;
  } catch (e) {
    /* ignore cookie write errors */
  }
}

function getCookie(name) {
  try {
    const prefix = `${encodeURIComponent(name)}=`;
    const parts = document.cookie.split(';');
    for (let i = 0; i < parts.length; i++) {
      let c = parts[i].trim();
      if (c.indexOf(prefix) === 0) {
        return decodeURIComponent(c.substring(prefix.length));
      }
    }
  } catch (e) {
    /* ignore cookie read errors */
  }
  return null;
}

function deleteCookie(name) {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/; SameSite=Lax${secure}`;
  } catch (e) {
    /* ignore */
  }
}

function generateId(prefix = 'zr') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

// --- Safe Storage Helper (Guarded for SSR / Sandboxes / Incognito) ---
const safeStorage = {
  getItem(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return null;
  },
  setItem(key, val) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
      }
    } catch {}
  },
  removeItem(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {}
  }
};

// --- Tracking State & Storage ---
let trackingInitialized = false;
let scrollMilestonesReached = new Set();
let sectionObserver = null;
let activeSections = new Map(); // sectionId -> enterTimestamp
let activityStream = [];
const MAX_STREAM_EVENTS = 15;

function getConsentState() {
  const cookieVal = getCookie(CONSENT_COOKIE);
  if (cookieVal) return cookieVal;
  return safeStorage.getItem(CONSENT_COOKIE);
}

function getConsentPrefs() {
  try {
    const raw = getCookie(CONSENT_PREFS_COOKIE) || safeStorage.getItem(CONSENT_PREFS_COOKIE);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fallback */
  }
  const state = getConsentState();
  if (state === 'all') {
    return { necessary: true, analytics: true, attribution: true, telemetry: true };
  }
  return { necessary: true, analytics: false, attribution: false, telemetry: false };
}

function saveConsent(state, prefs) {
  const normalizedPrefs = prefs || (state === 'all'
    ? { necessary: true, analytics: true, attribution: true, telemetry: true }
    : { necessary: true, analytics: false, attribution: false, telemetry: false });

  // Store consent cookie (1 year lifespan)
  setCookie(CONSENT_COOKIE, state, 365);
  setCookie(CONSENT_PREFS_COOKIE, JSON.stringify(normalizedPrefs), 365);
  safeStorage.setItem(CONSENT_COOKIE, state);
  safeStorage.setItem(CONSENT_PREFS_COOKIE, JSON.stringify(normalizedPrefs));

  if (state === 'all' || normalizedPrefs.analytics) {
    initExtremeTracking();
  } else {
    purgeTrackingData();
  }
}

function purgeTrackingData() {
  // Purge all tracking cookies
  const cookiesToPurge = [
    '_zr_vid',
    '_zr_sid',
    '_zr_first_seen',
    '_zr_last_seen',
    '_zr_visit_count',
    '_zr_ref',
    '_zr_landing',
    '_zr_utm',
    '_zr_depth',
    '_zr_act'
  ];
  cookiesToPurge.forEach(deleteCookie);

  // Clear local/session storage mirrors
  cookiesToPurge.forEach((k) => {
    safeStorage.removeItem(k);
  });

  // Disconnect observers
  if (sectionObserver) {
    sectionObserver.disconnect();
    sectionObserver = null;
  }
  activeSections.clear();
  scrollMilestonesReached.clear();
  activityStream = [];
  trackingInitialized = false;
}

// --- Activity Event Logging ---
function logAction(type, label, extra = null) {
  const prefs = getConsentPrefs();
  if (!prefs.analytics) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const evt = [timeStr, type, label];
  if (extra !== null && extra !== undefined) evt.push(extra);

  activityStream.push(evt);
  if (activityStream.length > MAX_STREAM_EVENTS) {
    activityStream.shift();
  }

  // Persist compact event stream to cookie (30m session) and safeStorage
  try {
    const serialized = JSON.stringify(activityStream);
    setCookie('_zr_act', serialized, 1 / 48); // 30 minutes
    safeStorage.setItem('_zr_act', serialized);
  } catch {
    /* ignore */
  }

  // Dispatch live telemetry beacon to server
  dispatchBeacon(evt);

  // Refresh session sliding window on user activity
  refreshSession();
}

function dispatchBeacon(evt) {
  try {
    const payload = JSON.stringify({
      vid: getCookie('_zr_vid'),
      sid: getCookie('_zr_sid'),
      landing: getCookie('_zr_landing'),
      ref: getCookie('_zr_ref'),
      depth: getCookie('_zr_depth') || '0%',
      event: evt,
      telemetry: gatherTelemetry(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString()
    });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/telemetry', payload);
    } else if (typeof fetch !== 'undefined') {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }
  } catch {}
}

function refreshSession() {
  const sid = getCookie('_zr_sid');
  if (sid) {
    setCookie('_zr_sid', sid, 1 / 48); // 30 minutes
    const nowIso = new Date().toISOString();
    setCookie('_zr_last_seen', nowIso, 365);
  }
}

// --- Telemetry Gatherer ---
function gatherTelemetry() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const scr = typeof screen !== 'undefined' ? screen : {};
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};

  return {
    screen: `${scr.width || 0}x${scr.height || 0}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pixelRatio: window.devicePixelRatio || 1,
    colorDepth: scr.colorDepth || 24,
    timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || 'unknown',
    language: nav.language || 'unknown',
    cores: nav.hardwareConcurrency || null,
    memoryGb: nav.deviceMemory || null,
    networkType: conn.effectiveType || conn.type || 'unknown',
    downlinkMbps: conn.downlink || null,
    rttMs: conn.rtt || null,
    touch: 'ontouchstart' in window || (nav.maxTouchPoints || 0) > 0,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false,
    userAgent: nav.userAgent || 'unknown',
  };
}

// --- Extreme Tracking Initialization ---
function initExtremeTracking() {
  if (trackingInitialized) return;
  const prefs = getConsentPrefs();
  if (!prefs.analytics && !prefs.attribution) return;

  trackingInitialized = true;
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Persistent Visitor ID (_zr_vid, 365 days)
  let vid = getCookie('_zr_vid') || safeStorage.getItem('_zr_vid');
  let isNewVisitor = false;
  if (!vid) {
    vid = generateId('zr_vid');
    isNewVisitor = true;
    setCookie('_zr_vid', vid, 365);
    setCookie('_zr_first_seen', nowIso, 365);
    safeStorage.setItem('_zr_vid', vid);
    safeStorage.setItem('_zr_first_seen', nowIso);
  } else {
    setCookie('_zr_vid', vid, 365);
  }
  setCookie('_zr_last_seen', nowIso, 365);

  // 2. Session ID & Visit Counter (_zr_sid, 30m rolling)
  let sid = getCookie('_zr_sid');
  let visitCount = parseInt(getCookie('_zr_visit_count') || safeStorage.getItem('_zr_visit_count') || '0', 10);
  if (!sid) {
    sid = generateId('zr_sid');
    visitCount += 1;
    setCookie('_zr_sid', sid, 1 / 48); // 30 minutes
    setCookie('_zr_visit_count', String(visitCount), 365);
    safeStorage.setItem('_zr_visit_count', String(visitCount));
  } else {
    setCookie('_zr_sid', sid, 1 / 48);
  }

  // 3. Attribution: Referrer, Landing Page, and UTMs (if attribution enabled)
  if (prefs.attribution) {
    if (!getCookie('_zr_landing')) {
      const landing = window.location.pathname + window.location.search;
      setCookie('_zr_landing', landing, 180);
      safeStorage.setItem('_zr_landing', landing);
    }

    if (!getCookie('_zr_ref')) {
      let ref = document.referrer ? new URL(document.referrer, window.location.href).hostname : 'direct';
      if (ref === window.location.hostname) ref = 'internal';
      setCookie('_zr_ref', ref, 180);
      safeStorage.setItem('_zr_ref', ref);
    }

    // Capture UTM & Ad click IDs
    const searchParams = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid', 'ttclid'];
    const capturedUtm = {};
    utmKeys.forEach((key) => {
      const val = searchParams.get(key);
      if (val) capturedUtm[key] = val;
    });
    if (Object.keys(capturedUtm).length > 0) {
      const utmStr = JSON.stringify(capturedUtm);
      setCookie('_zr_utm', utmStr, 180);
      safeStorage.setItem('_zr_utm', utmStr);
    }
  }

  // Initial pageview log
  logAction('pageview', window.location.pathname, {
    referrer: getCookie('_zr_ref') || 'direct',
    isNew: isNewVisitor,
    visitNum: visitCount
  });

  // 4. Setup Scroll Depth Telemetry (25%, 50%, 75%, 90%, 100%)
  setupScrollTracking();

  // 5. Setup Section Dwell Time Observer
  setupSectionDwellTracking();

  // 6. Setup Click & Interaction Telemetry
  setupInteractionTracking();

  // 7. Setup Form Telemetry
  setupFormTracking();
}

function setupScrollTracking() {
  let ticking = false;
  const milestones = [25, 50, 75, 90, 100];

  const checkScroll = () => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    const scrollPct = Math.round((window.scrollY / docHeight) * 100);

    milestones.forEach((m) => {
      if (scrollPct >= m && !scrollMilestonesReached.has(m)) {
        scrollMilestonesReached.add(m);
        setCookie('_zr_depth', `${m}%`, 1 / 48);
        logAction('scroll', `${m}%`, { maxDepth: m });
      }
    });
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(checkScroll);
      ticking = true;
    }
  }, { passive: true });
}

function setupSectionDwellTracking() {
  if (typeof IntersectionObserver === 'undefined') return;

  const sectionSelectors = [
    '#hero',
    '#manifesto',
    '#octadezx',
    '#accert-one',
    '#security',
    '#work',
    '#studio',
    '#process',
    '#contact',
    '#faq',
    '.case-hero',
    '.case-section',
    '.cta',
    '.page-hero',
    '.page-content',
    'article'
  ];

  const targets = document.querySelectorAll(sectionSelectors.join(','));
  if (targets.length === 0) return;

  sectionObserver = new IntersectionObserver((entries) => {
    const now = Date.now();
    entries.forEach((entry) => {
      const id = entry.target.id || entry.target.className.split(' ')[0] || 'section';
      if (entry.isIntersecting) {
        if (!activeSections.has(id)) {
          activeSections.set(id, now);
        }
      } else {
        if (activeSections.has(id)) {
          const enterTime = activeSections.get(id);
          activeSections.delete(id);
          const dwellSec = Math.round((now - enterTime) / 1000);
          if (dwellSec >= 2) {
            logAction('dwell', id, { seconds: dwellSec });
          }
        }
      }
    });
  }, { threshold: 0.35 });

  targets.forEach((el) => sectionObserver.observe(el));
}

function setupInteractionTracking() {
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;

    // CTA button clicks
    const btn = target.closest('.btn, button.btn, a.btn, .footer__cta a');
    if (btn) {
      const text = btn.innerText?.trim().replace(/\s+/g, ' ') || 'Button';
      const href = btn.getAttribute('href') || 'action';
      logAction('click:cta', text, { href });
      return;
    }

    // Audio toggle
    const muteBtn = target.closest('.js-mute-btn');
    if (muteBtn) {
      logAction('click:sound_toggle', 'Mute/Unmute audio');
      return;
    }

    // Outbound link clicks
    const anchor = target.closest('a[href]');
    if (anchor) {
      const href = anchor.getAttribute('href') || '';
      if (href.startsWith('mailto:')) {
        logAction('click:mailto', href.replace('mailto:', ''));
      } else if (href.startsWith('http')) {
        try {
          const u = new URL(href, window.location.href);
          if (u.origin !== window.location.origin) {
            logAction('click:outbound', u.hostname, { url: href });
          }
        } catch {}
      } else if (href.startsWith('#faq') || anchor.closest('.faq-item')) {
        const item = anchor.closest('.faq-item');
        const q = item?.querySelector('h4')?.innerText?.trim() || 'FAQ';
        logAction('click:faq', q);
      }
    }
  }, { passive: true });
}

function setupFormTracking() {
  // Enquiry form tracking
  const enquiryForm = document.getElementById('enquiry');
  if (enquiryForm) {
    let formStarted = false;
    enquiryForm.addEventListener('focusin', (e) => {
      const field = e.target?.name || e.target?.id || 'field';
      if (!formStarted) {
        formStarted = true;
        logAction('form:start', 'enquiry', { firstField: field });
      } else {
        logAction('form:focus', field);
      }
    }, { passive: true });
  }

  // Accert pre-order form tracking
  const preorderForm = document.querySelector ? document.querySelector('.preorder') : null;
  if (preorderForm) {
    preorderForm.addEventListener('focusin', () => {
      logAction('form:focus', 'accert_preorder');
    }, { once: true, passive: true });
  }
}

// --- Cookie Consent Banner UI ---
function injectBannerStyles() {
  if (document.getElementById('zr-cookie-styles')) return;

  const style = document.createElement('style');
  style.id = 'zr-cookie-styles';
  style.textContent = `
    .zr-cookie-banner {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(120%);
      width: calc(100% - 32px);
      max-width: 660px;
      background: #181818;
      color: #F5EFE9;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.25);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 99999;
      padding: 24px 26px;
      font-family: 'Inter Tight', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      opacity: 0;
      pointer-events: none;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
      box-sizing: border-box;
    }
    .zr-cookie-banner * {
      box-sizing: border-box;
    }
    .zr-cookie-banner.is-visible {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }
    .zr-cookie-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .zr-cookie-eyebrow {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #FF5500;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .zr-cookie-eyebrow::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #FF5500;
    }
    .zr-cookie-badge {
      font-size: 11px;
      color: rgba(245, 239, 233, 0.6);
      letter-spacing: 0.04em;
    }
    .zr-cookie-title {
      font-size: 16px;
      font-weight: 500;
      letter-spacing: -0.015em;
      color: #FFFFFF;
      margin: 0 0 8px 0;
      line-height: 1.35;
    }
    .zr-cookie-desc {
      color: rgba(245, 239, 233, 0.76);
      margin: 0 0 18px 0;
      font-size: 13.5px;
      line-height: 1.45;
    }
    .zr-cookie-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .zr-btn {
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      padding: 10px 18px;
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      white-space: nowrap;
    }
    .zr-btn:active {
      transform: scale(0.98);
    }
    .zr-btn--primary {
      background: #F5EFE9;
      color: #181818;
      border: 1px solid #F5EFE9;
    }
    .zr-btn--primary:hover {
      background: #FF5500;
      border-color: #FF5500;
      color: #FFFFFF;
    }
    .zr-btn--secondary {
      background: transparent;
      color: #F5EFE9;
      border: 1px solid rgba(255, 255, 255, 0.24);
    }
    .zr-btn--secondary:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.4);
    }
    .zr-btn--link {
      background: transparent;
      color: rgba(245, 239, 233, 0.7);
      border: none;
      padding: 10px 12px;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .zr-btn--link:hover {
      color: #FFFFFF;
    }
    .zr-cookie-drawer {
      display: none;
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }
    .zr-cookie-drawer.is-open {
      display: block;
      animation: zrFadeIn 0.25s ease;
    }
    @keyframes zrFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .zr-pref-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .zr-pref-info {
      flex: 1;
    }
    .zr-pref-name {
      font-size: 13.5px;
      font-weight: 500;
      color: #FFFFFF;
      margin-bottom: 3px;
    }
    .zr-pref-desc {
      font-size: 12px;
      color: rgba(245, 239, 233, 0.6);
      line-height: 1.4;
    }
    .zr-toggle {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .zr-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .zr-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(255, 255, 255, 0.2);
      border-radius: 22px;
      transition: background-color 0.25s ease;
    }
    .zr-toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background-color: #FFFFFF;
      border-radius: 50%;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .zr-toggle input:checked + .zr-toggle-slider {
      background-color: #FF5500;
    }
    .zr-toggle input:checked + .zr-toggle-slider:before {
      transform: translateX(18px);
    }
    .zr-toggle input:disabled + .zr-toggle-slider {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .zr-drawer-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 16px;
      padding-top: 8px;
    }
    .zr-policy-link {
      font-size: 12px;
      color: rgba(245, 239, 233, 0.6);
      text-decoration: underline;
    }
    .zr-policy-link:hover {
      color: #FF5500;
    }
    @media (max-width: 600px) {
      .zr-cookie-banner {
        bottom: 12px;
        left: 12px;
        right: 12px;
        transform: translateY(120%);
        width: calc(100% - 24px);
        padding: 20px 18px;
      }
      .zr-cookie-banner.is-visible {
        transform: translateY(0);
      }
      .zr-cookie-actions {
        flex-direction: column;
        align-items: stretch;
      }
      .zr-btn {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderBanner(forceOpen = false) {
  if (document.getElementById('zr-cookie-banner')) {
    const banner = document.getElementById('zr-cookie-banner');
    if (forceOpen) {
      banner.classList.add('is-visible');
      const drawer = document.getElementById('zr-cookie-drawer');
      if (drawer) drawer.classList.add('is-open');
    }
    return;
  }

  injectBannerStyles();

  const banner = document.createElement('div');
  banner.id = 'zr-cookie-banner';
  banner.className = 'zr-cookie-banner' + (forceOpen ? ' is-visible' : '');
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie and visitor tracking consent');

  const currentPrefs = getConsentPrefs();

  banner.innerHTML = `
    <div class="zr-cookie-header">
      <div class="zr-cookie-eyebrow">Cookie Preferences</div>
      <div class="zr-cookie-badge">Dhaka &amp; Worldwide</div>
    </div>
    <div class="zr-cookie-title">We use cookies to enhance your experience.</div>
    <div class="zr-cookie-desc">
      We use cookies to enhance your experience, analyze site traffic, and understand how visitors engage with our work. You can accept all cookies or choose necessary cookies only.
    </div>
    <div class="zr-cookie-actions">
      <button type="button" class="zr-btn zr-btn--primary" id="zr-accept-all">Accept all cookies</button>
      <button type="button" class="zr-btn zr-btn--secondary" id="zr-accept-necessary">Accept necessary cookies only</button>
      <button type="button" class="zr-btn zr-btn--link" id="zr-toggle-details">Preferences ▾</button>
    </div>
    <div class="zr-cookie-drawer" id="zr-cookie-drawer">
      <div class="zr-pref-row">
        <div class="zr-pref-info">
          <div class="zr-pref-name">Strictly Necessary Cookies</div>
          <div class="zr-pref-desc">Essential for the website to function securely and remember your choices (<code style="font-size:11px;color:#FF5500">zr_consent</code>). Always active.</div>
        </div>
        <label class="zr-toggle">
          <input type="checkbox" checked disabled>
          <span class="zr-toggle-slider"></span>
        </label>
      </div>
      <div class="zr-pref-row">
        <div class="zr-pref-info">
          <div class="zr-pref-name">Analytics &amp; Performance</div>
          <div class="zr-pref-desc">Helps us analyze site traffic and understand how visitors engage with our content (<code style="font-size:11px;color:#FF5500">_zr_vid, _zr_sid, _zr_depth, _zr_act</code>).</div>
        </div>
        <label class="zr-toggle">
          <input type="checkbox" id="zr-pref-analytics" ${currentPrefs.analytics ? 'checked' : ''}>
          <span class="zr-toggle-slider"></span>
        </label>
      </div>
      <div class="zr-pref-row">
        <div class="zr-pref-info">
          <div class="zr-pref-name">Traffic &amp; Referral Sources</div>
          <div class="zr-pref-desc">Measures referral channels to help us understand how audiences find Zeriotic (<code style="font-size:11px;color:#FF5500">_zr_ref, _zr_landing, _zr_utm</code>).</div>
        </div>
        <label class="zr-toggle">
          <input type="checkbox" id="zr-pref-attribution" ${currentPrefs.attribution ? 'checked' : ''}>
          <span class="zr-toggle-slider"></span>
        </label>
      </div>
      <div class="zr-drawer-actions">
        <a href="/privacy/" class="zr-policy-link">Read our full Privacy Policy &rarr;</a>
        <button type="button" class="zr-btn zr-btn--primary" id="zr-save-custom" style="padding: 8px 16px;">Save chosen preferences</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // Animate in after tiny delay if not forced
  if (!forceOpen) {
    const raf = (typeof window !== 'undefined' && window.requestAnimationFrame) ? window.requestAnimationFrame : ((cb) => setTimeout(cb, 16));
    raf(() => {
      setTimeout(() => {
        banner.classList.add('is-visible');
      }, 300);
    });
  }

  // Event handlers
  const acceptAllBtn = banner.querySelector('#zr-accept-all');
  const acceptNecBtn = banner.querySelector('#zr-accept-necessary');
  const toggleDetailsBtn = banner.querySelector('#zr-toggle-details');
  const drawer = banner.querySelector('#zr-cookie-drawer');
  const saveCustomBtn = banner.querySelector('#zr-save-custom');
  const analyticsCheck = banner.querySelector('#zr-pref-analytics');
  const attributionCheck = banner.querySelector('#zr-pref-attribution');

  const closeBanner = () => {
    banner.classList.remove('is-visible');
    setTimeout(() => {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 450);
  };

  if (acceptAllBtn) {
    acceptAllBtn.addEventListener('click', () => {
      saveConsent('all', { necessary: true, analytics: true, attribution: true, telemetry: true });
      closeBanner();
    });
  }

  if (acceptNecBtn) {
    acceptNecBtn.addEventListener('click', () => {
      saveConsent('necessary', { necessary: true, analytics: false, attribution: false, telemetry: false });
      closeBanner();
    });
  }

  if (toggleDetailsBtn && drawer) {
    toggleDetailsBtn.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('is-open');
      toggleDetailsBtn.textContent = isOpen ? 'Hide details ▴' : 'Preferences ▾';
    });
  }

  if (saveCustomBtn) {
    saveCustomBtn.addEventListener('click', () => {
      const isAnalytics = !!analyticsCheck?.checked;
      const isAttribution = !!attributionCheck?.checked;
      const isAll = isAnalytics && isAttribution;
      const isNone = !isAnalytics && !isAttribution;

      const state = isAll ? 'all' : (isNone ? 'necessary' : 'custom');
      saveConsent(state, {
        necessary: true,
        analytics: isAnalytics,
        attribution: isAttribution,
        telemetry: isAnalytics
      });
      closeBanner();
    });
  }
}

// --- Wire Footer / Page Hooks ---
function wirePreferencesTriggers() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.js-cookie-settings, [data-open-cookies], a[href="#cookie-settings"], a[href="#cookies"]');
    if (trigger) {
      e.preventDefault();
      renderBanner(true);
    }
  });
}

// --- Public Developer & Inspector API ---
export const ZerioticTracker = {
  getProfile() {
    return {
      consent: getConsentState(),
      preferences: getConsentPrefs(),
      visitorId: getCookie('_zr_vid'),
      sessionId: getCookie('_zr_sid'),
      visitCount: parseInt(getCookie('_zr_visit_count') || '0', 10),
      firstSeen: getCookie('_zr_first_seen'),
      lastSeen: getCookie('_zr_last_seen'),
      landingPage: getCookie('_zr_landing'),
      referrer: getCookie('_zr_ref'),
      utm: (() => {
        try { return JSON.parse(getCookie('_zr_utm') || '{}'); } catch { return {}; }
      })(),
      scrollDepth: getCookie('_zr_depth') || '0%',
      telemetry: gatherTelemetry(),
    };
  },
  getEvents() {
    return [...activityStream];
  },
  getConsent() {
    return getConsentState();
  },
  getConsentPrefs() {
    return getConsentPrefs();
  },
  hasConsent(category = 'analytics') {
    const prefs = getConsentPrefs();
    return !!prefs[category];
  },
  openPreferences() {
    renderBanner(true);
  },
  acceptAll() {
    saveConsent('all');
  },
  acceptNecessaryOnly() {
    saveConsent('necessary');
  },
  track(type, label, extra) {
    logAction(type, label, extra);
  },
  reset() {
    deleteCookie(CONSENT_COOKIE);
    deleteCookie(CONSENT_PREFS_COOKIE);
    safeStorage.removeItem(CONSENT_COOKIE);
    safeStorage.removeItem(CONSENT_PREFS_COOKIE);
    purgeTrackingData();
    renderBanner(true);
  }
};

if (typeof window !== 'undefined') {
  window.ZerioticTracker = ZerioticTracker;
}

// --- Auto Boot on DOM Ready ---
function boot() {
  wirePreferencesTriggers();
  const consent = getConsentState();
  if (!consent) {
    renderBanner(false);
  } else if (consent === 'all' || getConsentPrefs().analytics) {
    initExtremeTracking();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}

export default ZerioticTracker;
