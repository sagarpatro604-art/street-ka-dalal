// Results Plus (Sagar 2026-11-21: "earning pulse add in street ka dalal"): what the price did after results.
//   Reactions: every result's gap at the open (held or filled), result-day move, move since, against the stock's own
//              usual daily range; lists of the season's biggest moves, breakouts, mismatches, guidance changes.
//   Sectors after results: sectors / industries / themes ranked by the move after their companies reported + a map.
//   Profit pool: Nifty 500 profit added up (same companies both years), with and without oil refiners, by size, who drove it.
//   Guidance changes: raised / kept / cut, the earlier figure beside the new one, quoted word for word.
//   Season report: one page per results season.
//   Stock pages: results and the price after, and checks read from the company's own filings.
// Data: data/eplus/*.json, built by Desktop\Sandbox\earnings-plus (ep/skd.py) from NSE filings and prices.
// Facts only: no buy / sell words, no targets (SEBI). No emoji, no em dash, no tilde.

let H = null;
const $ = (s, r = document) => r.querySelector(s);
const SECS = [['list', 'Reactions after results'], ['sectors', 'Sectors after results'], ['pool', 'Profit pool'], ['guidance', 'Guidance changes'], ['season', 'Season report']];
const load = (n) => H.hist('eplus/' + n);
const LAB = { Strong: 'good', Good: 'good', Mixed: 'warn', Weak: 'bad' };
const BUCKET = { pre: 'before market', market: 'during market', post: 'after market' };
const GAPS = { held: 'held', part: 'partly held', filled: 'filled' };
const VD = { look: ['Look closer', 'bad'], note: ['Note', 'warn'], ok: ['OK', 'good'], na: ['n/a', ''], info: ['Info', ''] };
const qlab = (q) => (q && q.length === 6 ? `Q${q[5]} FY${q.slice(2, 4)}` : q || '');
const lab = (l) => (l ? `<span class="chip rp-${LAB[l] || ''}">${H.esc(l)}</span>` : '');
const p = (v, d = 1) => (v == null ? '<span class="sub inline">-</span>' : `<span class="${H.tone(v)}">${H.pct(v, d)}</span>`);
const xr = (v) => (v == null ? '<span class="sub inline">-</span>' : `<span class="${H.tone(v)}">${v > 0 ? '+' : ''}${Number(v).toFixed(1)}x</span>`);
const nav = (cur, q) => `<nav class="dc-nav">${SECS.map(([k, t]) => `<a href="#/resplus/${k}${q && k !== 'list' ? '/' + q : ''}" class="${k === cur ? 'on' : ''}">${t}</a>`).join('')}</nav>`;
const head = (cur, title, extra = '') => `${H.pageHead('Results', title, extra)}${nav(cur)}`;
const built = (s) => (s?.built ? `<span class="k-pill plain" title="When this was put together">Updated ${H.fShort(String(s.built).slice(0, 10))}</span>` : '');
const note = '<p class="sub legend">From NSE result filings, NSE prices and the companies\' own calls. Moves compare a stock with where it closed before the result; "vs Nifty 500" takes off what Nifty 500 did over the same days. Usual daily range = the stock\'s average high-to-low swing over the 20 days before the result. Facts, not advice: please do your own research.</p>';

export async function viewResPlus(helpers, route) {
  H = helpers;
  const [sec, a, b] = route.split('/').slice(1);
  const st = await load('status').catch(() => null);
  if (!st) return `${H.pageHead('Results', 'Results Plus')}<div class="empty card">Not published yet. Check back after this evening's update.</div>`;
  if (sec === 'sectors') return sectors(st, a || st.current_q, b || 'sector');
  if (sec === 'pool') return pool(st, a || (st.pools.slice(-1)[0] || {}).q);
  if (sec === 'guidance') return guidance(st, a || st.current_q, b || 'raised');
  if (sec === 'season') return season(st, a || st.current_q);
  return lists(st, sec === 'list' ? a : '');
}
const qSel = (list, cur, base) => `<select class="rp-q" data-base="${base}">${list.map((s) => `<option value="${s.q}" ${s.q === cur ? 'selected' : ''}>${H.esc(s.label)}</option>`).join('')}</select>`;
const wireQ = () => H.after(() => document.querySelectorAll('select.rp-q').forEach((el) => { el.onchange = () => { location.hash = el.dataset.base.replace('{q}', el.value); }; }));

