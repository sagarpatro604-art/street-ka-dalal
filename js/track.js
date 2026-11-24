// Usage tracker for Admin > Analytics (functions/api/track.js). No cookies, no outside service: one small send to our own
// /api/track every 2 minutes while someone is using the site, and one when they leave the page.
//
// Time is counted in 5-second steps only while the page is on screen AND the person touched / scrolled / typed in the
// last 2 minutes (5 minutes on Reels, where people watch without touching). A tab left open adds nothing.
// Sends happen only on the live site (street-ka-dalal.pages.dev), never on a local preview.
const LIVE = location.hostname === 'street-ka-dalal.pages.dev';
const API = '/api/track';
const STEP = 5000, SEND_EVERY = 120000, NEW_VISIT_AFTER = 30 * 60000;

const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const rid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24);

function browserId() {
  let c = LS.get('skd.cid');
  if (!c) { c = rid(); LS.set('skd.cid', c); }
  return c;
}
// one visit = one session id; a new one after 30 minutes away (shared by every tab of this browser)
function visitId() {
  const last = +LS.get('skd.sidAt') || 0;
  let s = LS.get('skd.sid');
  if (!s || Date.now() - last > NEW_VISIT_AFTER) { s = rid(); LS.set('skd.sid', s); }
  LS.set('skd.sidAt', String(Date.now()));
  return s;
}
function device() {
  const ua = navigator.userAgent || '';
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'Tablet';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPod/i.test(ua)) return 'iPhone';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS/i.test(ua)) return 'Mac';
  if (/Linux|CrOS/i.test(ua)) return 'Linux';
  return 'Other';
}

// '#/stock/RELIANCE' -> 'stock/RELIANCE', '#/discover/investors' -> 'discover/investors', '#/library/x.pdf' -> 'library/read'
const TWO = new Set(['discover', 'resplus', 'sectors', 'research', 'stock', 'compare']);
export function sectionOf(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('?')[0].split('/').map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const top = parts[0] || 'watch';
  if (top === 'library' && parts[1]) return 'library/read';
  if (top === 'results' && parts[1] === 'co') return parts[2] ? `results/co/${parts[2].toUpperCase()}` : 'results/co';
  if (top === 'stock' && parts[1]) return `stock/${parts[1].toUpperCase()}`;
  if (top === 'compare') return 'compare';
  if (top === 'post') return 'post';
  if (TWO.has(top) && parts[1]) return `${top}/${parts[1]}`;
  return top;
}

let started = false;
export function startTracking({ section, token, idleMs = 120000 } = {}) {
  if (started || !LIVE) return;
  started = true;
  const cid = browserId(), dev = device();
  let lastInput = Date.now(), cur = null, pend = {}, tok = null, tokAt = 0, sending = false;
  const bump = (k, s, v) => { const p = (pend[k] ||= [0, 0]); p[0] += s; p[1] += v; };
  const note = () => { const s = section(); if (s && s !== cur) { cur = s; bump(s, 0, 1); } };
  ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel', 'mousemove'].forEach((e) => addEventListener(e, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  addEventListener('hashchange', () => { lastInput = Date.now(); note(); });
  note();
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const playing = [...document.querySelectorAll('video,audio')].some((m) => !m.paused);
    if (!playing && Date.now() - lastInput > idleMs) return;
    note();
    if (cur) bump(cur, STEP / 1000, 0);
  }, STEP);

  async function freshToken() {
    if (!token) return null;
    if (tok && Date.now() - tokAt < 30 * 60000) return tok;
    try { tok = await token(); if (tok) tokAt = Date.now(); } catch { tok = null; }
    return tok;
  }
  async function send(leaving) {
    if (sending && !leaving) return;
    const beats = pend; pend = {};
    if (!Object.keys(beats).length) return;
    sending = true;
    try {
      const t = leaving ? tok : await freshToken();
      await fetch(API, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ cid, sid: visitId(), dev, beats }),
      });
    } catch { /* a lost send only loses that bit of time */ } finally { sending = false; }
  }
  setInterval(() => send(false), SEND_EVERY);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(true); });
  addEventListener('pagehide', () => send(true));
  freshToken();
}
