// Plagiarism checker (Cloudflare Pages Function, /api/plagiarism), used by humanize.html. Google sign-in required.
//
// How a check works (nothing is taken on the search engine's word):
//   1. POST { text }: code picks up to 6 distinctive passages (sentences of 8+ words, spread across the text).
//   2. A web search runs for each passage in quotes: Gemini with Google Search (GEMINI_API_KEY, free tier, as Dalal)
//      first; if Gemini fails, Claude's web search tool (ANTHROPIC_API_KEY, about USD 0.01 a search, Haiku first).
//   3. The pages found (up to 10) are returned as a list; the browser then loads each one through
//      GET ?id=N&i=K (this function fetches that page, only pages found for that check, and streams its text back)
//      and COUNTS in code which runs of 7+ words of the text appear on the page. The % shown = words of the text
//      inside such matching runs / all words. Pages that cannot be opened (blocked, PDF) are listed as such.
//   4. POST { report: id, pct, after_pct, per } saves the browser's result to the log for Admin.
// GET (admin only): ?days=&q=&limit= -> checks, newest first; ?id=N&full=1 -> one check in full.
// DELETE ?id=N (admin only).
// Limits: PLAG_PER_USER checks a day per account (default 10), PLAG_PER_IP per network (default 30), and the
// shared Humanizer spend stop (HUMANIZE_DAY_USD / HUMANIZE_MONTH_USD) for the paid Claude search.

import { json, cors, istDate, within, words, table, overCaps, addSpend, limits, person, who, isAdmin } from '../../lib/hz_common.js';

const MAX_SOURCES = 10;
const PROBES = 6;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/* ------------------------------------------------------------ passages to search */
function pickProbes(text, k = PROBES) {
  const sents = String(text).replace(/\s+/g, ' ').split(/(?<=[.!?;:])\s+|\s+(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
  const cand = [];
  sents.forEach((s, i) => {
    const w = s.replace(/^["'(\[]+|["')\].,;:!?]+$/g, '').split(' ').filter(Boolean);
    if (w.length < 8) return;
    // a long sentence: a 14-word window from its middle (search engines match exact phrases best at this length)
    const piece = w.length > 18 ? w.slice(Math.floor((w.length - 14) / 2), Math.floor((w.length - 14) / 2) + 14) : w;
    cand.push({ i, q: piece.join(' ').replace(/"/g, ''), n: piece.length });
  });
  if (cand.length <= k) return cand.map((c) => c.q);
  const out = [];
  for (let j = 0; j < k; j++) out.push(cand[Math.floor((j * cand.length) / k + cand.length / (2 * k))].q);
  return [...new Set(out)];
}

function cleanUrl(u) {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return null;
    x.hash = '';
    for (const p of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|srsltid)/i.test(p)) x.searchParams.delete(p);
    return x.toString();
  } catch { return null; }
}

/* ------------------------------------------------------------ search: Gemini (free) first */
const vnum = (n) => { const m = String(n).match(/gemini-(\d+(?:\.\d+)?)/); return m ? +m[1] : 0; };
async function geminiModels(env, d) {
  const wanted = (env.GEMINI_MODELS || '').split(',').map((x) => x.trim()).filter(Boolean);
  let found = null;
  try { const r = await within(d.prepare('SELECT v FROM cache WHERE k = ? AND exp > ?').bind('models', Date.now()).first(), 3000); found = r ? JSON.parse(r.v) : null; } catch {}
  if (!found) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        found = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))
          .filter((n) => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|audio|live|embed|thinking|exp|computer|robotics/.test(n));
        found.sort((a, b) => (/lite/.test(a) - /lite/.test(b)) || (/preview/.test(a) - /preview/.test(b)) || vnum(b) - vnum(a) || a.length - b.length);
      }
    } catch {}
  }
  const list = found && found.length ? [...wanted.filter((w) => found.includes(w)), ...found] : (wanted.length ? wanted : ['gemini-flash-latest']);
  return [...new Set(list)].slice(0, 2);
}
async function resolveRedirect(u) {
  if (!/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect/.test(u)) return u;
  try { const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.headers.get('location') || null; } catch { return null; }
}
async function searchGemini(env, d, probes) {
  const deadline = Date.now() + 28000;
  let lastErr = '';
  for (const model of await geminiModels(env, d)) {
    const room = deadline - Date.now();
    if (room < 5000) break;
    const body = {
      systemInstruction: { parts: [{ text: 'You help a plagiarism checker. For EACH numbered passage, run one Google Search with the passage inside double quotes, so pages that contain the same words are found. After searching, reply with one short line per passage: the passage number and the address of a page that contains it word for word, or NONE.' }] },
      contents: [{ role: 'user', parts: [{ text: probes.map((p, i) => `${i + 1}. "${p}"`).join('\n') }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0, maxOutputTokens: 800, ...(vnum(model) >= 3 ? { thinkingConfig: { thinkingLevel: 'low' } } : {}) },
    };
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(Math.min(25000, room)),
      });
    } catch (e) { lastErr += ` | ${model}: ${e.name === 'TimeoutError' ? 'too slow' : e.message}`; continue; }
    if (!r.ok) { lastErr += ` | ${model}: ${r.status} ${(await r.text()).replace(/\s+/g, ' ').slice(0, 140)}`; continue; }
    const c = (await r.json()).candidates?.[0];
    const gm = c?.groundingMetadata || {};
    if (!(gm.webSearchQueries || []).length) { lastErr += ` | ${model}: did not search`; continue; }
    const chunks = (gm.groundingChunks || []).map((g) => g.web).filter((w) => w && w.uri).slice(0, MAX_SOURCES + 4);
    const urls = await Promise.all(chunks.map((w) => resolveRedirect(w.uri)));
    return { engine: `gemini ${model}`, usd: 0, queries: gm.webSearchQueries, found: chunks.map((w, i) => ({ url: urls[i], title: w.title || w.domain || '' })).filter((x) => x.url) };
  }
  throw new Error(lastErr.replace(/^ \| /, '') || 'Gemini not set up');
}

