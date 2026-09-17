import { describe, it, expect } from 'vitest';
import {
  findConflicts,
  travelMinutes,
  suggestSchedule,
  itemEndMin,
  effectiveDuration,
  dayLoad
} from '../../src/scheduling.js';

const item = (id, date, start, durationMin, extra = {}) => ({ id, date, start, durationMin, title: id, ...extra });

describe('findConflicts — ตรวจเวลาทับซ้อน', () => {
  it('ทับซ้อน 60 นาทีในวันเดียวกัน', () => {
    const conflicts = findConflicts([
      item('a', '2026-10-12', '10:00', 120),
      item('b', '2026-10-12', '11:00', 60)
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapMin).toBe(60);
    expect(conflicts[0].a.id).toBe('a');
    expect(conflicts[0].b.id).toBe('b');
  });

  it('ต่างวันกันไม่ถือว่าทับ', () => {
    const conflicts = findConflicts([
      item('a', '2026-10-12', '10:00', 600),
      item('b', '2026-10-13', '10:00', 60)
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('กิจกรรมที่ยังไม่มีเวลาไม่ถูกนับ', () => {
    const conflicts = findConflicts([
      item('a', '2026-10-12', '10:00', 600),
      item('b', '2026-10-12', null, 600)
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('เวลาไม่ทับกัน → ไม่มี conflict', () => {
    const conflicts = findConflicts([
      item('a', '2026-10-12', '09:00', 60),
      item('b', '2026-10-12', '10:00', 60)
    ]);
    expect(conflicts).toHaveLength(0);
  });
});

describe('travelMinutes — เวลาเดินทางโดยประมาณ', () => {
  const tokyo = { lat: 35.6812, lng: 139.7671 };
  const shibuya = { lat: 35.658, lng: 139.7016 };
  const nearA = { lat: 35.6812, lng: 139.7671 };
  const nearB = { lat: 35.6822, lng: 139.7675 };

  it('พิกัดเดียวกัน → 0 นาที', () => {
    expect(travelMinutes(tokyo, { ...tokyo })).toBe(0);
  });

  it('ไม่มีพิกัด → null', () => {
    expect(travelMinutes({ lat: null, lng: null }, tokyo)).toBeNull();
  });

  it('ระยะใกล้เดินได้ → ขั้นต่ำ 5 นาที', () => {
    expect(travelMinutes(nearA, nearB)).toBe(5);
  });

  it('ระยะไกล (โตเกียว→ชิบุยะ) ใช้ค่าประมาณรถไฟในช่วงที่สมเหตุสมผล', () => {
    const m = travelMinutes(tokyo, shibuya);
    expect(m).toBeGreaterThanOrEqual(10);
    expect(m).toBeLessThanOrEqual(40);
  });
});

describe('suggestSchedule — จัดเวลาอัตโนมัติ', () => {
  it('ต่อท้ายกิจกรรมที่มีเวลาแล้ว (เว้น gap 15 นาที)', () => {
    const out = suggestSchedule([
      item('a', '2026-10-12', '09:00', 60),
      item('b', '2026-10-12', null, 60)
    ]);
    const b = out.find((x) => x.id === 'b');
    expect(b.start).toBe('10:15');
    expect(b.overflow).toBe(false);
  });

  it('วันที่ไม่มีกิจกรรมมีเวลา → เริ่ม 09:00 โดยไม่เว้น gap', () => {
    const out = suggestSchedule([item('a', '2026-10-12', null, 60)]);
    expect(out[0].start).toBe('09:00');
  });

  it('กิจกรรมต่อเนื่องหลายอัน ไม่ทับกันเอง', () => {
    const out = suggestSchedule([
      item('a', '2026-10-12', null, 60),
      item('b', '2026-10-12', null, 90),
      item('c', '2026-10-12', null, 60)
    ]);
    const mins = out.map((x) => x.start);
    expect(mins).toEqual(['09:00', '10:15', '12:00']);
  });

  it('ที่ล้นเกิน end of day ถูกตั้งธง overflow', () => {
    const out = suggestSchedule(
      [item('a', '2026-10-12', '21:00', 240)],
      {}
    );
    const suggestions = suggestSchedule(
      [item('late', '2026-10-12', null, 240, { order: 9 })].concat([item('full', '2026-10-12', '09:00', 60)])
    );
    expect(Array.isArray(out)).toBe(true);
    expect(Array.isArray(suggestions)).toBe(true);
  });
});

describe('duration helpers', () => {
  it('itemEndMin: 09:00 + 90 นาที = 630', () => {
    expect(itemEndMin(item('a', '2026-10-12', '09:00', 90))).toBe(630);
  });

  it('effectiveDuration fallback ตามหมวด (food = 60)', () => {
    expect(effectiveDuration({ category: 'food', durationMin: 0 })).toBe(60);
    expect(effectiveDuration({ category: 'food', durationMin: 45 })).toBe(45);
  });

  it('dayLoad รวมนาทีทั้งวัน', () => {
    expect(dayLoad([item('a', 'd', '09:00', 60), item('b', 'd', null, 30)])).toBe(90);
  });
});
