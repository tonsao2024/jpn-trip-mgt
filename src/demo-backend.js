/* ============================================================
   Fuji Trip — demo-backend.js
   Backend จำลอง (ใช้เมื่อไม่ได้ตั้งค่า Firebase) — surface เดียวกับ
   realApi ทุกเมธอด เก็บข้อมูลใน localStorage พร้อมข้อมูลตัวอย่าง
   ============================================================ */

import { lsGet, lsSet, uid, sha256, addDaysISO, todayISO } from './utils.js';

const KEY = 'demo-db-v1';

let data = null;
const watchers = new Set(); // { tripId | '*', kind, fn }

async function ensureSeed() {
  if (data) return;
  data = lsGet(KEY, null);
  if (data) return;

  const t = todayISO();
  const d1 = addDaysISO(t, -1);
  const d2 = t;
  const d3 = addDaysISO(t, 1);
  const d4 = addDaysISO(t, 2);
  const d5 = addDaysISO(t, 3);

  data = {
    trips: {
      'demo-tokyo': {
        id: 'demo-tokyo',
        name: 'โตเกียว × ฟูจิ 5 วัน',
        emoji: '🗼',
        startDate: d1,
        endDate: d5,
        note: 'ทริปตัวอย่าง — PIN คือ 1234',
        pinHash: await sha256('1234'),
        createdAt: Date.now() - 86400000,
        settings: { fxRate: 0.222, feePct: 2.5, categories: null }
      }
    },
    members: {
      'demo-tokyo': [
        { id: 'demo-user', name: 'เจ้าของทริป', emoji: '🧑‍💼', role: 'admin', joinedAt: 1 },
        { id: 'm-mali', name: 'มะลิ', emoji: '🌸', role: 'member', joinedAt: 2 },
        { id: 'm-tara', name: 'ตาล', emoji: '🐯', role: 'member', joinedAt: 3 },
        { id: 'm-peat', name: 'พีท', emoji: '🍜', role: 'member', joinedAt: 4 }
      ]
    },
    itinerary: { 'demo-tokyo': [
      { id: 'i1', date: d1, start: '15:30', durationMin: 60, title: 'เช็คอินโรงแรมชินจูกุ', category: 'hotel', placeName: 'Hotel Gracery Shinjuku', lat: 35.6955, lng: 139.7016, note: 'เก็บกระเป๋าแล้วแวะ convenience store', order: 0, createdAt: 1 },
      { id: 'i2', date: d1, start: '18:00', durationMin: 90, title: 'อาหารค่ำโอโมอิเดะ โยโกโจ', category: 'food', placeName: 'Omoide Yokocho', lat: 35.6933, lng: 139.6999, note: 'ย่านร้านยากิโตริ', order: 1, createdAt: 2 },
      { id: 'i3', date: d2, start: '09:00', durationMin: 120, title: 'วัดเซนโซจิ + ถนนนากามิเสะ', category: 'sight', placeName: 'Senso-ji Temple', lat: 35.7148, lng: 139.7967, note: 'แวะชิมนิงกิโยซากุระ', order: 0, createdAt: 3 },
      { id: 'i4', date: d2, start: '12:00', durationMin: 60, title: 'กินซูชิที่ยูโอกาชิ', category: 'food', placeName: 'Ginza', lat: 35.6717, lng: 139.7650, note: '', order: 1, createdAt: 4 },
      { id: 'i5', date: d2, start: null, durationMin: 90, title: 'ช้อปปิ้งชิบุยะ + Don Quijote', category: 'shopping', placeName: 'Shibuya Scramble', lat: 35.6595, lng: 139.7005, note: 'รอตารางเวลาอัตโนมัติจัดให้', order: 2, createdAt: 5 },
      { id: 'i6', date: d3, start: '10:00', durationMin: 150, title: 'teamLab Planets', category: 'sight', placeName: 'Toyosu', lat: 35.6497, lng: 139.7899, note: 'จองตั๋วล่วงหน้าแล้ว', order: 0, createdAt: 6 },
      { id: 'i7', date: d3, start: null, durationMin: 90, title: 'เดินอากิฮาบาระ', category: 'shopping', placeName: 'Akihabara', lat: 35.7021, lng: 139.7728, note: '', order: 1, createdAt: 7 },
      { id: 'i8', date: d4, start: '08:30', durationMin: 300, title: 'ทะเลสาบคาวากุจิโกะ ชมฟูจิ', category: 'sight', placeName: 'Lake Kawaguchiko', lat: 35.5170, lng: 138.7720, note: 'นั่งรถไบรซ์ บัส', order: 0, createdAt: 8 },
      { id: 'i9', date: d5, start: '08:00', durationMin: 90, title: 'ตลาดปลาโตโยซุ', category: 'food', placeName: 'Toyosu Market', lat: 35.6497, lng: 139.7852, note: 'ข้าวไข่ปลาแซลมอน', order: 0, createdAt: 9 },
      { id: 'i10', date: d5, start: '17:00', durationMin: 90, title: 'Shibuya Sky ชมพระอาทิตย์ตก', category: 'sight', placeName: 'Shibuya Sky', lat: 35.6580, lng: 139.7016, note: 'ตั๋ว 18:00', order: 1, createdAt: 10 }
    ] },
    expenses: { 'demo-tokyo': [
      { id: 'e1', title: 'ค่าโรงแรม 4 คืน', category: 'hotel', date: d1, amount: 88000, paidBy: 'demo-user', split: { mode: 'equal', members: ['demo-user', 'm-mali', 'm-tara', 'm-peat'] }, note: 'จ่ายที่รีเซปชัน', receiptUrl: '', receiptPath: '' },
      { id: 'e2', title: 'JR Pass 7 วัน', category: 'transport', date: d1, amount: 50000, paidBy: 'demo-user', split: { mode: 'equal', members: ['demo-user', 'm-mali', 'm-tara', 'm-peat'] }, note: '', receiptUrl: '', receiptPath: '' },
      { id: 'e3', title: 'บุฟเฟต์ปลาดิบค่ำแรก', category: 'food', date: d1, amount: 12800, paidBy: 'm-mali', split: { mode: 'equal', members: ['demo-user', 'm-mali', 'm-tara', 'm-peat'] }, note: '', receiptUrl: '', receiptPath: '' },
      { id: 'e4', title: 'ตั๋ว teamLab Planets', category: 'ticket', date: d3, amount: 9600, paidBy: 'm-mali', split: { mode: 'equal', members: ['demo-user', 'm-mali', 'm-peat'] }, note: 'ตาลไม่ไป', receiptUrl: '', receiptPath: '' },
      { id: 'e5', title: 'ของฝากโตเกียวบานาน่า', category: 'shopping', date: d2, amount: 6300, paidBy: 'm-peat', split: { mode: 'equal', members: ['demo-user', 'm-mali', 'm-tara', 'm-peat'] }, note: '', receiptUrl: '', receiptPath: '' },
      { id: 'e6', title: 'ทัวร์ชมฟูจิ', category: 'ticket', date: d4, amount: 12000, paidBy: 'm-tara', split: { mode: 'percent', members: ['demo-user', 'm-mali', 'm-tara'], values: { 'demo-user': 40, 'm-mali': 30, 'm-tara': 30 } }, note: 'แบ่งไม่เท่ากันตามส่วน', receiptUrl: '', receiptPath: '' },
      { id: 'e7', title: 'ราเมงอิจิรัน', category: 'food', date: d2, amount: 2200, paidBy: 'm-peat', split: { mode: 'amounts', members: ['m-peat', 'm-mali'], values: { 'm-peat': 1300, 'm-mali': 900 } }, note: 'พีทเพิ่มไข่', receiptUrl: '', receiptPath: '' },
      { id: 'e8', title: 'กาแฟสด 2 แก้ว', category: 'food', date: d2, amount: 1200, paidBy: 'm-mali', split: { mode: 'equal', members: ['m-mali', 'm-tara'] }, note: '', receiptUrl: '', receiptPath: '' },
      { id: 'e9', title: 'เติม Suica กลุ่ม', category: 'transport', date: d2, amount: 5000, paidBy: 'demo-user', split: { mode: 'equal', members: ['demo-user', 'm-mali', 'm-tara', 'm-peat'] }, note: '', receiptUrl: '', receiptPath: '' }
    ] },
    settlements: { 'demo-tokyo': [] }
  };
  lsSet(KEY, data);
}

