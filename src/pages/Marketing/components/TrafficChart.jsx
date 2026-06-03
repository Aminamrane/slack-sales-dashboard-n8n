import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import Chart from 'chart.js/auto';
import Card from './Card';
import { fmtInt, fmtEur, fmtShortDate } from '../theme';

/**
 * Trafic & inscriptions chart card.
 * Tab toggle : "Trafic" (visitors + leads breakdown line) vs
 * "Budget / CPL" (bar + line combo).
 *
 * Floating tooltip is rendered as an HTML overlay (Chart.js external
 * tooltip handler) so we can style it exactly like the SaaS refs
 * (image 4 "New Customers / Returning" — clean white pill with shadow).
 */
export default function TrafficChart({ pageviews = [], leadsByDay = [], budgetByDay = [], C, darkMode }) {
  const [tab, setTab] = useState('traffic'); // 'traffic' | 'budget'
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  // ── Unified timeline by day ──────────────────────────────────────
  const merged = useMemo(() => {
    const allDays = new Set();
    pageviews.forEach((p) => allDays.add(p.date));
    leadsByDay.forEach((p) => allDays.add(p.day));
    budgetByDay.forEach((p) => allDays.add(p.day));
    const days = Array.from(allDays).sort();
    const pvMap = new Map(pageviews.map((p) => [p.date, p]));
    const leadsMap = new Map(leadsByDay.map((p) => [p.day, p]));
    const budgetMap = new Map(budgetByDay.map((p) => [p.day, parseFloat(p.amount) || 0]));

    return days.map((d) => {
      const pv = pvMap.get(d);
      const leadsPoint = leadsMap.get(d);
      const leads = leadsPoint?.count ?? 0;
      const leadsLanding = leadsPoint?.landing ?? 0;
      const leadsMeta = leadsPoint?.meta ?? 0;
      const leadsBroad = leadsPoint?.broad ?? 0;
      const budget = budgetMap.get(d) ?? 0;
      const cpl = leads > 0 ? Math.round((budget / leads) * 100) / 100 : null;
      return {
        date: d,
        visitors: pv?.visitors ?? 0,
        pageviews: pv?.pageviews ?? 0,
        leads,
        leadsLanding,
        leadsMeta,
        leadsBroad,
        budget,
        cpl,
      };
    });
  }, [pageviews, leadsByDay, budgetByDay]);

  // ── External tooltip handler (floating pill style) ───────────────
  const externalTooltipHandler = useCallback((context) => {
    const t = context.tooltip;
    if (!t || t.opacity === 0) {
      setTooltip(null);
      return;
    }
    const dataIndex = t.dataPoints?.[0]?.dataIndex;
    if (dataIndex === undefined) return;
    const row = merged[dataIndex];
    if (!row) return;
    const canvasRect = context.chart.canvas.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setTooltip({
      x: canvasRect.left - containerRect.left + t.caretX,
      y: canvasRect.top - containerRect.top + t.caretY,
      row,
    });
  }, [merged]);

  // ── Light / dark color picks for charts ──────────────────────────
  const gridColor = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,18,30,0.06)';
  const tickColor = C.muted;

  // ── TRAFFIC chart : visitors area + leads line + per-source overlays ──
  const trafficData = useMemo(() => ({
    labels: merged.map((r) => r.date),
    datasets: [
      {
        label: 'Visiteurs',
        data: merged.map((r) => r.visitors),
        borderColor: C.blue.strong,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return C.blue.bg;
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, C.blue.strong + '55');
          gradient.addColorStop(1, C.blue.strong + '00');
          return gradient;
        },
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: C.surface,
        pointHoverBorderColor: C.blue.strong,
        pointHoverBorderWidth: 2.5,
      },
      {
        label: 'Inscrits',
        data: merged.map((r) => r.leads),
        borderColor: C.emerald.strong,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return C.emerald.bg;
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, C.emerald.strong + '55');
          gradient.addColorStop(1, C.emerald.strong + '00');
          return gradient;
        },
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: C.surface,
        pointHoverBorderColor: C.emerald.strong,
        pointHoverBorderWidth: 2.5,
      },
    ],
  }), [merged, C]);

  const trafficOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: externalTooltipHandler,
      },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: tickColor,
          font: { size: 11, weight: 500 },
          maxRotation: 0,
          callback: function (val) {
            const label = this.getLabelForValue(val);
            return fmtShortDate(label);
          },
        },
        border: { display: false },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: tickColor, font: { size: 11, weight: 500 } },
        border: { display: false },
        beginAtZero: true,
      },
    },
  }), [tickColor, gridColor, externalTooltipHandler]);

  // ── BUDGET chart : 2 line + area (style Trafic) ─────────────────
  const budgetData = useMemo(() => ({
    labels: merged.map((r) => r.date),
    datasets: [
      {
        label: 'Budget €',
        data: merged.map((r) => r.budget),
        borderColor: C.violet.strong,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return C.violet.bg;
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, C.violet.strong + '55');
          gradient.addColorStop(1, C.violet.strong + '00');
          return gradient;
        },
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: C.surface,
        pointHoverBorderColor: C.violet.strong,
        pointHoverBorderWidth: 2.5,
        yAxisID: 'y',
      },
      {
        label: 'CPL',
        data: merged.map((r) => r.cpl),
        borderColor: C.amber.strong,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return C.amber.bg;
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, C.amber.strong + '40');
          gradient.addColorStop(1, C.amber.strong + '00');
          return gradient;
        },
        borderWidth: 2.5,
        tension: 0.4,
        spanGaps: true,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: C.surface,
        pointHoverBorderColor: C.amber.strong,
        pointHoverBorderWidth: 2.5,
        yAxisID: 'y1',
      },
    ],
  }), [merged, C]);

  const budgetOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false, external: externalTooltipHandler },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: tickColor,
          font: { size: 11, weight: 500 },
          maxRotation: 0,
          callback: function (val) {
            const label = this.getLabelForValue(val);
            return fmtShortDate(label);
          },
        },
        border: { display: false },
      },
      y: {
        position: 'left',
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: tickColor, font: { size: 11, weight: 500 }, callback: (v) => `${v}€` },
        border: { display: false },
        beginAtZero: true,
      },
      y1: {
        position: 'right',
        grid: { display: false },
        ticks: { color: tickColor, font: { size: 11, weight: 500 }, callback: (v) => `${v}€` },
        border: { display: false },
        beginAtZero: true,
      },
    },
  }), [tickColor, gridColor, externalTooltipHandler]);

  const isEmpty = merged.length === 0;

  // ── Tabs (segmented control top-right) ───────────────────────────
  const tabs = [
    { key: 'traffic', label: 'Trafic & inscrits' },
    { key: 'budget', label: 'Budget & CPL' },
  ];

  const TabsControl = (
    <div style={{
      display: 'inline-flex',
      gap: 4,
      padding: 4,
      background: C.subtle,
      borderRadius: 10,
      border: `1px solid ${C.hairline}`,
    }}>
      {tabs.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setTooltip(null); }}
            style={{
              padding: '5px 12px',
              borderRadius: 7,
              border: 'none',
              background: active ? C.surface : 'transparent',
              color: active ? C.text : C.muted,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: active ? C.shadow : 'none',
              transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <Card title="Trafic & inscriptions" subtitle="Fenêtre courante par jour" C={C} action={TabsControl} noPadding>
      <div ref={containerRef} style={{ position: 'relative', height: 280, padding: '20px 24px 12px' }}>
        {isEmpty ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: C.muted,
            fontSize: 14,
            fontWeight: 500,
          }}>
            Aucune donnée sur la fenêtre sélectionnée.
          </div>
        ) : tab === 'traffic' ? (
          <Line data={trafficData} options={trafficOptions} />
        ) : (
          <Line data={budgetData} options={budgetOptions} />
        )}

        {tooltip && tab === 'traffic' && (
          <FloatingTooltip
            x={tooltip.x}
            y={tooltip.y}
            C={C}
            rows={[
              { label: 'Visiteurs', value: fmtInt(tooltip.row.visitors), color: C.blue.strong },
              { label: 'Inscrits', value: fmtInt(tooltip.row.leads), color: C.emerald.strong },
              ...(tooltip.row.leadsLanding > 0 ? [{ label: '↳ Landing', value: fmtInt(tooltip.row.leadsLanding), color: C.blue.fg, faded: true }] : []),
              ...(tooltip.row.leadsMeta > 0 ? [{ label: '↳ Meta', value: fmtInt(tooltip.row.leadsMeta), color: C.fuchsia.fg, faded: true }] : []),
              ...(tooltip.row.leadsBroad > 0 ? [{ label: '↳ Broad', value: fmtInt(tooltip.row.leadsBroad), color: C.amber.fg, faded: true }] : []),
            ]}
            label={fmtShortDate(tooltip.row.date)}
          />
        )}
        {tooltip && tab === 'budget' && (
          <FloatingTooltip
            x={tooltip.x}
            y={tooltip.y}
            C={C}
            rows={[
              { label: 'Budget', value: fmtEur(tooltip.row.budget), color: C.violet.strong },
              { label: 'CPL', value: tooltip.row.cpl !== null ? fmtEur(tooltip.row.cpl, { decimals: 2 }) : '—', color: C.amber.strong },
              { label: 'Inscrits', value: fmtInt(tooltip.row.leads), color: C.muted, faded: true },
            ]}
            label={fmtShortDate(tooltip.row.date)}
          />
        )}
      </div>
    </Card>
  );
}

/** Floating chart tooltip (ref image 4 style — clean white pill, soft shadow). */
function FloatingTooltip({ x, y, label, rows, C }) {
  const TOOLTIP_W = 180;
  // Clamp position so it doesn't escape the chart edges (basic centering)
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, calc(-100% - 18px))',
        background: C.surface,
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: TOOLTIP_W,
        boxShadow: C.shadowFloat,
        border: `1px solid ${C.hairline}`,
        pointerEvents: 'none',
        zIndex: 5,
        fontFamily: 'inherit',
        animation: 'mktNumberTick 0.18s ease-out both',
      }}
    >
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 6,
      }}>
        {label}
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 3,
          opacity: r.faded ? 0.75 : 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 50,
              background: r.color,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
              {r.label}
            </span>
          </div>
          <span style={{
            fontSize: 13,
            color: C.text,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}
