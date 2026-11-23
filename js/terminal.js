// One screen, four doors (Sagar 2026-11-21: "when i will click screener, like everything i want to see as stock watch";
// "keep two doors"): Stock watch (#/, your lists), Screeners (#/screeners, the scans), Groups (#/sectors, sectors /
// industries / themes) and Discover (#/discover, Discovery Desk lists) all open this same layout:
//   left   the door's menu: folders of lists, each with its count today
//   middle the stocks of the open list: last, change, the number that matters for that list, RS; filters; list or grid
//   right  the open stock: chart, one strip of numbers, details in tabs (or 4 / 9 small charts in grid view)
// Also here: the market heatmap (#/heatmap) and compare two stocks (#/compare/A/B).
// Facts only: no buy / sell words, no entry / stop / target anywhere (SEBI). A list shows what fired or moved.

import * as CH from './charts.js';
import * as SC from './scan.js';

let H = null; // helpers from app.js
export function setHelpers(h) { H = h; SC.setHelpers(h); }
const $ = (s, r = document) => r.querySelector(s);
const KEYS = { watch: 'skd.term', scan: 'skd.sterm', groups: 'skd.gterm', discover: 'skd.dterm' };
const DOOR_TITLE = { watch: 'Stock watch', scan: 'Screeners', groups: 'Groups', discover: 'Discover' };
const DOOR_ROUTE = { watch: '#/', scan: '#/screeners', groups: '#/sectors', discover: '#/discover' };
let MODE = 'watch';
const BASE = { sym: '', tf: 'D', sort: null, filt: '', view: 'list', gn: 4, gp: 0, open: {} };
const loadS = (k, dflt) => { try { return { ...BASE, ...dflt, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return { ...BASE, ...dflt }; } };
const STATES = { watch: loadS(KEYS.watch, { list: 'wl0' }), scan: loadS(KEYS.scan, { list: 'sc:trend' }), groups: loadS(KEYS.groups, { list: '', lvl: 'sector', trend: 'all' }), discover: loadS(KEYS.discover, { list: 'today:pos' }) };
let S = STATES.watch;
const pack = (w) => ({ list: w.list, sym: w.sym, tf: w.tf, sort: w.sort, view: w.view, gn: w.gn, open: w.open, lvl: w.lvl, trend: w.trend });
const saveS = () => { try { localStorage.setItem(KEYS[MODE], JSON.stringify(pack(S))); } catch {} };
const doorOf = (id) => (/^(wl\d+|gain|lose|all)$/.test(id) ? 'watch' : /^(sec|ind|th):/.test(id) ? 'groups' : 'scan');
// open a door on a given list (links from other pages); returns the door's address
export const pickList = (id) => {
  const door = doorOf(id), w = STATES[door];
  Object.assign(w, { list: id, sym: '', filt: '', sort: null, gp: 0 });
  if (door === 'groups') { w.lvl = id.startsWith('ind:') ? 'industry' : id.startsWith('th:') ? 'theme' : 'sector'; w.trend = 'all'; }
  try { localStorage.setItem(KEYS[door], JSON.stringify(pack(w))); } catch {}
  return DOOR_ROUTE[door];
};
export const pickStock = (sym) => { const w = STATES.watch; w.sym = String(sym || '').toUpperCase(); w.view = 'list'; try { localStorage.setItem(KEYS.watch, JSON.stringify(pack(w))); } catch {} };

/* ---------------- Discovery Desk lists (data/discover/lists.json + lists_<group>.json) ---------------- */
let DL = null, DPREM = null;
const DG = {};
async function ensureGroup(id) {
  const l = (DL?.lists || []).find((x) => x.id === id);
  if (!l || DG[l.f]) return;
  try { DG[l.f] = (await H.hist('discover/lists_' + l.f)).lists || {}; } catch { DG[l.f] = {}; }
}
const deskRow = (id, sym) => { const l = (DL?.lists || []).find((x) => x.id === id); return l ? (DG[l.f]?.[id] || []).find((r) => r.s === sym) : null; };
const DLINKS = [['triggers', 'Board of all triggers'], ['investors', 'Big investors'], ['valuation', 'Market valuation'], ['management', 'What management said'], ['mystocks', 'My stocks this week']];

/* ---------------- my watchlists (named lists, saved on the member's login) ---------------- */
let WLS = null; // [{ name, syms }], syms newest first
let wlSaveT = null;
export async function wlLoad(force) { if (WLS && !force) return WLS; try { WLS = await H.A.getWatchlists(); } catch { WLS = [{ name: 'My watchlist', syms: [] }]; } if (!WLS.length) WLS = [{ name: 'My watchlist', syms: [] }]; return WLS; }
export const myLists = () => WLS || [];
const inWl = (s) => !!WLS && WLS.some((l) => l.syms.includes(s));
const isMine = (id) => /^wl[0-9]+$/.test(id || '');
const activeIdx = () => (isMine(S.list) ? Math.min(+S.list.slice(2), (WLS || []).length - 1) : 0);
function wlSave() {
  clearTimeout(wlSaveT);
  wlSaveT = setTimeout(() => H.A.saveWatchlists(WLS).catch(() => H.toast('Could not save your lists just now. They are kept in this browser.')), 500);
}
export function wlToggle(sym, idx = activeIdx()) {
  if (!WLS) WLS = [{ name: 'My watchlist', syms: [] }];
  const l = WLS[idx] || WLS[0];
  const had = l.syms.includes(sym);
  l.syms = had ? l.syms.filter((x) => x !== sym) : [sym, ...l.syms];
  wlSave();
  H.toast(had ? `${sym} removed from ${l.name}` : `${sym} added to ${l.name}`);
  return !had;
}
export function wlNew(name) {
  name = String(name || '').trim().slice(0, 40);
  if (!name) return -1;
  if (!WLS) WLS = [];
  if (WLS.length >= 20) { H.toast('You can keep up to 20 lists'); return -1; }
  WLS.push({ name, syms: [] });
  wlSave();
  return WLS.length - 1;
}
export function wlRename(idx, name) { name = String(name || '').trim().slice(0, 40); if (!name || !WLS?.[idx]) return; WLS[idx].name = name; wlSave(); }
export function wlDelete(idx) { if (!WLS?.[idx]) return; WLS.splice(idx, 1); if (!WLS.length) WLS.push({ name: 'My watchlist', syms: [] }); wlSave(); }
export const STAR = (on) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;

/* ---------------- data ---------------- */
let ALL = null;
async function all() {
  if (ALL) return ALL;
  const [st, scr, mkt, hub] = await Promise.all([H.stkAll(), H.data('screeners').catch(() => ({})), H.data('market').catch(() => ({})), H.hist('results/hub').catch(() => ({})), SC.scanData().catch(() => null)]);
  ALL = { st, scr, mkt, hub };
  return ALL;
}
export function resetData() { ALL = null; }

const addDays = (iso, n) => { const d = H.pd(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const bySym = (rows) => [...new Set((rows || []).map((r) => r && r.sym).filter(Boolean))];

/* ---------------- lists, by door and folder ---------------- */
// Screeners door: seven folders, in this order. A list not named here is left out on purpose (Sagar 2026-11-21, merged:
// "Consolidation, before the breakout" -> Near resistance; "52-week high breakout" + "New 52-week highs" -> New 52-week
// high; Leadership "Momentum" -> Up 25% in a month; Mutual funds buying -> Mutual funds page; By size -> market cap filter)
const SCAN_ORDER = [
  ['Trend', ['sc:trend', 'sc:stage2new', 'ld:leaders', 'sc:rsup', 'sc:rsline', 'ld:emerging']],
  ['Setting up', ['sc:nearres', 'pat:flag_forming', 'sc:dbase', 'sc:wbase', 'sc:tighten', 'sc:tight']],
  ['Pullbacks', ['sc:pb20', 'sc:pb50', 'sc:shake']],
  ['Breakouts', ['sc:brk', 'pat:flag_pole', 'pat:rectangle', 'sc:newhigh', 'sc:up4']],
  ['Volume', ['sc:hivol', 'sc:ppivot', 'sc:reversal']],
  ['Results', ['res:new', 'res:due', 'sc:resgap', 'sc:resmove', 'sc:epsx2', 'sc:accel3', 'sc:accel', 'sc:turn']],
  ['Momentum', ['sc:g1m', 'sc:g3m', 'sc:dbl', 'sc:ipo']],
];
// the 4th column: the number that matters for that list
const rw = (s) => SC.row(s) || {};
const K = (label, f, unit = '%') => ({ label, f, unit });
const k1m = K('1M', (s) => rw(s).r1m), kvol = K('Vol x', (s) => rw(s).rv, 'x'), keps = K('EPS yoy', (s) => rw(s).ey), krng = K('Range', (s, x) => x?.range);
const KEY = {
  'sc:trend': K('From high', (s) => rw(s).fh), 'sc:stage2new': k1m, 'ld:leaders': k1m, 'sc:rsup': K('RS +1M', (s) => rw(s).rsm, ''), 'sc:rsline': K('From high', (s) => rw(s).fh), 'ld:emerging': K('RS +1M', (s) => rw(s).rsm, ''),
  'sc:nearres': K('To level', (s, x) => x?.res_dist), 'pat:flag_forming': k1m, 'sc:dbase': krng, 'sc:wbase': krng, 'sc:tighten': krng, 'sc:tight': K('Day range', (s) => rw(s).adr),
  'sc:pb20': K('vs 20D', (s) => rw(s).d20), 'sc:pb50': K('vs 50D', (s) => rw(s).d50), 'sc:shake': k1m,
  'sc:brk': kvol, 'pat:flag_pole': kvol, 'pat:rectangle': kvol, 'sc:newhigh': kvol, 'sc:up4': kvol, 'sc:hivol': kvol, 'sc:ppivot': kvol, 'sc:reversal': kvol,
  'res:new': keps, 'res:due': k1m, 'sc:resgap': K('Gap', (s, x) => x?.gap), 'sc:resmove': K('Move', (s, x) => x?.move), 'sc:epsx2': keps, 'sc:accel3': keps, 'sc:accel': keps, 'sc:turn': K('Sales yoy', (s) => rw(s).sy),
  'sc:g1m': k1m, 'sc:g3m': K('3M', (s) => rw(s).r3m), 'sc:dbl': K('6M', (s) => rw(s).r6m), 'sc:ipo': K('From high', (s, x) => x?.from_hi),
};
const keyOf = (list) => KEY[list?.id] || k1m;
const fmtKey = (k, v) => (v == null ? '-' : k.unit === '%' ? H.pct(v, 1) : k.unit === 'x' ? `${H.num(v, 1)}x` : (v > 0 ? '+' : '') + H.num(v));

const LEAD_ABOUT = { leaders: 'Stocks with the strongest 12-month relative strength (RS rating 80+), liquid and mostly in Stage 2 uptrends.', emerging: 'Stocks whose RS rating jumped sharply in recent weeks: early names in new moves.' };
function lists(D) {
  if (MODE === 'discover') {
    return (DL?.lists || []).map((l) => ({ id: l.id, g: l.g, n: l.n.replace(/ \(\d+\)$/, ''), count: Number((l.n.match(/\((\d+)\)$/) || [])[1] ?? NaN), f: l.f, desk: true, about: l.about, syms: () => (DG[l.f]?.[l.id] || []).map((r) => r.s) }));
  }
  const { st, scr, mkt, hub } = D;
  const info = st.info, daily = st.daily;
  if (MODE === 'watch') {
    const L = (WLS || []).map((w, i) => ({ id: 'wl' + i, g: 'My lists', n: w.name, mine: i, about: 'Your own list, saved on your login so it shows on your phone too. Press W or the star to add the open stock.', syms: () => w.syms.filter((s) => info[s]) }));
    L.push({ id: 'gain', g: 'Market today', n: 'Top gainers', about: 'Biggest rises on the last session (Nifty 500 and larger companies).', syms: () => bySym(mkt.gainers) });
    L.push({ id: 'lose', g: 'Market today', n: 'Top losers', about: 'Biggest falls on the last session.', syms: () => bySym(mkt.losers) });
    L.push({ id: 'all', g: 'Market today', n: 'All stocks, biggest first', about: 'Every NSE company we track, largest market cap first.', syms: () => Object.keys(daily).filter((s) => info[s] && daily[s].mc != null).sort((a, b) => daily[b].mc - daily[a].mc) });
    return L;
  }
  if (MODE === 'groups') return SC.groupLists(info, S.lvl || 'sector');
  const by = {};
  SC.scanLists(info).forEach((l) => { by[l.id] = l; });
  const pat = Object.fromEntries((scr.patterns || []).map((p) => [p.key, p]));
  const pl = (p, n, keep) => ({ n, about: p.idea, hist: p.history, syms: () => bySym((p.rows || []).filter(keep)) });
  if (pat.flag_pole) { by['pat:flag_pole'] = pl(pat.flag_pole, 'Flag and pole breakout', (r) => r.status === 'breakout'); by['pat:flag_forming'] = { ...pl(pat.flag_pole, 'Flag forming', (r) => r.status !== 'breakout'), hist: null }; }
  if (pat.rectangle) by['pat:rectangle'] = pl(pat.rectangle, 'Consolidation breakout', () => true);
  ['leaders', 'emerging'].forEach((k) => { if (Array.isArray(scr.leadership?.[k])) by['ld:' + k] = { n: k === 'leaders' ? 'RS leaders' : 'Emerging strength', about: LEAD_ABOUT[k], syms: () => bySym(scr.leadership[k]) }; });
  const today = hub.today || st.asOf;
  if (today) {
    by['res:new'] = { n: 'Results just announced', about: 'Quarterly results filed in the last 3 days, newest first.', syms: () => bySym((hub.announced || []).filter((r) => String(r.ts || '') >= addDays(today, -3)).sort((a, b) => String(b.ts).localeCompare(String(a.ts)))) };
    by['res:due'] = { n: 'Results due in 7 days', about: 'Board meetings for results in the coming week (NSE notices; dates can move).', syms: () => bySym((hub.calendar || []).filter((r) => r.date >= today && r.date <= addDays(today, 7)).sort((a, b) => a.date.localeCompare(b.date) || (b.mcap || 0) - (a.mcap || 0))) };
  }
  const L = [];
  SCAN_ORDER.forEach(([g, ids]) => ids.forEach((id) => { if (by[id]) L.push({ ...by[id], id, g, scan: true }); }));
  return L;
}

/* ---------------- filters (Screeners, Groups, Discover; never on your own lists) ---------------- */
const FKEY = 'skd.filt';
const F0 = { mc: 'all', sec: 'all', rs: 0, st: 'all', tv: 0 };
let F = (() => { try { return { ...F0, ...JSON.parse(localStorage.getItem(FKEY) || '{}') }; } catch { return { ...F0 }; } })();
const MC = { all: [0, Infinity, 'Any size'], large: [20000, Infinity, 'Large: Rs 20,000 cr+'], mid: [5000, 20000, 'Mid: 5,000 to 20,000 cr'], small: [1000, 5000, 'Small: 1,000 to 5,000 cr'], micro: [0, 1000, 'Micro: under 1,000 cr'] };
const STG = { all: [null, 'Any stage'], s2: [[2, 21], 'Stage 2 (uptrend)'], s1: [[1], 'Stage 1 (basing)'], s3: [[3, 31], 'Stage 3 (topping)'], s4: [[4, 41], 'Stage 4 (downtrend)'] };
const useF = () => MODE !== 'watch';
const fOn = () => useF() && (F.mc !== 'all' || F.sec !== 'all' || F.rs > 0 || F.st !== 'all' || F.tv > 0);
function passes(sym) {
  if (!useF()) return true;
  const d = D.st.daily[sym] || {}, x = rw(sym), inf = D.st.info[sym] || {};
  const mc = d.mc ?? inf.mc;
  if (F.mc !== 'all' && (mc == null || mc < MC[F.mc][0] || mc >= MC[F.mc][1])) return false;
  if (F.sec !== 'all' && inf.sec !== F.sec) return false;
  if (F.rs > 0 && !((x.rs ?? 0) >= F.rs)) return false;
  if (STG[F.st]?.[0] && !STG[F.st][0].includes(x.st)) return false;
  if (F.tv > 0 && !((x.tv ?? 0) >= F.tv)) return false;
  return true;
}
function filterBar() {
  if (!useF()) return '';
  const secs = [...new Set(Object.values(D.st.info).map((x) => x.sec).filter(Boolean))].sort();
  const sel = (k, opts) => `<select data-f="${k}" class="${String(F[k]) !== String(F0[k]) ? 'on' : ''}" aria-label="${k}">${opts.map(([v, t]) => `<option value="${H.esc(v)}" ${String(F[k]) === String(v) ? 'selected' : ''}>${H.esc(t)}</option>`).join('')}</select>`;
  return `${sel('mc', Object.entries(MC).map(([k, v]) => [k, v[2]]))}${sel('sec', [['all', 'Any sector'], ...secs.map((s) => [s, s])])}${sel('rs', [[0, 'Any RS'], [50, 'RS 50+'], [70, 'RS 70+'], [80, 'RS 80+'], [90, 'RS 90+']])}${sel('st', Object.entries(STG).map(([k, v]) => [k, v[1]]))}${sel('tv', [[0, 'Any traded value'], [1, 'Rs 1 cr+ a day'], [5, 'Rs 5 cr+ a day'], [10, 'Rs 10 cr+ a day'], [50, 'Rs 50 cr+ a day']])}`;
}

/* ---------------- seen marks (R): where you stopped in a list, kept in this browser for that day's list ---------------- */
const SEEN_K = 'skd.seen';
let SEEN = (() => { try { return JSON.parse(localStorage.getItem(SEEN_K) || '{}'); } catch { return {}; } })();
const seenKey = () => `${S.list}|${D?.st?.asOf || ''}`;
const isSeen = (s) => (SEEN[seenKey()] || []).includes(s);
function toggleSeen(s) {
  const k = seenKey(), a = SEEN[k] || [];
  SEEN[k] = a.includes(s) ? a.filter((x) => x !== s) : [...a, s];
  const ks = Object.keys(SEEN);
  if (ks.length > 40) ks.slice(0, ks.length - 40).forEach((x) => delete SEEN[x]);
  try { localStorage.setItem(SEEN_K, JSON.stringify(SEEN)); } catch {}
}

/* ---------------- freshness badge (shared with app.js) ---------------- */
export function fresh(day, label = 'Close') {
  if (!day) return '';
  const m = H.meta();
  const prov = m?.provisional && day === m?.as_of;
  const age = (Date.now() - H.pd(day)) / 86400000;
  const cls = prov ? 'warn' : age > 5 ? 'bad' : 'ok';
  const txt = prov ? `Provisional ${H.fShort(day)}` : `${label} ${H.fShort(day)}`;
  const tip = prov ? 'Last traded prices; NSE official close replaces them this evening' : age > 5 ? 'This data is older than usual' : 'Data as of this date';
  return `<span class="k-pill ${cls}" title="${tip}">${txt}</span>`;
}

/* ---------------- the screen ---------------- */
export async function viewTerminal(helpers, mode = 'watch', extra = {}) {
  H = helpers;
  MODE = mode;
  S = STATES[mode];
  DPREM = extra.prem || null;
  H.after(mount);
  return `<div class="tw tw3" id="tw" data-door="${mode}">
  <nav class="tw-menu" id="twMenu" aria-label="${DOOR_TITLE[mode]} lists"><div class="tw-empty">Loading</div></nav>
  <aside class="tw-left" aria-label="Stocks in this list">
    <div class="tw-pick">
      <div class="tw-find"><input id="twQ" type="search" autocomplete="off" spellcheck="false" placeholder="Open any stock (name or ticker)" aria-label="Open any stock"><kbd>/</kbd><div class="tw-ac" id="twAc" hidden></div></div>
      <button class="tw-menubtn" id="twMenuBtn" type="button"></button>
      <div class="tw-lhd" id="twLhd"></div>
      <div class="tw-flt" id="twFlt"></div>
      <div class="tw-vbar"><input id="twFilt" type="search" placeholder="Filter by name" aria-label="Filter this list by name" autocomplete="off"><div class="k-seg" role="group" aria-label="View"><button data-view="list">List</button><button data-view="grid">Grid</button></div></div>
    </div>
    <div class="tw-head" id="twHead"></div>
    <div class="tw-list" id="twRows" tabindex="0"><div class="tw-empty">Loading stocks</div></div>
    <div class="tw-foot" id="twFoot"></div>
  </aside>
  <section class="tw-main" id="twMain" tabindex="-1"><div class="tw-empty">Pick a stock on the left.</div></section>
</div>`;
}

let D = null, LISTS = [], ROWS = [], CUR = [], MQ = '', TAB = 'Overview';
const curList = () => LISTS.find((l) => l.id === S.list) || LISTS[0];
function defaultList() {
  if (MODE === 'watch') return (WLS?.[0]?.syms || []).length ? 'wl0' : 'all';
  return LISTS[0]?.id || '';
}
async function mount() {
  if (!$('#tw')) return;
  D = await all();
  await wlLoad();
  if (MODE === 'discover') {
    try { DL = await H.hist('discover/lists'); } catch { DL = { lists: [] }; }
    if (!DL.lists.length) { $('#twRows').innerHTML = '<div class="tw-empty">The lists are being put together. Please check back this evening.</div>'; return; }
  }
  LISTS = lists(D);
  if (!LISTS.find((l) => l.id === S.list)) S.list = defaultList();
  if (MODE === 'discover') await ensureGroup(S.list);
  $('#twMenu').addEventListener('click', onMenuClick);
  $('#twMenu').addEventListener('input', (e) => { if (e.target.id === 'twMq') { MQ = e.target.value; paintMenu(true); } });
  $('#twMenuBtn').addEventListener('click', () => document.body.classList.toggle('tm-open'));
  $('#twFlt').addEventListener('change', (e) => { const k = e.target.dataset.f; if (!k) return; F[k] = ['rs', 'tv'].includes(k) ? Number(e.target.value) : e.target.value; try { localStorage.setItem(FKEY, JSON.stringify(F)); } catch {} S.gp = 0; paintList(false); });
  $('#twFilt').addEventListener('input', (e) => { S.filt = e.target.value; S.gp = 0; paintList(false); });
  $('.tw-vbar .k-seg').addEventListener('click', (e) => { const v = e.target.closest('[data-view]')?.dataset.view; if (v) setView(v); });
  $('#twHead').addEventListener('click', (e) => { const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return; S.sort = S.sort?.k === k ? { k, d: -S.sort.d } : { k, d: k === 'sym' ? 1 : -1 }; saveS(); paintList(false); });
  $('#twFoot').addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) { F = { ...F0 }; try { localStorage.setItem(FKEY, JSON.stringify(F)); } catch {} paintList(false); } });
  $('#twRows').addEventListener('click', (e) => { const r = e.target.closest('[data-s]'); if (!r) return; select(r.dataset.s, true); if (window.innerWidth < 900 && S.view !== 'grid') $('#twMain').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#twMain').addEventListener('click', onMainClick);
  findBox($('#twQ'), $('#twAc'), (s) => { if (S.view === 'grid') setView('list', true); select(s, true, true); });
  paintMenu();
  paintList(false); // keeps a stock opened from search, the heatmap or a link even when it is not in this list
}

/* ---------------- left: the door's menu ---------------- */
function paintMenu(keepFocus) {
  LISTS = lists(D);
  const q = MQ.trim().toLowerCase();
  const info = D.st.info;
  const cnt = (l) => (l.desk && !DG[l.f] && Number.isFinite(l.count) ? l.count : l.syms().filter((s) => info[s]).length); // Discover groups load on opening
  let h = `<div class="tm-top"><p class="tm-door">${DOOR_TITLE[MODE]}</p>`;
  if (MODE !== 'watch') h += `<input id="twMq" type="search" autocomplete="off" placeholder="Find a ${MODE === 'groups' ? 'group' : 'list'}" value="${H.esc(MQ)}">`;
  h += '</div>';
  if (MODE === 'groups') {
    const lv = S.lvl || 'sector';
    h += `<div class="k-seg tm-lvl">${[['sector', 'Sectors'], ['industry', 'Industries'], ['theme', 'Themes']].map(([k, t]) => `<button data-lvl="${k}" class="${k === lv ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="tm-trend">${['all', ...SC.GROUP_LABELS].map((t) => `<button data-trend="${t}" class="${(S.trend || 'all') === t ? 'on' : ''}" title="${H.esc(SC.groupAbout(t))}">${t === 'all' ? 'All' : t}</button>`).join('')}</div>
      <a class="tm-rrg" href="#/sectors/rrg">Rotation chart (RRG)</a>`;
  }
  const groups = [...new Set(LISTS.map((l) => l.g))];
  groups.forEach((g) => {
    const items = LISTS.filter((l) => l.g === g && (!q || l.n.toLowerCase().includes(q)) && (MODE !== 'groups' || !S.trend || S.trend === 'all' || l.trend === S.trend));
    if (!items.length && !(MODE === 'watch' && g === 'My lists')) return;
    const open = q || MODE !== 'scan' || S.open?.[g] !== false;
    h += `<div class="tm-f${open ? ' open' : ''}"><button class="tm-ft" data-fold="${H.esc(g)}">${H.esc(g)}<small>${items.length}</small></button>`;
    if (open) {
      h += `<div class="tm-items">${items.map((l) => `<button class="tm-i${l.id === S.list ? ' on' : ''}" data-l="${H.esc(l.id)}" title="${H.esc(l.about || '')}"><span>${H.esc(l.n)}</span>${MODE === 'groups' ? SC.trendPill(l.trend) : ''}<b>${cnt(l)}</b></button>`).join('')}</div>`;
      if (MODE === 'watch' && g === 'My lists') h += `<div class="tm-act"><button class="k-chip" data-wlact="new">New list</button>${isMine(S.list) ? '<button class="k-chip" data-wlact="rename">Rename</button><button class="k-chip" data-wlact="delete">Delete</button>' : ''}</div>`;
    }
    h += '</div>';
  });
  if (MODE === 'discover') h += `<div class="tm-act">${DLINKS.map(([k, t]) => `<a class="k-chip" href="#/discover/${k}">${t}</a>`).join('')}</div>`;
  $('#twMenu').innerHTML = h;
  if (keepFocus) { const i = $('#twMq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  const l = curList();
  $('#twMenuBtn').innerHTML = `<span>${H.esc(DOOR_TITLE[MODE])}: <b>${H.esc(l?.n || '')}</b></span><em>Change list</em>`;
}
async function onMenuClick(e) {
  const f = e.target.closest('[data-fold]')?.dataset.fold;
  if (f) { S.open = { ...(S.open || {}), [f]: !(S.open?.[f] !== false) }; saveS(); paintMenu(); return; }
  const lv = e.target.closest('[data-lvl]')?.dataset.lvl;
  if (lv) { S.lvl = lv; S.trend = 'all'; LISTS = lists(D); S.list = LISTS[0]?.id || ''; S.gp = 0; saveS(); paintMenu(); paintList(true); return; }
  const tr = e.target.closest('[data-trend]')?.dataset.trend;
  if (tr) { S.trend = tr; saveS(); paintMenu(); return; }
  const wa = e.target.closest('[data-wlact]')?.dataset.wlact;
  if (wa) { onWl(wa); return; }
  const id = e.target.closest('[data-l]')?.dataset.l;
  if (!id) return;
  S.list = id; S.filt = ''; S.gp = 0; $('#twFilt').value = ''; saveS();
  document.body.classList.remove('tm-open');
  if (MODE === 'discover') { $('#twRows').innerHTML = '<div class="tw-empty">Loading</div>'; await ensureGroup(S.list); }
  paintMenu(); paintList(true);
}
function onWl(a) {
  if (a === 'new') { const n = prompt('Name of the new list'); const i = wlNew(n); if (i >= 0) { S.list = 'wl' + i; saveS(); paintMenu(); paintList(true); } }
  if (a === 'rename') { const i = activeIdx(); const n = prompt('New name for this list', WLS[i]?.name || ''); if (n) { wlRename(i, n); paintMenu(); paintList(false); } }
  if (a === 'delete') { const i = activeIdx(); if (confirm(`Delete the list "${WLS[i]?.name}"? Only the list goes, nothing else changes.`)) { wlDelete(i); S.list = 'wl0'; saveS(); paintMenu(); paintList(true); } }
}

/* ---------------- middle: the stocks of the open list ---------------- */
function rowsOf(list) {
  const { info, daily } = D.st;
  const k = keyOf(list);
  const xs = SC.listExtra(list.id);
  const when = list.desk ? Object.fromEntries((DG[list.f]?.[list.id] || []).map((r) => [r.s, r.d])) : {};
  return list.syms().filter((s) => info[s]).map((s, i) => {
    const d = daily[s] || {};
    return { sym: s, n: (info[s].n || s) + (when[s] ? ' · ' + H.fShort(String(when[s]).slice(0, 10)) : ''), p: d.p, c: (d.r || [])[0], k: k.f(s, xs?.[s]), rs: rw(s).rs, i };
  });
}
function paintList(reset) {
  const list = curList();
  if (!list) { $('#twRows').innerHTML = '<div class="tw-empty">No list here yet.</div>'; return; }
  const k = keyOf(list);
  ROWS = rowsOf(list);
  const f = S.filt.trim().toUpperCase();
  CUR = ROWS.filter((r) => passes(r.sym) && (!f || r.sym.includes(f) || r.n.toUpperCase().includes(f)));
  if (S.sort) { const { k: sk, d } = S.sort; CUR.sort((a, b) => (a[sk] == null) - (b[sk] == null) || (sk === 'sym' ? a.sym.localeCompare(b.sym) : (a[sk] - b[sk])) * d); }
  $('#twLhd').innerHTML = `<div class="lh-n"><b>${H.esc(list.n)}</b>${MODE === 'groups' ? SC.trendPill(list.trend) : ''}</div><p class="tw-about">${H.esc(list.about || '')}${MODE === 'discover' && DPREM?.mode === 'trial' && DPREM.days_left != null ? ` <span class="k-pill warn">Free ${DPREM.days_left} more days</span>` : ''}</p>`;
  $('#twFlt').innerHTML = filterBar();
  document.querySelectorAll('.tw-vbar [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === S.view));
  const hd = (key, t, cls = '') => `<span data-k="${key}" class="${cls} ${S.sort?.k === key ? 'on' : ''}" title="${key === 'k' ? H.esc(k.label) : ''}">${t}${S.sort?.k === key ? (S.sort.d > 0 ? ' &uarr;' : ' &darr;') : ''}</span>`;
  $('#twHead').innerHTML = hd('sym', 'Stock') + hd('p', 'Last', 'r') + hd('c', 'Chg%', 'r') + hd('k', H.esc(k.label), 'r') + hd('rs', 'RS', 'r');
  if (!CUR.length) {
    $('#twRows').innerHTML = `<div class="tw-empty">${list.mine != null ? 'This list is empty. Open any stock and press the star (or W) to add it here.' : f ? 'No stock in this list matches the name.' : fOn() ? 'No stock in this list passes your filters. <button class="k-chip" data-clear>Clear filters</button>' : 'Nothing in this list today.'}</div>`;
  } else {
    $('#twRows').innerHTML = CUR.map((r) => `<div class="tw-row${r.sym === S.sym ? ' sel' : ''}${isSeen(r.sym) ? ' seen' : ''}" data-s="${H.esc(r.sym)}" role="button" tabindex="-1">
      <span class="s">${inWl(r.sym) ? '<i class="wl-dot" title="In one of your lists"></i>' : ''}${H.esc(r.sym)}<small>${H.esc(r.n)}</small></span>
      <span class="r" data-lp="${H.esc(r.sym)}">${H.num(r.p, r.p < 100 ? 2 : 1)}</span><span class="r ${H.tone(r.c)}" data-lc="${H.esc(r.sym)}">${H.pct(r.c, 1)}</span><span class="r k">${fmtKey(k, r.k)}</span><span class="r m">${r.rs == null ? '-' : H.num(r.rs)}</span></div>`).join('');
  }
  const seenN = CUR.filter((r) => isSeen(r.sym)).length;
  $('#twFoot').innerHTML = `${CUR.length}${CUR.length !== ROWS.length ? ` of ${ROWS.length}` : ''} stock${CUR.length === 1 ? '' : 's'}${fOn() ? ' (filters on) <button class="k-chip" data-clear>Clear filters</button>' : ''}${seenN ? ` &middot; ${seenN} seen` : ''} &middot; ${fresh(D.st.asOf)} <span data-live-badge hidden></span>
    <span class="keys">&uarr;&darr; next &middot; G grid &middot; R seen &middot; W watchlist &middot; 1 2 3 D/W/M</span>`;
  if (reset || !CUR.find((r) => r.sym === S.sym)) {
    if (!S.sym || (reset && !CUR.find((r) => r.sym === S.sym))) S.sym = CUR[0]?.sym || S.sym;
  }
  if (S.view === 'grid') paintGrid(true);
  else if (S.sym) select(S.sym, false);
}

/* ---------------- right, grid view: 4 or 9 small charts of the list ---------------- */
const gridN = () => (window.innerWidth < 900 ? 1 : S.gn === 9 ? 9 : 4);
function setView(v, quiet) {
  S.view = v; saveS();
  document.querySelectorAll('.tw-vbar [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  if (quiet) return;
  if (v === 'grid') { const i = CUR.findIndex((r) => r.sym === S.sym); S.gp = i >= 0 ? Math.floor(i / gridN()) : 0; paintGrid(true); }
  else { $('#twMain').dataset.sym = ''; SC.disposeMini(); if (S.sym) select(S.sym, false); }
}
function paintGrid(redraw) {
  const list = curList();
  const n = gridN(), pages = Math.max(1, Math.ceil(CUR.length / n));
  S.gp = Math.max(0, Math.min(S.gp || 0, pages - 1));
  const slice = CUR.slice(S.gp * n, S.gp * n + n);
  const k = keyOf(list);
  document.querySelectorAll('#twRows .tw-row').forEach((el) => el.classList.toggle('pg', slice.some((r) => r.sym === el.dataset.s)));
  if (!redraw && $('#twMain').dataset.grid === `${S.list}|${S.gp}|${n}|${CUR.length}`) { hiTile(); return; }
  SC.disposeMini();
  $('#twMain').dataset.sym = '';
  $('#twMain').dataset.grid = `${S.list}|${S.gp}|${n}|${CUR.length}`;
  if (!slice.length) { $('#twMain').innerHTML = '<div class="tw-empty">Nothing to show with these filters.</div>'; return; }
  $('#twMain').innerHTML = `<div class="tg-bar"><b>${H.esc(list.n)}</b><span>page ${S.gp + 1} of ${pages}</span>
      <button class="k-btn" data-gp="-1" ${S.gp ? '' : 'disabled'}>Previous</button><button class="k-btn" data-gp="1" ${S.gp < pages - 1 ? '' : 'disabled'}>Next</button>
      ${window.innerWidth >= 900 ? `<div class="k-seg">${[4, 9].map((g) => `<button data-gn="${g}" class="${n === g ? 'on' : ''}">${g} charts</button>`).join('')}</div>` : ''}
      <span class="sub">&larr; &rarr; turn pages &middot; click a chart to open it</span></div>
    <div class="tg g${n}">${slice.map((r, i) => {
      const x = rw(r.sym);
      return `<div class="tg-t${r.sym === S.sym ? ' sel' : ''}${isSeen(r.sym) ? ' seen' : ''}" data-open="${H.esc(r.sym)}">
        <div class="tg-h"><b>${H.esc(r.sym)}</b><span data-lp="${H.esc(r.sym)}" data-dp="2">${H.num(r.p, 2)}</span><span class="${H.tone(r.c)}" data-lc="${H.esc(r.sym)}">${H.pct(r.c, 1)}</span><span class="m">${H.esc(k.label)} ${fmtKey(k, r.k)}</span><span class="m">RS ${H.num(r.rs)}</span>${SC.stageChip(x.st)}${isSeen(r.sym) ? '<span class="m">seen</span>' : ''}</div>
        <div class="tg-c" id="tg${i}"></div></div>`;
    }).join('')}</div>`;
  slice.forEach((r, i) => SC.miniChart('tg' + i, r.sym));
}
function hiTile() { document.querySelectorAll('#twMain .tg-t').forEach((el) => el.classList.toggle('sel', el.dataset.open === S.sym)); }

/* ---------------- right, list view: the open stock ---------------- */
let paneSeq = 0;
async function select(sym, user, scrollList) {
  const prev = S.sym;
  S.sym = sym; saveS();
  document.querySelectorAll('#twRows .tw-row').forEach((el) => el.classList.toggle('sel', el.dataset.s === sym));
  const el = document.querySelector(`#twRows .tw-row[data-s="${CSS.escape(sym)}"]`);
  if (el && (user || scrollList)) el.scrollIntoView({ block: 'nearest' });
  if (S.view === 'grid') {
    const i = CUR.findIndex((r) => r.sym === sym);
    if (i >= 0 && Math.floor(i / gridN()) !== S.gp) { S.gp = Math.floor(i / gridN()); paintGrid(true); } else hiTile();
    return;
  }
  if (prev === sym && $('#twMain').dataset.sym === sym) return;
  const seq = ++paneSeq;
  const { info, daily, asOf } = D.st;
  const x = info[sym], d = daily[sym] || {};
  if (!x) { $('#twMain').innerHTML = `<div class="tw-empty">${H.esc(sym)} is not in our NSE list.</div>`; return; }
  H.setDalal({ sym, name: x.n });
  const r = d.r || [];
  const on = inWl(sym);
  const list = curList();
  const g = SC.sectorTrend(x.sec);
  const why = MODE === 'discover' ? whyCard(sym) : SC.whyLine(list, sym);
  $('#twMain').dataset.sym = sym;
  $('#twMain').dataset.grid = '';
  $('#twMain').innerHTML = `<div class="tw-hd">
      <div><div class="tk">${H.esc(sym)} <span class="k-faint">NSE</span></div><div class="nm">${H.esc(x.n || sym)}</div>
        <div class="grp">${H.esc(x.sec || '')}${g ? ' ' + SC.trendPill(g) : ''}${x.ind ? ' &middot; ' + H.esc(x.ind) : ''}</div></div>
      <div class="px"><span data-lp="${H.esc(sym)}" data-dp="2">${H.num(d.p, 2)}</span><small class="${H.tone(r[0])}" data-lc="${H.esc(sym)}" data-dp="2" data-suffix=" on the day">${H.pct(r[0], 2)} on the day</small><small>${fresh(asOf)} <span data-live-badge hidden></span></small></div>
    </div>
    ${why}
    <div class="tw-bar">
      <div class="k-seg" role="group" aria-label="Chart timeframe">${[['D', 'Daily'], ['W', 'Weekly'], ['M', 'Monthly']].map(([kk, t]) => `<button data-tf="${kk}" class="${S.tf === kk ? 'on' : ''}">${t}</button>`).join('')}</div>
      <span class="tw-wlwrap"><button class="k-btn tw-star${on ? ' on' : ''}" data-twact="star" title="Add to or remove from your lists (W)">${STAR(on)} ${on ? 'In my lists' : 'Add to list'}</button><div class="tw-wlmenu" id="twWlMenu" hidden></div></span>
      <a class="k-btn" href="#/compare/${encodeURIComponent(sym)}" title="Compare with another stock">Compare</a>
      <button class="k-btn" data-twact="dalal" title="Ask Dalal about this stock">Ask Dalal</button>
      <button class="k-btn" data-twact="key" title="What the colours and letters on the chart mean">?</button>
      <span class="links"><a class="k-link" href="${H.tvUrl(sym)}" target="_blank" rel="noopener">TradingView</a><a class="k-link" href="${H.screenerUrl(sym)}" target="_blank" rel="noopener">Screener</a></span>
    </div>
    <div class="tw-keybox" id="twKey" hidden>${SC.chartKey()}</div>
    <div class="tw-chart" id="twChart"></div>
    ${SC.oneStrip(sym, d)}
    <div class="tw-tabs" id="twTabs"></div>
    <div class="tw-body" id="twBody"><div class="tw-empty">Loading ${H.esc(sym)}</div></div>`;
  SC.drawStock('twChart', sym, S.tf);
  try {
    const body = await H.stockBody(sym);
    if (seq !== paneSeq) return;
    $('#twBody').innerHTML = body;
    tabsFor(list);
  } catch (e) { if (seq === paneSeq) $('#twBody').innerHTML = `<div class="tw-empty">Could not load the details: ${H.esc(e.message)}</div>`; }
}

// the company details come as cards; each goes under a tab by its heading
const TAB_RULES = [['Results', /result|quarter|earning|financial|fundamental|statement|management|commentary|profit|revenue|concall|call/i], ['Owners', /own|holding|mutual fund|investor|promoter|fund buying|stake|deal/i], ['News', /news|filing|announcement|order|event/i]];
const TABS = ['Overview', 'Results', 'Owners', 'News', 'About this list'];
function tabsFor(list) {
  const body = $('#twBody');
  // two cards side by side (a .grid2 row) can belong to different tabs: take them out of the row first
  [...body.querySelectorAll(':scope > .grid2')].forEach((g) => g.replaceWith(...g.children));
  [...body.children].forEach((el) => {
    const h = el.querySelector('h2, h3')?.textContent || '';
    el.dataset.tab = (TAB_RULES.find(([, re]) => re.test(h)) || ['Overview'])[0];
  });
  body.insertAdjacentHTML('beforeend', `<section class="card" data-tab="About this list">${aboutList(list)}</section>`);
  const have = TABS.filter((t) => body.querySelector(`[data-tab="${t}"]`));
  if (!have.includes(TAB)) TAB = 'Overview';
  $('#twTabs').innerHTML = `<div class="tabs">${have.map((t) => `<button class="tab${t === TAB ? ' on' : ''}" data-tab="${t}">${t}</button>`).join('')}</div>`;
  showTab();
}
function showTab() {
  document.querySelectorAll('#twTabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === TAB));
  [...($('#twBody')?.children || [])].forEach((el) => { el.hidden = el.dataset.tab !== TAB; });
}
function aboutList(list) {
  if (!list) return '';
  const hh = list.hist;
  const grp = MODE === 'groups' ? SC.groupAboutHTML(list) : '';
  return `<h2>${H.esc(list.n)}</h2><p>${H.esc(list.about || '')}</p>${grp}
    ${hh?.events ? `<div class="stats"><div><b>${H.num(hh.hit_rate, 1)}%</b><span>past setups that reached the measured move</span></div><div><b>${H.num(hh.events)}</b><span>past setups tested on NSE data</span></div><div><b class="up">${H.pct(hh.avg_win, 1)}</b><span>average win</span></div><div><b class="down">${H.pct(hh.avg_loss, 1)}</b><span>average loss</span></div></div>` : ''}
    ${list.scan ? `<p class="sub">Built from NSE's official closes after each session. ${H.esc(SC.liquidNote())}. A screen shows a setup, not a recommendation.</p>` : ''}`;
}

// Discover: why this stock is on the list (the Discovery Desk events behind it)
function whyCard(sym) {
  const r = deskRow(S.list, sym);
  const l = (DL?.lists || []).find((x) => x.id === S.list);
  if (!r || !l) return '';
  const cls = (g) => (g === 'pos' ? 'ok' : g === 'neg' ? 'bad' : 'info');
  return `<section class="tw-why"><p class="k-label">Why ${H.esc(sym)} is on "${H.esc(l.n.replace(/ \(\d+\)$/, ''))}"</p>
    <ul>${r.ev.map((e) => `<li><span class="k-pill ${cls(e.g)}">${H.esc(e.b || '')}</span> <span class="k-faint">${e.d ? H.fDate(e.d) : ''}</span> ${H.esc(e.t || '')}${e.u ? ` <a href="${H.esc(e.u)}" target="_blank" rel="noopener">Filing</a>` : ''}</li>`).join('')}</ul></section>`;
}

function onMainClick(e) {
  const tf = e.target.closest('[data-tf]');
  if (tf) { setTf(tf.dataset.tf); return; }
  const tb = e.target.closest('#twTabs [data-tab]');
  if (tb) { TAB = tb.dataset.tab; showTab(); return; }
  const gp = e.target.closest('[data-gp]');
  if (gp) { S.gp += Number(gp.dataset.gp); paintGrid(true); return; }
  const gn = e.target.closest('[data-gn]');
  if (gn) { const i = CUR.findIndex((r) => r.sym === S.sym); S.gn = Number(gn.dataset.gn); S.gp = i >= 0 ? Math.floor(i / gridN()) : 0; saveS(); paintGrid(true); return; }
  const op = e.target.closest('[data-open]');
  if (op) { setView('list', true); S.sym = ''; select(op.dataset.open, true, true); return; }
  const a = e.target.closest('[data-twact]')?.dataset.twact;
  if (a === 'star') { wlMenu(); return; }
  if (a === 'key') { const k = $('#twKey'); if (k) k.hidden = !k.hidden; return; }
  const wi = e.target.closest('[data-wli]');
  if (wi) { const i = +wi.dataset.wli; if (i < 0) { const n = prompt('Name of the new list'); const k = wlNew(n); if (k < 0) return; wlToggle(S.sym, k); } else wlToggle(S.sym, i); afterStar(); wlMenu(true); }
  if (a === 'dalal') H.openDalal();
}
function setTf(tf) { S.tf = tf; saveS(); document.querySelectorAll('#twMain [data-tf]').forEach((b) => b.classList.toggle('on', b.dataset.tf === S.tf)); if ($('#twChart')) SC.drawStock('twChart', S.sym, S.tf); }
function wlMenu(keepOpen) {
  const m = $('#twWlMenu');
  if (!m) return;
  if (!keepOpen && !m.hidden) { m.hidden = true; return; }
  m.innerHTML = (WLS || []).map((l, i) => `<button data-wli="${i}" class="${l.syms.includes(S.sym) ? 'on' : ''}"><i class="box"></i>${H.esc(l.name)}<small>${l.syms.length}</small></button>`).join('') + '<button data-wli="-1"><i class="plus">+</i>New list</button>';
  m.hidden = false;
}
function afterStar() {
  const on = inWl(S.sym);
  const b = $('#twMain .tw-star');
  if (b) { b.classList.toggle('on', on); b.innerHTML = `${STAR(on)} ${on ? 'In my lists' : 'Add to list'}`; }
  if (MODE === 'watch') paintMenu();
  if (isMine(S.list)) paintList(false);
  else { const row = document.querySelector(`#twRows .tw-row[data-s="${CSS.escape(S.sym)}"] .s`); if (row) { row.querySelector('.wl-dot')?.remove(); if (on) row.insertAdjacentHTML('afterbegin', '<i class="wl-dot" title="In one of your lists"></i>'); } }
}
function starOpen() { if (!S.sym) return; wlToggle(S.sym); afterStar(); }
document.addEventListener('click', (e) => { const m = $('#twWlMenu'); if (m && !m.hidden && !e.target.closest('.tw-wlwrap')) m.hidden = true; });

// keys (only on this screen): up / down next stock, left / right grid pages, G grid, R seen (and next), W watchlist,
// 1 2 3 daily / weekly / monthly, / search
function move(step) {
  if (!CUR.length) return;
  let i = CUR.findIndex((r) => r.sym === S.sym);
  i = Math.max(0, Math.min(CUR.length - 1, (i < 0 ? -1 : i) + step));
  select(CUR[i].sym, true);
}
document.addEventListener('keydown', (e) => {
  if (!$('#tw') || e.ctrlKey || e.metaKey || e.altKey) return;
  const typing = e.target.matches?.('input, textarea, select, [contenteditable]');
  if (e.key === '/' && !typing) { e.preventDefault(); $('#twQ')?.focus(); return; }
  if (typing || document.querySelector('.dalal-panel:not([hidden])')?.contains(e.target)) return;
  const k = e.key;
  if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); move(k === 'ArrowDown' ? 1 : -1); }
  else if ((k === 'ArrowRight' || k === 'ArrowLeft') && S.view === 'grid') { e.preventDefault(); const pages = Math.ceil(CUR.length / gridN()); S.gp = Math.max(0, Math.min(pages - 1, S.gp + (k === 'ArrowRight' ? 1 : -1))); const s = CUR[S.gp * gridN()]; if (s) { S.sym = s.sym; document.querySelectorAll('#twRows .tw-row').forEach((el) => el.classList.toggle('sel', el.dataset.s === s.sym)); } paintGrid(true); }
  else if (k === 'g' || k === 'G') { e.preventDefault(); setView(S.view === 'grid' ? 'list' : 'grid'); }
  else if (k === 'r' || k === 'R') { if (!S.sym) return; e.preventDefault(); toggleSeen(S.sym); const row = document.querySelector(`#twRows .tw-row[data-s="${CSS.escape(S.sym)}"]`); row?.classList.toggle('seen', isSeen(S.sym)); if (isSeen(S.sym)) move(1); if (S.view === 'grid') paintGrid(true); }
  else if (k === 'w' || k === 'W') { e.preventDefault(); starOpen(); }
  else if (['1', '2', '3'].includes(k) && S.view !== 'grid') { e.preventDefault(); setTf({ 1: 'D', 2: 'W', 3: 'M' }[k]); }
});
window.addEventListener('resize', () => { if ($('#tw') && S.view === 'grid') paintGrid(false); });

/* ---------------- search any stock (name or ticker) ---------------- */
function findBox(input, box, go) {
  let hits = [], at = 0;
  const paint = () => { box.hidden = !hits.length; box.innerHTML = hits.map((h, i) => `<div data-s="${H.esc(h.s)}" class="${i === at ? 'on' : ''}">${H.esc(h.n)}<small>${H.esc(h.s)}</small></div>`).join(''); };
  input.addEventListener('input', () => {
    const q = input.value.trim().toUpperCase();
    at = 0;
    if (!q) { hits = []; paint(); return; }
    const { info, daily } = D.st;
    hits = Object.entries(info).filter(([s, x]) => s.includes(q) || String(x.n || '').toUpperCase().includes(q))
      .map(([s, x]) => ({ s, n: x.n || s, w: (s === q ? 3 : s.startsWith(q) ? 2 : 0) + (daily[s]?.mc || 0) / 1e7 }))
      .sort((a, b) => b.w - a.w).slice(0, 8);
    paint();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!hits.length) return; e.preventDefault(); at = (at + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); const h = hits[at]; if (h) { input.value = ''; hits = []; paint(); input.blur(); go(h.s); } }
    else if (e.key === 'Escape') { input.value = ''; hits = []; paint(); input.blur(); }
  });
  box.addEventListener('mousedown', (e) => { const d = e.target.closest('[data-s]'); if (d) { e.preventDefault(); input.value = ''; hits = []; paint(); go(d.dataset.s); } });
  input.addEventListener('blur', () => setTimeout(() => { hits = []; paint(); }, 150));
}

