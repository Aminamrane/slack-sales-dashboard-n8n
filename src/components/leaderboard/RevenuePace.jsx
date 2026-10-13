import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { monthClock, projectToMonthEnd } from '../../utils/salesPace';

// Rythme du mois (dev 13/10/2026) : où en est le mois, comparé aux deux précédents AU MÊME JOUR, et où il finira au
// rythme actuel. Données : /api/v1/leaderboard/chart (cumul jour par jour de chaque mois, `current_day`).
// L'ancien badge comparait le cumul du mois en cours au TOTAL du mois précédent entier.
const COLORS = { current: '#6366f1', previous: '#fb923c', older: '#94a3b8' };
const euro = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const compact = (n) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000).toLocaleString('fr-FR')} k€` : `${Math.round(n)} €`);
const monthName = (offset) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - offset, 1).toLocaleDateString('fr-FR', { month: 'long' });
};
const capitalized = (word) => word.charAt(0).toUpperCase() + word.slice(1);
const valueAt = (series, day) => (series.length ? series[Math.min(day, series.length) - 1] : 0);

// Écart lisible : « +118 % » devient « ×2,2 » au-delà d'un doublement.
function gapLabel(current, reference) {
  if (!reference) return current ? 'nouveau' : '=';
  const ratio = current / reference;
  if (ratio >= 2) return `×${ratio.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}`;
  const pct = Math.round((ratio - 1) * 100);
  return `${pct > 0 ? '+' : ''}${pct} %`;
}

// Repère « aujourd'hui » : trait vertical et valeur de chaque mois au même jour.
const todayMarker = {
  id: 'ownerTodayMarker',
  afterDatasetsDraw(chart, _args, options) {
    const index = options?.index;
    if (index == null || index < 0) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x.getPixelForValue(index);
    ctx.save();
    ctx.strokeStyle = options.color;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top + 14);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = options.color;
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("aujourd'hui", x, chartArea.top + 8);
    chart.data.datasets.forEach((dataset) => {
      if (!dataset.markToday) return;
      const value = dataset.data[index];
      if (value == null) return;
      const y = scales.y.getPixelForValue(value);
      ctx.beginPath();
      ctx.arc(x, y, dataset.markToday === 'strong' ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = options.surface;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = dataset.borderColor;
      ctx.stroke();
    });
    ctx.restore();
  },
};

export default function RevenuePace({ chart, dark = false }) {
  const view = useMemo(() => {
    if (!chart?.current_month) return null;
    const series = (m) => (m?.data || []).map(d => d.value);
    const n0 = series(chart.current_month), n1 = series(chart.previous_month), n2 = series(chart.two_months_ago);
    const daysInMonth = n0.length || 31;
    const day = Math.min(chart.current_day || new Date().getDate(), daysInMonth);
    const today = valueAt(n0, day), previous = valueAt(n1, day), older = valueAt(n2, day);
    // Rythme sur le temps réellement écoulé (heure de Paris), même règle que le bandeau objectif.
    const projected = projectToMonthEnd(today, { ...monthClock(), daysInMonth }) ?? today;
    const previousTotal = n1.length ? n1[n1.length - 1] : 0;
    const length = Math.max(daysInMonth, n1.length, n2.length);
    const projection = Array.from({ length }, (_, i) =>
      (i + 1 < day || i + 1 > daysInMonth || day >= daysInMonth) ? null : today + ((projected - today) * (i + 1 - day)) / (daysInMonth - day));
    return { n0: n0.slice(0, day), n1, n2, day, daysInMonth, today, previous, older, projected, previousTotal, length, projection,
      names: { current: monthName(0), previous: monthName(1), older: monthName(2) } };
  }, [chart]);

  const data = useMemo(() => view && ({
    labels: Array.from({ length: view.length }, (_, i) => String(i + 1)),
    datasets: [
      { label: view.names.older, data: view.n2, borderColor: COLORS.older, borderWidth: 1.5, borderDash: [4, 4],
        pointRadius: 0, tension: 0.35, fill: false, markToday: 'soft' },
      { label: view.names.previous, data: view.n1, borderColor: COLORS.previous, borderWidth: 2,
        pointRadius: 0, tension: 0.35, fill: false, markToday: 'soft' },
      { label: 'Projection', data: view.projection, borderColor: 'rgba(99,102,241,.55)', borderWidth: 2, borderDash: [6, 5],
        pointRadius: 0, tension: 0, fill: false, spanGaps: false },
      { label: view.names.current, data: view.n0, borderColor: COLORS.current, borderWidth: 3, pointRadius: 0, tension: 0.35,
        fill: 'origin', markToday: 'strong',
        backgroundColor: (context) => {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return 'rgba(99,102,241,.12)';
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, dark ? 'rgba(129,140,248,.35)' : 'rgba(99,102,241,.22)');
          gradient.addColorStop(1, 'rgba(99,102,241,0)');
          return gradient;
        } },
    ],
  }), [view, dark]);

  const options = useMemo(() => view && ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutCubic' },
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 16, right: 6 } },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      ownerTodayMarker: { index: view.day - 1, color: dark ? '#cbd5e1' : '#475569', surface: dark ? '#020617' : '#ffffff' },
      tooltip: {
        filter: (item) => item.dataset.label !== 'Projection' || item.dataIndex === view.daysInMonth - 1,
        callbacks: {
          title: (items) => `Jour ${items[0].label}`,
          label: (item) => ` ${item.dataset.label} : ${euro(item.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: dark ? '#9ca3af' : '#6b7280', autoSkip: true, maxTicksLimit: 8, font: { size: 10 } } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: dark ? 'rgba(148,163,184,.12)' : '#eef2f7' },
        ticks: { color: dark ? '#9ca3af' : '#6b7280', maxTicksLimit: 5, font: { size: 10 }, callback: (v) => compact(v) } },
    },
  }), [view, dark]);

  if (!view) return <div className="rp-empty">Chargement du rythme du mois…</div>;

  const chips = [
    { name: view.names.previous, value: view.previous, color: COLORS.previous },
    { name: view.names.older, value: view.older, color: COLORS.older },
  ];
  const projectionGap = view.previousTotal ? gapLabel(view.projected, view.previousTotal) : null;

  return (
    <div className="rp">
      <div className="rp-head">
        <div>
          <div className="rp-label">Revenu signé · {view.names.current}</div>
          <div className="rp-value">{euro(view.today)}</div>
          <div className="rp-sub">au {view.day} {view.names.current} · jour {view.day} sur {view.daysInMonth}</div>
        </div>
        {view.day < view.daysInMonth && (
          <div className="rp-projection">
            <span>Projection fin de mois</span>
            <strong>≈ {euro(Math.round(view.projected / 1000) * 1000)}</strong>
            {projectionGap && <small>{view.names.previous} a fini à {euro(view.previousTotal)} ({projectionGap})</small>}
          </div>
        )}
      </div>
      <div className="rp-chips">
        {chips.map(c => {
          const delta = view.today - c.value;
          return (
            <span key={c.name} className={`rp-chip ${delta >= 0 ? 'is-up' : 'is-down'}`}>
              <i style={{ background: c.color }} />
              <b>{delta >= 0 ? '↑' : '↓'} {gapLabel(view.today, c.value)}</b>
              vs {c.name} au {view.day} ({euro(c.value)})
            </span>
          );
        })}
      </div>
      <div className="rp-chart">
        <Line data={data} options={options} plugins={[todayMarker]} />
      </div>
      <div className="rp-key">
        <span><i style={{ background: COLORS.current }} />{capitalized(view.names.current)}</span>
        <span><i style={{ background: COLORS.previous }} />{capitalized(view.names.previous)}</span>
        <span><i className="is-dashed" style={{ borderColor: COLORS.older }} />{capitalized(view.names.older)}</span>
        {view.day < view.daysInMonth && <span><i className="is-dashed" style={{ borderColor: COLORS.current }} />Projection au rythme actuel</span>}
      </div>
    </div>
  );
}
