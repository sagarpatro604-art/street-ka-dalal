// Discover premium (Sagar 2026-11-16): "when someone open the discover tab show them 60 days free, and in backend store,
// after 60 days expire show it as premium service, and a coupon to unlock the premium, coupon we will generate later".
//
// The trial start is kept HERE (D1), not in the member's own Firestore record, so it cannot be reset from the browser.
//   GET  /api/premium                 the signed-in member's Discover access (starts the 60-day trial on the first call)
//   POST /api/premium {coupon}        redeem a coupon (adds its days of premium)
//   GET  /api/premium?admin=1         admin: coupons, recent redemptions, member access rows
//   POST /api/premium {action:'create', code?, days, max_uses, valid_until?, note?}   admin: make a coupon
//   POST /api/premium {action:'active', code, active}                                 admin: switch a coupon on / off
//
// D1 (binding DALAL_DB):
//   premium_access   uid, email, name, trial_start, premium_until, coupon, first_seen, last_seen, opens
//   premium_coupons  code, days, max_uses (0 = any number), uses, valid_until, note, created, active
//   premium_redeem   every redemption (code, uid, email, at, until)
//   premium_tries    wrong coupon tries per account per day (10 a day, then wait)
import { json, cors, who, isAdmin, within } from '../../lib/hz_common.js';

const TRIAL_DAYS = 60;
const DAY = 86400000;
let ready = null;
function tables(env) {
  if (!env.DALAL_DB) return Promise.reject(new Error('no database'));
  const D = env.DALAL_DB;
  ready ||= D.batch([
    D.prepare('CREATE TABLE IF NOT EXISTS premium_access (uid TEXT PRIMARY KEY, email TEXT, name TEXT, trial_start TEXT, premium_until TEXT, coupon TEXT, first_seen TEXT, last_seen TEXT, opens INTEGER DEFAULT 0)'),
    D.prepare('CREATE TABLE IF NOT EXISTS premium_coupons (code TEXT PRIMARY KEY, days INTEGER, max_uses INTEGER DEFAULT 1, uses INTEGER DEFAULT 0, valid_until TEXT, note TEXT, created TEXT, active INTEGER DEFAULT 1)'),
    D.prepare('CREATE TABLE IF NOT EXISTS premium_redeem (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, uid TEXT, email TEXT, at TEXT, until TEXT)'),
    D.prepare('CREATE TABLE IF NOT EXISTS premium_tries (k TEXT PRIMARY KEY, n INTEGER, day TEXT)'),
  ]).catch((e) => { ready = null; throw e; });
  return ready;
}
const trialDays = (env) => +(env.PREMIUM_TRIAL_DAYS || TRIAL_DAYS);
const iso = (t) => new Date(t).toISOString();

function state(row, env) {
  const now = Date.now();
  const start = Date.parse(row.trial_start);
  const trialEnd = start + trialDays(env) * DAY;
  const until = row.premium_until ? Date.parse(row.premium_until) : 0;
  const mode = until > now ? 'premium' : trialEnd > now ? 'trial' : 'expired';
  const end = mode === 'premium' ? until : trialEnd;
  return { mode, active: mode !== 'expired', trial_days: trialDays(env), trial_start: row.trial_start, trial_end: iso(trialEnd),
    premium_until: row.premium_until || null, ends: iso(end), days_left: Math.max(0, Math.ceil((end - now) / DAY)), coupon: row.coupon || null };
}

