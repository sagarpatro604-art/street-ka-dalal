// Prop. Research: in-house studies built from official NSE / NSDL data.
// Each report reads its numbers from a data file that SectorScope refreshes every evening,
// so the text below never carries a stale figure. Research only: no buy or sell calls (SEBI).
import * as CH from './charts.js';

export const REPORTS = [
  {
    id: 'participation',
    title: 'Do retail investors run away at the bottom?',
    sub: 'Twenty years of NSE and NSDL data on who trades, who sells and who buys when the market falls, with a gauge of where we stand today.',
    tag: 'Market participation',
    published: '2026-10-05',
    file: 'participation',
  },
];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mLabel = (ym) => { if (!ym) return '—'; const [y, m] = String(ym).split('-').map(Number); return `${MON[m - 1]} ${y}`; };
const ZONE_COL = { Fearful: '#b4442f', Cautious: '#c27c3a', Neutral: '#9a8f72', Confident: '#2f6b4f', Crowded: '#1f4d3a' };

export function researchList(h) {
  const { esc, pageHead, fDate } = h;
  return `${pageHead('Prop. Research', 'In-house studies')}
  <p class="lede rs-lede">Questions about the Indian market, answered with official exchange data and tested the honest way: nothing uses information from the future, and every result shows how many times it actually happened.</p>
  <section class="rs-list">${REPORTS.map((r) => `<a class="card rs-card" href="#/research/${r.id}">
    <span class="chip type">${esc(r.tag)}</span>
    <h2>${esc(r.title)}</h2>
    <p>${esc(r.sub)}</p>
    <span class="sub">Published ${fDate(r.published)} · live figures updated every evening</span>
  </a>`).join('')}</section>
  ${disclaimer()}`;
}

function disclaimer() {
  return `<p class="rs-disc">This is research on public market data, for education. It is not investment advice and not a recommendation to buy or sell anything. Past patterns can fail to repeat. Street ka Dalal is not a SEBI-registered adviser.</p>`;
}

// semicircle gauge 0-100 with the five zones
function gaugeSVG(v, zone) {
  const W = 260, H = 150, cx = 130, cy = 132, R = 108, r = 74;
  const ang = (x) => Math.PI * (1 - x / 100);
  const pt = (x, rad) => [cx + rad * Math.cos(ang(x)), cy - rad * Math.sin(ang(x))];
  const arc = (a, b, col) => {
    const [x1, y1] = pt(a, R), [x2, y2] = pt(b, R), [x3, y3] = pt(b, r), [x4, y4] = pt(a, r);
    return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)} L${x3.toFixed(1)},${y3.toFixed(1)} A${r},${r} 0 0 0 ${x4.toFixed(1)},${y4.toFixed(1)} Z" fill="${col}" opacity="0.9"/>`;
  };
  const bands = [[0, 20, 'Fearful'], [20, 40, 'Cautious'], [40, 60, 'Neutral'], [60, 80, 'Confident'], [80, 100, 'Crowded']];
  const val = v == null ? 50 : Math.max(0, Math.min(100, v));
  const [nx, ny] = pt(val, R - 6);
  return `<svg class="rs-gauge" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gauge ${v ?? '—'} of 100, ${zone || ''}">
    ${bands.map(([a, b, n]) => arc(a + 0.6, b - 0.6, ZONE_COL[n])).join('')}
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#1d2a23" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="#1d2a23"/>
    <text x="14" y="146" class="rs-g-l">0 fearful</text><text x="246" y="146" text-anchor="end" class="rs-g-l">crowded 100</text>
  </svg>`;
}

const chanceWord = (p, n) => {
  if (p == null) return '—';
  const few = n != null && n < 5 ? ' · too few cases' : '';
  if (p < 0.05) return `Unlikely to be chance${few}`;
  if (p < 0.15) return `Maybe real${few}`;
  return `Could easily be chance${few}`;
};

