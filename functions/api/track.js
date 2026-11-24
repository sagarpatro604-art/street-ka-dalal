// Usage tracking for Admin > Analytics (Sagar 2026-11-24: "make a analytical tab in admin where week by week, m by m,
// we can check everything to track the performance of our terminal: how many people joined, how much time ...").
//
//   POST /api/track            a browser's time on the site since its last send (js/track.js, every 2 min and on leaving)
//                              body { cid, sid, dev, beats: { "<section>": [seconds, opens] } }, optional Bearer token
//   GET  /api/track?admin=1&days=N   admin: every number the Analytics tab draws (see report())
//   GET  /api/track?health=1   is the database there
//
// Time counts only while the page is on screen AND the person did something in the last 2 minutes (5 on Reels),
// so a tab left open all night adds nothing. The admin's own use is never stored (his browser is remembered and dropped).
//
// D1 (binding DALAL_DB):
//   ux_day   day, who, sec, secs, views         one row per person, day (IST) and section
//   ux_hour  day, hr, who, secs                 active seconds per IST hour (for the weekday x hour picture)
//   ux_sess  sid, who, day, start, last, secs, views, dev   one row per visit (a new one after 30 min away)
//   ux_who   who, uid, email, name, member, dev, first, last
//   ux_cid   cid -> uid: a browser seen signed in once counts as that member on pages without sign-in (Reels, quiz)
//   ux_ip    calls per network per day (IP kept only as a daily hash)
// who = the Firebase uid for a member, 'a:<browser id>' for a visitor who never signed in on that browser.
import { json, cors, who as signedIn, isAdmin, within, istDate, sha } from '../../lib/hz_common.js';

const ADMIN_CID = '__admin';
const MAX_SECS = 200;       // one send covers about 2 minutes; anything bigger is cut
const IP_DAY = 4000;        // sends a network may make in a day
let ready = null;
function tables(env) {
  if (!env.DALAL_DB) return Promise.reject(new Error('no database'));
  const D = env.DALAL_DB;
  ready ||= D.batch([
    D.prepare('CREATE TABLE IF NOT EXISTS ux_day (day TEXT NOT NULL, who TEXT NOT NULL, sec TEXT NOT NULL, secs INTEGER DEFAULT 0, views INTEGER DEFAULT 0, PRIMARY KEY (day, who, sec))'),
    D.prepare('CREATE TABLE IF NOT EXISTS ux_hour (day TEXT NOT NULL, hr INTEGER NOT NULL, who TEXT NOT NULL, secs INTEGER DEFAULT 0, PRIMARY KEY (day, hr, who))'),
    D.prepare('CREATE TABLE IF NOT EXISTS ux_sess (sid TEXT PRIMARY KEY, who TEXT, day TEXT, start TEXT, last TEXT, secs INTEGER DEFAULT 0, views INTEGER DEFAULT 0, dev TEXT)'),
    D.prepare('CREATE INDEX IF NOT EXISTS ux_sess_day ON ux_sess (day)'),
    D.prepare('CREATE INDEX IF NOT EXISTS ux_sess_last ON ux_sess (last)'),
    D.prepare('CREATE TABLE IF NOT EXISTS ux_who (who TEXT PRIMARY KEY, uid TEXT, email TEXT, name TEXT, member INTEGER, dev TEXT, first TEXT, last TEXT)'),
    D.prepare('CREATE TABLE IF NOT EXISTS ux_cid (cid TEXT PRIMARY KEY, uid TEXT)'),
    D.prepare('CREATE TABLE IF NOT EXISTS ux_ip (k TEXT PRIMARY KEY, n INTEGER, day TEXT)'),
  ]).then(() => D).catch((e) => { ready = null; throw e; });
  return within(ready, 5000);
}

const clean = (s, n) => String(s || '').replace(/[^A-Za-z0-9/_&.\-]/g, '').slice(0, n);
const istHour = () => new Date(Date.now() + 330 * 60000).getUTCHours();

