// Admin > Analytics (Sagar 2026-11-24: "make a analytical tab in admin where week by week, m by m, we can check
// everything to track the performance of our terminal: how many people joined, how much time max people using, and
// lot of stats ... a proper tracking dashboard with charts and graphs").
//
// Sources (all read in the admin's browser, nothing new is published):
//   Firestore users      every member, joined (firstSeen) and last seen, device         -> growth, dormant, devices
//   Firestore logins     every page load of a signed-in member (deleted after 90 days)   -> active members before tracking
//   Firestore asks       Dalal questions (deleted after 90 days)
//   /api/track (D1)      time on the site by section, hour, visit, device, from 24-Nov-2026 (functions/api/track.js)
//   /api/premium, /api/quiz, /api/register   Discover trial, persona test, meet sign-ups
// Logins and asks are copied into this browser (localStorage) and only new rows are read on the next open, so the
// history survives the 90-day clean-up here and an open costs a few Firestore reads.
// All days are IST days. Charts are plain SVG, no library.

const S = { gran: 'week', range: 30, cache: {}, base: null, at: 0, busy: null };
const IST = 330 * 60000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayOf = (iso) => (iso ? new Date(Date.parse(iso) + IST).toISOString().slice(0, 10) : null);
const today = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const weekOf = (d) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return addDays(d, -((w + 6) % 7)); };
const monthOf = (d) => d.slice(0, 7);
const keyOf = (d, g) => (g === 'day' ? d : g === 'week' ? weekOf(d) : monthOf(d));
const SPAN = { day: 60, week: 26, month: 18 };
function periods(g) {
  const out = [], t = today();
  if (g === 'day') for (let i = SPAN.day - 1; i >= 0; i--) out.push(addDays(t, -i));
  else if (g === 'week') for (let i = SPAN.week - 1; i >= 0; i--) out.push(weekOf(addDays(t, -7 * i)));
  else { const [y, m] = t.split('-').map(Number); for (let i = SPAN.month - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(d.toISOString().slice(0, 7)); } }
  return out;
}
const pEnd = (p, g) => (g === 'day' ? p : g === 'week' ? addDays(p, 6) : addDays(new Date(Date.UTC(+p.slice(0, 4), +p.slice(5, 7), 1)).toISOString().slice(0, 10), -1));
function pLabel(p, g, long) {
  if (g === 'month') return `${MON[+p.slice(5, 7) - 1]} ${long ? p.slice(0, 4) : p.slice(2, 4)}`;
  const d = new Date(p + 'T00:00:00Z');
  return `${g === 'week' && long ? 'Week of ' : ''}${d.getUTCDate()} ${MON[d.getUTCMonth()]}${long ? ' ' + d.getUTCFullYear() : ''}`;
}
const mins = (s) => (s >= 3600 ? `${(s / 3600).toFixed(s >= 36000 ? 0 : 1)} h` : `${Math.round(s / 60)} min`);
const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* ---------------------------------------------------------------- loading */
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
// logins / asks: keep a copy here, read only what is newer than the newest row held
async function history(h, col) {
  const key = `skd.an.${col}.v1`;
  const held = lsGet(key) || { max: null, rows: [] };
  let fresh = [];
  for (let i = 0; i < 10; i++) {
    const part = await h.A.listSince(col, held.max, 5000);
    fresh = fresh.concat(part);
    if (part.length) held.max = part[part.length - 1].at;
    if (part.length < 5000) break;
  }
  const cut = new Date(Date.now() - 420 * 86400000).toISOString();
  held.rows = held.rows.concat(fresh.map((x) => (col === 'logins' ? [x.uid, x.at, x.device] : [x.uid, x.at, x.web ? 1 : 0]))).filter((r) => r[1] > cut);
  lsSet(key, held);
  return held.rows;
}
async function getJson(h, url) {
  const t = await h.A.idToken();
  const r = await fetch(url, { headers: t ? { Authorization: `Bearer ${t}` } : {}, signal: AbortSignal.timeout(25000) });
  return r.json().catch(() => ({ error: 'no answer' }));
}
const TRACK = location.hostname.endsWith('pages.dev') ? '/api/track' : 'https://street-ka-dalal.pages.dev/api/track';
async function loadAll(h, force) {
  if (h.A.state.demo) { if (!S.base || force) { S.base = demoData(); S.cache = { [S.range]: demoTrack(S.range) }; } else S.cache[S.range] ||= demoTrack(S.range); S.at = Date.now(); return; }
  if (!S.base || force || Date.now() - S.at > 10 * 60000) {
    const [members, logins, asks, prem, quiz, ...regs] = await Promise.all([
      h.A.listMembers(), history(h, 'logins').catch(() => []), history(h, 'asks').catch(() => []),
      h.premAdmin().catch(() => ({})), getJson(h, '/api/quiz').catch(() => ({})),
      ...h.REG_EVENTS.map(([ev]) => getJson(h, `/api/register?event=${ev}`).then((r) => ({ ev, rows: r.rows || [] })).catch(() => ({ ev, rows: [] }))),
    ]);
    S.base = { members, logins, asks, prem, quiz: quiz.rows || [], regs };
    S.cache = {};
    S.at = Date.now();
  }
  if (!S.cache[S.range] || force) S.cache[S.range] = await getJson(h, `${TRACK}?admin=1&days=${S.range}`).catch((e) => ({ error: e.message }));
}

