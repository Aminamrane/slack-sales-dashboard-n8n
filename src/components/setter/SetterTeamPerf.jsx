// Onglet « Équipe setters » de la tracking sheet setter (manager des setters, 29/09/2026) : pour chaque
// setter, les appels Allo (passés et reçus, temps au téléphone) et les R1 / R2 posés, jour par jour.
// Allo compte les répondeurs comme décrochés : aucun taux de décroché n'est affiché.
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { Card, ProspectionStyles } from './prospection/ui.jsx';
import { fmtInt } from './prospection/format.js';

const PRESETS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
];

const parisToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
const shiftDay = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const rangeOf = (preset) => {
  const today = parisToday();
  if (preset === 'today') return [today, today];
  if (preset === 'yesterday') return [shiftDay(today, -1), shiftDay(today, -1)];
  return [shiftDay(today, preset === '7d' ? -6 : -29), today];
};

const fmtTalk = (seconds) => {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
};
const fmtAverage = (seconds, calls) => {
  if (seconds == null || !calls) return '—';
  const avg = Math.round(seconds / calls);
  return avg < 60 ? `${avg} s` : `${Math.floor(avg / 60)} min ${String(avg % 60).padStart(2, '0')}`;
};
const fmtDayLabel = (iso) => {
  const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);        // « Lun. 28 sept. »
};

const ALLO_MISSING = { missing: 'Pas de compte Allo', error: 'Allo indisponible' };
const COLUMNS = ['Appels', 'Sortants', 'Temps au téléphone', 'Durée moyenne', 'R1 posés', 'R2 posés'];

