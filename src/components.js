/* ============================================================
   Fuji Trip — components.js
   Shared UI Components: Modal, Bottom Sheet, Tile, Chip,
   Segmented, Switch, Avatar, FAB, Topbar, Bottom Nav, Empty State
   ============================================================ */

import { el, uid, fuji } from './utils.js';
import { createIcons } from 'lucide';
import {
  X, Plus, Pencil, Trash2, Camera, Download, Upload, Navigation, Search, Check,
  ChevronLeft, ChevronRight, LogOut, UserPlus, Coins, Clock, Wand2, FileJson2,
  FileSpreadsheet, FileText, Image, RefreshCw, Moon, Sun, Snowflake, Info,
  TriangleAlert, ArrowRight, Sparkles, TrainFront, Utensils, BedDouble, Ticket,
  ShoppingBag, Landmark, MountainSnow, Share2, Eye, Timer, ListChecks, Calculator,
  Receipt, ArrowLeftRight, MapPin, ExternalLink, ShieldCheck, Database, Palette,
  KeyRound, Mail, Lock, Users, CalendarDays, Map, Wallet, ChartPie, Settings,
  Copy, Save, CircleAlert
} from 'lucide';

// ---------- Icon (Icon Library เดียว: lucide — ข้อ 35.2) ----------
const ICONS = {
  X, Plus, Pencil, Trash2, Camera, Download, Upload, Navigation, Search, Check,
  ChevronLeft, ChevronRight, LogOut, UserPlus, Coins, Clock, Wand2, FileJson2,
  FileSpreadsheet, FileText, Image, RefreshCw, Moon, Sun, Snowflake, Info,
  TriangleAlert, ArrowRight, Sparkles, TrainFront, Utensils, BedDouble, Ticket,
  ShoppingBag, Landmark, MountainSnow, Share2, Eye, Timer, ListChecks, Calculator,
  Receipt, ArrowLeftRight, MapPin, ExternalLink, ShieldCheck, Database, Palette,
  KeyRound, Mail, Lock, Users, CalendarDays, Map, Wallet, ChartPie, Settings,
  Copy, Save, CircleAlert
};

/** สร้าง <i data-lucide="name"> — ต้องเรียก refreshIcons() หลังใส่ใน DOM */
export function icon(name, cls = '') {
  return el('i', { 'data-lucide': name, class: cls });
}

export function refreshIcons() {
  try {
    createIcons({ icons: ICONS, nameAttr: 'data-lucide' });
  } catch (e) {
    console.warn('refreshIcons:', e);
  }
}

// ---------- Modal / Bottom sheet ----------
export function openModal({ title = '', body, foot = [], wide = false, onClose } = {}) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const panel = el('div', { class: `modal ${wide ? 'modal--wide' : ''}` });
  const closeBtn = el('button', { class: 'icon-btn', 'aria-label': 'ปิด' }, icon('x'));
  const head = el('div', { class: 'modal__head' }, el('div', { class: 'modal__title' }, title), closeBtn);
  const bodyEl = el('div', { class: 'modal__body' });
  if (typeof body === 'function') body(bodyEl);
  else if (body) bodyEl.append(body);
  const footEl = foot.length ? el('div', { class: 'modal__foot' }, ...foot) : null;
  panel.append(head, bodyEl, ...(footEl ? [footEl] : []));
  backdrop.append(panel);

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  closeBtn.onclick = close;
  document.body.append(backdrop);
  refreshIcons();
  return { close, root: bodyEl };
}

// ---------- Tile ----------
export function tile({ emoji, lucide, title, value, sub, tone = '', onClick, end } = {}) {
  const t = el(
    'div',
    {
      class: `tile ${tone ? `tile--${tone}` : ''} ${onClick ? 'tile--click' : ''}`,
      role: onClick ? 'button' : null,
      tabindex: onClick ? '0' : null
    },
    el('div', { class: 'row', style: 'justify-content:space-between' },
      el('div', { class: 'tile__icon' }, emoji || icon(lucide || 'info')),
      end || null
    ),
    value != null ? el('div', { class: 'tile__value' }, value) : null,
    title ? el('div', { class: 'tile__title' }, title) : null,
    sub ? el('div', { class: 'tile__sub' }, sub) : null
  );
  if (onClick) {
    t.onclick = onClick;
    t.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } };
  }
  return t;
}

// ---------- Empty state ----------
export function emptyState({ state = 'idle', title = 'ไม่มีข้อมูล', sub = '', actionLabel, onAction } = {}) {
  return el(
    'div',
    { class: 'empty-state' },
    el('span', { class: `fuji fuji--${state === 'empty' ? 'idle' : state}`, style: 'width:104px;height:104px' }).cloneNode ? fuji(state === 'empty' ? 'idle' : state) : null,
    el('h3', {}, title),
    sub ? el('div', { class: 'muted' }, sub) : null,
    actionLabel && onAction ? el('button', { class: 'btn mt-8', onclick: onAction }, actionLabel) : null
  );
}

// ---------- Form controls ----------
export function field(labelText, control, hint) {
  return el(
    'div',
    { class: 'field' },
    labelText ? el('label', {}, labelText) : null,
    control,
    hint ? el('div', { class: 'hint' }, hint) : null
  );
}

