/* ============================================================
   Fuji Trip — trips.js
   Trip Selector, Trip CRUD, สมาชิกทริป และหน้าภาพรวม (Dashboard)
   ============================================================ */

import { api, FB_MODE } from './firebase-client.js';
import { state, setState, subscribe } from './store.js';
import {
  el, fuji, uid, sha256, fmtJPY, fmtTHB, fmtDateFullTH, fmtDateTH,
  eachDayISO, daysUntil, todayISO, dayNum
} from './utils.js';
import { toast, confirmDialog } from './notifications.js';
import {
  topbar, tile, emptyState, field, textInput, chipGroup, avatarEl,
  fab, sectionTitle, refreshIcons, icon, toneColors, openModal, bottomNav
} from './components.js';
import { tripFx, tripCategories } from './settings.js';
import { categoryTotals, memberBalances } from './expense-calculator.js';
import { findConflicts } from './scheduling.js';
import { openExpenseModal } from './expenses.js';
import { openExportModal } from './import-export.js';
import { logout } from './auth.js';

const TRIP_EMOJIS = ['🗻', '🗼', '⛩️', '🍣', '🍶', '🐼', '🦌', '🎢', '🌸', '🍠', '✈️', '🍙'];

/** ดูข้อมูลทริปปัจจุบันแบบ real-time — คืน cleanup สำหรับ router */
export function useTripData(tripId) {
  const unsubs = [
    api.watchTrip(tripId, (t) => setState({ trip: t })),
    api.watchMembers(tripId, (m) => setState({ members: m || [] })),
    api.watchItinerary(tripId, (x) => setState({ itinerary: x || [] })),
    api.watchExpenses(tripId, (x) => setState({ expenses: x || [] })),
    api.watchSettlements(tripId, (x) => setState({ settlements: x || [] }))
  ];
  return () => {
    unsubs.forEach((u) => { try { u(); } catch { /* ข้าม */ } });
    setState({ trip: null, members: [], itinerary: [], expenses: [], settlements: [] });
  };
}

// ============================================================
// หน้ารายการทริป (#/trips) — ผู้ดูแล
// ============================================================
export function renderTripsView(root) {
  const grid = el('div', { class: 'trip-grid' });

  const paint = () => {
    grid.replaceChildren();
    const trips = state.trips || [];
    if (!trips.length) {
      grid.append(emptyState({
        state: 'idle',
        title: 'ยังไม่มีทริป',
        sub: 'สร้างทริปแรกของคุณ แล้วแชร์รหัส + PIN ให้เพื่อนเข้าร่วม',
        actionLabel: '+ สร้างทริปใหม่',
        onAction: () => openTripModal()
      }));
      return;
    }
    for (const t of trips) grid.append(tripTile(t));
    refreshIcons();
  };

  root.append(
    topbar({
      title: 'ทริปของฉัน',
      actions: [
        { icon: 'settings', label: 'ตั้งค่า', onClick: () => (location.hash = '#/settings') },
        { icon: 'log-out', label: 'ออกจากระบบ', onClick: onLogout }
      ]
    }),
    el('div', { class: 'content' }, grid),
    fab({ lucide: 'plus', label: 'สร้างทริป', onClick: () => openTripModal() })
  );
  // ดึงรายการทริปแบบ real-time (firebase snapshot / demo emitter)
  const stopWatch = api.watchTrips((trips) => setState({ trips: trips || [] }));
  paint();
  const unsub = subscribe('trips', paint);
  return () => {
    unsub?.();
    try { stopWatch?.(); } catch { /* ข้าม */ }
  };
}

