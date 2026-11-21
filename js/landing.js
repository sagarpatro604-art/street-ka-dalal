// Landing page (Sagar 2026-11-21: "make it similar to sector scope ... attracting and organised, this is the first thing a
// user will see"). A full-screen dark page over everything, built like SectorScope's landing: a giant two-line headline
// over a candle chart that lights up under the cursor, a pill menu, glass cards for the terminal, one green panel per
// co-founder (Sagar and Bhuvan are EQUAL co-founders: same panel, same size, same title), the mission, the community and
// a thank-you band. Shown to signed-out visitors, and to members on every new visit and at #/about.
// No emoji, no em dash, no tilde. Facts only, no buy / sell words (SEBI).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LINKS = {
  wa: 'https://chat.whatsapp.com/DUdUxpofHqE9auMNtDyZYr', tg: 'https://t.me/sagar00024',
  sagarIg: 'https://www.instagram.com/sagarpatro604/', sagarLi: 'https://www.linkedin.com/in/sagarpps',
  bhuvanIg: 'https://www.instagram.com/bhuvan_psri/', bhuvanLi: 'https://www.linkedin.com/in/bhuvan-pasari-8944b5250',
};
const FOUNDERS = [
  { name: 'K. Sagar Patro', img: 'icons/founder-sagar.webp', ig: LINKS.sagarIg, igH: '@sagarpatro604', li: LINKS.sagarLi,
    bio: 'Studying the <b>Capital Markets and Trading</b> programme at <b>Masters\' Union</b>, and trading and investing in Indian equities for over <b>three years</b>. Sagar builds the research tools behind the terminal and makes reels on markets, stocks and money in simple Hinglish.',
    tags: ['Research and tools', 'Masters\' Union', 'Reels in Hinglish'] },
  { name: 'Bhuvan Pasari', img: 'icons/founder-bhuvan.webp', ig: LINKS.bhuvanIg, igH: '@bhuvan_psri', li: LINKS.bhuvanLi,
    bio: 'Bhuvan builds and runs the <b>Street ka Dalal community</b> with Sagar and co-hosts the <b>Sunday community sessions</b>, where members go through the week\'s market, the stories worth knowing and one strategy or theme in depth.',
    tags: ['Community', 'Sunday sessions', 'Co-host'] },
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
  const launch = member
    ? '<button class="lx-signup" data-act="enterTerminal" type="button">Launch terminal</button>'
    : '<button class="lx-signup" data-act="signIn" type="button">Sign in</button>';
  const main = member
    ? '<button class="lx-cta" data-act="enterTerminal" type="button">Explore the terminal</button>'
    : `<button class="lx-cta lx-google" data-act="signIn" type="button">${google}<span>Continue with Google</span></button>`;
  const card = ([r, t, d, i, green]) => `<button class="lx-card${green ? ' green' : ''}" type="button" data-act="${member ? 'enterTerminal' : 'signIn'}" data-v="${r}">
      <span class="lx-ico">${ic(i, 20)}</span><b>${t}</b><span class="lx-d">${d}</span><i>${member ? 'Open' : 'Sign in to open'}</i></button>`;
  return `<div class="lx" id="lx">
  <section class="lx-hero" id="lxHero">
    <div class="lx-layer lx-base" id="lxBase"></div>
    <div class="lx-layer lx-lit" id="lxLit"></div>
    <div class="lx-vignette"></div>
    <nav class="lx-nav">
      <a class="lx-brand" href="#/" data-go="top">${logo}<span>Street <em>ka</em> Dalal</span></a>
      <div class="lx-pill"><a class="on" data-go="top">Overview</a><a data-go="lxTerminal">Terminal</a><a data-go="lxFounders">Founders</a><a data-go="lxMission">Mission</a><a data-go="lxCommunity">Community</a></div>
      ${launch}
    </nav>
    <div class="lx-head"><h1><span class="lx-l1">Read the market</span><span class="lx-l2">like an institution.</span></h1></div>
    <div class="lx-bl"><p>Screeners, results, sector rotation, mutual fund flows, pre-market and Dalal, your AI buddy. Built on NSE data, explained in plain words, free for our community.</p></div>
    <div class="lx-br">
      <p>Move your cursor across the chart: Nifty 50, day by day. Behind it, every scan, result and flow we track for you.</p>
      ${inApp && !member ? '<p class="lx-warn">Open this page in Chrome or Safari to sign in: Google does not allow it inside Instagram or Facebook. <button class="lx-copy" data-act="copyLink" type="button">Copy link</button></p>' : ''}
      ${main}${error ? `<p class="lx-err">${esc(error)}</p>` : ''}
      <div class="lx-rating"><span class="lx-dot"></span>Free for our 500+ member community</div>
    </div>
    <div class="lx-hint">move your cursor across the chart</div>
  </section>

  <section class="lx-cards" id="lxTerminal">${CARDS.map(card).join('')}</section>
  <p class="lx-more">And more inside: Market, Results, News and filings, Prop. Research, the Library and Insights.</p>

  <div id="lxFounders" class="lx-founders">
    <p class="lx-eyebrow center">Meet the founders</p>
    ${FOUNDERS.map((f, k) => `<section class="lx-founder${k % 2 ? ' flip' : ''}">
      <div class="lx-photo"><img src="${f.img}" alt="${esc(f.name)}" loading="lazy" width="600" height="800"></div>
      <div class="lx-ftext">
        <div class="lx-feyebrow"><span class="lx-dot"></span>Co-founder, Street ka Dalal</div>
        <h2>${esc(f.name)}</h2>
        <p>${f.bio}</p>
        <div class="lx-tags">${f.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        <div class="lx-links"><a href="${f.ig}" target="_blank" rel="noopener">Instagram ${esc(f.igH)}</a><a href="${f.li}" target="_blank" rel="noopener">LinkedIn</a></div>
      </div></section>`).join('')}
  </div>

  <section class="lx-moto" id="lxMission"><div class="lx-eyebrow center">Our mission</div>
    <h2>"Read the market like an institution.<br>Decide like an owner."</h2>
    <p>Street ka Dalal puts the research a desk would use into the hands of every learning investor: free, in plain words, and with the source of every number on the page.</p></section>
  <section class="lx-values">${VALUES.map(([t, d, i]) => `<div class="lx-v"><span class="lx-ico">${ic(i, 22)}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</section>

  <section class="lx-comm" id="lxCommunity"><div class="lx-eyebrow center">The community</div><h2>Learn with us</h2>
    <div class="lx-commgrid">
      <a href="${LINKS.wa}" target="_blank" rel="noopener"><b>WhatsApp community</b><span>500+ members. The morning note, market stories and session invites.</span></a>
      <a href="session"><b>Sunday sessions</b><span>Free and live on Google Meet with Sagar and Bhuvan.</span></a>
      <a href="${LINKS.tg}" target="_blank" rel="noopener"><b>Telegram group</b><span>Quant and factor investing talk.</span></a>
      <a href="quiz"><b>Investor persona test</b><span>What kind of investor are you? About three minutes.</span></a>
      <a href="humanize"><b>Plagiarism checker</b><span>Check your text against the web, rewrite it in one click.</span></a>
    </div></section>

  <section class="lx-thanks"><div class="lx-tin"><h2>Thank you for learning with us</h2><p>Here is to sharper decisions and calmer conviction. Let us read the market together.</p>
    ${member ? '<button class="lx-cta lg" data-act="enterTerminal" type="button">Launch terminal</button>' : `<button class="lx-cta lx-google lg" data-act="signIn" type="button">${google}<span>Continue with Google</span></button>`}</div></section>
  <div class="lx-disc">For learning only. Nothing here is investment advice or a recommendation to buy or sell any security. We are not SEBI-registered advisers. Street ka Dalal by K. Sagar Patro and Bhuvan Pasari.</div>
</div>`;
}

/* ---------------- the hero: Nifty 50 closes, a light that follows the cursor ---------------- */
function chartSvg(pts, bright) {
  const W = 1680, H = 950, n = pts.length, lo = Math.min(...pts), hi = Math.max(...pts), pad = H * 0.16;
  const y = (v) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const cw = W / n, up = bright ? '#18d68a' : '#25352f', dn = bright ? '#ff5470' : '#3a2a30';
  let grid = '';
  for (let g = 0; g <= 6; g++) { const yy = (g * H) / 6; grid += `<line x1="0" y1="${yy}" x2="${W}" y2="${yy}" stroke="${bright ? 'rgba(24,214,138,0.10)' : 'rgba(255,255,255,0.035)'}" stroke-width="1"/>`; }
  let body = '';
  const f = bright ? ' filter="url(#gl)"' : '';
  for (let i = 1; i < n; i++) {
    const o = pts[i - 1], c = pts[i], col = c >= o ? up : dn, x = (i + 0.5) * cw, bw = Math.max(3, cw * 0.62);
    const wick = Math.abs(c - o) * 0.6 + (hi - lo) * 0.005;
    body += `<line x1="${x.toFixed(1)}" y1="${y(Math.max(o, c) + wick).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y(Math.min(o, c) - wick).toFixed(1)}" stroke="${col}" stroke-width="1.6"${f}/>`;
    body += `<rect x="${(x - bw / 2).toFixed(1)}" y="${y(Math.max(o, c)).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, y(Math.min(o, c)) - y(Math.max(o, c))).toFixed(1)}" rx="1.5" fill="${col}"${f}/>`;
  }
  let extra = '', defs = '';
  if (bright) {
    const line = pts.map((v, i) => `${((i + 0.5) * cw).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    extra = `<path d="M ${(0.5 * cw).toFixed(1)},${H} L ${line.split(' ').join(' L ')} L ${((n - 0.5) * cw).toFixed(1)},${H} Z" fill="url(#ag)"/><polyline points="${line}" fill="none" stroke="#8ef5c4" stroke-width="2.4" filter="url(#gl)"/>`;
    defs = '<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18d68a" stop-opacity="0.28"/><stop offset="1" stop-color="#18d68a" stop-opacity="0"/></linearGradient><filter id="gl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${bright ? '#050a08' : '#080d0b'}"/>${defs}${grid}${extra}${body}</svg>`;
  return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
}

let raf = 0;
export async function wireLanding() {
  const root = document.getElementById('lx'), hero = document.getElementById('lxHero');
  if (!root || !hero) return;
  document.body.classList.add('lx-open');
  // the pill menu scrolls inside the page; the brand goes back to the top
  root.querySelectorAll('[data-go]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = a.dataset.go === 'top' ? null : document.getElementById(a.dataset.go);
      root.scrollTo({ top: t ? t.offsetTop - 20 : 0, behavior: 'smooth' });
    });
  });
  const pills = [...root.querySelectorAll('.lx-pill a')];
  root.addEventListener('scroll', () => {
    const yy = root.scrollTop + 120; let cur = 'top';
    for (const id of ['lxTerminal', 'lxFounders', 'lxMission', 'lxCommunity']) { const el = document.getElementById(id); if (el && el.offsetTop <= yy) cur = id; }
    pills.forEach((p) => p.classList.toggle('on', p.dataset.go === cur));
  }, { passive: true });
  let pts = [];
  try {
    const d = await fetch('data/hist/idx_recent.json', { cache: 'force-cache' }).then((r) => r.json());
    pts = (d.s?.['Nifty 50'] || []).filter((v) => v != null).slice(-130);
  } catch { /* the page works without the chart */ }
  if (pts.length > 10 && document.getElementById('lxBase')) { document.getElementById('lxBase').style.backgroundImage = chartSvg(pts, false); document.getElementById('lxLit').style.backgroundImage = chartSvg(pts, true); }
  const touch = window.matchMedia('(pointer: coarse)').matches, reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mx = -999, my = -999, sx = -999, sy = -999, t0 = 0, moved = false;
  hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; moved = true; if (sx < -900) { sx = mx; sy = my; } hero.classList.add('lx-active'); });
  cancelAnimationFrame(raf);
  const step = (t) => {
    if (!document.getElementById('lxHero')) return;          // left the page
    if ((touch || !moved) && !reduce) {                         // phones, or no cursor yet: the light sweeps by itself
      if (!t0) t0 = t; const p = ((t - t0) / 6000) % 1;
      mx = p * hero.clientWidth; my = hero.clientHeight * (0.55 + 0.12 * Math.sin(t / 1400));
      if (sx < -900) { sx = mx; sy = my; }
    }
    sx += (mx - sx) * 0.1; sy += (my - sy) * 0.1;
    hero.style.setProperty('--mx', sx.toFixed(1) + 'px'); hero.style.setProperty('--my', sy.toFixed(1) + 'px');
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { root, threshold: 0.12 }) : null;
  root.querySelectorAll('.lx-card, .lx-founder, .lx-moto, .lx-v, .lx-comm, .lx-thanks').forEach((el) => { el.classList.add('lx-rv'); if (io) io.observe(el); else el.classList.add('in'); });
}
export const closeLanding = () => document.body.classList.remove('lx-open');
