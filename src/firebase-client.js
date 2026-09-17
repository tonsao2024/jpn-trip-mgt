/* ============================================================
   Fuji Trip — firebase-client.js
   Firebase Initialization + Client Services (ข้อ 37)
   - ถ้าไม่ได้ตั้งค่า VITE_FIREBASE_* จะสลับไปโหมด demo อัตโนมัติ
     (ข้อมูลจำลองเก็บใน localStorage — ใช้พรีวิว/ทดลองได้ทันที)
   - api คือ Data Access Layer เดียวที่โดเมนต่าง ๆ เรียกใช้
   ============================================================ */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  connectAuthEmulator
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, connectStorageEmulator } from 'firebase/storage';
import { uid } from './utils.js';
import * as demo from './demo-backend.js';

const env = import.meta.env || {};
export const FB_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

/** ตรวจว่าตั้งค่า Firebase ครบหรือยัง (แสดงในหน้าตั้งค่า) */
export function firebaseStatus() {
  const missing = Object.entries(FB_CONFIG)
    .filter(([k, v]) => k !== 'measurementId' && !v)
    .map(([k]) => k);
  return { ok: missing.length === 0, missing };
}

export const FB_MODE = firebaseStatus().ok ? 'firebase' : 'demo';

let auth = null;
let db = null;
let storage = null;

if (FB_MODE === 'firebase') {
  const app = initializeApp(FB_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  if (env.DEV && env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
}

export { auth, db, storage };

const ts = () => serverTimestamp();
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined));

