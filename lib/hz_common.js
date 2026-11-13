// Shared server helpers for the Humanizer (functions/api/humanize.js) and the Plagiarism checker
// (functions/api/plagiarism.js): CORS, Google sign-in check, the D1 tables, the shared spend guard, people list.
//
// D1 (binding DALAL_DB, the same free database as Dalal):
//   humanize_log    every humanize request (text in / out, model, cost, fresh-wording share)
//   plag_log        every plagiarism check (probe sentences, sources found, % matched before / after humanizing)
//   humanize_spend  estimated USD per IST day and month, both tools together (the money guard)
//   humanize_ip     requests per network per day (IP kept only as a daily hash)
//   hz_user         requests per signed-in account per day and tool
//   hz_people       one row per person who used the tools (email, name, first / last use, counts)

export const ADMIN_EMAILS = ['sagarpatro604@gmail.com'];
const ALLOWED_ORIGINS = ['https://street-ka-dalal.pages.dev'];

export const cors = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) || /\.street-ka-dalal\.pages\.dev$/.test(origin || '') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '') ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin',
});
export const json = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origin) } });
const istNow = () => new Date(Date.now() + 330 * 60000);
export const istDate = () => istNow().toISOString().slice(0, 10);
export const istMonth = () => istNow().toISOString().slice(0, 7);
export const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('database took too long')), ms))]);
export const words = (s) => (String(s).match(/\S+/g) || []).length;

export async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------ tables */
let ready = null;
export function table(env) {
  if (!env.DALAL_DB) return Promise.reject(new Error('no database'));
  const D = env.DALAL_DB;
  ready = ready || D.batch([
    D.prepare('CREATE TABLE IF NOT EXISTS humanize_log (id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT, day TEXT, iph TEXT, country TEXT, email TEXT, tone TEXT, words_in INTEGER, words_out INTEGER, model TEXT, ms INTEGER, usd REAL, reuse REAL, status TEXT, text_in TEXT, text_out TEXT)'),
    D.prepare('CREATE INDEX IF NOT EXISTS humanize_log_day ON humanize_log (day)'),
    D.prepare('CREATE TABLE IF NOT EXISTS plag_log (id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT, day TEXT, uid TEXT, email TEXT, name TEXT, country TEXT, words INTEGER, engine TEXT, probes TEXT, sources TEXT, pct REAL, after_pct REAL, usd REAL, ms INTEGER, status TEXT, text_in TEXT)'),
    D.prepare('CREATE INDEX IF NOT EXISTS plag_log_day ON plag_log (day)'),
    D.prepare('CREATE TABLE IF NOT EXISTS humanize_ip (k TEXT PRIMARY KEY, n INTEGER, day TEXT)'),
    D.prepare('CREATE TABLE IF NOT EXISTS humanize_spend (period TEXT PRIMARY KEY, usd REAL, n INTEGER)'),
    D.prepare('CREATE TABLE IF NOT EXISTS hz_user (k TEXT PRIMARY KEY, n INTEGER, day TEXT)'),
    D.prepare('CREATE TABLE IF NOT EXISTS hz_people (email TEXT PRIMARY KEY, uid TEXT, name TEXT, first TEXT, last TEXT, humanize INTEGER DEFAULT 0, checks INTEGER DEFAULT 0, country TEXT)'),
    D.prepare('CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT, exp INTEGER NOT NULL)'),
  ]).then(() => D).catch((e) => { ready = null; throw e; });
  return within(ready, 5000);
}

