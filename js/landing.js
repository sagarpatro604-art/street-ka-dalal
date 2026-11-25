// Landing page. Since 2026-11-26 (Sagar: "grow one feel better") a calm Groww-style page in the site light / dark
// look: plain headline, today real Nifty card from data/market.json, the tools, both founders side by side (EQUAL:
// same card, same size), why us, the community. Shown to signed-out visitors, and to members on every new visit and at #/about.
// No emoji, no em dash, no tilde. Facts only, no buy / sell words (SEBI).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LINKS = {
  wa: 'https://chat.whatsapp.com/DUdUxpofHqE9auMNtDyZYr', tg: 'https://t.me/sagar00024',
  sagarIg: 'https://www.instagram.com/sagarpatro604/', sagarLi: 'https://www.linkedin.com/in/sagarpps',
  bhuvanIg: 'https://www.instagram.com/bhuvan_psri/', bhuvanLi: 'https://www.linkedin.com/in/bhuvan-pasari-8944b5250',
};
const FOUNDERS = [
  // Sagar 2026-11-21: the company name is not decided, so no "co-founder of Street ka Dalal" anywhere on this page
  { name: 'K. Sagar Patro', role: 'Research and trading', img: 'icons/founder-sagar.webp', ig: LINKS.sagarIg, igH: '@sagarpatro604', li: LINKS.sagarLi,
    bio: '<b>Three years in the Indian markets</b>, trading and investing his own <b>₹50 lakh portfolio</b>. Earlier at <b>Digit Insurance</b> and <b>Vayu Capital</b>, working on financial modelling and equity research. Studied Capital Markets and Trading (CMT) at <b>Masters\' Union</b>, after a BBA in Finance from <b>Jain University</b>.',
    tags: ['Ex Digit Insurance', 'Ex Vayu Capital', 'Financial modelling', 'Equity research', 'CMT, Masters\' Union', 'BBA Finance, Jain University'] },
  { name: 'Bhuvan Pasari', role: 'Markets and growth', img: 'icons/founder-bhuvan.webp', ig: LINKS.bhuvanIg, igH: '@bhuvan_psri', li: LINKS.bhuvanLi,
    bio: '<b>Five years in the stock market</b>, investing his own <b>₹20 lakh portfolio</b>, with a year of building as an <b>entrepreneur</b>. Studies finance and marketing, and holds a BBA from <b>Jain University</b>.',
    tags: ['5 years in markets', 'Entrepreneur', 'Finance and marketing', 'BBA, Jain University'] },
];
// [route, title, one line, icon name, green?]
const CARDS = [
  ['', 'Stock watch', 'Your lists on one screen with our own chart and results markers.', 'watch'],
  ['screeners', 'Screeners', '27 end-of-day scans on every NSE stock, with a grid of charts.', 'screen', 1],
  ['sectors', 'Groups and rotation', 'Sectors, industries and themes with trend labels and the RRG.', 'sector'],
  ['resplus', 'Results Plus', 'What the price did after results: gaps, sectors, profit pool, guidance.', 'file'],
  ['premarket', 'Pre-market', 'GIFT Nifty, global cues, flows and the night\'s filings before 9:15.', 'sun'],
  ['funds', 'Mutual funds', 'Where funds are buying and selling, stock by stock and sector by sector.', 'funds'],
  ['discover', 'Discover', 'Big investors, market valuation, what management said. Premium.', 'compass'],
  ['portfolio', 'Portfolio X-ray', 'Paste your holdings: sectors, overlap and risks, in your browser only.', 'brief'],
];
const VALUES = [
  ['Facts, not tips', 'Every number comes from NSE filings, NSE prices and public data. No buy or sell calls, no targets.', 'file'],
  ['Plain words', 'Built so a first-time investor can read it and a full-time trader can use it.', 'pen'],
  ['Checked before shown', 'Numbers are checked against NSE\'s own records; when something cannot be checked, the page says so.', 'search'],
];

