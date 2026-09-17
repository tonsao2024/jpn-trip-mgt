/* ============================================================
   Fuji Trip — expenses.js
   Expense Form, List, Filter และ Receipt (อัปโหลดใบเสร็จ)
   ============================================================ */

import { api } from './firebase-client.js';
import { state, subscribe } from './store.js';
import { el, fmtJPY, fmtTHB, fmtDateTH, todayISO, num, groupBy } from './utils.js';
import { toast, confirmDialog } from './notifications.js';
import {
  topbar, emptyState, field, textInput, chipGroup, selectInput, fab,
  refreshIcons, icon, openModal
} from './components.js';
import { tripCategories, tripFx } from './settings.js';
import { splitExpense, SPLIT_MODES, calcTHB } from './expense-calculator.js';
import { useTripData, tripNav } from './trips.js';

export function renderExpensesView(root, params) {
  const tripId = params.id;
  const cleanupData = useTripData(tripId);
  const filters = { member: 'all', category: 'all' };

  const sumBar = el('div', { class: 'sum-bar' });
  const filterBox = el('div', { class: 'chips' });
  const listBox = el('div');

  const paint = () => {
    const trip = state.trip;
    if (!trip) {
      listBox.replaceChildren(el('div', { class: 'skeleton', style: 'height:120px' }));
      return;
    }
    const cats = tripCategories(trip);
    const members = state.members;

    // ---------- ตัวกรอง ----------
    filterBox.replaceChildren();
    const chip = (active, content, onClick) => {
      const c = el('button', { class: `chip ${active ? 'active' : ''}`, type: 'button' }, content);
      c.onclick = onClick;
      return c;
    };
    filterBox.append(chip(filters.member === 'all', 'ทุกคน', () => { filters.member = 'all'; paint(); }));
    members.forEach((m) => filterBox.append(chip(filters.member === m.id, `${m.emoji} ${m.name}`, () => { filters.member = m.id; paint(); })));
    filterBox.append(chip(filters.category === 'all', 'ทุกหมวด', () => { filters.category = 'all'; paint(); }));
    cats.forEach((c) => filterBox.append(chip(filters.category === c.id, `${c.emoji} ${c.label}`, () => { filters.category = c.id; paint(); })));

    // ---------- รายการ ----------
    let list = [...state.expenses];
    if (filters.member !== 'all') {
      list = list.filter((e) => e.paidBy === filters.member || (e.split?.members || []).includes(filters.member));
    }
    if (filters.category !== 'all') list = list.filter((e) => e.category === filters.category);
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const total = state.expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const { rate, feePct } = tripFx(trip);
    const perPerson = members.length ? Math.round(total / members.length) : 0;

    sumBar.replaceChildren(
      miniSum('ยอดรวม', fmtJPY(total)),
      miniSum('เฉลี่ย/คน', fmtJPY(perPerson)),
      miniSum('รายการ', `${state.expenses.length} รายการ`)
    );
    if (rate) {
      sumBar.append(el('div', { class: 'muted small', style: 'grid-column:1/-1; text-align:end' },
        `≈ ${fmtTHB(total * rate * (1 + feePct / 100))} (รวมค่าธรรมเนียม ${feePct}%)`));
    }

    listBox.replaceChildren();
    if (!list.length) {
      listBox.append(emptyState({
        state: 'idle',
        title: 'ยังไม่มีรายจ่ายที่ตรงกับตัวกรอง',
        sub: 'กด + เพื่อบันทึกค่าใช้จ่าย เช่น ค่าอาหาร ค่าตั๋ว ค่ารถไฟ',
        actionLabel: '+ เพิ่มค่าใช้จ่าย',
        onAction: () => openExpenseModal()
      }));
    } else {
      const byDate = groupBy(list, (e) => e.date || 'อื่น ๆ');
      Object.keys(byDate).sort((a, b) => b.localeCompare(a)).forEach((date) => {
        listBox.append(el('div', { class: 'section-title', style: 'margin:14px 0 6px' },
          el('h2', {}, fmtDateTH(date)),
          el('span', { class: 'muted small' }, fmtJPY(byDate[date].reduce((a, e) => a + (Number(e.amount) || 0), 0)))
        ));
        const card = el('div', { class: 'card card--flush', style: 'padding:2px 14px' });
        byDate[date]
          .sort((a, b) => b.updatedAt || 0 - (a.updatedAt || 0))
          .forEach((e) => {
            const cat = cats.find((c) => c.id === e.category);
            const payer = members.find((m) => m.id === e.paidBy);
            const splitLabel = { equal: 'หารเท่า', amounts: 'ยอดตามจริง', shares: 'ส่วนแบ่ง', percent: 'เปอร์เซ็นต์' }[e.split?.mode] || '';
            card.append(el('div', { class: 'exp-row', onclick: () => openExpenseModal(e) },
              el('div', { class: 'exp-emoji' }, cat?.emoji || '✨'),
              el('div', { class: 'list-row__main' },
                el('div', { class: 'list-row__title' }, e.title),
                el('div', { class: 'list-row__sub' },
                  `${payer?.name || '?'} จ่าย · ${splitLabel} · ${(e.split?.members || []).length} คน`,
                  e.receiptUrl ? ' · 🧾 มีใบเสร็จ' : ''
                )
              ),
              el('div', { class: 'exp-amount' },
                el('b', { class: 'num' }, fmtJPY(e.amount)),
                el('div', { class: 'muted small num' }, rate ? fmtTHB(e.amount * rate * (1 + feePct / 100)) : '')
              )
            ));
          });
        listBox.append(card);
      });
    }
    refreshIcons();
  };

  root.append(
    topbar({ title: 'ค่าใช้จ่าย', back: true }),
    el('div', { class: 'content' }, sumBar, filterBox, el('div', { class: 'mt-8' }, listBox)),
    fab({ lucide: 'plus', label: 'เพิ่มค่าใช้จ่าย', onClick: () => openExpenseModal() }),
    tripNav(tripId, 'expenses')
  );
  paint();
  const unsub = subscribe(['expenses', 'trip', 'members'], () => { paint(); refreshIcons(); });
  return () => { unsub(); cleanupData(); };
}

