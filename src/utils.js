/* ============================================================
   Fuji Trip — utils.js
   DOM, วัน-เวลา (timezone ญี่ปุ่น), สกุลเงิน, validation, CSV,
   crypto, localStorage — รวมทุก utility ตามหมวดในไฟล์เดียว
   ============================================================ */

// ---------- DOM ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') node.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'required' || k === 'multiple') node[k] = !!v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  appendKids(node, children);
  return node;
}

function appendKids(node, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/** SVG ฟูจิคุณจาก sprite (ข้อ 38 — ใช้ <use> กับไฟล์เดียว) */
export function fuji(stateName = 'idle', cls = '') {
  const svg = svgEl('svg', { class: `fuji ${cls}`.trim(), 'aria-hidden': 'true' });
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  svg.append(svgEl('use', { href: `${base.endsWith('/') ? base : base + '/'}fuji-mascot.svg#fuji-${stateName}` }));
  return svg;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- ตัวเลข & สกุลเงิน ----------
export const yen = (n) => Math.round(Number(n) || 0);

export function fmtMoney(v, cur = 'JPY') {
  return new Intl.NumberFormat(cur === 'JPY' ? 'ja-JP' : 'th-TH', {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: cur === 'JPY' ? 0 : 2
  }).format(Number(v) || 0);
}
export const fmtJPY = (n) => fmtMoney(n, 'JPY');
export const fmtTHB = (n) => fmtMoney(n, 'THB');

/** parse ตัวเลขจาก input อย่างปลอดภัย */
export function num(v, d = 0) {
  const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '').trim()) : Number(v);
  return Number.isFinite(n) ? n : d;
}

// ---------- วันที่ (ISO 'YYYY-MM-DD' แบบเวลาท้องถิ่น) ----------
export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** วันนี้ตามเวลาญี่ปุ่น (ปรับตาม timezone ปลายทาง) */
export function todayISO(tz = 'Asia/Tokyo') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return toISO(new Date());
  }
}

export function eachDayISO(startISO, endISO) {
  const out = [];
  if (!startISO || !endISO || startISO > endISO) return out;
  let cur = startISO;
  let guard = 0;
  while (cur <= endISO && guard < 400) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
    guard++;
  }
  return out;
}

export function fmtDateTH(iso, opts) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('th-TH', opts || { day: 'numeric', month: 'short' }).format(parseISO(iso));
  } catch {
    return iso;
  }
}

export const fmtDateFullTH = (iso) => fmtDateTH(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** วันที่เท่าไรของทริป (เริ่มนับ 1) */
export function dayNum(iso, startISO) {
  return Math.floor((parseISO(iso) - parseISO(startISO)) / 86400000) + 1;
}

export function daysUntil(iso, fromISO = todayISO()) {
  return Math.ceil((parseISO(iso) - parseISO(fromISO)) / 86400000);
}

// ---------- เวลาในวัน (HH:MM ↔ นาที) ----------
export function hmToMin(hm) {
  if (!hm || !hm.includes(':')) return null;
  const [h, m] = hm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function minToHM(min) {
  const m = ((Number(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** เวลาสิ้นสุดกิจกรรม เช่น endTimeHM('09:00', 90) → '10:30' */
export function endTimeHM(startHM, durationMin) {
  const s = hmToMin(startHM);
  if (s == null) return null;
  return minToHM(s + (Number(durationMin) || 0));
}

// ---------- ระยะทาง ----------
const EARTH_KM = 6371;
export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) return null;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

// ---------- Crypto / ID ----------
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function uid() {
  try {
    if (crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fallback ด้านล่าง */ }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- CSV ----------
export function toCSV(rows) {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = cell == null ? '' : String(cell);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\r\n');
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const src = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

// ---------- ดาวน์โหลด ----------
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadText(filename, text, mime = 'text/plain') {
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }));
}

// ---------- localStorage (มี namespace) ----------
const NS = 'jpn.';
export function lsGet(key, dflt = null) {
  try {
    const v = localStorage.getItem(NS + key);
    return v == null ? dflt : JSON.parse(v);
  } catch {
    return dflt;
  }
}
export function lsSet(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch { /* storage เต็ม — ข้าม */ }
}
export function lsDel(key) {
  try {
    localStorage.removeItem(NS + key);
  } catch { /* ข้าม */ }
}

// ---------- รวมข้อมูล ----------
export const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function groupBy(arr, fn) {
  const map = {};
  for (const x of arr) {
    const k = fn(x);
    if (!map[k]) map[k] = [];
    map[k].push(x);
  }
  return map;
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
