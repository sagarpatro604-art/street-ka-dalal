// Scanner workspace for Street ka Dalal (sandbox, 2026-11-21). Helpers for the one screen behind four doors (the screen
// itself is js/terminal.js):
//   - our own stock chart: candles, 10 / 20 / 50 / 200-day averages, the stage strip, volume coloured by what it says,
//     highest-volume and results markers, the resistance level; daily / weekly / monthly; small charts for grid view
//   - scan lists, group lists with their trend label, the one-line "why", the strip of numbers
//   - Market read card + market internals charts (Market page)
// Data: data/scan/*.json, built by the sandbox's build/scan_build.py from our own NSE data.
// Facts only: no buy / sell words, no entry / stop / target anywhere (SEBI). A level is "resistance", never a buy point.

import * as CH from './charts.js';

let H = null;
export function setHelpers(h) { H = h; }
const $ = (s, r = document) => r.querySelector(s);

/* ---------------- data ---------------- */
let SD = null;
export async function scanData() {
  if (SD) return SD;
  const [meta, rows, lists, market, groups] = await Promise.all(['meta', 'rows', 'lists', 'market', 'groups'].map((k) => H.hist('scan/' + k).catch(() => null)));
  SD = { meta: meta || {}, rows: rows?.rows || {}, lists: lists?.lists || [], market, groups, asOf: rows?.as_of };
  return SD;
}
export const row = (sym) => SD?.rows?.[sym] || null;

export const STAGE = {
  2: ['Stage 2 Uptrend', 'st2'], 21: ['Stage 2A Early uptrend', 'st2a'], 3: ['Stage 3 Topping', 'st3'], 31: ['Stage 3A Weakening', 'st3a'],
  4: ['Stage 4 Downtrend', 'st4'], 41: ['Stage 4A Improving', 'st4a'], 1: ['Stage 1 Basing', 'st1'], 0: ['Not enough history', 'st0'],
};
const STAGE_COL = { 2: '#7fbf3a', 21: '#a6cf63', 3: '#e3b23c', 31: '#e8c76a', 4: '#df5f5f', 41: '#e08b8b', 1: '#c9b47a', 0: 'rgba(128,128,128,0.25)' };
export const stageChip = (s) => { const x = STAGE[s] || STAGE[0]; return `<span class="st-chip ${x[1]}" title="${x[0]}">${x[0].replace(/^Stage /, '')}</span>`; };

/* ---------------- stage, same rule as the builder (build/logic.py) ---------------- */
const STAGE_MA = { D: [50, 120, 200], W: [10, 30, 40], ipo: [16, 39, 64] };
const STAGE_RUN = { D: 12, W: 8, ipo: 12 };
function sma(a, n) {
  const out = new Array(a.length).fill(null);
  let s = 0;
  for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) out[i] = s / n; }
  return out;
}
function stageRun(c, mode) {
  const [sn, mn, ln] = STAGE_MA[mode], need = STAGE_RUN[mode];
  const a = sma(c, sn), m = sma(c, mn), lg = sma(c, ln), st = new Array(c.length).fill(0);
  let p = 0, broken = false, prev = false, armed = false;
  for (let t = 0; t < c.length; t++) {
    const n = c[t], i = a[t], r = m[t], o = lg[t];
    if (i == null || r == null || o == null) continue;
    if (prev && (n < i || n < o)) broken = true;
    const reclaim = broken && n > i && n > o;
    p = reclaim ? 1 : n > o && prev ? p + 1 : n > o ? 1 : 0;
    if (reclaim) broken = false;
    prev = n > o;
    const top = (p >= need || armed) && n > o && n < i;
    if (top) armed = true;
    if (n < o) armed = false;
    st[t] = top && n < r ? 3 : top ? 31 : n < o && n > r && n > i ? 1 : n < o && n > i && n < r ? 41 : n < o ? 4 : p >= need ? 2 : n > o ? 21 : 0;
  }
  return st;
}
export function stages(c, tf) {
  if (tf === 'W') return stageRun(c, 'W');
  if (tf === 'M') return c.map(() => 0);
  if (c.length < 64) return c.map(() => 0);
  const out = stageRun(c, 'ipo');
  if (c.length >= 200) { const d = stageRun(c, 'D'); for (let t = 199; t < c.length; t++) out[t] = d[t]; }
  return out;
}

