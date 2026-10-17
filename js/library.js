// Library: community meet-up decks, our research and recommended books, read inside the site.
// The shelf is library/catalog.json (no code change to add an item). PDFs open in a page-by-page reader
// (pdf.js, so it works on phones too); reading progress stays in this browser only.

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const STORE = 'skd.lib.v1';
const st = { tab: 'all', q: '' };
let catalog = null;

export async function loadCatalog(force) {
  if (catalog && !force) return catalog;
  const r = await fetch('library/catalog.json', { cache: 'no-cache' }); // revalidate: a lock must show at once
  if (!r.ok) throw new Error('The library list could not be loaded');
  catalog = await r.json();
  return catalog;
}

function readAll() { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } }
function saveOne(id, v) { try { const a = readAll(); a[id] = { ...(a[id] || {}), ...v, t: Date.now() }; localStorage.setItem(STORE, JSON.stringify(a)); } catch {} }
const progOf = (it, all = readAll()) => {
  const p = all[it.id];
  if (!p) return null;
  const n = p.n || it.pages || 0;
  return { page: p.p || 1, pages: n, done: !!p.done, pct: p.done ? 100 : n ? Math.min(99, Math.round((Math.max(p.seen || p.p || 1, p.p || 1) / n) * 100)) : 0, t: p.t || 0 };
};

/* ---------------- shelf ---------------- */
export async function libraryHome(h) {
  const { esc, pageHead } = h;
  const c = await loadCatalog();
  const all = readAll();
  const reading = c.items.filter((it) => it.kind === 'pdf' && !it.locked && progOf(it, all) && !progOf(it, all).done)
    .sort((a, b) => progOf(b, all).t - progOf(a, all).t).slice(0, 3);
  const tabs = [['all', 'All'], ...c.shelves.map((s) => [s.id, s.title])];
  return `${pageHead('Library', 'Read, learn, come back')}
  <p class="lede">Our community meet-up decks, the research we built for our own work, and the books we learn from. Open anything and read it right here; the site remembers where you stopped.</p>
  ${reading.length ? `<section class="card lib-continue"><div class="card-head"><h2>Continue reading</h2></div>
    <div class="lib-cont-row">${reading.map((it) => { const p = progOf(it, all); return `<a class="lib-cont" href="#/library/${esc(it.id)}"><b>${esc(it.title)}</b><span class="sub">Page ${p.page} of ${p.pages || '?'}</span>${bar(p.pct)}</a>`; }).join('')}</div></section>` : ''}
  <div class="lib-tools">
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${st.tab === k ? 'on' : ''}" data-act="libTab" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    <label class="lib-search">${h.ic('search', 16)}<input type="search" data-input="libQ" value="${esc(st.q)}" placeholder="Search the library" aria-label="Search the library"></label>
  </div>
  <div id="libList">${listHTML(h, c)}</div>
  <p class="rs-disc">Everything here is for learning. It is not investment advice and not a recommendation to buy or sell any security. Street ka Dalal is not a SEBI-registered adviser.</p>`;
}

export function libSetTab(v) { st.tab = v; }
export function libSearch(h, v) { st.q = v; const el = document.getElementById('libList'); if (el && catalog) el.innerHTML = listHTML(h, catalog); }

function listHTML(h, c) {
  const { esc } = h;
  const q = st.q.trim().toLowerCase();
  const match = (it) => !q || [it.title, it.sub, it.author, it.by, ...(it.tags || [])].join(' ').toLowerCase().includes(q);
  const all = readAll();
  const out = c.shelves.filter((s) => st.tab === 'all' || st.tab === s.id).map((s) => {
    const items = c.items.filter((it) => it.shelf === s.id && match(it));
    if (!items.length) return '';
    return `<section class="lib-shelf"><div class="lib-shelf-head"><h2>${esc(s.title)}</h2><p class="sub">${esc(s.sub || '')}</p></div>
      <div class="lib-grid">${items.map((it) => card(h, it, all)).join('')}</div></section>`;
  }).join('');
  return out || `<div class="empty card">Nothing in the library matches "${esc(st.q)}".</div>`;
}

const bar = (pct) => `<span class="lib-bar" aria-label="${pct}% read"><i style="width:${pct}%"></i></span>`;

