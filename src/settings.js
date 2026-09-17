/* ============================================================
   Fuji Trip — settings.js
   Theme, Snow, Exchange Rate, Cards และ Categories
   (หน้าตั้งค่าแอป + หน้าตั้งค่าทริป)
   ============================================================ */

import { state, setState, saveAppSettings } from './store.js';
import { api, FB_MODE, firebaseStatus } from './firebase-client.js';
import { el, uid, num } from './utils.js';
import { resetDemoData } from './demo-backend.js';
import { topbar, field, textInput, segmented, switchToggle, sectionTitle, refreshIcons, icon } from './components.js';
import { toast, confirmDialog } from './notifications.js';
import { logout } from './auth.js';

export const DEFAULT_CATEGORIES = [
  { id: 'food', emoji: '🍜', label: 'อาหาร' },
  { id: 'transport', emoji: '🚃', label: 'เดินทาง' },
  { id: 'sight', emoji: '⛩️', label: 'เที่ยว' },
  { id: 'ticket', emoji: '🎫', label: 'บัตร' },
  { id: 'hotel', emoji: '🏨', label: 'ที่พัก' },
  { id: 'shopping', emoji: '🛍️', label: 'ช้อปปิ้ง' },
  { id: 'other', emoji: '✨', label: 'อื่น ๆ' }
];

export function tripCategories(trip) {
  const cats = trip?.settings?.categories;
  return Array.isArray(cats) && cats.length ? cats : DEFAULT_CATEGORIES;
}

export function categoryMeta(trip, id) {
  return tripCategories(trip).find((c) => c.id === id) || { id: 'other', emoji: '✨', label: 'อื่น ๆ' };
}

/** อัตราแลกเปลี่ยน + ค่าธรรมเนียมของทริป (fallback เป็นค่าเริ่มต้นของแอป) */
export function tripFx(trip) {
  const app = state.appSettings;
  const ts = trip?.settings || {};
  return {
    rate: Number(ts.fxRate ?? app.fxDefault) || 0,
    feePct: Number(ts.feePct ?? app.feePct) || 0
  };
}

// ---------- ธีม / หิมะ (เรียกจาก app.js) ----------
export function applyTheme(theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function applySnow(on) {
  const layer = document.getElementById('snow-layer');
  if (!layer) return;
  if (!on) {
    layer.replaceChildren();
    return;
  }
  if (layer.childElementCount > 0) return;
  for (let i = 0; i < 36; i++) {
    const f = el('i', { class: 'snowflake' });
    f.style.setProperty('--s', `${(3 + Math.random() * 5).toFixed(1)}px`);
    f.style.setProperty('--x', `${(Math.random() * 100).toFixed(1)}%`);
    f.style.setProperty('--d', `${(7 + Math.random() * 8).toFixed(1)}s`);
    f.style.setProperty('--delay', `${(-Math.random() * 12).toFixed(1)}s`);
    f.style.setProperty('--drift', `${(Math.random() * 10 - 5).toFixed(1)}vw`);
    f.style.setProperty('--o', `${(0.35 + Math.random() * 0.5).toFixed(2)}`);
    layer.append(f);
  }
}

/** ดึงอัตรา JPY→THB จริงจาก Frankfurter (ไม่ต้องใช้ API key) */
export async function fetchFxRate() {
  const urls = [
    'https://api.frankfurter.dev/v1/latest?base=JPY&symbols=THB',
    'https://api.frankfurter.app/latest?from=JPY&to=THB'
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      const json = await res.json();
      const rate = json?.rates?.THB;
      if (Number(rate) > 0) return Math.round(rate * 10000) / 10000;
    } catch { /* ลอง URL ถัดไป */ }
  }
  return null;
}