/* ------------------------------------------------------------ search: Claude web search (paid) as the backup */
const CPRICE = { 'claude-haiku-5-5': [0.10, 0.50], 'claude-sonnet-5-5': [2, 10] };
async function searchClaude(env, probes) {
  let lastErr = '';
  const tries = [
    ['claude-haiku-5-5', { type: 'web_search_20250305', name: 'web_search', max_uses: probes.length }, { type: 'disabled' }],
    ['claude-sonnet-5-5', { type: 'web_search_20260209', name: 'web_search', max_uses: probes.length }, { type: 'between_tools' }],
  ];
  for (const [model, tool, think] of tries) {
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: 1200, tools: [tool], thinking: think, output_config: { effort: 'low' },
          messages: [{ role: 'user', content: `You help a plagiarism checker. For EACH numbered passage below, run one web search whose query is the passage inside double quotes. Do not answer anything else; after the searches reply DONE.\n\n${probes.map((p, i) => `${i + 1}. "${p}"`).join('\n')}` }],
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (e) { lastErr += ` | ${model}: ${e.name === 'TimeoutError' ? 'too slow' : e.message}`; continue; }
    if (!r.ok) { lastErr += ` | ${model}: ${r.status} ${(await r.text()).replace(/\s+/g, ' ').slice(0, 140)}`; continue; }
    const dd = await r.json();
    const u = dd.usage || {}, p = CPRICE[model];
    const usd = ((u.input_tokens || 0) * p[0] + (u.output_tokens || 0) * p[1]) / 1e6 + (u.server_tool_use?.web_search_requests || 0) * 0.01;
    const found = [];
    for (const b of dd.content || []) {
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const x of b.content) if (x.url) found.push({ url: x.url, title: x.title || '' });
    }
    return { engine: `claude ${model}`, usd, queries: probes, found };
  }
  throw new Error(lastErr.replace(/^ \| /, '') || 'Claude search not set up');
}

