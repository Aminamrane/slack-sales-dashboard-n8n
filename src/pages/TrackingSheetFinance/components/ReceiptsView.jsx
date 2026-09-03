// ReceiptsView.jsx — onglet « Encaissements » : les derniers montants récupérés.
//
// Demande dev 2026-09-03 : « un vrai onglet qui recense les derniers montants
// récupérés — le nom de la société, le montant récupéré, à quelle date, quand
// il a été saisi, par qui. » Il remplace « Par état » et « Mes clients », qui
// ne pilotaient rien.
//
// Source : GET /finance-periods/receipts — la saisie dans la page (signée de
// son auteur) et la détection par le sync du classeur (sans auteur), fondues
// en un seul journal, du plus récent au plus ancien.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { formatEUR, formatDateFR, formatMonthLabel } from '../constants.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  green: '#0f7b6c',
  greenBg: '#e9f9f0',
  blue: '#1e40af',
  blueBg: '#e7f0fb',
  amber: '#b45309',
  amberBg: '#fff8ed',
};

const WINDOWS = [
  { days: 30, label: '30 jours' },
  { days: 60, label: '60 jours' },
  { days: 90, label: '90 jours' },
];

const ENTITY = {
  owner:   { label: 'Owner',     fg: N.green, bg: N.greenBg },
  optilex: { label: "Opti'lex",  fg: N.blue,  bg: N.blueBg },
};

const KIND_LABEL = {
  month:   'Échéance du mois',
  overdue: 'Créance antérieure',
};

const GRID = '150px minmax(200px, 2fr) 96px 150px 120px 130px minmax(140px, 1fr)';

const whenLabel = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const day = formatDateFR(s);
  if (!/T\d\d:\d\d/.test(s)) return day;
  try {
    const time = new Date(s).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
    });
    return `${day} · ${time}`;
  } catch {
    return day;
  }
};