/* ---------------- volume: what each bar's volume says ---------------- */
// up day = close above the previous close; average = 50 bars. Pocket pivot = up day with more volume than any down day
// of the 10 bars before. Highest in a quarter (63 bars) / a year (252) / all bars shown; lowest the same way.
export function volumeSignals(bars) {
  const v = bars.map((b) => b.v || 0);
  const out = [];
  let run = null, sum = 0;
  for (let t = 0; t < bars.length; t++) {
    sum += v[t]; if (t >= 50) sum -= v[t - 50];
    const avg = sum / Math.min(t + 1, 50);
    const up = t > 0 && bars[t].c > bars[t - 1].c, down = t > 0 && bars[t].c < bars[t - 1].c;
    let maxDown = null;
    for (let k = Math.max(1, t - 10); k < t; k++) if (bars[k].c < bars[k - 1].c && (maxDown == null || v[k] > maxDown)) maxDown = v[k];
    const win = (n, f) => { if (t < n) return null; let x = f === 'max' ? -Infinity : Infinity; for (let k = t - n; k < t; k++) x = f === 'max' ? Math.max(x, v[k]) : Math.min(x, v[k]); return x; };
    const has = v[t] > 0;
    const ever = has && (run == null || v[t] > run);
    if (has) run = run == null ? v[t] : Math.max(run, v[t]);
    const yH = win(252, 'max'), qH = win(63, 'max'), yL = win(252, 'min'), qL = win(63, 'min');
    const hy = has && !ever && yH != null && v[t] > yH, hq = has && !ever && !hy && qH != null && v[t] > qH;
    const ly = has && yL != null && v[t] < yL, lq = has && !ly && qL != null && v[t] < qL;
    const pp = has && up && maxDown != null && v[t] > maxDown;
    const aUp = has && up && v[t] > avg, aDn = has && down && v[t] > avg, dry = has && v[t] <= avg / 5;
    const hi = (ever && t > 0) ? 'HVA' : hy ? 'HVY' : hq ? 'HVQ' : '';
    out.push({ up, pp, aUp, aDn, dry, hi: hi && up ? hi : '', lo: ly ? 'Y' : lq ? 'Q' : '', avg });
  }
  return out;
}
const VOL_WORD = { HVA: 'Highest volume in the bars shown', HVY: 'Highest volume in a year', HVQ: 'Highest volume in a quarter' };

/* ---------------- daily -> weekly / monthly ---------------- */
function weekKey(d) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); }
function toBars(f, tf) {
  const out = [];
  let cur = null, key = null;
  for (let i = 0; i < f.d.length; i++) {
    if (f.c[i] == null) continue;
    const k = tf === 'D' ? f.d[i] : tf === 'W' ? weekKey(f.d[i]) : f.d[i].slice(0, 7);
    const o = f.o[i] ?? f.c[i], h = f.h[i] ?? f.c[i], l = f.l[i] ?? f.c[i], v = f.v[i] || 0;
    if (k !== key) { if (cur) out.push(cur); cur = { t: f.d[i], k, o, h, l, c: f.c[i], v, last: f.d[i] }; key = k; }
    else { cur.h = Math.max(cur.h, h); cur.l = Math.min(cur.l, l); cur.c = f.c[i]; cur.v += v; cur.last = f.d[i]; }
  }
  if (cur) out.push(cur);
  return out;
}

/* ---------------- the stock chart ---------------- */
let CUR = null, curSeq = 0;
const MA_SET = { D: [[10, 'ma10'], [20, 'ma20'], [50, 'ma50'], [200, 'ma200']], W: [[10, 'ma10'], [30, 'ma50'], [40, 'ma200']], M: [[10, 'ma10'], [20, 'ma20']] };
const maCol = () => ({ ma10: CH.C.plum, ma20: CH.C.orange, ma50: CH.C.blue, ma200: CH.C.gold });
const fmtV = (v) => (v >= 1e7 ? `${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)} L` : v >= 1e3 ? `${(v / 1e3).toFixed(1)} K` : String(v));

// chart files: on the live site from the force-pushed 'charts' branch (like results' 'co' branch: 1,700+ files that
// change every evening would bloat the main branch and use up Cloudflare deploys); on localhost from the sandbox folder
const CHART_URL = 'https://raw.githubusercontent.com/sagarpatro604-art/street-ka-dalal/charts/c/';
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const chartCache = new Map();
async function chartFile(sym) {
  if (LOCAL) return H.hist('scan/c/' + sym);
  if (chartCache.has(sym)) return chartCache.get(sym);
  const r = await fetch(`${CHART_URL}${encodeURIComponent(sym)}.json?d=${encodeURIComponent(SD?.asOf || '')}`);
  if (!r.ok) throw new Error('no chart');
  const d = await r.json();
  chartCache.set(sym, d);
  return d;
}

