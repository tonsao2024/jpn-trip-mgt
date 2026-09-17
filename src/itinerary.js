/* ============================================================
   Fuji Trip — itinerary.js
   UI และ CRUD ของแผนการเดินทาง: day tabs, timeline, drag&drop,
   smart scheduling, ค้นหาสถานที่, ส่งออกวันเป็น PNG/PDF
   ============================================================ */

import { api } from './firebase-client.js';
import { state, subscribe } from './store.js';
import {
  el, fuji, fmtDateTH, fmtDateFullTH, eachDayISO, todayISO,
  endTimeHM, num, esc
} from './utils.js';
import { toast, confirmDialog } from './notifications.js';
import {
  topbar, emptyState, field, textInput, chipGroup, fab, refreshIcons,
  icon, openModal
} from './components.js';
import { tripCategories } from './settings.js';
import { findConflicts, suggestSchedule, tightTransitions, effectiveDuration } from './scheduling.js';
import { useTripData, tripNav } from './trips.js';
import { exportElementPNG, exportElementPDF } from './import-export.js';

const DUR_PRESETS = [15, 30, 60, 90, 120, 180, 240];
let dragId = null;

export function renderItineraryView(root, params) {
  const tripId = params.id;
  const cleanupData = useTripData(tripId);
  let selectedDay = null;

  const dayChips = el('div', { class: 'chips day-tabs' });
  const listBox = el('div', { class: 'timeline' });
  const summary = el('div', { class: 'muted small', style: 'margin:2px 2px 10px' });

  const paint = () => {
    const trip = state.trip;
    if (!trip) {
      listBox.replaceChildren(el('div', { class: 'skeleton', style: 'height:120px' }));
      return;
    }
    const days = eachDayISO(trip.startDate, trip.endDate);
    if (!days.length) return;
    if (!selectedDay || !days.includes(selectedDay)) {
      selectedDay = days.includes(todayISO()) ? todayISO() : days[0];
    }

    dayChips.replaceChildren();
    days.forEach((d, idx) => {
      const chip = el(
        'button',
        { class: `chip ${d === selectedDay ? 'active' : ''}`, type: 'button' },
        `วันที่ ${idx + 1}`,
        d === todayISO() ? ' · วันนี้' : '',
        ` ${fmtDateTH(d)}`
      );
      chip.onclick = () => { selectedDay = d; paint(); };
      dayChips.append(chip);
    });

    const items = state.itinerary.filter((i) => i.date === selectedDay);
    const timed = items.filter((i) => i.start).sort((a, b) => a.start.localeCompare(b.start));
    const untimed = items.filter((i) => !i.start).sort((a, b) => (a.order || 0) - (b.order || 0));
    const ordered = [...timed, ...untimed];
    const conflicts = findConflicts(items);
    const tips = tightTransitions(items);
    const loadMin = ordered.reduce((a, i) => a + effectiveDuration(i), 0);

    summary.textContent = `${ordered.length} กิจกรรม · รวม ~${Math.round(loadMin / 60)} ชม.` +
      (conflicts.length ? ` · ⚠️ ทับเวลา ${conflicts.length} จุด` : '') +
      (tips.length ? ` · 🚶 ช่วงเวลาเดินทางกระชั้น ${tips.length} ช่วง` : '');

    listBox.replaceChildren();
    if (!ordered.length) {
      listBox.append(emptyState({
        state: 'idle',
        title: 'ยังไม่มีกิจกรรมในวันนี้',
        sub: 'กดปุ่ม + ด้านล่างเพื่อเพิ่มกิจกรรม หรือกดปุ่มไม้กวาดด้านบนให้ระบบจัดเวลาให้',
        actionLabel: '+ เพิ่มกิจกรรม',
        onAction: () => openItemModal(tripId, null, selectedDay)
      }));
    }
    for (const item of ordered) listBox.append(tlItem(trip, item, conflicts, tips, tripId, selectedDay));
    refreshIcons();
  };

  const autoSchedule = async () => {
    const untimed = state.itinerary.filter((i) => !i.start);
    if (!untimed.length) {
      toast('ทุกกิจกรรมมีเวลาแล้ว ✨', 'info');
      return;
    }
    const ok = await confirmDialog({
      title: 'จัดเวลาให้อัตโนมัติ?',
      message: `ระบบจะจัดเวลาให้ ${untimed.length} กิจกรรม โดยต่อท้ายกิจกรรมที่มีเวลาอยู่แล้วของแต่ละวัน (เว้นช่วงพัก 15 นาที)`,
      okText: 'จัดเลย',
      mascot: 'happy'
    });
    if (!ok) return;
    const suggestions = suggestSchedule(state.itinerary, {});
    await Promise.all(suggestions.map((s) => {
      const item = state.itinerary.find((i) => i.id === s.id);
      return item ? api.saveItineraryItem(tripId, { ...item, start: s.start, durationMin: s.durationMin }) : null;
    }));
    const overflows = suggestions.filter((s) => s.overflow).length;
    if (overflows) toast(`จัดเวลาแล้ว แต่มี ${overflows} กิจกรรมเลย 22:00 — ลองย้ายไปวันอื่น`, 'warn');
    else toast('จัดเวลาให้ครบทุกกิจกรรมแล้ว ✨', 'success');
  };

  const exportDay = () => {
    const trip = state.trip;
    if (!trip) return;
    const sheet = buildExportSheetNode(trip, selectedDay);
    document.body.append(sheet);
    const modal = openModal({
      title: `ส่งออก ${fmtDateTH(selectedDay)}`,
      body: (b) => {
        b.append(el('p', { class: 'muted' }, 'เซฟแผนวันนี้เป็นรูปหรือ PDF เพื่อแชร์ในแชทกลุ่มได้เลย'));
        b.append(el('div', { class: 'row' },
          el('button', {
            class: 'btn btn--accent grow',
            onclick: async (e) => {
              e.currentTarget.disabled = true;
              try { await exportElementPNG(sheet, `fuji-trip-${selectedDay}.png`); toast('บันทึกรูปแล้ว', 'success'); }
              catch { toast('ส่งออกรูปไม่สำเร็จ', 'error'); }
              e.currentTarget.disabled = false;
            }
          }, icon('image'), 'PNG'),
          el('button', {
            class: 'btn btn--ghost grow',
            onclick: async (e) => {
              e.currentTarget.disabled = true;
              try { await exportElementPDF(sheet, `fuji-trip-${selectedDay}.pdf`, `${trip.name} — ${fmtDateFullTH(selectedDay)}`); toast('บันทึก PDF แล้ว', 'success'); }
              catch { toast('ส่งออก PDF ไม่สำเร็จ', 'error'); }
              e.currentTarget.disabled = false;
            }
          }, icon('file-text'), 'PDF')
        ));
      }
    });
    return modal;
  };

  root.append(
    topbar({
      title: 'แผนการเดินทาง',
      back: true,
      actions: [
        { icon: 'wand-2', label: 'จัดเวลาอัตโนมัติ', onClick: autoSchedule },
        { icon: 'image', label: 'ส่งออกวันนี้', onClick: exportDay }
      ]
    }),
    el('div', { class: 'content' }, dayChips, summary, listBox),
    fab({ lucide: 'plus', label: 'เพิ่มกิจกรรม', onClick: () => openItemModal(tripId, null, selectedDay) }),
    tripNav(tripId, 'itinerary')
  );

  paint();
  const unsub = subscribe(['itinerary', 'trip', 'members'], () => { paint(); refreshIcons(); });
  return () => { unsub(); cleanupData(); };
}

