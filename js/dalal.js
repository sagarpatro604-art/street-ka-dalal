// "Dalal" — the floating AI buddy. Greets members with the community links, then answers questions
// through the Cloudflare function (/api/dalal), which holds the Gemini key and the daily limit.
import * as A from './auth.js';
import { SOCIAL, DALAL_API } from './config.js';

// The mascot: a cheerful street-smart broker — green cap with a gold band, round specs, big moustache.
export const DALAL_FACE = `<img class="dalal-face" src="icons/dalal-head.webp" alt="" width="80" height="80">`;

const SOCIAL_META = {
  whatsapp: ['WhatsApp community', '#25D366', '<path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/>'],
  instagram: ['Instagram', '#E1306C', '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>'],
  linkedin: ['LinkedIn', '#0A66C2', '<path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4v11H3v-11Zm7 0h3.8v1.6h.1a4.2 4.2 0 0 1 3.8-2c4 0 4.8 2.6 4.8 6.1v5.3h-4v-4.7c0-1.1 0-2.6-1.6-2.6s-1.9 1.2-1.9 2.5v4.8h-4v-11Z"/>'],
  telegram: ['Telegram', '#229ED9', '<path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.4 13.1 1.7 11.6c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3Z"/>'],
};
const SUGGEST = ['Aaj market kaisa raha?', 'Which sectors are leading this month?', "Today's flag & pole breakouts?", 'Where are mutual funds buying?', 'Any big order wins in filings today?'];

let H = null; // { md, esc }
let open = false, busy = false, left = null;
const KEY = 'skd.dalal.chat';
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; } };
const save = (m) => { try { sessionStorage.setItem(KEY, JSON.stringify(m.slice(-30))); } catch {} };
let msgs = [];

const $ = (s) => document.querySelector(s);
const firstName = () => String(A.state.user?.name || '').split(' ')[0] || 'dost';

function greeting() {
  const links = Object.entries(SOCIAL).filter(([, url]) => url).map(([k, url]) => {
    const [label, color, path] = SOCIAL_META[k];
    return `<a class="soc" href="${H.esc(url)}" target="_blank" rel="noopener" style="--c:${color}"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">${path}</svg>${label}</a>`;
  }).join('');
  return `<div class="dmsg bot greet">${DALAL_FACE}<div class="bubble">
    <p><b>Namaste ${H.esc(firstName())}! 🙏</b> Main hoon <b>Dalal</b>, Street ka Dalal ka AI buddy.</p>
    <p>Market, sectors, screeners, mutual-fund activity, company filings — kuch bhi poocho. I answer from our site's data first, and check trusted news when needed.</p>
    <p class="join">Join our community:</p>
    <div class="socs">${links}</div>
    <div class="sugs">${SUGGEST.map((s) => `<button class="sug" data-dalal-ask="${H.esc(s)}">${H.esc(s)}</button>`).join('')}</div>
  </div></div>`;
}

function msgHTML(m) {
  if (m.role === 'user') return `<div class="dmsg me"><div class="bubble">${H.esc(m.text)}</div></div>`;
  const src = (m.sources || []).length
    ? `<div class="srcs"><span>Sources:</span>${m.sources.map((s) => `<a href="${H.esc(s.uri)}" target="_blank" rel="noopener">${H.esc(s.title || 'link')}</a>`).join('')}</div>` : '';
  const tag = m.err ? '' : `<span class="dtag">${m.web ? 'Site data + web' : 'From Street ka Dalal data'}${m.asOf ? ` · close of ${H.esc(m.asOf)}` : ''}</span>`;
  return `<div class="dmsg bot ${m.err ? 'err' : ''}">${DALAL_FACE}<div class="bubble">${m.err ? H.esc(m.text) : H.md(m.text)}${src}${tag}</div></div>`;
}

function paint(scroll = true) {
  const box = $('#dalalMsgs');
  if (!box) return;
  box.innerHTML = greeting() + msgs.map(msgHTML).join('') + (busy ? `<div class="dmsg bot">${DALAL_FACE}<div class="bubble typing"><i></i><i></i><i></i><span>Dalal soch raha hai…</span></div></div>` : '');
  const l = $('#dalalLeft');
  if (l) l.textContent = left == null ? '' : `${left} question${left === 1 ? '' : 's'} left today`;
  if (scroll) box.scrollTop = box.scrollHeight;
}

async function api(method, body) {
  const t = await A.idToken();
  const url = location.hostname.endsWith('pages.dev') ? '/api/dalal' : DALAL_API;
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: body ? JSON.stringify(body) : undefined });
  let d = {};
  try { d = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, d };
}

