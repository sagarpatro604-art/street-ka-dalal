// Discover (Sagar 2026-11-16): one tab for the things members asked for most.
//   Big investors: well-known investors named as 1%+ holders in NSE shareholding filings + promoter buys / sells.
//   Market valuation: is the market cheap or expensive against its own history (NSE P/E, P/B, dividend yield).
//   Rotation (RRG): official NSE indices against the Nifty 500.
//   What management said: guidance lines from earnings calls, quote-checked word for word.
//   My stocks this week: everything new about the stocks in the member's own lists.
//   Portfolio X-ray: a member pastes holdings; read in this browser only, never sent anywhere.
// Data: data/discover/*.json (Sandbox\skd-discover\discover.py) + the site's own stock, results and filing files.
// Facts only: no buy / sell words, no targets (SEBI).

let H = null;
const $ = (s, r = document) => r.querySelector(s);
const ST = { tr: { g: '', k: '', days: 30, mine: false, n: 200 }, pf: { lot: null }, inv: { view: 'moves', kind: 'all', mine: false, n: 150, open: '' }, rrg: { iv: 'weekly', broad: false }, gd: { q: '', mine: false, n: 30 }, val: { idx: 'Nifty 50' }, my: { list: 'all' } };
export const dSet = (path, v) => { const [a, b] = path.split('.'); ST[a][b] = v; };
export const dGet = (path) => { const [a, b] = path.split('.'); return ST[a][b]; };

// RRG and Portfolio X-ray are their own tabs since Sagar 2026-11-16 ("rrg as a separate new tab, not in discover,
// portfolio x ray also as a separate at the end"); old #/discover/rrg and #/discover/xray links still open them
const SECS = [
  ['', 'Stock lists'], ['triggers', 'Board of all triggers'], ['investors', 'Big investors'], ['valuation', 'Market valuation'],
  ['management', 'What management said'], ['mystocks', 'My stocks this week'],
];
const load = (n) => H.hist('discover/' + n).catch(() => null);
const subnav = (cur) => `<nav class="dc-nav">${SECS.map(([k, t]) => `<a href="#/discover${k ? '/' + k : ''}" class="${k === cur ? 'on' : ''}">${t}</a>`).join('')}</nav>`;
let PREM = null;
const banner = () => {
  const p = PREM;
  if (!p) return '';
  if (p.mode === 'premium') return `<p class="dc-prem ok">Premium active until <b>${H.fDate(String(p.ends).slice(0, 10))}</b> (${p.days_left} days left).</p>`;
  if (p.mode === 'trial' && p.days_left != null) return `<p class="dc-prem">Free for you for <b>${p.days_left} more day${p.days_left === 1 ? '' : 's'}</b> (until ${H.fDate(String(p.ends).slice(0, 10))}). After that Discover is a Premium service, unlocked with a coupon.</p>`;
  return '';
};
const head = (cur, title, extra = '') => `${H.pageHead('Discover', title, extra)}${subnav(cur)}${banner()}`;
const sym = (s) => H.symLink(s);
const name = (s, info) => (info[s]?.n ? `<span class="sub">${H.esc(info[s].n)}</span>` : '');
const signCls = (g) => (g === 'pos' ? 'good' : g === 'neg' ? 'bad' : '');
const mySyms = () => new Set((H.myLists() || []).flatMap((l) => l.syms));
const builtNote = (d) => (d?.built ? `<span class="k-pill plain" title="When this data was put together">Updated ${H.fShort(d.built.slice(0, 10))}</span>` : '');

export async function viewDiscover(helpers, sec) {
  H = helpers;
  sec = sec || '';
  if (sec === 'rrg') { location.replace('#/sectors/rrg'); return ''; }
  if (sec === 'xray') { location.replace('#/portfolio'); return ''; }
  [PREM] = await Promise.all([H.premium(), H.wlLoad()]);
  if (!PREM.active) return locked(sec);
  if (sec === 'triggers') return triggers();
  if (sec === 'investors') return investors();
  if (sec === 'valuation') return valuation();
  if (sec === 'management') return management();
  if (sec === 'mystocks') return mystocks();
  return H.T.viewTerminal(H, 'discover', { prem: PREM });
}

/* ---------------- premium lock (after the free days) ---------------- */
function locked(sec) {
  const t = (SECS.find(([k]) => k === sec) || SECS[0])[1];
  return `${H.pageHead('Discover', sec ? t : 'Discover', '<span class="k-pill warn">Premium</span>')}${subnav(sec)}
  <section class="card dc-lock">
    <p class="eyebrow">Premium service</p>
    <h2>Your ${PREM.trial_days || 60}-day free look at Discover ended${PREM.ends ? ' on ' + H.fDate(String(PREM.ends).slice(0, 10)) : ''}.</h2>
    <p>Discover is now part of Street ka Dalal Premium. Have a coupon? Type it below to unlock it.</p>
    <ul class="dc-lock-list">${SECS.slice(1).map(([, n]) => `<li>${n}</li>`).join('')}</ul>
    <div class="dc-coupon"><input id="dcCoupon" placeholder="Coupon code, like SKD-XXXX-XXXX" autocomplete="off" spellcheck="false"><button class="btn primary" data-act="dcCoupon">Unlock</button></div>
    <p class="sub" id="dcCouponMsg"></p>
    <p class="sub">Need a coupon? Ask us in the ${H.whatsapp ? `<a href="${H.esc(H.whatsapp)}" target="_blank" rel="noopener">WhatsApp community</a>` : 'WhatsApp community'}.</p>
  </section>`;
}