/* ---------------- reactions ---------------- */
async function lists(st, id) {
  const d = await load('lists');
  const L = d.lists || [];
  const cur = L.find((l) => l.id === id) || L[0];
  const rows = (cur?.rows || []).map((r) => ({ ...r, sym: r.symbol }));
  const up = cur && cur.id === 'upcoming';
  const cols = up ? [
    { k: 'sym', label: 'Company', fmt: (r) => `${H.symLink(r.sym)}<span class="sub">${H.esc(r.name || '')}</span>` },
    { k: 't0', label: 'Results meeting', fmt: (r) => H.esc(r.sub || '') }, { k: 'mcap', label: 'Market cap', cls: 'r', fmt: (r) => H.mcapCr(r.mcap) }]
    : [{ k: 'sym', label: 'Company', fmt: (r) => `${H.symLink(r.sym)}<span class="sub">${H.esc(r.name || '')}</span>` },
      { k: 'label', label: 'Result', fmt: (r) => `${lab(r.label)}<span class="sub">${H.esc(r.sub || '')}</span>` },
      { k: 'gap', label: 'Gap at open', cls: 'r', fmt: (r) => `${p(r.gap)}${r.gap_status ? `<span class="sub">${GAPS[r.gap_status]}</span>` : ''}` },
      { k: 'day', label: 'Result day', cls: 'r', fmt: (r) => p(r.day) },
      { k: 'since', label: 'Since result', cls: 'r', fmt: (r) => p(r.since) },
      { k: 'since_adr', label: 'In usual days', cls: 'r', fmt: (r) => xr(r.since_adr) },
      { k: 'mcap', label: 'Market cap', cls: 'r', fmt: (r) => H.mcapCr(r.mcap) }];
  return `${head('list', 'Reactions after results', built(st))}
  <div class="rp-chips">${L.map((l) => `<a href="#/resplus/list/${l.id}" class="chip ${l.id === cur?.id ? 'on' : ''}">${H.esc(l.name)} <b>${l.rows.length}</b></a>`).join('')}</div>
  <section class="card"><h2>${H.esc(cur?.name || '')}</h2><p class="sub">${H.esc(cur?.about || '')} "In usual days" = the move divided by the stock's usual daily range, so a quiet stock's 8% counts more than a jumpy one's.</p>
  ${H.table('rp_' + (cur?.id || ''), rows, cols, 'Nothing in this list right now.')}</section>${note}`;
}

