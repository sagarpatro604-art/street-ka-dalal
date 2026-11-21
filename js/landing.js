// Landing page (Sagar 2026-11-21: "make a landing page, like we had in sector scope ... our information, founders
// information about me and bhuvan ... and about our terminal"). Shown to signed-out visitors in place of the old
// sign-in card, and to members at #/about. Sagar and Bhuvan are EQUAL co-founders: same card, same size, same title.
// No emoji, no em dash, no tilde. Facts only, no buy / sell words (SEBI).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LINKS = {
  wa: 'https://chat.whatsapp.com/DUdUxpofHqE9auMNtDyZYr', tg: 'https://t.me/sagar00024',
  sagarIg: 'https://www.instagram.com/sagarpatro604/', sagarLi: 'https://www.linkedin.com/in/sagarpps',
  bhuvanIg: 'https://www.instagram.com/bhuvan_psri/', bhuvanLi: 'https://www.linkedin.com/in/bhuvan-pasari-8944b5250',
};
const FOUNDERS = [
  { name: 'K. Sagar Patro', img: 'icons/sagar.webp', ig: LINKS.sagarIg, igH: '@sagarpatro604', li: LINKS.sagarLi,
    bio: 'Studying the Capital Markets and Trading programme at Masters\' Union, and trading and investing in Indian equities for over three years. Sagar builds the research tools behind the terminal and makes reels on markets, stocks and money in simple Hinglish.',
    tags: ['Research and tools', 'Masters\' Union', 'Reels in Hinglish'] },
  { name: 'Bhuvan Pasari', img: 'icons/bhuvan.webp', ig: LINKS.bhuvanIg, igH: '@bhuvan_psri', li: LINKS.bhuvanLi,
    bio: 'Bhuvan builds and runs the Street ka Dalal community with Sagar and co-hosts the Sunday community sessions, where members go through the week\'s market, the stories worth knowing and one strategy or theme in depth.',
    tags: ['Community', 'Sunday sessions', 'Co-host'] },
];
// what is inside, in the order of the left menu (route, title, one line)
const INSIDE = [
  ['', 'Stock watch', 'Your lists on one screen with our own chart: stage, volume signals, results markers, daily, weekly and monthly.'],
  ['screeners', 'Screeners', '27 end-of-day scans on every NSE stock, with filters, a key column and a grid of charts.'],
  ['sectors', 'Groups and rotation', 'Sectors, industries and themes with trend labels, and the rotation chart (RRG) of NSE\'s own indices.'],
  ['heatmap', 'Heatmap', 'The whole market at a glance, sized by market value and coloured by the day\'s move.'],
  ['discover', 'Discover', 'Big investors\' holdings, market valuation, what management said and your stocks this week. Premium.'],
  ['premarket', 'Pre-market', 'GIFT Nifty, global cues, flows, results due and the night\'s filings before 9:15.'],
  ['market', 'Market', 'Indices, breadth, FII and DII flows and the market\'s internals, every evening.'],
  ['funds', 'Mutual funds', 'Where mutual funds are buying and selling, stock by stock and sector by sector.'],
  ['results', 'Results', 'Every NSE result as it lands, the calendar, and each company\'s quarters since 2015.'],
  ['resplus', 'Results Plus', 'What the price did after results: gaps that held or filled, sectors after results, the profit pool, guidance changes, season reports.'],
  ['news', 'News and filings', 'Company announcements and headlines, sorted by what matters.'],
  ['research', 'Prop. Research', 'Retail and FPI participation in the market, measured from NSE\'s own files.'],
  ['library', 'Library and Insights', 'Our session decks, research PDFs and written insights.'],
  ['portfolio', 'Portfolio X-ray', 'Paste your holdings and see sectors, overlap and risks. Read only in your browser, never sent anywhere.'],
];
const PRINCIPLES = [
  ['Facts, not tips', 'Every number comes from NSE filings, NSE prices and public data. No buy or sell calls, no targets.'],
  ['Plain words', 'Built so a first-time investor can read it and a full-time trader can use it.'],
  ['Checked before shown', 'Numbers are checked against NSE\'s own records; when something cannot be checked, the page says so.'],
];

