/* ============================================================
   Fuji Trip — router.js
   Hash Routing + Navigation Guard + จัดการ cleanup ของแต่ละหน้า
   ============================================================ */

import { state, setState } from './store.js';
import { el } from './utils.js';
import { renderLoginView } from './auth.js';
import { renderTripsView, renderTripDashboard } from './trips.js';
import { renderItineraryView } from './itinerary.js';
import { renderMapView } from './maps.js';
import { renderExpensesView } from './expenses.js';
import { renderSettlementView } from './settlement.js';
import { renderChartsView } from './charts.js';
import { renderTripSettingsView, renderAppSettingsView } from './settings.js';
import { refreshIcons, topbar, emptyState } from './components.js';

const ROUTES = [
  { path: '#/login', render: (root) => renderLoginView(root), public: true },
  { path: '#/trips', render: (root) => renderTripsView(root) },
  { path: '#/trip/:id', render: (root, p) => renderTripDashboard(root, p) },
  { path: '#/trip/:id/itinerary', render: (root, p) => renderItineraryView(root, p) },
  { path: '#/trip/:id/map', render: (root, p) => renderMapView(root, p) },
  { path: '#/trip/:id/expenses', render: (root, p) => renderExpensesView(root, p) },
  { path: '#/trip/:id/settlement', render: (root, p) => renderSettlementView(root, p) },
  { path: '#/trip/:id/charts', render: (root, p) => renderChartsView(root, p) },
  { path: '#/trip/:id/settings', render: (root, p) => renderTripSettingsView(root, p) },
  { path: '#/settings', render: (root) => renderAppSettingsView(root), tripOptional: true }
];

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const segments = raw.split('/').filter(Boolean);
  return { raw, segments };
}

function matchRoute(segments) {
  for (const r of ROUTES) {
    const pattern = r.path.replace(/^#\//, '').split('/');
    if (pattern.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].startsWith(':')) params[pattern[i].slice(1)] = decodeURIComponent(segments[i]);
      else if (pattern[i] !== segments[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

export function navigate(hash, { replace = false } = {}) {
  if (replace) location.replace(hash);
  else if (location.hash === hash) render();
  else location.hash = hash;
}

let cleanup = null;

export function startRouter(rootEl) {
  window.addEventListener('hashchange', render);
  if (!location.hash) location.replace('#/trips');
  render(rootEl);
}

function render(rootEl) {
  const root = rootEl || document.getElementById('app');
  const { segments } = parseHash();
  const matched = matchRoute(segments);

  // ---------- Guards ----------
  if (!state.session && (!matched || !matched.route.public)) {
    setState({ route: { path: '#/login', params: {} } });
    location.replace('#/login');
    return;
  }
  if (state.session && matched?.route.path === '#/login') {
    location.replace(state.role === 'member' ? `#/trip/${state.session.tripId}` : '#/trips');
    return;
  }
  if (state.role === 'member' && state.session?.tripId) {
    const onOtherTrip = segments[0] === 'trip' && segments[1] !== state.session.tripId;
    const onAdminArea = segments[0] === 'trips';
    if (onOtherTrip || onAdminArea || (segments[0] === 'settings' && false)) {
      location.replace(`#/trip/${state.session.tripId}`);
      return;
    }
  }

  // ---------- Render ----------
  if (cleanup) { try { cleanup(); } catch { /* ข้าม */ } cleanup = null; }
  root.replaceChildren();

  if (!matched) {
    root.append(
      topbar({ title: 'ไม่พบหน้า' }),
      el('div', { class: 'content' }, emptyState({ state: 'error', title: '404 — ไม่พบหน้านี้', sub: 'ลิงก์อาจผิดพลาด', actionLabel: 'กลับหน้าหลัก', onAction: () => location.replace(state.role === 'member' ? `#/trip/${state.session?.tripId || ''}` : '#/trips') }))
    );
    refreshIcons();
    return;
  }

  setState({ route: { path: matched.route.path, params: matched.params } });
  const ret = matched.route.render(root, matched.params);
  cleanup = typeof ret === 'function' ? ret : (ret && typeof ret.cleanup === 'function' ? ret.cleanup : null);
  refreshIcons();
  window.scrollTo({ top: 0 });
}