export async function researchParticipation(h) {
  const { data, after, esc, pct, num, pageHead, table, fDate } = h;
  const d = await data('participation');
  const n = d.now || {};
  const P = (x, dd = 0) => (x == null ? '—' : pct(x * 100, dd));
  const L = (x) => { if (x == null) return '—'; const a = Math.abs(x); return `₹${num(a >= 100000 ? a / 100000 : a, a >= 100000 ? 2 : 0)}${a >= 100000 ? ' lakh' : ''} cr`; };
  const Q = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);   // a share or a hit rate: no sign
  const sign = (x) => (x == null ? '' : x >= 0 ? 'bought' : 'sold');
  const hist = Object.fromEntries((d.history || []).map((x) => [x.label, x]));
  const fpiSell = hist['FPI heavy selling (3-month flow in its lowest 15%)']?.h || {};
  const rtl = hist['Retail trading 40%+ below its 12-month high']?.h || {};
  const falls = (d.falls || []).filter((f, i, a) => a.findIndex((g) => g.peak === f.peak) === i);   // one row per fall
  const drops = falls.filter((f) => f.retail_low_vs_before != null && f.retail_low_vs_before <= -0.15);
  const dropRange = drops.length ? `${Math.round(-Math.max(...drops.map((f) => f.retail_low_vs_before)) * 100)}% to ${Math.round(-Math.min(...drops.map((f) => f.retail_low_vs_before)) * 100)}%` : '—';
  const covid = falls.find((f) => f.bottom === '2020-03');
  const past = (d.phases || []).filter((p) => !p.ongoing);
  const zc = ZONE_COL[n.zone] || '#6c786f';

  after.push(() => drawCharts(d));

  const fallCols = [
    { k: 'peak', label: 'Market fall', fmt: (r) => `${mLabel(r.peak)} → ${mLabel(r.bottom)}` },
    { k: 'fall', label: 'Nifty 500', cls: 'r', fmt: (r) => `<b class="down">${P(r.fall)}</b>` },
    { k: 'retail_low_vs_before', label: 'Retail trading at its lowest', cls: 'r', fmt: (r) => `<span class="${r.retail_low_vs_before < 0 ? 'down' : 'up'}">${P(r.retail_low_vs_before)}</span> <span class="sub inline">${mLabel(r.retail_low_month)}</span>` },
    { k: 'retail_6m_after_vs_before', label: '6 months after the bottom', cls: 'r', fmt: (r) => `<span class="${r.retail_6m_after_vs_before < 0 ? 'down' : 'up'}">${P(r.retail_6m_after_vs_before)}</span>` },
    { k: 'fpi_during', label: 'Foreign funds during the fall', cls: 'r', fmt: (r) => `<span class="${r.fpi_during < 0 ? 'down' : 'up'}">${L(r.fpi_during)} ${sign(r.fpi_during)}</span>` },
    { k: 'fpi_6m_after', label: 'Foreign funds, next 6 months', cls: 'r', fmt: (r) => `<span class="${r.fpi_6m_after < 0 ? 'down' : 'up'}">${L(r.fpi_6m_after)} ${sign(r.fpi_6m_after)}</span>` },
    { k: 'nifty_12m_after', label: 'Nifty 500, 12 months after the bottom', cls: 'r', fmt: (r) => `<b class="${r.nifty_12m_after < 0 ? 'down' : 'up'}">${P(r.nifty_12m_after)}</b>` },
  ];
  const phCols = [
    { k: 'start', label: 'Fearful phase', fmt: (r) => `${mLabel(r.start)}${r.end !== r.start ? ' → ' + mLabel(r.end) : ''}${r.ongoing ? ' <span class="chip warn">now</span>' : ''}` },
    { k: 'months', label: 'Months', cls: 'r', fmt: (r) => `<b>${r.months}</b>` },
    { k: 'lowest', label: 'Lowest reading', cls: 'r', fmt: (r) => num(r.lowest, 0) },
    { k: 'nifty_during', label: 'Nifty 500 during', cls: 'r', fmt: (r) => `<span class="${r.nifty_during < 0 ? 'down' : 'up'}">${P(r.nifty_during)}</span>` },
    { k: 'after_12m', label: 'Nifty 500, 12 months after it ended', cls: 'r', fmt: (r) => (r.after_12m == null ? '<span class="sub inline">not yet</span>' : `<span class="${r.after_12m < 0 ? 'down' : 'up'}">${P(r.after_12m)}</span>`) },
  ];
  const H12 = (x) => x.h?.['12M'] || {};
  const H24 = (x) => x.h?.['24M'] || {};
  const histRows = (d.history || []).map((x) => ({ ...x, m12: H12(x), m24: H24(x) }));
  const hCols = [
    { k: 'label', label: 'What we saw', fmt: (r) => esc(r.label) },
    { k: 'ep', label: 'Times', cls: 'r', v: (r) => r.m12.episodes, fmt: (r) => `${r.m12.episodes ?? '—'} <span class="sub inline">(${r.m12.months ?? '—'} months)</span>` },
    { k: 'a12', label: 'Next 12 months, all such months', cls: 'r', v: (r) => r.m12.avg, fmt: (r) => `<b class="${(r.m12.avg ?? 0) < 0 ? 'down' : 'up'}">${P(r.m12.avg, 1)}</b> <span class="sub inline">vs ${P(r.m12.all_avg, 1)} normal</span>` },
    { k: 'e12', label: 'Next 12 months, from the first month', cls: 'r', v: (r) => r.m12.ep_avg, fmt: (r) => `${P(r.m12.ep_avg, 1)} <span class="sub inline">up ${Q(r.m12.ep_up_rate)} of times</span>` },
    { k: 'a24', label: 'Next 24 months: all · first', cls: 'r', v: (r) => r.m24.avg, fmt: (r) => `${P(r.m24.avg, 0)} · ${P(r.m24.ep_avg, 0)} <span class="sub inline">vs ${P(r.m24.all_avg, 0)}</span>` },
    { k: 'p', label: 'Could it be luck?', v: (r) => r.m12.p, fmt: (r) => `<span class="sub inline">12M: ${chanceWord(r.m12.p, r.m12.episodes)}<br>24M: ${chanceWord(r.m24.p, r.m24.episodes)}</span>` },
  ];


  return `<p class="crumb"><a href="#/research">← All research</a></p>
  ${pageHead('Prop. Research · Market participation', 'Do retail investors run away at the bottom?')}
  <p class="asof">Published ${fDate('2026-10-05')} · live figures as of <b>${mLabel(d.as_of)}</b>, refreshed every evening</p>

  <section class="card rs-min">
    <h2>In one minute</h2>
    <ul>
      <li><b>Yes, retail trading usually dries up when the market falls.</b> In ${drops.length} of the ${falls.length} big falls since 2006, individuals' daily trading dropped ${dropRange} from where it was before the fall. ${covid ? `Covid (2020) was the exception: in the six months after the crash, retail trading ran ${Q(covid.retail_6m_after_vs_before)} <i>above</i> its pre-crash level, as a wave of new investors came in.` : ''}</li>
      <li><b>But retail going quiet does not tell you the fall is over.</b> Its lowest month usually came in the same month as the market's bottom, so you only know afterwards. The first time retail trading fell 40% below its 12-month high, the next 12 months were about normal: ${P(rtl['12M']?.ep_avg, 0)} vs ${P(rtl['12M']?.all_avg, 0)} (${rtl['12M']?.episodes ?? '—'} times).</li>
      <li><b>Foreign funds (FPIs) usually sell heavily into the bottom, then come back.</b> Months of very heavy FPI selling were followed by better two-year returns on average (${P(fpiSell['24M']?.avg, 0)} vs ${P(fpiSell['24M']?.all_avg, 0)} normally), but mostly in the later months of a long selling spell. Acting at the <i>first</i> month of heavy selling did no better than usual (${P(fpiSell['24M']?.ep_avg, 0)} over two years, ${P(fpiSell['12M']?.ep_avg, 0)} over one): the selling usually starts well before the bottom.</li>
      <li><b>Domestic funds have been the steady buyers.</b> Mutual funds, insurers and other Indian institutions ${n.dii_net_3m >= 0 ? 'bought' : 'sold'} a net ${L(n.dii_net_3m)} in the last three months, while foreign funds were net sellers in ${n.fpi_sell_months_last12} of the last 12 months.</li>
      <li><b>Today the gauge reads ${num(n.gauge, 0)} out of 100: <span style="color:${zc}">${esc(n.zone || '—')}</span>.</b> In the last 24 months it spent ${n.fear_months_last24} months on the fearful side.</li>
    </ul>
  </section>

  <section class="card rs-now">
    <div class="card-head"><h2>Where we stand today</h2><span class="sub">${mLabel(n.month)} · complete months only</span></div>
    <div class="rs-now-grid">
      <div class="rs-gauge-box">${gaugeSVG(n.gauge, n.zone)}
        <p class="rs-g-v"><b>${num(n.gauge, 0)}</b><span style="color:${zc}">${esc(n.zone || '—')}</span></p>
        <p class="sub">${n.run_months} month${n.run_months === 1 ? '' : 's'} in a row on the ${esc(n.run_side || '')} · a typical past fearful phase lasted ${n.past_fear_phase_median_months ?? '—'} months, the longest ${n.past_fear_phase_longest ?? '—'}</p>
      </div>
      <div class="kpis rs-kpis">
        <div><span>Retail trading per day</span><b>${L(n.retail_cr_day)}</b><small>${P(n.retail_vs_peak)} vs its ${mLabel(n.retail_peak_month)} peak (${n.months_since_retail_peak} months ago)</small></div>
        <div><span>Retail share of trading</span><b>${n.retail_share_nse == null ? '—' : (n.retail_share_nse * 100).toFixed(1) + '%'}</b><small>of all cash-market buying and selling (NSE's Retail line)</small></div>
        <div><span>Retail, last 3 months</span><b class="${n.retail_net_3m < 0 ? 'down' : 'up'}">${L(n.retail_net_3m)} ${sign(n.retail_net_3m)}</b><small>buying minus selling</small></div>
        <div><span>Foreign funds, last 3 months</span><b class="${n.fpi_3m < 0 ? 'down' : 'up'}">${L(n.fpi_3m)} ${sign(n.fpi_3m)}</b><small>net sellers in ${n.fpi_sell_months_last12} of the last 12 months</small></div>
        <div><span>Domestic funds, last 3 months</span><b class="${n.dii_net_3m < 0 ? 'down' : 'up'}">${L(n.dii_net_3m)} ${sign(n.dii_net_3m)}</b><small>MFs, insurers, banks, AIFs, PMS</small></div>
        <div><span>Retail F&amp;O activity</span><b>${P(n.fo_vs_12m_high)}</b><small>vs its 12-month high (SEBI's 2024 F&amp;O rules cut it sharply)</small></div>
        <div><span>Nifty 500</span><b>${num(n.nifty500, 0)}</b><small>${P(n.nifty_vs_high)} from its ${mLabel(n.nifty_high_month)} high</small></div>
      </div>
    </div>
    <p class="rs-note">How the gauge works: three readings, each ranked only against the months before it: retail trading against its own 12-month high, foreign-fund flows over three months as a share of market size, and the Nifty 500 against its 12-month high. The average of the three ranks gives 0 (as fearful as it has ever been) to 100 (as crowded as it has ever been). It describes the market. It is not a signal to act on.</p>
  </section>

  <section class="card">
    <div class="card-head"><h2>The gauge since ${mLabel(d.method?.gauge_from)}</h2><span class="sub">0-20 fearful · 20-40 cautious · 40-60 neutral · 60-80 confident · 80-100 crowded</span></div>
    <div class="chart-legend" id="rsGaugeLeg"></div>
    <div class="chart-box" id="rsGauge"><div class="loading"><span class="dots"><i></i><i></i><i></i></span></div></div>
  </section>

  <h2 class="rs-h">1. Do retail investors stop trading when the market falls?</h2>
  <section class="card">
    <p class="rs-p">Mostly yes. Each row is a fall of 15% or more in the Nifty 500 (month-end closes). "Retail trading" is the rupee value individuals bought and sold on NSE's cash market each day, compared with the three months before the fall began.</p>
    ${table('rsFalls', falls, fallCols)}
    <p class="rs-note">Rupee trading falls partly because prices are lower. Even so, in 2011 and 2025 individuals' <i>share</i> of all trading fell too, so they really did step back. The bottom dates use hindsight; nobody knew them at the time.</p>
  </section>
  <section class="card">
    <div class="card-head"><h2>Retail trading per day and the Nifty 500</h2><span class="sub">₹ crore bought + sold by individuals per session, monthly average</span></div>
    <div class="chart-legend" id="rsRetailLeg"></div>
    <div class="chart-box" id="rsRetail"><div class="loading"><span class="dots"><i></i><i></i><i></i></span></div></div>
  </section>

  <h2 class="rs-h">2. Who sells at the bottom, and who comes back first?</h2>
  <section class="card">
    <p class="rs-p">Going into the lows of Nov 2008, Feb 2016, Mar 2020, Jun 2022 and Feb 2025, foreign funds sold heavily, and each time they had at least one month of net buying within three months after the low. Going into the Dec 2011 low their selling was small. Green bars are months they bought, red bars months they sold (NSDL, ₹ crore).</p>
    <div class="chart-legend" id="rsFpiLeg"></div>
    <div class="chart-box" id="rsFpi"><div class="loading"><span class="dots"><i></i><i></i><i></i></span></div></div>
  </section>
  <section class="card">
    <div class="card-head"><h2>Retail, domestic funds and foreign funds since 2023</h2><span class="sub">net buying per month, ₹ crore</span></div>
    <div id="rsSplit"></div>
    <p class="rs-note">NSE began reporting a separate retail line and a full investor split in February 2023, so this comparison starts there. Foreign-fund figures here are NSDL's monthly totals; retail and domestic funds come from NSE's daily category file.</p>
  </section>

  <h2 class="rs-h">3. How long do fearful phases last?</h2>
  <section class="card">
    <p class="rs-p">A fearful phase is a run of months with the gauge under 40. ${past.length} have ended since ${mLabel(d.method?.gauge_from)}. The typical one (the middle of the list) lasted ${n.past_fear_phase_median_months ?? '—'} months; the longest lasted ${n.past_fear_phase_longest ?? '—'}.</p>
    ${table('rsPhases', (d.phases || []).slice().reverse(), phCols)}
  </section>

  <h2 class="rs-h">4. What usually happened next?</h2>
  <section class="card">
    <p class="rs-p">Each row asks: after the months when this was true, what did the Nifty 500 do over the next 12 and 24 months, compared with any month in the same years ("normal")? "Times" counts separate episodes, because twenty fearful months in a row are one event, not twenty. "Could it be luck?" comes from moving each pattern to random dates and seeing how often chance does as well.</p>
    ${table('rsHist', histRows, hCols)}
    <p class="rs-note">Read with care. "All such months" counts every month the condition held, so a long fearful spell counts many times, including its late months when the bottom was already in. "From the first month" is what acting the first time you saw it would have given, and for most rows it is no better than normal. Most rows rest on a handful of episodes. The combined gauge barely changes the odds, which is why it is shown as a description of the market, not a timing tool.</p>
  </section>

  <section class="card prose rs-prose">
    <h2>What this does not tell you</h2>
    <ul>
      <li>It does not say the market has bottomed. Retail trading and the gauge usually turn at or after the bottom, not before it.</li>
      <li>It does not say when to buy or sell. A fearful reading has been followed by both strong and weak years.</li>
      <li>Retail investors in India often buy when prices fall. In 2020 they bought the crash, while foreign funds sold it.</li>
      <li>Much of the drop in retail F&amp;O trading since late 2024 comes from SEBI's new F&amp;O rules, not only from mood.</li>
    </ul>
    <h2>How we measured it</h2>
    <ul>
      <li><b>Retail trading:</b> NSE's daily client-category turnover, 2006 to today. Before Feb-2023 NSE grouped individuals with companies and trusts; in the months both versions were printed, that older group was 3.35% bigger than individuals alone, so the two are joined on that ratio. Shares are taken over NSE's official turnover, because from 25 Oct 2024 NSE's file counts foreign-fund trades twice (once as FPI and again inside "Others"). Retail <i>net</i> buying is shown only from Feb-2023, because the older table does not add up to zero.</li>
      <li><b>Retail F&amp;O:</b> NSE's participant-wise F&amp;O volumes, 2012 to today ("Client" contracts).</li>
      <li><b>Foreign funds:</b> NSDL's FPI monitor, monthly net equity investment, 2002 to today, scaled by NSE's market capitalisation.</li>
      <li><b>Domestic funds:</b> mutual funds, insurers, banks, AIFs and PMS from NSE's category file, Feb-2023 to today.</li>
      <li><b>Market:</b> Nifty 500 official closes. Returns exclude dividends (about 1.2-1.5% a year).</li>
      <li><b>No hindsight in the gauge:</b> each month is ranked only against earlier months, and returns are counted from the first trading day of the next month.</li>
    </ul>
  </section>
  ${disclaimer()}`;
}