/* ---------------- TradingView chart (BSE listing) ---------------- */
let TVP = null;
const tvScript = () => TVP || (TVP = new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = 'https://s3.tradingview.com/tv.js'; sc.onload = ok; sc.onerror = () => { TVP = null; bad(new Error('no TradingView')); }; document.head.appendChild(sc); }));
const bse = (s) => 'BSE:' + String(s).toUpperCase().replace(/[&-]/g, '_');
async function tvWidget(id, sym, tf, cmp) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  try {
    await tvScript();
    if (!document.getElementById(id)) return;
    // eslint-disable-next-line no-undef
    new TradingView.widget({
      container_id: id, autosize: true, symbol: bse(sym), interval: tf || 'D', timezone: 'Asia/Kolkata', theme: CH.isLight() ? 'light' : 'dark', style: '1', locale: 'in',
      allow_symbol_change: false, hide_side_toolbar: true, save_image: false, backgroundColor: CH.C.panel, gridColor: CH.C.grid,
      studies: cmp ? [] : [{ id: 'MAExp@tv-basicstudies', inputs: { length: 50 } }, { id: 'MAExp@tv-basicstudies', inputs: { length: 200 } }],
      ...(cmp ? { compare_symbols: [{ symbol: bse(cmp), position: 'NewPriceScale' }] } : {}),
    });
  } catch {
    el.innerHTML = `<div class="tw-empty">TradingView's chart could not load (internet?). <a href="${H.tvUrl(sym)}" target="_blank" rel="noopener">Open it on TradingView</a>.</div>`;
  }
}

