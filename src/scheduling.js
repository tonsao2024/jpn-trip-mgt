/* ============================================================
   Fuji Trip — scheduling.js
   Smart Scheduling, Duration และ Time Conflict (pure functions)
   ============================================================ */

import { groupBy, sum, haversineKm, hmToMin, minToHM } from './utils.js';

export const CATEGORY_DEFAULT_MIN = { food: 60, sight: 90, transport: 45, shopping: 75, hotel: 30, other: 60 };
export const WALK_KMH = 4.5;
export const TRAIN_KMH = 25;
export const TRAIN_BUFFER_MIN = 10;

export const itemStartMin = (item) => (item?.start ? hmToMin(item.start) : null);

export function itemEndMin(item) {
  const s = itemStartMin(item);
  if (s == null) return null;
  return s + (Number(item?.durationMin) || 0);
}

/** ระยะเวลาที่ใช้จริงของกิจกรรม (fallback ตามหมวด) */
export function effectiveDuration(item) {
  const d = Number(item?.durationMin) || 0;
  if (d > 0) return d;
  return CATEGORY_DEFAULT_MIN[item?.category] || 60;
}

/** หาคู่กิจกรรมที่เวลาทับซ้อนกันในวันเดียวกัน (เฉพาะกิจกรรมที่มีเวลา) */
export function findConflicts(items) {
  const conflicts = [];
  const timed = (items || []).filter((it) => it.date && itemStartMin(it) != null);
  const byDate = groupBy(timed, (it) => it.date);
  for (const [date, list] of Object.entries(byDate)) {
    const sorted = [...list].sort((a, b) => itemStartMin(a) - itemStartMin(b));
    for (let i = 0; i < sorted.length; i++) {
      const aEnd = itemEndMin(sorted[i]);
      for (let j = i + 1; j < sorted.length; j++) {
        const bStart = itemStartMin(sorted[j]);
        if (bStart >= aEnd) break;
        conflicts.push({ date, a: sorted[i], b: sorted[j], overlapMin: aEnd - bStart });
      }
    }
  }
  return conflicts;
}

/** เวลาเดินทางโดยประมาณ (นาที): < 2 กม. เดิน, ไกลกว่านั้นรถไฟ + buffer */
export function travelMinutes(a, b) {
  const km = haversineKm(a, b);
  if (km == null) return null;
  if (km < 0.05) return 0;
  const minutes = km < 2 ? (km / WALK_KMH) * 60 : (km / TRAIN_KMH) * 60 + TRAIN_BUFFER_MIN;
  return Math.max(5, Math.round(minutes));
}

/**
 * แนะนำเวลาให้กิจกรรมที่ยังไม่มีเวลา — ต่อท้ายกิจกรรมที่มีเวลาแล้วของวันนั้น
 * @returns [{ id, date, start, durationMin, overflow }]
 */
export function suggestSchedule(items, opts = {}) {
  const { dayStartMin = 540, dayEndMin = 1320, gapMin = 15, defaultDuration = 60 } = opts;
  const byDate = groupBy(items || [], (it) => it.date);
  const suggestions = [];
  for (const [date, list] of Object.entries(byDate)) {
    const timed = list.filter((it) => itemStartMin(it) != null).sort((a, b) => itemStartMin(a) - itemStartMin(b));
    const lastEnd = timed.length ? Math.max(...timed.map(itemEndMin)) : null;
    let cursor = lastEnd != null ? Math.max(dayStartMin, lastEnd) : dayStartMin;
    const untimed = list
      .filter((it) => itemStartMin(it) == null)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    let first = true;
    for (const it of untimed) {
      const dur = effectiveDuration(it) || defaultDuration;
      const gap = first && lastEnd == null ? 0 : gapMin;
      const start = Math.max(cursor + gap, dayStartMin);
      const overflow = start + dur > dayEndMin;
      suggestions.push({ id: it.id, date, start: minToHM(start), durationMin: dur, overflow });
      cursor = start + dur;
      first = false;
    }
  }
  return suggestions;
}

/** ปริมาณกิจกรรมรวมของวัน (นาที) */
export function dayLoad(items) {
  return sum(items || [], (it) => Number(it.durationMin) || 0);
}

/** กิจกรรมที่ช่องว่างเวลาสั้นกว่าเวลาเดินทางระหว่างสถานที่ (เตือนแบบนุ่ม ๆ) */
export function tightTransitions(items) {
  const warnings = [];
  const byDate = groupBy((items || []).filter((it) => it.date && itemStartMin(it) != null && it.lat != null), (it) => it.date);
  for (const [date, list] of Object.entries(byDate)) {
    const sorted = [...list].sort((a, b) => itemStartMin(a) - itemStartMin(b));
    for (let i = 0; i + 1 < sorted.length; i++) {
      const gap = itemStartMin(sorted[i + 1]) - itemEndMin(sorted[i]);
      const need = travelMinutes(sorted[i], sorted[i + 1]);
      if (need != null && gap < need) {
        warnings.push({ date, a: sorted[i], b: sorted[i + 1], gapMin: gap, travelMin: need });
      }
    }
  }
  return warnings;
}