export function textInput({ type = 'text', value = '', placeholder = '', onInput, min, max, step, inputmode, maxlength } = {}) {
  const inp = el('input', { class: 'input', type, value, placeholder, min, max, step, inputmode, maxlength });
  if (onInput) inp.addEventListener('input', () => onInput(inp.value, inp));
  return inp;
}

export function selectInput(options, value, onChange) {
  const sel = el(
    'select',
    { class: 'input' },
    options.map((o) => el('option', { value: o.value, selected: o.value === value }, o.label))
  );
  if (onChange) sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

export function chipGroup({ options, value, onChange, multi = false, dangerActive = false }) {
  const selected = new Set(multi ? (value || []) : [value].filter(Boolean));
  const wrap = el('div', { class: 'chips' });
  const paint = () => {
    wrap.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('active', selected.has(c.dataset.value));
      if (dangerActive) c.classList.toggle('chip--danger', c.classList.contains('active'));
    });
  };
  for (const o of options) {
    const c = el(
      'button',
      { class: 'chip', type: 'button', dataset: { value: String(o.value) } },
      o.emoji ? el('span', {}, o.emoji) : null,
      o.label
    );
    c.onclick = () => {
      if (multi) {
        selected.has(o.value) ? selected.delete(o.value) : selected.add(o.value);
      } else {
        selected.clear();
        selected.add(o.value);
      }
      paint();
      onChange?.(multi ? [...selected] : [...selected][0]);
    };
    wrap.append(c);
  }
  paint();
  return {
    el: wrap,
    get: () => (multi ? [...selected] : [...selected][0]),
    set: (v) => {
      selected.clear();
      (multi ? v || [] : [v].filter(Boolean)).forEach((x) => selected.add(x));
      paint();
    }
  };
}

export function segmented({ options, value, onChange }) {
  const wrap = el('div', { class: 'segmented', role: 'tablist' });
  const paint = () => wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === String(current)));
  let current = value;
  for (const o of options) {
    const b = el('button', { type: 'button', dataset: { value: String(o.value) } }, o.label);
    b.onclick = () => { current = o.value; paint(); onChange?.(o.value); };
    wrap.append(b);
  }
  paint();
  return wrap;
}

export function switchToggle({ label, sub, checked, onChange }) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange?.(input.checked));
  return el(
    'div',
    { class: 'switch-row' },
    el('div', {},
      el('div', { class: 'switch-row__label' }, label),
      sub ? el('div', { class: 'switch-row__sub' }, sub) : null
    ),
    el('label', { class: 'switch' }, input, el('i'))
  );
}

// ---------- Avatar ----------
const AV_COLORS = ['#e9efff', '#fdecec', '#e2f5ea', '#fcf3dc', '#f3e8fd', '#e0f4f9'];
export function avatarEl(member, size = '') {
  const idx = Math.abs([...String(member?.id || member?.name || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0)) % AV_COLORS.length;
  return el(
    'span',
    { class: `avatar ${size}`, style: `--av:${member?.color || AV_COLORS[idx]}`, title: member?.name || '' },
    member?.emoji || '🙂'
  );
}

// ---------- FAB ----------
export function fab({ lucide = 'plus', onClick, label } = {}) {
  const b = el('button', { class: 'fab', 'aria-label': label || 'เพิ่ม' }, icon(lucide));
  b.onclick = onClick;
  return b;
}

// ---------- Topbar ----------
export function topbar({ title, back = false, actions = [] } = {}) {
  return el(
    'div',
    { class: 'topbar' },
    el(
      'div',
      { class: 'topbar__in' },
      back ? el('button', { class: 'icon-btn', 'aria-label': 'ย้อนกลับ', onclick: () => history.back() }, icon('chevron-left')) : null,
      el('div', { class: 'topbar__title' }, title),
      ...actions.map((a) => el('button', { class: 'icon-btn', 'aria-label': a.label || '', title: a.label, onclick: a.onClick }, icon(a.icon)))
    )
  );
}

// ---------- Bottom navigation ----------
export function bottomNav(items) {
  return el(
    'nav',
    { class: 'bottom-nav' },
    el(
      'div',
      { class: 'bottom-nav__in' },
      items.map((it) =>
        el('a', { href: it.href, class: it.active ? 'active' : '' }, icon(it.icon), el('span', {}, it.label))
      )
    )
  );
}

// ---------- Section ----------
export function sectionTitle(text, actionEl) {
  return el('div', { class: 'section-title' }, el('h2', {}, text), actionEl || null);
}

/** ตัวเลขสุ่มสีให้ทริป (สำหรับปกทริป) */
const TONES = [
  ['#7ea6f4', '#4a6fd4'],
  ['#f4a6a6', '#d94343'],
  ['#8fd4b8', '#2f8f6b'],
  ['#f4d48f', '#d99a2b'],
  ['#c9a6f4', '#7a4ad4'],
  ['#f4a6d4', '#d44a8f']
];
export function toneColors(seedStr = '') {
  const idx = Math.abs([...seedStr].reduce((a, c) => a + c.charCodeAt(0), 7)) % TONES.length;
  return TONES[idx];
}

export { uid };