/* ------------------------------------------------------------ handlers */
export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('Origin')) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Something went wrong. Please try again.' }, 400, origin); }
  const user = await who(request, env);
  if (!user) return json({ error: 'Please sign in with Google to check plagiarism.', signin: true }, 401, origin);
  let d;
  try { d = await table(env); } catch { return json({ error: 'Busy right now. Please try again in a minute.' }, 503, origin); }

  if (b.report) {   // the browser's counted result for a check this account ran
    const per = Array.isArray(b.per) ? b.per.slice(0, MAX_SOURCES) : [];
    const row = await within(d.prepare('SELECT uid, sources FROM plag_log WHERE id = ?').bind(+b.report).first(), 4000).catch(() => null);
    if (!row || (row.uid !== user.uid && !isAdmin(user))) return json({ error: 'not found' }, 404, origin);
    let src = [];
    try { src = JSON.parse(row.sources || '[]'); } catch {}
    for (const x of per) if (src[x.i]) Object.assign(src[x.i], { pct: +x.pct || 0, after: x.after == null ? null : +x.after, open: !!x.open });
    const pct = Number.isFinite(+b.pct) ? +b.pct : null, after = b.after_pct == null || !Number.isFinite(+b.after_pct) ? null : +b.after_pct;
    await within(d.prepare('UPDATE plag_log SET pct = COALESCE(?, pct), after_pct = COALESCE(?, after_pct), sources = ? WHERE id = ?').bind(pct, after, JSON.stringify(src), +b.report).run(), 4000).catch(() => {});
    return json({ ok: true }, 200, origin);
  }

  const text = String(b.text || '').replace(/\r\n/g, '\n').trim();
  const n = words(text);
  if (n < 15) return json({ error: 'Please paste at least two or three full sentences to check.' }, 400, origin);
  if (n > 2000) return json({ error: 'Please check up to 2,000 words at a time.' }, 400, origin);
  const probes = pickProbes(text);
  if (!probes.length) return json({ error: 'Please paste full sentences (8 words or more) to check.' }, 400, origin);
  const perUser = +(env.PLAG_PER_USER || 10);
  const lim = await limits(d, request, user, 'pc', isAdmin(user) ? 1e6 : perUser, isAdmin(user) ? 1e6 : +(env.PLAG_PER_IP || 30));
  if (!lim.ok) return json({ error: `You have used all ${perUser} plagiarism checks for today. Please come back tomorrow.`, left: 0 }, 429, origin);

  const t0 = Date.now();
  let res = null, errs = [];
  if (env.GEMINI_API_KEY) { try { res = await searchGemini(env, d, probes); } catch (e) { errs.push('Gemini: ' + e.message); } }
  if (!res && env.ANTHROPIC_API_KEY) {
    if (await overCaps(env, d)) errs.push('Claude: spend cap reached');
    else { try { res = await searchClaude(env, probes); } catch (e) { errs.push('Claude: ' + e.message); } }
  }
  const country = request.cf?.country || '';
  const base = [new Date().toISOString(), istDate(), user.uid, user.email || '', user.name || '', country, n, JSON.stringify(probes)];
  if (!res) {
    await within(d.prepare('INSERT INTO plag_log (created, day, uid, email, name, country, words, probes, engine, sources, usd, ms, status, text_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)')
      .bind(...base, '', '[]', Date.now() - t0, 'error: ' + errs.join(' || ').slice(0, 400), text.slice(0, 20000)).run(), 5000).catch(() => {});
    return json({ error: 'The web search is busy right now. Please try again in a minute.' }, 502, origin);
  }
  const seen = new Set(), sources = [];
  for (const f of res.found) {
    const url = cleanUrl(f.url);
    if (!url || /street-ka-dalal\.pages\.dev/.test(url)) continue;
    const key = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key); sources.push({ url, title: String(f.title || '').slice(0, 200) });
    if (sources.length >= MAX_SOURCES) break;
  }
  const ins = await within(d.prepare('INSERT INTO plag_log (created, day, uid, email, name, country, words, probes, engine, sources, usd, ms, status, text_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(...base, res.engine, JSON.stringify(sources), res.usd, Date.now() - t0, 'ok', text.slice(0, 20000)).run(), 5000).catch((e) => { console.warn('plag log', e.message); return null; });
  await Promise.all([res.usd ? addSpend(d, res.usd) : null, lim.bump(), person(d, user, country, 'check')]);
  return json({ id: ins?.meta?.last_row_id || null, probes, sources: sources.map((s, i) => ({ i, ...s })), engine: res.engine.split(' ')[0], left: Math.max(0, lim.left - 1) }, 200, origin);
}

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get('Origin');
  const q = new URL(request.url).searchParams;
  const user = await who(request, env);
  if (!user) return json({ error: 'Please sign in.' }, 401, origin);
  let d;
  try { d = await table(env); } catch (e) { return json({ error: e.message }, 503, origin); }

  // one found page, for the browser to compare (only pages found for this account's own check)
  if (q.get('id') && q.get('i') != null && !q.has('full')) {
    const row = await within(d.prepare('SELECT uid, sources FROM plag_log WHERE id = ?').bind(+q.get('id')).first(), 4000).catch(() => null);
    if (!row || (row.uid !== user.uid && !isAdmin(user))) return json({ error: 'not found' }, 404, origin);
    let src = [];
    try { src = JSON.parse(row.sources || '[]'); } catch {}
    const s = src[+q.get('i')];
    if (!s) return json({ error: 'not found' }, 404, origin);
    let r;
    try { r = await fetch(s.url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,text/plain;q=0.9,*/*;q=0.5', 'Accept-Language': 'en-IN,en;q=0.9' }, redirect: 'follow', cf: { cacheTtl: 3600 }, signal: AbortSignal.timeout(10000) }); }
    catch (e) { return json({ error: 'could not open the page' }, 502, origin); }
    const ct = r.headers.get('content-type') || '';
    if (!r.ok) return json({ error: `the page answered ${r.status}` }, 502, origin);
    if (!/text\/html|text\/plain|xml/i.test(ct)) { r.body?.cancel(); return json({ error: /pdf/i.test(ct) ? 'PDF file (not read)' : 'not a web page' }, 415, origin); }
    // pass the page through without reading it here (no CPU spent), at most 1.5 MB, never rendered (plain text + sandbox)
    let seenBytes = 0;
    const cap = new TransformStream({ transform(chunk, ctl) { if (seenBytes < 1500000) { ctl.enqueue(chunk); seenBytes += chunk.byteLength; } } });
    const charset = (ct.match(/charset=([\w-]+)/i) || [])[1] || 'utf-8';
    return new Response(r.body.pipeThrough(cap), { status: 200, headers: { 'Content-Type': `text/plain; charset=${charset}`, 'Content-Security-Policy': 'sandbox', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'X-Final-Url': r.url, ...cors(origin) } });
  }

  if (!isAdmin(user)) return json({ error: 'admin only' }, 401, origin);
  try {
    if (q.get('id')) {
      const row = await within(d.prepare('SELECT * FROM plag_log WHERE id = ?').bind(+q.get('id')).first(), 5000);
      return json({ row }, row ? 200 : 404, origin);
    }
    const days = Math.max(0, +(q.get('days') || 0)), limit = Math.min(500, Math.max(1, +(q.get('limit') || 200)));
    const term = String(q.get('q') || '').trim().slice(0, 100);
    const where = [], args = [];
    if (days) { where.push('created > ?'); args.push(new Date(Date.now() - days * 86400000).toISOString()); }
    if (term) { where.push('(text_in LIKE ? OR email LIKE ? OR name LIKE ?)'); args.push(`%${term}%`, `%${term}%`, `%${term}%`); }
    const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [rows, tot] = await Promise.all([
      within(d.prepare(`SELECT id, created, email, name, country, words, engine, pct, after_pct, usd, ms, status, sources, substr(text_in, 1, 220) AS preview FROM plag_log ${W} ORDER BY id DESC LIMIT ?`).bind(...args, limit).all(), 6000),
      within(d.prepare(`SELECT COUNT(*) AS n, COUNT(DISTINCT email) AS people, AVG(pct) AS avg_pct, SUM(usd) AS usd FROM plag_log ${W}`).bind(...args).first(), 6000),
    ]);
    return json({ rows: rows.results || [], totals: tot || {} }, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 503, origin);
  }
}

export async function onRequestDelete({ request, env }) {
  const origin = request.headers.get('Origin');
  const user = await who(request, env);
  if (!isAdmin(user)) return json({ error: 'admin only' }, 401, origin);
  const id = +new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'no id' }, 400, origin);
  try {
    const d = await table(env);
    await within(d.prepare('DELETE FROM plag_log WHERE id = ?').bind(id).run(), 5000);
    return json({ ok: true }, 200, origin);
  } catch (e) { return json({ error: e.message }, 503, origin); }
}