async function access(env, user, touch) {
  const D = env.DALAL_DB;
  const now = new Date().toISOString();
  let row = await D.prepare('SELECT * FROM premium_access WHERE uid = ?').bind(user.uid).first();
  if (!row) {
    await D.prepare('INSERT OR IGNORE INTO premium_access (uid, email, name, trial_start, first_seen, last_seen, opens) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .bind(user.uid, user.email, user.name, now, now, now).run();
    row = await D.prepare('SELECT * FROM premium_access WHERE uid = ?').bind(user.uid).first();
  } else if (touch) {
    await D.prepare('UPDATE premium_access SET last_seen = ?, opens = opens + 1, email = ? WHERE uid = ?').bind(now, user.email, user.uid).run();
  }
  return row;
}

const clean = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(8));
  const s = [...r].map((x) => A[x % A.length]).join('');
  return `SKD-${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('Origin')) });
}

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get('Origin');
  const user = await who(request, env);
  if (!user) return json({ error: 'Please sign in again.' }, 401, origin);
  try {
    await within(tables(env), 8000);
    const D = env.DALAL_DB;
    if (new URL(request.url).searchParams.get('admin')) {
      if (!isAdmin(user)) return json({ error: 'not allowed' }, 403, origin);
      const [c, r, a, n] = await Promise.all([
        D.prepare('SELECT * FROM premium_coupons ORDER BY created DESC LIMIT 300').all(),
        D.prepare('SELECT * FROM premium_redeem ORDER BY id DESC LIMIT 300').all(),
        D.prepare('SELECT * FROM premium_access ORDER BY first_seen DESC LIMIT 1000').all(),
        D.prepare('SELECT COUNT(*) AS n FROM premium_access').first(),
      ]);
      return json({ coupons: c.results || [], redeemed: r.results || [], access: (a.results || []).map((x) => ({ ...x, ...state(x, env) })), total: n?.n || 0, trial_days: trialDays(env) }, 200, origin);
    }
    const row = await within(access(env, user, true), 8000);
    return json(state(row, env), 200, origin);
  } catch (e) {
    return json({ error: 'Could not check access just now.', detail: String(e.message || e).slice(0, 200) }, 503, origin);
  }
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  const user = await who(request, env);
  if (!user) return json({ error: 'Please sign in again.' }, 401, origin);
  let body = {};
  try { body = await request.json(); } catch {}
  try {
    await within(tables(env), 8000);
    const D = env.DALAL_DB;
    const now = new Date().toISOString();
    if (body.action) {
      if (!isAdmin(user)) return json({ error: 'not allowed' }, 403, origin);
      if (body.action === 'create') {
        const code = clean(body.code) || newCode();
        const days = Math.max(1, Math.min(3650, Math.round(+body.days || 0)));
        if (!+body.days) return json({ error: 'Give the number of premium days for this coupon.' }, 400, origin);
        const max = Math.max(0, Math.round(+body.max_uses || 0));
        const vu = /^\d{4}-\d{2}-\d{2}$/.test(String(body.valid_until || '')) ? body.valid_until : null;
        const r = await D.prepare('INSERT OR IGNORE INTO premium_coupons (code, days, max_uses, uses, valid_until, note, created, active) VALUES (?, ?, ?, 0, ?, ?, ?, 1)')
          .bind(code, days, max, vu, String(body.note || '').slice(0, 200), now).run();
        if (!r.meta?.changes) return json({ error: `The code ${code} already exists.` }, 409, origin);
        return json({ ok: true, code, days, max_uses: max, valid_until: vu }, 200, origin);
      }
      if (body.action === 'active') {
        await D.prepare('UPDATE premium_coupons SET active = ? WHERE code = ?').bind(body.active ? 1 : 0, clean(body.code)).run();
        return json({ ok: true }, 200, origin);
      }
      return json({ error: 'unknown action' }, 400, origin);
    }
    // redeem
    const code = clean(body.coupon);
    if (!code) return json({ error: 'Type the coupon code.' }, 400, origin);
    const day = now.slice(0, 10);
    const k = `${user.uid}|${day}`;
    const t = await D.prepare('SELECT n FROM premium_tries WHERE k = ?').bind(k).first();
    if ((t?.n || 0) >= 10) return json({ error: 'Too many wrong codes today. Please try again tomorrow.' }, 429, origin);
    const bad = async (msg) => {
      await D.prepare('INSERT INTO premium_tries (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(k, day).run();
      return json({ error: msg }, 400, origin);
    };
    const c = await D.prepare('SELECT * FROM premium_coupons WHERE code = ?').bind(code).first();
    if (!c || !c.active) return bad('That coupon code is not valid.');
    if (c.valid_until && day > c.valid_until) return bad('That coupon has expired.');
    if (c.max_uses > 0 && c.uses >= c.max_uses) return bad('That coupon has already been used.');
    const used = await D.prepare('SELECT 1 FROM premium_redeem WHERE code = ? AND uid = ?').bind(code, user.uid).first();
    if (used) return bad('You have already used this coupon.');
    const row = await access(env, user, false);
    const st = state(row, env);
    const base = Math.max(Date.now(), Date.parse(st.trial_end), row.premium_until ? Date.parse(row.premium_until) : 0);
    const until = iso(base + c.days * DAY);
    // count the use only if a use is still left (two members redeeming the last use at once: one wins)
    const u = await D.prepare('UPDATE premium_coupons SET uses = uses + 1 WHERE code = ? AND active = 1 AND (max_uses = 0 OR uses < max_uses)').bind(code).run();
    if (!u.meta?.changes) return bad('That coupon has already been used.');
    await D.batch([
      D.prepare('UPDATE premium_access SET premium_until = ?, coupon = ? WHERE uid = ?').bind(until, code, user.uid),
      D.prepare('INSERT INTO premium_redeem (code, uid, email, at, until) VALUES (?, ?, ?, ?, ?)').bind(code, user.uid, user.email, now, until),
    ]);
    const fresh = await D.prepare('SELECT * FROM premium_access WHERE uid = ?').bind(user.uid).first();
    return json({ ok: true, added_days: c.days, ...state(fresh, env) }, 200, origin);
  } catch (e) {
    return json({ error: 'Could not do that just now. Please try again.', detail: String(e.message || e).slice(0, 200) }, 503, origin);
  }
}
