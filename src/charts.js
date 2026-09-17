/* ============================================================
   Fuji Trip — charts.js
   Chart.js: ภาพรวม (หมวด/รายวัน) และรายบุคคล (จ่ายหน้า vs ส่วนแบ่ง)
   ============================================================ */

import Chart from 'chart.js/auto';
import { state, subscribe } from './store.js';
import { el, fmtJPY, eachDayISO, dayNum } from './utils.js';
import { topbar, segmented, selectInput, refreshIcons } from './components.js';
import { tripCategories } from './settings.js';
import { categoryTotals, dailyTotals, memberBalances } from './expense-calculator.js';
import { useTripData, tripNav } from './trips.js';

const PALETTE = ['#4a6fd4', '#d94343', '#2f8f6b', '#d99a2b', '#7a4ad4', '#d44a8f', '#3aa1b8', '#8a93a6'];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function renderChartsView(root, params) {
  const tripId = params.id;
  const cleanupData = useTripData(tripId);
  let tab = 'overview';
  let focusMember = state.members[0]?.id || '';
  let charts = [];

  const tabBox = el('div', { style: 'margin-bottom:12px' });
  const body = el('div');

  const destroyCharts = () => {
    charts.forEach((c) => { try { c.destroy(); } catch { /* ข้าม */ } });
    charts = [];
  };

  const paint = () => {
    const trip = state.trip;
    destroyCharts();
    body.replaceChildren();
    if (!trip) {
      body.append(el('div', { class: 'skeleton', style: 'height:240px' }));
      return;
    }
    const cats = tripCategories(trip);
    const textCol = cssVar('--text') || '#1f2430';
    const gridCol = cssVar('--line') || '#e4e8f1';
    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textCol, font: { family: "'Noto Sans Thai', sans-serif" } } } },
      scales: {
        x: { ticks: { color: textCol }, grid: { color: gridCol } },
        y: { ticks: { color: textCol }, grid: { color: gridCol } }
      }
    };

    if (tab === 'overview') {
      // โดนัทหมวดหมู่
      const totals = categoryTotals(state.expenses);
      const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
      const donutCard = el('div', { class: 'card chart-card' },
        el('h3', {}, 'ค่าใช้จ่ายตามหมวด'),
        el('div', { class: 'chart-box' }, el('canvas'))
      );
      body.append(donutCard);
      if (entries.length) {
        charts.push(new Chart(donutCard.querySelector('canvas'), {
          type: 'doughnut',
          data: {
            labels: entries.map(([id]) => `${cats.find((c) => c.id === id)?.emoji || '✨'} ${cats.find((c) => c.id === id)?.label || id}`),
            datasets: [{
              data: entries.map(([, v]) => v),
              backgroundColor: PALETTE,
              borderWidth: 0
            }]
          },
          options: {
            ...baseOpts,
            scales: {},
            cutout: '58%',
            plugins: {
              legend: { position: 'right', labels: { color: textCol } },
              tooltip: { callbacks: { label: (ctx) => ` ${fmtJPY(ctx.parsed)}` } }
            }
          }
        }));
      } else {
        donutCard.querySelector('.chart-box').replaceChildren(el('p', { class: 'muted', style: 'text-align:center; padding-top:90px' }, 'ยังไม่มีข้อมูลค่าใช้จ่าย'));
      }

      // กราฟรายวัน
      const days = eachDayISO(trip.startDate, trip.endDate);
      const daily = dailyTotals(state.expenses);
      const dailyCard = el('div', { class: 'card chart-card' },
        el('h3', {}, 'ค่าใช้จ่ายรายวัน (¥)'),
        el('div', { class: 'chart-box' }, el('canvas'))
      );
      body.append(dailyCard);
      charts.push(new Chart(dailyCard.querySelector('canvas'), {
        type: 'bar',
        data: {
          labels: days.map((d) => `วัน ${dayNum(d, trip.startDate)}`),
          datasets: [{
            label: 'เยน',
            data: days.map((d) => daily[d] || 0),
            backgroundColor: '#4a6fd4',
            borderRadius: 8
          }]
        },
        options: baseOpts
      }));
    } else {
      // รายบุคคล
      if (!state.members.length) {
        body.append(el('p', { class: 'muted' }, 'ยังไม่มีสมาชิก'));
        return;
      }
      if (!state.members.find((m) => m.id === focusMember)) focusMember = state.members[0].id;
      const balances = memberBalances(state.expenses, state.members);

      const compareCard = el('div', { class: 'card chart-card' },
        el('h3', {}, 'จ่ายหน้า vs ส่วนที่ควรจ่าย (¥)'),
        el('div', { class: 'chart-box chart-box--tall' }, el('canvas'))
      );
      body.append(compareCard);
      charts.push(new Chart(compareCard.querySelector('canvas'), {
        type: 'bar',
        data: {
          labels: state.members.map((m) => `${m.emoji} ${m.name}`),
          datasets: [
            { label: 'จ่ายหน้า', data: state.members.map((m) => balances[m.id]?.paid || 0), backgroundColor: '#4a6fd4', borderRadius: 7 },
            { label: 'ควรจ่าย', data: state.members.map((m) => balances[m.id]?.share || 0), backgroundColor: '#d94343', borderRadius: 7 }
          ]
        },
        options: baseOpts
      }));

      const member = state.members.find((m) => m.id === focusMember);
      const bal = balances[focusMember] || { paid: 0, share: 0, net: 0 };
      const memberCard = el('div', { class: 'card chart-card' },
        el('div', { class: 'spread' },
          el('h3', { style: 'margin:0' }, `รายบุคคล: ${member?.emoji || ''} ${member?.name || ''}`),
          selectInput(
            state.members.map((m) => ({ value: m.id, label: m.name })),
            focusMember,
            (v) => { focusMember = v; paint(); refreshIcons(); }
          )
        ),
        el('div', { class: 'cards-grid mt-8' },
          el('div', { class: 'tile' }, el('div', { class: 'tile__title' }, 'จ่ายหน้า'), el('div', { class: 'tile__value', style: 'font-size:17px' }, fmtJPY(bal.paid))),
          el('div', { class: 'tile' }, el('div', { class: 'tile__title' }, 'ควรจ่าย'), el('div', { class: 'tile__value', style: 'font-size:17px' }, fmtJPY(bal.share))),
          el('div', { class: 'tile' }, el('div', { class: 'tile__title' }, bal.net >= 0 ? 'ได้รับคืน' : 'ต้องจ่ายเพิ่ม'), el('div', { class: 'tile__value', style: `font-size:17px; color:${bal.net >= 0 ? 'var(--ok)' : 'var(--err)'}` }, fmtJPY(Math.abs(bal.net))))
        ),
        el('a', { class: 'btn btn--ghost btn--block mt-8', href: `#/trip/${tripId}/settlement` }, 'ดูแผนเคลียร์ยอด →')
      );
      body.append(memberCard);
    }
    refreshIcons();
  };

  const seg = segmented({
    options: [{ value: 'overview', label: 'ภาพรวม' }, { value: 'individual', label: 'รายบุคคล' }],
    value: tab,
    onChange: (v) => { tab = v; paint(); }
  });
  tabBox.append(seg);

  root.append(
    topbar({ title: 'สรุปและกราฟ', back: true }),
    el('div', { class: 'content' }, tabBox, body),
    tripNav(tripId, 'charts')
  );
  paint();
  const unsub = subscribe(['expenses', 'members', 'trip', 'appSettings'], paint);
  return () => {
    unsub();
    destroyCharts();
    cleanupData();
  };
}