// ---------- การ์ดกิจกรรมใน timeline ----------
function tlItem(trip, item, conflicts, tips, tripId, selectedDay) {
  const cat = tripCategories(trip).find((c) => c.id === item.category);
  const conf = conflicts.find((c) => c.a.id === item.id || c.b.id === item.id);
  const tip = tips.find((t) => t.a.id === item.id || t.b.id === item.id);
  const other = conf ? (conf.a.id === item.id ? conf.b : conf.a) : null;

  const card = el('div', { class: 'tl-card' },
    el('div', { class: 'tl-head' },
      el('span', { class: 'tl-time num' },
        item.start ? `${item.start}${item.durationMin ? ` – ${endTimeHM(item.start, item.durationMin)}` : ''}` : 'ไม่มีเวลา'
      ),
      el('span', {}, cat?.emoji || '✨'),
      el('span', { class: 'tl-title' }, item.title),
      el('span', { class: 'badge' }, `${item.durationMin || effectiveDuration(item)} น.`)
    ),
    item.placeName
      ? el('div', { class: 'place-line' },
          icon('map-pin'),
          el('span', {}, item.placeName),
          item.lat != null
            ? el('a', {
                href: `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`,
                target: '_blank', rel: 'noopener', class: 'small', title: 'นำทาง'
              }, icon('navigation'))
            : null
        )
      : null,
    item.note ? el('div', { class: 'muted small', style: 'margin-top:4px' }, item.note) : null,
    conf && other ? el('div', { class: 'conflict-tip' }, `⚠️ ทับเวลากับ "${other.title}" (${conf.overlapMin} นาที)`) : null,
    tip ? el('div', { class: 'conflict-tip' }, `🚶 ช่วงพักระหว่างทางสั้นกว่าเวลาเดินทาง (~${tip.travelMin} นาที)`) : null
  );

  card.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    openItemModal(tripId, item, selectedDay);
  });

  const li = el('div', { class: `tl-item ${!item.start ? 'draggable' : ''}`, dataset: { id: item.id } }, card);
  if (!item.start) attachDragHandlers(li, tripId, selectedDay);
  return li;
}

