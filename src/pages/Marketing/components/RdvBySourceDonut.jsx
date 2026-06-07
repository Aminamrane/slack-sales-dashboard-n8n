import React, { useMemo, useState } from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion } from 'framer-motion';
import { fmtInt, fmtPct } from '../theme';

/**
 * Camembert SVG (donut) — décomposition des RDV pris par source d'acquisition.
 *
 * Source : endpoint `/api/v1/marketing/webinars/{id}/realtime-leads` →
 * `rdv_by_source: { landing, meta, broad, unattributed }` (clés brutes
 * de la DB landing-webinaire + segment "unattributed" pour les leads
 * ajoutés hors landings tracker).
 *
 * Style aligné sur SourceBreakdown (mêmes couleurs Landing/Meta/Broad —
 * blue/fuchsia/amber) + segment gris pour "Non attribué". Donut SVG pur
 * (pas de lib chart) avec arcs stroke-dasharray pour cohérence avec
 * SatisfactionGauge.
 */

// Mapping clé backend → label affiché + ton de couleur (palette theme.js).
// Ordre = ordre d'affichage dans la légende et de tracé du donut.
const SOURCE_ORDER = [
  { key: 'meta',         label: 'Meta Ads',     toneKey: 'fuchsia' },
  { key: 'landing',      label: 'Landing Page', toneKey: 'blue' },
  { key: 'broad',        label: 'Cold emailing', toneKey: 'amber' },
  { key: 'unattributed', label: 'Non attribué', toneKey: 'muted' },
];

// Modes de vue du donut. Le backend fournit 3 dicts dans realtime-leads :
// - `rdv_by_source` (qui prend un RDV)
// - `live_attendees_by_source` (qui était présent au live, hardcoded par
//   webinaire à partir d'un calcul SQL redirect_clicks × leads.source)
// - `sales_by_source` (qui a signé — status='signed' agrégé par source via
//   le même matcher v2 email/tel/nom)
const VIEW_MODES = [
  { key: 'rdv',   label: 'RDV pris',         dataKey: 'rdv_by_source',          unitLabel: 'rendez-vous',     centerLabel: 'RDV PRIS' },
  { key: 'live',  label: 'Présents au live', dataKey: 'live_attendees_by_source', unitLabel: 'présents au live', centerLabel: 'PRÉSENTS' },
  { key: 'sales', label: 'Ventes',           dataKey: 'sales_by_source',        unitLabel: 'ventes',          centerLabel: 'VENTES' },
];

