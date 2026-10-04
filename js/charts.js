// Charts for Street ka Dalal.
//   Time series (indices, breadth, FII/DII running totals): TradingView Lightweight Charts (free, Apache-2.0),
//   loaded from a CDN only when a page shows a chart.
//   Monthly / categorical bars (mutual funds, daily FII/DII): small hand-made SVG, no library.
const LW_URL = 'https://unpkg.com/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js';
let lwP = null;
export function lw() {
  if (window.LightweightCharts) return Promise.resolve(window.LightweightCharts);
  return (lwP ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = LW_URL;
    s.async = true;
    s.onload = () => res(window.LightweightCharts);
    s.onerror = () => { lwP = null; rej(new Error('chart library did not load')); };
    document.head.append(s);
  }));
}

const live = new Set();
export function disposeCharts() { live.forEach((c) => { try { c.remove(); } catch {} }); live.clear(); }

export const C = {
  green: '#1f4d3a', green2: '#2f6b4f', gold: '#b08d57', up: '#23794f', down: '#b4442f', blue: '#2c5a8a',
  muted: '#6c786f', line: 'rgba(110, 100, 80, 0.13)', sage: '#9cb89a', plum: '#7a4f86',
};
export const PALETTE = [C.green2, C.gold, C.blue, C.down, C.plum, C.sage, '#c27c3a', '#4f8a8b'];

const inr = (v, d = 0) => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));
// ₹ crore in short Indian form: 135703 -> "1.36 L cr", 9484 -> "9,484 cr"
export const crShort = (v) => (v == null || isNaN(v) ? '—' : Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(2)} L cr` : `${inr(v)} cr`);

/**
 * Time-series chart.
 * series: [{ name, type: 'area'|'line'|'hist', color, data: [{time:'YYYY-MM-DD', value}], scale: 'right'|'left', dashed, fmt }]
 * opts: { height, percent (axis in %), legend: element for the hover read-out }
 */
export async function timeChart(el, series, opts = {}) {
  if (!el) return null;
  let L;
  try { L = await lw(); } catch (e) { el.innerHTML = `<div class="chart-err">Chart could not load (${e.message}). Check your internet and refresh.</div>`; return null; }
  if (!el.isConnected) return null;
  el.innerHTML = '';
  const fmtAxis = opts.percent ? (v) => `${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}%` : (v) => inr(v, Math.abs(v) < 100 ? 1 : 0);
  const ch = L.createChart(el, {
    autoSize: true,
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: C.muted, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { color: C.line } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
    leftPriceScale: { visible: series.some((s) => s.scale === 'left'), borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
    timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
    crosshair: { mode: 0, vertLine: { color: C.gold, labelBackgroundColor: C.green }, horzLine: { color: C.gold, labelBackgroundColor: C.green } },
    localization: { locale: 'en-IN' },
    handleScroll: { vertTouchDrag: false }, handleScale: { axisPressedMouseMove: false },
  });
  live.add(ch);
  const made = series.map((s) => {
    // each line formats its own scale: % for breadth, plain numbers for an index on the other side
    const axis = s.axis || (s.scale === 'left' ? (v) => inr(v, 0) : fmtAxis);
    const common = { priceScaleId: s.scale || 'right', lastValueVisible: s.lastValue !== false, priceLineVisible: false, priceFormat: { type: 'custom', formatter: axis, minMove: 0.01 } };
    let x;
    if (s.type === 'hist') x = ch.addHistogramSeries({ ...common, color: s.color || C.green2, base: 0 });
    else if (s.type === 'area') x = ch.addAreaSeries({ ...common, lineColor: s.color || C.green2, lineWidth: 2, topColor: (s.color || C.green2) + '40', bottomColor: (s.color || C.green2) + '05' });
    else x = ch.addLineSeries({ ...common, color: s.color || C.green2, lineWidth: s.width || 2, lineStyle: s.dashed ? 2 : 0 });
    x.setData((s.data || []).filter((p) => p && p.value != null && !isNaN(p.value)));
    return x;
  });
  ch.timeScale().fitContent();
  if (opts.legend) {
    const leg = opts.legend;
    const base = leg.innerHTML;
    ch.subscribeCrosshairMove((p) => {
      if (!p || !p.time || !p.seriesData) { leg.innerHTML = base; return; }
      const parts = series.map((s, i) => {
        const v = p.seriesData.get(made[i]);
        if (!v || v.value == null) return '';
        return `<span><i style="background:${s.color || C.green2}"></i>${s.name}: <b>${(s.fmt || s.axis || fmtAxis)(v.value)}</b></span>`;
      }).join('');
      leg.innerHTML = `<span class="lg-date">${fmtDate(p.time)}</span>${parts}`;
    });
  }
  return ch;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(t) {
  const s = typeof t === 'string' ? t : t && t.year ? `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}` : '';
  const [y, m, d] = s.split('-').map(Number);
  return y ? `${d} ${MON[m - 1]} ${y}` : '';
}

// SVG drawing width follows the screen, so labels stay readable on phones (text is not stretched)
const vbWidth = () => Math.round(Math.min(900, Math.max(320, (window.innerWidth || 800) - 70)));
const xe = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Vertical bars per label (months). series: [{ name, values, color }].
 * stacked: stack the series; otherwise grouped. Totals print above each column when stacked.
 */
export function barChart({ labels, series, stacked = true, height = 220, fmt = crShort, highlight = -1 }) {
  const W = vbWidth(), H = height, top = 22, bottom = 26, left = 6, right = 6;
  const n = labels.length || 1;
  const colW = (W - left - right) / n;
  const sums = labels.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0));
  const max = Math.max(1e-9, ...(stacked ? sums : series.flatMap((s) => s.values.map((v) => v || 0))));
  const sc = (v) => ((H - top - bottom) * Math.max(0, v)) / max;
  let g = '';
  labels.forEach((lab, i) => {
    const x0 = left + i * colW;
    const bw = stacked ? colW * 0.56 : (colW * 0.78) / series.length;
    let y = H - bottom;
    series.forEach((s, k) => {
      const v = s.values[i] || 0, h = sc(v);
      const x = stacked ? x0 + (colW - bw) / 2 : x0 + colW * 0.11 + k * bw;
      const yy = stacked ? y - h : H - bottom - h;
      g += `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw - (stacked ? 0 : 2)).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${s.color}" opacity="${highlight < 0 || highlight === i ? 1 : 0.45}"><title>${xe(lab)} · ${xe(s.name)}: ${xe(fmt(v))}</title></rect>`;
      if (stacked) y -= h;
    });
    if (stacked) g += `<text x="${(x0 + colW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="bc-tot">${xe(fmt(sums[i]))}</text>`;
    g += `<text x="${(x0 + colW / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="bc-lbl">${xe(lab)}</text>`;
  });
  const legend = series.length > 1 ? `<div class="bc-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${xe(s.name)}</span>`).join('')}</div>` : '';
  return `${legend}<svg class="barchart" viewBox="0 0 ${W} ${H}" role="img">${g}<line x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}" class="bc-axis"/></svg>`;
}