function tripTile(t) {
  const [c1, c2] = toneColors(t.id || t.name);
  const days = daysUntil(t.startDate);
  const pill =
    days > 1 ? `อีก ${days} วัน` :
    days === 1 ? 'พรุ่งนี้!' :
    days === 0 ? 'วันนี้ออกเดินทาง!' : null;

  const tileEl = el(
    'button',
    { class: 'trip-tile', type: 'button' },
    el('div', { class: 'trip-tile__cover', style: `--cv1:${c1};--cv2:${c2}` },
      el('span', { class: 'trip-tile__emoji' }, t.emoji || '🗻'),
      pill ? el('span', { class: 'countdown-pill' }, pill) : null
    ),
    el('div', { class: 'trip-tile__body' },
      el('div', { class: 'trip-tile__name' }, t.name),
      el('div', { class: 'muted small' }, `${fmtDateTH(t.startDate)} – ${fmtDateFullTH(t.endDate)}`),
      el('div', { class: 'row mt-8', style: 'gap:6px' },
        el('button', {
          class: 'icon-btn', 'aria-label': 'แก้ไขทริป', title: 'แก้ไข',
          onclick: (e) => { e.stopPropagation(); openTripModal(t); }
        }, icon('pencil')),
        el('button', {
          class: 'icon-btn icon-btn--danger', 'aria-label': 'ลบทริป', title: 'ลบ',
          onclick: async (e) => {
            e.stopPropagation();
            if (await confirmDialog({ title: `ลบทริป "${t.name}"?`, message: 'แผนการเดินทาง ค่าใช้จ่าย และสมาชิกทั้งหมดจะถูกลบถาวร', okText: 'ลบเลย', danger: true })) {
              await api.deleteTrip(t.id);
              toast('ลบทริปแล้ว', 'success');
            }
          }
        }, icon('trash-2')),
        el('span', { class: 'grow' }),
        el('span', { class: 'badge badge--accent' }, 'เปิดทริป →')
      )
    )
  );
  tileEl.onclick = () => (location.hash = `#/trip/${t.id}`);
  return tileEl;
}

// ---------- สร้าง/แก้ไขทริป ----------
export function openTripModal(trip = null) {
  const isEdit = !!trip;
  const nameInp = textInput({ value: trip?.name || '', placeholder: 'เช่น โตเกียว 5 วัน', maxlength: '80' });
  const startInp = textInput({ type: 'date', value: trip?.startDate || todayISO() });
  const endInp = textInput({ type: 'date', value: trip?.endDate || '' });
  const noteInp = textInput({ value: trip?.note || '', placeholder: 'โน้ตสั้น ๆ (ถ้ามี)', maxlength: '200' });
  const pinInp = isEdit
    ? textInput({ type: 'password', placeholder: 'เว้นว่าง = คง PIN เดิม', inputmode: 'numeric', maxlength: '8' })
    : textInput({ type: 'password', placeholder: 'ตัวเลข 4–8 หลัก', inputmode: 'numeric', maxlength: '8' });
  let emoji = trip?.emoji || '🗻';
  const emojiPick = chipGroup({
    options: TRIP_EMOJIS.map((e) => ({ value: e, label: e })),
    value: emoji,
    onChange: (v) => { emoji = v; }
  });

  const modal = openModal({
    title: isEdit ? 'แก้ไขทริป' : 'สร้างทริปใหม่',
    foot: [
      el('button', { class: 'btn btn--ghost', onclick: () => modal.close() }, 'ยกเลิก'),
      el('button', {
        class: 'btn',
        onclick: async (e) => {
          const btn = e.currentTarget;
          const name = nameInp.value.trim();
          if (!name) { toast('ตั้งชื่อทริปก่อน', 'warn'); return; }
          if (!startInp.value || !endInp.value || startInp.value > endInp.value) {
            toast('วันที่ไม่ถูกต้อง', 'warn');
            return;
          }
          const patch = {
            name, emoji,
            startDate: startInp.value,
            endDate: endInp.value,
            note: noteInp.value.trim()
          };
          btn.disabled = true;
          try {
            if (isEdit) {
              await api.updateTrip(trip.id, patch);
              const pin = pinInp.value.trim();
              if (pin) {
                if (pin.length < 4) throw new Error('PIN ต้องมี 4 หลักขึ้นไป');
                await api.updateTripPin(trip.id, await sha256(pin));
                toast('เปลี่ยน PIN เรียบร้อย', 'success');
              }
              toast('บันทึกทริปแล้ว', 'success');
            } else {
              const pin = pinInp.value.trim();
              if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
                throw new Error('PIN ต้องเป็นตัวเลข 4–8 หลัก');
              }
              await api.createTrip({
                id: uid(),
                ...patch,
                pinHash: await sha256(pin),
                members: [{ id: uid(), name: 'เจ้าของทริป', emoji: '🧑‍💼', role: 'admin' }],
                settings: { fxRate: state.appSettings.fxDefault, feePct: state.appSettings.feePct }
              });
              toast('สร้างทริปแล้ว แชร์รหัส + PIN ให้เพื่อนได้เลย', 'success');
            }
            modal.close();
          } catch (err) {
            toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
          } finally { btn.disabled = false; }
        }
      }, isEdit ? 'บันทึก' : 'สร้างทริป')
    ],
    body: (body) => {
      body.append(
        field('ชื่อทริป', nameInp),
        field('อีโมจิประจำทริป', emojiPick.el),
        el('div', { class: 'row' },
          el('div', { class: 'grow' }, field('วันเริ่มเดินทาง', startInp)),
          el('div', { class: 'grow' }, field('วันกลับ', endInp))
        ),
        field('โน้ต', noteInp),
        field(isEdit ? 'เปลี่ยน PIN ของทริป' : 'PIN สำหรับเพื่อนเข้าร่วม', pinInp,
          'PIN เก็บแบบ SHA-256 hash — ไม่มีใครอ่านได้จากฐานข้อมูล')
      );
    }
  });
}