function miniSum(title, value) {
  return el('div', { class: 'tile' },
    el('div', { class: 'tile__title' }, title),
    el('div', { class: 'tile__value', style: 'font-size:17px' }, value)
  );
}

// ---------- ย่อรูปใบเสร็จก่อนอัปโหลด ----------
function compressImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

// ---------- Modal เพิ่ม/แก้ไขค่าใช้จ่าย ----------
export function openExpenseModal(expense = null) {
  const trip = state.trip;
  if (!trip) return;
  const tripId = trip.id;
  const isNew = !expense;
  const members = state.members;
  const cats = tripCategories(trip);

  let category = expense?.category || 'food';
  let mode = expense?.split?.mode || 'equal';
  let participants = new Set(expense?.split?.members?.length ? expense.split.members : members.map((m) => m.id));
  const values = { ...(expense?.split?.values || {}) };
  let receiptFile = null;
  let receiptRemoved = false;

  const titleInp = textInput({ value: expense?.title || '', placeholder: 'เช่น ค่าราเมง + กยิน', maxlength: '80' });
  const amountInp = textInput({ type: 'number', min: '0', step: '1', value: expense?.amount != null ? String(expense.amount) : '', inputmode: 'numeric', placeholder: '0' });
  const thbPreview = el('div', { class: 'muted small' });
  const dateInp = textInput({ type: 'date', value: expense?.date || todayISO() });
  const noteInp = el('textarea', { class: 'input', placeholder: 'โน้ต (ถ้ามี)' });
  noteInp.value = expense?.note || '';

  const catPick = chipGroup({
    options: cats.map((c) => ({ value: c.id, label: c.label, emoji: c.emoji })),
    value: category,
    onChange: (v) => { category = v; }
  });
  const paidBySel = selectInput(
    members.map((m) => ({ value: m.id, label: `${m.emoji} ${m.name}` })),
    expense?.paidBy || members[0]?.id || ''
  );

  const participantPick = chipGroup({
    options: members.map((m) => ({ value: m.id, label: m.name, emoji: m.emoji })),
    value: [...participants],
    multi: true,
    onChange: (arr) => {
      participants = new Set(arr);
      renderValuesBox();
    }
  });

  const modePick = chipGroup({
    options: SPLIT_MODES.map((m) => ({ value: m.value, label: m.label })),
    value: mode,
    onChange: (v) => {
      mode = v;
      renderValuesBox();
      updatePreview();
    }
  });

  const valuesBox = el('div');
  const splitPreview = el('div', { class: 'muted small mt-8' });

  const renderValuesBox = () => {
    valuesBox.replaceChildren();
    const ids = [...participants];
    if (!ids.length) {
      valuesBox.append(el('p', { class: 'error-text' }, 'เลือกผู้ร่วมจ่ายอย่างน้อย 1 คน'));
      return;
    }
    if (mode === 'equal') {
      valuesBox.append(el('p', { class: 'muted small' }, 'ระบบหารให้เท่ากันอัตโนมัติ (ปัดเป็นเยน ผลรวมตรงพอดี)'));
    } else {
      for (const id of ids) {
        const m = members.find((x) => x.id === id);
        const inp = textInput({
          type: 'number', min: '0', step: mode === 'amounts' ? '1' : '0.5',
          value: values[id] != null ? String(values[id]) : '',
          placeholder: mode === 'amounts' ? 'เยน' : mode === 'shares' ? 'ส่วน (เช่น 1, 2)' : '%'
        });
        inp.addEventListener('input', () => { values[id] = num(inp.value, 0); updatePreview(); });
        valuesBox.append(el('div', { class: 'cat-row' },
          el('span', { style: 'font-size:20px' }, m?.emoji || '🙂'),
          el('span', { class: 'small', style: 'min-width:70px' }, m?.name || id),
          inp
        ));
      }
      if (mode === 'percent') {
        const sumEl = el('div', { class: 'small' });
        valuesBox.append(sumEl);
        valuesBox._sumEl = sumEl;
      }
    }
    updatePreview();
  };

  const updatePreview = () => {
    const amount = num(amountInp.value, 0);
    const { rate, feePct } = tripFx(trip);
    thbPreview.textContent = rate && amount ? `≈ ${fmtTHB(calcTHB(amount, rate, feePct))}` : '';
    const res = splitExpense({ amount, split: { mode, members: [...participants], values } }, members.map((m) => m.id));
    if (res.error) {
      splitPreview.textContent = `⚠️ ${res.error}`;
      splitPreview.className = 'error-text small mt-8';
    } else {
      splitPreview.className = 'muted small mt-8';
      splitPreview.textContent = Object.entries(res.allocations)
        .map(([id, v]) => `${members.find((m) => m.id === id)?.name || '?'} ${v}¥`)
        .join(' · ');
    }
    if (mode === 'percent' && valuesBox._sumEl) {
      const psum = [...participants].reduce((a, id) => a + (Number(values[id]) || 0), 0);
      valuesBox._sumEl.textContent = `รวม ${Math.round(psum * 100) / 100}% (ต้องเท่ากับ 100)`;
      valuesBox._sumEl.className = Math.abs(psum - 100) < 0.01 ? 'badge badge--ok' : 'badge badge--warn';
    }
  };
  amountInp.addEventListener('input', updatePreview);

  // ---------- ใบเสร็จ ----------
  const receiptPreview = el('img', { class: 'receipt-thumb hidden', alt: 'ใบเสร็จ' });
  if (expense?.receiptUrl) receiptPreview.src = expense.receiptUrl;
  const fileInp = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  fileInp.addEventListener('change', () => {
    const f = fileInp.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast('รูปใหญ่เกิน 8MB — ลองถ่ายใหม่', 'warn');
      return;
    }
    receiptFile = f;
    receiptRemoved = false;
    receiptPreview.src = URL.createObjectURL(f);
    receiptPreview.classList.remove('hidden');
  });

  const modal = openModal({
    title: isNew ? 'เพิ่มค่าใช้จ่าย' : 'แก้ไขค่าใช้จ่าย',
    wide: true,
    foot: [
      ...(isNew ? [] : [el('button', {
        class: 'btn btn--danger',
        onclick: async () => {
          if (await confirmDialog({ title: 'ลบรายจ่ายนี้?', message: expense.title, okText: 'ลบ', danger: true })) {
            await api.deleteExpense(tripId, expense.id);
            toast('ลบรายจ่ายแล้ว', 'success');
            modal.close();
          }
        }
      }, icon('trash-2'), 'ลบ')]),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn btn--ghost', onclick: () => modal.close() }, 'ยกเลิก'),
      el('button', {
        class: 'btn',
        onclick: async (e) => {
          const btn = e.currentTarget;
          const amount = Math.round(num(amountInp.value, 0));
          const title = titleInp.value.trim();
          if (!title) { toast('ใส่รายการก่อน', 'warn'); return; }
          if (!(amount > 0)) { toast('ยอดเงินต้องมากกว่า 0', 'warn'); return; }
          if (!paidBySel.value) { toast('เลือกว่าใครจ่าย', 'warn'); return; }
          const check = splitExpense({ amount, split: { mode, members: [...participants], values } }, members.map((m) => m.id));
          if (check.error) { toast(check.error, 'warn'); return; }
          btn.disabled = true;
          try {
            let receiptUrl = receiptRemoved ? '' : expense?.receiptUrl || '';
            let receiptPath = receiptRemoved ? '' : expense?.receiptPath || '';
            if (receiptFile) {
              const compressed = await compressImage(receiptFile);
              const up = await api.uploadReceipt(tripId, compressed);
              receiptUrl = up.url;
              receiptPath = up.path;
            }
            await api.saveExpense(tripId, {
              id: expense?.id,
              title,
              category,
              date: dateInp.value || todayISO(),
              amount,
              paidBy: paidBySel.value,
              split: { mode, members: [...participants], values: mode === 'equal' ? {} : values },
              note: noteInp.value.trim(),
              receiptUrl,
              receiptPath
            });
            toast(isNew ? 'บันทึกรายจ่ายแล้ว' : 'อัปเดตรายจ่ายแล้ว', 'success');
            modal.close();
          } catch (err) {
            toast(err?.code === 'permission-denied' ? 'ไม่มีสิทธิ์บันทึก (ต้องเป็นสมาชิกทริป)' : err.message || 'บันทึกไม่สำเร็จ', 'error');
            btn.disabled = false;
          }
        }
      }, 'บันทึก')
    ],
    body: (b) => {
      b.append(
        field('รายการ', titleInp),
        el('div', { class: 'row row--wrap' },
          el('div', { class: 'grow' }, field('ยอด (เยน ¥)', amountInp)),
          el('div', { class: 'grow' }, field('วันที่', dateInp))
        ),
        thbPreview,
        field('หมวด', catPick.el),
        field('ใครจ่าย', paidBySel),
        field('ผู้ร่วมจ่าย', participantPick.el),
        field('วิธีแบ่ง', modePick.el),
        valuesBox,
        splitPreview,
        field('ใบเสร็จ (ถ่ายรูปเก็บไว้ดูภายหลัง)', el('div', { class: 'row' },
          el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => fileInp.click() }, icon('camera'), 'แนบรูป'),
          receiptPreview,
          (expense?.receiptUrl || receiptFile) && !receiptRemoved
            ? el('button', {
                class: 'icon-btn icon-btn--danger', type: 'button', 'aria-label': 'ลบรูป',
                onclick: () => { receiptRemoved = true; receiptFile = null; receiptPreview.classList.add('hidden'); }
              }, icon('trash-2'))
            : null,
          fileInp
        )),
        field('โน้ต', noteInp)
      );
      renderValuesBox();
      updatePreview();
    }
  });
  setTimeout(() => titleInp.focus(), 60);
}