// ------------------------------------------------------------------
// Firebase backend (ผ่าน rules: ผู้ดูแลครบทุกอย่าง, สมาชิกเฉพาะทริปตน)
// ------------------------------------------------------------------
const realApi = {
  mode: 'firebase',

  watchTrips(cb) {
    const q = query(collection(db, 'trips'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => { console.error('watchTrips:', err); cb([]); }
    );
  },

  watchTrip(tripId, cb) {
    return onSnapshot(
      doc(db, 'trips', tripId),
      (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null),
      (err) => { console.error('watchTrip:', err); cb(null); }
    );
  },

  async getTrip(tripId) {
    const s = await getDoc(doc(db, 'trips', tripId));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  },

  async createTrip(data) {
    const tripId = data.id || uid();
    const batch = writeBatch(db);
    batch.set(doc(db, 'trips', tripId), clean({
      name: data.name,
      emoji: data.emoji || '🗻',
      startDate: data.startDate,
      endDate: data.endDate,
      note: data.note || '',
      settings: data.settings || {},
      createdAt: ts(),
      createdBy: auth.currentUser?.uid || ''
    }));
    batch.set(doc(db, 'tripPrivate', tripId), { pinHash: data.pinHash });
    for (const m of data.members || []) {
      batch.set(doc(db, 'trips', tripId, 'members', m.id), clean({
        name: m.name, emoji: m.emoji || '🙂', role: m.role || 'member', joinedAt: ts()
      }));
    }
    await batch.commit();
    return tripId;
  },

  async updateTrip(tripId, patch) {
    await updateDoc(doc(db, 'trips', tripId), clean(patch));
  },

  async updateTripPin(tripId, pinHash) {
    await setDoc(doc(db, 'tripPrivate', tripId), { pinHash }, { merge: true });
  },

  async deleteTrip(tripId) {
    for (const sub of ['members', 'itinerary', 'expenses', 'settlements']) {
      const ss = await getDocs(collection(db, 'trips', tripId, sub));
      await Promise.all(ss.docs.map((d) => deleteDoc(d.ref)));
    }
    await deleteDoc(doc(db, 'tripPrivate', tripId)).catch(() => {});
    await deleteDoc(doc(db, 'trips', tripId));
  },

  /** เข้าร่วมทริปด้วย PIN — rules ตรวจ pinHash กับ tripPrivate ให้เอง (จริง ๆ ส่ง hash ไปเทียบ) */
  async joinTrip(tripId, pinHash, profile) {
    const u = auth.currentUser;
    if (!u) throw new Error('ยังไม่ได้ล็อกอิน');
    await setDoc(doc(db, 'trips', tripId, 'members', u.uid), clean({
      pinHash,
      name: profile.name || 'สมาชิก',
      emoji: profile.emoji || '🙂',
      role: 'member',
      joinedAt: ts()
    }));
  },

  watchMembers(tripId, cb) {
    return onSnapshot(
      collection(db, 'trips', tripId, 'members'),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => { console.error('watchMembers:', err); cb([]); }
    );
  },

  async saveMember(tripId, m) {
    await setDoc(doc(db, 'trips', tripId, 'members', m.id), clean({
      name: m.name, emoji: m.emoji || '🙂', role: m.role || 'member'
    }), { merge: true });
  },

  async removeMember(tripId, memberId) {
    await deleteDoc(doc(db, 'trips', tripId, 'members', memberId));
  },

  watchItinerary(tripId, cb) {
    return onSnapshot(
      collection(db, 'trips', tripId, 'itinerary'),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => { console.error('watchItinerary:', err); cb([]); }
    );
  },

  async saveItineraryItem(tripId, item) {
    const id = item.id || uid();
    await setDoc(doc(db, 'trips', tripId, 'itinerary', id), clean({
      date: item.date,
      start: item.start || null,
      durationMin: Number(item.durationMin) || 0,
      title: item.title,
      category: item.category || 'other',
      placeName: item.placeName || '',
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      note: item.note || '',
      order: Number(item.order) || 0,
      updatedAt: ts()
    }));
    return id;
  },

  async deleteItineraryItem(tripId, itemId) {
    await deleteDoc(doc(db, 'trips', tripId, 'itinerary', itemId));
  },

  watchExpenses(tripId, cb) {
    return onSnapshot(
      collection(db, 'trips', tripId, 'expenses'),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => { console.error('watchExpenses:', err); cb([]); }
    );
  },

  async saveExpense(tripId, e) {
    const id = e.id || uid();
    await setDoc(doc(db, 'trips', tripId, 'expenses', id), clean({
      title: e.title,
      category: e.category || 'other',
      date: e.date,
      amount: Math.round(Number(e.amount) || 0),
      paidBy: e.paidBy,
      split: e.split || { mode: 'equal', members: [] },
      note: e.note || '',
      receiptUrl: e.receiptUrl || '',
      receiptPath: e.receiptPath || '',
      updatedAt: ts()
    }));
    return id;
  },

  async deleteExpense(tripId, expenseId) {
    await deleteDoc(doc(db, 'trips', tripId, 'expenses', expenseId));
  },

  watchSettlements(tripId, cb) {
    return onSnapshot(
      collection(db, 'trips', tripId, 'settlements'),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => { console.error('watchSettlements:', err); cb([]); }
    );
  },

  /** บันทึกชุดการเคลียร์ยอด (แทนที่ทั้งชุด — id รูปแบบ from__to) */
  async saveSettlements(tripId, list) {
    const existing = await getDocs(collection(db, 'trips', tripId, 'settlements'));
    const want = new Map(list.map((s) => [s.id, s]));
    const batch = writeBatch(db);
    existing.docs.forEach((d) => { if (!want.has(d.id)) batch.delete(d.ref); });
    list.forEach((s) => batch.set(doc(db, 'trips', tripId, 'settlements', s.id), clean({
      from: s.from, to: s.to, amount: Math.round(Number(s.amount) || 0),
      status: s.status || 'pending', paidAt: s.paidAt || null
    })));
    await batch.commit();
  },

  async uploadReceipt(tripId, file) {
    const path = `receipts/${tripId}/${Date.now()}-${(file.name || 'receipt.jpg').replace(/[^\w.-]+/g, '_')}`;
    const r = ref(storage, path);
    await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' });
    const url = await getDownloadURL(r);
    return { url, path };
  }
};

export const api = FB_MODE === 'firebase' ? realApi : demo.api;

// ---- Auth helpers ที่ใช้ร่วม (auth.js เรียกต่อ) ----
export const fbAuth = {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut
};
