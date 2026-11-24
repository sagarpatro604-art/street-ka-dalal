// Test of functions/api/track.js (Admin > Analytics counter) on a real SQLite (node:sqlite, Node 22.5+) dressed as D1.
// Run: node tests/test_track.mjs   (prints the rows it stored, then 'N passed, 0 failed')
import { DatabaseSync } from 'node:sqlite';

const mod = await import(new URL('../functions/api/track.js', import.meta.url).href);
const db = new DatabaseSync(':memory:');
const stmt = (sql) => ({ sql, args: [], bind(...a) { return { ...this, args: a }; },
  async first() { return db.prepare(this.sql).get(...this.args) ?? null; },
  async all() { return { results: db.prepare(this.sql).all(...this.args) }; },
  async run() { db.prepare(this.sql).run(...this.args); return { meta: {} }; } });
const D1 = { prepare: (s) => stmt(s), async batch(list) { db.exec('BEGIN'); try { for (const s of list) db.prepare(s.sql).run(...s.args); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return []; } };
const env = { DALAL_DB: D1 };
const post = (body, ip = '1.2.3.4') => mod.onRequest({ env, request: new Request('https://x/api/track', { method: 'POST', headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }).then((r) => r.json());
let ok = 0, bad = 0; const check = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
// two anonymous visitors, one sends twice in the same visit
check((await post({ cid: 'aaaaaaaaaa1', sid: 'ssssssss1', dev: 'Android', beats: { landing: [60, 1], reels: [30, 2] } })).kept === 90, 'first send kept 90 s');
check((await post({ cid: 'aaaaaaaaaa1', sid: 'ssssssss1', dev: 'Android', beats: { landing: [500, 1] } })).kept === 200, 'one send capped at 200 s');
check((await post({ cid: 'bbbbbbbbbb2', sid: 'ssssssss2', dev: 'Windows', beats: { 'stock/RELIANCE': [40, 1], 'x<script>': [10, 0] } })).kept === 50, 'second visitor');
check((await post({ cid: 'short', sid: 'ssssssss3', beats: { a: [5, 0] } })).error, 'short browser id refused');
check((await post({ cid: 'cccccccccc3', sid: 'ssssssss4', beats: { a: [0, 0] } })).kept === 0, 'empty send stores nothing');
// a browser the admin used: its signed-out pages are dropped
db.prepare("INSERT INTO ux_cid (cid, uid) VALUES ('dddddddddd4', '__admin')").run();
check((await post({ cid: 'dddddddddd4', sid: 'ssssssss5', beats: { reels: [60, 1] } })).admin, 'admin browser dropped');
// a browser once signed in counts as that member
db.prepare("INSERT INTO ux_cid (cid, uid) VALUES ('eeeeeeeeee5', 'uid-member-1')").run();
await post({ cid: 'eeeeeeeeee5', sid: 'ssssssss6', dev: 'iPhone', beats: { reels: [100, 3] } });
const rows = db.prepare('SELECT who, sec, secs, views FROM ux_day ORDER BY who, sec').all();
console.log(rows);
check(rows.find((r) => r.who === 'a:aaaaaaaaaa1' && r.sec === 'landing').secs === 60 + 200, 'landing seconds add up across sends');
check(rows.some((r) => r.sec === 'xscript'), 'section name cleaned');
check(!rows.some((r) => r.who.includes('dddd')), 'nothing stored for the admin browser');
check(rows.some((r) => r.who === 'uid-member-1' && r.secs === 100), 'cid matched to member');
const sess = db.prepare('SELECT * FROM ux_sess ORDER BY sid').all(); console.log(sess);
check(sess.find((s) => s.sid === 'ssssssss1').secs === 290, 'visit seconds add up');
const rep = await mod.report(env, 30);
console.log(JSON.stringify(rep, null, 1).slice(0, 2500));
check(rep.daily.length === 1 && rep.daily[0].members === 1 && rep.daily[0].visitors === 2, 'daily members / visitors');
check(rep.daily[0].msecs === 100, 'member seconds only members');
check(rep.member_days['uid-member-1']?.length === 1, 'member days');
check(rep.people.length === 1 && rep.people[0].sessions === 1, 'people with visits');
check(rep.anon_week.length === 1 && rep.anon_week[0].visitors === 2, 'weekly visitors');
check(rep.hours.length === 1, 'hour rows');
check(rep.online.length >= 2, 'online now');
// health + admin refusal without a token
const h = await (await mod.onRequest({ env, request: new Request('https://x/api/track?health=1') })).json(); check(h.ok && h.rows > 0, 'health');
const a = await mod.onRequest({ env, request: new Request('https://x/api/track?admin=1') }); check(a.status === 403, 'admin report needs the admin');
console.log(`${ok} passed, ${bad} failed`); process.exit(bad ? 1 : 0);