/* ---------------- market heatmap (#/heatmap) ---------------- */
const HM = { per: 0, min: 1000 };
export async function viewHeatmap(helpers) {
  H = helpers;
  const D2 = await all();
  const { info, daily, asOf } = D2.st;
  const P = ['1D', '1W', '1M', '3M', '6M', '1Y'];
  const secs = {};
  Object.entries(daily).forEach(([s, d]) => { if (!info[s] || d.mc == null || d.mc < HM.min) return; const k = info[s].sec || 'Unclassified'; (secs[k] ||= []).push({ s, mc: d.mc, r: (d.r || [])[HM.per], n: info[s].n }); });
  const blocks = Object.entries(secs).map(([k, v]) => {
    v.sort((a, b) => b.mc - a.mc);
    const tot = v.reduce((t, x) => t + x.mc, 0);
    const w = v.filter((x) => x.r != null);
    const wr = w.reduce((t, x) => t + x.r * x.mc, 0) / (w.reduce((t, x) => t + x.mc, 0) || 1);
    const up = w.filter((x) => x.r > 0).length;
    return { k, v, tot, wr, up, n: w.length };
  }).sort((a, b) => b.tot - a.tot);
  const span = [3, 6, 12, 20, 30, 40][HM.per]; // a move this size or more gets the strongest colour
  const col = (r) => { if (r == null) return 'var(--surface-2)'; const t = Math.min(1, Math.abs(r) / span); const pctMix = Math.round(14 + 66 * t); return `color-mix(in srgb, ${r >= 0 ? 'var(--pos)' : 'var(--neg)'} ${pctMix}%, var(--surface))`; };
  const size = (mc, top) => (mc >= top * 0.45 ? 'x3' : mc >= top * 0.15 ? 'x2' : '');
  return `${H.pageHead('Market', 'Heatmap', fresh(asOf))}
  <div class="toolbar hm-bar">
    <div class="k-seg" role="group" aria-label="Period">${P.map((p, i) => `<button data-act="hmPer" data-v="${i}" class="${HM.per === i ? 'on' : ''}">${p}</button>`).join('')}</div>
    <div class="k-seg" role="group" aria-label="Smallest company">${[[500, 'Rs 500 cr+'], [1000, 'Rs 1,000 cr+'], [5000, 'Rs 5,000 cr+'], [20000, 'Rs 20,000 cr+']].map(([v, t]) => `<button data-act="hmMin" data-v="${v}" class="${HM.min === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <span class="k-muted hm-key"><i style="background:${col(-span)}"></i>-${span}% <i style="background:var(--surface-2)"></i>0 <i style="background:${col(span)}"></i>+${span}%</span>
  </div>
  <p class="sub">Every sector, biggest first. Each tile is one company: bigger tile = bigger company, colour = its ${P[HM.per]} move. Sector move is weighted by market cap. Click a tile to open the stock.</p>
  <div class="hm">${blocks.map((b) => `<section class="hm-sec">
    <header><b>${H.esc(b.k)}</b><span class="${H.tone(b.wr)}">${H.pct(b.wr, 1)}</span><span class="k-faint">${b.up} of ${b.n} up</span></header>
    <div class="hm-grid">${b.v.slice(0, 40).map((x) => `<a class="hm-t ${size(x.mc, b.v[0].mc)}" href="#/" data-act="hmOpen" data-v="${H.esc(x.s)}" style="background:${col(x.r)}" title="${H.esc(x.n)}: ${H.pct(x.r, 2)}, Rs ${H.num(x.mc)} cr"><b>${H.esc(x.s)}</b><span>${H.pct(x.r, 1)}</span></a>`).join('')}${b.v.length > 40 ? `<span class="hm-more">+${b.v.length - 40} more</span>` : ''}</div>
  </section>`).join('')}</div>
  <p class="sub legend">Prices from NSE's closing file. Facts only, not investment advice.</p>`;
}
export const hmSet = (k, v) => { HM[k] = Number(v); };