// ---------- Drag & Drop (กิจกรรมที่ยังไม่มีเวลา) ----------
function attachDragHandlers(li, tripId, selectedDay) {
  li.draggable = true;
  li.addEventListener('dragstart', (e) => {
    dragId = li.dataset.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch { /* IE */ }
  });
  li.addEventListener('dragend', () => li.classList.remove('dragging'));
  li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drop-target'); });
  li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
  li.addEventListener('drop', async (e) => {
    e.preventDefault();
    li.classList.remove('drop-target');
    const srcId = dragId || e.dataTransfer?.getData('text/plain');
    dragId = null;
    if (!srcId || srcId === li.dataset.id) return;
    const untimed = state.itinerary
      .filter((i) => i.date === selectedDay && !i.start)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const from = untimed.findIndex((i) => i.id === srcId);
    const to = untimed.findIndex((i) => i.id === li.dataset.id);
    if (from < 0 || to < 0) return;
    const [moved] = untimed.splice(from, 1);
    untimed.splice(to, 0, moved);
    await Promise.all(untimed.map((it, idx) => (it.order !== idx ? api.saveItineraryItem(tripId, { ...it, order: idx }) : null)));
    toast('จัดลำดับแล้ว', 'success');
  });
}

// ---------- ค้นหาสถานที่ (OpenStreetMap Nominatim) ----------
async function searchPlaces(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=th&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('search failed');
  return res.json();
}

