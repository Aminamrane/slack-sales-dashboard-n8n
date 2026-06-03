import React, { useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import Card from './Card';
import { fmtEur, fmtShortDate } from '../theme';

/**
 * Budget marketing quotidien — bar chart dédié (vs TrafficChart dans
 * lequel le budget est seulement un sous-onglet). Affiché plus haut dans
 * la page pour donner une lecture immédiate de la dépense ad par jour.
 * Tooltip flottant clean (ref image 4 style — pill blanc avec shadow).
 */
export default function BudgetByDayChart({ budgetByDay = [], C, darkMode }) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const days = useMemo(() => {
    return [...budgetByDay]
      .map((p) => ({ day: p.day, amount: parseFloat(p.amount) || 0 }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [budgetByDay]);

  const totalEur = useMemo(() => days.reduce((s, d) => s + d.amount, 0), [days]);
  const avgEur = useMemo(() => (days.length > 0 ? totalEur / days.length : 0), [totalEur, days.length]);
  const peakDay = useMemo(() => {
    if (days.length === 0) return null;
    return days.reduce((max, d) => (d.amount > max.amount ? d : max), days[0]);
  }, [days]);

  const data = useMemo(() => ({
    labels: days.map((d) => fmtShortDate(d.day)),
    datasets: [{
      label: 'Budget',
      data: days.map((d) => d.amount),
      backgroundColor: (ctx) => {
        const chart = ctx.chart;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return C.accentSoft;
        const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        grad.addColorStop(0, darkMode ? 'rgba(124,138,219,0.95)' : 'rgba(91,106,191,0.95)');
        grad.addColorStop(1, darkMode ? 'rgba(124,138,219,0.25)' : 'rgba(91,106,191,0.15)');
        return grad;
      },
      borderRadius: 10,
      borderSkipped: false,
      maxBarThickness: 36,
      hoverBackgroundColor: darkMode ? 'rgba(124,138,219,1)' : 'rgba(91,106,191,1)',
    }],
  }), [days, C, darkMode]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutCubic' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: (ctx) => {
          const { tooltip: t } = ctx;
          if (!t || t.opacity === 0) { setTooltip(null); return; }
          const idx = t.dataPoints?.[0]?.dataIndex;
          if (idx == null) return;
          const point = days[idx];
          if (!point) return;
          setTooltip({
            x: t.caretX,
            y: t.caretY,
            day: fmtShortDate(point.day),
            amount: fmtEur(point.amount),
          });
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: C.muted, font: { size: 11, weight: '500' }, maxRotation: 0 },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: { color: C.hairline, drawBorder: false },
        ticks: {
          color: C.muted,
          font: { size: 11 },
          callback: (val) => `${val}€`,
        },
        border: { display: false },
      },
    },
  }), [days, C]);

  if (days.length === 0) {
    return (
      <Card
        title="Budget marketing par jour"
        subtitle="Aucune dépense enregistrée sur la période"
        C={C}
      >
        <div style={{ padding: '32px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
          Saisis les budgets quotidiens plus bas pour activer la courbe.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Budget marketing par jour"
      subtitle={`Total ${fmtEur(totalEur)} · Moy. ${fmtEur(avgEur)}/jour${peakDay ? ` · Pic ${fmtEur(peakDay.amount)} le ${fmtShortDate(peakDay.day)}` : ''}`}
      C={C}
    >
      <div ref={containerRef} style={{ position: 'relative', height: 220, padding: '4px 0 0' }}>
        <Bar data={data} options={options} />
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x,
              top: tooltip.y - 12,
              transform: 'translate(-50%, -100%)',
              background: C.surface,
              border: `1px solid ${C.hairline}`,
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: C.text,
              boxShadow: '0 8px 24px rgba(15,18,30,0.10)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 4,
            }}
          >
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginBottom: 2 }}>{tooltip.day}</div>
            <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: C.accent }}>{tooltip.amount}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