// ============================================================
// หน้าตั้งค่าแอป (#/settings)
// ============================================================
export function renderAppSettingsView(root) {
  const s = state.appSettings;
  const status = firebaseStatus();

  const fxInput = textInput({ type: 'number', step: '0.0001', min: '0', value: String(s.fxDefault), inputmode: 'decimal' });
  const feeInput = textInput({ type: 'number', step: '0.1', min: '0', max: '20', value: String(s.feePct), inputmode: 'decimal' });

  const saveDefaults = () => {
    setState({ appSettings: { ...state.appSettings, fxDefault: num(fxInput.value, 0.22), feePct: num(feeInput.value, 0) } });
    saveAppSettings();
  };

  const card = el('div', { class: 'card' },
    sectionTitle('ธีมและฉาก'),
    el('div', { class: 'setting-row' },
      el('div', { class: 'setting-row__icon' }, icon('palette')),
      el('div', { class: 'setting-row__main' },
        el('div', { class: 'switch-row__label' }, 'ธีม'),
        segmented({
          options: [{ value: 'system', label: 'ระบบ' }, { value: 'light', label: 'สว่าง' }, { value: 'dark', label: 'มืด' }],
          value: s.theme,
          onChange: (v) => {
            setState({ appSettings: { ...state.appSettings, theme: v } });
            saveAppSettings();
            applyTheme(v);
          }
        })
      )
    ),
    (() => {
      const sw = switchToggle({
        label: 'หิมะปลอม ๆ ❄️',
        sub: 'เอฟเฟกต์หิมะตกทั่วหน้า (ปิดได้เมื่อเบื่อ)',
        checked: s.snow,
        onChange: (v) => {
          setState({ appSettings: { ...state.appSettings, snow: v } });
          saveAppSettings();
          applySnow(v);
        }
      });
      return sw;
    })()
  );

  const fxCards = el('div', { class: 'card mt-16' },
    sectionTitle('ค่าเริ่มต้นสำหรับทริปใหม่'),
    field('อัตราแลกเปลี่ยน 1 เยน = ? บาท', el('div', { class: 'row' },
      fxInput,
      el('button', {
        class: 'btn btn--ghost', type: 'button',
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          toast('กำลังดึงอัตราแลกเปลี่ยน...', 'info', { timeout: 1800 });
          const rate = await fetchFxRate();
          btn.disabled = false;
          if (rate) {
            fxInput.value = String(rate);
            saveDefaults();
            toast(`อัตราล่าสุด 1 ¥ = ${rate} บาท`, 'success');
          } else {
            toast('ดึงอัตราไม่สำเร็จ ลองกรอกเองหรือใช้อินเทอร์เน็ตต่างเครือข่าย', 'warn');
          }
        }
      }, 'ดึงอัตราวันนี้')
    ), 'ดึงจากธนาคารกลางยุโรป (Frankfurter) อัตโนมัติ'),
    field('ค่าธรรมเนียมบัตร/แปลงสกุล (%)', feeInput, 'ใช้คำนวณยอดบาทโดยประมาณ'),
    el('button', { class: 'btn btn--accent btn--sm', onclick: () => { saveDefaults(); toast('บันทึกค่าเริ่มต้นแล้ว', 'success'); } }, 'บันทึกค่าเริ่มต้น')
  );

  const sysCard = el('div', { class: 'card mt-16' },
    sectionTitle('ระบบ'),
    el('div', { class: 'setting-row' },
      el('div', { class: 'setting-row__icon' }, icon('database')),
      el('div', { class: 'setting-row__main' },
        el('div', { class: 'switch-row__label' }, 'Backend'),
        el('div', { class: 'muted' },
          FB_MODE === 'firebase'
            ? `Firebase · project: ${FB_CONFIG_PROJECT() || '-'}`
            : 'โหมดตัวอย่าง (localStorage) — ตั้งค่า .env ตาม README เพื่อใช้ Firebase'
        ),
        status.ok ? null : el('div', { class: 'error-text' }, `ขาดค่า: ${status.missing.join(', ')}`)
      )
    ),
    FB_MODE === 'demo'
      ? el('button', {
          class: 'btn btn--danger btn--sm',
          onclick: async () => {
            if (await confirmDialog({ title: 'รีเซ็ตข้อมูลตัวอย่าง?', message: 'ทริป/ค่าใช้จ่ายจำลองทั้งหมดจะกลับไปเป็นค่าเริ่มต้น', danger: true })) {
              await resetDemoData();
              toast('รีเซ็ตข้อมูลตัวอย่างแล้ว', 'success');
              location.reload();
            }
          }
        }, 'รีเซ็ตข้อมูลตัวอย่าง')
      : null,
    el('button', { class: 'btn btn--ghost btn--sm mt-8', onclick: () => logout().then(() => (location.hash = '#/login')) }, 'ออกจากระบบ')
  );

  root.append(
    topbar({ title: 'ตั้งค่า', back: true }),
    el('div', { class: 'content' }, card, fxCards, sysCard)
  );
  refreshIcons();
}

function FB_CONFIG_PROJECT() {
  try {
    return state.user ? 'connected' : '';
  } catch {
    return '';
  }
}