export async function drawStock(id, sym, tf = 'D') {
  const el = document.getElementById(id);
  if (!el) return;
  const seq = ++curSeq;
  el.innerHTML = '<div class="loading"><span class="dots"><i></i><i></i><i></i></span></div>';
  let f;
  try { f = await chartFile(sym); } catch { if (seq === curSeq) el.innerHTML = `<div class="tw-empty">No chart for ${H.esc(sym)}: we draw stocks trading Rs 50 lakh or more a day.</div>`; return; }
  let L;
  try { L = await CH.lw(); } catch (e) { el.innerHTML = `<div class="chart-err">Chart could not load (${H.esc(e.message)}). Check your internet and refresh.</div>`; return; }
  if (seq !== curSeq || !el.isConnected) return;
  if (CUR) { CH.untrack(CUR); CUR = null; }
  el.innerHTML = '';
  el.classList.add('sc-chart');
  const bars = toBars(f, tf);
  if (!bars.length) { el.innerHTML = '<div class="tw-empty">No prices yet.</div>'; return; }
  const C = CH.C, closes = bars.map((b) => b.c);
  const st = stages(closes, tf);
  const vs = volumeSignals(bars);
  const ch = CH.track(L.createChart(el, {
    autoSize: true,
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: C.muted, fontFamily: '"IBM Plex Mono", Consolas, monospace', fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.06, bottom: 0.27 } },
    timeScale: { borderVisible: false, rightOffset: 6, barSpacing: tf === 'D' ? 6 : 9 },
    crosshair: { mode: 0, vertLine: { color: C.gold, labelBackgroundColor: C.green }, horzLine: { color: C.gold, labelBackgroundColor: C.green } },
    localization: { locale: 'en-IN' },
    handleScroll: { vertTouchDrag: false },
  }));
  CUR = ch;
  const candle = ch.addCandlestickSeries({ upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down, priceLineVisible: false });
  candle.setData(bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
  const mc = maCol();
  const maLines = MA_SET[tf].map(([n, k]) => {
    const s = ch.addLineSeries({ color: mc[k], lineWidth: n >= 50 ? 2 : 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const a = sma(closes, n);
    s.setData(bars.map((b, i) => (a[i] == null ? null : { time: b.t, value: a[i] })).filter(Boolean));
    return [n, a];
  });
  const vcol = (x) => (x.hi ? C.blue : x.pp ? C.blue : x.aDn ? C.down : x.aUp ? C.up : x.dry || x.lo ? C.orange : 'rgba(140,140,140,0.35)');
  const vol = ch.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false });
  vol.setData(bars.map((b, i) => ({ time: b.t, value: b.v, color: vcol(vs[i]) })));
  ch.priceScale('vol').applyOptions({ scaleMargins: { top: 0.76, bottom: 0.035 } });
  if (tf !== 'M') {
    const band = ch.addHistogramSeries({ priceScaleId: 'stage', priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'custom', formatter: () => '' } });
    band.setData(bars.map((b, i) => ({ time: b.t, value: 1, color: STAGE_COL[st[i]] || STAGE_COL[0] })));
    ch.priceScale('stage').applyOptions({ scaleMargins: { top: 0.975, bottom: 0 }, visible: false });
  }
  // markers: highest volume above the bar, results filing below it
  const marks = [];
  vs.forEach((x, i) => { if (x.hi) marks.push({ time: bars[i].t, position: 'aboveBar', color: C.blue, shape: 'circle', size: 0.6, text: x.hi.replace('HVA', 'HV') }); });
  const resDays = new Set();
  (f.res || []).forEach((d) => {
    const i = bars.findIndex((b) => b.last >= d);
    if (i >= 0 && !resDays.has(bars[i].t)) { resDays.add(bars[i].t); marks.push({ time: bars[i].t, position: 'belowBar', color: C.gold, shape: 'square', size: 0.7, text: 'R' }); }
  });
  marks.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  candle.setMarkers(marks);
  const rr = row(sym);
  if (rr?.res) candle.createPriceLine({ price: rr.res, color: C.gold, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Resistance' });
  const n = bars.length, show = tf === 'D' ? 160 : tf === 'W' ? 110 : n;
  ch.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - show), to: n + 4 });
  // hover read-out
  const leg = document.createElement('div');
  leg.className = 'sc-leg';
  el.append(leg);
  const paint = (i) => {
    const b = bars[i];
    if (!b) return;
    const x = vs[i], s = STAGE[st[i]] || STAGE[0];
    const chg = i > 0 ? (b.c / bars[i - 1].c - 1) * 100 : null;
    const words = [x.hi && VOL_WORD[x.hi], x.pp && 'Pocket pivot', x.lo && (x.lo === 'Y' ? 'Lowest volume in a year' : 'Lowest volume in a quarter'), x.dry && !x.lo && 'Dry volume'].filter(Boolean);
    leg.innerHTML = `<span class="d">${H.fDate(b.t)}${tf !== 'D' ? ' (' + (tf === 'W' ? 'week' : 'month') + ')' : ''}</span>
      <span class="x2">O <b>${H.num(b.o, 2)}</b></span><span class="x2">H <b>${H.num(b.h, 2)}</b></span><span class="x2">L <b>${H.num(b.l, 2)}</b></span><span>C <b>${H.num(b.c, 2)}</b></span>
      ${chg == null ? '' : `<span class="${H.tone(chg)}">${H.pct(chg, 2)}</span>`}<span class="x2">Vol <b>${fmtV(b.v)}</b>${x.avg ? ` <small>${(b.v / x.avg).toFixed(1)}x avg</small>` : ''}</span>
      ${tf !== 'M' ? `<span class="st-dot" style="--c:${STAGE_COL[st[i]]}">${s[0]}</span>` : ''}${words.length ? `<span class="vw">${words.join(' &middot; ')}</span>` : ''}
      ${resDays.has(b.t) ? '<span class="vw">Results filed</span>' : ''}
      <span class="mas">${maLines.map(([k, a]) => (a[i] == null ? '' : `<i style="--c:${mc[MA_SET[tf].find((m) => m[0] === k)[1]]}">${tf === 'D' ? k + 'D' : tf === 'W' ? k + 'W' : k + 'M'} ${H.num(a[i], 1)}</i>`)).join('')}</span>`;
  };
  paint(n - 1);
  ch.subscribeCrosshairMove((p) => {
    if (!p || !p.time) { paint(n - 1); return; }
    const i = bars.findIndex((b) => b.t === p.time);
    paint(i >= 0 ? i : n - 1);
  });
}