function card(h, it, all) {
  const { esc, fDate, ic } = h;
  const tags = (it.tags || []).slice(0, 3).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
  if (it.locked) {
    return `<article class="lib-card locked"><div class="lib-cover lock">${lockSVG()}<span>Coming soon</span></div>
      <div class="lib-body"><h3>${esc(it.title)}</h3>${it.date ? `<span class="sub">${fDate(it.date)}${it.by ? ` · ${esc(it.by)}` : ''}</span>` : ''}
      <p>${esc(it.sub)}</p><div class="chip-row">${tags}</div>
      <p class="lib-lock-note">${lockSVG(14)} ${esc(it.lock_note || 'Opens here once it is ready.')}</p></div></article>`;
  }
  if (it.kind === 'book') {
    return `<article class="lib-card book"><div class="lib-body">
      <span class="chip type">Book</span><h3>${esc(it.title)}</h3><span class="sub">${esc(it.author || '')}${it.year ? ` · ${it.year}` : ''}</span>
      <p>${esc(it.sub)}</p>
      ${(it.learn || []).length ? `<p class="lib-k">What you learn</p><ul class="lib-learn">${it.learn.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${it.caution ? `<p class="lib-caution"><b>Keep in mind:</b> ${esc(it.caution)}</p>` : ''}
      <div class="lib-actions"><a class="btn sm" href="${esc(it.buy)}" target="_blank" rel="noopener">${ic('link', 15)} Find the book</a></div></div></article>`;
  }
  if (it.kind === 'link') {
    return `<a class="lib-card" href="${esc(it.href)}"><div class="lib-cover"><span>Live study</span></div><div class="lib-body">
      <h3>${esc(it.title)}</h3><span class="sub">${fDate(it.date)}</span><p>${esc(it.sub)}</p><div class="chip-row">${tags}</div>
      <div class="lib-actions"><span class="btn sm primary">Open the study</span></div></div></a>`;
  }
  const p = progOf(it, all);
  const meta = [it.date ? fDate(it.date) : '', it.pages ? `${it.pages} pages` : '', it.mb ? `${it.mb} MB` : '', it.protect ? 'Read on the site' : ''].filter(Boolean).join(' · ');
  return `<article class="lib-card"><a class="lib-cover pdf" href="#/library/${esc(it.id)}"><span>${esc(shelfWord(it.shelf))}</span>${ic('file', 34)}</a>
    <div class="lib-body"><h3><a href="#/library/${esc(it.id)}">${esc(it.title)}</a></h3><span class="sub">${esc(meta)}${it.by ? ` · ${esc(it.by)}` : ''}</span>
    <p>${esc(it.sub)}</p><div class="chip-row">${tags}</div>
    ${p ? `<div class="lib-prog">${bar(p.pct)}<span class="sub">${p.done ? 'Finished' : `Page ${p.page} of ${p.pages || it.pages}`}</span></div>` : ''}
    <div class="lib-actions"><a class="btn sm primary" href="#/library/${esc(it.id)}">${p && !p.done ? 'Continue' : 'Read'}</a>${it.download ? `<a class="btn sm ghost" href="${esc(it.file)}" download>Download</a>` : ''}</div></div></article>`;
}
const shelfWord = (s) => ({ meetups: 'Meet-up deck', research: 'Research' })[s] || 'Document';
const lockSVG = (s = 30) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

/* ---------------- reader ---------------- */
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const getZoom = () => { try { const z = +localStorage.getItem('skd.lib.zoom'); return ZOOMS.includes(z) ? z : 1; } catch { return 1; } };

export async function libraryReader(h, id) {
  const { esc, after } = h;
  const c = await loadCatalog();
  const it = c.items.find((x) => x.id === id);
  const back = `<p class="crumb"><a href="#/library">← Library</a></p>`;
  if (!it || it.kind !== 'pdf') return `${back}<div class="empty card">That item is not in the library.</div>`;
  if (it.locked) return `${back}<div class="empty card lib-locked-page">${lockSVG(36)}<h2>${esc(it.title)}</h2><p>${esc(it.lock_note || 'Opens here once it is ready.')}</p></div>`;
  const p = progOf(it);
  after.push(() => startReader(it, p));
  const zb = (id2, label, txt) => `<button class="btn sm ghost lib-zb" id="${id2}" aria-label="${label}" title="${label}">${txt}</button>`;
  return `${back}
  <div class="lib-reader" id="libReader">
  <header class="lib-rhead card">
    <div class="lib-rtitle"><p class="eyebrow">${esc(shelfWord(it.shelf))}${it.protect ? ' · read on the site' : ''}</p><h1>${esc(it.title)}</h1></div>
    <div class="lib-rbar">
      <span id="libPage" class="lib-pageno">Page ${p?.page || 1} of ${it.pages || '…'}</span>
      ${bar(p?.pct || 0).replace('class="lib-bar"', 'class="lib-bar" id="libBar"')}
      <span class="lib-zoom">${zb('libZoomOut', 'Zoom out', '−')}<button class="btn sm ghost lib-zl" id="libZoomFit" title="Back to fit width">${Math.round(getZoom() * 100)}%</button>${zb('libZoomIn', 'Zoom in', '+')}</span>
      <button class="btn sm" id="libFull">Full screen</button>
      <button class="btn sm ${p?.done ? 'primary' : ''}" id="libDone" data-act="libDone" data-id="${esc(it.id)}">${p?.done ? 'Finished' : 'Mark as finished'}</button>
      ${it.download ? `<a class="btn sm ghost" href="${esc(it.file)}" download>Download</a>` : ''}
    </div>
  </header>
  <div class="lib-scroll" id="libScroll"><div id="libPages" class="lib-pages" data-id="${esc(it.id)}"><div class="loading"><span class="dots"><i></i><i></i><i></i></span></div></div></div>
  </div>`;
}

export function libToggleDone(el) {
  const id = el.dataset.id, cur = readAll()[id];
  const done = !cur?.done;
  saveOne(id, { done });
  el.textContent = done ? 'Finished' : 'Mark as finished';
  el.classList.toggle('primary', done);
  const b = document.querySelector('#libBar i');
  if (b && done) b.style.width = '100%';
}

let pdfLib = null;
function loadPdfJs() {
  if (pdfLib) return pdfLib;
  pdfLib = new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = () => { pdfLib = null; bad(new Error('reader did not load')); };
    document.head.appendChild(s);
  });
  return pdfLib;
}

// Research files are stored scrambled (XOR with this key) so the file link alone is not a PDF; the reader unscrambles them.
const KEY = new TextEncoder().encode('skd-library-read-on-site-only-v1');
async function fileSource(it) {
  if (!it.protect) return { url: it.file };
  const r = await fetch(it.file);
  if (!r.ok) throw new Error('file missing');
  const b = new Uint8Array(await r.arrayBuffer());
  for (let i = 0; i < b.length; i++) b[i] ^= KEY[i % KEY.length];
  return { data: b };
}

async function startReader(it, prog) {
  const box = document.getElementById('libPages');
  const wrap = document.getElementById('libReader');
  const scroller = document.getElementById('libScroll');
  if (!box) return;
  let doc;
  try {
    const lib = await loadPdfJs();
    doc = await lib.getDocument(await fileSource(it)).promise;
  } catch (e) {
    box.innerHTML = `<div class="card empty">The reader could not open this file. Please refresh the page and try again.${it.protect ? '' : ` Or <a href="${it.file}" target="_blank" rel="noopener">open the PDF</a>.`}</div>`;
    return;
  }
  if (!document.body.contains(box)) { doc.destroy(); return; }
  if (it.protect) box.addEventListener('contextmenu', (e) => e.preventDefault());
  const n = doc.numPages;
  const first = await doc.getPage(1);
  const vp1 = first.getViewport({ scale: 1 });
  box.innerHTML = Array.from({ length: n }, (_, i) => `<div class="lib-page" data-p="${i + 1}" style="aspect-ratio:${vp1.width} / ${vp1.height}"><span class="lib-pnum">${i + 1}</span></div>`).join('');
  const pages = [...box.children];
  const rendered = new Map();
  let seen = Math.max(readAll()[it.id]?.seen || 0, prog?.page || 1);
  let zoom = getZoom();
  let cur = 0, saveT;

  const draw = async (el) => {
    const num = +el.dataset.p;
    if (rendered.has(num)) return;
    const tok = {};
    rendered.set(num, tok);
    try {
      const page = num === 1 ? first : await doc.getPage(num);
      const base = page.getViewport({ scale: 1 });
      el.style.aspectRatio = `${base.width} / ${base.height}`;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.min(el.clientWidth * dpr, 3600); // cap canvas size when zoomed in
      const vp = page.getViewport({ scale: px / base.width });
      const cv = document.createElement('canvas');
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      if (rendered.get(num) !== tok) return;
      el.querySelector('canvas')?.remove();
      el.appendChild(cv);
    } catch { if (rendered.get(num) === tok) rendered.delete(num); }
    // keep memory low on long reports: drop pages far from the one in view
    const keep = zoom > 1.5 ? 6 : 14;
    if (rendered.size > keep) for (const k of [...rendered.keys()].sort((a, b) => Math.abs(b - num) - Math.abs(a - num)).slice(0, rendered.size - keep)) { rendered.delete(k); pages[k - 1]?.querySelector('canvas')?.remove(); }
  };

  const io = new IntersectionObserver((ents) => ents.forEach((e) => e.isIntersecting && draw(e.target)), { rootMargin: '900px 0px' });

  // page width = fit-to-width x zoom; wider than the screen scrolls sideways
  const fitW = () => Math.min(scroller.clientWidth, wrap.classList.contains('lib-focus') ? 1500 : 1100);
  const layout = (anchor) => {
    box.style.width = `${Math.round(fitW() * zoom)}px`;
    // pages near the reader keep their old (stretched) image until the sharp one is drawn: no blank flash
    const near = anchor || cur || 1;
    rendered.clear();
    pages.forEach((el, i) => { if (Math.abs(i + 1 - near) > 2) el.querySelector('canvas')?.remove(); io.unobserve(el); io.observe(el); });
    if (anchor) pages[anchor - 1]?.scrollIntoView({ block: 'start' });
    const zl = document.getElementById('libZoomFit');
    if (zl) zl.textContent = `${Math.round(zoom * 100)}%`;
  };
  const setZoom = (z) => {
    if (z === zoom) return;
    zoom = z;
    try { localStorage.setItem('skd.lib.zoom', String(z)); } catch {}
    layout(cur || 1);
  };
  const step = (d) => setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + d))]);
  document.getElementById('libZoomIn')?.addEventListener('click', () => step(1));
  document.getElementById('libZoomOut')?.addEventListener('click', () => step(-1));
  document.getElementById('libZoomFit')?.addEventListener('click', () => setZoom(1));
  // Full screen: the reader fills the whole window (works everywhere) and also asks the browser for real
  // full screen where it is allowed (laptops). Esc or the button closes it.
  const fullBtn = document.getElementById('libFull');
  const isFull = () => wrap.classList.contains('lib-focus');
  const setFull = (on) => {
    if (on === isFull()) return;
    const at = cur || 1;
    wrap.classList.toggle('lib-focus', on);
    document.body.classList.toggle('lib-noscroll', on);
    if (fullBtn) fullBtn.textContent = on ? 'Exit full screen' : 'Full screen';
    if (on && wrap.requestFullscreen && !document.fullscreenElement) wrap.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    requestAnimationFrame(() => layout(at));
  };
  if (fullBtn) { fullBtn.hidden = false; fullBtn.addEventListener('click', () => setFull(!isFull())); }
  const onFs = () => {
    if (!document.body.contains(box)) { document.removeEventListener('fullscreenchange', onFs); return; }
    if (!document.fullscreenElement && isFull()) setFull(false); // browser full screen closed with Esc
    else requestAnimationFrame(() => layout(cur || 1));
  };
  document.addEventListener('fullscreenchange', onFs);
  const onHash = () => { window.removeEventListener('hashchange', onHash); document.body.classList.remove('lib-noscroll'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  window.addEventListener('hashchange', onHash);
  let rzT, lastW = scroller.clientWidth;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(() => { if (!document.body.contains(box) || scroller.clientWidth === lastW) return; lastW = scroller.clientWidth; layout(cur || 1); }, 250); };
  window.addEventListener('resize', onResize);
  const onKey = (e) => {
    if (!document.body.contains(box)) { document.removeEventListener('keydown', onKey); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); step(1); }
    else if (e.key === '-') { e.preventDefault(); step(-1); }
    else if (e.key === '0') setZoom(1);
    else if (e.key === 'f' || e.key === 'F') setFull(!isFull());
    else if (e.key === 'Escape' && isFull()) setFull(false);
  };
  document.addEventListener('keydown', onKey);

  const lbl = document.getElementById('libPage'), barI = document.querySelector('#libBar i');
  const onScroll = () => {
    if (!document.body.contains(box)) { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); io.disconnect(); doc.destroy(); return; }
    const mid = window.innerHeight * 0.4;
    let p = 1;
    for (const el of pages) { const r = el.getBoundingClientRect(); if (r.top <= mid) p = +el.dataset.p; else break; }
    if (p === cur) return;
    cur = p; seen = Math.max(seen, p);
    if (lbl) lbl.textContent = `Page ${p} of ${n}`;
    const done = readAll()[it.id]?.done || p === n;
    if (barI) barI.style.width = `${done ? 100 : Math.round((seen / n) * 100)}%`;
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      saveOne(it.id, { p, n, seen, ...(p === n ? { done: true } : {}) });
      if (p === n) { const b = document.getElementById('libDone'); if (b) { b.textContent = 'Finished'; b.classList.add('primary'); } }
    }, 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  wrap?.addEventListener('scroll', onScroll, { passive: true }); // full screen scrolls the reader, not the window
  layout(0);
  const start = Math.min(prog?.page || 1, n);
  if (start > 1) requestAnimationFrame(() => pages[start - 1].scrollIntoView({ block: 'start' }));
  onScroll();
}
