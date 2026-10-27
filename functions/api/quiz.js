// Investor persona test (Cloudflare Pages Function, /api/quiz), used by quiz.html.
//
// POST (anyone, no sign-in): { ver, name, cid, secs, answers, login, website } -> one row per finished game in the
//   D1 table `persona_results` (binding DALAL_DB). The persona score, level, profile and virtual P/L are worked out
//   HERE from the answers with the same tables as quiz.html, never taken from the browser. `website` is a honeypot.
//   With `login`, the email comes only from a verified Firebase ID token. At most 15 games a day per network.
// GET (admin only, Firebase ID token of an ADMIN_EMAILS account): every result with its answers, newest first,
//   for Admin > Persona test (levels, styles, word familiarity, market moments, CSV).
// (Version v1, the knowledge quiz of the first day, was replaced before anyone played; its table quiz_results is unused.)

const ALLOWED_ORIGINS = ['https://street-ka-dalal.pages.dev'];
const ADMIN_EMAILS = ['sagarpatro604@gmail.com'];
const VERSIONS = ['v2'];

/* scoring tables: keep identical to quiz.html */
const YEARS = [['none', 0], ['lt1', 4], ['1to3', 9], ['3to5', 14], ['5plus', 20]];
const STYLE = ['long', 'sip', 'swing', 'intraday', 'fno', 'watch'];
const TIME = [['15m', 0], ['30m', 1], ['2h', 3], ['full', 5]];
const GOAL = ['wealth', 'income', 'beatfd', 'learn', 'thrill'];
const WORDS = [['nifty', 1], ['sensex', 1], ['sip', 1], ['mf', 1], ['sl', 1], ['mcap', 1], ['ipo', 1],
  ['pe', 2], ['brk', 2], ['ma', 2], ['rsi', 2], ['fii', 2], ['dy', 2], ['prom', 2], ['52w', 2],
  ['roce', 3], ['fcf', 3], ['oc', 3], ['oi', 3], ['iv', 3], ['theta', 3], ['pcr', 3], ['ic', 3], ['pledge', 3], ['rs', 3], ['zeta', 0]];
const WORD_MAX = WORDS.reduce((s, w) => s + w[1], 0);
const TOOLS = [['broker', 0], ['tv', 2], ['screener', 2], ['sheets', 2], ['options', 2], ['code', 3], ['none', 0]];
const LEARN = ['social', 'books', 'courses', 'friends', 'tips', 'filings', 'skd'];
const HABITS = [['h1', 3, true], ['h2', 4, true], ['h3', 4, true], ['h4', 4, false]];
const MOMENTS = [[[-12000, 0], [3000, 1], [6000, 2], [-15000, 0]], [[-10000, 0], [-2000, 0], [0, 2], [0, 2]], [[2000, 1], [4000, 2], [1000, 0], [3000, 2]], [[-1600, 0], [2400, 2], [1000, 1], [1600, 1]], [[-27000, 0], [-2700, 1], [0, 2], [0, 2]]];

const pickOne = (v, list) => (list.includes(v) ? v : null);
const pickMany = (v, list) => (Array.isArray(v) ? [...new Set(v.filter((x) => list.includes(x)))] : []);
function clean(a = {}) {
  const ids = (t) => t.map((x) => x[0]);
  return {
    years: pickOne(a.years, ids(YEARS)), rating: Math.min(10, Math.max(1, Math.round(+a.rating || 1))), style: pickOne(a.style, STYLE),
    time: pickOne(a.time, ids(TIME)), goal: pickOne(a.goal, GOAL), words: pickMany(a.words, ids(WORDS)), tools: pickMany(a.tools, ids(TOOLS)),
    learn: pickMany(a.learn, LEARN), habits: Object.fromEntries(HABITS.map(([id]) => [id, a.habits?.[id] === true])),
    moments: MOMENTS.map((m, i) => { const k = Number.isInteger(a.moments?.[i]) ? a.moments[i] : -1; return k >= 0 && k < m.length ? k : null; }),
  };
}
function scoreOf(a) {
  const val = (t, id) => (t.find((x) => x[0] === id) || [null, 0])[1];
  const yp = val(YEARS, a.years), rp = ((a.rating - 1) / 9) * 10, tm = val(TIME, a.time);
  let wp = (a.words.reduce((s, w) => s + val(WORDS, w), 0) / WORD_MAX) * 35;
  if (a.words.includes('zeta')) wp *= 0.8;
  const hp = HABITS.reduce((s, [id, pts, good]) => s + (a.habits[id] === good ? pts : 0), 0);
  const tp = Math.min(10, a.tools.reduce((s, t) => s + val(TOOLS, t), 0));
  const mo = MOMENTS.map((m, i) => (a.moments[i] == null ? [0, 0] : m[a.moments[i]]));
  const dp = (mo.reduce((s, o) => s + o[1], 0) / (MOMENTS.length * 2)) * 5;
  const score = Math.round(yp + rp + wp + hp + tp + tm + dp);
  return {
    score, level: score >= 65 ? 'advanced' : score >= 35 ? 'intermediate' : 'beginner',
    profile: { exp: Math.round(((yp + tm) / 25) * 100), words: Math.round((wp / 35) * 100), habits: Math.round((hp / 15) * 100), tools: Math.round((tp / 10) * 100), disc: Math.round((dp / 5) * 100) },
    pl: mo.reduce((s, o) => s + o[0], 0),
  };
}

