import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';

let env;

const TRIP = 'trip1';
const ADMIN = 'admin-uid';
const ALICE = 'alice-uid';
const PIN_HASH = 'f'.repeat(64);

async function seedTrip() {
  // การสร้างทริป/tripPrivate ต้องมี custom claim admin = true ตาม rules
  const admin = env.authenticatedContext(ADMIN, { admin: true });
  await assertSucceeds(
    admin.firestore().doc(`trips/${TRIP}`).set({
      name: 'Tokyo Trip',
      emoji: '🗻',
      startDate: '2026-10-12',
      endDate: '2026-10-16',
      note: ''
    })
  );
  await assertSucceeds(
    admin.firestore().doc(`tripPrivate/${TRIP}`).set({ pinHash: PIN_HASH })
  );
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'fuji-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
  await seedTrip();
});

afterAll(async () => {
  await env.clearDatabase();
  await env.cleanup();
});

describe('Firestore Rules — trips', () => {
  it('ไม่ล็อกอิน → อ่านทริปไม่ได้', async () => {
    await assertFails(env.unauthenticatedContext().firestore().doc(`trips/${TRIP}`).get());
  });

  it('ล็อกอินแบบทั่วไป → อ่าน "ราย" ทริปด้วย id ที่รู้ได้', async () => {
    await assertSucceeds(env.authenticatedContext('bob').firestore().doc(`trips/${TRIP}`).get());
  });

  it('ผู้ใช้ทั่วไป list ทริปทั้งหมดไม่ได้ (เฉพาะผู้ดูแล)', async () => {
    await assertFails(env.authenticatedContext('bob').firestore().collection('trips').get());
    await assertSucceeds(env.authenticatedContext(ADMIN, { admin: true }).firestore().collection('trips').get());
  });

  it('ผู้ใช้ทั่วไป สร้าง/ลบ ทริปไม่ได้', async () => {
    const bob = env.authenticatedContext('bob');
    await assertFails(
      bob.firestore().doc('trips/trip2').set({ name: 'X', startDate: '2026-01-01', endDate: '2026-01-02' })
    );
    await assertFails(bob.firestore().doc(`trips/${TRIP}`).delete());
  });

  it('สมาชิกแก้ข้อมูลทริปไม่ได้ (เฉพาะผู้ดูแล)', async () => {
    await joinAsAlice();
    await assertFails(
      env.authenticatedContext(ALICE).firestore().doc(`trips/${TRIP}`).update({ name: 'แก้เอง' })
    );
  });
});

describe('Firestore Rules — การเข้าร่วมทริปด้วย PIN', () => {
  it('PIN hash ถูกต้อง → สร้างเอกสารสมาชิกของตัวเองสำเร็จ', async () => {
    await joinAsAlice();
  });

  it('PIN hash ผิด → ถูกปฏิเสธ', async () => {
    await assertFails(
      env
        .authenticatedContext('bob')
        .firestore()
        .doc(`trips/${TRIP}/members/bob`)
        .set({ pinHash: 'x'.repeat(64), name: 'Bob', emoji: '🙂', role: 'member' })
    );
  });

  it('สร้างเอกสารสมาชิกในชื่อคนอื่นไม่ได้', async () => {
    await assertFails(
      env
        .authenticatedContext('bob')
        .firestore()
        .doc(`trips/${TRIP}/members/${ALICE}`)
        .set({ pinHash: PIN_HASH, name: 'Fake', emoji: '🙂', role: 'member' })
    );
  });

  it('สมาชิกเปลี่ยน role ตัวเองเป็น admin ไม่ได้ แต่เปลี่ยนชื่อได้', async () => {
    await joinAsAlice();
    const alice = env.authenticatedContext(ALICE);
    await assertFails(
      alice.firestore().doc(`trips/${TRIP}/members/${ALICE}`).update({ role: 'admin' })
    );
    await assertSucceeds(
      alice.firestore().doc(`trips/${TRIP}/members/${ALICE}`).update({ name: 'อาลิส' })
    );
  });
});

describe('Firestore Rules — expenses', () => {
  it('สมาชิกเพิ่มค่าใช้จ่ายที่ถูกต้องได้', async () => {
    await joinAsAlice();
    await assertSucceeds(
      env.authenticatedContext(ALICE).firestore().doc(`trips/${TRIP}/expenses/e1`).set({
        title: 'ราเมง',
        category: 'food',
        date: '2026-10-12',
        amount: 2000,
        paidBy: ALICE,
        split: { mode: 'equal', members: [ALICE] }
      })
    );
  });

  it('ยอดติดลบ → ถูกปฏิเสธ', async () => {
    await assertFails(
      env.authenticatedContext(ALICE).firestore().doc(`trips/${TRIP}/expenses/bad`).set({
        title: 'ขายของ',
        category: 'food',
        date: '2026-10-12',
        amount: -500,
        paidBy: ALICE,
        split: { mode: 'equal', members: [ALICE] }
      })
    );
  });

  it('split mode แปลก ๆ → ถูกปฏิเสธ', async () => {
    await assertFails(
      env.authenticatedContext(ALICE).firestore().doc(`trips/${TRIP}/expenses/bad2`).set({
        title: 'แปลก',
        category: 'food',
        date: '2026-10-12',
        amount: 100,
        paidBy: ALICE,
        split: { mode: 'lottery', members: [ALICE] }
      })
    );
  });

  it('คนนอก (ยังไม่เป็นสมาชิก) เขียนค่าใช้จ่ายไม่ได้', async () => {
    await assertFails(
      env.authenticatedContext('stranger').firestore().doc(`trips/${TRIP}/expenses/str`).set({
        title: 'แอบเพิ่ม',
        category: 'food',
        date: '2026-10-12',
        amount: 100,
        paidBy: 'stranger',
        split: { mode: 'equal', members: ['stranger'] }
      })
    );
  });
});

describe('Firestore Rules — tripPrivate (PIN hash)', () => {
  it('client อ่าน tripPrivate ตรง ๆ ไม่ได้ แม้เป็นสมาชิก', async () => {
    await joinAsAlice();
    await assertFails(env.authenticatedContext(ALICE).firestore().doc(`tripPrivate/${TRIP}`).get());
  });
});

async function joinAsAlice() {
  if (joined) return;
  await assertSucceeds(
    env
      .authenticatedContext(ALICE)
      .firestore()
      .doc(`trips/${TRIP}/members/${ALICE}`)
      .set({ pinHash: PIN_HASH, name: 'Alice', emoji: '🌸', role: 'member' })
  );
  joined = true;
}

let joined = false;