export function landingHtml({ member = false, inApp = false, error = '', signInBtn = '', logo = '' } = {}) {
  const cta = member
    ? '<a class="btn primary lg" href="#/">Open the terminal</a>'
    : `${inApp ? `<div class="notice lp-notice"><b>Open this page in Chrome or Safari to sign in.</b> Google does not allow sign-in inside Instagram or Facebook's browser. Tap the menu and choose "Open in browser".<button class="btn ghost sm" data-act="copyLink">Copy link</button></div>` : ''}${signInBtn}${error ? `<p class="err">${esc(error)}</p>` : ''}`;
  const card = ([r, t, d]) => member
    ? `<a class="lp-card" href="#/${r}"><b>${t}</b><span>${d}</span><i>Open</i></a>`
    : `<button class="lp-card" data-act="signIn" type="button"><b>${t}</b><span>${d}</span><i>Sign in to open</i></button>`;
  return `<div class="lp${member ? ' member' : ''}">
  <section class="lp-hero" id="lpHero">
    <canvas class="lp-cv base" id="lpBase" aria-hidden="true"></canvas>
    <canvas class="lp-cv lit" id="lpLit" aria-hidden="true"></canvas>
    <div class="lp-shade"></div>
    <div class="lp-hero-in">
      ${logo}
      <p class="lp-kicker">Free market research for our community</p>
      <h1>Street <em>ka</em> Dalal</h1>
      <p class="lp-lede">Read the market from facts, not tips. Screeners, results, sector rotation, mutual fund flows, pre-market and Dalal, your AI buddy, built on NSE data and explained in plain words.</p>
      <div class="lp-cta">${cta}<a class="btn ghost lg" href="${LINKS.wa}" target="_blank" rel="noopener">Join the WhatsApp community</a></div>
      <div class="lp-stats"><div><b>500+</b><span>community members</span></div><div><b>27</b><span>daily stock scans</span></div><div><b>2015</b><span>results history from</span></div><div><b>Free</b><span>with Google sign-in</span></div></div>
    </div>
    <p class="lp-hint">Nifty 50, day by day over the last year</p>
  </section>

  <section class="lp-sec lp-reveal"><p class="lp-eyebrow">Inside the terminal</p><h2>Everything we use for our own research, in one place</h2>
    <div class="lp-grid">${INSIDE.map(card).join('')}
      <div class="lp-card lp-dalal"><b>Dalal, your AI buddy</b><span>Ask about any stock, result or market move. Dalal reads the site's own data and searches the latest news.</span><i>On every page</i></div></div></section>

  <section class="lp-sec lp-reveal"><p class="lp-eyebrow">Meet the founders</p><h2>Built by two co-founders who use it every day</h2>
    <div class="lp-founders">${FOUNDERS.map((f) => `<article class="lp-founder">
      <img src="${f.img}" alt="${esc(f.name)}" width="132" height="132" loading="lazy">
      <div><h3>${esc(f.name)}</h3><p class="lp-role">Co-founder, Street ka Dalal</p><p>${esc(f.bio)}</p>
        <div class="lp-tags">${f.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        <div class="lp-links"><a href="${f.ig}" target="_blank" rel="noopener">Instagram ${esc(f.igH)}</a><a href="${f.li}" target="_blank" rel="noopener">LinkedIn</a></div></div></article>`).join('')}</div></section>

  <section class="lp-sec lp-mission lp-reveal"><p class="lp-eyebrow">Our mission</p>
    <blockquote>Read the market like an institution. Decide like an owner.</blockquote>
    <p>Street ka Dalal puts the research a desk would use into the hands of every learning investor: free, in plain words, and with the source of every number on the page.</p>
    <div class="lp-princ">${PRINCIPLES.map(([t, d]) => `<div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></section>

  <section class="lp-sec lp-reveal"><p class="lp-eyebrow">The community</p><h2>Learn with us</h2>
    <div class="lp-comm">
      <a href="${LINKS.wa}" target="_blank" rel="noopener"><b>WhatsApp community</b><span>500+ members. The morning note, market stories and session invites.</span></a>
      <a href="session"><b>Sunday sessions</b><span>Free, live on Google Meet with Sagar and Bhuvan: the week's market, then one strategy or theme in depth.</span></a>
      <a href="${LINKS.tg}" target="_blank" rel="noopener"><b>Telegram group</b><span>Quant and factor investing talk.</span></a>
      <a href="quiz"><b>Investor persona test</b><span>Find out what kind of investor you are in about three minutes.</span></a>
      <a href="humanize"><b>Plagiarism checker and humanizer</b><span>Check your text against the web and rewrite it in one click.</span></a>
    </div></section>

  <section class="lp-end lp-reveal"><h2>Thank you for learning with us</h2><p>Here is to sharper decisions and calmer conviction. Let us read the market together.</p>
    <div class="lp-cta">${member ? '<a class="btn primary lg" href="#/">Open the terminal</a>' : signInBtn}</div></section>
  <p class="lp-disc">Street ka Dalal is for learning. Nothing here is investment advice or a recommendation to buy or sell any security. We are not SEBI-registered advisers; please do your own research or consult one before investing.</p>
</div>`;
}

/* ---------------- the hero: a year of Nifty 50 closes, a soft light that follows the cursor ---------------- */
let raf = 0;
export async function wireLanding() {
  const hero = document.getElementById('lpHero');
  if (!hero) return;
  let pts = [];
  try {
    const d = await fetch('data/hist/idx_recent.json', { cache: 'force-cache' }).then((r) => r.json());
    pts = (d.s?.['Nifty 50'] || []).filter((v) => v != null);
  } catch { /* the page still works without the chart */ }
  const base = document.getElementById('lpBase'), lit = document.getElementById('lpLit');
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const draw = () => {
    if (!pts.length) return;
    const W = hero.clientWidth, Hh = hero.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const [cv, a] of [[base, 0.22], [lit, 1]]) {
      cv.width = W * dpr; cv.height = Hh * dpr; cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, Hh);
      const n = pts.length, lo = Math.min(...pts), hi = Math.max(...pts), pad = Hh * 0.18;
      const y = (v) => Hh - pad - ((v - lo) / (hi - lo || 1)) * (Hh - 2 * pad);
      const bw = W / n;
      for (let i = 1; i < n; i++) {
        const o = pts[i - 1], cl = pts[i], up = cl >= o;
        const x = i * bw + bw / 2, top = y(Math.max(o, cl)), bot = y(Math.min(o, cl));
        c.globalAlpha = a;
        c.strokeStyle = c.fillStyle = up ? css('--accent') : css('--coral');
        const wick = Math.abs(cl - o) * 0.6 + (hi - lo) * 0.004;
        c.beginPath(); c.moveTo(x, y(Math.max(o, cl) + wick)); c.lineTo(x, y(Math.min(o, cl) - wick)); c.lineWidth = 1; c.stroke();
        c.fillRect(x - Math.max(1, bw * 0.32), top, Math.max(2, bw * 0.64), Math.max(1, bot - top));
      }
    }
  };
  draw();
  let tx = 0.7, ty = 0.45, cx = tx, cy = ty, auto = true, t0 = performance.now();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  hero.onpointermove = (e) => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; auto = false; };
  hero.onpointerleave = () => { auto = true; };
  cancelAnimationFrame(raf);
  const step = (now) => {
    if (!document.getElementById('lpHero')) return;            // left the page
    if (auto && !reduce) { const k = (now - t0) / 9000; tx = 0.5 + 0.38 * Math.sin(k * 2 * Math.PI); ty = 0.5 + 0.18 * Math.sin(k * 4 * Math.PI); }
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    hero.style.setProperty('--mx', (cx * 100).toFixed(2) + '%'); hero.style.setProperty('--my', (cy * 100).toFixed(2) + '%');
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(draw, 150); });
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 }) : null;
  document.querySelectorAll('.lp-reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
  document.getElementById('themeBtn')?.addEventListener('click', () => setTimeout(draw, 30));
}