function persist() {
  lsSet(KEY, data);
  watchers.forEach((w) => {
    try { w.fn(slice(w.kind, w.tripId)); } catch (e) { console.error(e); }
  });
}

function slice(kind, tripId) {
  if (kind === 'trips') return Object.values(data.trips).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (data[kind]?.[tripId] || []).map((x) => ({ ...x }));
}

function watch(kind, tripId, cb) {
  const w = { kind, tripId, fn: cb };
  watchers.add(w);
  setTimeout(() => { try { cb(slice(kind, tripId)); } catch (e) { console.error(e); } }, 0);
  return () => watchers.delete(w);
}

function list(tripId) { return data.trips[tripId] || null; }

const demoApi = {
  mode: 'demo',

  watchTrips: (cb) => watch('trips', '*', cb),
  watchTrip: (tripId, cb) => {
    const w = { kind: 'trips', tripId: '*', fn: () => cb(list(tripId)) };
    watchers.add(w);
    setTimeout(() => cb(list(tripId)), 0);
    return () => watchers.delete(w);
  },
  async getTrip(tripId) { await ensureSeed(); return list(tripId); },

  async createTrip(d) {
    await ensureSeed();
    const id = d.id || uid();
    data.trips[id] = {
      id,
      name: d.name,
      emoji: d.emoji || '🗻',
      startDate: d.startDate,
      endDate: d.endDate,
      note: d.note || '',
      pinHash: d.pinHash,
      createdAt: Date.now(),
      settings: d.settings || {}
    };
    data.members[id] = (d.members || []).map((m) => ({ ...m, id: m.id || uid(), joinedAt: Date.now() }));
    data.itinerary[id] = [];
    data.expenses[id] = [];
    data.settlements[id] = [];
    persist();
    return id;
  },

  async updateTrip(tripId, patch) {
    await ensureSeed();
    if (data.trips[tripId]) data.trips[tripId] = { ...data.trips[tripId], ...patch };
    persist();
  },

  async updateTripPin(tripId, pinHash) {
    await ensureSeed();
    if (data.trips[tripId]) data.trips[tripId].pinHash = pinHash;
    persist();
  },

  async deleteTrip(tripId) {
    await ensureSeed();
    delete data.trips[tripId];
    delete data.members[tripId];
    delete data.itinerary[tripId];
    delete data.expenses[tripId];
    delete data.settlements[tripId];
    persist();
  },

  async joinTrip(tripId, pinHash, profile) {
    await ensureSeed();
    const trip = data.trips[tripId];
    if (!trip) throw Object.assign(new Error('ไม่พบทริป'), { code: 'not-found' });
    if (trip.pinHash !== pinHash) throw Object.assign(new Error('PIN ไม่ถูกต้อง'), { code: 'permission-denied' });
    const members = data.members[tripId] || [];
    const me = members.find((m) => m.id === 'demo-user');
    if (me) {
      me.name = profile.name || me.name;
      me.emoji = profile.emoji || me.emoji;
    } else {
      members.push({ id: 'demo-user', name: profile.name || 'สมาชิก', emoji: profile.emoji || '🙂', role: 'member', joinedAt: Date.now() });
      data.members[tripId] = members;
    }
    persist();
  },

  watchMembers: (tripId, cb) => watch('members', tripId, cb),

  async saveMember(tripId, m) {
    await ensureSeed();
    const members = data.members[tripId] || [];
    const found = members.find((x) => x.id === m.id);
    if (found) Object.assign(found, { name: m.name, emoji: m.emoji || '🙂', role: m.role || 'member' });
    else members.push({ ...m, joinedAt: Date.now() });
    data.members[tripId] = members;
    persist();
  },

  async removeMember(tripId, memberId) {
    await ensureSeed();
    data.members[tripId] = (data.members[tripId] || []).filter((m) => m.id !== memberId);
    persist();
  },

  watchItinerary: (tripId, cb) => watch('itinerary', tripId, cb),

  async saveItineraryItem(tripId, item) {
    await ensureSeed();
    const items = data.itinerary[tripId] || [];
    const id = item.id || uid();
    const rec = { ...item, id, updatedAt: Date.now() };
    const idx = items.findIndex((x) => x.id === id);
    if (idx >= 0) items[idx] = { ...items[idx], ...rec };
    else items.push({ ...rec, createdAt: Date.now() });
    data.itinerary[tripId] = items;
    persist();
    return id;
  },

  async deleteItineraryItem(tripId, itemId) {
    await ensureSeed();
    data.itinerary[tripId] = (data.itinerary[tripId] || []).filter((x) => x.id !== itemId);
    persist();
  },

  watchExpenses: (tripId, cb) => watch('expenses', tripId, cb),

  async saveExpense(tripId, e) {
    await ensureSeed();
    const items = data.expenses[tripId] || [];
    const id = e.id || uid();
    const rec = { ...e, id, amount: Math.round(Number(e.amount) || 0), updatedAt: Date.now() };
    const idx = items.findIndex((x) => x.id === id);
    if (idx >= 0) items[idx] = { ...items[idx], ...rec };
    else items.push(rec);
    data.expenses[tripId] = items;
    persist();
    return id;
  },

  async deleteExpense(tripId, expenseId) {
    await ensureSeed();
    data.expenses[tripId] = (data.expenses[tripId] || []).filter((x) => x.id !== expenseId);
    persist();
  },

  watchSettlements: (tripId, cb) => watch('settlements', tripId, cb),

  async saveSettlements(tripId, listToSave) {
    await ensureSeed();
    data.settlements[tripId] = (listToSave || []).map((s) => ({ ...s }));
    persist();
  },

  async uploadReceipt(tripId, file) {
    // โหมดตัวอย่าง: เก็บเป็น data URL ในหน่วยความจำชั่วคราว
    const readAsDataURL = () =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    const url = await readAsDataURL();
    return { url, path: `demo://receipts/${tripId}/${Date.now()}` };
  }
};

export const api = demoApi;

/** ล้างข้อมูลตัวอย่างทั้งหมด (ใช้ในหน้าตั้งค่า) */
export async function resetDemoData() {
  data = null;
  lsSet(KEY, null);
  await ensureSeed();
}
