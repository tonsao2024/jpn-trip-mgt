/* ============================================================
   Fuji Trip — expense-calculator.js
   Fee, Currency และ Split Calculation (pure functions)
   หลักการปัดเงิน: หน่วยเป็นเยนจำนวนเต็ม — ปัด floor แล้วกระจาย
   เศษทีละ 1 เยนตามลำดับ เพื่อให้ผลรวมเท่ากับยอดจริงพอดี
   ============================================================ */

export const SPLIT_MODES = [
  { value: 'equal', label: 'หารเท่ากัน' },
  { value: 'amounts', label: 'ยอดตามจริง' },
  { value: 'shares', label: 'ส่วนแบ่ง' },
  { value: 'percent', label: 'เปอร์เซ็นต์' }
];

/** JPY → THB พร้อมค่าธรรมเนียม (feePct %) — ทศนิยม 2 ตำแหน่ง */
export function calcTHB(jpy, rate, feePct = 0) {
  const base = (Number(jpy) || 0) * (Number(rate) || 0);
  return Math.round(base * (1 + (Number(feePct) || 0) / 100) * 100) / 100;
}

/**
 * คำนวณส่วนแบ่งรายคนของรายจ่ายหนึ่งรายการ
 * @param expense { amount, split: { mode, members, values? } }
 * @param memberIds สมาชิกทั้งหมด (ใช้แทนถ้า split.members ว่าง)
 * @returns {{ allocations: Object<string,number>, error: string|null }}
 */
export function splitExpense(expense, memberIds = []) {
  const amount = Math.round(Number(expense?.amount) || 0);
  const mode = expense?.split?.mode || 'equal';
  let participants = (expense?.split?.members || []).filter(Boolean);
  if (!participants.length) participants = [...memberIds];
  if (!participants.length) return { allocations: {}, error: 'ไม่มีผู้ร่วมจ่าย' };
  const values = expense?.split?.values || {};

  if (amount < 0) return { allocations: {}, error: 'ยอดเงินติดลบ' };

  if (mode === 'equal') {
    const n = participants.length;
    const base = Math.floor(amount / n);
    let remainder = amount - base * n;
    const allocations = {};
    for (const id of participants) allocations[id] = base;
    for (const id of participants) {
      if (remainder <= 0) break;
      allocations[id] += 1;
      remainder -= 1;
    }
    return { allocations, error: null };
  }

  if (mode === 'amounts') {
    const allocations = {};
    let total = 0;
    for (const id of participants) {
      const v = Math.round(Number(values[id]) || 0);
      allocations[id] = v;
      total += v;
    }
    if (total !== amount) {
      return { allocations: {}, error: `ยอดรวมส่วนแบ่ง (${total}) ไม่ตรงกับยอดจริง (${amount})` };
    }
    return { allocations, error: null };
  }

  if (mode === 'shares' || mode === 'percent') {
    const rawWeights = participants.map((id) => Number(values[id]) || 0);
    const weights = mode === 'shares' ? rawWeights.map((w) => Math.max(0, Math.round(w))) : rawWeights;
    const wsum = weights.reduce((a, b) => a + b, 0);
    if (wsum <= 0) return { allocations: {}, error: mode === 'shares' ? 'ส่วนแบ่งต้องมากกว่า 0' : 'เปอร์เซ็นต์รวมต้องเท่ากับ 100' };
    if (mode === 'percent' && Math.abs(wsum - 100) > 0.01) {
      return { allocations: {}, error: `เปอร์เซ็นต์รวมต้องเท่ากับ 100 (ตอนนี้ ${Math.round(wsum * 100) / 100})` };
    }
    const exact = participants.map((_id, i) => (amount * weights[i]) / wsum);
    const allocations = {};
    let assigned = 0;
    participants.forEach((id, i) => {
      allocations[id] = Math.floor(exact[i]);
      assigned += allocations[id];
    });
    let remainder = amount - assigned;
    const order = participants
      .map((id, i) => ({ id, frac: exact[i] - Math.floor(exact[i]), i }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (const o of order) {
      if (remainder <= 0) break;
      allocations[o.id] += 1;
      remainder -= 1;
    }
    return { allocations, error: null };
  }

  return { allocations: {}, error: `ไม่รู้จักโหมดแบ่งเงิน: ${mode}` };
}

/**
 * ยอดต่อคนจากค่าใช้จ่ายทั้งหมด
 * paid = จ่ายหน้า, share = ที่ควรรับผิดชอบ, net = paid − share (+ = ได้รับคืน)
 */
export function memberBalances(expenses, members = []) {
  const ids = members.map((m) => m.id);
  const res = Object.fromEntries(ids.map((id) => [id, { paid: 0, share: 0, net: 0 }]));
  for (const e of expenses || []) {
    const amt = Math.round(Number(e.amount) || 0);
    if (res[e.paidBy]) res[e.paidBy].paid += amt;
    const { allocations } = splitExpense(e, ids);
    for (const [id, v] of Object.entries(allocations)) {
      if (res[id]) res[id].share += v;
    }
  }
  for (const id of ids) res[id].net = res[id].paid - res[id].share;
  return res;
}

/** ยอดรวมตามหมวด (เยน) */
export function categoryTotals(expenses) {
  const totals = {};
  for (const e of expenses || []) {
    const c = e.category || 'other';
    totals[c] = (totals[c] || 0) + (Math.round(Number(e.amount)) || 0);
  }
  return totals;
}

/** ยอดรวมตามวัน (เยน) */
export function dailyTotals(expenses) {
  const totals = {};
  for (const e of expenses || []) {
    const d = e.date || '';
    totals[d] = (totals[d] || 0) + (Math.round(Number(e.amount)) || 0);
  }
  return totals;
}