async function onLogout() {
  if (await confirmDialog({ title: 'ออกจากระบบ?', okText: 'ออกเลย', mascot: 'idle' })) {
    await logout();
    location.hash = '#/login';
  }
}

// ============================================================
// หน้าภาพรวมทริป (#/trip/:id)
// ============================================================
export function renderTripDashboard(root, params) {
  const cleanupData = useTripData(params.id);
  const isAdmin = state.role === 'admin';

  const cardsGrid = el('div', { class: 'cards-grid' });
  const todayBox = el('div');
  const recentBox = el('div');
  const memberBox = el('div', { class: 'row row--wrap' });

  const paintDynamic = () => {
    const trip = state.trip;
    if (!trip) {
      cardsGrid.replaceChildren(el('div', { class: 'skeleton', style: 'height:96px' }));
      return;
    }
    const { rate, feePct } = tripFx(trip);
    const total = Object.values(categoryTotals(state.expenses)).reduce((a, b) => a + b, 0);
    const balances = memberBalances(state.expenses, state.members);
    const today = todayISO();
    const inRange = today >= trip.startDate && today <= trip.endDate;
    const focusDate = inRange ? today : (state.itinerary[0]?.date || trip.startDate);
    const todayItems = state.itinerary
      .filter((i) => i.date === focusDate)
      .sort((a, b) => (a.start || '99') .localeCompare(b.start || '99') || (a.order || 0) - (b.order || 0));
    const conflicts = findConflicts(state.itinerary.filter((i) => i.date === focusDate));

    cardsGrid.replaceChildren();
    const show = (k) => (trip.settings?.cards || state.appSettings.cards)?.[k] !== false;
    if (show('overview')) {
      cardsGrid.append(tile({
        emoji: '💰', title: 'ยอดรวมทั้งทริป', value: fmtJPY(total),
        sub: rate ? `≈ ${fmtTHB(total * rate * (1 + feePct / 100))}` : 'ยังไม่ตั้งอัตราแลกเปลี่ยน'
      }));
    }
    if (show('overview')) {
      const myId = state.session?.kind === 'member' && state.user?.uid ? state.user.uid : state.members[0]?.id;
      const mine = myId ? balances[myId] : null;
      cardsGrid.append(tile({
        emoji: '🧾', title: state.session?.kind === 'member' ? 'ส่วนที่ฉันรับผิดชอบ' : 'เฉลี่ยต่อคน',
        value: fmtJPY(mine ? mine.share : state.members.length ? Math.round(total / state.members.length) : 0),
        sub: mine ? (mine.net >= 0 ? `ได้คืน ${fmtJPY(mine.net)}` : `ต้องจ่ายเพิ่ม ${fmtJPY(-mine.net)}`) : `${state.members.length} คน`
      }));
    }
    if (show('today')) {
      cardsGrid.append(tile({
        emoji: '📅', title: inRange ? `แผนวันนี้ · วันที่ ${dayNum(focusDate, trip.startDate)}` : 'แผนวันแรก',
        value: `${todayItems.length} กิจกรรม`,
        sub: conflicts.length ? `⚠️ เวลาทับซ้อน ${conflicts.length} จุด` : fmtDateFullTH(focusDate),
        tone: conflicts.length ? 'warn' : '',
        onClick: () => (location.hash = `#/trip/${params.id}/itinerary`)
      }));
    }
    if (show('fx')) {
      cardsGrid.append(tile({
        emoji: '💱', title: 'อัตราแลกเปลี่ยน',
        value: rate ? `1¥ = ${rate.toFixed(3)}฿` : 'ยังไม่ตั้ง',
        sub: feePct ? `รวมค่าธรรมเนียม ${feePct}%` : 'ไม่มีค่าธรรมเนียม',
        onClick: () => (location.hash = `#/trip/${params.id}/settings`)
      }));
    }

    // แผนวันนี้
    todayBox.replaceChildren();
    todayBox.append(sectionTitle(
      `แผนการเดินทาง · ${fmtDateTH(focusDate)}`,
      el('a', { href: `#/trip/${params.id}/itinerary`, class: 'small' }, 'ดูทั้งหมด →')
    ));
    const tCard = el('div', { class: 'card card--flush' });
    if (!todayItems.length) {
      tCard.append(emptyState({ state: 'idle', title: 'วันนี้ยังไม่มีกิจกรรม', sub: 'เพิ่มกิจกรรมในแผนการเดินทางได้เลย' }));
    } else {
      todayItems.slice(0, 5).forEach((i) => {
        const cat = tripCategories(trip).find((c) => c.id === i.category);
        tCard.append(el('div', { class: 'list-row' },
          el('span', { style: 'font-size:20px' }, cat?.emoji || '✨'),
          el('div', { class: 'list-row__main' },
            el('div', { class: 'list-row__title' }, i.title),
            el('div', { class: 'list-row__sub' }, i.start ? `${i.start}${i.durationMin ? ` · ${i.durationMin} นาที` : ''}` : 'ยังไม่กำหนดเวลา')
          ),
          i.placeName ? el('span', { class: 'badge' }, '📍 ' + i.placeName.slice(0, 14)) : null
        ));
      });
    }
    todayBox.append(tCard);

    // ค่าใช้จ่ายล่าสุด
    recentBox.replaceChildren();
    recentBox.append(sectionTitle(
      'ค่าใช้จ่ายล่าสุด',
      el('a', { href: `#/trip/${params.id}/expenses`, class: 'small' }, 'ดูทั้งหมด →')
    ));
    const rCard = el('div', { class: 'card card--flush' });
    const recent = [...state.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
    if (!recent.length) {
      rCard.append(emptyState({ state: 'idle', title: 'ยังไม่มีรายจ่าย', sub: 'บันทึกค่าใช้จ่ายแรกกันเถอะ', actionLabel: '+ เพิ่มค่าใช้จ่าย', onAction: () => openExpenseModal() }));
    } else {
      recent.forEach((e2) => {
        const cat = tripCategories(trip).find((c) => c.id === e2.category);
        const payer = state.members.find((m) => m.id === e2.paidBy);
        rCard.append(el('div', { class: 'exp-row', onclick: () => openExpenseModal(e2) },
          el('div', { class: 'exp-emoji' }, cat?.emoji || '✨'),
          el('div', { class: 'list-row__main' },
            el('div', { class: 'list-row__title' }, e2.title),
            el('div', { class: 'list-row__sub' }, `${payer?.name || '?'} จ่าย · ${fmtDateTH(e2.date)}`)
          ),
          el('div', { class: 'exp-amount' }, el('b', {}, fmtJPY(e2.amount)))
        ));
      });
    }
    recentBox.append(rCard);

    // สมาชิก
    memberBox.replaceChildren();
    state.members.forEach((m) => memberBox.append(avatarEl(m)));
    if (isAdmin) {
      memberBox.append(el('button', { class: 'icon-btn', 'aria-label': 'จัดการสมาชิก', title: 'จัดการสมาชิก', onclick: () => openMembersModal(params.id) }, icon('user-plus')));
    }
  };

  const trip = state.trip;
  const countdown = trip ? countdownLabel(trip) : '';

  root.append(
    topbar({
      title: state.trip?.name || params.id,
      back: isAdmin,
      actions: [
        { icon: 'share-2', label: 'แชร์ทริป', onClick: () => openShareModal(params.id) },
        { icon: 'settings', label: 'ตั้งค่าทริป', onClick: () => (location.hash = `#/trip/${params.id}/settings`) },
        ...(state.session?.kind === 'member' ? [{ icon: 'log-out', label: 'ออกจากระบบ', onClick: onLogout }] : [])
      ]
    }),
    el('div', { class: 'content' },
      el('div', { class: 'dash-header' },
        dashFuji(trip),
        el('div', {},
          el('h1', {}, trip?.name || 'กำลังโหลด...'),
          el('div', { class: 'muted' }, trip ? `${fmtDateFullTH(trip.startDate)} – ${fmtDateFullTH(trip.endDate)}` : ' '),
          countdown ? el('span', { class: 'badge badge--accent mt-8' }, countdown) : null
        )
      ),
      cardsGrid,
      el('div', { class: 'row mt-16 row--wrap' },
        el('button', { class: 'btn', onclick: () => openExpenseModal() }, icon('wallet'), 'เพิ่มค่าใช้จ่าย'),
        el('a', { class: 'btn btn--ghost', href: `#/trip/${params.id}/settlement` }, icon('arrow-left-right'), 'เคลียร์ยอด'),
        el('button', { class: 'btn btn--ghost', onclick: () => openExportModal() }, icon('download'), 'ส่งออกข้อมูล')
      ),
      el('div', { class: 'mt-16' }, todayBox),
      el('div', {}, recentBox),
      el('div', { class: 'mt-16' },
        sectionTitle(`สมาชิกทริป (${state.members.length})`),
        el('div', { class: 'card' }, memberBox,
          el('div', { class: 'muted small mt-8' }, FB_MODE === 'demo'
            ? 'โหมดตัวอย่าง: เพื่อนเข้าร่วมด้วยรหัส demo-tokyo + PIN 1234'
            : 'เพื่อนเข้าร่วมด้วยรหัสทริป + PIN (ปุ่มแชร์ด้านบน)'))
      )
    ),
    tripNav(params.id, '')
  );

  paintDynamic();
  refreshIcons();
  const unsub = subscribe(['trip', 'members', 'expenses', 'itinerary'], () => {
    paintDynamic();
    refreshIcons();
  });
  return () => { unsub?.(); cleanupData(); };
}

function dashFuji(trip) {
  let st = 'idle';
  if (trip) {
    const t = todayISO();
    if (t < trip.startDate) st = 'happy';
    else if (t <= trip.endDate) st = 'loading';
  }
  const f = fuji(st, st === 'loading' ? 'fuji--loading' : '');
  f.style.width = '64px';
  f.style.height = '64px';
  return f;
}

function countdownLabel(trip) {
  const t = todayISO();
  if (t < trip.startDate) {
    const d = daysUntil(trip.startDate, t);
    return d === 1 ? 'พรุ่งนี้ออกเดินทาง!' : `อีก ${d} วันออกเดินทาง`;
  }
  if (t <= trip.endDate) return `วันที่ ${dayNum(t, trip.startDate)} / ${eachDayISO(trip.startDate, trip.endDate).length}`;
  return 'ทริปจบแล้ว — ขอบคุณที่ใช้ Fuji Trip';
}

function tripNav(tripId, active) {
  return bottomNav([
    { icon: 'calendar-days', label: 'ภาพรวม', href: `#/trip/${tripId}`, active: active === '' },
    { icon: 'map', label: 'แผน', href: `#/trip/${tripId}/itinerary`, active: active === 'itinerary' },
    { icon: 'map-pin', label: 'แผนที่', href: `#/trip/${tripId}/map`, active: active === 'map' },
    { icon: 'wallet', label: 'ค่าใช้จ่าย', href: `#/trip/${tripId}/expenses`, active: active === 'expenses' },
    { icon: 'chart-pie', label: 'สรุป', href: `#/trip/${tripId}/charts`, active: active === 'charts' }
  ]);
}
export { tripNav };

// ---------- แชร์ทริป ----------
function openShareModal(tripId) {
  const link = `${location.origin}${location.pathname}#/login?join=${tripId}`;
  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`คัดลอก${label}แล้ว`, 'success');
    } catch {
      toast('คัดลอกไม่สำเร็จ — คัดลอกเองจากข้อความ', 'warn');
    }
  };
  const modal = openModal({
    title: 'แชร์ทริปให้เพื่อน',
    body: (b) => {
      b.append(
        el('p', { class: 'muted' }, 'เพื่อนเปิดลิงก์แล้วกรอก PIN ของทริป ก็เข้าร่วมดูและบันทึกได้เลย'),
        field('ลิงก์เชิญ', textInput({ value: link, readonly: true })),
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--accent grow', onclick: () => copy(link, 'ลิงก์เชิญ') }, icon('copy'), 'คัดลอกลิงก์'),
          el('button', { class: 'btn btn--ghost', onclick: () => copy(tripId, 'รหัสทริป') }, icon('key-round'), 'คัดลอกรหัสทริป')
        )
      );
    }
  });
  return modal;
}

