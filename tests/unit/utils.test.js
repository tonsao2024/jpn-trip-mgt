import { describe, it, expect, vi } from 'vitest';
import {
  parseISO,
  toISO,
  addDaysISO,
  eachDayISO,
  hmToMin,
  minToHM,
  endTimeHM,
  fmtJPY,
  fmtTHB,
  fmtDateTH,
  todayISO,
  haversineKm,
  sha256,
  toCSV,
  parseCSV,
  esc,
  clamp,
  sum,
  groupBy,
  isEmail,
  debounce,
  num
} from '../../src/utils.js';

describe('วันที่ (local ISO)', () => {
  it('parseISO/toISO วนกลับได้ตรงกัน', () => {
    expect(toISO(parseISO('2026-10-12'))).toBe('2026-10-12');
  });

  it('addDaysISO ข้ามเดือนได้', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('eachDayISO ครบทุกวัน', () => {
    expect(eachDayISO('2026-10-12', '2026-10-15')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
  });

  it('eachDayISO กรณีสลับที่ → คืนอาร์เรย์ว่าง', () => {
    expect(eachDayISO('2026-10-15', '2026-10-12')).toEqual([]);
  });

  it('todayISO อยู่ในรูปแบบ YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('fmtDateTH มีเดือนไทย', () => {
    expect(fmtDateTH('2026-10-12')).toContain('ต.ค.');
    expect(fmtDateTH('2026-10-12')).toContain('12');
  });
});

describe('เวลาในวัน', () => {
  it('hmToMin / minToHM แปลงกลับไปมาได้', () => {
    expect(hmToMin('09:50')).toBe(590);
    expect(minToHM(590)).toBe('09:50');
  });

  it('minToHM จัดการเกิน 24 ชม.', () => {
    expect(minToHM(1500)).toBe('01:00');
  });

  it('endTimeHM บวก duration', () => {
    expect(endTimeHM('09:00', 90)).toBe('10:30');
    expect(endTimeHM('23:30', 60)).toBe('00:30');
  });
});

describe('สกุลเงิน', () => {
  it('fmtJPY มีตัวคั่นพัน', () => {
    expect(fmtJPY(12345)).toMatch(/12,345/);
  });
  it('fmtTHB มีทศนิยม 2 ตำแหน่ง', () => {
    expect(fmtTHB(1234.5)).toMatch(/1,234\.50/);
  });
});

describe('ระยะทาง', () => {
  it('haversineKm โตเกียว→โอซาก้า ~380 กม.', () => {
    const km = haversineKm(
      { lat: 35.6812, lng: 139.7671 },
      { lat: 34.6937, lng: 135.5023 }
    );
    expect(km).toBeGreaterThan(340);
    expect(km).toBeLessThan(420);
  });

  it('พิกัดไม่ครบ → null', () => {
    expect(haversineKm(null, { lat: 1, lng: 1 })).toBeNull();
  });
});

describe('crypto', () => {
  it('sha256 ตรงกับ known vector', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('CSV', () => {
  it('toCSV escape คอมมา/คำพูด/ขึ้นบรรทัด', () => {
    const csv = toCSV([['a', 'b,c', 'say "hi"', 'line\nbreak']]);
    expect(csv).toBe('a,"b,c","say ""hi""","line\nbreak"');
  });

  it('parseCSV อ่านกลับได้ครบ', () => {
    const rows = parseCSV('a,"b,c","say ""hi"""\r\n1,2,3\r\n');
    expect(rows[0]).toEqual(['a', 'b,c', 'say "hi"']);
    expect(rows[1]).toEqual(['1', '2', '3']);
  });

  it('parseCSV ตัด BOM ออก', () => {
    expect(parseCSV('\uFEFFx,y')[0]).toEqual(['x', 'y']);
  });
});

describe('misc', () => {
  it('esc หนีอักขระอันตราย', () => {
    expect(esc('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });

  it('clamp / sum / groupBy', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([{ v: 2 }, { v: 3 }], (x) => x.v)).toBe(5);
    const g = groupBy([{ t: 'a' }, { t: 'b' }, { t: 'a' }], (x) => x.t);
    expect(g.a).toHaveLength(2);
  });

  it('num parse สตริงการเงิน', () => {
    expect(num('1,200')).toBe(1200);
    expect(num('abc', 7)).toBe(7);
  });

  it('isEmail ตรวจพื้นฐาน', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('bad@')).toBe(false);
  });

  it('debounce เรียกครั้งเดียวหลังหยุดพิมพ์', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d();
    d();
    await vi.advanceTimersByTimeAsync(150);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
