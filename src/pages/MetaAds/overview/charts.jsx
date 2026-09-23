// src/pages/MetaAds/overview/charts.jsx — courbes de la vue d'ensemble (chart.js).
//
// Deux graphiques : la dépense et les leads jour par jour (aire navy + barres
// vertes, ventes attribuées en points), et les publicités lancées par semaine.
// Même librairie que la page Marketing, options réduites au strict lisible :
// pas de grille verticale, axes discrets, infobulle sombre.

import React, { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { Card, Legend, Empty } from './Card.jsx';
import { fmtEur, fmtInt, fmtShortDay } from '../theme.js';

const hexToRgba = (hex, a) => {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

function baseOptions(T) {
  return {
    responsive: true, maintainAspectRatio: false, animation: { duration: 650, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: T.isDark ? '#0d1327' : '#121b35', titleColor: '#eef1f8', bodyColor: '#c9d0e3',
        padding: 10, cornerRadius: 10, displayColors: true, boxPadding: 4, titleFont: { weight: '600' },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: T.textFaint, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
    },
  };
}

export function SpendLeadsChart({ T, daily, sales, index }) {
  const salesByDay = useMemo(() => {
    const m = {};
    (sales?.detail || []).forEach((s) => { if (s.date) m[s.date] = (m[s.date] || 0) + 1; });
    return m;
  }, [sales]);
  const labels = (daily || []).map((d) => d.date);
  const data = useMemo(() => ({
    labels,
    datasets: [
      { type: 'line', label: 'Dépense', data: (daily || []).map((d) => d.spend), yAxisID: 'y',
        borderColor: T.navy, backgroundColor: hexToRgba(T.isDark ? '#eef1f8' : '#121b35', T.isDark ? 0.08 : 0.07),
        fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, order: 2 },
      { type: 'bar', label: 'Leads', data: (daily || []).map((d) => d.leads), yAxisID: 'y1',
        backgroundColor: hexToRgba(T.green, 0.75), hoverBackgroundColor: T.green, borderRadius: 4, maxBarThickness: 18, order: 3 },
      { type: 'line', label: 'Ventes déclarées', data: labels.map((d) => salesByDay[d] || null), yAxisID: 'y1',
        showLine: false, pointRadius: (ctx) => (ctx.raw ? 5 : 0), pointHoverRadius: 6, pointBackgroundColor: T.green,
        pointBorderColor: T.surface, pointBorderWidth: 2, order: 1 },
    ],
  }), [daily, labels, salesByDay, T]);
  const options = useMemo(() => {
    const o = baseOptions(T);
    o.scales.x.ticks.callback = (v, i) => fmtShortDay(labels[i]);
    o.scales.y = { position: 'left', grid: { color: T.grid }, border: { display: false }, ticks: { color: T.textFaint, font: { size: 11 }, callback: (v) => fmtEur(v), maxTicksLimit: 5 } };
    o.scales.y1 = { position: 'right', grid: { display: false }, border: { display: false }, ticks: { color: T.textFaint, font: { size: 11 }, precision: 0, maxTicksLimit: 5 }, beginAtZero: true };
    o.plugins.tooltip.callbacks = {
      title: (items) => (items[0] ? fmtShortDay(items[0].label) : ''),
      label: (item) => (item.dataset.label === 'Dépense' ? ` Dépense : ${fmtEur(item.raw)}` : ` ${item.dataset.label} : ${fmtInt(item.raw)}`),
    };
    return o;
  }, [T, labels]);
  return (
    <Card T={T} index={index} title="Dépense et leads jour par jour" subtitle="Dépense Meta en aire, leads reçus en barres, ventes déclarées en points"
      right={<Legend T={T} items={[{ label: 'Dépense', color: T.navy }, { label: 'Leads', color: T.green }, { label: 'Ventes', color: T.green, round: true }]} />}>
      {labels.length === 0 ? <Empty T={T}>Aucune donnée quotidienne sur cette période.</Empty> : (
        <div style={{ height: 250 }}><Bar data={data} options={options} /></div>
      )}
    </Card>
  );
}

export function LaunchesChart({ T, launches, index }) {
  const labels = (launches || []).map((w) => w.week_start);
  const data = useMemo(() => ({
    labels,
    datasets: [{ label: 'Pubs lancées', data: (launches || []).map((w) => w.ads), borderColor: T.green,
      backgroundColor: hexToRgba(T.green, 0.14), fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: T.green,
      pointBorderColor: T.surface, pointBorderWidth: 2, borderWidth: 2 }],
  }), [launches, labels, T]);
  const options = useMemo(() => {
    const o = baseOptions(T);
    o.scales.x.ticks.callback = (v, i) => `sem. du ${fmtShortDay(labels[i])}`;
    o.scales.y = { grid: { color: T.grid }, border: { display: false }, ticks: { color: T.textFaint, font: { size: 11 }, precision: 0, maxTicksLimit: 5 }, beginAtZero: true };
    o.plugins.tooltip.callbacks = { title: (items) => (items[0] ? `Semaine du ${fmtShortDay(items[0].label)}` : ''), label: (item) => ` ${fmtInt(item.raw)} pub${item.raw > 1 ? 's' : ''} lancée${item.raw > 1 ? 's' : ''}` };
    return o;
  }, [T, labels]);
  const total = (launches || []).reduce((s, w) => s + (w.ads || 0), 0);
  return (
    <Card T={T} index={index} title="Publicités lancées" subtitle="Nouvelles publicités créées par semaine sur la période"
      right={<span style={{ fontSize: 22, fontWeight: 750, color: T.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(total)}</span>}>
      {labels.length === 0 ? <Empty T={T}>Aucune publicité créée sur cette période.</Empty> : (
        <div style={{ height: 200 }}><Line data={data} options={options} /></div>
      )}
    </Card>
  );
}