/** Bars above / below a zero line (daily FII and DII net). series: [{ name, values, color }]; labels are dates. */
export function divBars({ labels, series, height = 200, fmt = (v) => `${inr(v)} cr` }) {
  const W = vbWidth(), H = height, pad = 10;
  const n = labels.length || 1, colW = (W - 2 * pad) / n;
  const max = Math.max(1e-9, ...series.flatMap((s) => s.values.map((v) => Math.abs(v || 0))));
  const mid = H / 2, sc = (v) => ((H / 2 - pad) * Math.abs(v)) / max;
  let g = '';
  labels.forEach((lab, i) => {
    const bw = (colW * 0.8) / series.length;
    series.forEach((s, k) => {
      const v = s.values[i] || 0, h = sc(v);
      const x = pad + i * colW + colW * 0.1 + k * bw;
      g += `<rect x="${x.toFixed(1)}" y="${(v >= 0 ? mid - h : mid).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${h.toFixed(1)}" fill="${s.color}" opacity="${v >= 0 ? 1 : 0.85}"><title>${xe(fmtDate(lab))} · ${xe(s.name)}: ${xe(fmt(v))}</title></rect>`;
    });
  });
  const first = labels[0], last = labels[labels.length - 1];
  return `<div class="bc-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${xe(s.name)}</span>`).join('')}<span class="bc-range">${xe(fmtDate(first))} – ${xe(fmtDate(last))}</span></div>
  <svg class="barchart" viewBox="0 0 ${W} ${H}" role="img">${g}<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="bc-axis"/><text x="4" y="12" class="bc-lbl" text-anchor="start">bought</text><text x="4" y="${H - 4}" class="bc-lbl" text-anchor="start">sold</text></svg>`;
}

/** Tiny column chart for a table cell (monthly buying). */
export function miniBars(values, w = 84, h = 26) {
  const v = (values || []).map((x) => x || 0);
  if (!v.length) return '';
  const max = Math.max(1e-9, ...v), bw = w / v.length;
  return `<svg class="minibars" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${v.map((x, i) => `<rect x="${(i * bw + 1).toFixed(1)}" y="${(h - (h - 2) * (x / max)).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${((h - 2) * (x / max)).toFixed(1)}" rx="1.5" fill="${x ? (i === v.length - 1 ? C.green : C.sage) : 'transparent'}"/>`).join('')}</svg>`;
}