async function drawCharts(d) {
  const s = d.series || [];
  const t = (m) => `${m}-01`;
  const gs = s.filter((x) => x.gauge != null);
  const g0 = gs.length ? gs[0].m : null;
  const n500 = s.filter((x) => x.nifty500 != null && (!g0 || x.m >= g0)).map((x) => ({ time: t(x.m), value: x.nifty500 }));
  await CH.timeChart(document.getElementById('rsGauge'), [
    { name: 'Gauge (0 fearful, 100 crowded)', type: 'area', color: CH.C.green2, data: gs.map((x) => ({ time: t(x.m), value: x.gauge })), axis: (v) => v.toFixed(0) },
    { name: 'Nifty 500', type: 'line', color: CH.C.gold, scale: 'left', data: n500, width: 1.6 },
  ], { legend: document.getElementById('rsGaugeLeg') });

  const rt = s.filter((x) => x.retail_cr_day != null);
  const r0 = rt.length ? rt[0].m : null;
  await CH.timeChart(document.getElementById('rsRetail'), [
    { name: 'Retail trading per day (₹ cr)', type: 'area', color: CH.C.blue, data: rt.map((x) => ({ time: t(x.m), value: x.retail_cr_day })), axis: (v) => CH.crShort(v) },
    { name: 'Nifty 500', type: 'line', color: CH.C.gold, scale: 'left', width: 1.6, data: s.filter((x) => x.nifty500 != null && x.m >= r0).map((x) => ({ time: t(x.m), value: x.nifty500 })) },
  ], { legend: document.getElementById('rsRetailLeg') });

  const fp = s.filter((x) => x.fpi_cr != null && x.m >= '2006-01');
  await CH.timeChart(document.getElementById('rsFpi'), [
    { name: 'Foreign funds, net (₹ cr)', type: 'hist', data: fp.map((x) => ({ time: t(x.m), value: x.fpi_cr, color: x.fpi_cr >= 0 ? CH.C.up : CH.C.down })), axis: (v) => CH.crShort(v) },
    { name: 'Nifty 500', type: 'line', color: CH.C.gold, scale: 'left', width: 1.6, data: s.filter((x) => x.nifty500 != null && x.m >= '2006-01').map((x) => ({ time: t(x.m), value: x.nifty500 })) },
  ], { legend: document.getElementById('rsFpiLeg') });

  const sp = s.filter((x) => x.m >= '2023-02' && x.retail_net != null);
  const el = document.getElementById('rsSplit');
  if (el) el.innerHTML = CH.divBars({
    labels: sp.map((x) => t(x.m)),
    series: [
      { name: 'Retail', values: sp.map((x) => x.retail_net), color: CH.C.blue },
      { name: 'Domestic funds', values: sp.map((x) => x.dii_net), color: CH.C.green2 },
      { name: 'Foreign funds', values: sp.map((x) => x.fpi_cr), color: CH.C.gold },
    ],
    height: 240, fmt: (v) => `${CH.crShort(v)}`,
  });
}

