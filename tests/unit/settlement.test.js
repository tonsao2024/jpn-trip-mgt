import { describe, it, expect } from 'vitest';
import {
  minimalTransfers,
  applyStatus,
  buildSettlementPlan,
  settlementKey
} from '../../src/settlement.js';
import { splitExpense } from '../../src/expense-calculator.js';

describe('minimalTransfers — greedy น้อยครั้งสุด', () => {
  it('a ได้ 200 / b จ่าย 150 / c จ่าย 50 → โอน 2 ครั้งเข้า a', () => {
    const t = minimalTransfers({ a: 200, b: -150, c: -50 });
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ from: 'b', to: 'a', amount: 150 });
    expect(t[1]).toMatchObject({ from: 'c', to: 'a', amount: 50 });
  });

  it('ลูกหนี้ที่โอนมากสุดถูกจัดก่อน (c กว่า b)', () => {
    const t = minimalTransfers({ a: 300, b: -100, c: -200 });
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ from: 'c', to: 'a', amount: 200 });
    expect(t[1]).toMatchObject({ from: 'b', to: 'a', amount: 100 });
  });

  it('ยอดไม่เท่าสวย: a:+250 b:-100 c:-150', () => {
    const t = minimalTransfers({ a: 250, b: -100, c: -150 });
    expect(t).toHaveLength(2);
    expect(t.map((x) => `${x.from}->${x.to}:${x.amount}`).sort()).toEqual(['b->a:100', 'c->a:150']);
  });

  it('ยอดเป็นศูนย์ถูกตัดออก และแผนว่างเมื่อเท่ากันหมด', () => {
    expect(minimalTransfers({ a: 0, b: 0 })).toEqual([]);
    expect(minimalTransfers({})).toEqual([]);
  });

  it('ผลรวมยอดโอน = ผลรวมยอดที่ได้รับ', () => {
    const balances = { a: 1234, b: -500, c: -400, d: -334 };
    const t = minimalTransfers(balances);
    const out = t.reduce((a, x) => a + x.amount, 0);
    expect(out).toBe(1234);
  });

  it('id ของแต่ละรายการเป็น from__to ไม่ซ้ำกัน', () => {
    const t = minimalTransfers({ a: 100, b: -60, c: -40 });
    const ids = t.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^(.+)__(.+)$/.test(id))).toBe(true);
    expect(settlementKey('b', 'a')).toBe('b__a');
  });
});

describe('applyStatus / buildSettlementPlan', () => {
  it('สถานะจ่ายแล้วเดิมถูกรักษาไว้เมื่อยอดไม่เปลี่ยน', () => {
    const transfers = [
      { id: 'b__a', from: 'b', to: 'a', amount: 100 },
      { id: 'c__a', from: 'c', to: 'a', amount: 50 }
    ];
    const saved = [{ id: 'b__a', status: 'paid', paidAt: 123 }];
    const out = applyStatus(transfers, saved);
    expect(out.find((x) => x.id === 'b__a').status).toBe('paid');
    expect(out.find((x) => x.id === 'c__a').status).toBe('pending');
  });

  it('buildSettlementPlan ทำงานครบจากค่าใช้จ่าย: a จ่าย 300 หาร 3 คน', () => {
    const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const expenses = [
      { amount: 300, paidBy: 'a', split: { mode: 'equal', members: ['a', 'b', 'c'] } }
    ];
    const plan = buildSettlementPlan(expenses, members, []);
    expect(splitExpense(expenses[0], ['a', 'b', 'c']).allocations).toEqual({ a: 100, b: 100, c: 100 });
    expect(plan).toHaveLength(2);
    const amounts = plan.map((x) => x.amount).sort((x, y) => y - x);
    expect(amounts).toEqual([100, 100]);
  });

  it('หลังมาร์กจ่ายแล้ว แผนใหม่ยังจำสถานะได้', () => {
    const members = [{ id: 'a' }, { id: 'b' }];
    const expenses = [{ amount: 200, paidBy: 'a', split: { mode: 'equal', members: ['a', 'b'] } }];
    const first = buildSettlementPlan(expenses, members, []);
    const saved = first.map((x) => ({ ...x, status: 'paid' }));
    const second = buildSettlementPlan(expenses, members, saved);
    expect(second.every((x) => x.status === 'paid')).toBe(true);
  });
});