async function refreshLeft() {
  if (A.state.demo) { left = 10; return; }
  try { const { ok, d } = await api('GET'); if (ok) left = d.left; } catch {}
}

async function ask(q) {
  q = String(q || '').trim();
  if (!q || busy) return;
  const history = msgs.filter((m) => !m.err).slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
  msgs.push({ role: 'user', text: q });
  busy = true;
  paint();
  try {
    if (A.state.demo) {
      await new Promise((r) => setTimeout(r, 700));
      msgs.push({ role: 'bot', text: 'This is the local demo. On the live site I answer from **Street ka Dalal data** and trusted news.\n\n- Market, sectors, screeners, MF activity and filings\n- Not investment advice — please do your own research.' });
      left = Math.max(0, (left ?? 10) - 1);
      A.logAsk({ q, a: msgs[msgs.length - 1].text, web: false, model: 'demo' }).catch(() => {});
    } else {
      const { ok, d } = await api('POST', { question: q, history });
      if (ok) {
        msgs.push({ role: 'bot', text: d.answer, sources: d.sources, web: d.web, asOf: d.asOf });
        left = d.left;
        A.logAsk({ q, a: d.answer, web: d.web, model: d.model }).catch(() => {});
      } else {
        msgs.push({ role: 'bot', err: true, text: (d.message || 'Dalal could not answer just now. Please try again.') + (A.isAdmin() && d.detail ? `

(admin only) ${d.detail}` : '') });
        if (d.left != null) left = d.left;
      }
    }
  } catch {
    msgs.push({ role: 'bot', err: true, text: 'Network problem. Please check your internet and try again.' });
  }
  busy = false;
  save(msgs);
  paint();
}

function toggle(force) {
  open = force ?? !open;
  $('#dalalPanel').hidden = !open;
  $('#dalalBtn').classList.toggle('on', open);
  if (open) {
    paint();
    refreshLeft().then(() => paint(false));
    setTimeout(() => $('#dalalInput')?.focus(), 50);
  }
}

export function mountDalal(helpers) {
  H = helpers;
  if ($('#dalalBtn')) { $('#dalalBtn').hidden = !A.state.user; if (!A.state.user) toggle(false); return; }
  msgs = load();
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="dalalBtn" class="dalal-peek" aria-label="Ask Dalal, the AI buddy"><span class="peek-say">Kuch poochna hai? 👀<b>Ask Dalal</b></span><img src="icons/dalal-peek.webp" alt="" width="265" height="720"></button>
    <section id="dalalPanel" class="dalal-panel" hidden aria-label="Dalal chat">
      <header>${DALAL_FACE}<div><b>Dalal</b><span>AI market buddy · Street ka Dalal</span></div><button class="dclose" data-dalal-close aria-label="Close">✕</button></header>
      <div id="dalalMsgs" class="dmsgs" aria-live="polite"></div>
      <form id="dalalForm" class="dform"><textarea id="dalalInput" rows="1" maxlength="800" placeholder="Ask Dalal about the market…"></textarea><button aria-label="Send">➤</button></form>
      <footer><span id="dalalLeft"></span><span>AI can make mistakes · not investment advice</span></footer>
    </section>`;
  document.body.append(...wrap.children);
  $('#dalalBtn').hidden = !A.state.user;
  $('#dalalBtn').addEventListener('click', () => toggle());
  setTimeout(() => $('#dalalBtn').classList.add('in'), 1200);
  let said = false;
  try { said = sessionStorage.getItem('skd.dalal.said') === '1'; } catch {}
  if (!said) setTimeout(() => { if (!open) { $('#dalalBtn').classList.add('say'); setTimeout(() => $('#dalalBtn').classList.remove('say'), 6000); } try { sessionStorage.setItem('skd.dalal.said', '1'); } catch {} }, 2600);
  setInterval(() => { const b = $('#dalalBtn'); if (open || !b || document.hidden) return; b.classList.remove('in'); setTimeout(() => b.classList.add('in'), 1400); }, 45000);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-dalal-close]')) toggle(false);
    const s = e.target.closest('[data-dalal-ask]');
    if (s) ask(s.dataset.dalalAsk);
  });
  $('#dalalForm').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#dalalInput'); const v = i.value; i.value = ''; i.style.height = ''; ask(v); });
  $('#dalalInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#dalalForm').requestSubmit(); } });
  $('#dalalInput').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) toggle(false); });
}