export default function RdvBySourceDonut({ data, C }) {
  const [viewMode, setViewMode] = useState('rdv');
  const activeView = VIEW_MODES.find((v) => v.key === viewMode) || VIEW_MODES[0];

  // Construction des segments : on prend toujours les 4 sources de
  // SOURCE_ORDER (même si count=0) pour stabilité visuelle de la légende.
  const segments = useMemo(() => {
    const raw = data?.[activeView.dataKey] || {};
    const total = SOURCE_ORDER.reduce((s, src) => s + (raw[src.key] || 0), 0);
    return SOURCE_ORDER.map((src) => {
      const value = raw[src.key] || 0;
      const pct = total > 0 ? (value / total) * 100 : 0;
      const tone = src.toneKey === 'muted'
        ? { fg: C.muted, bg: C.subtle, strong: C.hairline }
        : C[src.toneKey];
      return { ...src, value, pct, tone };
    });
  }, [data, C, activeView.dataKey]);

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  // Géométrie du donut. Cercle unique via stroke-dasharray (technique
  // SVG standard, plus simple que d'arcs séparés et résiste mieux aux
  // résolutions).
  const SIZE = 200;
  const STROKE = 28;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const CX = SIZE / 2;
  const CY = SIZE / 2;

  // Pré-calcule les positions cumulées des arcs (en % du périmètre).
  // On dessine chaque segment avec `stroke-dashoffset` qui le décale.
  let cumulative = 0;
  const arcs = segments
    .filter((seg) => seg.value > 0)
    .map((seg) => {
      const length = (seg.pct / 100) * CIRCUMFERENCE;
      const offset = -cumulative;
      cumulative += length;
      return { ...seg, length, offset };
    });

  // État vide (aucun RDV) — UX claire plutôt que cercle gris muet.
  if (total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: '#ffffff',
          borderRadius: 24,
          padding: '20px 22px',
          border: `1px solid ${C.hairline}`,
          boxShadow: C.shadow,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 220,
        }}
      >
        <Header C={C} total={0} activeView={activeView} viewMode={viewMode} setViewMode={setViewMode} />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.muted,
          fontSize: 12.5,
          textAlign: 'center',
          padding: '12px 0',
        }}>
          {viewMode === 'live' && 'Aucun présent au live enregistré.'}
          {viewMode === 'sales' && 'Aucune vente enregistrée.'}
          {viewMode === 'rdv' && 'Aucun RDV pris pour ce webinaire.'}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: '20px 22px',
        border: `1px solid ${C.hairline}`,
        boxShadow: C.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <Header C={C} total={total} activeView={activeView} viewMode={viewMode} setViewMode={setViewMode} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 18,
        alignItems: 'center',
      }}>
        {/* Donut SVG */}
        <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
            {/* Track */}
            <circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              stroke={C.subtle}
              strokeWidth={STROKE}
            />
            {/* Arcs colorés */}
            {arcs.map((arc) => (
              <motion.circle
                key={arc.key}
                cx={CX}
                cy={CY}
                r={RADIUS}
                fill="none"
                stroke={arc.tone.strong}
                strokeWidth={STROKE}
                strokeLinecap="butt"
                strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                strokeDashoffset={arc.offset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              />
            ))}
          </svg>
          {/* Centre : total RDV */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: 32,
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>
              {fmtInt(total)}
            </div>
            <div style={{
              marginTop: 4,
              fontSize: 10,
              fontWeight: 600,
              color: C.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {activeView.centerLabel}
            </div>
          </div>
        </div>

        {/* Légende */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          {segments.map((seg) => (
            <LegendRow key={seg.key} seg={seg} C={C} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Header({ C, total, activeView, viewMode, setViewMode }) {
  const titleByMode = {
    rdv: 'RDV par source',
    live: 'Présents au live · source',
    sales: 'Ventes par source',
  };
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 4,
        }}>
          {titleByMode[viewMode] || titleByMode.rdv}
        </div>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>
          {total > 0
            ? `${fmtInt(total)} ${activeView.unitLabel} · origine d'acquisition`
            : `Origine d'acquisition · ${activeView.unitLabel}`}
        </div>
      </div>
      {setViewMode && (
        <ViewToggle C={C} viewMode={viewMode} setViewMode={setViewMode} />
      )}
    </div>
  );
}

// Pill toggle 2 segments aligné sur le pattern DateRangePicker (pills
// rouges actives, gris inactives). Discret pour ne pas voler la vedette
// au donut.
function ViewToggle({ C, viewMode, setViewMode }) {
  return (
    <div role="tablist" aria-label="Vue camembert" style={{
      display: 'inline-flex',
      gap: 2,
      padding: 3,
      borderRadius: 50,
      background: C.subtle,
      border: `1px solid ${C.hairline}`,
      flexShrink: 0,
    }}>
      {VIEW_MODES.map((v) => {
        const active = viewMode === v.key;
        return (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setViewMode(v.key)}
            style={{
              padding: '4px 10px',
              border: 'none',
              borderRadius: 50,
              background: active ? '#ffffff' : 'transparent',
              boxShadow: active ? C.shadow : 'none',
              color: active ? C.text : C.muted,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '-0.005em',
              transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

function LegendRow({ seg, C }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    }}>
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: seg.tone.strong,
          flexShrink: 0,
        }}
      />
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: C.text,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {seg.label}
      </span>
      <span style={{
        marginLeft: 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontVariantNumeric: 'tabular-nums',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
          {fmtInt(seg.value)}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: seg.tone.fg,
          background: seg.tone.bg,
          padding: '2px 7px',
          borderRadius: 50,
          minWidth: 42,
          textAlign: 'center',
        }}>
          {fmtPct(seg.pct)}
        </span>
      </span>
    </div>
  );
}
