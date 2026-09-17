/* ============================================================
   Fuji Trip — store.js
   Global State + Subscription (pub-sub แบบเบา)
   ============================================================ */

import { lsGet, lsSet } from './utils.js';

export const state = {
  ready: false,            // boot ระบบเสร็จแล้ว
  mode: 'demo',            // 'firebase' | 'demo'
  user: null,              // Firebase user (ผู้ดูแล/anonymous)
  role: null,              // 'admin' | 'member' | null
  session: null,           // { kind: 'admin'|'member', tripId?, name?, email? }
  trips: [],               // รายการทริป (ผู้ดูแล)
  trip: null,              // ทริปปัจจุบันที่เปิดอยู่
  members: [],             // สมาชิกของทริปปัจจุบัน
  itinerary: [],           // แผนการเดินทางของทริปปัจจุบัน
  expenses: [],            // ค่าใช้จ่ายของทริปปัจจุบัน
  settlements: [],         // สถานะการเคลียร์ยอดของทริปปัจจุบัน
  route: { path: '#/trips', params: {} },
  appSettings: {
    theme: 'system',       // 'system' | 'light' | 'dark'
    snow: true,            // เอฟเฟกต์หิมะ
    fxDefault: 0.22,       // อัตรา JPY → THB เริ่มต้น
    feePct: 0,             // ค่าธรรมเนียมแปลงสกุล (%)
    cards: { overview: true, today: true, recent: true, fx: true } // การ์ดที่แสดงบนภาพรวม
  }
};

const subs = new Map(); // key → Set<fn>

/** ติดตามการเปลี่ยนแปลง state ตาม key (หรือ '*' ทุก key) — คืนฟังก์ชันยกเลิก */
export function subscribe(keys, fn) {
  const list = Array.isArray(keys) ? keys : [keys];
  const wrapper = () => fn(state);
  for (const k of list) {
    if (!subs.has(k)) subs.set(k, new Set());
    subs.get(k).add(wrapper);
  }
  return () => list.forEach((k) => subs.get(k)?.delete(wrapper));
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const k of Object.keys(patch)) subs.get(k)?.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  subs.get('*')?.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

export function loadAppSettings() {
  const saved = lsGet('app-settings', null);
  if (saved) {
    state.appSettings = {
      ...state.appSettings,
      ...saved,
      cards: { ...state.appSettings.cards, ...(saved.cards || {}) }
    };
  }
  return state.appSettings;
}

export function saveAppSettings() {
  lsSet('app-settings', state.appSettings);
}
