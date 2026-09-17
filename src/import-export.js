/* ============================================================
   Fuji Trip — import-export.js
   CSV / XLSX / JSON / PNG / PDF (SheetJS + jsPDF + html-to-image)
   ============================================================ */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { api } from './firebase-client.js';
import { state } from './store.js';
import { el, toCSV, parseCSV, downloadBlob, downloadText, uid, sha256, num } from './utils.js';
import { toast } from './notifications.js';
import { openModal, field, textInput, refreshIcons, icon } from './components.js';
import { splitExpense } from './expense-calculator.js';
import { tripFx } from './settings.js';
import { buildSettlementPlan } from './settlement.js';

// ---------- เก็บข้อมูลทริปเป็น bundle (ไม่รวม PIN hash ด้วยเหตุผลความปลอดภัย) ----------
export function collectTripBundle() {
  const { pinHash: _pinHash, ...tripSafe } = state.trip || {};
  return {
    app: 'fuji-trip',
    version: 1,
    exportedAt: new Date().toISOString(),
    trip: tripSafe,
    members: state.members,
    itinerary: state.itinerary,
    expenses: state.expenses,
    settlements: state.settlements
  };
}

// ---------- JSON (สำรอง/กู้คืนทั้งทริป) ----------
export function exportTripJSON() {
  const bundle = collectTripBundle();
  downloadText(`fuji-trip-${bundle.trip?.id || 'backup'}.json`, JSON.stringify(bundle, null, 2), 'application/json');
  toast('ส่งออก JSON แล้ว', 'success');
}

export async function importTripJSON(file, pin) {
  const text = await file.text();
  const bundle = JSON.parse(text);
  if (bundle?.app !== 'fuji-trip' || !bundle.trip) {
    throw new Error('ไฟล์ไม่ใช่ไฟล์สำรองของ Fuji Trip');
  }
  if (!pin || !/^\d{4,8}$/.test(pin)) {
    throw new Error('ตั้ง PIN ใหม่ให้ทริปที่กู้คืน (ตัวเลข 4–8 หลัก)');
  }
  const newId = uid();
  await api.createTrip({
    id: newId,
    ...bundle.trip,
    id_unused: undefined,
    pinHash: await sha256(pin),
    members: (bundle.members || []).map((m) => ({ ...m, id: m.id || uid() }))
  });
  for (const it of bundle.itinerary || []) await api.saveItineraryItem(newId, it);
  for (const ex of bundle.expenses || []) await api.saveExpense(newId, ex);
  if (bundle.settlements?.length) await api.saveSettlements(newId, bundle.settlements);
  return newId;
}

// ---------- CSV (รายการค่าใช้จ่าย) ----------
export function exportExpensesCSV() {
  const members = state.members;
  const { rate } = tripFx(state.trip);
  const rows = [['date', 'title', 'category', 'amount_jpy', 'amount_thb_est', 'paid_by', 'split_mode', 'participants']];
  for (const e of [...state.expenses].sort((a, b) => (a.date || '').localeCompare(b.date || ''))) {
    rows.push([
      e.date,
      e.title,
      e.category,
      e.amount,
      rate ? Math.round(e.amount * rate) : '',
      members.find((m) => m.id === e.paidBy)?.name || e.paidBy,
      e.split?.mode || 'equal',
      (e.split?.members || []).map((id) => members.find((m) => m.id === id)?.name || id).join('|')
    ]);
  }
  // BOM ให้ Excel อ่านภาษาไทยถูก
  downloadBlob(`fuji-trip-expenses-${state.trip?.id || ''}.csv`, new Blob(['\uFEFF' + toCSV(rows)], { type: 'text/csv;charset=utf-8' }));
  toast('ส่งออก CSV แล้ว', 'success');
}

/** นำเข้าค่าใช้จ่ายจาก CSV: คอลัมน์ date,title,amount_jpy[,category] */
export async function importExpensesCSV(file) {
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('ไฟล์ CSV ไม่มีข้อมูล');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const iT = idx('title'), iA = idx('amount_jpy'), iD = idx('date'), iC = idx('category');
  if (iT < 0 || iA < 0) throw new Error('ต้องมีคอลัมน์ title และ amount_jpy');
  const paidBy = state.members[0]?.id;
  if (!paidBy) throw new Error('ยังไม่มีสมาชิกในทริป');
  const allIds = state.members.map((m) => m.id);
  let count = 0;
  for (const r of rows.slice(1)) {
    const amount = Math.round(num(r[iA], 0));
    const title = (r[iT] || '').trim();
    if (!title || !(amount > 0)) continue;
    await api.saveExpense(state.trip.id, {
      title,
      amount,
      date: iD >= 0 && r[iD] ? r[iD].trim() : state.trip.startDate,
      category: iC >= 0 && r[iC] ? r[iC].trim() : 'other',
      paidBy,
      split: { mode: 'equal', members: allIds }
    });
    count++;
  }
  return count;
}