/* ---------------------------------------------------------------- charts (plain SVG) */
const W = 640;
function bars(h, pts, { height = 190, colors = ['var(--green)'], names = [], fmt = (v) => h.num(v), line = null, lineName = '' } = {}) {
  // pts: [{label, long, v: [a, b, ...] stacked}]
  const n = pts.length; if (!n) return '<p class="sub">No data yet.</p>';
  const top = 16, bot = 26, left = 34, plotH = height - top - bot, bw = (W - left - 6) / n;
  const tot = pts.map((p) => p.v.reduce((s, x) => s + (x || 0), 0));
  const max = Math.max(1, ...tot, ...(line ? line.filter((x) => x != null) : []));
  const y = (v) => top + plotH - (v / max) * plotH;
  const step = Math.ceil(n / 12);
  const grid = [0, 0.5, 1].map((f) => `<line x1="${left}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}" style="stroke:var(--line)"/><text x="${left - 5}" y="${y(max * f) + 3}" text-anchor="end" class="an-ax">${fmt(Math.round(max * f * 10) / 10)}</text>`).join('');
  const rects = pts.map((p, i) => {
    let acc = 0;
    const x = left + i * bw + bw * 0.14, w = Math.max(1, bw * 0.72);
    const parts = p.v.map((v, j) => { if (!v) return ''; const r = `<rect x="${x}" y="${y(acc + v)}" width="${w}" height="${Math.max(0.5, (v / max) * plotH)}" rx="2" style="fill:${colors[j % colors.length]}"/>`; acc += v; return r; }).join('');
    const tip = `${p.long}: ${p.v.map((v, j) => `${names[j] || ''} ${fmt(v || 0)}`.trim()).join(', ')}${line && line[i] != null ? `, ${lineName} ${fmt(line[i])}` : ''}`;
    const lab = (i % step === 0 && n - 1 - i >= Math.max(1, step * 0.75)) || i === n - 1 ? `<text x="${x + w / 2}" y="${height - 8}" text-anchor="middle" class="an-ax">${p.label}</text>` : '';
    const val = n <= 14 && tot[i] ? `<text x="${x + w / 2}" y="${y(tot[i]) - 4}" text-anchor="middle" class="an-val">${fmt(tot[i])}</text>` : '';
    return `<g><title>${h.esc(tip)}</title><rect x="${left + i * bw}" y="${top}" width="${bw}" height="${plotH}" fill="transparent"/>${parts}${val}${lab}</g>`;
  }).join('');
  let path = '';
  if (line) {
    const xy = line.map((v, i) => (v == null ? null : [left + i * bw + bw / 2, y(v)]));
    const d = xy.reduce((s, p, i) => (p ? s + `${s && xy[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : s), '');
    path = `<path d="${d}" fill="none" style="stroke:var(--gold);stroke-width:2"/>${xy.map((p) => (p ? `<circle cx="${p[0]}" cy="${p[1]}" r="2.4" style="fill:var(--gold)"/>` : '')).join('')}`;
  }
  const legend = names.length > 1 || line ? `<div class="an-leg">${names.map((nm, j) => `<span><i style="background:${colors[j % colors.length]}"></i>${nm}</span>`).join('')}${line ? `<span><i style="background:var(--gold)"></i>${lineName}</span>` : ''}</div>` : '';
  return `${legend}<svg class="an-svg" viewBox="0 0 ${W} ${height}">${grid}${rects}${path}</svg>`;
}
function lineChart(h, pts, { height = 170, fmt = (v) => h.num(v), color = 'var(--green)' } = {}) {
  const n = pts.length; if (!n) return '<p class="sub">No data yet.</p>';
  const top = 14, bot = 26, left = 40, plotH = height - top - bot, bw = (W - left - 6) / Math.max(1, n - 1);
  const vals = pts.map((p) => p.v), max = Math.max(1, ...vals), min = Math.min(...vals) * 0.9;
  const y = (v) => top + plotH - ((v - min) / Math.max(1, max - min)) * plotH, x = (i) => left + i * bw;
  const step = Math.ceil(n / 12);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${d}L${x(n - 1)},${top + plotH}L${x(0)},${top + plotH}Z`;
  return `<svg class="an-svg" viewBox="0 0 ${W} ${height}">${[min, (min + max) / 2, max].map((v) => `<line x1="${left}" x2="${W}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${left - 5}" y="${y(v) + 3}" text-anchor="end" class="an-ax">${fmt(Math.round(v))}</text>`).join('')}
    <path d="${area}" style="fill:${color};opacity:.12"/><path d="${d}" fill="none" style="stroke:${color};stroke-width:2.2"/>
    ${pts.map((p, i) => `<g><title>${h.esc(`${p.long}: ${fmt(p.v)}`)}</title><circle cx="${x(i)}" cy="${y(p.v)}" r="${n > 40 ? 1.6 : 2.6}" style="fill:${color}"/><rect x="${x(i) - bw / 2}" y="${top}" width="${bw}" height="${plotH}" fill="transparent"/></g>${(i % step === 0 && n - 1 - i >= Math.max(1, step * 0.75)) || i === n - 1 ? `<text x="${x(i)}" y="${height - 8}" text-anchor="middle" class="an-ax">${p.label}</text>` : ''}`).join('')}</svg>`;
}
function hbars(h, rows, { fmt = (v) => h.num(v), sub = null, color = 'var(--green)', label = 170 } = {}) {
  if (!rows.length) return '<p class="sub">Nothing yet.</p>';
  const max = Math.max(1, ...rows.map((r) => r.v));
  return rows.map((r) => `<div class="an-hb" style="grid-template-columns:${label}px 1fr auto"><span title="${h.esc(r.label)}">${h.esc(r.label)}</span><span class="an-track"><i style="width:${(r.v / max) * 100}%;background:${r.color || color}"></i></span><b>${fmt(r.v)}${sub ? `<small>${sub(r)}</small>` : ''}</b></div>`).join('');
}
function heat(h, cells) {
  // cells[wd][hr] = average active people in that hour on that weekday
  const max = Math.max(0.0001, ...cells.flat());
  const order = [1, 2, 3, 4, 5, 6, 0];
  const hrs = Array.from({ length: 24 }, (_, i) => i);
  const hl = (i) => (i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`);
  return `<div class="an-heat"><span></span>${hrs.map((i) => `<span class="an-hh">${i % 3 === 0 ? hl(i) : ''}</span>`).join('')}
    ${order.map((wd) => `<span class="an-hd">${WD[wd]}</span>${hrs.map((hr) => { const v = cells[wd][hr]; return `<span class="an-hc" title="${WD[wd]} ${hl(hr)}m: ${v ? v.toFixed(1) : 0} people active on average" style="background:color-mix(in srgb, var(--green) ${v ? Math.round(10 + (v / max) * 90) : 0}%, var(--paper-2))"></span>`; }).join('')}`).join('')}</div>`;
}

/* ---------------------------------------------------------------- section names */
const SEC = {
  watch: 'Stock watch', screeners: 'Screeners', sectors: 'Groups', heatmap: 'Heatmap', discover: 'Discover', reels: 'Reels', premarket: 'Pre-market',
  market: 'Market', funds: 'Mutual funds', equity: 'Research', stocks: 'Research companies', results: 'Results', resplus: 'Results Plus', news: 'News', research: 'Prop. Research',
  library: 'Library', insights: 'Insights', post: 'Reading an insight', about: 'About us', landing: 'Landing page (signed out)', portfolio: 'Portfolio X-ray',
  stock: 'Stock pages', compare: 'Compare', quiz: 'Persona test', session: 'Meet sign-up page', admin: 'Admin',
};
const secName = (k) => {
  if (SEC[k]) return SEC[k];
  const [a, b] = k.split('/');
  if (a === 'library') return 'Library: reading a PDF';
  if (a === 'results' && b === 'co') return 'Results: company page';
  return `${SEC[a] || a}: ${String(b || '').replace(/-/g, ' ')}`;
};
const topOf = (k) => { const a = k.split('/')[0]; return a; };

/* ---------------------------------------------------------------- the numbers */
function build(h) {
  const B = S.base, T = S.cache[S.range] || {}, g = S.gran, ps = periods(g), t = today();
  const memByUid = new Map(B.members.map((m) => [m.uid, m]));
  const joinDay = new Map(B.members.map((m) => [m.uid, dayOf(m.firstSeen)]));
  // every (member, day) we know of: logins + tracked time
  const act = new Map(); // uid -> Set(days)
  const add = (u, d) => { if (!u || !d) return; let s = act.get(u); if (!s) act.set(u, (s = new Set())); s.add(d); };
  B.logins.forEach(([u, at]) => add(u, dayOf(at)));
  Object.entries(T.member_days || {}).forEach(([u, ds]) => ds.forEach((d) => add(u, d)));
  B.members.forEach((m) => { add(m.uid, dayOf(m.lastSeen)); add(m.uid, dayOf(m.firstSeen)); });
  const inP = new Map(ps.map((p) => [p, { joins: 0, active: new Set(), newA: 0, visitors: 0, msecs: 0, tracked: new Set(), visits: 0, vsecs: 0, asks: 0, askers: new Set(), quiz: 0, regs: 0, opens: 0 }]));
  const P = (d) => inP.get(keyOf(d, g));
  B.members.forEach((m) => { const d = joinDay.get(m.uid); const x = d && P(d); if (x) x.joins++; });
  act.forEach((days, u) => days.forEach((d) => { const x = P(d); if (x) x.active.add(u); }));
  inP.forEach((x, p) => { x.active.forEach((u) => { const j = joinDay.get(u); if (j && keyOf(j, g) === p) x.newA++; }); });
  (T.daily || []).forEach((r) => { const x = P(r.day); if (!x) return; x.msecs += r.msecs || 0; x.opens += r.views || 0; if (g === 'day') x.visitors = r.visitors; });
  Object.entries(T.member_days || {}).forEach(([u, ds]) => ds.forEach((d) => { const x = P(d); if (x) x.tracked.add(u); }));
  if (g !== 'day') ((g === 'week' ? T.anon_week : T.anon_month) || []).forEach((r) => { const x = inP.get(r.p); if (x) x.visitors = r.visitors; });
  (T.sess_daily || []).forEach((r) => { const x = P(r.day); if (x) { x.visits += r.n; x.vsecs += r.secs; } });
  B.asks.forEach(([u, at]) => { const x = P(dayOf(at)); if (x) { x.asks++; x.askers.add(u); } });
  B.quiz.forEach((q) => { const x = P(dayOf(q.created)); if (x) x.quiz++; });
  B.regs.forEach((r) => r.rows.forEach((q) => { const x = P(dayOf(q.created)); if (x) x.regs++; }));
  const total = ps.map((p) => B.members.filter((m) => joinDay.get(m.uid) && joinDay.get(m.uid) <= pEnd(p, g)).length);

  // headline numbers
  const within = (n) => { const from = addDays(t, -(n - 1)); let c = 0; act.forEach((ds) => { for (const d of ds) if (d >= from) { c++; break; } }); return c; };
  const dau = within(1), wau = within(7), mau = within(30);
  let dsum = 0; for (let i = 0; i < 30; i++) { const d = addDays(t, -i); act.forEach((ds) => { if (ds.has(d)) dsum++; }); }
  const joinedIn = (n) => B.members.filter((m) => joinDay.get(m.uid) >= addDays(t, -(n - 1))).length;
  const last7 = (T.daily || []).filter((r) => r.day >= addDays(t, -6));
  const md7 = Object.values(T.member_days || {}).reduce((s, ds) => s + ds.filter((d) => d >= addDays(t, -6)).length, 0);
  const avgDay = md7 ? last7.reduce((s, r) => s + (r.msecs || 0), 0) / md7 : 0;
  // came back: joined 8 to 90 days ago, active on a later day
  const cohort = B.members.filter((m) => { const j = joinDay.get(m.uid); return j && j <= addDays(t, -7) && j >= addDays(t, -90); });
  const cameBack = cohort.filter((m) => [...(act.get(m.uid) || [])].some((d) => d > joinDay.get(m.uid))).length;
  const dormant = B.members.filter((m) => !m.lastSeen || dayOf(m.lastSeen) < addDays(t, -30));
  const sl = T.sess_len || [], visits = sl.reduce((s, r) => s + r.n, 0), vsecs = sl.reduce((s, r) => s + r.secs, 0);

  // when: average active people per weekday x hour across the window
  const weeks = Math.max(1, Math.round(S.range / 7));
  const cells = Array.from({ length: 7 }, () => Array(24).fill(0));
  (T.hours || []).forEach((r) => { cells[r.wd][r.hr] = r.pd / (S.range >= 7 ? weeks : 1); });
  let peak = null; cells.forEach((row, wd) => row.forEach((v, hr) => { if (v && (!peak || v > peak.v)) peak = { wd, hr, v }; }));
  const byHour = Array(24).fill(0); (T.hours || []).forEach((r) => { byHour[r.hr] += r.secs; });

  // what: sections
  const tops = new Map(), subs = [], stocks = [];
  (T.sections || []).forEach((r) => {
    const tk = r.sec.startsWith('results/co') ? 'results' : topOf(r.sec);
    const x = tops.get(tk) || { k: tk, secs: 0, views: 0, people: 0 }; x.secs += r.secs; x.views += r.views; x.people = Math.max(x.people, r.people); tops.set(tk, x);
    if (r.sec.startsWith('stock/')) stocks.push({ sym: r.sec.slice(6), ...r });
    else if (r.sec.startsWith('results/co/')) stocks.push({ sym: r.sec.slice(11), ...r, res: true });
    else if (r.sec.includes('/')) subs.push(r);
  });
  const stockAgg = new Map(); stocks.forEach((s) => { const x = stockAgg.get(s.sym) || { sym: s.sym, views: 0, secs: 0, people: 0 }; x.views += s.views; x.secs += s.secs; x.people = Math.max(x.people, s.people); stockAgg.set(s.sym, x); });

  // usage groups: active days in the last 30
  const grp = [[1, 1, '1 day'], [2, 3, '2 to 3 days'], [4, 7, '4 to 7 days'], [8, 15, '8 to 15 days'], [16, 31, '16 days or more']].map(([lo, hi, l]) => {
    let c = 0; act.forEach((ds) => { const n = [...ds].filter((d) => d >= addDays(t, -29)).length; if (n >= lo && n <= hi) c++; }); return { label: l, v: c };
  });
  // weekly join cohorts: share active in week 0..7 after joining
  const cw = []; for (let i = 7; i >= 0; i--) cw.push(weekOf(addDays(t, -7 * i)));
  const cohorts = cw.map((wk) => {
    const ms = B.members.filter((m) => joinDay.get(m.uid) && weekOf(joinDay.get(m.uid)) === wk);
    const cols = []; for (let k = 0; k <= 7; k++) { const w = addDays(wk, 7 * k); if (w > t) { cols.push(null); continue; } const c = ms.filter((m) => [...(act.get(m.uid) || [])].some((d) => weekOf(d) === w && (k > 0 || d > joinDay.get(m.uid)))).length; cols.push(ms.length ? pc(c, ms.length) : null); }
    return { wk, n: ms.length, cols };
  });
  // devices: tracked visits in the window, plus every member's last device
  const devM = new Map(); B.members.forEach((m) => { const d = String(m.device || 'Unknown').split(' · ')[0]; devM.set(d, (devM.get(d) || 0) + 1); });
  // Dalal + features
  const asks30 = B.asks.filter(([, at]) => dayOf(at) >= addDays(t, -29));
  const prem = B.prem || {}, ac = prem.access || [];
  const people = (T.people || []).map((p) => { const m = memByUid.get(p.who) || {}; return { ...p, name: m.name || p.name || '(member)', email: m.email || p.email || '', joined: m.firstSeen, lastSeen: m.lastSeen || p.last, asks: B.asks.filter(([u, at]) => u === p.who && dayOf(at) >= T.from).length }; });

  return { ps, inP, total, dau, wau, mau, dsum, joinedIn, avgDay, cohort, cameBack, dormant, visits, vsecs, cells, peak, byHour, tops: [...tops.values()].sort((a, b) => b.secs - a.secs), subs, stockAgg: [...stockAgg.values()].sort((a, b) => b.views - a.views), grp, cohorts, devM, asks30, ac, prem, people, T, sl };
}

/* ---------------------------------------------------------------- the page */
export async function viewAnalytics(h) {
  try { await loadAll(h, false); } catch (e) { return `<div class="card empty">Could not load the analytics: ${h.esc(e.message)}</div>`; }
  const B = S.base, X = build(h), T = X.T, g = S.gran, esc = h.esc, num = h.num;
  // charts start one period before the first member joined (no long empty run on the left)
  const first = X.total.findIndex((v) => v > 0);
  if (first > 1) { X.ps = X.ps.slice(first - 1); X.total = X.total.slice(first - 1); }
  const pts = (f) => X.ps.map((p) => ({ label: pLabel(p, g), long: pLabel(p, g, true), v: f(X.inP.get(p), p) }));
  const gName = { day: 'day', week: 'week', month: 'month' }[g];
  const trackNote = T.error ? `<p class="notice">Time tracking could not be read: ${esc(T.error)}</p>`
    : !T.since ? '<p class="notice">Time tracking started on 24 Nov 2026 and has no visits yet. Time, sections, hours and visit numbers fill in from the first member visit.</p>'
    : `<p class="sub">Time on the site is counted since ${h.fDate(T.since)} (only while the page is on screen and in use; your own visits are not counted). Members joined, active members and Dalal questions go back further.</p>`;
  const card = (title, sub, inner, wide) => `<section class="card an-card${wide ? ' an-wide' : ''}"><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}${inner}</section>`;
  const stat = (v, l, s) => `<div><b>${v}</b><span>${l}</span>${s ? `<small class="an-s">${s}</small>` : ''}</div>`;
  const cur = X.inP.get(X.ps[X.ps.length - 1]), prev = X.inP.get(X.ps[X.ps.length - 2]);
  const chg = (a, b) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}% vs last ${gName}` : '');
  const online = T.online || [];
  const funnel = [
    { label: 'Members', v: B.members.length }, { label: 'Active in last 30 days', v: X.mau },
    { label: 'Opened Discover', v: X.prem.total || X.ac.length }, { label: 'Asked Dalal (30 days)', v: new Set(X.asks30.map((a) => a[0])).size },
    { label: 'Premium (coupon)', v: X.ac.filter((x) => x.mode === 'premium').length },
  ];
  const secRows = X.tops.filter((r) => r.k !== 'admin').map((r) => ({ label: secName(r.k), v: Math.round(r.secs / 60), r }));
  const table = (rows) => {
    const head = ['Period', 'Joined', 'Total members', 'Active members', 'New among active', 'Visitors (not signed in)', 'Hours on site', 'Min per active member', 'Visits', 'Avg visit', 'Dalal questions', 'Persona tests', 'Meet sign-ups'];
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map((x, i) => `<th class="${i ? 'r' : ''}">${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<td class="${i ? 'r' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const tableRows = X.ps.slice().reverse().map((p) => {
    const x = X.inP.get(p), i = X.ps.indexOf(p);
    return [pLabel(p, g, true), num(x.joins), num(X.total[i]), num(x.active.size), num(x.newA), num(x.visitors), (x.msecs / 3600).toFixed(1), x.tracked.size ? (x.msecs / 60 / x.tracked.size).toFixed(1) : '-', num(x.visits), x.visits ? mins(x.vsecs / x.visits) : '-', num(x.asks), num(x.quiz), num(x.regs)];
  });
  S.csv = [['Period', 'Joined', 'Total members', 'Active members', 'New among active', 'Visitors', 'Hours on site', 'Min per active member', 'Visits', 'Avg visit min', 'Dalal questions', 'Persona tests', 'Meet sign-ups'],
    ...X.ps.map((p, i) => { const x = X.inP.get(p); return [p, x.joins, X.total[i], x.active.size, x.newA, x.visitors, (x.msecs / 3600).toFixed(2), x.tracked.size ? (x.msecs / 60 / x.tracked.size).toFixed(1) : '', x.visits, x.visits ? (x.vsecs / x.visits / 60).toFixed(1) : '', x.asks, x.quiz, x.regs]; })];
  const LEN = ['Under 1 min', '1 to 5 min', '5 to 15 min', '15 to 30 min', '30 to 60 min', 'Over 1 hour'];

  return `${h.A.state.demo ? '<p class="notice">Local preview: these are made-up demo numbers. The live site shows the real ones.</p>' : ''}
  <div class="toolbar an-bar">
    <div class="seg">${[['day', 'Day by day'], ['week', 'Week by week'], ['month', 'Month by month']].map(([k, l]) => `<button class="${k === g ? 'on' : ''}" data-act="anGran" data-v="${k}">${l}</button>`).join('')}</div>
    <span class="sub">Breakdowns for</span><div class="seg">${[[1, 'Today'], [7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '1 year']].map(([k, l]) => `<button class="${k === S.range ? 'on' : ''}" data-act="anRange" data-v="${k}">${l}</button>`).join('')}</div>
    <span class="grow"></span><span class="sub">Read ${h.ago(new Date(S.at).toISOString())}</span><button class="btn sm" data-act="anRefresh">Refresh</button><button class="btn sm" data-act="anCsv">Download CSV</button>
  </div>
  ${trackNote}
  <div class="stats big an-stats">
    ${stat(num(B.members.length), 'members', `+${X.joinedIn(7)} this week, +${X.joinedIn(30)} in 30 days`)}
    ${stat(num(online.length), 'on the site now', online.length ? esc(online.slice(0, 4).map((o) => (o.who === 'visitor' ? 'a visitor' : (o.name || o.email || 'member').split(' ')[0])).join(', ')) + (online.length > 4 ? ' ...' : '') : 'last 5 minutes')}
    ${stat(num(X.dau), 'active today', `${num(X.wau)} in 7 days, ${num(X.mau)} in 30 days`)}
    ${stat(`${X.mau ? Math.round((X.dsum / 30 / X.mau) * 100) : 0}%`, 'stickiness (daily / monthly)', `about ${(X.dsum / 30).toFixed(1)} members a day`)}
    ${stat(X.avgDay ? mins(X.avgDay) : '-', 'per active member a day', 'average of the last 7 days')}
    ${stat(X.visits ? mins(X.vsecs / X.visits) : '-', 'average visit', `${num(X.visits)} visits in the window`)}
    ${stat(`${pc(X.cameBack, X.cohort.length)}%`, 'came back after day 1', `${X.cameBack} of ${X.cohort.length} who joined 1 week to 3 months ago`)}
    ${stat(num(X.dormant.length), 'not seen for 30+ days', `${pc(X.dormant.length, B.members.length)}% of members`)}
  </div>
  <div class="an-grid">
    ${card(`New members by ${gName}`, cur ? `${num(cur.joins)} this ${gName}. ${chg(cur.joins, prev?.joins || 0)}` : '', bars(h, pts((x) => [x.joins])))}
    ${card('Total members', `From ${num(X.total[0])} to ${num(X.total[X.total.length - 1])} over the chart.`, lineChart(h, X.ps.map((p, i) => ({ label: pLabel(p, g), long: pLabel(p, g, true), v: X.total[i] }))))}
    ${card(`Active members by ${gName}`, `Members who opened the site at least once. Green = came before, sand = joined that ${gName}. ${cur ? chg(cur.active.size, prev?.active.size || 0) : ''}`, bars(h, pts((x) => [x.active.size - x.newA, x.newA]), { colors: ['var(--green)', 'var(--sand)'], names: ['Returning', 'New'] }))}
    ${card(`Visitors not signed in by ${gName}`, 'Browsers that saw the landing page, Reels, the quiz or the meet page without signing in (from tracking start). Gold line = members who joined.', bars(h, pts((x) => [x.visitors]), { colors: ['var(--sky)'], names: ['Visitors'], line: X.ps.map((p) => X.inP.get(p).joins), lineName: 'Joined' }))}
    ${card(`Hours on the site by ${gName}`, 'All members together. Gold line = minutes per active member.', bars(h, pts((x) => [Math.round(x.msecs / 360) / 10]), { names: ['Hours'], line: X.ps.map((p) => { const x = X.inP.get(p); return x.tracked.size ? Math.round(x.msecs / 60 / x.tracked.size) : null; }), lineName: 'Min per member', fmt: (v) => num(v, v < 10 && v % 1 ? 1 : 0) }))}
    ${card(`Visits by ${gName}`, 'A visit ends after 30 minutes away. Gold line = average visit in minutes.', bars(h, pts((x) => [x.visits]), { colors: ['var(--green)'], names: ['Visits'], line: X.ps.map((p) => { const x = X.inP.get(p); return x.visits ? Math.round(x.vsecs / x.visits / 6) / 10 : null; }), lineName: 'Avg visit (min)', fmt: (v) => num(v, v % 1 ? 1 : 0) }))}
    ${card('When people use it', X.peak ? `Busiest: <b>${WD[X.peak.wd]} around ${X.peak.hr % 12 || 12} ${X.peak.hr < 12 ? 'AM' : 'PM'}</b> (${X.peak.v.toFixed(1)} people at once on average). Darker = more people. IST, ${S.range === 1 ? 'today' : `last ${S.range} days`}.` : 'Fills in after the first tracked visits.', heat(h, X.cells), true)}
    ${card('Time spent by hour of day', 'Total minutes in each IST hour over the window.', bars(h, X.byHour.map((s, i) => ({ label: `${i % 12 || 12}${i < 12 ? 'a' : 'p'}`, long: `${i % 12 || 12} ${i < 12 ? 'AM' : 'PM'}`, v: [Math.round(s / 60)] })), { names: ['Minutes'] }))}
    ${card('How long a visit lasts', `${num(X.visits)} visits in the window.`, hbars(h, LEN.map((l, b) => { const r = X.sl.find((x) => x.b === b); return { label: l, v: r?.n || 0 }; }), { sub: (r) => ` ${pc(r.v, X.visits)}%`, label: 120 }))}
    ${card('What they use most', 'Minutes spent in each part of the site; people = how many different people opened it.', hbars(h, secRows.slice(0, 18), { fmt: (v) => mins(v * 60), sub: (r) => ` · ${num(r.r.views)} opens · ${num(r.r.people)} people` }), true)}
    ${card('Inside Discover, Results Plus and others', 'Sub-pages by opens.', hbars(h, X.subs.filter((r) => !r.sec.startsWith('admin')).sort((a, b) => b.views - a.views).slice(0, 15).map((r) => ({ label: secName(r.sec), v: r.views, r })), { sub: (r) => ` opens · ${mins(r.r.secs)}`, color: 'var(--sky)', label: 210 }))}
    ${card('Stocks opened most', 'Stock pages and Results company pages together.', hbars(h, X.stockAgg.slice(0, 15).map((s) => ({ label: s.sym, v: s.views, s })), { sub: (r) => ` opens · ${num(r.s.people)} people`, color: 'var(--gold)', label: 120 }))}
    ${card('How often members come (last 30 days)', `Of the ${num(X.mau)} members active in the last 30 days, how many different days each came.`, hbars(h, X.grp, { sub: (r) => ` ${pc(r.v, X.mau)}%`, label: 130 }))}
    ${card('From member to power user', 'Each step is a share of all members.', hbars(h, funnel, { sub: (r) => ` ${pc(r.v, B.members.length)}%`, color: 'var(--green)', label: 170 }))}
    ${card('Devices', 'Bars = visits in the window by device (tracked). Below: every member\'s last device.', `${hbars(h, (T.devices || []).map((d) => ({ label: d.dev, v: d.sessions, d })), { sub: (r) => ` visits · ${num(r.d.people)} people`, label: 90 })}<p class="sub" style="margin-top:10px">${[...X.devM.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${esc(d)} ${n}`).join(' · ')}</p>`)}
    ${card(`Dalal questions by ${gName}`, `${num(X.asks30.length)} questions from ${num(new Set(X.asks30.map((a) => a[0])).size)} members in the last 30 days. Gold line = members asking.`, bars(h, pts((x) => [x.asks]), { colors: ['var(--plum, var(--green))'], names: ['Questions'], line: X.ps.map((p) => X.inP.get(p).askers.size), lineName: 'Members asking' }))}
    ${card(`Persona test and meet sign-ups by ${gName}`, `${num(B.quiz.length)} persona tests and ${num(B.regs.reduce((s, r) => s + r.rows.length, 0))} meet sign-ups in all (${B.regs.map((r) => `${r.ev} ${r.rows.length}`).join(', ')}).`, bars(h, pts((x) => [x.quiz, x.regs]), { colors: ['var(--gold)', 'var(--sky)'], names: ['Persona tests', 'Meet sign-ups'] }))}
    ${card('Do new members come back? (weekly groups)', 'Each row = members who joined that week. Columns = share who came back in week 0 (after their first day), 1, 2 ... after joining.', `<div class="tbl-wrap"><table class="tbl an-coh"><thead><tr><th>Joined week</th><th class="r">Joined</th>${Array.from({ length: 8 }, (_, k) => `<th class="r">Wk ${k}</th>`).join('')}</tr></thead><tbody>${X.cohorts.map((c) => `<tr><td>${pLabel(c.wk, 'week')}</td><td class="r">${c.n}</td>${c.cols.map((v) => `<td class="r" style="${v != null && c.n ? `background:color-mix(in srgb, var(--green) ${Math.round(v * 0.8)}%, transparent)` : ''}">${v == null || !c.n ? '' : v + '%'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`, true)}
  </div>
  <section class="card flush"><div class="card-head pad"><h2>Who uses it most</h2><span class="sub">${S.range === 1 ? 'Today' : `Last ${S.range} days`}, by time on the site (from tracking start)</span></div>
    ${h.table('anPeople', X.people, [
      { k: 'name', label: 'Member', fmt: (p) => `<b>${esc(p.name)}</b><span class="sub">${esc(p.email)}</span>` },
      { k: 'secs', label: 'Time', fmt: (p) => mins(p.secs), cls: 'r' }, { k: 'days', label: 'Days came', cls: 'r' }, { k: 'sessions', label: 'Visits', cls: 'r' },
      { k: 'views', label: 'Pages opened', cls: 'r' }, { k: 'asks', label: 'Dalal Qs', cls: 'r' }, { k: 'dev', label: 'Device', fmt: (p) => esc(p.dev || '-') },
      { k: 'joined', label: 'Joined', fmt: (p) => h.fDate(dayOf(p.joined)) }, { k: 'lastSeen', label: 'Last seen', fmt: (p) => h.ago(p.lastSeen) },
    ], 'No tracked visits in this window yet.')}</section>
  <section class="card flush"><div class="card-head pad"><h2>${gName[0].toUpperCase() + gName.slice(1)} by ${gName}: every number</h2><span class="sub">Newest first. Download CSV for the same table.</span></div>${table(tableRows)}</section>
  <section class="card flush"><div class="card-head pad"><h2>Members not seen for 30+ days</h2><span class="sub">${num(X.dormant.length)} members. People to bring back with a WhatsApp note or a meet invite.</span></div>
    ${h.table('anDormant', X.dormant.map((m) => ({ ...m, ls: m.lastSeen || '' })), [
      { k: 'name', label: 'Member', fmt: (m) => `<b>${esc(m.name)}</b><span class="sub">${esc(m.email)}</span>` },
      { k: 'firstSeen', label: 'Joined', fmt: (m) => h.fDate(dayOf(m.firstSeen)) }, { k: 'ls', label: 'Last seen', fmt: (m) => `${h.fDate(dayOf(m.lastSeen))}<span class="sub">${h.ago(m.lastSeen)}</span>` },
      { k: 'visits', label: 'Visits', cls: 'r' }, { k: 'device', label: 'Device', fmt: (m) => esc(m.device || '-') },
    ], 'Everyone came in the last 30 days.')}</section>`;
}

export const anActs = (h, render) => ({
  anGran: (el) => { S.gran = el.dataset.v; render(); },
  anRange: (el) => { S.range = +el.dataset.v; render(); },
  anRefresh: async () => { h.toast('Reading fresh numbers ...'); try { await loadAll(h, true); } catch {} render(); },
  anCsv: () => {
    const csv = (S.csv || []).map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `skd-analytics-${S.gran}-${today()}.csv` }).click();
  },
});

/* ---------------------------------------------------------------- demo numbers for the local preview only */
function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function demoData() {
  const r = rnd(7), t = today(), members = [], logins = [], asks = [];
  const devs = ['Android · Chrome', 'iPhone/iPad · Safari', 'Windows · Chrome', 'Mac · Safari'];
  for (let i = 0; i < 180; i++) {
    const j = addDays(t, -Math.floor(r() * r() * 150));
    const keen = r();
    const uid = `u${i}`;
    let last = j;
    for (let d = j; d <= t; d = addDays(d, 1)) if (r() < keen * 0.45) { logins.push([uid, `${d}T${String(3 + Math.floor(r() * 15)).padStart(2, '0')}:10:00.000Z`, devs[i % 4]]); last = d; if (r() < 0.15) asks.push([uid, `${d}T10:00:00.000Z`, 0]); }
    members.push({ uid, name: `Member ${i + 1}`, email: `member${i + 1}@example.com`, firstSeen: `${j}T06:00:00.000Z`, lastSeen: `${last}T12:00:00.000Z`, visits: 1 + Math.floor(keen * 40), device: devs[i % 4] });
  }
  return { members, logins, asks, prem: { total: 60, access: Array.from({ length: 60 }, (_, i) => ({ mode: i < 4 ? 'premium' : i < 50 ? 'trial' : 'expired' })) }, quiz: Array.from({ length: 70 }, (_, i) => ({ created: `${addDays(t, -Math.floor(r() * 40))}T08:00:00.000Z` })), regs: [{ ev: 'meet-4', rows: Array.from({ length: 45 }, () => ({ created: `${addDays(t, -10 - Math.floor(r() * 9))}T08:00:00.000Z` })) }] };
}
function demoTrack(days) {
  const r = rnd(11), t = today(), since = addDays(t, -40), from = addDays(t, -(days - 1));
  const daily = [], sess = [], md = {}, hours = [], secs = {};
  for (let d = since; d <= t; d = addDays(d, 1)) {
    const m = 20 + Math.floor(r() * 25);
    daily.push({ day: d, members: m, visitors: 10 + Math.floor(r() * 30), msecs: m * (300 + r() * 900), secs: 0, views: m * 12 });
    sess.push({ day: d, n: Math.round(m * 1.6), secs: m * (300 + r() * 900) });
    for (let k = 0; k < m; k++) (md[`u${Math.floor(r() * 120)}`] ||= []).push(d);
  }
  for (let wd = 0; wd < 7; wd++) for (let hr = 0; hr < 24; hr++) { const base = hr >= 8 && hr <= 23 ? (hr >= 20 ? 8 : hr === 9 || hr === 16 ? 6 : 3) : 0.3; hours.push({ wd, hr, secs: base * 3000 * r(), pd: base * (days / 7) * (0.5 + r()) }); }
  ['watch', 'screeners', 'sectors', 'discover/investors', 'discover/valuation', 'reels', 'market', 'results', 'resplus/season', 'news', 'stock/RELIANCE', 'stock/TATAMOTORS', 'stock/HAL', 'results/co/INFY', 'library/read', 'landing'].forEach((k, i) => { secs[k] = { sec: k, secs: Math.round((16 - i) * 4000 * r() * days / 30), views: Math.round((16 - i) * 30 * r() * days / 30) + 1, people: 5 + Math.floor(r() * 40), members: 5 }; });
  return { ok: true, since, from, days, daily, anon_week: [], anon_month: [], sess_daily: sess, sections: Object.values(secs), hours, sess_len: [0, 1, 2, 3, 4, 5].map((b) => ({ b, n: Math.round([30, 55, 40, 20, 9, 3][b] * days / 7), secs: [30, 180, 600, 1300, 2600, 5000][b] * [30, 55, 40, 20, 9, 3][b] })), people: Array.from({ length: 25 }, (_, i) => ({ who: `u${i}`, secs: Math.round(20000 / (i + 1)), days: 20 - Math.floor(i / 2), views: 300 - i * 9, sessions: 30 - i, dev: ['Android', 'iPhone', 'Windows'][i % 3], last: new Date().toISOString() })), devices: [{ dev: 'Android', people: 60, sessions: 300, secs: 1 }, { dev: 'Windows', people: 25, sessions: 140, secs: 1 }, { dev: 'iPhone', people: 15, sessions: 70, secs: 1 }], online: [{ who: 'u1', name: 'Member 2' }, { who: 'visitor' }], member_days: md };
}