// the line under the chart: what the colours and letters mean
export const chartKey = () => `<p class="tw-note sc-key"><b>How to read it:</b> candles from NSE's daily prices (split-adjusted).
  Lines: <i class="k" style="--c:${CH.C.plum}"></i>10, <i class="k" style="--c:${CH.C.orange}"></i>20, <i class="k" style="--c:${CH.C.blue}"></i>50, <i class="k" style="--c:${CH.C.gold}"></i>200-day averages (weekly: 10 / 30 / 40 weeks).
  Volume bars: <i class="k" style="--c:${CH.C.blue}"></i>pocket pivot or highest volume
  (<b>HVQ</b> quarter, <b>HVY</b> year, <b>HV</b> all bars shown), <i class="k" style="--c:${CH.C.up}"></i>above-average up day, <i class="k" style="--c:${CH.C.down}"></i>above-average down day,
  <i class="k" style="--c:${CH.C.orange}"></i>dry or lowest volume. <b>R</b> = results filed. The thin strip at the bottom is the stage
  (<i class="k" style="--c:${STAGE_COL[2]}"></i>2 uptrend, <i class="k" style="--c:${STAGE_COL[1]}"></i>1 basing / 3 topping, <i class="k" style="--c:${STAGE_COL[4]}"></i>4 downtrend).
  The dashed line is the resistance level (highest high of the 60 sessions before the last 3), a level to watch, not a buy point.</p>`;

/* ---------------- one strip of numbers under the chart ---------------- */
export function oneStrip(sym, d) {
  const x = row(sym) || {};
  const r = d?.r || [];
  const it = (b, v) => `<span><b>${b}</b>${v}</span>`;
  const tn = (v, dd = 1) => `<em class="${H.tone(v)}">${H.pct(v, dd)}</em>`;
  return `<div class="tw-strip sc-strip">
    ${['1D', '1W', '1M', '3M', '6M', '1Y'].map((k, i) => it(k, tn(r[i]))).join('')}
    ${it('RS rating', `${H.num(x.rs)}${x.rsm ? ` <small class="${H.tone(x.rsm)}">${x.rsm > 0 ? '+' : ''}${x.rsm} in 1M</small>` : ''}`)}
    ${it('Stage', stageChip(x.st))}
    ${it('Day range', `${H.num(x.adr, 1)}%`)}${it('Volume', `${H.num(x.rv, 1)}x avg`)}${it('Traded', `Rs ${H.num(x.tv, 1)} cr a day`)}
    ${it('From 52W high', H.pct(x.fh, 1))}${x.res ? it('Resistance', `${H.num(x.res, 2)} <small>${H.num(x.resd, 1)}% above</small>`) : ''}
    ${it('Mcap', H.mcapCr(d?.mc))}${it('P/E', H.num(d?.pe, 1))}
    ${x.ey != null || x.sy != null ? it(`Quarter${x.q ? ' ' + H.esc(x.q) : ''}`, `EPS ${H.pct(x.ey, 0)}, sales ${H.pct(x.sy, 0)} yoy`) : ''}
  </div>`;
}

