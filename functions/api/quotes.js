// Live prices for the site (Sagar 2026-11-23: "show the live prices in skd as well the way we shows in sectorscape").
// SectorScope's live prices come from Sagar's own Upstox login, which must never reach a public site, so the site asks
// this function instead. It reads the free Yahoo Finance spark feed (NSE listings, about a minute behind; checked on
// 23-Nov-2026 11:04 against Upstox: 6 of 6 stocks within 0.05%) and keeps each stock's answer 30 seconds in Cloudflare's
// cache, so a thousand visitors on the same list cost one fetch a stock per half minute.
//
//   GET /api/quotes?s=RELIANCE,TCS,M&M       up to 120 NSE symbols
//   -> { at, q: { RELIANCE: { p, pc, chg, t } } }   p last price, pc previous close, chg % vs previous close,
//                                                    t time of the price (ISO). A symbol with no price is left out.
// The page only shows a price whose time is today (India time), so a holiday or a stale feed never looks live.
const MAX = 120, CHUNK = 20, TTL = 30;
const SYM = /^[A-Z0-9&-]{1,20}$/;
const ysym = (s) => encodeURIComponent(s + '.NS');

function out(body, status = 200, maxAge = 15) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}`, 'access-control-allow-origin': '*' } });
}
const key = (origin, s) => new Request(`${origin}/__q/${encodeURIComponent(s)}`);

async function fetchChunk(syms) {
  const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${syms.map(ysym).join(',')}&range=1d&interval=1m`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (street-ka-dalal live prices)', accept: 'application/json' }, cf: { cacheTtl: 0 } });
  if (!r.ok) throw new Error('feed ' + r.status);
  const d = await r.json();
  const res = {};
  for (const s of syms) {
    const v = d[s + '.NS'];
    if (!v || !Array.isArray(v.close) || !v.close.length) continue;
    let i = v.close.length - 1;
    while (i >= 0 && v.close[i] == null) i--;
    if (i < 0) continue;
    const p = Number(v.close[i]), pc = Number(v.chartPreviousClose ?? v.previousClose);
    const ts = v.timestamp?.[i];
    if (!(p > 0) || !ts) continue;
    res[s] = { p: Math.round(p * 100) / 100, pc: pc > 0 ? pc : null, chg: pc > 0 ? Math.round((p / pc - 1) * 10000) / 100 : null, t: new Date(ts * 1000).toISOString() };
  }
  return res;
}

export async function onRequestGet({ request, waitUntil }) {
  const u = new URL(request.url);
  const syms = [...new Set(String(u.searchParams.get('s') || '').toUpperCase().split(',').map((x) => x.trim()).filter((x) => SYM.test(x)))].slice(0, MAX);
  if (!syms.length) return out({ error: 'give up to 120 NSE symbols as ?s=A,B,C' }, 400, 60);
  const cache = caches.default;
  const q = {}, miss = [];
  await Promise.all(syms.map(async (s) => {
    const hit = await cache.match(key(u.origin, s));
    if (hit) { const v = await hit.json().catch(() => null); if (v) { q[s] = v; return; } }
    miss.push(s);
  }));
  let err = null;
  for (let i = 0; i < miss.length; i += CHUNK) {
    const part = miss.slice(i, i + CHUNK);
    try {
      const got = await fetchChunk(part);
      for (const [s, v] of Object.entries(got)) {
        q[s] = v;
        waitUntil(cache.put(key(u.origin, s), new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${TTL}` } })));
      }
    } catch (e) { err = String(e.message || e).slice(0, 80); }
  }
  return out({ at: new Date().toISOString(), n: Object.keys(q).length, ...(err ? { warn: err } : {}), q });
}
