// Investor persona test (Cloudflare Pages Function, /api/quiz), used by quiz.html.
//
// POST (anyone, no sign-in): { name, exp, score, max, pct, skills, val, best, secs, cid, ver, login, website }
//   -> one row per finished game in the D1 table `quiz_results` (binding DALAL_DB). The level is worked out
//   HERE from the score (same cut-offs as the page), never taken from the browser. `website` is a honeypot.
//   With `login`, the email comes only from a verified Firebase ID token. At most 15 games a day per network.
// GET (admin only, Firebase ID token of an ADMIN_EMAILS account): every result, newest first, for
//   Admin > Persona test (counts of beginner / intermediate / advanced, skills, CSV).

const ALLOWED_ORIGINS = ['https://street-ka-dalal.pages.dev'];
const ADMIN_EMAILS = ['sagarpatro604@gmail.com'];
const VERSIONS = { v1: 33 };   // test version -> maximum points (quiz.html MAX); a new question set gets a new version
const SKILLS = ['basics', 'charts', 'fund', 'data', 'temper'];
const EXP = ['new', 'lt2', '2to5', '5plus'];
const levelOf = (pct) => (pct >= 72 ? 'advanced' : pct >= 40 ? 'intermediate' : 'beginner');

const cors = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) || /\.street-ka-dalal\.pages\.dev$/.test(origin || '') || /^http:\/\/localhost(:\d+)?$/.test(origin || '') ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin',
});
const json = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origin) } });
const istDate = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('database took too long')), ms))]);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));

let ready = null;
function table(env) {
  if (!env.DALAL_DB) return Promise.reject(new Error('no database'));
  ready = ready || env.DALAL_DB.batch([
    env.DALAL_DB.prepare('CREATE TABLE IF NOT EXISTS quiz_results (cid TEXT PRIMARY KEY, ver TEXT, name TEXT, email TEXT, via TEXT, exp TEXT, score REAL, max REAL, pct INTEGER, level TEXT, skills TEXT, val INTEGER, best INTEGER, secs INTEGER, created TEXT, iph TEXT)'),
    env.DALAL_DB.prepare('CREATE INDEX IF NOT EXISTS quiz_results_created ON quiz_results (created)'),
    env.DALAL_DB.prepare('CREATE TABLE IF NOT EXISTS quiz_ip (k TEXT PRIMARY KEY, n INTEGER, day TEXT)'),
  ]).then(() => env.DALAL_DB).catch((e) => { ready = null; throw e; });
  return within(ready, 5000);
}

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* Firebase ID token check (same as functions/api/register.js) */
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
    if (!ok || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.exp < Date.now() / 1000) return null;
    return { email: String(payload.email || '').toLowerCase() };
  } catch {
    return null;
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('Origin')) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad request' }, 400, origin); }
  if (b.website) return json({ ok: true }, 200, origin);
  if (b.ver === 'selftest') {
    try { const d = await table(env); const c = await within(d.prepare('SELECT COUNT(*) AS n FROM quiz_results').first(), 4000); return json({ ok: true, db: true, n: c?.n ?? 0 }, 200, origin); }
    catch (e) { return json({ ok: false, error: e.message }, 503, origin); }
  }
  const max = VERSIONS[b.ver];
  if (!max) return json({ error: 'unknown test version' }, 400, origin);
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (name.length < 2) return json({ error: 'name missing' }, 400, origin);
  const cid = String(b.cid || '').toUpperCase();
  if (!/^SKD-\d{6}-[A-Z0-9]{4}$/.test(cid)) return json({ error: 'bad certificate id' }, 400, origin);
  const score = Math.round(clamp(b.score, 0, max) * 10) / 10;
  const pct = Math.round((score / max) * 100);
  const skills = {};
  SKILLS.forEach((k) => { skills[k] = Math.round(clamp(b.skills?.[k], 0, 100)); });
  let email = null, via = 'name';
  if (b.login) {
    const u = await verifyToken((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT_ID || 'street-ka-dalal');
    if (u?.email) { email = u.email; via = 'google'; }
  }
  try {
    const d = await table(env);
    const day = istDate();
    const iph = await sha(`${request.headers.get('CF-Connecting-IP') || ''}|${day}`);
    const seen = await within(d.prepare('SELECT n FROM quiz_ip WHERE k = ?').bind(iph).first(), 4000);
    if (seen && seen.n >= 15) return json({ error: 'too many games from this network today' }, 429, origin);
    await within(d.batch([
      d.prepare('INSERT OR IGNORE INTO quiz_results (cid, ver, name, email, via, exp, score, max, pct, level, skills, val, best, secs, created, iph) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(cid, b.ver, name, email, via, EXP.includes(b.exp) ? b.exp : null, score, max, pct, levelOf(pct), JSON.stringify(skills), Math.round(clamp(b.val, 0, 1e7)), Math.round(clamp(b.best, 0, 20)), Math.round(clamp(b.secs, 0, 86400)), new Date().toISOString(), iph),
      d.prepare('INSERT INTO quiz_ip (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(iph, day),
    ]), 5000);
    if (Math.random() < 0.05) d.prepare('DELETE FROM quiz_ip WHERE day < ?').bind(day).run().catch(() => {});
    return json({ ok: true, level: levelOf(pct) }, 200, origin);
  } catch (e) {
    console.warn('quiz', e.message);
    return json({ error: 'Could not save right now.' }, 503, origin);
  }
}

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get('Origin');
  const user = await verifyToken((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT_ID || 'street-ka-dalal');
  if (!user || !ADMIN_EMAILS.includes(user.email)) return json({ error: 'admin only' }, 401, origin);
  try {
    const d = await table(env);
    const r = await within(d.prepare('SELECT cid, ver, name, email, via, exp, score, max, pct, level, skills, val, best, secs, created FROM quiz_results ORDER BY created DESC LIMIT 5000').all(), 6000);
    const rows = (r.results || []).map((x) => ({ ...x, skills: (() => { try { return JSON.parse(x.skills || '{}'); } catch { return {}; } })() }));
    return json({ rows }, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 503, origin);
  }
}