// Compact Participation Gauge for the Market page. Same data file as the report, refreshed every
// evening by SectorScope; the latest-session flows change daily, the gauge itself monthly.
export function gaugeCard(d, h) {
  const { esc, num, fDate } = h;
  const n = d.now || {};
  const zc = ZONE_COL[n.zone] || '#6c786f';
  const daily = d.daily || [];
  const last = daily[daily.length - 1] || {};
  const last5 = daily.slice(-5);
  const sum = (k) => (last5.length ? last5.reduce((a, x) => a + (x[k] || 0), 0) : null);
  const crs = (x) => { if (x == null) return '—'; const a = Math.abs(x); return `₹${num(a >= 100000 ? a / 100000 : a, a >= 100000 ? 2 : 0)}${a >= 100000 ? ' L' : ''} cr`; };
  const flow = (x) => (x == null ? '—' : `<b class="${x < 0 ? 'down' : 'up'}">${crs(x)}</b> <span class="sub inline">${x < 0 ? 'sold' : 'bought'}</span>`);
  const pc = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`);
  const g = (d.series || []).filter((x) => x.gauge != null).slice(-24);
  const W = 220, H = 46, lo = 0, hi = 100;
  const pts = g.map((x, i) => `${((i * W) / Math.max(1, g.length - 1)).toFixed(1)},${(H - 3 - ((x.gauge - lo) * (H - 6)) / (hi - lo)).toFixed(1)}`).join(' ');
  const y40 = (H - 3 - (40 * (H - 6)) / 100).toFixed(1);
  const spark = g.length > 1 ? `<svg class="pgc-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="${W}" y1="${y40}" y2="${y40}" stroke="#c27c3a" stroke-dasharray="3 3" stroke-width="1"/><polyline points="${pts}" fill="none" stroke="#2f6b4f" stroke-width="2" stroke-linejoin="round"/></svg>` : '';
  return `<section class="card pgc">
    <div class="card-head"><h2>Participation Gauge</h2><a href="#/research/participation">The research behind it →</a></div>
    <div class="pgc-grid">
      <div class="pgc-g">${gaugeSVG(n.gauge, n.zone)}<p class="rs-g-v"><b>${num(n.gauge, 0)}</b><span style="color:${zc}">${esc(n.zone || '—')}</span></p>
        <p class="sub">How fearful (0) or crowded (100) the market is against its own past · ${mLabel(n.month)}</p></div>
      <div class="pgc-run">
        <p><b>${n.run_months}</b> month${n.run_months === 1 ? '' : 's'} in a row on the ${esc(n.run_side || '')}</p>
        <p><b>${n.fear_months_last24}</b> of the last 24 months were on the fearful side</p>
        <p>Retail trading <b>${pc(n.retail_vs_peak)}</b> from its ${mLabel(n.retail_peak_month)} peak</p>
        <p>Foreign funds net sellers in <b>${n.fpi_sell_months_last12}</b> of the last 12 months</p>
        <div class="pgc-trend"><span class="sub">Last 24 months (dashed line = 40)</span>${spark}</div>
      </div>
      <div class="pgc-flows">
        <p class="sub">Who bought on ${fDate(last.d)}</p>
        <dl class="kv"><dt>Retail</dt><dd>${flow(last.retail)}</dd><dt>Domestic funds</dt><dd>${flow(last.dii)}</dd><dt>Foreign funds</dt><dd>${flow(last.fpi)}</dd></dl>
        <p class="sub" style="margin-top:8px">Last 5 sessions</p>
        <dl class="kv"><dt>Retail</dt><dd>${flow(sum('retail'))}</dd><dt>Domestic funds</dt><dd>${flow(sum('dii'))}</dd><dt>Foreign funds</dt><dd>${flow(sum('fpi'))}</dd></dl>
      </div>
    </div>
    <p class="rs-note">A description of the market, not a signal to buy or sell. Flows here are NSE's final category file (domestic funds = MFs, insurers, banks, AIFs, PMS), so they can differ from the provisional FII / DII card above. Updated every evening.</p>
  </section>`;
}