// ---------- Modal เพิ่ม/แก้ไขกิจกรรม ----------
async function openItemModal(tripId, item = null, dayISO = null) {
  const trip = state.trip;
  if (!trip) return;
  const isNew = !item;
  let category = item?.category || 'sight';
  let coords = { lat: item?.lat ?? null, lng: item?.lng ?? null };

  const titleInp = textInput({ value: item?.title || '', placeholder: 'เช่น วัดเซนโซจิ', maxlength: '80' });
  const catPick = chipGroup({
    options: tripCategories(trip).map((c) => ({ value: c.id, label: c.label, emoji: c.emoji })),
    value: category,
    onChange: (v) => { category = v; }
  });
  const dateInp = textInput({ type: 'date', value: item?.date || dayISO || trip.startDate });
  const startInp = textInput({ type: 'time', value: item?.start || '' });
  let dur = Number(item?.durationMin ?? 60);
  const durChips = chipGroup({
    options: DUR_PRESETS.map((m) => ({ value: String(m), label: `${m}` })),
    value: DUR_PRESETS.includes(dur) ? String(dur) : '',
    onChange: (v) => { dur = v ? Number(v) : 0; durCustom.value = ''; }
  });
  const durCustom = textInput({
    type: 'number', min: '0', step: '5', placeholder: 'นาที (กำหนดเอง)',
    value: !DUR_PRESETS.includes(dur) ? String(dur) : '', inputmode: 'numeric'
  });
  durCustom.addEventListener('input', () => { dur = num(durCustom.value, 0); });

  const placeInp = textInput({ value: item?.placeName || '', placeholder: 'เช่น Senso-ji' });
  const searchInp = textInput({ placeholder: 'ค้นหาสถานที่ด้วยชื่อ...', onInput: null });
  const resultBox = el('div');
  const coordLabel = el('div', { class: 'muted small' }, coordText());
  function coordText() {
    return coords.lat != null ? `พิกัด: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} ✓` : 'ยังไม่มีพิกัด (ใส่ก็ได้ ไม่ใส่ก็ได้)';
  }
  const doSearch = async () => {
    const q = searchInp.value.trim();
    if (!q) return;
    resultBox.replaceChildren(el('div', { class: 'muted small' }, 'กำลังค้นหา...'));
    try {
      const results = await searchPlaces(q);
      resultBox.replaceChildren();
      if (!results.length) resultBox.append(el('div', { class: 'muted small' }, 'ไม่พบสถานที่ — ลองพิมพ์ชื่อภาษาอังกฤษ'));
      results.forEach((r) => {
        resultBox.append(el('button', {
          class: 'chip', type: 'button', style: 'margin:0 6px 6px 0',
          onclick: () => {
            placeInp.value = String(r.display_name).split(',')[0];
            coords = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
            coordLabel.textContent = coordText();
            resultBox.replaceChildren();
          }
        }, '📍 ', String(r.display_name).slice(0, 60)));
      });
    } catch {
      resultBox.replaceChildren(el('div', { class: 'error-text' }, 'ค้นหาไม่สำเร็จ (ต้องต่ออินเทอร์เน็ต)'));
    }
  };
  searchInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
  const noteInp = el('textarea', { class: 'input', placeholder: 'โน้ต เช่น จองตั๋วล่วงหน้า' });
  noteInp.value = item?.note || '';

  const modal = openModal({
    title: isNew ? 'เพิ่มกิจกรรม' : 'แก้ไขกิจกรรม',
    wide: true,
    foot: [
      ...(isNew ? [] : [el('button', {
        class: 'btn btn--danger',
        onclick: async () => {
          if (await confirmDialog({ title: 'ลบกิจกรรมนี้?', message: item.title, okText: 'ลบ', danger: true })) {
            await api.deleteItineraryItem(tripId, item.id);
            toast('ลบกิจกรรมแล้ว', 'success');
            modal.close();
          }
        }
      }, icon('trash-2'), 'ลบ')]),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn btn--ghost', onclick: () => modal.close() }, 'ยกเลิก'),
      el('button', {
        class: 'btn',
        onclick: async (e) => {
          const title = titleInp.value.trim();
          if (!title) { toast('ใส่ชื่อกิจกรรมก่อน', 'warn'); return; }
          if (!dateInp.value) { toast('เลือกวันที่ก่อน', 'warn'); return; }
          e.currentTarget.disabled = true;
          try {
            await api.saveItineraryItem(tripId, {
              id: item?.id,
              date: dateInp.value,
              start: startInp.value || null,
              durationMin: dur,
              title,
              category,
              placeName: placeInp.value.trim(),
              lat: coords.lat,
              lng: coords.lng,
              note: noteInp.value.trim(),
              order: item?.order ?? maxOrderOf(tripId, dateInp.value)
            });
            toast(isNew ? 'เพิ่มกิจกรรมแล้ว' : 'บันทึกแล้ว', 'success');
            modal.close();
          } catch (err) {
            toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
            e.currentTarget.disabled = false;
          }
        }
      }, 'บันทึก')
    ],
    body: (b) => {
      b.append(
        field('ชื่อกิจกรรม', titleInp),
        field('หมวด', catPick.el),
        el('div', { class: 'row row--wrap' },
          el('div', { class: 'grow' }, field('วันที่', dateInp)),
          el('div', { class: 'grow' }, field('เวลาเริ่ม', startInp))
        ),
        field('ระยะเวลา (นาที)', el('div', {},
          el('div', { class: 'mb-8' }, durChips.el),
          durCustom
        )),
        field('ชื่อสถานที่', placeInp),
        field('ค้นหาพิกัดจาก OpenStreetMap', el('div', { class: 'row' },
          searchInp,
          el('button', { class: 'btn btn--ghost', type: 'button', onclick: doSearch }, icon('search'), 'ค้นหา')
        )),
        resultBox,
        el('div', { class: 'mt-8 mb-8' }, coordLabel),
        field('โน้ต', noteInp)
      );
    }
  });
  setTimeout(() => titleInp.focus(), 60);
}

