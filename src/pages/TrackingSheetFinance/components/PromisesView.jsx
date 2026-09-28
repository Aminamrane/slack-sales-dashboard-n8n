// PromisesView.jsx — onglet « Promesses de règlement ».
//
// Demande dev 2026-09-28 : « un onglet où on peut checker toutes les personnes
// qui ont été mises en promesse de paiement, et si elles ont payé. » Chaque
// promesse garde sa date promise, le commentaire posé avec elle, qui l'a
// notée, et son issue : en cours, dépassée (date promise passée sans que le
// client soit à jour), tenue (le client ne doit plus rien, levée
// automatiquement) ou retirée.
//
// Source : GET /finance-periods/client/payment-promises.

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { formatEUR, formatDateFR } from '../constants.js';

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
  red: '#b42318',
  redBg: '#fdecec',
};

const STATUS = {
  open:      { label: 'En cours',     fg: N.blue,      bg: N.blueBg },
  late:      { label: 'Dépassée',     fg: N.red,       bg: N.redBg },
  kept:      { label: 'Tenue · payé', fg: N.green,     bg: N.greenBg },
  withdrawn: { label: 'Retirée',      fg: N.textMuted, bg: '#f1f1ef' },
};

const FILTERS = [
  { key: 'all',       label: 'Toutes' },
  { key: 'open',      label: 'En cours' },
  { key: 'late',      label: 'Dépassées' },
  { key: 'kept',      label: 'Tenues' },
  { key: 'withdrawn', label: 'Retirées' },
];

// Tient dans l'écran intégré (/ceo/dispatch, ~950 px) : minimums serrés, le
// reste de la largeur réparti.
const GRID = 'minmax(84px, 0.8fr) minmax(150px, 1.6fr) minmax(88px, 0.8fr) minmax(150px, 2fr) minmax(84px, 0.8fr) minmax(84px, 0.8fr) minmax(84px, 0.8fr) minmax(120px, 1.1fr)';

// Montant vu dans la vision active (Owner, Opti'Lex ou les deux).
const inScope = (scope, owner, optilex) => {
  if (owner == null && optilex == null) return null;
  if (scope === 'owner') return owner ?? 0;
  if (scope === 'optilex') return optilex ?? 0;
  return (owner ?? 0) + (optilex ?? 0);
};

const dayLabel = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? formatDateFR(String(iso))
    : d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
};