export function landingHtml({ member = false, inApp = false, error = '', logo = '', ic = () => '', google = '' } = {}) {
  const go = member ? 'enterTerminal' : 'signIn';
  const top = member
    ? '<button class="lx-btn" data-act="enterTerminal" type="button">Open terminal</button>'
    : '<button class="lx-btn" data-act="signIn" type="button">Sign in</button>';
  const main = member
    ? '<button class="lx-cta" data-act="enterTerminal" type="button">Open the terminal</button>'
    : `<button class="lx-cta lx-google" data-act="signIn" type="button">${google}<span>Continue with Google</span></button>`;
  const card = ([r, t, d, i]) => `<button class="lx-card" type="button" data-act="${go}" data-v="${r}">
      <span class="lx-ico">${ic(i, 20)}</span><b>${t}</b><span class="lx-d">${d}</span><i>${member ? 'Open' : 'Sign in to open'}</i></button>`;
  const light = document.documentElement.dataset.theme === 'light';
  return `<div class="lx" id="lx">
  <header class="lx-nav"><div class="lx-in">
    <a class="lx-brand" href="#/" data-go="top">${logo}<span>Street <em>ka</em> Dalal</span></a>
    <nav class="lx-menu"><a data-go="lxTerminal">Tools</a><a data-go="lxFounders">Founders</a><a data-go="lxMission">Why us</a><a data-go="lxCommunity">Community</a></nav>
    <button class="k-theme lx-theme" data-act="theme" type="button" title="${light ? 'Dark look' : 'Light look'}" aria-label="Switch light or dark look">${ic(light ? 'moon' : 'sun', 18)}</button>
    ${top}
  </div></header>

  <section class="lx-hero" id="lxHero"><div class="lx-in lx-hgrid">
    <div class="lx-copy">
      <p class="lx-kick">Free for our 500+ member community</p>
      <h1>Stock market research for Indian investors, free and in plain words</h1>
      <p class="lx-sub">Screeners, quarterly results and what the price did after them, sector strength, mutual fund flows and pre-market, all built on NSE's own data.</p>
      ${inApp && !member ? '<p class="lx-warn">Open this page in Chrome or Safari to sign in: Google does not allow it inside Instagram or Facebook. <button class="lx-copy-btn" data-act="copyLink" type="button">Copy link</button></p>' : ''}
      <div class="lx-actions">${main}${error ? `<p class="lx-err">${esc(error)}</p>` : ''}</div>
      <p class="lx-note">No buy or sell calls. No paid tips. Just the data and how to read it.</p>
    </div>
    <div class="lx-show" id="lxShow" aria-label="Today's market from our data">
      <div class="lx-sc"><div class="lx-sc-h"><span>Nifty 50</span><span id="lxAsof"></span></div>
        <div class="lx-sc-v" id="lxN50">&nbsp;</div><div class="lx-sc-c" id="lxN50c">&nbsp;</div>
        <div class="lx-sc-ch" id="lxChart"></div>
        <div class="lx-sc-row" id="lxIdx"></div></div>
      <div class="lx-sc lx-sc2"><div class="lx-sc-h"><span>Market breadth</span><span>all NSE stocks</span></div>
        <div class="lx-bar"><i id="lxAdv"></i></div><div class="lx-bl2" id="lxBreadth">&nbsp;</div></div>
    </div>
  </div></section>

  <section class="lx-sec" id="lxTerminal"><div class="lx-in">
    <h2>What you get inside</h2><p class="lx-lead">Everything on one site, updated after every NSE close.</p>
    <div class="lx-cards">${CARDS.map(card).join('')}</div>
    <p class="lx-more">Also inside: Market, Results, News and filings, Prop. Research, the Library and Insights.</p>
  </div></section>

  <section class="lx-sec lx-alt" id="lxFounders"><div class="lx-in">
    <h2>The people behind it</h2><p class="lx-lead">Two investors who built the tools they wanted for themselves.</p>
    <div class="lx-founders">${FOUNDERS.map((f) => `<article class="lx-founder">
      <div class="lx-photo"><img src="${f.img}" alt="${esc(f.name)}" loading="lazy" width="600" height="800"></div>
      <div class="lx-ftext"><h3>${esc(f.name)}</h3><p class="lx-role">${esc(f.role)}</p>
        <p>${f.bio}</p>
        <div class="lx-tags">${f.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        <div class="lx-links"><a href="${f.ig}" target="_blank" rel="noopener">Instagram ${esc(f.igH)}</a><a href="${f.li}" target="_blank" rel="noopener">LinkedIn</a></div>
      </div></article>`).join('')}</div>
  </div></section>

  <section class="lx-sec" id="lxMission"><div class="lx-in">
    <h2>Why Street ka Dalal</h2><p class="lx-lead">The research a fund desk uses, free for every learning investor, with the source of every number on the page.</p>
    <div class="lx-values">${VALUES.map(([t, d, i]) => `<div class="lx-v"><span class="lx-ico">${ic(i, 20)}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
  </div></section>

  <section class="lx-sec lx-alt" id="lxCommunity"><div class="lx-in">
    <h2>Learn with us</h2><p class="lx-lead">Free sessions, a daily note and people who ask good questions.</p>
    <div class="lx-commgrid">
      <a href="${LINKS.wa}" target="_blank" rel="noopener"><b>WhatsApp community</b><span>500+ members. The morning note, market stories and session invites.</span></a>
      <a href="session"><b>Sunday sessions</b><span>Free and live on Google Meet with Sagar and Bhuvan.</span></a>
      <a href="${LINKS.tg}" target="_blank" rel="noopener"><b>Telegram group</b><span>Quant and factor investing talk.</span></a>
      <a href="quiz"><b>Investor persona test</b><span>What kind of investor are you? About three minutes.</span></a>
    </div>
  </div></section>

  <section class="lx-end"><div class="lx-in"><h2>Start reading the market with us</h2><p>Free with a Google account.</p>
    ${member ? '<button class="lx-cta" data-act="enterTerminal" type="button">Open the terminal</button>' : `<button class="lx-cta lx-google" data-act="signIn" type="button">${google}<span>Continue with Google</span></button>`}</div></section>
  <div class="lx-disc"><div class="lx-in">For learning only. Nothing here is investment advice or a recommendation to buy or sell any security. We are not SEBI-registered advisers. Data is end of day from public NSE sources. Street ka Dalal by K. Sagar Patro and Bhuvan Pasari.</div></div>
</div>`;
}

/* ---------------- the hero card: today's real numbers from data/market.json ---------------- */
const fmt = (v, d = 2) => (v == null ? '-' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (v) => (v == null ? '' : (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%');
function spark(arr) {
  if (!arr || arr.length < 2) return '';
  const w = 520, h = 120, lo = Math.min(...arr), hi = Math.max(...arr), sp = hi - lo || 1;
  const pts = arr.map((v, i) => `${((i * w) / (arr.length - 1)).toFixed(1)},${(h - 4 - ((v - lo) / sp) * (h - 8)).toFixed(1)}`);
  const up = arr[arr.length - 1] >= arr[0];
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" width="100%" height="${h}"><path d="M${pts.join(' L')} L${w},${h} L0,${h} Z" fill="var(${up ? '--accent-soft' : '--coral-soft'})"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(${up ? '--pos' : '--neg'})" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
const idxName = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace('Nifty ', 'Nifty ');

export async function wireLanding() {
  const root = document.getElementById('lx');
  if (!root) return;
  document.body.classList.add('lx-open');
  root.querySelectorAll('[data-go]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = a.dataset.go === 'top' ? null : document.getElementById(a.dataset.go);
      root.scrollTo({ top: t ? t.offsetTop - 70 : 0, behavior: 'smooth' });
    });
  });
  try {
    const m = await fetch('data/market.json', { cache: 'no-cache' }).then((r) => r.json());
    const n = (m.indices || [])[0], b = m.breadth || {};
    const $ = (id) => document.getElementById(id);
    if (n && $('lxN50')) {
      $('lxN50').textContent = fmt(n.last);
      const c = n.returns?.['1D'];
      $('lxN50c').innerHTML = `<span class="${c >= 0 ? 'k-pos' : 'k-neg'}">${pct(c)}</span> today`;
      $('lxChart').innerHTML = spark((n.spark || []).slice(-90));
      $('lxAsof').textContent = 'NSE close, ' + new Date((m.as_of || '') + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      $('lxIdx').innerHTML = (m.indices || []).slice(1, 4).map((i) => `<div><span>${esc(idxName(i.name))}</span><b class="${(i.returns?.['1D'] ?? 0) >= 0 ? 'k-pos' : 'k-neg'}">${pct(i.returns?.['1D'])}</b></div>`).join('');
    }
    if (b.advances != null && $('lxBreadth')) {
      const tot = (b.advances || 0) + (b.declines || 0) || 1;
      $('lxAdv').style.width = ((100 * b.advances) / tot).toFixed(1) + '%';
      $('lxBreadth').innerHTML = `<span class="k-pos">${fmt(b.advances, 0)} rose</span><span class="k-neg">${fmt(b.declines, 0)} fell</span>`;
    }
  } catch { /* the page works without the card */ }
}
export const closeLanding = () => document.body.classList.remove('lx-open');