/* ---------------- sectors after results ---------------- */
function squarify(items, x, y, w, h) {
  const out = []; let rest = items.slice(); const total = rest.reduce((a, b) => a + b.v, 0); if (!total) return out;
  const sc = (w * h) / total; rest = rest.map((it) => ({ ...it, a: it.v * sc }));
  while (rest.length) {
    const sh = Math.min(w, h); let row = [], best = Infinity;
    for (const it of rest) {
      const r2 = row.concat([it]), s = r2.reduce((a, b) => a + b.a, 0), mx = Math.max(...r2.map((b) => b.a)), mn = Math.min(...r2.map((b) => b.a));
      const worst = Math.max((sh * sh * mx) / (s * s), (s * s) / (sh * sh * mn));
      if (worst > best && row.length) break; best = worst; row = r2;
    }
    const s = row.reduce((a, b) => a + b.a, 0), th = s / sh; let off = 0;
    for (const it of row) { const len = it.a / th; out.push(w >= h ? { ...it, x, y: y + off, w: th, h: len } : { ...it, x: x + off, y, w: len, h: th }); off += len; }
    if (w >= h) { x += th; w -= th; } else { y += th; h -= th; }
    rest = rest.slice(row.length);
  }
  return out;
}
const tint = (v) => { if (v == null) return 'var(--surface-2)'; const a = Math.min(1, Math.abs(v) / 15); return `color-mix(in srgb, ${v >= 0 ? 'var(--accent)' : 'var(--coral)'} ${Math.round(18 + 70 * a)}%, var(--bg-2))`; };
function mapHtml(tiles, W, Hh) {
  const g = {}; tiles.forEach((t) => { (g[t.sec] = g[t.sec] || []).push(t); });
  const groups = Object.entries(g).map(([k, v]) => ({ k, v: v.reduce((a, b) => a + b.m, 0), items: v })).sort((a, b) => b.v - a.v);
  let h = '';
  for (const gr of squarify(groups, 0, 0, W, Hh)) {
    for (const t of squarify(gr.items.map((x) => ({ ...x, v: x.m })).sort((a, b) => b.v - a.v), gr.x, gr.y, gr.w, gr.h)) {
      const big = t.w > 46 && t.h > 24;
      h += `<a class="rp-tm" href="#/stock/${encodeURIComponent(t.s)}" title="${H.esc(t.n || t.s)}: ${t.mv == null ? '' : t.mv.toFixed(1) + '% since result'}" style="left:${t.x / W * 100}%;top:${t.y}px;width:${t.w / W * 100}%;height:${t.h}px;background:${tint(t.mv)}">${big ? `${H.esc(t.s)}<small>${t.mv > 0 ? '+' : ''}${t.mv.toFixed(1)}%</small>` : ''}</a>`;
    }
    h += `<div class="rp-grp" style="left:${gr.x / W * 100}%;top:${gr.y}px;width:${gr.w / W * 100}%;height:${gr.h}px">${gr.w > 80 && gr.h > 22 ? `<span>${H.esc(gr.k)}</span>` : ''}</div>`;
  }
  return h;
}
const mix = (l) => { const t = (l.Strong || 0) + (l.Good || 0) + (l.Mixed || 0) + (l.Weak || 0); if (!t) return ''; const w = (k) => (100 * (l[k] || 0) / t).toFixed(1);
  return `<span class="rp-mix" title="Strong ${l.Strong} / Good ${l.Good} / Mixed ${l.Mixed} / Weak ${l.Weak}"><i class="s" style="width:${w('Strong')}%"></i><i class="g" style="width:${w('Good')}%"></i><i class="m" style="width:${w('Mixed')}%"></i><i class="w" style="width:${w('Weak')}%"></i></span>`; };
async function sectors(st, q, lvl) {
  const d = await load('sectors_' + q).catch(() => null);
  if (!d) return `${head('sectors', 'Sectors after results')}<div class="empty card">No data for ${H.esc(qlab(q))}.</div>`;
  const o = d.overall || {}, rows = ((d.levels || {})[lvl] || []).map((r) => ({ ...r }));
  const up = rows.filter((r) => (r.move_cap || 0) > 0).length;
  H.after(() => { const el = $('#rpMap'); if (el) el.innerHTML = mapHtml(d.tiles || [], el.clientWidth || 1000, el.clientHeight || 560); });
  wireQ();
  return `${head('sectors', 'Sectors after results', built(st))}
  <div class="toolbar">${qSel(st.seasons, q, '#/resplus/sectors/{q}/' + lvl)}<div class="seg">${[['sector', 'Sector'], ['industry', 'Industry'], ['theme', 'Theme']].map(([k, t]) => `<a class="${k === lvl ? 'on' : ''}" href="#/resplus/sectors/${q}/${k}">${t}</a>`).join('')}</div></div>
  <p class="sub">Each group's companies, from the close before each result to now (at most 60 trading days), ${d.n} results of stocks that trade Rs 1 crore a day or more. "Weighted" gives big companies more say, so one small jump cannot carry a big sector.</p>
  <div class="rp-tiles"><div class="card"><span class="eyebrow">Groups up</span><b>${up} / ${rows.length}</b></div>
    <div class="card"><span class="eyebrow">Average move, weighted</span><b class="${H.tone(o.move_cap)}">${H.pct(o.move_cap, 2)}</b></div>
    <div class="card"><span class="eyebrow">Beat Nifty 500</span><b>${o.beat == null ? '-' : Math.round(o.beat) + '%'}</b></div>
    <div class="card"><span class="eyebrow">Results rated Strong or Good</span><b>${o.good_share == null ? '-' : Math.round(o.good_share) + '%'}</b>${mix(d.label_mix || {})}</div></div>
  <section class="card">${H.table('rps_' + lvl, rows, [
    { k: 'name', label: lvl === 'theme' ? 'Theme' : lvl === 'industry' ? 'Industry' : 'Sector', fmt: (r) => `<b>${H.esc(r.name)}</b>` }, { k: 'n', label: 'Cos', cls: 'r' },
    { k: 'move', label: 'Average move', cls: 'r', fmt: (r) => p(r.move) }, { k: 'move_cap', label: 'Weighted', cls: 'r', fmt: (r) => p(r.move_cap) },
    { k: 'vs_n500', label: 'vs Nifty 500', cls: 'r', fmt: (r) => p(r.vs_n500) }, { k: 'win', label: 'Went up', cls: 'r', fmt: (r) => (r.win == null ? '-' : Math.round(r.win) + '%') },
    { k: 'pat_yoy_med', label: 'Profit growth (middle company)', cls: 'r', fmt: (r) => p(r.pat_yoy_med) },
    { k: 'best', label: 'Best', fmt: (r) => (r.best ? `${H.symLink(r.best.symbol)} ${p(r.best.since)}` : '') },
    { k: 'worst', label: 'Worst', fmt: (r) => (r.worst ? `${H.symLink(r.worst.symbol)} ${p(r.worst.since)}` : '') },
    { k: 'good_share', label: 'Result ratings', fmt: (r) => mix(r.labels) },
    { k: 'grade', label: 'Overall', fmt: (r) => (r.grade ? `<span class="chip rp-${r.grade === 'STRONG' ? 'good' : r.grade === 'WEAK' ? 'bad' : 'warn'}">${r.grade === 'STRONG' ? 'Strong' : r.grade === 'WEAK' ? 'Weak' : 'Mixed'}</span>` : '') }])}
    <p class="sub">Overall: Strong = weighted move above +1% and at least half the results rated Strong or Good; Weak = below -1% and under half; Mixed = the rest.</p></section>
  <section class="card"><h2>Map of moves after results</h2><p class="sub">One box per company, size = market value, colour = move since its result (deep green +15% or more, deep red -15% or worse). Tap a box to open the company.</p><div class="rp-map" id="rpMap"></div></section>${note}`;
}

