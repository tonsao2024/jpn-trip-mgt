/* ============================================================
   Fuji Trip — auth.js
   Admin Login, Member PIN Login และ Session + หน้า Login
   - ผู้ดูแล: Firebase Auth (email/password) + custom claim admin
   - สมาชิก: Anonymous Auth + PIN (SHA-256) → rules ตรวจกับ tripPrivate
   - โหมด demo: session อยู่ใน localStorage ทั้งหมด
   ============================================================ */

import { api, auth, fbAuth, FB_MODE } from './firebase-client.js';
import { state, setState } from './store.js';
import { el, fuji, sha256, lsGet, lsSet, lsDel, isEmail } from './utils.js';
import { toast } from './notifications.js';
import { topbar, chipGroup, field, textInput, refreshIcons } from './components.js';

export function initAuthListener() {
  setState({ mode: FB_MODE });
  if (FB_MODE === 'demo') {
    restoreSession();
    return;
  }
  fbAuth.onAuthStateChanged(auth, async (user) => {
    setState({ user });
    await resolveRole();
    if (!user) {
      setState({ session: null, role: null });
      lsDel('session');
    }
  });
}

async function resolveRole() {
  const user = state.user;
  if (!user) {
    setState({ role: null });
    return;
  }
  let claims = {};
  try {
    const token = await user.getIdTokenResult();
    claims = token.claims;
  } catch { /* ใช้ค่าว่าง */ }
  const saved = lsGet('session', null);
  if (claims.admin === true) {
    const s = { kind: 'admin', email: user.email || '' };
    lsSet('session', s);
    setState({ session: s, role: 'admin' });
  } else if (saved?.kind === 'member') {
    setState({ session: saved, role: 'member' });
  } else {
    setState({ session: null, role: null });
  }
}

export function friendlyAuthError(e) {
  const code = e?.code || '';
  const map = {
    'auth/unauthorized-domain': 'โดเมนนี้ยังไม่ได้รับอนุญาต — เพิ่มที่ Firebase Console → Authentication → Settings → Authorized domains',
    'auth/operation-not-allowed': 'ยังไม่ได้เปิดใช้วิธีล็อกอินนี้ — เปิดที่ Authentication → Sign-in method',
    'auth/admin-restricted-operation': 'ยังไม่ได้เปิดใช้ Anonymous Authentication ใน Firebase Console',
    'auth/configuration-not-found': 'ยังไม่ได้เปิดใช้ผู้ให้ยืนยันตัวตนนี้ใน Firebase Console',
    'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
    'auth/user-not-found': 'ไม่พบบัญชีนี้',
    'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง',
    'auth/too-many-requests': 'พยายามหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
    'auth/network-request-failed': 'เชื่อมต่อเครือข่ายไม่ได้ ลองตรวจอินเทอร์เน็ต'
  };
  return new Error(map[code] || e?.message || 'การยืนยันตัวตนล้มเหลว');
}

