// Community session registration (Cloudflare Pages Function, /api/register), used by session.html.
//
// POST (anyone, no sign-in): { event, name, email, attended, consent, website } -> saved in the D1 table
//   `registrations` (binding DALAL_DB, the same free database as Dalal's counter). One row per event + email;
//   registering again updates it. `website` is a hidden honeypot field: bots fill it, people never see it.
//   At most 8 registrations a day from one network (IP hash, never the IP itself).
// GET (admin only, Firebase ID token of an ADMIN_EMAILS account): ?event=... -> every registration, newest first.
//   Admin > Registrations on the site shows them and downloads a CSV for the calendar invite.

const ALLOWED_ORIGINS = ['https://street-ka-dalal.pages.dev'];
const ADMIN_EMAILS = ['sagarpatro604@gmail.com'];
const EVENTS = ['meet-3'];   // open for sign-up now; older events stay readable in Admin (GET takes any event id)

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
    env.DALAL_DB.prepare('CREATE TABLE IF NOT EXISTS registrations (event TEXT NOT NULL, email TEXT NOT NULL, name TEXT, attended TEXT, consent INTEGER, created TEXT, updated TEXT, iph TEXT, PRIMARY KEY (event, email))'),
    env.DALAL_DB.prepare("CREATE TABLE IF NOT EXISTS reg_meta (event TEXT NOT NULL, email TEXT NOT NULL, via TEXT, PRIMARY KEY (event, email))"),
    env.DALAL_DB.prepare('CREATE TABLE IF NOT EXISTS reg_ip (k TEXT PRIMARY KEY, n INTEGER, day TEXT)'),
  ]).then(() => env.DALAL_DB).catch((e) => { ready = null; throw e; });
  return within(ready, 5000);
}

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* Firebase ID token check (same as functions/api/dalal.js) */
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
  try { b = await request.json(); } catch { return json({ error: 'Please fill the form again.' }, 400, origin); }
  if (b.website) return json({ ok: true }, 200, origin);            // honeypot: pretend it worked
  if (b.event === 'selftest') {                                     // health check: database reachable, nothing saved
    try { const d = await table(env); const c = await within(d.prepare('SELECT COUNT(*) AS n FROM registrations').first(), 4000); return json({ ok: true, db: true, n: c?.n ?? 0 }, 200, origin); }
    catch (e) { return json({ ok: false, error: e.message }, 503, origin); }
  }
  const event = EVENTS.includes(b.event) ? b.event : null;
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  let email = String(b.email || '').trim().toLowerCase().slice(0, 120);
  let via = 'typed';
  if (b.login) {                                                    // "use my sign-in email": trust only the verified token
    const u = await verifyToken((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT_ID || 'street-ka-dalal');
    if (!u || !u.email) return json({ error: 'Your sign-in has expired. Turn off "Use my sign-in email" and type it, or reload the page.' }, 401, origin);
    email = u.email; via = 'google';
  }
  const attended = ['yes', 'no'].includes(b.attended) ? b.attended : null;
  const consent = b.consent === true ? 1 : 0;
  if (!event) return json({ error: 'This session is closed for registration.' }, 400, origin);
  if (name.length < 2) return json({ error: 'Please write your name.' }, 400, origin);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'Please check your email address.' }, 400, origin);
  if (!attended) return json({ error: 'Please tell us if you attended the last session.' }, 400, origin);
  try {
    const d = await table(env);
    const day = istDate();
    const iph = await sha(`${request.headers.get('CF-Connecting-IP') || ''}|${day}`);
    const seen = await within(d.prepare('SELECT n FROM reg_ip WHERE k = ?').bind(iph).first(), 4000);
    if (seen && seen.n >= 8) return json({ error: 'Too many registrations from this network today. Please try tomorrow or message us on WhatsApp.' }, 429, origin);
    const now = new Date().toISOString();
    const prev = await within(d.prepare('SELECT created FROM registrations WHERE event = ? AND email = ?').bind(event, email).first(), 4000);
    await within(d.batch([
      d.prepare('INSERT INTO registrations (event, email, name, attended, consent, created, updated, iph) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event, email) DO UPDATE SET name = excluded.name, attended = excluded.attended, consent = excluded.consent, updated = excluded.updated')
        .bind(event, email, name, attended, consent, now, now, iph),
      d.prepare('INSERT INTO reg_meta (event, email, via) VALUES (?, ?, ?) ON CONFLICT(event, email) DO UPDATE SET via = excluded.via').bind(event, email, via),
      d.prepare('INSERT INTO reg_ip (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(iph, day),
    ]), 5000);
    if (Math.random() < 0.05) d.prepare('DELETE FROM reg_ip WHERE day < ?').bind(day).run().catch(() => {});
    return json({ ok: true, again: !!prev }, 200, origin);
  } catch (e) {
    console.warn('register', e.message);
    return json({ error: 'Could not save right now. Please try again in a minute.' }, 503, origin);
  }
}

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get('Origin');
  const user = await verifyToken((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT_ID || 'street-ka-dalal');
  if (!user || !ADMIN_EMAILS.includes(user.email)) return json({ error: 'admin only' }, 401, origin);
  const event = new URL(request.url).searchParams.get('event') || EVENTS[EVENTS.length - 1];
  try {
    const d = await table(env);
    const r = await within(d.prepare('SELECT r.email, r.name, r.attended, r.consent, r.created, r.updated, m.via FROM registrations r LEFT JOIN reg_meta m ON m.event = r.event AND m.email = r.email WHERE r.event = ? ORDER BY r.created DESC').bind(event).all(), 5000);
    return json({ event, rows: r.results || [] }, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 503, origin);
  }
}