/* ---------------- profit pool ---------------- */
function spark(series, k) {
  const v = series.map((s) => s[k]), W = 300, Hh = 64, n = v.length, ok = v.filter((x) => x != null);
  if (!ok.length) return '';
  const mx = Math.max(10, ...ok.map(Math.abs)), bw = W / n - 3, y0 = Hh / 2;
  return `<svg class="rp-spark" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${y0}" y2="${y0}" stroke="var(--line-2)"/>${v.map((x, i) => {
    if (x == null) return ''; const hh = Math.abs(x) / mx * (Hh / 2 - 4);
    return `<rect x="${i * (W / n) + 1}" y="${x >= 0 ? y0 - hh : y0}" width="${bw}" height="${hh}" fill="${x >= 0 ? 'var(--accent)' : 'var(--coral)'}" fill-opacity="${i === n - 1 ? 1 : 0.55}"><title>${qlab(series[i].q)}: ${x.toFixed(1)}%</title></rect>`; }).join('')}</svg>`;
}
const contrib = (c) => (c.rows || []).map((r) => `<div class="rp-bar"><span>${H.symLink(r.symbol)}${r.turn ? ' <span class="chip warn" title="A loss in the same quarter last year">from a loss</span>' : ''}${r.check ? ` <span class="chip" title="${H.esc(r.check)}">not like for like</span>` : ''}</span><span class="tr"><i style="width:${Math.min(100, Math.abs(r.share))}%;background:${r.change >= 0 ? 'var(--accent)' : 'var(--coral)'}"></i></span><b>${r.share.toFixed(1)}%</b></div>`).join('');
const say = (c, nm) => (c && c.top3_share != null ? `<p>${c.rows.slice(0, 3).map((r) => H.esc(r.symbol)).join(', ')} explain ${Math.round(c.top3_share)}% of the ${nm} profit change; the top 10 explain ${Math.round(c.top10_share)}%.${c.top10_share > 100 ? ' (Above 100% because other companies\' falls offset part of these rises.)' : ''}${(c.top3_turns || []).length ? ` ${c.top3_turns.join(', ')} made a loss a year ago, so part of this is a bounce, not a steady pace.` : ''}</p>` : '');
async function pool(st, q) {
  const [d, m] = await Promise.all([load('pool_' + q).catch(() => null), load('momentum').catch(() => ({}))]);
  wireQ();
  const row = (nm, s) => `<tr><td>${nm}</td><td class="r">${s.n}</td><td class="r">${p(s.revenue_yoy)}</td><td class="r">${p(s.ebitda_yoy)}</td><td class="r">${p(s.pat_yoy)}</td><td class="r">${s.pat_margin == null ? '-' : s.pat_margin.toFixed(1) + '%'}</td></tr>`;
  let h = `${head('pool', 'Profit pool', built(st))}<div class="toolbar">${qSel(st.pools, q, '#/resplus/pool/{q}')}</div>
  <p class="sub">The Nifty 500 as it stood at the quarter end. Only companies that reported this quarter and the same quarter last year, so the comparison is fair. Profits added up and compared with a year ago. A few giants can move a total, so it is also shown without the oil refiners and fuel sellers, and by company size.</p>`;
  if (!d || d.note) h += `<div class="empty card">${H.esc(d?.note || 'Not published for this quarter.')}</div>`;
  else {
    h += `<div class="grid2"><section class="card"><h2>${H.esc(d.label)}: ${d.same_store} companies</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Basis</th><th class="r">Cos</th><th class="r">Revenue</th><th class="r">EBITDA</th><th class="r">Profit</th><th class="r">Profit margin</th></tr></thead><tbody>${row('All', d.all)}${row('Without oil refiners', d.ex_omc)}</tbody></table></div>
      <p class="sub">Oil refiners and fuel sellers here: ${d.omc.join(', ')}. Banks left out of revenue, all financial companies out of EBITDA.</p></section>
      <section class="card"><h2>By company size</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Size</th><th class="r">Cos</th><th class="r">Revenue</th><th class="r">Profit</th><th class="r">Profit without oil</th></tr></thead><tbody>${(d.by_size || []).map((s) => `<tr><td>${s.size}</td><td class="r">${s.n}</td><td class="r">${p(s.revenue_yoy)}</td><td class="r">${p(s.pat_yoy)}</td><td class="r">${p(s.pat_yoy_ex_omc)}</td></tr>`).join('')}</tbody></table></div>
      <p class="sub">Large = the 100 biggest, mid = the next 150, small = the rest, by market value at the quarter end.</p></section></div>
    <section class="card"><h2>Who made the change</h2><p class="sub">Each bar = the company's share of the group's total profit change. "From a loss" = it made a loss in the same quarter last year. "Not like for like" = revenue moved by more than half (a merger, a split or a business sold).</p>${say(d.contrib, 'Nifty 500')}
      <div class="grid2"><div><h3>Whole Nifty 500</h3>${contrib(d.contrib)}</div>${(d.by_size || []).map((s) => `<div><h3>${s.size} companies</h3>${say(s.contrib, s.size.toLowerCase() + '-company')}${contrib(s.contrib)}</div>`).join('')}</div></section>`;
  }
  const rows = (m.universes || {}).all || [];
  h += `<section class="card"><h2>How each sector is growing, every listed company</h2><p class="sub">Growth on a year ago of the middle company in each sector (so one giant cannot skew it), ${H.esc((m.labels || [])[0] || '')} to ${H.esc((m.labels || []).slice(-1)[0] || '')}. Bars = profit growth each quarter, the last one solid.</p>
    <div class="rp-cards">${rows.map((x) => { const L = x.latest || {}; return `<div class="rp-card"><h3>${H.esc(x.name)}</h3><p class="sub">${L.n} companies &middot; ${L.grew == null ? '' : Math.round(L.grew) + '% grew profit'}${x.trend ? ' &middot; ' + H.esc(x.trend) : ''}</p>${spark(x.series, 'pat_yoy')}
      <div class="rp-kv"><span>Revenue <b>${p(L.revenue_yoy)}</b></span><span>EBITDA <b>${p(L.ebitda_yoy)}</b></span><span>Profit <b>${p(L.pat_yoy)}</b></span></div></div>`; }).join('')}</div></section>${note}`;
  return h;
}

