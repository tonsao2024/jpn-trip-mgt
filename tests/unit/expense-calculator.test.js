import { describe, it, expect } from 'vitest';
import {
  splitExpense,
  memberBalances,
  calcTHB,
  categoryTotals,
  dailyTotals
} from '../../src/expense-calculator.js';

describe('splitExpense — โหมด equal (หารเท่ากัน)', () => {
  it('10000 ¥ ÷ 3 คน = 3334/3333/3333 (เศษเยนไปคนแรกตามลำดับ)', () => {
    const { allocations, error } = splitExpense({
      amount: 10000,
      split: { mode: 'equal', members: ['a', 'b', 'c'] }
    });
    expect(error).toBeNull();
    expect(allocations).toEqual({ a: 3334, b: 3333, c: 3333 });
  });

  it('ผลรวมส่วนแบ่งต้องเท่ากับยอดจริงพอดีทุกกรณี', () => {
    for (const amount of [1, 2, 7, 100, 999, 12345, 1000001]) {
      const { allocations, error } = splitExpense({
        amount,
        split: { mode: 'equal', members: ['a', 'b', 'c', 'd'] }
      });
      expect(error).toBeNull();
      const total = Object.values(allocations).reduce((x, y) => x + y, 0);
      expect(total).toBe(amount);
    }
  });

  it('ถ้าไม่ระบุผู้ร่วม ใช้สมาชิกทั้งทริป', () => {
    const { allocations } = splitExpense({ amount: 90, split: { mode: 'equal' } }, ['x', 'y', 'z']);
    expect(allocations).toEqual({ x: 30, y: 30, z: 30 });
  });
});

describe('splitExpense — โหมด amounts (ยอดตามจริง)', () => {
  it('ผลรวมตรง → ได้ allocations ตามที่กรอก', () => {
    const { allocations, error } = splitExpense({
      amount: 2200,
      split: { mode: 'amounts', members: ['a', 'b'], values: { a: 1300, b: 900 } }
    });
    expect(error).toBeNull();
    expect(allocations).toEqual({ a: 1300, b: 900 });
  });

  it('ผลรวมไม่ตรง → แจ้ง error', () => {
    const { error } = splitExpense({
      amount: 2000,
      split: { mode: 'amounts', members: ['a', 'b'], values: { a: 1000, b: 500 } }
    });
    expect(error).toMatch(/ไม่ตรง/);
  });
});

describe('splitExpense — โหมด shares (ส่วนแบ่ง)', () => {
  it('2:1 ของ 9000 → 6000/3000', () => {
    const { allocations, error } = splitExpense({
      amount: 9000,
      split: { mode: 'shares', members: ['a', 'b'], values: { a: 2, b: 1 } }
    });
    expect(error).toBeNull();
    expect(allocations).toEqual({ a: 6000, b: 3000 });
  });

  it('1:1:1 ของ 10000 → 3334/3333/3333 (เศษให้เศษทศนิยมมาก เสมอกันให้คนแรก)', () => {
    const { allocations } = splitExpense({
      amount: 10000,
      split: { mode: 'shares', members: ['a', 'b', 'c'], values: { a: 1, b: 1, c: 1 } }
    });
    expect(allocations).toEqual({ a: 3334, b: 3333, c: 3333 });
  });

  it('น้ำหนักรวมเป็น 0 → error', () => {
    const { error } = splitExpense({
      amount: 100,
      split: { mode: 'shares', members: ['a'], values: { a: 0 } }
    });
    expect(error).toMatch(/ส่วนแบ่ง/);
  });
});

describe('splitExpense — โหมด percent (เปอร์เซ็นต์)', () => {
  it('50/50 ของ 999 → 500/499', () => {
    const { allocations, error } = splitExpense({
      amount: 999,
      split: { mode: 'percent', members: ['a', 'b'], values: { a: 50, b: 50 } }
    });
    expect(error).toBeNull();
    expect(allocations).toEqual({ a: 500, b: 499 });
  });

  it('รวมไม่ใช่ 100 → error', () => {
    const { error } = splitExpense({
      amount: 1000,
      split: { mode: 'percent', members: ['a', 'b'], values: { a: 60, b: 30 } }
    });
    expect(error).toMatch(/100/);
  });
});

describe('calcTHB', () => {
  it('1000 ¥ ที่อัตรา 0.22 = 220 บาท', () => {
    expect(calcTHB(1000, 0.22)).toBe(220);
  });
  it('รวมค่าธรรมเนียม 2.5% = 225.5 บาท', () => {
    expect(calcTHB(1000, 0.22, 2.5)).toBe(225.5);
  });
});

describe('memberBalances', () => {
  const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const expenses = [
    { amount: 6000, paidBy: 'a', split: { mode: 'equal', members: ['a', 'b', 'c'] } },
    { amount: 900, paidBy: 'b', split: { mode: 'amounts', members: ['a', 'b'], values: { a: 400, b: 500 } } }
  ];

  it('paid / share / net ถูกต้อง', () => {
    const b = memberBalances(expenses, members);
    expect(b.a).toEqual({ paid: 6000, share: 2400, net: 3600 });
    expect(b.b).toEqual({ paid: 900, share: 2500, net: -1600 });
    expect(b.c).toEqual({ paid: 0, share: 2000, net: -2000 });
  });

  it('ผลรวม net ทุกคนต้องเป็น 0', () => {
    const b = memberBalances(expenses, members);
    const sumNet = Object.values(b).reduce((a, x) => a + x.net, 0);
    expect(sumNet).toBe(0);
  });
});

describe('totals', () => {
  it('categoryTotals และ dailyTotals รวมถูกต้อง', () => {
    const expenses = [
      { amount: 1000, category: 'food', date: '2026-10-12' },
      { amount: 500, category: 'food', date: '2026-10-12' },
      { amount: 700, category: 'ticket', date: '2026-10-13' }
    ];
    expect(categoryTotals(expenses)).toEqual({ food: 1500, ticket: 700 });
    expect(dailyTotals(expenses)).toEqual({ '2026-10-12': 1500, '2026-10-13': 700 });
  });
});