export default function PromisesView({ scope, onOpenClient }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReloading(true);
      try {
        const d = await apiClient.get('/api/v1/finance-periods/client/payment-promises');
        if (!cancelled) { setItems(d?.items || []); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e?.data?.detail || e?.message || 'chargement impossible');
      } finally {
        if (!cancelled) setReloading(false);
      }
    })();
    const onFocus = () => setRefresh((n) => n + 1);
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const counts = useMemo(() => {
    const c = { all: 0, open: 0, late: 0, kept: 0, withdrawn: 0 };
    for (const p of items || []) { c.all += 1; c[p.status] = (c[p.status] || 0) + 1; }
    return c;
  }, [items]);

  const visible = useMemo(
    () => (items || []).filter((p) => filter === 'all' || p.status === filter),
    [items, filter],
  );

  // Ce qui est rentré depuis les promesses, et ce qui reste à récupérer sur
  // celles qui courent encore.
  const totaux = useMemo(() => {
    let recu = 0; let reste = 0;
    for (const p of items || []) {
      recu += inScope(scope, p.received_owner, p.received_optilex) || 0;
      if (p.status === 'open' || p.status === 'late') {
        reste += inScope(scope, p.remaining_owner, p.remaining_optilex) || 0;
      }
    }
    return { recu, reste };
  }, [items, scope]);

  if (error && items === null) return <Message texte={`Promesses indisponibles — ${error}`} />;
  if (items === null) return <Message texte="Chargement des promesses…" />;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 2px 40px' }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 18 }}
      >
        <Carte label="En cours" value={counts.open + counts.late}
          hint={counts.late ? `dont ${counts.late} dépassée${counts.late > 1 ? 's' : ''}` : 'aucune dépassée'}
          accent={counts.late ? N.red : N.blue} />
        <Carte label="Tenues" value={counts.kept} hint="le client s'est mis à jour" accent={N.green} />
        <Carte label="Reçu depuis les promesses" value={formatEUR(totaux.recu)}
          hint="saisies et encaissements détectés" accent={N.green} />
        <Carte label="Reste à récupérer" value={formatEUR(totaux.reste)}
          hint="sur les promesses en cours" accent={N.amber} />

        <button
          type="button"
          onClick={() => setRefresh((n) => n + 1)}
          title="Recharger"
          style={{
            marginLeft: 'auto', alignSelf: 'center',
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
      </motion.div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const actif = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                height: 26, padding: '0 10px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${actif ? N.text : N.border}`,
                background: actif ? N.text : '#fff', color: actif ? '#fff' : N.textMuted,
                fontFamily: 'inherit', fontSize: 12, fontWeight: actif ? 600 : 500,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {f.label}
              <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.75 }}>{counts[f.key] || 0}</span>
            </button>
          );
        })}
        <span style={{ color: N.textFaint, fontSize: 11.5, marginLeft: 6 }}>
          Les plus récentes d'abord{error ? ' · Actualisation indisponible, réessayez.' : ''}
        </span>
      </div>

      {visible.length === 0 ? (
        <Message texte={filter === 'all' ? 'Aucune promesse de règlement notée.' : 'Aucune promesse dans cet état.'} />
      ) : (
        <div style={{ border: `1px solid ${N.borderSft}`, borderRadius: 10, overflowX: 'auto', background: '#fff' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: GRID, minWidth: 900,
            gap: 10, padding: '9px 14px', background: N.sideBg,
            borderBottom: `1px solid ${N.borderSft}`,
            fontSize: 10.5, fontWeight: 600, color: N.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <span>Notée le</span>
            <span>Client</span>
            <span>Règlement promis</span>
            <span>Commentaire</span>
            <span style={{ textAlign: 'right' }}>Dû à la pose</span>
            <span style={{ textAlign: 'right' }}>Reçu depuis</span>
            <span style={{ textAlign: 'right' }}>Reste dû</span>
            <span>Statut</span>
          </div>

          {visible.map((p, i) => {
            const st = STATUS[p.status] || STATUS.open;
            const du = inScope(scope, p.due_owner, p.due_optilex);
            const recu = inScope(scope, p.received_owner, p.received_optilex);
            const reste = inScope(scope, p.remaining_owner, p.remaining_optilex);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i, 12) * 0.02, ease: [0.4, 0, 0.2, 1] }}
                onClick={() => onOpenClient?.(p.client.id)}
                style={{
                  display: 'grid', gridTemplateColumns: GRID, minWidth: 900,
                  gap: 10, padding: '10px 14px', fontSize: 12.5, alignItems: 'center',
                  borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
                  cursor: onOpenClient ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = N.sideBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', color: N.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                    {dayLabel(p.created_at)}
                  </span>
                  <span style={{ fontSize: 11, color: N.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {p.created_by_name || '—'}
                  </span>
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block', color: N.text, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.client?.societe || '—'}
                  </span>
                  <span style={{ fontSize: 11, color: N.textFaint }}>{p.client?.numero_client || ''}</span>
                </span>
                <span style={{
                  fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                  color: p.status === 'late' ? N.red : p.promised_for ? N.text : N.textFaint,
                }}>
                  {p.promised_for ? formatDateFR(p.promised_for) : 'Non précisée'}
                </span>
                <span title={p.note} style={{
                  color: N.text, fontSize: 12, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {p.note}
                </span>
                <Montant value={du} />
                <Montant value={recu} color={recu > 0 ? N.green : N.textFaint} />
                <Montant value={p.status === 'open' || p.status === 'late' ? reste : null}
                  color={reste > 0 ? N.amber : N.textFaint} />
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    background: st.bg, color: st.fg, fontSize: 11.5, fontWeight: 600,
                  }}>
                    {st.label}
                  </span>
                  {p.closed_at && (
                    <span title={p.close_note || ''} style={{
                      display: 'block', fontSize: 11, color: N.textFaint, marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      le {dayLabel(p.closed_at)}{p.closed_by_name ? ` · ${p.closed_by_name}` : ''}
                    </span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Montant({ value, color = N.text }) {
  return (
    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color }}>
      {value == null ? '—' : formatEUR(value)}
    </span>
  );
}

function Carte({ label, value, hint, accent }) {
  return (
    <div style={{
      border: `1px solid ${N.borderSft}`, borderRadius: 10, background: '#fff',
      padding: '12px 18px', minWidth: 170,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, color: N.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: N.textFaint, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function Message({ texte }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: N.textMuted, fontSize: 13 }}>
      {texte}
    </div>
  );
}