export default function ReceiptsView({ scope, onOpenClient }) {
  const [days, setDays] = useState(30);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);

  const load = useCallback(async () => {
    setReloading(true);
    setError(null);
    try {
      const d = await apiClient.get(`/api/v1/finance-periods/receipts?days=${days}&limit=500`);
      setItems(d?.items || []);
    } catch (e) {
      setError(e?.data?.detail || e?.message || 'chargement impossible');
    } finally {
      setReloading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  // La vision active filtre les entités, comme partout sur la page.
  const visible = useMemo(() => {
    if (!items) return [];
    return scope === 'global' ? items : items.filter((r) => r.entity === scope);
  }, [items, scope]);

  const totaux = useMemo(() => {
    const t = { total: 0, n: visible.length, owner: 0, optilex: 0, overdue: 0 };
    for (const r of visible) {
      t.total += r.amount;
      if (r.entity === 'owner') t.owner += r.amount; else t.optilex += r.amount;
      if (r.kind === 'overdue') t.overdue += r.amount;
    }
    return t;
  }, [visible]);

  if (error) return <Message texte={`Encaissements indisponibles — ${error}`} />;
  if (items === null) return <Message texte="Chargement des encaissements…" />;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 2px 40px' }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 18 }}
      >
        <Carte
          label="Encaissé sur la période"
          value={totaux.total}
          hint={`${totaux.n} encaissement${totaux.n > 1 ? 's' : ''} · ${days} derniers jours`}
          accent={N.green}
        />
        {scope === 'global' && (
          <>
            <Carte label="Owner" value={totaux.owner} hint="part Owner" accent={N.green} />
            <Carte label="Opti'lex" value={totaux.optilex} hint="part Opti'lex" accent={N.blue} />
          </>
        )}
        <Carte
          label="Sur créances antérieures"
          value={totaux.overdue}
          hint="récupéré sur les mois précédents"
          accent={N.amber}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            background: '#f1f1ef', border: `1px solid ${N.border}`,
            borderRadius: 8, padding: 2, gap: 2,
          }}>
            {WINDOWS.map((w) => {
              const actif = days === w.days;
              return (
                <button
                  key={w.days}
                  type="button"
                  onClick={() => setDays(w.days)}
                  style={{
                    position: 'relative', height: 24, padding: '0 11px',
                    border: 'none', borderRadius: 6, background: 'transparent',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                    fontWeight: actif ? 600 : 500, color: actif ? N.text : N.textMuted,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {actif && (
                    <motion.span
                      layoutId="tsf-receipts-window"
                      transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                      style={{
                        position: 'absolute', inset: 0, background: '#fff', borderRadius: 6,
                        boxShadow: '0 1px 3px rgba(15,15,15,0.12), 0 0 0 1px rgba(15,15,15,0.04)',
                      }}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1 }}>{w.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={load}
            title="Recharger"
            style={{
              border: `1px solid ${N.borderSft}`, background: '#fff', borderRadius: 10,
              padding: '0 14px', height: 40, cursor: 'pointer', color: N.textMuted,
              display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
              fontSize: 12.5,
            }}
          >
            <motion.span
              animate={{ rotate: reloading ? 360 : 0 }}
              transition={reloading ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
              style={{ display: 'inline-flex' }}
            >
              <RefreshCw size={13} />
            </motion.span>
            Actualiser
          </button>
        </div>
      </motion.div>

      {visible.length === 0 ? (
        <Message texte="Aucun encaissement sur la période." />
      ) : (
        <div style={{
          border: `1px solid ${N.borderSft}`, borderRadius: 10, overflow: 'hidden',
          background: '#fff',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: GRID,
            gap: 10, padding: '9px 14px', background: N.sideBg,
            borderBottom: `1px solid ${N.borderSft}`,
            fontSize: 10.5, fontWeight: 600, color: N.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <span>Saisi le</span>
            <span>Client</span>
            <span>Entité</span>
            <span>Nature</span>
            <span style={{ textAlign: 'right' }}>Montant</span>
            <span>Mois concerné</span>
            <span>Saisi par</span>
          </div>

          {visible.map((r, i) => {
            const ent = ENTITY[r.entity] || ENTITY.owner;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i, 12) * 0.02, ease: [0.4, 0, 0.2, 1] }}
                onClick={() => onOpenClient?.(r.client_id)}
                style={{
                  display: 'grid', gridTemplateColumns: GRID,
                  gap: 10, padding: '10px 14px', fontSize: 12.5, alignItems: 'center',
                  borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
                  cursor: onOpenClient ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = N.sideBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ color: N.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {whenLabel(r.at)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block', color: N.text, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.societe || '—'}
                  </span>
                  <span style={{ fontSize: 11, color: N.textFaint }}>{r.numero_client || ''}</span>
                </span>
                <span>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    background: ent.bg, color: ent.fg, fontSize: 11.5, fontWeight: 600,
                  }}>
                    {ent.label}
                  </span>
                </span>
                <span style={{ color: r.kind === 'overdue' ? N.amber : N.textMuted, fontSize: 12 }}>
                  {KIND_LABEL[r.kind] || r.kind}
                </span>
                <span style={{
                  textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: N.green,
                }}>
                  {formatEUR(r.amount)}
                </span>
                <span style={{ color: N.textMuted }}>
                  {r.period ? formatMonthLabel(String(r.period).slice(0, 7)) : '—'}
                </span>
                <span style={{
                  color: r.who ? N.text : N.textFaint, fontSize: 12,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.who || (r.source === 'classeur' ? 'Classeur (sync)' : '—')}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Carte({ label, value, hint, accent }) {
  return (
    <div style={{
      border: `1px solid ${N.borderSft}`, borderRadius: 10, background: '#fff',
      padding: '12px 18px', minWidth: 190,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, color: N.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 24, fontWeight: 700, color: accent, marginTop: 3,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatEUR(value)}
      </div>
      <div style={{ fontSize: 11, color: N.textFaint, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function Message({ texte }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: N.textMuted, fontSize: 13, padding: 40,
    }}>
      {texte}
    </div>
  );
}