/* ---------------- overview ---------------- */
async function overview() {
  const [inv, val, gd, tr] = await Promise.all([load('investors'), load('valuation'), load('guidance'), load('triggers')]);
  const n50 = (val?.caps || []).find((c) => c.label === 'Nifty 50');
  const t = val?.temperature;
  const wk = Object.values(tr?.counts || {}).reduce((a, c) => a + c.d7, 0);
  const mine = mySyms();
  const tile = (k, t2, body) => `<a class="dc-tile" href="#/discover/${k}"><p class="eyebrow">${t2}</p>${body}</a>`;
  return `${head('', 'Discover')}
  <div class="dc-tiles">
    ${tile('triggers', 'All triggers', `<h3>${H.num(wk)} triggers in the last 7 days</h3><p class="sub">${Object.keys(tr?.buckets || {}).length} kinds: results, orders, capex, deals, ownership, guidance and red flags, from companies' own filings</p><ul class="dc-mini">${(tr?.latest || []).slice(0, 3).map((e) => `<li><b>${H.esc(e.s)}</b> ${H.esc(tr.buckets[e.k]?.title || '')}</li>`).join('')}</ul>`)}
    ${tile('investors', 'Big investors', `<h3>What well-known investors and promoters did</h3><ul class="dc-mini">${(inv?.events || []).slice(0, 4).map((e) => `<li><b>${H.esc(e.sym)}</b> ${H.esc(e.label)}</li>`).join('') || '<li>No data yet</li>'}</ul>`)}
    ${tile('valuation', 'Market valuation', `<h3>Is the market cheap or expensive?</h3>${n50 ? `<p class="dc-big">${H.esc(n50.zone || '-')}</p><p class="sub">Nifty 50 P/E ${H.num(n50.pe, 1)}, dearer than ${H.num(n50.pe_pct, 0)}% of past days</p>` : '<p class="sub">No data yet</p>'}${t ? `<p class="sub">Market temperature ${H.num(t.T, 0)} / 100 (${H.esc(t.zone || '')})</p>` : ''}`)}
    ${tile('management', 'What management said', `<h3>Guidance from earnings calls, word for word</h3><ul class="dc-mini">${(gd?.rows || []).slice(0, 3).map((r) => `<li><b>${H.esc(r.sym)}</b> ${H.esc((r.outlook || '').slice(0, 90))}</li>`).join('')}</ul>`)}
    ${tile('mystocks', 'My stocks this week', `<h3>Results, filings and big moves in your lists</h3><p class="sub">${mine.size ? `${mine.size} stocks across your lists` : 'Add stocks to a list on Stock watch to see them here'}</p>`)}
  </div>
  <p class="sub legend">Facts from NSE filings and company documents. Nothing here is a recommendation to buy or sell.</p>`;
}

/* ---------------- every Discovery Desk bucket ---------------- */
async function triggers() {
  const [tr, st] = await Promise.all([load('triggers'), H.stkAll()]);
  if (!tr) return `${head('triggers', 'All triggers')}<div class="empty card">This data is being put together. Please check back this evening.</div>`;
  const s = ST.tr, info = st.info, B = tr.buckets, C = tr.counts || {};
  const groups = tr.groups || [];
  const g = groups.find(([n]) => n === s.g) || null;
  const per = s.days <= 7 ? 'd7' : s.days <= 30 ? 'd30' : 'all';
  const bucketBtn = (k) => { const b = B[k], n = C[k]?.[per] || 0; return `<button class="dc-bk ${s.k === k ? 'on' : ''} ${b.sign}" data-act="dcSet" data-k="tr.k" data-v="${s.k === k ? '' : k}" title="${H.esc(b.about)}"><span>${H.esc(b.title)}</span><b>${H.num(n)}</b></button>`; };
  const board = `<div class="dc-board">${groups.map(([gn, slug]) => {
    const ks = Object.keys(B).filter((k) => B[k].group === gn).sort((a, b) => (C[b]?.[per] || 0) - (C[a]?.[per] || 0));
    const tot = ks.reduce((t, k) => t + (C[k]?.[per] || 0), 0);
    return `<section class="card dc-grp ${s.g === gn ? 'on' : ''}"><button class="dc-grp-h" data-act="dcSet" data-k="tr.g" data-v="${s.g === gn ? '' : H.esc(gn)}"><b>${H.esc(gn)}</b><span>${H.num(tot)}</span></button>
      <div class="dc-bks">${ks.map(bucketBtn).join('')}</div></section>`;
  }).join('')}</div>`;
  let list = '';
  const pick = s.k ? B[s.k] : null;
  const gname = pick ? pick.group : g ? g[0] : null;
  if (gname) {
    const slug = (groups.find(([n]) => n === gname) || [])[1];
    const f = slug ? await load('triggers_' + slug) : null;
    const cut = (() => { const x = new Date(); x.setDate(x.getDate() - s.days); return x.toISOString().slice(0, 10); })();
    const mine = mySyms();
    let ev = (f?.events || []).filter((e) => e.d >= cut && (!s.k || e.k === s.k));
    if (s.mine) ev = ev.filter((e) => mine.has(e.s));
    if (s.n === 200) H.after(() => setTimeout(() => { const el = document.getElementById('dcTrList'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70 }); }, 30));
    list = `<section class="card flush" id="dcTrList"><div class="card-head pad"><h2>${H.esc(pick ? pick.title : gname)}</h2><span class="sub">${pick ? H.esc(pick.about) + ' · ' : ''}${ev.length} in the last ${s.days} days</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Stock</th>${pick ? '' : '<th>Trigger</th>'}<th>What the filing says</th><th></th></tr></thead><tbody>
      ${ev.slice(0, s.n).map((e) => `<tr><td class="nowrap">${H.fDate(e.d)}</td><td>${sym(e.s)}${name(e.s, info)}</td>${pick ? '' : `<td>${H.chip(B[e.k]?.title || e.k, signCls(B[e.k]?.sign))}</td>`}<td class="sub-ish">${H.esc(e.t)}</td><td>${e.u ? `<a href="${H.esc(e.u)}" target="_blank" rel="noopener">Filing</a>` : ''}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Nothing in the last ${s.days} days.</td></tr>`}
      </tbody></table></div>${ev.length > s.n ? `<p class="more"><button class="btn sm" data-act="dcSet" data-k="tr.n" data-v="${s.n + 300}">Show more (${ev.length - s.n} left)</button></p>` : ''}</section>`;
  } else {
    list = `<section class="card flush"><div class="card-head pad"><h2>Latest triggers</h2><span class="sub">Pick a group or a trigger above to see all of them</span></div><div class="tbl-wrap"><table class="tbl"><tbody>
      ${(tr.latest || []).map((e) => `<tr><td class="nowrap">${H.fDate(e.d)}</td><td>${sym(e.s)}${name(e.s, info)}</td><td>${H.chip(B[e.k]?.title || e.k, signCls(B[e.k]?.sign))}</td><td class="sub-ish">${H.esc(e.t)}</td><td>${e.u ? `<a href="${H.esc(e.u)}" target="_blank" rel="noopener">Filing</a>` : ''}</td></tr>`).join('')}
    </tbody></table></div></section>`;
  }
  return `${head('triggers', 'All triggers', builtNote(tr))}
  <div class="toolbar"><div class="k-seg">${[[7, 'Last 7 days'], [30, 'Last 30 days'], [60, 'Last 60 days']].map(([v, t]) => `<button data-act="dcSet" data-k="tr.days" data-v="${v}" class="${s.days === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <button class="k-chip${s.mine ? ' on' : ''}" data-act="dcSet" data-k="tr.mine" data-v="${s.mine ? '' : '1'}">Only stocks in my lists</button>
    <span class="sub">Green = a business trigger, coral = a red flag, plain = worth knowing. Tap any trigger.</span></div>
  ${board}${list}
  <p class="sub legend">${H.esc(tr.note || '')}</p>`;
}

/* ---------------- big investors ---------------- */
const KIND_GROUPS = {
  all: ['All moves', null],
  ace: ['Well-known investors', ['ace_new', 'ace_up', 'ace_cut']],
  pbuy: ['Promoter buying', ['own_promoter_buy', 'own_promoter_up']],
  psell: ['Promoter selling', ['flag_promoter_sell', 'flag_promoter_down']],
  inst: ['Funds and FIIs', ['own_mf_up', 'own_fii_up']],
  pledge: ['Pledge', ['own_pledge_free', 'flag_pledge']],
};
async function investors() {
  const [inv, st] = await Promise.all([load('investors'), H.stkAll()]);
  if (!inv) return `${head('investors', 'Big investors')}<div class="empty card">This data is being put together. Please check back this evening.</div>`;
  const info = st.info, s = ST.inv;
  const mine = mySyms();
  let body;
  if (s.view === 'people') {
    body = `<div class="dc-people">${inv.people.map((p) => `<section class="card dc-person${s.open === p.name ? ' open' : ''}">
      <button class="dc-person-h" data-act="dcSet" data-k="inv.open" data-v="${s.open === p.name ? '' : H.esc(p.name)}"><b>${H.esc(p.name)}</b><span class="k-pill plain">${p.n} compan${p.n === 1 ? 'y' : 'ies'}</span></button>
      ${s.open === p.name ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Stock</th><th class="r">Stake</th><th class="r">Change</th><th>Quarter</th><th>Named since</th></tr></thead><tbody>
        ${p.holdings.map((h) => { const ch = h.prev != null && h.pct != null ? h.pct - h.prev : null; return `<tr><td>${sym(h.sym)}${name(h.sym, info)}</td><td class="r">${H.num(h.pct, 2)}%</td><td class="r ${H.tone(ch)}">${ch == null ? 'new' : `${ch > 0 ? '+' : ''}${H.num(ch, 2)}`}</td><td>${H.fDate(h.q)}</td><td>${H.fDate(h.since)}</td></tr>`; }).join('')}
      </tbody></table></div>` : `<p class="sub">${p.holdings.slice(0, 6).map((h) => H.esc(h.sym)).join(', ')}${p.n > 6 ? ' and more' : ''}</p>`}
    </section>`).join('')}</div>`;
  } else {
    const kinds = KIND_GROUPS[s.kind]?.[1];
    let ev = inv.events.filter((e) => !kinds || kinds.includes(e.kind));
    if (s.mine) ev = ev.filter((e) => mine.has(e.sym));
    body = `<section class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Stock</th><th>What happened</th><th>Detail</th></tr></thead><tbody>
      ${ev.slice(0, s.n).map((e) => `<tr><td class="nowrap">${H.fDate(e.day)}</td><td>${sym(e.sym)}${name(e.sym, info)}</td><td>${H.chip(e.label, signCls(e.sign))}</td><td class="sub-ish">${H.esc(e.title || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nothing here for this filter.</td></tr>'}
    </tbody></table></div>${ev.length > s.n ? `<p class="more"><button class="btn sm" data-act="dcSet" data-k="inv.n" data-v="${s.n + 200}">Show more (${ev.length - s.n} left)</button></p>` : ''}</section>`;
  }
  return `${head('investors', 'Big investors', builtNote(inv))}
  <div class="toolbar">
    <div class="k-seg">${[['moves', 'Latest moves'], ['people', 'By investor']].map(([k, t]) => `<button data-act="dcSet" data-k="inv.view" data-v="${k}" class="${s.view === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${s.view === 'moves' ? `<div class="k-seg">${Object.entries(KIND_GROUPS).map(([k, [t]]) => `<button data-act="dcSet" data-k="inv.kind" data-v="${k}" class="${s.kind === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <button class="k-chip${s.mine ? ' on' : ''}" data-act="dcSet" data-k="inv.mine" data-v="${s.mine ? '' : '1'}">Only stocks in my lists</button>` : ''}
  </div>
  ${body}
  <p class="sub legend">${H.esc(inv.note || '')}</p>`;
}

/* ---------------- market valuation ---------------- */
const ZCLS = (z, zones) => { const i = (zones?.names || []).indexOf(z); const n = (zones?.names || []).length; if (i < 0) return 'plain'; return i <= 1 ? 'ok' : i >= n - 2 ? 'bad' : 'warn'; };
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})/); return m ? `${MONS[+m[2] - 1]} ${m[1]}` : H.esc(s || ''); };
const meter = (p) => `<span class="dc-meter"><i style="left:${Math.max(0, Math.min(100, p || 0))}%"></i></span>`;
async function valuation() {
  const v = await load('valuation');
  if (!v) return `${head('valuation', 'Is the market cheap or expensive?')}<div class="empty card">This data is being put together. Please check back this evening.</div>`;
  const z = v.zones, t = v.temperature, b = v.bond;
  const idxNames = Object.keys(v.pe_history || {});
  const cur = idxNames.includes(ST.val.idx) ? ST.val.idx : idxNames[0];
  H.after(() => drawPE(v, cur));
  return `${head('valuation', 'Is the market cheap or expensive?', builtNote(v))}
  <div class="grid2">
    ${t ? `<section class="card dc-temp"><p class="eyebrow">Market temperature</p><p class="dc-huge">${H.num(t.T, 0)}<small>/100</small></p>
      <p><span class="k-pill ${ZCLS(t.zone, z)}">${H.esc(t.zone || '')}</span> ${t.zone_since ? `<span class="sub inline">since ${ym(t.zone_since)}</span>` : ''}</p>
      <p class="sub">0 = the cheapest the market has been, 100 = the dearest. Built from the Nifty 500's P/E, P/B and dividend yield against their own history and how many sectors trade above their usual level. As of ${H.fDate(t.date)}.</p></section>` : ''}
    ${b ? `<section class="card"><p class="eyebrow">Shares against bonds</p><p class="dc-huge">${H.num(b.gap, 2)}<small> pts</small></p>
      <p>Nifty 50 earnings yield <b>${H.num(b.ey, 2)}%</b> minus the 10-year government bond <b>${H.num(b.y10, 2)}%</b> (${H.esc(b.y10_month || '')}).</p>
      <p class="sub">The usual gap since ${H.esc(b.first || '')} is ${H.num(b.gap_med, 2)}. A smaller gap than usual means shares pay less than bonds compared with history. Zone: <span class="k-pill ${ZCLS(b.zone, z)}">${H.esc(b.zone || '')}</span></p></section>` : ''}
  </div>
  <section class="card flush"><div class="card-head pad"><h2>Each index against its own past</h2><span class="sub">P/E today, the usual P/E, and where today sits from cheapest (left) to dearest (right)</span></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Index</th><th class="r">P/E</th><th class="r">Usual P/E</th><th>Where today sits</th><th class="r">P/B</th><th class="r">Div. yield</th><th>Overall</th></tr></thead><tbody>
    ${(v.caps || []).map((c) => `<tr><td><b>${H.esc(c.label)}</b><span class="sub">${H.esc(c.bucket || '')} · history from ${H.esc(String(c.pe_from || '').slice(0, 4))}</span></td><td class="r">${H.num(c.pe, 1)}</td><td class="r">${H.num(c.pe_med, 1)}</td>
      <td>${meter(c.pe_pct)} <span class="sub inline">dearer than ${H.num(c.pe_pct, 0)}% of past days</span></td><td class="r">${H.num(c.pb, 2)}</td><td class="r">${H.num(c.dy, 2)}%</td><td><span class="k-pill ${ZCLS(c.zone, z)}">${H.esc(c.zone || '-')}</span></td></tr>`).join('')}
    </tbody></table></div></section>
  ${(v.relative || []).length ? `<section class="card"><h2>Smaller companies against large ones</h2><p class="sub">P/E of each group divided by the Nifty 100's, against its own history</p>
    <div class="dc-rel">${v.relative.map((r) => `<div><b>${H.esc(r.label)}</b><span>${H.num(r.pe, 2)}x the Nifty 100 P/E (usual ${H.num(r.pe_med, 2)}x)</span>${meter(r.pe_pct)}<span class="k-pill ${ZCLS(r.zone, z)}">${H.esc(r.zone || '')}</span></div>`).join('')}</div></section>` : ''}
  <section class="card"><div class="card-head"><h2>P/E over the years</h2><div class="k-seg">${idxNames.map((n) => `<button data-act="dcSet" data-k="val.idx" data-v="${H.esc(n)}" class="${n === cur ? 'on' : ''}">${H.esc(n)}</button>`).join('')}</div></div>
    <div id="dcPE" class="dc-chart"></div><p class="sub">Weekly. Dashed lines: the usual level (middle) and the cheapest 20% / dearest 20% of history. NSE changed how it counts index earnings in 2021; the line is joined at that date.</p></section>
  <div class="grid2">
    <section class="card"><h2>Cheapest sector indices now</h2><p class="sub">Against their own history</p><ul class="plain">${(v.cheapest || []).map((r) => `<li>${H.esc(r.name)} <span class="k-pill ${ZCLS(r.zone, z)}">${H.esc(r.zone || '')}</span> <span class="sub inline">P/E ${H.num(r.pe, 1)}</span></li>`).join('')}</ul></section>
    <section class="card"><h2>Dearest sector indices now</h2><p class="sub">Against their own history</p><ul class="plain">${(v.dearest || []).map((r) => `<li>${H.esc(r.name)} <span class="k-pill ${ZCLS(r.zone, z)}">${H.esc(r.zone || '')}</span> <span class="sub inline">P/E ${H.num(r.pe, 1)}</span></li>`).join('')}</ul></section>
  </div>
  <p class="sub legend">${H.esc(v.note || '')} Not a recommendation to buy or sell.</p>`;
}
async function drawPE(v, cur) {
  const el = $('#dcPE');
  const h = v.pe_history?.[cur];
  if (!el || !h || !Array.isArray(h.points) || !h.points.length) { if (el) el.innerHTML = '<p class="sub">No history to draw.</p>'; return; }
  const LW = await H.CH.lw();
  const ch = LW.createChart(el, { autoSize: true, layout: { background: { type: 'solid', color: 'transparent' }, textColor: H.CH.C.muted, fontFamily: '"Satoshi", "Segoe UI", system-ui, sans-serif', fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { color: H.CH.C.line } }, rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false } });
  const s = ch.addLineSeries({ color: H.CH.C.green2, lineWidth: 2, priceLineVisible: false });
  s.setData(h.points.map(([d, x]) => ({ time: d, value: x })));
  [[h.median, 'usual'], [h.p20, 'cheap 20%'], [h.p80, 'dear 20%']].forEach(([y, t]) => { if (y != null) s.createPriceLine({ price: y, color: t === 'usual' ? H.CH.C.gold : H.CH.C.muted, lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: t }); });
  ch.timeScale().fitContent();
}

/* ---------------- RRG ---------------- */
const QC = { Leading: 'var(--pos)', Weakening: 'var(--sand)', Lagging: 'var(--neg)', Improving: 'var(--sky)' };
export async function viewRRG(helpers) { H = helpers; return rrg(); }
async function rrg() {
  const r = await load('rrg');
  const view = r?.views?.[ST.rrg.iv];
  if (!view) return `${H.pageHead('Market', 'Rotation (RRG)')}<div class="empty card">This data is being put together. Please check back this evening.</div>`;
  const rows = view.rows.filter((x) => ST.rrg.broad || !x.broad);
  const pts = rows.flatMap((x) => x.rotation_path || []);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const span = Math.max(1.5, ...xs.map((x) => Math.abs(x - 100)), ...ys.map((y) => Math.abs(y - 100))) * 1.12;
  const W = 760, Hh = 560, pad = 34;
  const X = (x) => pad + ((x - (100 - span)) / (2 * span)) * (W - 2 * pad);
  const Y = (y) => Hh - pad - ((y - (100 - span)) / (2 * span)) * (Hh - 2 * pad);
  const cx = X(100), cy = Y(100);
  const quads = [['Improving', pad, pad, cx - pad, cy - pad], ['Leading', cx, pad, W - pad - cx, cy - pad], ['Lagging', pad, cy, cx - pad, Hh - pad - cy], ['Weakening', cx, cy, W - pad - cx, Hh - pad - cy]];
  const svg = `<svg class="dc-rrg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Relative rotation graph">
    ${quads.map(([q, x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${QC[q]}" opacity="0.07"/><text x="${q === 'Leading' || q === 'Weakening' ? x + w - 8 : x + 8}" y="${q === 'Improving' || q === 'Leading' ? y + 18 : y + h - 10}" text-anchor="${q === 'Leading' || q === 'Weakening' ? 'end' : 'start'}" class="dc-q" fill="${QC[q]}">${q}</text>`).join('')}
    <line x1="${cx}" y1="${pad}" x2="${cx}" y2="${Hh - pad}" class="dc-axis"/><line x1="${pad}" y1="${cy}" x2="${W - pad}" y2="${cy}" class="dc-axis"/>
    <text x="${W - pad}" y="${Hh - 8}" text-anchor="end" class="dc-ax">Relative strength (stronger to the right)</text>
    <text x="10" y="${pad - 12}" class="dc-ax">Momentum of that strength (rising upward)</text>
    ${rows.map((x) => { const p = x.rotation_path || []; if (!p.length) return ''; const c = QC[x.quadrant] || 'var(--ink)'; const last = p[p.length - 1];
      return `<g><title>${H.esc(x.name)}: ${H.esc(x.quadrant)} (strength ${H.num(x.rs_ratio, 2)}, momentum ${H.num(x.rs_mom, 2)})</title>
        <polyline points="${p.map(([a, bb]) => `${X(a).toFixed(1)},${Y(bb).toFixed(1)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="1.4" opacity="0.6"/>
        ${p.slice(0, -1).map(([a, bb]) => `<circle cx="${X(a).toFixed(1)}" cy="${Y(bb).toFixed(1)}" r="1.8" fill="${c}" opacity="0.5"/>`).join('')}
        <circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="4.5" fill="${c}"/>
        <text x="${(X(last[0]) + 7).toFixed(1)}" y="${(Y(last[1]) + 4).toFixed(1)}" class="dc-lbl">${H.esc(x.name.replace(/^Nifty /, ''))}</text></g>`; }).join('')}
  </svg>`;
  const byQ = ['Leading', 'Improving', 'Weakening', 'Lagging'].map((q) => [q, rows.filter((x) => x.quadrant === q)]);
  return `${H.pageHead('Market', 'Rotation (RRG)', `<span class="k-pill plain">As of ${H.fDate(view.as_of)}</span>`)}
  <div class="toolbar">
    <div class="k-seg">${[['daily', 'Daily'], ['weekly', 'Weekly']].map(([k, t]) => `<button data-act="dcSet" data-k="rrg.iv" data-v="${k}" class="${ST.rrg.iv === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <button class="k-chip${ST.rrg.broad ? ' on' : ''}" data-act="dcSet" data-k="rrg.broad" data-v="${ST.rrg.broad ? '' : '1'}">Show broad indices too</button>
    <span class="sub">Every NSE sector index against the Nifty 500. Each dot is the latest ${ST.rrg.iv === 'weekly' ? 'week' : 'day'}, the trail is the last 8.</span>
  </div>
  <section class="card dc-rrg-card">${svg}</section>
  <div class="dc-quads">${byQ.map(([q, xs2]) => `<section class="card"><h3 style="color:${QC[q]}">${q} <span class="sub inline">${xs2.length}</span></h3><ul class="plain">${xs2.map((x) => `<li>${H.esc(x.name)} <span class="sub inline">1W <span class="${H.tone(x.ret_1w)}">${H.pct(x.ret_1w, 1)}</span> · 1M <span class="${H.tone(x.ret_1m)}">${H.pct(x.ret_1m, 1)}</span></span></li>`).join('') || '<li class="sub">None</li>'}</ul></section>`).join('')}</div>
  <p class="sub legend">How to read it: Leading = stronger than the Nifty 500 and still gaining; Weakening = still stronger but losing pace; Lagging = weaker and still losing; Improving = weaker but catching up. Indices usually move round the circle clockwise. Source: ${H.esc(view.source || 'NSE Indices')}. Not a recommendation to buy or sell.</p>`;
}

/* ---------------- what management said ---------------- */
const METRIC = { revenue: 'Revenue', revenue_growth: 'Revenue growth', volume_growth: 'Volume growth', ebitda_margin: 'EBITDA margin', margin: 'Margin', capex: 'Capex', order_book: 'Order book', pat: 'Profit', ebitda: 'EBITDA', debt: 'Debt' };
async function management() {
  const [g, st] = await Promise.all([load('guidance'), H.stkAll()]);
  if (!g) return `${head('management', 'What management said')}<div class="empty card">This data is being put together. Please check back this evening.</div>`;
  const info = st.info, s = ST.gd, mine = mySyms();
  const q = s.q.trim().toUpperCase();
  let rows = g.rows;
  if (s.mine) rows = rows.filter((r) => mine.has(r.sym));
  if (q) rows = rows.filter((r) => r.sym.includes(q) || String(info[r.sym]?.n || '').toUpperCase().includes(q) || String(r.outlook).toUpperCase().includes(q));
  return `${head('management', 'What management said', builtNote(g))}
  <div class="toolbar"><div class="search">${H.ic('search', 16)}<input data-input="dcGd" value="${H.esc(s.q)}" placeholder="Search a company or a word (capex, margin, order book)"></div>
    <button class="k-chip${s.mine ? ' on' : ''}" data-act="dcSet" data-k="gd.mine" data-v="${s.mine ? '' : '1'}">Only stocks in my lists</button><span class="sub">${rows.length} companies</span></div>
  <div class="dc-gd">${rows.slice(0, s.n).map((r) => `<section class="card"><div class="card-head"><div>${sym(r.sym)}${name(r.sym, info)}</div><span class="sub">${H.fDate(r.day)} · ${H.esc(r.kind === 'transcript' ? 'earnings call' : r.kind || 'document')}</span></div>
    ${r.outlook ? `<p class="dc-out">${H.esc(r.outlook)}</p>` : ''}
    <ul class="dc-items">${r.items.map((i) => `<li><span class="k-pill info">${H.esc(METRIC[i.metric] || String(i.metric || '').replace(/_/g, ' '))}${i.period ? ' · ' + H.esc(i.period) : ''}</span> <b>${H.esc(i.value || '')}</b><blockquote>"${H.esc(i.quote)}"</blockquote></li>`).join('')}</ul></section>`).join('') || '<div class="empty card">Nothing matches.</div>'}</div>
  ${rows.length > s.n ? `<p class="more"><button class="btn sm" data-act="dcSet" data-k="gd.n" data-v="${s.n + 40}">Show more (${rows.length - s.n} left)</button></p>` : ''}
  <p class="sub legend">${H.esc(g.note || '')} What a company plans is not a promise; read it with the results that follow.</p>`;
}

/* ---------------- my stocks this week ---------------- */
async function mystocks() {
  const lists = H.myLists();
  const s = ST.my;
  const syms = s.list === 'all' ? [...new Set(lists.flatMap((l) => l.syms))] : (lists[+s.list]?.syms || []);
  const picker = `<div class="k-seg">${[['all', 'All my lists'], ...lists.map((l, i) => [String(i), l.name])].map(([k, t]) => `<button data-act="dcSet" data-k="my.list" data-v="${H.esc(k)}" class="${s.list === k ? 'on' : ''}">${H.esc(t)}</button>`).join('')}</div>`;
  if (!syms.length) return `${head('mystocks', 'My stocks this week')}<div class="toolbar">${picker}</div><div class="empty card">No stocks in ${s.list === 'all' ? 'your lists' : 'this list'} yet. Open <a href="#/">Stock watch</a>, pick a stock and press "Add to list".</div>`;
  const [st, hub, inv, gd, corp, fil] = await Promise.all([H.stkAll(), H.hist('results/hub').catch(() => ({})), load('investors'), load('guidance'), load('corp'), H.filingsData().catch(() => ({}))]);
  const { info, daily, asOf } = st;
  const today = hub.today || asOf;
  const plus = (n) => { const d = H.pd(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const set = new Set(syms);
  const cal = {}; (hub.calendar || []).forEach((r) => { if (set.has(r.sym) && r.date >= today && r.date <= plus(14)) (cal[r.sym] ||= []).push(r); });
  const ann = {}; (hub.announced || []).forEach((r) => { if (set.has(r.sym) && String(r.ts || '') >= plus(-10)) (ann[r.sym] ||= []).push(r); });
  const fl = {}; (fil.filings || []).forEach((f) => { if (set.has(f.sym) && String(f.ts || '') >= plus(-7)) (fl[f.sym] ||= []).push(f); });
  const ev = {}; (inv?.events || []).forEach((e) => { if (set.has(e.sym) && e.day >= plus(-30)) (ev[e.sym] ||= []).push(e); });
  const gl = {}; (gd?.rows || []).forEach((r) => { if (set.has(r.sym) && r.day >= plus(-45)) gl[r.sym] = r; });
  const cp = {}; (corp?.events || []).forEach((e) => { if (set.has(e.sym)) (cp[e.sym] ||= []).push(e); });
  const cards = syms.filter((x) => info[x]).map((x) => {
    const d = daily[x] || {}, r = d.r || [];
    const bits = [];
    (cal[x] || []).forEach((c) => bits.push(`<li>${H.chip('Results coming', 'warn')} ${H.fDay(c.date)}${c.status === 'confirmed' ? '' : ' (estimated)'}${c.call ? `, call ${H.fDT(c.call)}` : ''}</li>`));
    (ann[x] || []).forEach((a) => bits.push(`<li>${H.chip('Results out', a.label === 'Weak' ? 'bad' : 'good')} ${H.fDate(String(a.ts).slice(0, 10))}${a.label && a.label !== '-' ? `: ${H.esc(a.label)}` : ''}${a.rev_y != null ? `, sales ${H.pct(a.rev_y, 1)}` : ''}${a.pat_y != null ? `, profit ${H.pct(a.pat_y, 1)}` : ''} <a href="#/results/co/${encodeURIComponent(x)}">details</a></li>`));
    (ev[x] || []).forEach((e) => bits.push(`<li>${H.chip(e.label, signCls(e.sign))} ${H.fDate(e.day)}: ${H.esc(e.title || '')}</li>`));
    (cp[x] || []).forEach((c) => bits.push(`<li>${H.chip(c.type || 'Corporate action', '')} ex-date ${H.fDate(c.ex)}${c.amount ? `, Rs ${H.esc(c.amount)}` : ''}</li>`));
    if (gl[x]) bits.push(`<li>${H.chip('Management spoke', 'info')} ${H.fDate(gl[x].day)}: ${H.esc((gl[x].outlook || '').slice(0, 160))} <a href="#/discover/management" data-act="dcSet" data-k="gd.q" data-v="${H.esc(x)}">read</a></li>`);
    (fl[x] || []).slice(0, 4).forEach((f) => bits.push(`<li>${H.chip(f.label || f.type || 'Filing', '')} ${H.fDT(f.ts)}: ${H.esc((f.subject || '').slice(0, 140))}${f.pdf ? ` <a href="${H.esc(f.pdf)}" target="_blank" rel="noopener">PDF</a>` : ''}</li>`));
    const big = Math.abs(r[0] || 0) >= 4 || Math.abs(r[1] || 0) >= 7;
    if (big) bits.push(`<li>${H.chip('Big move', (r[1] || r[0]) > 0 ? 'good' : 'bad')} ${H.pct(r[0], 1)} on the day, ${H.pct(r[1], 1)} on the week</li>`);
    return { x, n: bits.length, html: `<section class="card dc-my"><div class="card-head"><div>${sym(x)}<span class="sub">${H.esc(info[x].n || '')}</span></div><div class="dc-px"><b>${H.num(d.p, 2)}</b> <span class="${H.tone(r[0])}">${H.pct(r[0], 2)}</span> <span class="sub inline">1W <span class="${H.tone(r[1])}">${H.pct(r[1], 1)}</span></span></div></div>
      ${bits.length ? `<ul class="dc-items">${bits.join('')}</ul>` : '<p class="sub">Nothing new this week.</p>'}</section>` };
  }).sort((a, b) => b.n - a.n);
  const nRes = Object.keys(cal).length, nOut = Object.keys(ann).length, nEv = Object.values(ev).reduce((t, a) => t + a.length, 0), nFil = Object.values(fl).reduce((t, a) => t + a.length, 0);
  return `${head('mystocks', 'My stocks this week', H.fresh(asOf))}
  <div class="toolbar">${picker}</div>
  <div class="dc-kpis"><div><b>${syms.length}</b><span>stocks</span></div><div><b>${nRes}</b><span>results in the next 14 days</span></div><div><b>${nOut}</b><span>results just out</span></div><div><b>${nFil}</b><span>filings this week</span></div><div><b>${nEv}</b><span>big investor / promoter moves (30 days)</span></div></div>
  <div class="dc-mygrid">${cards.map((c) => c.html).join('')}</div>
  <p class="sub legend">Dividend dates show only where our corporate-actions feed has them; check the company's NSE filing. Facts only, not advice.</p>`;
}

/* ---------------- my portfolio + X-ray (its own tab, #/portfolio) ----------------
   Sagar 2026-11-16: "portfolio x ray also as a separate at the end ... add drop down for to put stocks in x ray and number of
   quantity at what price so they can track the whole portfolio". Lots { s, q, p, d } saved on the member's login
   (users/{uid}.portfolio). Prices are the last NSE close on the site, not live. */
let PF = null;
async function pfLoad(force) { if (PF && !force) return PF; try { PF = await H.A.getPortfolio(); } catch { PF = []; } return PF; }
async function pfSave() { try { await H.A.savePortfolio(PF); } catch { H.toast('Could not save just now. It is kept in this browser.'); } }
const pfv = (id) => (document.getElementById(id)?.value || '').trim();

// called from app.js (data-act="dcCall" data-fn="...") ; returns true when the page should redraw
export async function call(fn, el) {
  await pfLoad();
  if (fn === 'pfAdd') {
    const s = (document.getElementById('pfQ')?.dataset.sym || '').toUpperCase();
    const q = +pfv('pfQty'), p = +pfv('pfPrice'), d = pfv('pfDate');
    const msg = document.getElementById('pfMsg');
    const say = (t) => { if (msg) msg.textContent = t; };
    if (!s) return say('Pick a stock from the list first.'), false;
    if (!(q > 0)) return say('Type how many shares (more than 0).'), false;
    if (!(p > 0)) return say('Type the price you bought at.'), false;
    PF.push({ s, q, p, d: d || null });
    await pfSave();
    H.toast(`${s} added: ${H.num(q, 2)} at Rs ${H.num(p, 2)}`);
    return true;
  }
  if (fn === 'pfDelSym') { const s = el.dataset.v; if (!confirm(`Remove every ${s} lot from your portfolio?`)) return false; PF = PF.filter((x) => x.s !== s); await pfSave(); return true; }
  if (fn === 'pfDelLot') { PF.splice(+el.dataset.v, 1); await pfSave(); return true; }
  if (fn === 'pfOpen') { ST.pf.lot = ST.pf.lot === el.dataset.v ? null : el.dataset.v; return true; }
  if (fn === 'pfImport') {
    const st = await H.stkAll();
    const { rows, bad } = parseLines(pfv('pfPaste'), st.info);
    rows.forEach((r) => PF.push(r));
    await pfSave();
    H.toast(`${rows.length} added${bad.length ? `, ${bad.length} not matched` : ''}`);
    return true;
  }
  if (fn === 'pfList') {
    const l = H.myLists()[+el.dataset.v]; const st = await H.stkAll();
    (l?.syms || []).forEach((s) => { if (!PF.some((x) => x.s === s)) PF.push({ s, q: 1, p: st.daily[s]?.p || null, d: null }); });
    await pfSave(); H.toast('Added with 1 share each at the last close; change the quantity and price by removing and adding again');
    return true;
  }
  if (fn === 'pfClear') { if (!confirm('Remove every holding from your portfolio? This cannot be undone.')) return false; PF = []; await pfSave(); return true; }
  return false;
}

// "SYMBOL qty price" (or a company name) per line, as copied from a broker's holdings page
function parseLines(text, info) {
  const out = [], bad = [];
  const names = Object.entries(info).map(([s, x]) => [s, String(x.n || '').toUpperCase()]);
  for (const raw of String(text || '').split(/\n|;/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[\s,\t]+/).filter(Boolean);
    let s = (parts[0] || '').toUpperCase().replace(/^NSE:/, '').replace(/-EQ$/, '');
    if (!info[s]) { const n = line.toUpperCase().replace(/[0-9.,\s]+$/, '').trim(); const hit = names.find(([, nm]) => nm && (nm === n || nm.startsWith(n + ' '))); if (hit) s = hit[0]; }
    if (!info[s]) { bad.push(line); continue; }
    const nums = parts.slice(1).map((x) => Number(String(x).replace(/,/g, ''))).filter((v) => isFinite(v) && v > 0);
    out.push({ s, q: nums[0] || 1, p: nums[1] || null, d: null });
  }
  return { rows: out, bad };
}

// the search box: type a name or ticker, pick from the list
function pfSearch(info, daily) {
  const inp = document.getElementById('pfQ'), box = document.getElementById('pfAc');
  if (!inp || !box) return;
  let hits = [], at = 0;
  const paint = () => { box.hidden = !hits.length; box.innerHTML = hits.map((h, i) => `<div data-s="${H.esc(h.s)}" class="${i === at ? 'on' : ''}">${H.esc(h.n)}<small>${H.esc(h.s)}</small><em>${H.num(daily[h.s]?.p, 2)}</em></div>`).join(''); };
  const pick = (s) => {
    inp.value = `${s}  ${info[s]?.n || ''}`; inp.dataset.sym = s; hits = []; paint();
    const pr = document.getElementById('pfPrice'); if (pr && !pr.value && daily[s]?.p) pr.placeholder = `Buy price (last close ${H.num(daily[s].p, 2)})`;
    document.getElementById('pfQty')?.focus();
  };
  inp.addEventListener('input', () => {
    inp.dataset.sym = '';
    const q = inp.value.trim().toUpperCase(); at = 0;
    if (!q) { hits = []; paint(); return; }
    hits = Object.entries(info).filter(([s, x]) => s.includes(q) || String(x.n || '').toUpperCase().includes(q))
      .map(([s, x]) => ({ s, n: x.n || s, w: (s === q ? 3 : s.startsWith(q) ? 2 : 0) + (daily[s]?.mc || 0) / 1e7 })).sort((a, b) => b.w - a.w).slice(0, 8);
    paint();
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!hits.length) return; e.preventDefault(); at = (at + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits[at]) pick(hits[at].s); }
    else if (e.key === 'Escape') { hits = []; paint(); }
  });
  box.addEventListener('mousedown', (e) => { const d2 = e.target.closest('[data-s]'); if (d2) { e.preventDefault(); pick(d2.dataset.s); } });
  inp.addEventListener('blur', () => setTimeout(() => { hits = []; paint(); }, 150));
  ['pfQty', 'pfPrice', 'pfDate'].forEach((id) => document.getElementById(id)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.querySelector('[data-fn="pfAdd"]')?.click(); }));
}

function portPE(rows) {
  let w = 0, e = 0;
  rows.forEach((r) => { if (r.d.pe > 0) { w += r.w; e += r.w / r.d.pe; } });
  return e ? w / e : null;
}

export async function viewPortfolio(helpers) {
  H = helpers;
  await H.wlLoad();
  const [st] = await Promise.all([H.stkAll(), pfLoad(true)]);
  const { info, daily, asOf } = st;
  H.after(() => pfSearch(info, daily));
  const lists = H.myLists();
  const addForm = `<section class="card pf-addcard"><h2>Add a holding</h2>
    <div class="pf-add">
      <div class="tw-find pf-find"><input id="pfQ" placeholder="Search a stock (name or ticker)" autocomplete="off" spellcheck="false"><div class="tw-ac" id="pfAc" hidden></div></div>
      <input id="pfQty" type="number" min="0" step="any" placeholder="Quantity">
      <input id="pfPrice" type="number" min="0" step="any" placeholder="Buy price (Rs)">
      <input id="pfDate" type="date" title="Buy date (optional)">
      <button class="btn primary" data-act="dcCall" data-fn="pfAdd">Add</button>
    </div>
    <p class="sub" id="pfMsg">Bought the same stock more than once? Add each buy; the average price is worked out for you. Saved on your login, so it shows on your phone and laptop.</p>
    <details class="pf-more"><summary>Add many at once</summary>
      <p class="sub">One per line: symbol, quantity, buy price. Example: <code>RELIANCE 20 1250</code>. You can paste the holdings list from your broker.</p>
      <textarea id="pfPaste" class="dc-xin" rows="5" placeholder="RELIANCE 20 1250&#10;HDFCBANK 50 1620&#10;TCS 10 3900"></textarea>
      <div class="toolbar" style="margin-top:8px"><button class="btn sm primary" data-act="dcCall" data-fn="pfImport">Add these</button>
        ${lists.map((l, i) => `<button class="btn sm" data-act="dcCall" data-fn="pfList" data-v="${i}">Add stocks of "${H.esc(l.name)}"</button>`).join('')}</div>
    </details></section>`;
  const title = H.pageHead('My portfolio', 'Portfolio X-ray', H.fresh(asOf));
  if (!PF.length) return `${title}${addForm}<p class="sub legend">Facts about what you hold, not advice on what to buy, sell or keep.</p>`;

  // one row per stock: lots added up, average price over the lots that have a price
  const by = {};
  PF.forEach((x, i) => { (by[x.s] ||= { s: x.s, lots: [] }).lots.push({ ...x, i }); });
  const rows = Object.values(by).filter((r) => info[r.s]).map((r) => {
    const d = daily[r.s] || {};
    const q = r.lots.reduce((t, x) => t + x.q, 0);
    const priced = r.lots.filter((x) => x.p);
    const pq = priced.reduce((t, x) => t + x.q, 0);
    const cost = priced.reduce((t, x) => t + x.q * x.p, 0);
    const avg = pq ? cost / pq : null;
    const value = q * (d.p || 0);
    const pl = avg != null ? pq * (d.p || 0) - cost : null;
    const day = d.p && (d.r || [])[0] != null ? value - value / (1 + d.r[0] / 100) : null;
    return { ...r, d, q, avg, cost, value, pl, plp: cost ? pl / cost * 100 : null, day, partial: pq < q };
  }).sort((a, b) => b.value - a.value);
  const missing = Object.keys(by).filter((s) => !info[s]);
  const tv = rows.reduce((t, r) => t + r.value, 0) || 1;
  rows.forEach((r) => { r.w = r.value / tv * 100; });
  const tc = rows.reduce((t, r) => t + (r.cost || 0), 0);
  const tpl = rows.reduce((t, r) => t + (r.pl || 0), 0);
  const tday = rows.reduce((t, r) => t + (r.day || 0), 0);
  const rs = (v, dgt = 0) => (v == null ? '-' : `${v < 0 ? '-' : ''}Rs ${H.num(Math.abs(v), dgt)}`);

  const table = `<section class="card flush"><div class="card-head pad"><h2>Holdings</h2><span class="sub">Prices at the last NSE close (${H.fDate(asOf)}), not live</span></div><div class="tbl-wrap"><table class="tbl pf-tbl"><thead><tr>
      <th>Stock</th><th class="r">Qty</th><th class="r">Avg buy</th><th class="r">Invested</th><th class="r">Last</th><th class="r">Value</th><th class="r">P&amp;L</th><th class="r">P&amp;L %</th><th class="r">Today</th><th class="r">Weight</th><th></th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${sym(r.s)}<span class="sub">${H.esc(info[r.s]?.n || '')}</span></td><td class="r">${H.num(r.q, r.q % 1 ? 2 : 0)}</td><td class="r">${H.num(r.avg, 2)}${r.partial ? '<span class="sub">some lots have no price</span>' : ''}</td>
      <td class="r">${rs(r.cost)}</td><td class="r">${H.num(r.d.p, 2)}</td><td class="r">${rs(r.value)}</td>
      <td class="r ${H.tone(r.pl)}">${rs(r.pl)}</td><td class="r ${H.tone(r.plp)}">${H.pct(r.plp, 1)}</td><td class="r ${H.tone(r.day)}">${rs(r.day)}</td><td class="r">${H.num(r.w, 1)}%</td>
      <td class="nowrap"><button class="btn sm ghost" data-act="dcCall" data-fn="pfOpen" data-v="${H.esc(r.s)}">${r.lots.length} lot${r.lots.length === 1 ? '' : 's'}</button> <button class="btn sm ghost" data-act="dcCall" data-fn="pfDelSym" data-v="${H.esc(r.s)}" title="Remove this stock">Remove</button></td></tr>
      ${ST.pf.lot === r.s ? r.lots.map((x) => `<tr class="pf-lot"><td colspan="2" class="sub">Bought ${x.d ? H.fDate(x.d) : '(no date)'}</td><td class="r">${H.num(x.q, x.q % 1 ? 2 : 0)} at ${x.p ? H.num(x.p, 2) : 'no price'}</td><td class="r">${x.p ? rs(x.q * x.p) : '-'}</td><td colspan="2"></td><td class="r ${H.tone(x.p ? x.q * (r.d.p - x.p) : null)}">${x.p ? rs(x.q * (r.d.p - x.p)) : '-'}</td><td colspan="3"></td><td><button class="btn sm ghost" data-act="dcCall" data-fn="pfDelLot" data-v="${x.i}">Remove lot</button></td></tr>`).join('') : ''}`).join('')}
    </tbody></table></div></section>`;

  // the X-ray of the same holdings, weighted by value
  const [hub, mf, inv, gd, fpart] = await Promise.all([H.hist('results/hub').catch(() => ({})), H.hist('mf/stocks').catch(() => ({})), load('investors'), load('guidance'),
    Promise.all([...new Set(rows.map((r) => (/^[A-Z]/.test(r.s[0]) ? r.s[0] : '0')))].map((c) => H.hist('stk/f/' + c).catch(() => null)))]);
  const fund = {}; fpart.forEach((p2) => Object.assign(fund, p2?.rows || {}));
  const byCap = Object.keys(daily).filter((s) => daily[s].mc != null).sort((a, b) => daily[b].mc - daily[a].mc);
  const rank = {}; byCap.forEach((s, i) => { rank[s] = i + 1; });
  const sizeOf = (s) => { const r = rank[s]; return !r ? 'Unknown' : r <= 100 ? 'Largest 100' : r <= 250 ? 'Next 150 (mid)' : r <= 500 ? 'Next 250 (small)' : 'Beyond the top 500'; };
  const wavg = (f) => { let a = 0, w = 0; rows.forEach((r) => { const v = f(r); if (v != null && isFinite(v)) { a += v * r.w; w += r.w; } }); return w ? a / w : null; };
  const mix = (keyf) => { const m = {}; rows.forEach((r) => { const k = keyf(r); m[k] = (m[k] || 0) + r.w; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const bars = (arr) => `<div class="dc-bars">${arr.map(([k, w]) => `<div><span>${H.esc(k)}</span><i style="width:${Math.max(1, w)}%"></i><b>${H.num(w, 1)}%</b></div>`).join('')}</div>`;
  const today = hub.today || asOf;
  const plus = (n) => { const x = H.pd(today); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const nextRes = {}; (hub.calendar || []).forEach((c) => { if (c.date >= today && (!nextRes[c.sym] || c.date < nextRes[c.sym].date)) nextRes[c.sym] = c; });
  const owners = {}; (inv?.people || []).forEach((p2) => p2.holdings.forEach((h) => { (owners[h.sym] ||= []).push(`${p2.name} ${H.num(h.pct, 1)}%`); }));
  const flags = {}; (inv?.events || []).forEach((e) => { if (['flag_promoter_sell', 'flag_promoter_down', 'flag_pledge'].includes(e.kind) && e.day >= plus(-180)) (flags[e.sym] ||= new Set()).add(e.label); });
  const gdSet = new Set((gd?.rows || []).map((g) => g.sym));
  const soon = rows.filter((r) => nextRes[r.s] && nextRes[r.s].date <= plus(14));
  const deep = rows.filter((r) => (r.d.hi ?? 0) <= -30);
  const flagged = rows.filter((r) => flags[r.s]);
  const sec = mix((r) => info[r.s]?.sec || 'Unclassified');
  const big = rows[0];
  const facts = [
    `Biggest holding: <b>${H.esc(big.s)}</b> at ${H.num(big.w, 1)}% of the portfolio. Biggest sector: <b>${H.esc(sec[0][0])}</b> at ${H.num(sec[0][1], 1)}%${sec[0][1] >= 40 ? ' (a large share in one sector)' : ''}.`,
    `${soon.length} holding${soon.length === 1 ? ' has' : 's have'} results in the next 14 days${soon.length ? ': ' + soon.map((r) => `${H.esc(r.s)} (${H.fShort(nextRes[r.s].date)})`).join(', ') : ''}.`,
    `${deep.length} holding${deep.length === 1 ? ' is' : 's are'} 30% or more below the 52-week high${deep.length ? ': ' + deep.map((r) => H.esc(r.s)).join(', ') : ''}.`,
    flagged.length ? `Promoter selling, a stake cut or a pledge was filed in the last 6 months for: ${flagged.map((r) => H.esc(r.s)).join(', ')}.` : 'No promoter selling or pledge filings in the last 6 months for these holdings.',
  ];
  return `${title}
  <div class="dc-kpis">
    <div><b>${rs(tc)}</b><span>invested</span></div><div><b>${rs(tv)}</b><span>value at the last close</span></div>
    <div><b class="${H.tone(tpl)}">${rs(tpl)}</b><span>total P&amp;L ${tc ? `(<span class="${H.tone(tpl)}">${H.pct(tpl / tc * 100, 1)}</span>)` : ''}</span></div>
    <div><b class="${H.tone(tday)}">${rs(tday)}</b><span>on the last day (${H.pct(tday / (tv - tday) * 100, 2)})</span></div>
    <div><b>${rows.length}</b><span>stocks · portfolio P/E ${H.num(portPE(rows), 1)}</span></div></div>
  ${table}
  ${missing.length ? `<p class="sub">Not on our NSE list any more (kept in your portfolio, not counted): ${missing.map(H.esc).join(', ')}</p>` : ''}
  ${addForm}
  <section class="card"><h2>What stands out</h2><ul class="dc-facts">${facts.map((f) => `<li>${f}</li>`).join('')}</ul></section>
  <div class="grid2"><section class="card"><h2>Sector mix</h2>${bars(sec)}</section><section class="card"><h2>Size mix</h2>${bars(mix((r) => sizeOf(r.s)))}<p class="sub">By market cap rank among all NSE companies on the last close.</p></section></div>
  <section class="card flush"><div class="card-head pad"><h2>Each holding, the facts</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Stock</th><th class="r">1Y</th><th class="r">From 52W high</th><th class="r">RS</th><th class="r">P/E</th><th class="r">Promoters</th><th>MF buying</th><th>Next results</th><th>Well-known holders</th><th>Notes</th></tr></thead><tbody>
    ${rows.map((r) => { const d = r.d, f = fund[r.s] || {}, m = mf.stocks?.[r.s]; const nr = nextRes[r.s]; return `<tr><td>${sym(r.s)}<span class="sub">${H.esc(info[r.s]?.sec || '')}</span></td>
      <td class="r ${H.tone((d.r || [])[5])}">${H.pct((d.r || [])[5], 1)}</td><td class="r">${H.pct(d.hi, 1)}</td><td class="r">${H.num(d.rs)}</td><td class="r">${H.num(d.pe, 1)}</td>
      <td class="r">${f.pr == null ? '-' : `${H.num(f.pr, 1)}%`}${f.prc ? ` <small class="${H.tone(f.prc)}">${f.prc > 0 ? '+' : ''}${H.num(f.prc, 2)}</small>` : ''}</td>
      <td>${m ? `${m.mb} of ${(mf.months || []).length} months` : '-'}</td><td>${nr ? H.fShort(nr.date) + (nr.status === 'confirmed' ? '' : ' (est.)') : '-'}</td>
      <td class="sub-ish">${(owners[r.s] || []).map(H.esc).join('; ') || '-'}</td><td>${flags[r.s] ? [...flags[r.s]].map((t) => H.chip(t, 'bad')).join(' ') : ''}${gdSet.has(r.s) ? H.chip('management guidance', 'info') : ''}</td></tr>`; }).join('')}
  </tbody></table></div></section>
  <p class="toolbar"><button class="btn sm ghost" data-act="dcCall" data-fn="pfClear">Remove every holding</button></p>
  <p class="sub legend">Profit and loss here is at the last close, before brokerage and tax, and does not include dividends. Facts about what you hold, not advice on what to buy, sell or keep.</p>`;
}