const cors = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) || /\.street-ka-dalal\.pages\.dev$/.test(origin || '') || /^http:\/\/localhost(:\d+)?$/.test(origin || '') ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin',
});
const json = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origin) } });
const istDate = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('database took too long')), ms))]);

let ready = null;
function table(env) {
  if (!env.DALAL_DB) return Promise.reject(new Error('no database'));
  ready = ready || env.DALAL_DB.batch([
    env.DALAL_DB.prepare('CREATE TABLE IF NOT EXISTS persona_results (cid TEXT PRIMARY KEY, ver TEXT, name TEXT, email TEXT, via TEXT, years TEXT, rating INTEGER, style TEXT, score INTEGER, level TEXT, profile TEXT, answers TEXT, pl INTEGER, secs INTEGER, created TEXT, iph TEXT)'),
    env.DALAL_DB.prepare('CREATE INDEX IF NOT EXISTS persona_results_created ON persona_results (created)'),
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
    try { const d = await table(env); const c = await within(d.prepare('SELECT COUNT(*) AS n FROM persona_results').first(), 4000); return json({ ok: true, db: true, n: c?.n ?? 0 }, 200, origin); }
    catch (e) { return json({ ok: false, error: e.message }, 503, origin); }
  }
  if (!VERSIONS.includes(b.ver)) return json({ error: 'unknown test version' }, 400, origin);
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (name.length < 2) return json({ error: 'name missing' }, 400, origin);
  const cid = String(b.cid || '').toUpperCase();
  if (!/^SKD-\d{6}-[A-Z0-9]{4}$/.test(cid)) return json({ error: 'bad certificate id' }, 400, origin);
  const a = clean(b.answers);
  if (!a.years || !a.style || a.moments.some((m) => m == null)) return json({ error: 'answers missing' }, 400, origin);
  const sc = scoreOf(a);
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
      d.prepare('INSERT OR IGNORE INTO persona_results (cid, ver, name, email, via, years, rating, style, score, level, profile, answers, pl, secs, created, iph) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(cid, b.ver, name, email, via, a.years, a.rating, a.style, sc.score, sc.level, JSON.stringify(sc.profile), JSON.stringify(a), sc.pl, Math.round(Math.min(86400, Math.max(0, +b.secs || 0))), new Date().toISOString(), iph),
      d.prepare('INSERT INTO quiz_ip (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(iph, day),
    ]), 5000);
    if (Math.random() < 0.05) d.prepare('DELETE FROM quiz_ip WHERE day < ?').bind(day).run().catch(() => {});
    return json({ ok: true, level: sc.level, score: sc.score }, 200, origin);
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
    const r = await within(d.prepare('SELECT cid, ver, name, email, via, years, rating, style, score, level, profile, answers, pl, secs, created FROM persona_results ORDER BY created DESC LIMIT 5000').all(), 6000);
    const parse = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
    const rows = (r.results || []).map((x) => ({ ...x, profile: parse(x.profile), answers: parse(x.answers) }));
    return json({ rows }, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 503, origin);
  }
}