export async function spend(d, period) {
  const r = await within(d.prepare('SELECT usd, n FROM humanize_spend WHERE period = ?').bind(period).first(), 4000);
  return { usd: r?.usd || 0, n: r?.n || 0 };
}
export const caps = (env) => ({ day: +(env.HUMANIZE_DAY_USD || 0.5), month: +(env.HUMANIZE_MONTH_USD || 5) });
export async function overCaps(env, d) {
  const [sd, sm] = await Promise.all([spend(d, istDate()).catch(() => ({ usd: 0 })), spend(d, istMonth()).catch(() => ({ usd: 0 }))]);
  const c = caps(env);
  return sd.usd >= c.day || sm.usd >= c.month;
}
export function addSpend(d, usd) {
  return within(d.batch([
    d.prepare('INSERT INTO humanize_spend (period, usd, n) VALUES (?, ?, 1) ON CONFLICT(period) DO UPDATE SET usd = usd + excluded.usd, n = n + 1').bind(istDate(), usd),
    d.prepare('INSERT INTO humanize_spend (period, usd, n) VALUES (?, ?, 1) ON CONFLICT(period) DO UPDATE SET usd = usd + excluded.usd, n = n + 1').bind(istMonth(), usd),
  ]), 5000).catch((e) => console.warn('spend', e.message));
}

// per-account and per-network daily counters: { used, ok } before the request, bump() after it
export async function limits(d, request, user, tool, perUser, perIp) {
  const day = istDate();
  const iph = await sha(`${request.headers.get('CF-Connecting-IP') || ''}|${day}`);
  const ku = `${tool}:${user.uid}:${day}`, ki = `${tool}:${iph}`;
  const [u, i] = await Promise.all([
    within(d.prepare('SELECT n FROM hz_user WHERE k = ?').bind(ku).first(), 4000).catch(() => null),
    within(d.prepare('SELECT n FROM humanize_ip WHERE k = ?').bind(ki).first(), 4000).catch(() => null),
  ]);
  const usedU = u?.n || 0, usedI = i?.n || 0;
  return {
    iph, used: usedU, left: Math.max(0, perUser - usedU),
    ok: usedU < perUser && usedI < perIp,
    bump: () => within(d.batch([
      d.prepare('INSERT INTO hz_user (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(ku, day),
      d.prepare('INSERT INTO humanize_ip (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(ki, day),
    ]), 5000).then(() => { if (Math.random() < 0.05) { d.prepare('DELETE FROM hz_user WHERE day < ?').bind(day).run().catch(() => {}); d.prepare('DELETE FROM humanize_ip WHERE day < ?').bind(day).run().catch(() => {}); } }).catch((e) => console.warn('limits', e.message)),
  };
}

export function person(d, user, country, tool) {
  const now = new Date().toISOString();
  const col = tool === 'check' ? 'checks' : 'humanize';
  return within(d.prepare(`INSERT INTO hz_people (email, uid, name, first, last, ${col}, country) VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT(email) DO UPDATE SET last = excluded.last, name = excluded.name, uid = excluded.uid, country = excluded.country, ${col} = ${col} + 1`)
    .bind(user.email || user.uid, user.uid, user.name || '', now, now, country || '').run(), 5000).catch((e) => console.warn('person', e.message));
}

/* ------------------------------------------------------------ Firebase ID token check (same as dalal.js) */
let JWKS = null, JWKS_AT = 0;
async function googleKeys() {
  if (JWKS && Date.now() - JWKS_AT < 3600000) return JWKS;
  try {
    const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', { cf: { cacheTtl: 3600 }, signal: AbortSignal.timeout(5000) });
    const keys = (await r.json()).keys || [];
    if (keys.length) { JWKS = keys; JWKS_AT = Date.now(); }
  } catch (e) { console.warn('google keys', e.message); }
  return JWKS || [];
}
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const dec = (s) => JSON.parse(new TextDecoder().decode(b64u(s)));
async function verifyToken(token, projectId) {
  try {
    const [h, p, s] = String(token || '').split('.');
    if (!s) return null;
    const header = dec(h), payload = dec(p);
    const jwk = (await googleKeys()).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.exp < Date.now() / 1000 || !payload.sub) return null;
    return { uid: payload.sub, email: String(payload.email || '').toLowerCase(), name: payload.name || '' };
  } catch {
    return null;
  }
}
export const who = (request, env) => verifyToken((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT_ID || 'street-ka-dalal');
export const isAdmin = (user) => !!user && ADMIN_EMAILS.includes(user.email);
