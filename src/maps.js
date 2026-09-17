/* ============================================================
   Fuji Trip — maps.js
   Leaflet + OpenStreetMap: แผนที่ทริป, marker ตามวัน, เส้นทาง,
   ปุ่มนำทาง (Google Maps) และ map picker สำหรับฟอร์มกิจกรรม
   ============================================================ */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { state, subscribe } from './store.js';
import { el, eachDayISO, fmtDateTH, groupBy, esc } from './utils.js';
import { topbar, refreshIcons, icon, openModal } from './components.js';
import { useTripData, tripNav } from './trips.js';

const DAY_COLORS = ['#4a6fd4', '#d94343', '#2f8f6b', '#d99a2b', '#7a4ad4', '#d44a8f'];
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function navUrl(item) {
  if (item.lat != null && item.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName || item.title)}`;
}

export function renderMapView(root, params) {
  const tripId = params.id;
  const cleanupData = useTripData(tripId);
  let dayFilter = 'all';
  let map = null;
  const layer = L.layerGroup();

  const mapEl = el('div', { id: 'map' });
  const chips = el('div', { class: 'map-chips' });
  const listBox = el('div');

  const ensureMap = () => {
    if (map) return;
    map = L.map(mapEl, { scrollWheelZoom: true });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(map);
    layer.addTo(map);
    map.setView([35.6812, 139.7671], 11);
  };

  const paint = () => {
    const trip = state.trip;
    if (!trip) return;
    const days = eachDayISO(trip.startDate, trip.endDate);

    chips.replaceChildren();
    const chip = (val, label) => {
      const c = el('button', { class: `chip ${dayFilter === val ? 'active' : ''}`, type: 'button' }, label);
      c.onclick = () => { dayFilter = val; paint(); };
      return c;
    };
    chips.append(chip('all', 'ทุกวัน'));
    days.forEach((d, i) => chips.append(chip(d, `วัน ${i + 1} · ${fmtDateTH(d)}`)));

    ensureMap();
    layer.clearLayers();

    const items = state.itinerary.filter(
      (i) => i.lat != null && i.lng != null && (dayFilter === 'all' || i.date === dayFilter)
    );
    const bounds = [];
    const byDay = groupBy(items, (i) => i.date);
    for (const [date, list] of Object.entries(byDay)) {
      const dayIdx = days.indexOf(date);
      const color = DAY_COLORS[(dayIdx < 0 ? 0 : dayIdx) % DAY_COLORS.length];
      const pts = [...list].sort(
        (a, b) => (a.start || '99').localeCompare(b.start || '99') || (a.order || 0) - (b.order || 0)
      );
      const latlngs = [];
      pts.forEach((it, idx) => {
        const ll = [it.lat, it.lng];
        latlngs.push(ll);
        bounds.push(ll);
        const marker = L.marker(ll, {
          icon: L.divIcon({
            className: 'num-pin',
            html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 4px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:700 12.5px sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">${idx + 1}</span></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            popupAnchor: [0, -14]
          })
        });
        marker.bindPopup(
          `<div style="font:700 13.5px 'Noto Sans Thai',sans-serif">${esc(it.title)}</div>
           <div style="color:#67707f;font-size:12px;margin:2px 0 6px">${it.start ? `🕐 ${it.start}` : 'ไม่มีเวลา'} · วันที่ ${dayIdx + 1}</div>
           <a href="${navUrl(it)}" target="_blank" rel="noopener" style="font:600 12.5px sans-serif">🧭 นำทางด้วย Google Maps</a>`
        );
        layer.addLayer(marker);
      });
      if (latlngs.length > 1) {
        layer.addLayer(L.polyline(latlngs, { color, weight: 3, opacity: 0.65, dashArray: '5 9' }));
      }
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });

    // รายการสถานที่ใต้แผนที่
    listBox.replaceChildren();
    const sorted = [...items].sort(
      (a, b) => (a.date || '').localeCompare(b.date || '') || (a.start || '99').localeCompare(b.start || '99')
    );
    if (!sorted.length) {
      listBox.append(el('p', { class: 'muted', style: 'text-align:center' },
        'ยังไม่มีสถานที่ที่มีพิกัด — เพิ่มพิกัดให้กิจกรรมผ่านหน้าแผนการเดินทาง (ค้นหาสถานที่ในฟอร์มกิจกรรม)'));
    }
    sorted.forEach((it) => {
      const dayIdx = days.indexOf(it.date) + 1;
      listBox.append(el('div', { class: 'list-row' },
        el('span', { style: 'font-size:18px' }, '📍'),
        el('div', { class: 'list-row__main' },
          el('div', { class: 'list-row__title' }, it.title),
          el('div', { class: 'list-row__sub' }, `วันที่ ${dayIdx}${it.start ? ` · ${it.start}` : ''}${it.placeName ? ` · ${it.placeName}` : ''}`)
        ),
        el('a', { class: 'icon-btn', href: navUrl(it), target: '_blank', rel: 'noopener', title: 'นำทาง' }, icon('navigation'))
      ));
    });
    refreshIcons();
  };

  root.append(
    topbar({ title: 'แผนที่ทริป', back: true }),
    el('div', { class: 'map-page' },
      el('div', { class: 'map-wrap' }, mapEl, chips),
      el('div', { class: 'content', style: 'padding-top:10px' },
        el('div', { class: 'card card--flush', style: 'padding:6px 14px' }, listBox)
      ),
      el('div', { class: 'map-credit', style: 'text-align:center' }, 'แผนที่ © OpenStreetMap contributors')
    ),
    tripNav(tripId, 'map')
  );

  setTimeout(() => {
    paint();
    map?.invalidateSize();
  }, 60);
  const unsub = subscribe(['itinerary', 'trip'], () => {
    paint();
    map?.invalidateSize();
  });
  return () => {
    unsub();
    cleanupData();
    try { map?.remove(); } catch { /* ข้าม */ }
    map = null;
  };
}

// ---------- Map Picker (เลือกพิกัดในฟอร์มกิจกรรม) ----------
export function mapPickerModal(current = {}) {
  return new Promise((resolve) => {
    let picked = null;
    let marker = null;
    let miniMap = null;

    const modal = openModal({
      title: 'เลือกจุดบนแผนที่',
      onClose: () => {
        try { miniMap?.remove(); } catch { /* ข้าม */ }
        resolve(picked);
      },
      body: (b) => {
        const div = el('div', { class: 'mini-map' });
        b.append(
          el('p', { class: 'muted small', style: 'margin-bottom:8px' }, 'แตะหรือคลิกบนแผนที่เพื่อวางหมุด'),
          div,
          el('button', {
            class: 'btn btn--accent btn--block mt-8',
            onclick: () => {
              if (!picked) {
                resolve(null);
              }
              modal.close();
            }
          }, picked ? 'ใช้จุดนี้' : 'ปิด')
        );
        setTimeout(() => {
          miniMap = L.map(div).setView([current.lat || 35.6812, current.lng || 139.7671], current.lat ? 15 : 11);
          L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(miniMap);
          if (current.lat != null) {
            marker = L.marker([current.lat, current.lng]).addTo(miniMap);
            picked = { lat: current.lat, lng: current.lng };
          }
          miniMap.on('click', (e) => {
            picked = { lat: e.latlng.lat, lng: e.latlng.lng };
            if (marker) marker.setLatLng(e.latlng);
            else marker = L.marker(e.latlng).addTo(miniMap);
          });
          miniMap.invalidateSize();
        }, 80);
      }
    });
  });
}