/* ---------------- guidance changes ---------------- */
const dirChip = (d) => `<span class="chip rp-${d === 'raised' ? 'good' : d === 'cut' ? 'bad' : ''}">${H.esc(d)}</span>`;
async function guidance(st, q, dir) {
  const g = await load('guidance');
  const t = (g.seasons || {})[q] || {};
  wireQ();
  const calls = (g.calls || []).filter((c) => c.direction === dir);
  const bd = t.by_direction || [];
  return `${head('guidance', 'Guidance changes', built(st))}<div class="toolbar">${qSel(st.seasons, q, '#/resplus/guidance/{q}/' + dir)}</div>
  <p class="sub">What companies now expect, read from their earnings calls and presentations, every figure quoted word for word. Raised or cut = what management said, or the new figure compared with the company's own earlier figure for the same thing and period.</p>
  ${bd.length ? `<section class="card"><h2>${H.esc(t.label)}: how the price did after the result</h2><div class="rp-tiles">${bd.map((b) => `<div class="card"><span class="eyebrow">${H.esc(b.direction)} &middot; ${b.n} companies</span><b>${b.beat == null ? '-' : Math.round(b.beat) + '%'}</b><span class="sub">beat Nifty 500 since the result</span></div>`).join('')}</div><p class="sub">Companies that trade Rs 1 crore a day or more, one reading per company.</p></section>
  <section class="card"><h2>By sector</h2>${H.table('rpg_' + q, (t.by_sector || []).map((r) => ({ ...r })), [
    { k: 'name', label: 'Sector', fmt: (r) => `<b>${H.esc(r.name)}</b>` }, { k: 'readings', label: 'Readings', cls: 'r' }, { k: 'raised', label: 'Raised', cls: 'r' }, { k: 'maintained', label: 'Kept', cls: 'r' }, { k: 'cut', label: 'Cut', cls: 'r' },
    { k: 'net', label: 'Net', cls: 'r', fmt: (r) => p(r.net, 0) }, { k: 'raisers_vs', label: 'Raisers vs Nifty 500', cls: 'r', fmt: (r) => p(r.raisers_vs) }, { k: 'cutters_vs', label: 'Cutters vs Nifty 500', cls: 'r', fmt: (r) => p(r.cutters_vs) },
    { k: 'who_raised', label: 'Who raised', fmt: (r) => r.who_raised.map(H.symLink).join(' ') }, { k: 'who_cut', label: 'Who cut', fmt: (r) => r.who_cut.map(H.symLink).join(' ') }])}
    <p class="sub">Net = (raised minus cut) / companies with a reading. Sectors with 5 or more readings.</p></section>` : ''}
  <section class="card"><div class="card-head"><h2>Every change, last 90 days</h2><div class="seg">${[['raised', 'Raised'], ['cut', 'Cut']].map(([k, l]) => `<a class="${k === dir ? 'on' : ''}" href="#/resplus/guidance/${q}/${k}">${l}</a>`).join('')}</div></div>
  ${calls.slice(0, 150).map((c) => `<div class="rp-call"><div class="rp-ch">${H.symLink(c.symbol)} <span class="sub inline">${H.esc(c.name || '')}</span> ${dirChip(c.direction)} <span class="sub inline">${H.fDay(c.day)}</span>${c.since != null ? ` <span class="sub inline">since result</span> ${p(c.since)}` : ''}${c.pdf ? ` <a href="${H.esc(c.pdf)}" target="_blank" rel="noopener">Source</a>` : ''}</div>
    ${c.outlook ? `<p>${H.esc(c.outlook)}</p>` : ''}${(c.items || []).map((i) => `<div class="rp-it"><span class="sub inline">${H.esc(i.metric_name)} ${H.esc(i.period || '')}</span> ${dirChip(i.direction)} <b>${H.esc(i.value || '')}</b>${i.before ? ` <span class="sub inline">(earlier: ${H.esc(i.before)})</span>` : ''}<blockquote>${H.esc(i.quote || '')}</blockquote></div>`).join('')}</div>`).join('') || '<div class="empty">None in the last 90 days.</div>'}</section>${note}`;
}