function maxOrderOf(tripId, date) {
  const items = state.itinerary.filter((i) => i.date === date && !i.start);
  return items.reduce((a, i) => Math.max(a, Number(i.order) || 0), -1) + 1;
}

// ---------- แผ่น Export (ใช้ร่วมกับ import-export.js) ----------
export function buildExportSheetNode(trip, dayISO) {
  const items = state.itinerary
    .filter((i) => i.date === dayISO)
    .sort((a, b) => (a.start || '99').localeCompare(b.start || '99') || (a.order || 0) - (b.order || 0));
  const dayIdx = eachDayISO(trip.startDate, trip.endDate).indexOf(dayISO) + 1;

  const sheet = el('div', { class: 'export-sheet' },
    el('div', { class: 'ex-head' },
      (() => { const f = fuji('happy'); f.style.width = '44px'; f.style.height = '44px'; return f; })(),
      el('div', {},
        el('div', { style: 'font-weight:800; font-size:17px' }, `${trip.emoji || ''} ${trip.name}`),
        el('div', { style: 'color:#67707f; font-size:12.5px' }, `วันที่ ${dayIdx} · ${fmtDateFullTH(dayISO)}`)
      )
    )
  );
  if (!items.length) {
    sheet.append(el('div', { class: 'ex-item' }, '— วันนี้ยังไม่มีกิจกรรม —'));
    return sheet;
  }
  for (const i of items) {
    const cat = tripCategories(trip).find((c) => c.id === i.category);
    sheet.append(el('div', { class: 'ex-item' },
      el('span', { class: 'ex-time' }, i.start ? `${i.start}${i.durationMin ? `–${endTimeHM(i.start, i.durationMin)}` : ''}` : '—'),
      el('span', {},
        `${cat?.emoji || '✨'} ${esc(i.title)}`,
        i.placeName ? el('div', { style: 'color:#67707f; font-size:11.5px' }, `📍 ${esc(i.placeName)}`) : null,
        i.note ? el('div', { style: 'color:#67707f; font-size:11.5px' }, esc(i.note)) : null
      )
    ));
  }
  sheet.append(el('div', { style: 'margin-top:10px; color:#67707f; font-size:11px' }, 'สร้างด้วย Fuji Trip 🗻'));
  return sheet;
}
