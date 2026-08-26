import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import apiClient from '../../../services/apiClient';
import { fmtInt, fmtPct } from '../theme';

/**
 * Version compacte du classement sales — pensée pour le slot central
 * de la HeroKpiStrip (entre la Hero card et les KPI tiles).
 * Vue verticale : avatar + nom + closing %, top 6, sans header table.
 *
 * Composant volontairement séparé du `SalesWebinarRanking` (vue
 * détaillée) plutôt qu'une prop `compact` : la sémantique d'usage
 * change (hero vs full table), et c'est plus simple à itérer en
 * isolant.
 */
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || name.slice(0, 2).toUpperCase();
}

function hashColor(seed, palette) {
  if (!seed) return palette[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function closingPill(rate, C) {
  if (rate >= 30) return { bg: C.emerald.bg, fg: C.emerald.fg };
  if (rate >= 15) return { bg: C.amber.bg, fg: C.amber.fg };
  if (rate > 0)   return { bg: C.blue.bg,    fg: C.blue.fg };
  return { bg: C.subtle, fg: C.muted };
}

export default function SalesWebinarRankingCompact({ data, C, maxRows = 6, webinarId }) {
  // Détail des ventes derrière le classement : chargé au 1er clic, puis gardé.
  const [salesDetail, setSalesDetail] = useState(null);
  const [detailFor, setDetailFor] = useState(null); // email du sales ouvert
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { setSalesDetail(null); setDetailFor(null); }, [webinarId]);

  const openDetail = async (email) => {
    setDetailFor(email);
    if (salesDetail || !webinarId) return;
    setDetailLoading(true);
    try {
      const r = await apiClient.get(`/api/v1/marketing/webinars/${webinarId}/sales-detail`);
      setSalesDetail(r?.sales || []);
    } catch {
      setSalesDetail([]);
    } finally {
      setDetailLoading(false);
    }
  };
  const rows = useMemo(() => (data?.by_assignee || []).slice(0, maxRows), [data, maxRows]);
  const totals = useMemo(() => {
    const all = data?.by_assignee || [];
    const totalAssigned = all.reduce((s, r) => s + (r.assigned || 0), 0);
    const totalSigned = all.reduce((s, r) => s + (r.signed || 0), 0);
    return {
      totalAssigned,
      totalSigned,
      globalClosing: totalAssigned > 0 ? (totalSigned / totalAssigned) * 100 : 0,
    };
  }, [data]);

  const avatarPalette = [C.blue.strong, C.emerald.strong, C.fuchsia.strong, C.amber.strong, C.violet.strong];
  const rankIcons = ['🥇', '🥈', '🥉'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.surface,
        borderRadius: 20,
        padding: '18px 18px 14px',
        boxShadow: C.shadow,
        border: `1px solid ${C.hairline}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.faded,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 2,
        }}>
          Classement sales · webinaire
        </div>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
          {data
            ? `${fmtInt(totals.totalAssigned)} leads · ${fmtInt(totals.totalSigned)} signés · ${fmtPct(totals.globalClosing)} closing`
            : 'Chargement…'}
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
        {rows.length === 0 && (
          <div style={{ fontSize: 12, color: C.muted, padding: '12px 0', textAlign: 'center' }}>
            Aucun lead webinaire.
          </div>
        )}
        {rows.map((row, idx) => {
          const name = row.assignee_name || 'Non assigné';
          const email = row.assignee_email;
          const color = hashColor(email || name, avatarPalette);
          const pill = closingPill(row.closing_rate_pct || 0, C);
          const isPodium = idx < 3 && (row.signed || 0) > 0;

          return (
            <motion.div
              key={`${email || 'none'}-${idx}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
              whileHover={(row.signed || 0) > 0 ? { scale: 1.01 } : undefined}
              onClick={() => { if ((row.signed || 0) > 0) openDetail(email); }}
              title={(row.signed || 0) > 0 ? `Voir les ${row.signed} vente(s) de ${name}` : undefined}
              style={{
                cursor: (row.signed || 0) > 0 ? 'pointer' : 'default',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                borderRadius: 10,
                background: isPodium ? C.subtle : 'transparent',
              }}
            >
              {row.assignee_avatar_url ? (
                <img
                  src={row.assignee_avatar_url}
                  alt={name}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    objectFit: 'cover',
                    flexShrink: 0,
                    background: C.subtle,
                  }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  flexShrink: 0,
                  background: email ? color : C.subtle,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}>
                  {email ? initials(name) : '—'}
                </div>
              )}

              <div style={{
                fontSize: 13,
                fontWeight: 650,
                color: C.text,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
              }}>
                {isPodium && <span style={{ fontSize: 13 }}>{rankIcons[idx]}</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                <span style={{
                  fontSize: 11,
                  color: C.muted,
                  fontWeight: 500,
                  marginLeft: 'auto',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtInt(row.signed || 0)}/{fmtInt(row.assigned || 0)}
                </span>
              </div>

              <div style={{
                padding: '3px 9px',
                background: pill.bg,
                color: pill.fg,
                borderRadius: 50,
                fontSize: 11,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                minWidth: 50,
                textAlign: 'center',
              }}>
                {fmtPct(row.closing_rate_pct || 0)}
              </div>
            </motion.div>
          );
        })}
      </div>

      {detailFor && createPortal(
        <SalesDetailModal
          C={C}
          loading={detailLoading}
          sales={(salesDetail || []).filter((s) => (s.assignee_email || '') === detailFor)}
          seller={(data?.by_assignee || []).find((r) => r.assignee_email === detailFor)}
          onClose={() => setDetailFor(null)}
        />,
        document.body,
      )}
    </motion.div>
  );
}

// Détail des ventes d'un sales pour ce webinaire : qui a signé, société,
// tranche salariale, coordonnées, n° client et date de signature.
function SalesDetailModal({ C, sales, seller, loading, onClose }) {
  const name = seller?.assignee_name || 'Sales';
  const row = (label, value) => (
    <div style={{ display: 'flex', gap: 6, fontSize: 12, color: C.muted }}>
      <span style={{ minWidth: 74, color: C.faded }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 500, wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10080, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.45)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', width: 'min(620px, 100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          background: C.surface, borderRadius: 18, border: `1px solid ${C.hairline}`, boxShadow: '0 24px 60px rgba(17,24,39,0.28)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.hairline}` }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Ventes de {name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {loading ? 'Chargement…' : `${sales.length} vente${sales.length > 1 ? 's' : ''} issue${sales.length > 1 ? 's' : ''} de ce webinaire`}
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: '14px 20px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: C.muted, fontSize: 13 }}>Chargement du détail…</div>
          ) : sales.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: C.muted, fontSize: 13 }}>Aucune vente trouvée.</div>
          ) : sales.map((s) => (
            <div key={s.lead_id} style={{ border: `1px solid ${C.hairline}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10, background: C.subtle }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{s.client_name || '—'}</div>
                {s.numero_client && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.emerald.fg, background: C.emerald.bg, borderRadius: 20, padding: '2px 9px' }}>
                    n°{s.numero_client}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '5px 16px' }}>
                {row('Société', s.company)}
                {row('Tranche', s.employee_range)}
                {row('Email', s.email)}
                {row('Téléphone', s.phone)}
                {row('Secteur', s.sector)}
                {row('Signé le', s.date_signature)}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