// ============================================================
// หน้าตั้งค่าทริป (#/trip/:id/settings)
// ============================================================
export function renderTripSettingsView(root, params) {
  const tripId = params.id;

  const fxInput = textInput({ type: 'number', step: '0.0001', min: '0', inputmode: 'decimal' });
  const feeInput = textInput({ type: 'number', step: '0.1', min: '0', max: '20', inputmode: 'decimal' });
  const catList = el('div');
  const cards = { overview: true, today: true, recent: true, fx: true };

  const renderCats = () => {
    catList.replaceChildren();
    const current = draft.categories?.length ? draft.categories : DEFAULT_CATEGORIES;
    current.forEach((c, idx) => {
      const emojiInp = textInput({ value: c.emoji || '✨', maxlength: '4', style: 'width:64px; text-align:center' });
      const labelInp = textInput({ value: c.label || '', maxlength: '24', placeholder: 'ชื่อหมวด' });
      emojiInp.addEventListener('input', () => { draft.categories[idx].emoji = emojiInp.value; });
      labelInp.addEventListener('input', () => { draft.categories[idx].label = labelInp.value; });
      catList.append(el('div', { class: 'cat-row' },
        emojiInp,
        labelInp,
        el('button', {
          class: 'icon-btn icon-btn--danger', type: 'button', 'aria-label': 'ลบหมวด',
          onclick: () => { draft.categories.splice(idx, 1); renderCats(); }
        }, icon('trash-2'))
      ));
    });
  };

  const draft = { fxRate: null, feePct: null, categories: null, cards: { ...cards } };

  const fill = (trip) => {
    if (!trip) return;
    const t = trip.settings || {};
    draft.fxRate = Number(t.fxRate ?? state.appSettings.fxDefault);
    draft.feePct = Number(t.feePct ?? state.appSettings.feePct);
    draft.categories = (t.categories?.length ? t.categories : DEFAULT_CATEGORIES).map((c) => ({ ...c }));
    draft.cards = { ...cards, ...(t.cards || {}) };
    fxInput.value = String(draft.fxRate);
    feeInput.value = String(draft.feePct);
    renderCats();
  };
  fill(state.trip);

  const save = async () => {
    try {
      await api.updateTrip(tripId, {
        settings: {
          ...(state.trip?.settings || {}),
          fxRate: num(fxInput.value, 0.22),
          feePct: num(feeInput.value, 0),
          categories: draft.categories.filter((c) => c.label?.trim()),
          cards: draft.cards
        }
      });
      toast('บันทึกการตั้งค่าทริปแล้ว', 'success');
    } catch (e) {
      toast(e?.code === 'permission-denied' ? 'เฉพาะผู้ดูแลที่แก้ตั้งค่าทริปได้' : 'บันทึกไม่สำเร็จ', 'error');
    }
  };

  root.append(
    topbar({ title: 'ตั้งค่าทริป', back: true }),
    el('div', { class: 'content' },
      el('div', { class: 'card' },
        sectionTitle('เงินและอัตราแลกเปลี่ยน'),
        field('อัตรา 1 เยน = ? บาท', el('div', { class: 'row' },
          fxInput,
          el('button', {
            class: 'btn btn--ghost', type: 'button',
            onclick: async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              const rate = await fetchFxRate();
              btn.disabled = false;
              if (rate) { fxInput.value = String(rate); toast(`ได้อัตราล่าสุด ${rate} บาท/เยน`, 'success'); }
              else toast('ดึงอัตราไม่สำเร็จ', 'warn');
            }
          }, 'ดึงอัตราวันนี้')
        )),
        field('ค่าธรรมเนียมบัตร/แปลงสกุล (%)', feeInput)
      ),
      el('div', { class: 'card mt-16' },
        sectionTitle('การ์ดบนหน้าภาพรวม'),
        ['overview', 'today', 'recent', 'fx'].map((key) => {
          const labels = { overview: 'การ์ดสรุปยอด', today: 'การ์ดแผนวันนี้', recent: 'รายการค่าใช้จ่ายล่าสุด', fx: 'การ์ดอัตราแลกเปลี่ยน' };
          const sw = switchToggle({ label: labels[key], checked: draft.cards[key], onChange: (v) => { draft.cards[key] = v; } });
          sw.querySelector('input').addEventListener('change', (e) => { draft.cards[key] = e.target.checked; });
          return sw;
        })
      ),
      el('div', { class: 'card mt-16' },
        sectionTitle('หมวดค่าใช้จ่าย'),
        catList,
        el('button', {
          class: 'btn btn--ghost btn--sm',
          onclick: () => { draft.categories.push({ id: `c-${uid().slice(0, 6)}`, emoji: '✨', label: '' }); renderCats(); }
        }, '+ เพิ่มหมวด')
      ),
      el('button', { class: 'btn btn--accent btn--block mt-16', onclick: save }, 'บันทึกการตั้งค่าทริป')
    )
  );
  refreshIcons();
  return () => {};
}