/* ---------------- season report ---------------- */
async function season(st, q) {
  const s = await load('season_' + q).catch(() => null);
  wireQ();
  if (!s) return `${head('season', 'Season report')}<div class="empty card">No report for ${H.esc(qlab(q))}.</div>`;
  const g = s.glance || {};
  const why = (arr) => (arr || []).map((w) => `${H.symLink(w.symbol)} ${p(w.since, 0)} <span class="sub inline">${H.esc(w.why)}</span>`).join('<br>');
  const grp = (rows, t) => `<section class="card"><h2>${t}</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Group</th><th class="r">Cos</th><th class="r">vs Nifty 500</th><th class="r">Beat</th><th>Biggest movers and why</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${H.esc(r.name)}</b></td><td class="r">${r.n}</td><td class="r">${p(r.vs_n500)}</td><td class="r">${r.beat == null ? '' : Math.round(r.beat) + '%'}</td><td class="rp-why">${why(r.why)}</td></tr>`).join('')}</tbody></table></div></section>`;
  const mx = Math.max(10, ...(s.index_moves || []).map((x) => Math.abs(x.move)));
  const miss = (rows) => (rows || []).map((r) => `<tr><td>${H.symLink(r.symbol)} ${lab(r.label)}</td><td class="r">${p(r.since)}</td><td class="rp-why">${H.esc(r.why)}</td></tr>`).join('') || '<tr><td>None.</td></tr>';
  return `${head('season', `${H.esc(s.label)} results season`, built(st))}<div class="toolbar">${qSel(st.seasons, q, '#/resplus/season/{q}')}</div>
  <p class="sub">${s.reported} results, ${s.liquid} of companies that trade Rs 1 crore a day or more. Moves from the close before each result to ${H.fDay(g.latest)} (at most 60 trading days), against Nifty 500 over the same days. Every "why" is built from the filing's own numbers and the company's guidance.</p>
  <div class="rp-tiles"><div class="card"><span class="eyebrow">Sectors that grew profit</span><b>${g.sectors_grew} / ${g.sectors}</b><span class="sub">middle company, on a year ago</span></div>
    <div class="card"><span class="eyebrow">Middle company's profit growth</span><b class="${H.tone(g.median_pat_yoy)}">${H.pct(g.median_pat_yoy, 1)}</b><span class="sub">companies with a profit both years</span></div>
    <div class="card"><span class="eyebrow">Beat Nifty 500 after results</span><b>${g.beat_n500 == null ? '-' : Math.round(g.beat_n500) + '%'}</b></div>
    <div class="card"><span class="eyebrow">Closed above their 100-day high</span><b>${g.breakouts}</b><span class="sub">within 5 days of the result; ${g.breakouts_above} still above</span></div></div>
  <section class="card"><h2>How each index moved</h2><p class="sub">NSE closes, ${H.fDay((s.index_window || {}).from)} to ${H.fDay((s.index_window || {}).to)}.</p>${(s.index_moves || []).map((x) => `<div class="rp-bar mid"><span>${H.esc(x.index)}</span><span class="tr"><i style="${x.move >= 0 ? 'left:50%' : `right:50%`};width:${Math.min(50, 50 * Math.abs(x.move) / mx)}%;background:${x.move >= 0 ? 'var(--accent)' : 'var(--coral)'}"></i></span><b class="${H.tone(x.move)}">${H.pct(x.move, 1)}</b></div>`).join('')}</section>
  <div class="grid2">${grp((s.themes || {}).led || [], 'Themes that led')}${grp((s.themes || {}).lagged || [], 'Themes that lagged')}</div>
  <section class="card"><h2>Biggest moves after results</h2><p class="sub">The 20 biggest moves since the result, measured against each stock's usual daily range.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Company</th><th class="r">Since result</th><th class="r">In usual days</th><th>Result</th><th>Why</th></tr></thead><tbody>
    ${(s.movers || []).map((m) => `<tr><td>${H.symLink(m.symbol)}<span class="sub">${H.esc(m.name || '')}</span></td><td class="r">${p(m.since)}</td><td class="r">${xr(m.since_adr)}</td><td>${lab(m.label)}<span class="sub">${H.fDay(m.t0)}, gap ${H.pct(m.gap, 1)}${m.gap_status ? ' ' + GAPS[m.gap_status] : ''}</span></td><td class="rp-why">${H.esc(m.why)}</td></tr>`).join('')}</tbody></table></div></section>
  <div class="grid2"><section class="card"><h2>Good results, price fell</h2><p class="sub">${(s.misses || {}).good_fell_n || 0} results rated Strong or Good fell 2 usual days or more. Look at the notes: one-off income and cash often explain it.</p><div class="tbl-wrap"><table class="tbl"><tbody>${miss((s.misses || {}).good_fell)}</tbody></table></div></section>
    <section class="card"><h2>Weak results, price rose</h2><p class="sub">${(s.misses || {}).weak_rose_n || 0} results rated Weak rose 2 usual days or more: the market was looking at something else.</p><div class="tbl-wrap"><table class="tbl"><tbody>${miss((s.misses || {}).weak_rose)}</tbody></table></div></section></div>
  <section class="card"><h2>Closed above the 100-day high after the result</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Company</th><th>Day</th><th class="r">Since result</th><th>Now</th><th>Why</th></tr></thead><tbody>
    ${(s.breakouts || []).slice(0, 60).map((b) => `<tr><td>${H.symLink(b.symbol)} ${lab(b.label)}</td><td>${H.fDay(b.bo_day)}</td><td class="r">${p(b.since)}</td><td>${b.above ? 'above' : '<span class="down">back below</span>'}</td><td class="rp-why">${H.esc(b.why)}</td></tr>`).join('')}</tbody></table></div></section>${note}`;
}

/* ---------------- block on the stock page ---------------- */
export async function stockBlock(helpers, sym) {
  H = helpers;
  const k = /^[A-Z]/.test(sym) ? sym[0] : '0';
  const sh = await H.hist('eplus/co/' + k).catch(() => null);
  const d = sh && sh[sym];
  if (!d) return '';
  const rows = (d.r || []).slice().reverse();
  const f = d.f || [];
  return `<section class="card"><div class="card-head"><h2>Results and the price after</h2><a href="#/resplus">Results Plus</a></div>
    ${d.since != null ? `<p>Since its latest result: ${p(d.since)} over ${d.since_days} trading days${d.since_x != null ? `, ${p(d.since_x)} against Nifty 500` : ''}${d.since_adr != null ? ` (${xr(d.since_adr)} its usual daily range)` : ''}.${d.one_off ? ` <span class="chip warn">One-off: ${H.esc(d.one_off)}</span>` : ''}</p>` : ''}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quarter</th><th>Result day</th><th>Rating</th><th class="r">Revenue</th><th class="r">Profit</th><th class="r">Gap at open</th><th class="r">Result day</th><th class="r">5 days</th><th class="r">20 days</th><th class="r">60 days</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${qlab(r[0])}</td><td>${H.fDay(r[1])}<span class="sub">${BUCKET[r[2]] || ''}</span></td><td>${lab(r[3])}</td><td class="r">${p(r[4])}</td><td class="r">${r[6] ? `<span class="sub inline">${H.esc(r[6])}</span>` : p(r[5])}</td>
      <td class="r">${p(r[7])}${r[8] ? `<span class="sub">${GAPS[r[8]]}</span>` : ''}</td><td class="r">${p(r[9])}</td><td class="r">${p(r[11])}</td><td class="r">${p(r[12])}</td><td class="r">${p(r[13])}</td></tr>`).join('')}</tbody></table></div>
    <p class="sub">5 / 20 / 60 days: the move from the result-day close, minus Nifty 500 over the same days.</p>
    ${f.length ? `<h3 class="mt">Checks from the company's own filings</h3><div class="tbl-wrap"><table class="tbl"><tbody>${f.map(([l, v, t, a]) => `<tr><td>${H.esc(l)}</td><td><span class="chip rp-${(VD[v] || VD.na)[1]}">${(VD[v] || VD.na)[0]}</span></td><td>${H.esc(t)}</td><td class="sub">${H.esc(a || '')}</td></tr>`).join('')}</tbody></table></div>
    ${(d.ff || []).map((x) => `<p class="sub">${H.esc(x)}</p>`).join('')}<p class="sub">Read by code from NSE result filings and half-year balance sheets. A "Look closer" is a number worth reading in the filing, not a verdict on the company.</p>` : ''}</section>`;
}
