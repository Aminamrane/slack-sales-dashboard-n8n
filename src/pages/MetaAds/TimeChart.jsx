// src/pages/MetaAds/TimeChart.jsx — la courbe des métriques cochées, jour par jour.
//
// Une ligne fine par métrique, dans la couleur de sa tuile ; la première
// métrique porte l'axe de gauche, la deuxième l'axe de droite, les suivantes
// s'alignent sur un axe caché. Grille horizontale légère, infobulle blanche.

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { fmtShortDay } from './theme.js';

export default function TimeChart({ T, days, metrics, selected }) {
  const active = metrics.filter((m) => selected.includes(m.key));
  const labels = (days || []).map((d) => d.date);
  const data = useMemo(() => ({
    labels,
    datasets: active.map((m, i) => ({
      label: m.label,
      data: (days || []).map((d) => { const v = m.daily(d); return v == null || !Number.isFinite(v) ? null : v; }),
      yAxisID: i === 0 ? 'y' : i === 1 ? 'y1' : `y${i + 1}`,
      borderColor: m.color, backgroundColor: m.color, borderWidth: 2, tension: 0.2, pointRadius: 0, pointHoverRadius: 4,
      pointHoverBackgroundColor: m.color, pointHoverBorderColor: T.surface, pointHoverBorderWidth: 2, spanGaps: true, fill: false,
    })),
  }), [days, labels, active, T]);
  const options = useMemo(() => {
    const scales = {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: T.textFaint, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10, callback: (v, i) => fmtShortDay(labels[i]) } },
    };
    active.forEach((m, i) => {
      const id = i === 0 ? 'y' : i === 1 ? 'y1' : `y${i + 1}`;
      scales[id] = {
        position: i % 2 === 0 ? 'left' : 'right', display: i < 2, beginAtZero: true,
        grid: { display: i === 0, color: T.grid, drawTicks: false }, border: { display: false },
        ticks: { color: m.color, font: { size: 11 }, maxTicksLimit: 5, callback: (v) => m.fmt(v) },
        title: { display: i < 2, text: m.label, color: m.color, font: { size: 11, weight: '500' }, padding: { bottom: 4 } },
      };
    });
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, datalabels: { display: false },
        tooltip: {
          backgroundColor: T.tooltipBg, titleColor: T.tooltipText, bodyColor: T.tooltipMuted, borderColor: T.border, borderWidth: 1,
          padding: 10, cornerRadius: 6, displayColors: true, boxPadding: 4, usePointStyle: true, titleFont: { weight: '500', size: 12 }, bodyFont: { size: 12 },
          callbacks: {
            title: (items) => (items[0] ? fmtShortDay(items[0].label) : ''),
            label: (item) => { const m = active[item.datasetIndex]; return ` ${m.label} : ${item.raw == null ? '—' : m.fmt(item.raw)}`; },
          },
        },
      },
      scales,
    };
  }, [active, labels, T]);
  if (!labels.length) return <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textFaint, fontSize: 13 }}>Aucune donnée quotidienne sur cette période.</div>;
  if (!active.length) return <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textFaint, fontSize: 13 }}>Cochez une métrique pour tracer sa courbe.</div>;
  return <div style={{ height: 280 }}><Line data={data} options={options} /></div>;
}