export async function adminLogin(email, password) {
  if (FB_MODE === 'demo') {
    if (!email || !password) throw new Error('กรอกอีเมลและรหัสผ่าน (โหมดตัวอย่างใส่อะไรก็ได้)');
    const s = { kind: 'admin', email, demo: true };
    lsSet('session', s);
    setState({ session: s, role: 'admin' });
    return;
  }
  try {
    await fbAuth.signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (e) {
    throw friendlyAuthError(e);
  }
  // ตรวจ custom claim admin
  const token = await auth.currentUser.getIdTokenResult();
  if (token.claims?.admin !== true) {
    await fbAuth.signOut(auth);
    throw new Error('บัญชีนี้ไม่ได้เป็นผู้ดูแล (ต้องตั้ง custom claim admin = true)');
  }
}

export async function memberLogin(tripId, pin, profile = {}) {
  if (!tripId) throw new Error('กรอกรหัสทริปก่อน');
  if (!pin || pin.length < 4) throw new Error('PIN ต้องมีอย่างน้อย 4 หลัก');
  const pinHash = await sha256(pin.trim());
  if (FB_MODE !== 'demo' && !auth.currentUser) {
    try {
      await fbAuth.signInAnonymously(auth);
    } catch (e) {
      throw friendlyAuthError(e);
    }
  }
  try {
    await api.joinTrip(tripId.trim(), pinHash, profile);
  } catch (e) {
    if (e?.code === 'permission-denied' || e?.code === 'not-found') {
      throw new Error('PIN ไม่ถูกต้อง หรือไม่พบทริปนี้');
    }
    throw e;
  }
  const s = { kind: 'member', tripId: tripId.trim(), name: profile.name || 'สมาชิก', emoji: profile.emoji || '🙂' };
  lsSet('session', s);
  setState({ session: s, role: 'member' });
}

export function restoreSession() {
  const s = lsGet('session', null);
  if (s?.kind === 'member') setState({ session: s, role: 'member' });
  else if (s?.kind === 'admin' && FB_MODE === 'demo') setState({ session: s, role: 'admin' });
}

export async function logout() {
  lsDel('session');
  setState({
    session: null, role: null, trip: null, trips: [],
    members: [], itinerary: [], expenses: [], settlements: []
  });
  if (FB_MODE === 'firebase') {
    try { await fbAuth.signOut(auth); } catch { /* ข้าม */ }
  }
}

// ============================================================
// หน้า Login
// ============================================================
const AVATAR_EMOJIS = ['🙂', '🌸', '🐯', '🍜', '🗻', '🍶', '✈️', '🐼', '🦊', '🌙', '⛩️', '🍡'];

export function renderLoginView(root) {
  const modeDemo = state.mode === 'demo';

  const adminForm = el('div', { class: 'hidden' },
    field('อีเมลผู้ดูแล', textInput({ type: 'email', placeholder: 'admin@example.com', inputmode: 'email' })),
    field('รหัสผ่าน', textInput({ type: 'password', placeholder: '••••••••' })),
    el('button', {
      class: 'btn btn--block',
      onclick: async (e) => {
        const btn = e.currentTarget;
        const card = btn.closest('.card');
        const email = card.querySelector('input[type=email]').value;
        const pw = card.querySelector('input[type=password]').value;
        if (!isEmail(email)) { toast('รูปแบบอีเมลไม่ถูกต้อง', 'warn'); return; }
        btn.disabled = true;
        try {
          await adminLogin(email, pw);
          toast('ยินดีต้อนรับผู้ดูแล', 'success');
          location.hash = '#/trips';
        } catch (err) {
          toast(err.message || 'ล็อกอินไม่สำเร็จ', 'error');
        } finally { btn.disabled = false; }
      }
    }, 'เข้าสู่ระบบผู้ดูแล'),
    el('p', { class: 'hint mt-8' },
      modeDemo
        ? 'โหมดตัวอย่าง: ใส่อีเมล/รหัสผ่านอะไรก็ได้เพื่อลองใช้งาน'
        : 'สิทธิ์ผู้ดูแลตรวจจาก custom claim "admin = true" (ตั้งใน Firebase Console)')
  );

  let pickedEmoji = '🙂';
  const tripIdInput = textInput({ placeholder: 'เช่น demo-tokyo (ได้จากลิงก์แชร์)', value: '' });
  const pinInput = textInput({ type: 'password', placeholder: 'ตัวเลข 4–8 หลัก', inputmode: 'numeric', maxlength: '8' });
  const nameInput = textInput({ placeholder: 'ชื่อเล่นของคุณ', maxlength: '40' });
  const emojiPicker = chipGroup({
    options: AVATAR_EMOJIS.map((e) => ({ value: e, label: e })),
    value: pickedEmoji,
    onChange: (v) => { pickedEmoji = v; }
  });

  const memberForm = el('div', { class: 'hidden' },
    field('รหัสทริป', tripIdInput, modeDemo ? 'ทริปตัวอย่าง: demo-tokyo (PIN 1234)' : 'ดูรหัสได้จากลิงก์เชิญของทริป'),
    field('PIN ของทริป', pinInput),
    field('ชื่อเล่น', nameInput),
    field('อีโมจิประจำตัว', emojiPicker.el),
    el('button', {
      class: 'btn btn--accent btn--block',
      onclick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await memberLogin(tripIdInput.value, pinInput.value, { name: nameInput.value.trim(), emoji: pickedEmoji });
          toast('เข้าร่วมทริปสำเร็จ', 'success');
          const s = state.session;
          location.hash = `#/trip/${s.tripId}`;
        } catch (err) {
          toast(err.message || 'เข้าร่วมไม่สำเร็จ', 'error');
        } finally { btn.disabled = false; }
      }
    }, 'เข้าร่วมทริปด้วย PIN')
  );

  const tabs = el('div', { class: 'login-tabs' },
    el('button', { class: 'btn btn--ghost active', type: 'button' }, 'สมาชิก (PIN)'),
    el('button', { class: 'btn btn--ghost', type: 'button' }, 'ผู้ดูแล')
  );
  const [tabMember, tabAdmin] = tabs.querySelectorAll('button');
  tabMember.classList.add('active');
  memberForm.classList.remove('hidden');
  tabMember.onclick = () => {
    memberForm.classList.remove('hidden');
    adminForm.classList.add('hidden');
    tabMember.classList.add('active');
    tabAdmin.classList.remove('active');
  };
  tabAdmin.onclick = () => {
    adminForm.classList.remove('hidden');
    memberForm.classList.add('hidden');
    tabAdmin.classList.add('active');
    tabMember.classList.remove('active');
  };

  root.append(
    topbar({ title: 'Fuji Trip', actions: [{ icon: 'info', label: 'เกี่ยวกับ', onClick: () => location.hash = '#/settings' }] }),
    el('div', { class: 'content' },
      el('div', { class: 'login-hero' },
        heroFuji(),
        el('h1', {}, 'Fuji Trip'),
        el('p', { class: 'muted' }, 'วางแผนทริปญี่ปุ่น · แผนการเดินทาง · ค่าใช้จ่าย · เคลียร์ยอด')
      ),
      el('div', { class: 'card login-card' },
        modeDemo ? el('div', { class: 'demo-banner' }, '🧪 โหมดตัวอย่าง — ข้อมูลจำลองเก็บในเครื่อง (ตั้งค่า Firebase ใน .env เพื่อใช้งานจริง)') : null,
        tabs,
        memberForm,
        adminForm
      ),
      el('p', { class: 'muted small text-end mt-16' }, state.mode === 'firebase' ? 'เชื่อมต่อ Firebase แล้ว' : 'ทำงานบนโหมดตัวอย่าง (localStorage)')
    )
  );
  refreshIcons();
}

function heroFuji() {
  const svg = fuji('happy', 'fuji--happy');
  svg.style.width = '112px';
  svg.style.height = '112px';
  return svg;
}
