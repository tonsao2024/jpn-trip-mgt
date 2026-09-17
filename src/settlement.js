/* ============================================================
   Fuji Trip — settlement.js
   Settlement Algorithm (โอนน้อยครั้งสุด) และ Payment Status
   ============================================================ */

import { memberBalances } from './expense-calculator.js';

// ============================================================
// หน้าเคลียร์ยอด (#/trip/:id/settlement)
// ============================================================
import { api } from './firebase-client.js';
import { state, subscribe } from './store.js';
import { el, fmtJPY, fmtTHB } from './utils.js';
import { topbar, avatarEl, refreshIcons, emptyState } from './components.js';
import { toast } from './notifications.js';
import { tripFx } from './settings.js';
import { useTripData, tripNav } from './trips.js';

export function renderSettlementView(root, params) {
  const tripId = params.id;
  const cleanupData = useTripData(tripId);

  const balBox = el('div', { class: 'card card--flush', style: 'padding:4px 14px' });
  const planBox = el('div');
  const hintBox = el('div', { class: 'muted small', style: 'margin:4px 2px 10px' });

  const paint = () => {
    const trip = state.trip;
    if (!trip) {
      planBox.replaceChildren(el('div', { class: 'skeleton', style: 'height:120px' }));
      return;
    }
    const members = state.members;
    const balances = memberBalances(state.expenses, members);
    const plan = buildSettlementPlan(state.expenses, members, state.settlements);
    const { rate } = tripFx(trip);

    // ยอดสุทธิรายคน
    balBox.replaceChildren();
    for (const m of members) {
      const b = balances[m.id] || { paid: 0, share: 0, net: 0 };
      balBox.append(el('div', { class: 'bal-row' },
        avatarEl(m, 'avatar--sm'),
        el('div', { class: 'grow' },
          el('div', { style: 'font-weight:600; font-size:14px' }, `${m.emoji} ${m.name}`),
          el('div', { class: 'muted small' }, `จ่ายหน้า ${fmtJPY(b.paid)} · ควรจ่าย ${fmtJPY(b.share)}`)
        ),
        el('span', { class: `badge ${b.net > 0 ? 'badge--ok' : b.net < 0 ? 'badge--err' : ''}` },
          b.net > 0 ? `ได้รับ ${fmtJPY(b.net)}` : b.net < 0 ? `จ่ายอีก ${fmtJPY(-b.net)}` : 'เท่ากัน')
      ));
    }

    // แผนโอน
    planBox.replaceChildren();
    planBox.append(el('div', { class: 'section-title' },
      el('h2', {}, 'โอนอย่างไรให้จบเร็วที่สุด'),
      el('span', { class: 'badge' }, `${plan.filter((t) => t.status !== 'paid').length} รายการค้าง`)
    ));
    hintBox.textContent = 'อัลกอริทึม greedy: จ่ายน้อยครั้งที่สุด ปัดเป็นเยนจำนวนเต็ม';
    if (!plan.length) {
      planBox.append(emptyState({
        state: 'happy',
        title: 'เคลียร์ยอดเรียบร้อยแล้ว! 🎉',
        sub: state.expenses.length ? 'ทุกคนเท่ากันหมด ไม่ต้องโอนกันแล้ว' : 'เริ่มบันทึกค่าใช้จ่ายเพื่อดูแผนเคลียร์ยอด'
      }));
    }
    for (const t of plan) {
      const from = members.find((m) => m.id === t.from);
      const to = members.find((m) => m.id === t.to);
      const card = el('div', { class: `settle-card ${t.status === 'paid' ? 'paid' : ''}` },
        avatarEl(from || { id: t.from, name: '?' }, 'avatar--sm'),
        el('span', { class: 'small', style: 'font-weight:600' }, from?.name || '?'),
        el('span', { class: 'settle-arrow' }, '→'),
        avatarEl(to || { id: t.to, name: '?' }, 'avatar--sm'),
        el('span', { class: 'small', style: 'font-weight:600' }, to?.name || '?'),
        el('span', { class: 'grow' }),
        el('span', { class: 'settle-amount' },
          fmtJPY(t.amount),
          el('div', { class: 'muted small', style: 'text-align:end' }, rate ? `≈ ${fmtTHB(t.amount * rate)}` : '')
        ),
        el('button', {
          class: `btn btn--sm ${t.status === 'paid' ? 'btn--ghost' : 'btn--ok'}`,
          onclick: async () => {
            const updated = plan.map((x) =>
              x.id === t.id
                ? { ...x, status: x.status === 'paid' ? 'pending' : 'paid', paidAt: x.status === 'paid' ? null : Date.now() }
                : x
            );
            await api.saveSettlements(tripId, updated);
            toast(t.status === 'paid' ? 'กลับเป็นยังไม่จ่าย' : 'มาร์กว่าจ่ายแล้ว ✅', 'success');
          }
        }, t.status === 'paid' ? '↩︎ ย้อน' : '✓ จ่ายแล้ว')
      );
      planBox.append(card);
    }
    refreshIcons();
  };

  root.append(
    topbar({ title: 'เคลียร์ยอด', back: true }),
    el('div', { class: 'content' },
      el('div', { class: 'section-title' }, el('h2', {}, 'ยอดสุทธิของแต่ละคน')),
      balBox,
      planBox,
      hintBox
    ),
    tripNav(tripId, 'charts')
  );
  paint();
  const unsub = subscribe(['expenses', 'members', 'settlements', 'trip'], () => { paint(); refreshIcons(); });
  return () => { unsub(); cleanupData(); };
}

/** คีย์เอกสารการเคลียร์ระหว่างสองคน */
export const settlementKey = (from, to) => `${from}__${to}`;

/**
 * แปลงยอดคงเหลือสุทธิเป็นรายการโอนแบบ greedy (จำนวนครั้งน้อย)
 * @param balances { memberId: net } — net > 0 = ได้รับ, net < 0 = ต้องจ่าย
 * @returns [{ id, from, to, amount }] — เยนจำนวนเต็ม
 */
export function minimalTransfers(balances) {
  const creditors = [];
  const debtors = [];
  for (const [id, netRaw] of Object.entries(balances || {})) {
    const net = Math.round(Number(netRaw) || 0);
    if (net > 0) creditors.push({ id, amt: net });
    else if (net < 0) debtors.push({ id, amt: -net });
  }
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return transfers.map((t) => ({ ...t, id: settlementKey(t.from, t.to) }));
}

/** ผูกสถานะ "จ่ายแล้ว" เดิมเข้ากับแผนโอนล่าสุด */
export function applyStatus(transfers, savedList = []) {
  const savedMap = new Map((savedList || []).map((s) => [s.id, s]));
  return transfers.map((t) => {
    const s = savedMap.get(t.id);
    return { ...t, status: s?.status === 'paid' ? 'paid' : 'pending', paidAt: s?.paidAt || null };
  });
}

/** แผนเคลียร์ยอดล่าสุดจากค่าใช้จ่าย (รักษาสถานะจ่ายแล้วเดิม) */
export function buildSettlementPlan(expenses, members = [], savedList = []) {
  const balances = memberBalances(expenses, members);
  const net = Object.fromEntries(members.map((m) => [m.id, balances[m.id]?.net || 0]));
  return applyStatus(minimalTransfers(net), savedList);
}