// ---------- XLSX (Excel ครบทุกชีต) ----------
export function exportTripXLSX() {
  const trip = state.trip;
  const members = state.members;
  const { rate } = tripFx(trip);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
    ชื่อทริป: trip?.name, อีโมจิ: trip?.emoji, วันเริ่ม: trip?.startDate, วันจบ: trip?.endDate,
    'อัตรา (บาท/เยน)': rate, โน้ต: trip?.note || ''
  }]), 'ทริป');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    members.map((m) => ({ ชื่อ: m.name, อีโมจิ: m.emoji, บทบาท: m.role }))
  ), 'สมาชิก');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    [...state.itinerary]
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start || '99').localeCompare(b.start || '99'))
      .map((i) => ({ วันที่: i.date, เวลา: i.start || '', กิจกรรม: i.title, หมวด: i.category, 'นาที': i.durationMin || 0, สถานที่: i.placeName || '', พิกัด: i.lat != null ? `${i.lat},${i.lng}` : '', โน้ต: i.note || '' }))
  ), 'แผนการเดินทาง');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    [...state.expenses]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map((e) => {
        const { allocations } = splitExpense(e, members.map((m) => m.id));
        return {
          วันที่: e.date, รายการ: e.title, หมวด: e.category, 'ยอด (เยน)': e.amount,
          'ยอด (บาทโดยประมาณ)': rate ? Math.round(e.amount * rate) : '',
          จ่ายหน้า: members.find((m) => m.id === e.paidBy)?.name || e.paidBy,
          'แบ่งแบบ': e.split?.mode || 'equal',
          ...Object.fromEntries(members.map((m) => [m.name, allocations[m.id] ?? 0]))
        };
      })
  ), 'ค่าใช้จ่าย');

  const plan = buildSettlementPlan(state.expenses, members, state.settlements);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    plan.map((t) => ({
      จาก: members.find((m) => m.id === t.from)?.name || t.from,
      ถึง: members.find((m) => m.id === t.to)?.name || t.to,
      'ยอด (เยน)': t.amount,
      สถานะ: t.status === 'paid' ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'
    }))
  ), 'เคลียร์ยอด');

  XLSX.writeFile(wb, `fuji-trip-${trip?.id || ''}.xlsx`);
  toast('ส่งออก Excel แล้ว', 'success');
}

// ---------- PNG / PDF (จาก DOM node — ใช้กับ export sheet ของแผนทริป) ----------
export async function exportElementPNG(node, filename) {
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' });
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(filename, blob);
}

export async function exportElementPDF(node, filename, title = '') {
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 12;
  const imgW = pageW - margin * 2;
  const props = pdf.getImageProperties(dataUrl);
  const imgH = (props.height * imgW) / props.width;
  const topOffset = title ? 20 : margin;
  const availH = pageH - margin - topOffset;

  if (title) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(title.slice(0, 80), margin, 14);
  }
  if (imgH <= availH) {
    pdf.addImage(dataUrl, 'PNG', margin, topOffset, imgW, imgH);
  } else {
    let remaining = imgH;
    let position = topOffset;
    pdf.addImage(dataUrl, 'PNG', margin, position, imgW, imgH);
    remaining -= availH;
    while (remaining > 0) {
      pdf.addPage();
      position = margin - (imgH - remaining);
      pdf.addImage(dataUrl, 'PNG', margin, position, imgW, imgH);
      remaining -= pageH - margin * 2;
    }
  }
  pdf.setFontSize(8);
  pdf.setTextColor(150);
  pdf.text('Fuji Trip', margin, pageH - 5);
  pdf.save(filename);
}

// ---------- Modal รวมส่งออก/นำเข้า (เรียกจาก Dashboard) ----------
export function openExportModal() {
  if (!state.trip) return;
  const modal = openModal({
    title: 'ส่งออก / นำเข้าข้อมูล',
    body: (b) => {
      const jsonInp = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
      const csvInp = el('input', { type: 'file', accept: '.csv,text/csv', style: 'display:none' });
      const pinInp = textInput({ type: 'password', placeholder: 'ตั้ง PIN ให้ทริปที่กู้คืน (4–8 หลัก)', maxlength: '8' });

      const exportRow = (iconName, label, sub, onClick) => {
        const btn = el('button', { class: 'btn btn--ghost', style: 'width:100%; justify-content:flex-start; margin-bottom:8px', onclick: onClick },
          icon(iconName), el('span', { class: 'grow', style: 'text-align:start' }, label), el('span', { class: 'muted small' }, sub));
        return btn;
      };

      b.append(
        el('h3', {}, 'ส่งออก'),
        exportRow('file-json-2', 'ไฟล์สำรอง (JSON)', 'ทั้งทริป', () => exportTripJSON()),
        exportRow('file-spreadsheet', 'Excel (XLSX)', '5 ชีต', () => exportTripXLSX()),
        exportRow('file-text', 'CSV', 'เฉพาะค่าใช้จ่าย', () => exportExpensesCSV()),
        el('h3', { style: 'margin-top:14px' }, 'นำเข้า'),
        field('ตั้ง PIN ให้ทริปที่กู้คืน', pinInp),
        el('button', { class: 'btn btn--accent', style: 'width:100%', onclick: () => jsonInp.click() }, icon('upload'), 'กู้คืนจากไฟล์ JSON'),
        el('button', { class: 'btn btn--ghost mt-8', style: 'width:100%', onclick: () => csvInp.click() }, icon('upload'), 'นำเข้าค่าใช้จ่ายจาก CSV')
      );

      jsonInp.addEventListener('change', async () => {
        const f = jsonInp.files?.[0];
        if (!f) return;
        try {
          const newId = await importTripJSON(f, pinInp.value.trim());
          toast('กู้คืนทริปสำเร็จ', 'success');
          modal.close();
          location.hash = `#/trip/${newId}`;
        } catch (e) {
          toast(e.message || 'นำเข้าไม่สำเร็จ', 'error');
        }
      });
      csvInp.addEventListener('change', async () => {
        const f = csvInp.files?.[0];
        if (!f) return;
        try {
          const count = await importExpensesCSV(f);
          toast(`นำเข้า ${count} รายการแล้ว`, 'success');
          modal.close();
        } catch (e) {
          toast(e.message || 'นำเข้าไม่สำเร็จ', 'error');
        }
      });
      b.append(jsonInp, csvInp);
      refreshIcons();
    }
  });
  return modal;
}