/* ---------------- compare two stocks (#/compare/A/B) ---------------- */
export async function viewCompare(helpers, a, b) {
  H = helpers;
  const D2 = await all();
  const { info, daily, asOf, fundAsOf } = D2.st;
  a = String(a || '').toUpperCase(); b = String(b || '').toUpperCase();
  const pick = (id, v, ph) => `<div class="tw-find cmp-find"><input id="${id}" type="search" autocomplete="off" spellcheck="false" value="${H.esc(v)}" placeholder="${ph}" aria-label="${ph}"><div class="tw-ac" id="${id}Ac" hidden></div></div>`;
  H.after(() => {
    const go = (which) => (s) => { const x = which === 'a' ? [s, b] : [a, s]; location.hash = `#/compare/${x.map((y) => encodeURIComponent(y || '')).join('/')}`; };
    D = D2;
    findBox($('#cmpA'), $('#cmpAAc'), go('a'));
    findBox($('#cmpB'), $('#cmpBAc'), go('b'));
    if (info[a] && info[b]) tvWidget('cmpChart', a, 'D', b);
  });
  const both = info[a] && info[b];
  const mf = D2.mf.stocks || {};
  const rowsDef = [
    ['Price', (d) => `Rs ${H.num(d.p, 2)}`],
    ...['1D', '1W', '1M', '3M', '6M', '1Y'].map((k, i) => [`Move ${k}`, (d) => `<span class="${H.tone((d.r || [])[i])}">${H.pct((d.r || [])[i], 1)}</span>`, (d) => (d.r || [])[i]]),
    ['From 52-week high', (d) => H.pct(d.hi, 1), (d) => d.hi],
    ['Relative strength (0 to 100)', (d) => H.num(d.rs), (d) => d.rs],
    ['Market cap', (d) => H.mcapCr(d.mc), (d) => d.mc],
    ['P/E', (d) => H.num(d.pe, 1)],
    ['P/B', (d) => H.num(d.pb, 1)],
    ['ROE', (d) => (d.roe == null ? '-' : `${H.num(d.roe, 1)}%`), (d) => d.roe],
    ['Debt / equity', (d) => (d.de == null ? '-' : `${H.num(d.de / 100, 2)}x`)],
    ['Dividend yield', (d) => (d.dy == null ? '-' : `${H.num(d.dy, 2)}%`), (d) => d.dy],
    ['Revenue growth', (d) => H.pct(d.rg, 1), (d) => d.rg],
    ['Profit growth', (d) => H.pct(d.eg, 1), (d) => d.eg],
    ['Above 20 / 50 / 200-day average', (d) => (d.dma || []).map((v) => (v ? 'yes' : 'no')).join(' / ') || '-'],
  ];
  const col = (s) => (info[s] ? `<a class="sym" href="#/" data-act="hmOpen" data-v="${H.esc(s)}">${H.esc(s)}</a>${H.extLinks(s)}<span class="sub">${H.esc(info[s].n)}</span><span class="sub">${H.esc(info[s].sec || '')}${info[s].ind ? ' &middot; ' + H.esc(info[s].ind) : ''}</span>` : '<span class="sub">Pick a stock</span>');
  const cell = (s, f) => (info[s] ? f(daily[s] || {}) : '');
  const hi = (def) => { if (!def[2] || !both) return ['', '']; const x = def[2](daily[a] || {}), y = def[2](daily[b] || {}); if (x == null || y == null || x === y) return ['', '']; return x > y ? ['cmp-hi', ''] : ['', 'cmp-hi']; };
  return `${H.pageHead('Research', 'Compare two stocks', fresh(asOf))}
  <div class="cmp-picks">${pick('cmpA', a, 'First stock (name or ticker)')}<span class="k-faint">and</span>${pick('cmpB', b, 'Second stock (name or ticker)')}</div>
  ${both ? `<section class="card flush"><div class="tw-chart cmp-chart" id="cmpChart"></div><p class="tw-note" style="padding:0 14px 10px">BSE listings (TradingView's public chart): ${H.esc(a)} candles on the right price scale, ${H.esc(b)} as a line on its own scale, so the two shapes can be read together.</p></section>` : ''}
  <section class="card flush"><div class="tbl-wrap"><table class="tbl cmp-tbl"><thead><tr><th></th><th>${col(a)}</th><th>${col(b)}</th></tr></thead><tbody>
    ${rowsDef.map((def) => { const [ha, hb] = hi(def); return `<tr><td class="k-muted">${def[0]}</td><td class="${ha}">${cell(a, def[1])}</td><td class="${hb}">${cell(b, def[1])}</td></tr>`; }).join('')}
    <tr><td class="k-muted">Mutual funds bought</td><td>${info[a] ? (mf[a] ? `${mf[a].mb} of ${(D2.mf.months || []).length} months` : 'not in the buy lists') : ''}</td><td>${info[b] ? (mf[b] ? `${mf[b].mb} of ${(D2.mf.months || []).length} months` : 'not in the buy lists') : ''}</td></tr>
  </tbody></table></div></section>
  <p class="sub legend">The higher of the two is marked on rows where higher is simply bigger (moves, strength, size, returns on equity, growth); it is not a judgement. Ratios updated ${H.fDate(fundAsOf)} and can lag the latest results. Not investment advice.</p>`;
}