// ---------- จัดการสมาชิก (ผู้ดูแล) ----------
export function openMembersModal(tripId) {
  const modal = openModal({
    title: 'สมาชิกทริป',
    wide: true,
    body: (b) => {
      const listBox = el('div');
      const paint = () => {
        listBox.replaceChildren();
        for (const m of state.members) {
          const nameInp = textInput({ value: m.name || '', maxlength: '40', style: 'max-width:180px' });
          nameInp.addEventListener('change', () => {
            if (nameInp.value.trim() && nameInp.value !== m.name) {
              api.saveMember(tripId, { ...m, name: nameInp.value.trim() });
              toast('บันทึกชื่อสมาชิกแล้ว', 'success');
            }
          });
          listBox.append(el('div', { class: 'list-row' },
            avatarEl(m),
            el('div', { class: 'grow' }, nameInp),
            m.role === 'admin' ? el('span', { class: 'badge badge--accent' }, 'ผู้ดูแล') : null,
            el('span', { class: 'muted small' }, m.emoji || ''),
            m.role === 'admin' ? null : el('button', {
              class: 'icon-btn icon-btn--danger',
              'aria-label': 'ลบสมาชิก',
              onclick: async () => {
                if (await confirmDialog({ title: `ลบ ${m.name}?`, message: 'รายจ่ายที่คนนี้เกี่ยวข้องจะยังอยู่', danger: true })) {
                  await api.removeMember(tripId, m.id);
                }
              }
            }, icon('trash-2'))
          ));
        }
        if (!state.members.length) listBox.append(el('p', { class: 'muted' }, 'ยังไม่มีสมาชิก'));

        // ฟอร์มเพิ่มสมาชิก (คนที่ไม่ได้ใช้มือถือ เช่น ญาติผู้ใหญ่)
        let newEmoji = '🙂';
        const nameNew = textInput({ placeholder: 'ชื่อเล่น', maxlength: '40' });
        const emojiNew = chipGroup({
          options: ['🙂', '🌸', '🐯', '🍜', '🐻', '🦊'].map((e) => ({ value: e, label: e })),
          value: newEmoji,
          onChange: (v) => { newEmoji = v; }
        });
        listBox.append(el('div', { class: 'card mt-16', style: 'background:var(--card-2)' },
          el('b', { class: 'small' }, 'เพิ่มสมาชิก (แบบไม่ต้องมีมือถือ)'),
          el('div', { class: 'row mt-8 row--wrap' },
            nameNew, emojiNew.el,
            el('button', {
              class: 'btn btn--sm',
              onclick: () => {
                const name = nameNew.value.trim();
                if (!name) { toast('ใส่ชื่อก่อน', 'warn'); return; }
                api.saveMember(tripId, { id: uid(), name, emoji: newEmoji, role: 'member' });
                nameNew.value = '';
                toast('เพิ่มสมาชิกแล้ว', 'success');
              }
            }, 'เพิ่ม')
          )
        ));
        refreshIcons();
      };
      paint();
      b.append(listBox);
      subscribe('members', paint);
    }
  });
  return modal;
}
