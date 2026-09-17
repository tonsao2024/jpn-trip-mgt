/* ============================================================
   Fuji Trip — app.js
   Application Lifecycle: boot ระบบ, ธีม, หิมะ, splash และ router
   ============================================================ */

import { $ } from './utils.js';
import { loadAppSettings, setState } from './store.js';
import { applyTheme, applySnow } from './settings.js';
import { initAuthListener } from './auth.js';
import { startRouter } from './router.js';
import { FB_MODE } from './firebase-client.js';

function boot() {
  // 1) ตั้งค่าผู้ใช้ (ธีม/หิมะ) ก่อนเรนเดอร์
  const settings = loadAppSettings();
  applyTheme(settings.theme);
  applySnow(settings.snow);

  // 2) ระบบยืนยันตัวตน + router
  initAuthListener();
  startRouter(document.getElementById('app'));
  setState({ ready: true, mode: FB_MODE });

  // 3) ซ่อน splash
  const splash = $('#splash');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('splash--bye');
      setTimeout(() => splash.remove(), 420);
    }, 300);
  }

  // 4) บันทึกข้อผิดพลาดที่ไม่ถูกจับ (แสดงใน console อย่างเดียว)
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[FujiTrip] unhandled:', e.reason);
  });
  console.info(`%cFuji Trip%c โหมด: ${FB_MODE}`, 'font-weight:700;color:#d94343', '');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