export default function SetterTeamPerf({ C, darkMode }) {
  const [preset, setPreset] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    const [start, end] = rangeOf(preset);
    setLoading(true);
    setError('');
    apiClient.get(`/api/v1/tracking/setter-team/perf?start=${start}&end=${end}`)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) { setError("Impossible de charger les performances de l'équipe. Réessayez."); setLoading(false); } });
    return () => { alive = false; };
  }, [preset, refresh]);

  // Les plus actifs d'abord : appels, puis RDV posés (un setter sans Allo passe après, classé par RDV).
  const rows = useMemo(() => [...(data?.setters || [])].sort((a, b) =>
    (b.totals.calls ?? -1) - (a.totals.calls ?? -1) || (b.totals.r1 + b.totals.r2) - (a.totals.r1 + a.totals.r2)), [data]);
  const team = useMemo(() => rows.reduce((t, s) => ({
    calls: t.calls + (s.totals.calls || 0), duration: t.duration + (s.totals.duration || 0),
    r1: t.r1 + s.totals.r1, r2: t.r2 + s.totals.r2,
  }), { calls: 0, duration: 0, r1: 0, r2: 0 }), [rows]);
  const multiDay = (data?.days?.length || 0) > 1;

  const cell = { padding: '12px 14px', fontSize: 13.5, color: C.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' };
  const head = { ...cell, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px' };

  const numbers = (s) => {
    if (s.calls == null) {
      return <td colSpan={4} style={{ ...cell, color: C.muted, textAlign: 'center', fontStyle: 'italic' }}>{s.label}</td>;
    }
    return (
      <>
        <td style={{ ...cell, fontWeight: 600 }}>{fmtInt(s.calls)}</td>
        <td style={cell}>{fmtInt(s.outbound)}</td>
        <td style={cell}>{fmtTalk(s.duration)}</td>
        <td style={cell}>{fmtAverage(s.duration, s.calls)}</td>
      </>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1100 }}>
      <ProspectionStyles />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: C.subtle, border: `1px solid ${C.border}` }}>
          {PRESETS.map((p) => {
            const active = preset === p.key;
            return (
              <button key={p.key} type="button" onClick={() => { setPreset(p.key); setOpen(null); }} style={{
                padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, transition: 'background 0.15s, color 0.15s',
                background: active ? C.bg : 'transparent', color: active ? C.text : C.secondary,
                boxShadow: active ? (darkMode ? 'none' : '0 1px 2px rgba(16,24,40,0.08)') : 'none',
              }}>{p.label}</button>
            );
          })}
        </div>
        <button type="button" onClick={() => setRefresh((n) => n + 1)} disabled={loading} title="Actualiser" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
          border: `1px solid ${C.border}`, background: C.bg, color: C.secondary, cursor: loading ? 'default' : 'pointer',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
        }}>
          <RefreshCw size={14} style={{ animation: loading ? 'prospSpin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {[
          { label: "Appels de l'équipe", value: fmtInt(team.calls) },
          { label: 'Temps au téléphone', value: fmtTalk(team.duration) },
          { label: 'R1 posés', value: fmtInt(team.r1), color: '#3b82f6' },
          { label: 'R2 posés', value: fmtInt(team.r2), color: '#fb923c' },
        ].map((k) => (
          <Card key={k.label} C={C} darkMode={darkMode} style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color || C.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', opacity: loading ? 0.45 : 1, transition: 'opacity 0.2s' }}>
              {data ? k.value : '—'}
            </div>
          </Card>
        ))}
      </div>

      <Card C={C} darkMode={darkMode} style={{ overflow: 'hidden' }}>
        {error ? (
          <div role="alert" style={{ padding: 24, fontSize: 14, color: '#b42318' }}>{error}</div>
        ) : !data ? (
          <div style={{ padding: 24, fontSize: 14, color: C.muted }}>Lecture des appels Allo et des RDV posés…</div>
        ) : (
          <div style={{ overflowX: 'auto', opacity: loading ? 0.55 : 1, transition: 'opacity 0.2s' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                  <th style={{ ...head, textAlign: 'left' }}>Setter</th>
                  {COLUMNS.map((c) => <th key={c} style={head}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const expanded = multiDay && open === s.email;
                  const label = ALLO_MISSING[s.allo];
                  return [
                    <tr key={s.email} onClick={() => multiDay && setOpen(expanded ? null : s.email)}
                      style={{ borderBottom: `1px solid ${C.border}`, cursor: multiDay ? 'pointer' : 'default', background: expanded ? C.subtle : 'transparent' }}
                      onMouseEnter={(e) => { if (multiDay && !expanded) e.currentTarget.style.background = C.subtle; }}
                      onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {multiDay && (expanded ? <ChevronDown size={15} color={C.muted} /> : <ChevronRight size={15} color={C.muted} />)}
                          {s.name}
                          {s.role === 'setter_manager' && <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>manager</span>}
                        </span>
                      </td>
                      {numbers({ ...s.totals, label })}
                      <td style={{ ...cell, fontWeight: 600, color: s.totals.r1 ? '#3b82f6' : C.muted }}>{fmtInt(s.totals.r1)}</td>
                      <td style={{ ...cell, fontWeight: 600, color: s.totals.r2 ? '#fb923c' : C.muted }}>{fmtInt(s.totals.r2)}</td>
                    </tr>,
                    ...(expanded ? [...s.by_day].reverse().map((d) => (
                      <tr key={`${s.email}-${d.day}`} style={{ borderBottom: `1px solid ${C.border}`, background: C.subtle }}>
                        <td style={{ ...cell, textAlign: 'left', paddingLeft: 38, color: C.secondary }}>{fmtDayLabel(d.day)}</td>
                        {numbers({ ...d, label })}
                        <td style={{ ...cell, color: d.r1 ? '#3b82f6' : C.muted }}>{fmtInt(d.r1)}</td>
                        <td style={{ ...cell, color: d.r2 ? '#fb923c' : C.muted }}>{fmtInt(d.r2)}</td>
                      </tr>
                    )) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p style={{ fontSize: 12.5, color: C.muted, margin: 0, lineHeight: 1.6 }}>
        Appels : relevés Allo, passés et reçus, sur le numéro de chaque setter. RDV posés : R1 et R2 placés par le setter,
        comptés le jour de la pose.{multiDay ? ' Cliquez sur un setter pour le détail jour par jour.' : ''}
      </p>
    </div>
  );
}