async function record(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400, origin); }
  const cid = clean(body.cid, 40), sid = clean(body.sid, 40);
  if (cid.length < 8 || sid.length < 8) return json({ error: 'no browser id' }, 400, origin);
  const beats = Object.entries(body.beats || {}).slice(0, 25)
    .map(([k, v]) => [clean(k, 60) || 'other', Math.max(0, Math.min(MAX_SECS, Math.round(+v?.[0] || 0))), Math.max(0, Math.min(50, Math.round(+v?.[1] || 0)))])
    .filter(([, s, v]) => s > 0 || v > 0);
  if (!beats.length) return json({ ok: true, kept: 0 }, 200, origin);
  // cap the whole send too (one send = about 2 minutes of one tab)
  let room = MAX_SECS;
  for (const b of beats) { b[1] = Math.min(b[1], room); room -= b[1]; }
  const dev = clean(body.dev, 20) || 'Other';

  const d = await tables(env);
  const day = istDate(), now = new Date().toISOString();
  const iph = await sha(`${request.headers.get('CF-Connecting-IP') || ''}|${day}`);
  const seen = await within(d.prepare('SELECT n FROM ux_ip WHERE k = ?').bind(iph).first(), 4000).catch(() => null);
  if ((seen?.n || 0) >= IP_DAY) return json({ ok: true, kept: 0, limit: true }, 200, origin);

  const user = await signedIn(request, env).catch(() => null);
  const stmts = [d.prepare('INSERT INTO ux_ip (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(iph, day)];
  let w, member = 0, email = '', name = '';
  if (user && isAdmin(user)) {
    // the admin's own use is not counted: remember this browser so its signed-out pages are dropped too
    await within(d.batch([...stmts, d.prepare('INSERT INTO ux_cid (cid, uid) VALUES (?, ?) ON CONFLICT(cid) DO UPDATE SET uid = excluded.uid').bind(cid, ADMIN_CID)]), 5000);
    return json({ ok: true, kept: 0, admin: true }, 200, origin);
  }
  if (user) {
    w = user.uid; member = 1; email = user.email; name = user.name;
    stmts.push(d.prepare('INSERT INTO ux_cid (cid, uid) VALUES (?, ?) ON CONFLICT(cid) DO UPDATE SET uid = excluded.uid').bind(cid, user.uid));
  } else {
    const m = await within(d.prepare('SELECT uid FROM ux_cid WHERE cid = ?').bind(cid).first(), 4000).catch(() => null);
    if (m?.uid === ADMIN_CID) return json({ ok: true, kept: 0, admin: true }, 200, origin);
    if (m?.uid) { w = m.uid; member = 1; } else w = `a:${cid}`;
  }
  const secs = beats.reduce((s, b) => s + b[1], 0), views = beats.reduce((s, b) => s + b[2], 0);
  for (const [sec, s, v] of beats) {
    stmts.push(d.prepare('INSERT INTO ux_day (day, who, sec, secs, views) VALUES (?, ?, ?, ?, ?) ON CONFLICT(day, who, sec) DO UPDATE SET secs = secs + excluded.secs, views = views + excluded.views').bind(day, w, sec, s, v));
  }
  if (secs) stmts.push(d.prepare('INSERT INTO ux_hour (day, hr, who, secs) VALUES (?, ?, ?, ?) ON CONFLICT(day, hr, who) DO UPDATE SET secs = secs + excluded.secs').bind(day, istHour(), w, secs));
  stmts.push(d.prepare('INSERT INTO ux_sess (sid, who, day, start, last, secs, views, dev) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sid) DO UPDATE SET last = excluded.last, secs = secs + excluded.secs, views = views + excluded.views, who = excluded.who')
    .bind(sid, w, day, now, now, secs, views, dev));
  // a member's name / email are kept only when the token says so; a cid-matched visit leaves them as they were
  stmts.push(member && email
    ? d.prepare('INSERT INTO ux_who (who, uid, email, name, member, dev, first, last) VALUES (?, ?, ?, ?, 1, ?, ?, ?) ON CONFLICT(who) DO UPDATE SET email = excluded.email, name = excluded.name, member = 1, dev = excluded.dev, last = excluded.last').bind(w, w, email, name, dev, now, now)
    : d.prepare('INSERT INTO ux_who (who, uid, email, name, member, dev, first, last) VALUES (?, ?, \'\', \'\', ?, ?, ?, ?) ON CONFLICT(who) DO UPDATE SET dev = excluded.dev, last = excluded.last').bind(w, member ? w : '', member, dev, now, now));
  await within(d.batch(stmts), 6000);
  if (Math.random() < 0.02) d.prepare('DELETE FROM ux_ip WHERE day < ?').bind(day).run().catch(() => {});
  return json({ ok: true, kept: secs }, 200, origin);
}

// Monday of the IST week a 'YYYY-MM-DD' day falls in, in SQL
const WEEK = "date(day, '-' || ((CAST(strftime('%w', day) AS INTEGER) + 6) % 7) || ' days')";
export async function report(env, days) {
  const d = await tables(env);
  const from = new Date(Date.now() + 330 * 60000 - (days - 1) * 86400000).toISOString().slice(0, 10);
  const q = (sql, ...b) => within(d.prepare(sql).bind(...b).all(), 9000).then((r) => r.results || []);
  const first = await within(d.prepare('SELECT MIN(day) AS d FROM ux_day').first(), 6000);
  const since = first?.d || null;
  const anonBy = (g) => q(`SELECT ${g} AS p, COUNT(DISTINCT who) AS visitors FROM ux_day WHERE who LIKE 'a:%' GROUP BY p ORDER BY p`);
  const [daily, anonW, anonM, sessDaily, sections, hours, sessLen, people, devices, online, md] = await Promise.all([
    // every day since tracking began: members, visitors, time, opens
    q("SELECT day, COUNT(DISTINCT CASE WHEN who NOT LIKE 'a:%' THEN who END) AS members, COUNT(DISTINCT CASE WHEN who LIKE 'a:%' THEN who END) AS visitors, SUM(CASE WHEN who NOT LIKE 'a:%' THEN secs ELSE 0 END) AS msecs, SUM(secs) AS secs, SUM(views) AS views FROM ux_day GROUP BY day ORDER BY day"),
    anonBy(WEEK), anonBy('substr(day, 1, 7)'),
    q('SELECT day, COUNT(*) AS n, SUM(secs) AS secs FROM ux_sess WHERE secs > 0 GROUP BY day ORDER BY day'),
    // the chosen window: what they use, when, how long a visit lasts, who uses it most, on what
    q("SELECT sec, SUM(secs) AS secs, SUM(views) AS views, COUNT(DISTINCT who) AS people, COUNT(DISTINCT CASE WHEN who NOT LIKE 'a:%' THEN who END) AS members FROM ux_day WHERE day >= ? GROUP BY sec ORDER BY secs DESC LIMIT 400", from),
    q("SELECT CAST(strftime('%w', day) AS INTEGER) AS wd, hr, SUM(secs) AS secs, COUNT(DISTINCT day || who) AS pd FROM ux_hour WHERE day >= ? GROUP BY wd, hr", from),
    q("SELECT CASE WHEN secs < 60 THEN 0 WHEN secs < 300 THEN 1 WHEN secs < 900 THEN 2 WHEN secs < 1800 THEN 3 WHEN secs < 3600 THEN 4 ELSE 5 END AS b, COUNT(*) AS n, SUM(secs) AS secs FROM ux_sess WHERE day >= ? AND secs > 0 GROUP BY b", from),
    q("SELECT x.who, w.email, w.name, w.member, w.dev, w.first, w.last, x.secs, x.days, x.views, (SELECT COUNT(*) FROM ux_sess s WHERE s.who = x.who AND s.day >= ? AND s.secs > 0) AS sessions FROM (SELECT who, SUM(secs) AS secs, COUNT(DISTINCT day) AS days, SUM(views) AS views FROM ux_day WHERE day >= ? AND who NOT LIKE 'a:%' GROUP BY who) x LEFT JOIN ux_who w ON w.who = x.who ORDER BY x.secs DESC LIMIT 1000", from, from),
    q("SELECT dev, COUNT(DISTINCT who) AS people, COUNT(*) AS sessions, SUM(secs) AS secs FROM ux_sess WHERE day >= ? AND secs > 0 GROUP BY dev ORDER BY people DESC", from),
    q("SELECT s.who, w.name, w.email, w.member, s.last, s.dev FROM ux_sess s LEFT JOIN ux_who w ON w.who = s.who WHERE s.last > ? ORDER BY s.last DESC LIMIT 200", new Date(Date.now() - 5 * 60000).toISOString()),
    // member x day pairs (all time, at most 400 days back) for weekly / monthly distinct members and comeback cohorts
    q("SELECT who, GROUP_CONCAT(day) AS days FROM (SELECT DISTINCT who, day FROM ux_day WHERE who NOT LIKE 'a:%' AND day >= date('now', '-400 days')) GROUP BY who"),
  ]);
  const onlineWho = new Map(); online.forEach((o) => { if (!onlineWho.has(o.who)) onlineWho.set(o.who, o); });
  return {
    ok: true, since, from, days, now: new Date().toISOString(),
    daily, anon_week: anonW, anon_month: anonM, sess_daily: sessDaily, sections, hours, sess_len: sessLen, people, devices,
    online: [...onlineWho.values()].map((o) => ({ who: o.who.startsWith('a:') ? 'visitor' : o.who, name: o.name || '', email: o.email || '', last: o.last, dev: o.dev })),
    member_days: Object.fromEntries(md.map((r) => [r.who, String(r.days || '').split(',').filter(Boolean)])),
  };
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  try {
    if (request.method === 'POST') return await record(request, env, origin);
    const url = new URL(request.url);
    if (url.searchParams.has('health')) {
      const d = await tables(env);
      const [c, s] = await Promise.all([
        within(d.prepare('SELECT COUNT(*) AS n, MIN(day) AS since FROM ux_day').first(), 4000),
        within(d.prepare('SELECT MAX(last) AS last, SUM(CASE WHEN day = ? THEN 1 ELSE 0 END) AS today FROM ux_sess').bind(istDate()).first(), 4000),
      ]);
      // read by ~/.claude/tools/dalal_watch.py (hourly): a note when no visit has been counted for 24 hours
      return json({ ok: true, db: true, rows: c?.n ?? 0, since: c?.since || null, last: s?.last || null, visits_today: s?.today || 0 }, 200, origin);
    }
    const user = await signedIn(request, env);
    if (!isAdmin(user)) return json({ error: 'admin only' }, 403, origin);
    const days = Math.max(1, Math.min(400, +url.searchParams.get('days') || 30));
    return json(await report(env, days), 200, origin);
  } catch (e) {
    return json({ error: e.message || 'failed' }, 500, origin);
  }
}