/* ---------------- why a stock is on a scan: one line ---------------- */
const XLABEL = { rs_chg: ['RS', (v) => `up ${v} points in a month`], from_hi: ['', (v) => `${v}% from its high`], res: ['resistance', (v) => H.num(v, 2)],
  res_dist: ['', (v) => `${v}% under resistance`], range: ['range', (v) => `${v}%`], chg: ['', (v) => `up ${v}% today`], rvol: ['volume', (v) => `${v}x normal`],
  hv: ['highest volume in', (v) => ({ quarter: 'a quarter', year: 'a year', all: '4 years' }[v] || v)], gap: ['gap', (v) => `${v}% at the open`], move: ['moved', (v) => `${v}% that day`],
  q: ['quarter', (v) => v], eps_yoy: ['EPS', (v) => `${v}% yoy`], sales_yoy: ['sales', (v) => `${v}% yoy`], r: ['return', (v) => `${v}%`], listed: ['listed', (v) => H.fDate(v)],
  locked: ['', (v) => (v ? 'closed locked at the band' : 'touched the band, closed off it')], days: ['', (v) => `${v} day${v === 1 ? '' : 's'} in a row`], band: ['band', (v) => `${v}%`] };
export const listExtra = (id) => (SD?.lists || []).find((x) => 'sc:' + x.id === id)?.x || null;
export function whyLine(list, sym) {
  if (!list?.scan) return '';
  const x = listExtra(list.id)?.[sym] || {};
  const bits = Object.entries(x).filter(([k, v]) => v != null && XLABEL[k]).map(([k, v]) => `${XLABEL[k][0]} ${H.esc(String(XLABEL[k][1](v)))}`.trim());
  return `<p class="tw-whyline"><b>On "${H.esc(list.n)}"</b>${bits.length ? ': ' + bits.join(' &middot; ') : ''}</p>`;
}
export const liquidNote = () => `Only stocks with ${SD?.meta?.liquid_scan || 'Rs 1 crore+ traded a day'}`;

/* ---------------- scan lists (the Screeners door) ---------------- */
export function scanLists(info) {
  return (SD?.lists || []).map((l) => ({ id: 'sc:' + l.id, n: l.n, about: l.about, syms: () => l.syms.filter((s) => info[s]) }));
}

/* ---------------- groups (the Groups door) ---------------- */
export const GROUP_LABELS = ['Leading', 'Emerging', 'Resting', 'Bounce', 'Fading', 'Weak'];
export const groupAbout = (t) => SD?.meta?.group_about?.[t] || '';
const TREND_TONE = { Leading: 'ok', Emerging: 'info', Resting: 'plain', Bounce: 'info', Fading: 'warn', Weak: 'bad' };
export const trendPill = (t) => (t ? `<span class="k-pill ${TREND_TONE[t] || 'plain'}" title="${H.esc(groupAbout(t))}">${H.esc(t)}</span>` : '');
const LV = { sector: ['sec:', 'Sectors'], industry: ['ind:', 'Industries'], theme: ['th:', 'Themes'] };
export function groupLists(info, lvl) {
  const [pre, title] = LV[lvl] || LV.sector;
  return (SD?.groups?.[lvl] || []).map((g) => ({ id: pre + g.name, g: title, n: g.name, trend: g.trend, grp: g,
    about: `${g.n} stocks trading Rs 50 lakh+ a day, best 1-month move first.${g.trend ? ` ${g.trend}: ${groupAbout(g.trend).toLowerCase()}.` : ' Too few stocks to rank.'}`,
    syms: () => (g.m || []).filter((s) => info[s]) }));
}
export const sectorTrend = (sec) => (SD?.groups?.sector || []).find((g) => g.name === sec)?.trend || null;
export function groupAboutHTML(list) {
  const g = list?.grp;
  if (!g) return '';
  const ret = (k) => `<span class="${H.tone(g.ret?.[k])}">${H.pct(g.ret?.[k], 1)}</span>`;
  return `<div class="ret-grid">${[['1D', '1'], ['1W', '5'], ['1M', '21'], ['3M', '63'], ['6M', '126'], ['1Y', '252']].map(([t, k]) => `<div><span>${t}</span><b>${ret(k)}</b></div>`).join('')}</div>
    <dl class="kv"><dt>Trend</dt><dd>${trendPill(g.trend) || 'too few stocks to rank'}${g.trend_wk && g.trend_wk !== g.trend ? ` <span class="sub inline">was ${H.esc(g.trend_wk)} a week ago</span>` : ''}</dd>
      <dt>1-month rank</dt><dd>${g.rank ? `${g.rank}${g.rank_chg ? ` <span class="${H.tone(g.rank_chg)}">(${g.rank_chg > 0 ? 'up' : 'down'} ${Math.abs(g.rank_chg)} in a week)</span>` : ''}` : '-'}</dd>
      <dt>Above 50-day average</dt><dd>${H.num(g.a50)}% of its stocks</dd><dt>Above 200-day average</dt><dd>${H.num(g.a200)}%</dd>
      <dt>Within 10% of 52W high</dt><dd>${H.num(g.nh)}%</dd><dt>In Stage 2</dt><dd>${H.num(g.s2)}%</dd></dl>
    <p class="sub">Group moves are the median of member stocks. Each group is ranked on 1, 3 and 6-month moves against every other group with 5 or more stocks: top third = strong, bottom half = weak.</p>`;
}

