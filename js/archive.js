// Broker reports tracker (Sagar 2026-11-25: "add research archive in skd as well, with tracking prices after the
// research report date, with live small dashboard, how many we have, and how many are positive after a positive report
// and how many are negative returns after negative report").
//   Dashboard: reports in our archive, calls tracked, positive reports that went up, negative reports that went down,
//              all calls or only those a month old, and after 5 / 20 / 60 trading days.
//   Calls: every company call with the NSE close on the report day, the latest close and the move since.
//   Brokers / Sectors / Months: the same two scores per group.
//   Stock pages: the broker reports on that stock and the price after each.
// Data: data/archive/summary.json + calls.json, built by Desktop\Sandbox\research-archive-plus (rap/skd.py) every
// evening on NSE closing prices. Public-safe: no report text, no targets, no ratings (the reports are the brokers'
// copyright; SKD shows no buy / sell / target, SEBI). No emoji, no em dash, no tilde.

let H = null;
// tabs Overview / All calls / Brokers / Sectors / Months are in the top bar (app.js SUBTABS, Sagar 2026-11-26), one page each
const TONE = { 1: ['Positive', 'ar-pos'], '-1': ['Negative', 'ar-neg'], 0: ['Neutral', ''] };
const SRC = { r: 'Report', w: 'News' };
const st = { mode: 'all', tone: 'all', src: 'all', q: '', show: 200 };
const counted = (r) => !r.u;
const p = (v, d = 1) => (v == null ? '<span class="sub inline">-</span>' : `<span class="${H.tone(v)}">${H.pct(v, d)}</span>`);
const n = (v) => (v == null ? '-' : Number(v).toLocaleString('en-IN'));
const px = (v) => (v == null ? '-' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pc = (v) => (v == null ? '-' : `${Math.round(v)}%`);
const tone = (t) => { const [l, c] = TONE[t] || TONE[0]; return `<span class="chip ${c}">${l}</span>`; };
const load = (f) => H.hist('archive/' + f);
const note = `<p class="sub legend">How to read this: a <b>positive</b> report is one where the broker saw the price going higher, a <b>negative</b> report one where it saw it going lower. Each move starts at the NSE close on the broker's own report date (the last trading day on or before it) and ends at the latest NSE close; price only, dividends not added. Every report date is checked against the price the report prints; where we had read a wrong date it is corrected, and a report that prints no date and fits no price near the day we got it is listed but not counted. "vs Nifty 500" takes off what Nifty 500 did over the same days. The reports themselves, their targets and ratings are not shown: they belong to the brokers. Facts, not advice: please do your own research.</p>`;

export async function viewArchive(helpers, route) {
  H = helpers;
  const [, tab = 'overview', a = ''] = route.split('/');
  const s = await load('summary').catch(() => null);
  if (!s) return `${H.pageHead('Research', 'Broker reports tracker')}<div class="empty card">Not published yet. Check back after this evening's update.</div>`;
  H.after(wire);
  const body = tab === 'brokers' ? groups(s.brokers_t, 'Broker') : tab === 'sectors' ? groups(s.sectors_t, 'Sector') : tab === 'months' ? groups(s.months_t, 'Month', true) : tab === 'calls' ? await calls(a, s) : dash(s);
  const T = { overview: 'Broker reports tracker', calls: 'All broker calls', brokers: 'Brokers', sectors: 'Sectors', months: 'Months' };
  return `${H.pageHead('Broker reports tracker', T[tab] || T.overview, `<span class="k-pill plain" title="Prices used">NSE close of ${H.fShort(s.price_date)}</span>`)}
  ${body}${note}`;
}

/* ---------------- the small dashboard ---------------- */
function bar(up, down) {
  const t = up + down || 1;
  return `<span class="ar-mix" title="${up} up, ${down} down"><i class="u" style="width:${(100 * up) / t}%"></i><i class="d" style="width:${(100 * down) / t}%"></i></span>`;
}
const modeSeg = (s) => `<div class="seg ar-seg"><a href="#" data-armode="all" class="${st.mode === 'all' ? 'on' : ''}">All calls</a><a href="#" data-armode="old" class="${st.mode === 'old' ? 'on' : ''}" title="Only calls followed for at least 20 trading days">A month old or more${s ? ` (${n(s.month_old_n)})` : ''}</a></div>`;
function dash(s) {
  const T = st.mode === 'old' ? s.month_old : s.all;
  const P = T.pos, N = T.neg;
  const modes = modeSeg(s);
  const aft = ['5', '20', '60'].map((k) => {
    const x = s.after[k];
    return `<tr><td>${k} trading days</td><td class="r">${n(x.pos.known)}</td><td class="r">${n(x.pos.up)} <span class="sub inline">(${pc(x.pos.right_pct)})</span></td><td class="r">${p(x.pos.median)}</td><td class="r">${n(x.neg.known)}</td><td class="r">${n(x.neg.down)} <span class="sub inline">(${pc(x.neg.right_pct)})</span></td><td class="r">${p(x.neg.median)}</td></tr>`;
  }).join('');
  const au = s.audit || {};
  const audit = au.prices_pass != null ? `<span class="chip ${au.prices_pass && au.look_ahead_pass ? 'ar-pos' : 'ar-neg'}" title="Every price checked against NSE's own closing price (${n(au.prices_compared)} compared)">Price check ${au.prices_pass && au.look_ahead_pass ? 'passed' : 'FAILED'}</span>` : '';
  return `<div class="ar-tiles">
    <div class="card"><span class="sub">Reports in our archive</span><b>${n(s.reports)}</b><span class="sub">${n(s.calls)} company calls tracked, ${n(s.stocks)} stocks, ${n(s.brokers)} brokers, since ${H.fShort(s.first)}</span></div>
    <div class="card"><span class="sub">Positive reports that went up</span><b class="up">${n(P.up)} <small>of ${n(P.known)}</small></b>${bar(P.up, P.down)} <span class="sub inline">${pc(P.right_pct)}</span><span class="sub">Middle move ${p(P.median)}${P.median_vs_nifty != null ? `, vs Nifty 500 ${p(P.median_vs_nifty)}` : ''}</span></div>
    <div class="card"><span class="sub">Negative reports that went down</span><b class="down">${n(N.down)} <small>of ${n(N.known)}</small></b>${bar(N.down, N.up)} <span class="sub inline">${pc(N.right_pct)}</span><span class="sub">Middle move ${p(N.median)}${N.median_vs_nifty != null ? `, vs Nifty 500 ${p(N.median_vs_nifty)}` : ''}</span></div>
    <div class="card"><span class="sub">New calls in the last 7 days</span><b>${n(s.this_week)}</b><span class="sub">All calls since ${H.fShort(s.first)}: ${n(s.from_reports)} from broker reports, ${n(s.from_news)} from news; ${n(T.neutral)} neutral</span></div>
  </div>
  <div class="ar-row">${modes}${audit}<span class="sub inline">Moves from each report's own date. Updated every evening on NSE closing prices.${s.dates_fixed ? ` ${n(s.dates_fixed)} report dates corrected after checking the printed price.` : ''}</span></div>
  <section class="card"><h2>After a fixed number of days</h2><p class="sub">Only calls old enough for that many trading days count. "Middle move" is the median: half the calls did better, half worse.</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Held for</th><th class="r">Positive calls</th><th class="r">Went up</th><th class="r">Middle move</th><th class="r">Negative calls</th><th class="r">Went down</th><th class="r">Middle move</th></tr></thead><tbody>${aft}</tbody></table></div></section>
  ${brokerAcc(s)}`;
}

/* ---------------- broker accuracy on the dashboard (Sagar 2026-11-25) ---------------- */
function brokerAcc(s) {
  const list = ((s.brokers_dash || {})[st.mode === 'old' ? 'old' : 'all'] || []).map((g) => ({ ...g, pr: g.pos.right_pct, nr: g.neg.right_pct, nk: g.neg.known, pm: g.pos.median }));
  if (!list.length) return '';
  const cols = [
    { k: 'name', label: 'Broker', fmt: (r) => `<a href="#" data-arq="${H.esc(r.name)}">${H.esc(r.name)}</a>` },
    { k: 'known', label: 'Calls', cls: 'r', fmt: (r) => `${n(r.known)}<span class="sub">${n(r.stocks)} stocks</span>` },
    { k: 'right_pct', label: 'Accuracy', cls: 'r', fmt: (r) => `<span title="${n(r.right)} of ${n(r.known)} went the broker's way"><b>${pc(r.right_pct)}</b> ${bar(r.right, r.known - r.right)}</span>` },
    { k: 'pr', label: 'Positive went up', cls: 'r', fmt: (r) => `${pc(r.pr)}<span class="sub">${n(r.pos.right)} of ${n(r.pos.known)}</span>` },
    { k: 'nr', label: 'Negative went down', cls: 'r', fmt: (r) => (r.nk ? `${pc(r.nr)}<span class="sub">${n(r.neg.right)} of ${n(r.nk)}</span>` : '-') },
    { k: 'pm', label: 'Middle move, positive', cls: 'r', fmt: (r) => p(r.pm) },
  ];
  return `<section class="card"><h2>Broker accuracy</h2><p class="sub">Brokers with at least 10 calls${st.mode === 'old' ? ' a month old or more' : ''}. Accuracy = positive reports that went up plus negative reports that went down, out of all their calls with a price since the report date. Few calls means luck matters a lot; click a column to sort, a broker to see every call.</p>
  ${H.table('ar_bdash_' + st.mode, list, cols, 'Not enough calls yet.')}</section>`;
}

/* ---------------- every call ---------------- */
async function calls(sym, s) {
  const d = await load('calls');
  const q = (st.q || (sym ? decodeURIComponent(sym) : '')).trim().toUpperCase();
  let rows = d.rows.filter((r) => (st.mode !== 'old' || r.ss >= 20) && (st.tone === 'all' || String(r.t) === st.tone) && (st.src === 'all' || r.k === st.src));
  if (q) rows = rows.filter((r) => r.s.includes(q) || (r.n || '').toUpperCase().includes(q) || r.b.toUpperCase().includes(q));
  const total = rows.length;
  rows = rows.slice(0, st.show).map((r) => ({ ...r, sym: r.s }));
  const ch = (k, v, t) => `<a href="#" class="chip ${st[k] === v ? 'on' : ''}" data-ark="${k}" data-arv="${v}">${t}</a>`;
  const cols = [
    { k: 'd', label: 'Report date', fmt: (r) => `${H.fShort(r.d)}${r.u ? '<span class="sub">date not confirmed, not counted</span>' : r.df ? `<span class="sub" title="Checked against the price printed in the report">date corrected (was ${H.fShort(r.df)})</span>` : ''}` },
    { k: 'sym', label: 'Company', fmt: (r) => `${H.symLink(r.s)}<span class="sub">${H.esc(r.n || '')}</span>` },
    { k: 'b', label: 'Broker', fmt: (r) => `${H.esc(r.b)}<span class="sub">${SRC[r.k] || ''}</span>` },
    { k: 't', label: 'Report', fmt: (r) => tone(r.t) },
    { k: 'p0', label: 'Close on report day', cls: 'r', fmt: (r) => px(r.p0) },
    { k: 'p1', label: 'Latest close', cls: 'r', fmt: (r) => px(r.p1) },
    { k: 'r', label: 'Move since', cls: 'r', fmt: (r) => `${p(r.r)}<span class="sub">${r.ss} days</span>` },
    { k: 'x', label: 'vs Nifty 500', cls: 'r', fmt: (r) => p(r.x) },
    { k: 'hi', label: 'Best / worst', cls: 'r', fmt: (r) => `${p(r.hi)}<span class="sub">${r.lo == null ? '' : H.pct(r.lo, 1)}</span>` },
  ];
  return `<section class="card"><div class="ar-row">
    ${modeSeg(s)}<div class="rp-chips">${ch('tone', 'all', 'All')}${ch('tone', '1', 'Positive')}${ch('tone', '-1', 'Negative')}${ch('tone', '0', 'Neutral')}</div>
    <div class="rp-chips">${ch('src', 'all', 'Reports and news')}${ch('src', 'r', 'Broker reports')}${ch('src', 'w', 'News')}</div>
    <input class="ar-q" type="search" placeholder="Stock, company or broker" value="${H.esc(q)}"></div>
    <p class="sub">${n(total)} call${total === 1 ? '' : 's'}${q ? ` for "${H.esc(q)}"` : ''}, newest first. Click a column to sort.</p>
    ${H.table('ar_calls', rows, cols, 'No calls match.')}
    ${total > st.show ? `<p><a href="#" class="chip" data-armore="1">Show ${Math.min(200, total - st.show)} more</a></p>` : ''}</section>`;
}

/* ---------------- brokers / sectors / months ---------------- */
function groups(list, what, keepOrder = false) {
  const rows = (list || []).map((g) => ({ ...g, pc: g.pos.calls, pr: g.pos.right_pct, pm: g.pos.median, nc: g.neg.calls, nr: g.neg.right_pct, nm: g.neg.median, px: g.pos.median_vs_nifty }));
  const cols = [
    { k: 'name', label: what, fmt: (r) => (what === 'Broker' ? `<a href="#" data-arq="${H.esc(r.name)}">${H.esc(r.name)}</a>` : what === 'Month' ? H.esc(r.name) : H.esc(r.name)) },
    { k: 'calls', label: 'Calls', cls: 'r', fmt: (r) => `${n(r.calls)}<span class="sub">${n(r.stocks)} stocks</span>` },
    { k: 'right_pct', label: 'Accuracy', cls: 'r', fmt: (r) => `${pc(r.right_pct)} ${bar(r.right || 0, (r.known || 0) - (r.right || 0))}` },
    { k: 'pc', label: 'Positive', cls: 'r', fmt: (r) => n(r.pc) },
    { k: 'pr', label: 'Went up', cls: 'r', fmt: (r) => `${pc(r.pr)} ${bar(r.pos.up, r.pos.down)}` },
    { k: 'pm', label: 'Middle move', cls: 'r', fmt: (r) => p(r.pm) },
    { k: 'px', label: 'vs Nifty 500', cls: 'r', fmt: (r) => p(r.px) },
    { k: 'nc', label: 'Negative', cls: 'r', fmt: (r) => n(r.nc) },
    { k: 'nr', label: 'Went down', cls: 'r', fmt: (r) => (r.nc ? `${pc(r.nr)} ${bar(r.neg.down, r.neg.up)}` : '-') },
    { k: 'nm', label: 'Middle move', cls: 'r', fmt: (r) => (r.nc ? p(r.nm) : '-') },
  ];
  return `<section class="card"><p class="sub">${what}s with at least 5 calls. Moves from each report's own date${keepOrder ? ', newest month first' : ''}; scores move as the calls age.</p>${H.table('ar_' + what, rows, cols, 'Nothing yet.')}</section>`;
}

function wire() {
  document.querySelectorAll('[data-armode]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); st.mode = a.dataset.armode; rerender(); }; });
  document.querySelectorAll('[data-ark]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); st[a.dataset.ark] = a.dataset.arv; st.show = 200; rerender(); }; });
  document.querySelectorAll('[data-armore]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); st.show += 200; rerender(); }; });
  document.querySelectorAll('[data-arq]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); st.q = a.dataset.arq; st.show = 200; if (location.hash === '#/archive/calls') rerender(); else location.hash = '#/archive/calls'; H.after(() => document.querySelector('.ar-q')?.scrollIntoView({ block: 'center' })); }; });
  const q = document.querySelector('.ar-q');
  if (q) q.onkeydown = (e) => { if (e.key === 'Enter') { st.q = q.value; st.show = 200; if (location.hash.split('/').length > 3) location.hash = '#/archive/calls'; else rerender(); } };
}
const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

/* ---------------- on a stock page ---------------- */
export async function stockBlock(helpers, sym) {
  H = helpers;
  const d = await load('calls').catch(() => null);
  const rows = (d?.rows || []).filter((r) => r.s === sym);
  if (!rows.length) return '';
  const up = rows.filter((r) => r.t === 1 && counted(r)), dn = rows.filter((r) => r.t === -1 && counted(r));
  return `<section class="card"><div class="card-head"><h2>Broker reports and the price after</h2><a href="#/archive/calls/${encodeURIComponent(sym)}">Reports tracker</a></div>
    <p class="sub">${rows.length} calls: ${up.length} positive (${up.filter((r) => r.r > 0).length} went up since), ${dn.length} negative (${dn.filter((r) => r.r < 0).length} went down since).</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Report date</th><th>Broker</th><th>Report</th><th class="r">Close on report day</th><th class="r">Latest close</th><th class="r">Move since</th><th class="r">vs Nifty 500</th></tr></thead>
    <tbody>${rows.slice(0, 15).map((r) => `<tr><td>${H.fShort(r.d)}</td><td>${H.esc(r.b)}<span class="sub">${SRC[r.k] || ''}</span></td><td>${tone(r.t)}</td><td class="r">${px(r.p0)}</td><td class="r">${px(r.p1)}</td><td class="r">${p(r.r)}<span class="sub">${r.ss} days</span></td><td class="r">${p(r.x)}</td></tr>`).join('')}</tbody></table></div>
    <p class="sub">Move from the NSE close on the report's own date. Facts, not advice.</p></section>`;
}
