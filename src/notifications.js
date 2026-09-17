/* ============================================================
   Fuji Trip — notifications.js
   Fuji Toast, Alert/Confirm dialog และ Loading state
   (self-contained: พึ่งเฉพาะ utils เพื่อไม่มี circular import)
   ============================================================ */

import { el, fuji } from './utils.js';

const STATE_BY_TYPE = { success: 'happy', error: 'error', warn: 'warning', info: 'idle' };

let toastBox = null;
function toastBoxEl() {
  if (!toastBox) {
    toastBox = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastBox);
  }
  return toastBox;
}

/** Fuji Toast — type: 'info' | 'success' | 'warn' | 'error' */
export function toast(message, type = 'info', opts = {}) {
  const t = el(
    'div',
    { class: `toast toast--${type}`, role: 'status' },
    fuji(STATE_BY_TYPE[type] || 'idle'),
    el('span', { class: 'grow' }, message)
  );
  toastBoxEl().append(t);
  setTimeout(() => {
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 280);
  }, opts.timeout || 3400);
  return t;
}

let loadingEl = null;
export function showLoading(text = 'กำลังโหลด...') {
  if (!loadingEl) {
    loadingEl = el('div', { class: 'loading-overlay' });
    document.body.append(loadingEl);
  }
  loadingEl.replaceChildren(
    fuji('loading', 'fuji--loading'),
    el('div', { class: 'loading-overlay__text' }, text)
  );
}

export function hideLoading() {
  loadingEl?.remove();
  loadingEl = null;
}

/** กล่องยืนยัน — คืน Promise<boolean> */
export function confirmDialog({
  title = 'ยืนยัน',
  message = '',
  okText = 'ตกลง',
  cancelText = 'ยกเลิก',
  danger = false,
  mascot = 'warning'
} = {}) {
  return new Promise((resolve) => {
    const backdrop = el('div', { class: 'modal-backdrop' });
    const close = (val) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);

    const okBtn = el('button', { class: `btn ${danger ? 'btn--danger' : ''}` }, okText);
    okBtn.onclick = () => close(true);
    const foot = el('div', { class: 'row', style: 'justify-content:center; margin-top:16px' }, okBtn);
    if (cancelText) {
      const cancelBtn = el('button', { class: 'btn btn--ghost' }, cancelText);
      cancelBtn.onclick = () => close(false);
      foot.prepend(cancelBtn);
    }

    const modal = el(
      'div',
      { class: 'modal', style: 'width:min(400px,100%)' },
      el(
        'div',
        { class: 'modal__body', style: 'text-align:center; padding-top:24px' },
        fuji(mascot, danger ? 'fuji--warning' : ''),
        el('h3', { style: 'margin:10px 0 2px' }, title),
        message ? el('p', { class: 'muted', style: 'margin-bottom:0' }, message) : null,
        foot
      )
    );
    backdrop.append(modal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
    document.body.append(backdrop);
    okBtn.focus();
  });
}

/** กล่องแจ้งเตือนปุ่มเดียว */
export function alertDialog({ title = 'แจ้งเตือน', message = '', okText = 'รับทราบ', mascot = 'idle' } = {}) {
  return confirmDialog({ title, message, okText, cancelText: null, mascot: mascot === 'idle' ? 'idle' : mascot });
}