/* ---------------- small charts for grid view ---------------- */
let MINI = [];
export function disposeMini() { MINI.forEach((c) => CH.untrack(c)); MINI = []; }
export async function miniChart(id, sym) {
  const el = document.getElementById(id);
  if (!el) return;
  let f, L;
  try { [f, L] = await Promise.all([chartFile(sym), CH.lw()]); } catch { el.innerHTML = '<div class="tw-empty">No chart</div>'; return; }
  if (!el.isConnected) return;
  const all = toBars(f, 'D');
  const closes = all.map((b) => b.c);
  const st = stages(closes, 'D');
  const a50 = sma(closes, 50), a200 = sma(closes, 200);
  const from = Math.max(0, all.length - 130);
  const bars = all.slice(from);
  const C = CH.C;
  const ch = CH.track(L.createChart(el, { autoSize: true, layout: { background: { type: 'solid', color: 'transparent' }, textColor: C.muted, fontSize: 10, fontFamily: '"IBM Plex Mono", Consolas, monospace' },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } }, rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
    timeScale: { borderVisible: false, visible: false }, crosshair: { mode: 0 }, handleScroll: false, handleScale: false }));
  MINI.push(ch);
  const cs = ch.addCandlestickSeries({ upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down, priceLineVisible: false, lastValueVisible: false });
  cs.setData(bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
  [[a50, C.blue], [a200, C.gold]].forEach(([a, col]) => { const s = ch.addLineSeries({ color: col, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }); s.setData(bars.map((b, i) => (a[from + i] == null ? null : { time: b.t, value: a[from + i] })).filter(Boolean)); });
  const vs = volumeSignals(all).slice(from);
  const v = ch.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false });
  v.setData(bars.map((b, i) => ({ time: b.t, value: b.v, color: vs[i].pp || vs[i].hi ? C.blue : vs[i].aDn ? C.down : vs[i].aUp ? C.up : 'rgba(140,140,140,0.35)' })));
  ch.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0.03 } });
  const band = ch.addHistogramSeries({ priceScaleId: 'stage', priceLineVisible: false, lastValueVisible: false });
  band.setData(bars.map((b, i) => ({ time: b.t, value: 1, color: STAGE_COL[st[from + i]] || STAGE_COL[0] })));
  ch.priceScale('stage').applyOptions({ scaleMargins: { top: 0.975, bottom: 0 }, visible: false });
  const rr = row(sym);
  if (rr?.res) cs.createPriceLine({ price: rr.res, color: C.gold, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
  ch.timeScale().fitContent();
}

/* ---------------- Market page: market read + internals ---------------- */
const TONE = { Up: 'ok', Positive: 'ok', Working: 'ok', 'Small caps leading': 'ok', Down: 'bad', Negative: 'bad', Failing: 'bad', 'Washed out': 'bad',
  Building: 'warn', Fading: 'warn', Caution: 'warn', Stretched: 'warn', 'Near washed out': 'warn', 'Near stretched': 'warn' };
const pill = (t) => `<span class="k-pill ${TONE[t] || 'info'}">${H.esc(t || '-')}</span>`;
export function marketReadCard() {
  const m = SD?.market;
  if (!m?.read) return '';
  const r = m.read, last = m.rows[m.rows.length - 1];
  const say = {
    big: { Up: 'Most stocks are in long-term uptrends.', Down: 'The bigger picture is weak: most stocks are under their 200-day average.', Neutral: 'The long-term picture is mixed.' },
    short: { Up: 'The last few weeks have been strong: most stocks are above their 20-day average and new highs beat new lows.', Down: 'The last few weeks have been weak.', Mixed: 'The last few weeks are mixed.' },
    mom: { Positive: 'Big up days outnumber big down days this week and over two weeks.', Negative: 'Big down days outnumber big up days.', Building: 'Big up days are picking up this week.', Fading: 'Buying is fading: this week turned weaker after a good run.' },
    bo: { Working: 'Most fresh breakouts are holding above their level.', Failing: 'Most fresh breakouts are slipping back under their level.', Mixed: 'Breakouts are holding about half the time.', 'Too few': 'Too few breakouts in 20 days to judge.' },
  };
  const capsTxt = r.caps_ret ? `Last 20 sessions: large ${H.pct(r.caps_ret.Large, 1)}, mid ${H.pct(r.caps_ret.Mid, 1)}, small ${H.pct(r.caps_ret.Small, 1)}.` : '';
  const line = (name, lab, txt, num) => `<div class="mr-line"><div class="mr-h"><b>${name}</b>${pill(lab)}</div><p>${txt}</p>${num ? `<p class="sub">${num}</p>` : ''}</div>`;
  return `<section class="card mr-card"><div class="card-head"><h2>Market read</h2><span class="sub">${H.esc(m.universe)} &middot; as of ${H.fDate(last.d)} &middot; a label changes only after 2 days in a row</span></div>
    <div class="mr-grid">
      ${line('Big trend', r.big, say.big[r.big] || '', `${H.num(r.p200, 1)}% above the 200-day average &middot; Stage 2: ${H.num(last.s2)} vs Stage 4: ${H.num(last.s4)}`)}
      ${line('Short term', r.short, say.short[r.short] || '', `${H.num(r.p20, 1)}% above the 20-day average &middot; 20-day highs ${H.num(r.nh)} vs lows ${H.num(r.nl)}`)}
      ${line('Momentum', r.mom, say.mom[r.mom] || '', `Stocks up 4%+ for every stock down 4%+: ${H.num(r.r5, 2)} over 5 days, ${H.num(r.r10, 2)} over 10 days`)}
      ${line('Breakouts', r.bo, say.bo[r.bo] || '', r.bo_pct == null ? '' : `${H.num(r.bo_pct, 0)}% of the last 20 days' breakouts (first close above the 20-day high) still held 5 sessions later`)}
      ${line('Size', r.caps, r.caps === 'Even' ? 'Large, mid and small caps are moving together.' : `${H.esc(r.caps)} over the last 20 sessions.`, capsTxt)}
      ${line('Small-cap heat', r.over_word, r.over_word === 'Stretched' || r.over_word === 'Near stretched' ? 'Small caps are far above their 50-day average compared with their own past year.' : r.over_word === 'Washed out' || r.over_word === 'Near washed out' ? 'Small caps are far below their 50-day average compared with their own past year.' : r.over_word === 'Caution' ? 'Small caps sit close to their 50-day average: no stretch either way.' : 'Small caps are in a normal range around their 50-day average.',
        r.oh_gap == null ? '' : `Nifty Smallcap 250 is ${H.pct(r.oh_gap, 1)} from its 50-day average (score ${H.num(r.oh, 0)} on a -100 to +100 scale of its own year)`)}
    </div>
    <p class="sub">Facts about the whole market, not advice. Breadth counts liquid NSE stocks only.</p></section>`;
}

let mrRange = '6M';
export const setMrRange = (v) => { mrRange = v; };
export function internalsCard() {
  if (!SD?.market?.rows?.length) return '';
  return `<section class="card" id="intCard"><div class="card-head"><h2>Market internals</h2><span class="sub">liquid NSE stocks, end of day</span>
    <div class="seg">${['3M', '6M', '1Y'].map((k) => `<button class="${k === mrRange ? 'on' : ''}" data-act="mrRange" data-v="${k}">${k}</button>`).join('')}</div></div>
    <div class="int-grid">
      <div><h3>Participation</h3><p class="sub">Share of stocks above their 20, 50 and 200-day averages</p><div class="chart-legend" id="intLeg1"></div><div class="chart-box short" id="int1"></div></div>
      <div><h3>New highs minus new lows</h3><p class="sub">Bars: closes at a 20-day high minus 20-day lows &middot; line: the same for 52 weeks</p><div class="chart-legend" id="intLeg2"></div><div class="chart-box short" id="int2"></div></div>
      <div><h3>4% movers</h3><p class="sub">Stocks up 4%+ minus stocks down 4%+, each day</p><div class="chart-legend" id="intLeg3"></div><div class="chart-box short" id="int3"></div></div>
      <div><h3>Breakouts held minus failed</h3><p class="sub">Breakouts 5 sessions old that held their level minus those that slipped back</p><div class="chart-legend" id="intLeg4"></div><div class="chart-box short" id="int4"></div></div>
      <div><h3>Stage 2 vs Stage 4</h3><p class="sub">Share of stocks in uptrends and in downtrends</p><div class="chart-legend" id="intLeg5"></div><div class="chart-box short" id="int5"></div></div>
      <div><h3>Large vs mid vs small</h3><p class="sub">Nifty 50, Midcap 150, Smallcap 250, each set to 100 at the start</p><div class="chart-legend" id="intLeg6"></div><div class="chart-box short" id="int6"></div></div>
    </div></section>`;
}
export async function drawInternals() {
  const m = SD?.market;
  if (!m || !$('#int1')) return;
  const keep = { '3M': 63, '6M': 126, '1Y': 252 }[mrRange] || 126;
  const key = (id, items) => { const el = $(id); if (el) el.innerHTML = items.map(([t, c, dash]) => `<span><i style="background:${c}${dash ? ';opacity:.6' : ''}"></i>${t}</span>`).join(''); };
  const K = CH.C;
  key('#intLeg1', [['20-day', K.orange], ['50-day', K.gold], ['200-day', K.green2], ['Nifty 500 (left)', '#8a8f86', 1]]);
  key('#intLeg2', [['20-day', K.up], ['52-week', K.gold]]);
  key('#intLeg3', [['More up 4%+', K.up], ['More down 4%+', K.down]]);
  key('#intLeg4', [['More held', K.up], ['More failed', K.down]]);
  key('#intLeg5', [['Stage 2', K.up], ['Stage 4', K.down]]);
  key('#intLeg6', [['Large', K.blue], ['Mid', K.gold], ['Small', K.plum]]);
  const rows = m.rows.slice(-keep);
  const i0 = m.rows.length - rows.length;
  const C = CH.C;
  const ser = (f) => rows.map((x) => ({ time: x.d, value: f(x) }));
  const hist = (f) => rows.map((x) => { const v = f(x); return { time: x.d, value: v, color: v >= 0 ? C.up : C.down }; });
  const n500 = rows.map((x, i) => ({ time: x.d, value: m.idx.n500[i0 + i] }));
  const pc = (v) => `${v.toFixed(1)}%`;
  await CH.timeChart($('#int1'), [{ name: '20-day', type: 'line', color: C.orange, width: 1, data: ser((x) => x.p20), fmt: pc }, { name: '50-day', type: 'line', color: C.gold, data: ser((x) => x.p50), fmt: pc },
    { name: '200-day', type: 'line', color: C.green2, data: ser((x) => x.p200), fmt: pc }, { name: 'Nifty 500', type: 'line', color: '#8a8f86', dashed: true, width: 1, scale: 'left', data: n500, fmt: (v) => H.num(v, 0) }], { percent: true, legend: $('#intLeg1') });
  await CH.timeChart($('#int2'), [{ name: '20-day highs minus lows', type: 'hist', axis: (v) => H.num(v), data: hist((x) => x.nh - x.nl), fmt: (v) => H.num(v) },
    { name: '52-week highs minus lows', type: 'line', color: C.gold, width: 1, axis: (v) => H.num(v), data: ser((x) => x.nh52 - x.nl52), fmt: (v) => H.num(v) }], { legend: $('#intLeg2') });
  await CH.timeChart($('#int3'), [{ name: 'Up 4%+ minus down 4%+', type: 'hist', axis: (v) => H.num(v), data: hist((x) => x.up4 - x.dn4), fmt: (v) => H.num(v) }], { legend: $('#intLeg3') });
  await CH.timeChart($('#int4'), [{ name: 'Held minus failed', type: 'hist', axis: (v) => H.num(v), data: hist((x) => x.bo_held - (x.bo_res - x.bo_held)), fmt: (v) => H.num(v) }], { legend: $('#intLeg4') });
  await CH.timeChart($('#int5'), [{ name: 'Stage 2', type: 'line', color: C.up, data: ser((x) => (x.s2 * 100) / x.n), fmt: pc }, { name: 'Stage 4', type: 'line', color: C.down, data: ser((x) => (x.s4 * 100) / x.n), fmt: pc }], { percent: true, legend: $('#intLeg5') });
  const reb = (k) => { const a = rows.map((x, i) => m.idx[k][i0 + i]); const b = a.find((v) => v != null); return rows.map((x, i) => ({ time: x.d, value: a[i] == null || !b ? null : (a[i] / b) * 100 })); };
  const ax = (v) => v.toFixed(0);
  await CH.timeChart($('#int6'), [{ name: 'Large', type: 'line', color: C.blue, axis: ax, data: reb('n50'), fmt: (v) => v.toFixed(1) }, { name: 'Mid', type: 'line', color: C.gold, axis: ax, data: reb('mid'), fmt: (v) => v.toFixed(1) }, { name: 'Small', type: 'line', color: C.plum, axis: ax, data: reb('small'), fmt: (v) => v.toFixed(1) }], { legend: $('#intLeg6') });
}

