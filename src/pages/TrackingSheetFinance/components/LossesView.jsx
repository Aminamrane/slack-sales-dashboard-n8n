// LossesView.jsx — onglet « Pertes » : quantifier ce qui a été abandonné.
//
// Demande dev 2026-09-01 : « un onglet pour quantifier la perte, avec les
// chiffres des pertes actées, sur les résiliations et la liquidation. »
//
// Deux montants, jamais mélangés — ce sont deux réalités comptables :
//   · CRÉANCE ABANDONNÉE : dû, facturé, jamais encaissé. Un vrai write-off.
//   · ATTENDU FUTUR ANNULÉ : du chiffre d'affaires qui ne rentrera pas.
//     Ce n'est pas une créance, ça n'a jamais été facturé.
//
// L'état affiché vient de `displayEtat` du board — la même fonction que
// partout ailleurs, qui tient compte de la date d'effet. On ne redéfinit pas
// la règle ici : c'est cette duplication qui avait fait diverger le tableau et
// la fiche (incident n°454).

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TriangleAlert, RefreshCw } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { displayEtat } from '../../OptilexBoard.jsx';
import { formatEUR, formatDateFR } from '../constants.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  red: '#b42318',
  redBg: '#fdecec',
  green: '#0f7b6c',
};

// Regroupement métier demandé : on veut lire « combien nous coûtent les
// résiliations » et « combien les liquidations ». Les états proches sont
// rassemblés sous le mot que la finance emploie.
const FAMILLES = [
  { key: 'resiliation',  label: 'Résiliations',  etats: ['Résiliation', 'Self-Résiliation'] },
  { key: 'liquidation',  label: 'Liquidations',  etats: ['Liquidation', 'En cours de liquidation'] },
  { key: 'retractation', label: 'Rétractations', etats: ['Rétractation'] },
];
const AUTRES = { key: 'autres', label: 'Autres', etats: [] };

const familleOf = (etat) =>
  FAMILLES.find((f) => f.etats.includes(etat))?.key || AUTRES.key;

const scoped = (l, scope, kind) => {
  const o = Number(l[`${kind}_owner`] || 0);
  const p = Number(l[`${kind}_optilex_ttc`] || 0);
  if (scope === 'owner') return o;
  if (scope === 'optilex') return p;
  return o + p;
};

export default function LossesView({ boardMap, scope, onOpenClient }) {
  const [losses, setLosses] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);

  const load = React.useCallback(() => {
    setReloading(true);
    apiClient.get('/api/v1/finance-periods/losses')
      .then((d) => { setLosses(d?.items || []); setError(null); })
      .catch((e) => setError(e?.message || 'Chargement impossible'))
      .finally(() => setReloading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const enriched = useMemo(() => (losses || []).map((l) => {
    const br = (l.numero_client && boardMap) ? boardMap.get(l.numero_client) : null;
    const etat = br ? displayEtat(br) : null;
    return {
      ...l,
      etat,
      famille: familleOf(etat),
      creance: scoped(l, scope, 'amount'),
      futur: scoped(l, scope, 'future'),
    };
  }), [losses, boardMap, scope]);

  const totaux = useMemo(() => {
    const acc = {};
    for (const f of [...FAMILLES, AUTRES]) acc[f.key] = { creance: 0, futur: 0, n: 0 };
    let creance = 0; let futur = 0;
    for (const l of enriched) {
      acc[l.famille].creance += l.creance;
      acc[l.famille].futur += l.futur;
      acc[l.famille].n += 1;
      creance += l.creance;
      futur += l.futur;
    }
    return { acc, creance, futur, n: enriched.length };
  }, [enriched]);

  if (error) {
    return <Message texte={`Pertes indisponibles — ${error}`} />;
  }
  if (losses === null) {
    return <Message texte="Chargement des pertes…" />;
  }
  if (!losses.length) {
    return <Message texte="Aucune perte actée. Rien n’a été abandonné à ce jour." />;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 2px 40px' }}>
      {/* Les deux totaux, séparés — ne jamais les additionner. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}
      >
        <Carte
          label="Créance abandonnée"
          value={totaux.creance}
          hint={`${totaux.n} client${totaux.n > 1 ? 's' : ''} · facturé et jamais encaissé`}
          accent={N.red}
        />
        <Carte
          label="Attendu futur annulé"
          value={totaux.futur}
          hint="Chiffre qui ne rentrera pas · jamais facturé"
          accent={N.textMuted}
        />
        <button
          type="button"
          onClick={load}
          title="Recharger"
          style={{
            border: `1px solid ${N.borderSft}`, background: '#fff', borderRadius: 10,
            padding: '0 14px', cursor: 'pointer', color: N.textMuted,
            display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
            fontSize: 12.5,
          }}
        >
          <motion.span
            animate={{ rotate: reloading ? 360 : 0 }}
            transition={reloading
              ? { duration: 1, repeat: Infinity, ease: 'linear' }
              : { duration: 0 }}
            style={{ display: 'inline-flex' }}
          >
            <RefreshCw size={13} />
          </motion.span>
          Actualiser
        </button>
      </motion.div>

      {/* Ventilation : c'est la réponse à « combien coûtent les résiliations ». */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 10, marginBottom: 22,
      }}>
        {[...FAMILLES, AUTRES].map((f, i) => {
          const t = totaux.acc[f.key];
          if (!t.n) return null;
          return (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.04 + i * 0.05, ease: [0.4, 0, 0.2, 1] }}
              style={{
                border: `1px solid ${N.borderSft}`, borderRadius: 10,
                padding: '12px 14px', background: '#fff',
              }}
            >
              <div style={{
                fontSize: 10.5, fontWeight: 600, color: N.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {f.label} · {t.n}
              </div>
              <div style={{
                fontSize: 18, fontWeight: 700, color: N.red, marginTop: 4,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatEUR(t.creance)}
              </div>
              <div style={{ fontSize: 11, color: N.textFaint, marginTop: 2 }}>
                + {formatEUR(t.futur)} de futur annulé
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Le détail, du plus coûteux au moins coûteux. */}
      <div style={{
        border: `1px solid ${N.borderSft}`, borderRadius: 10, overflow: 'hidden',
        background: '#fff',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '84px minmax(180px, 2fr) 150px 120px 120px minmax(150px, 1fr) 110px',
          gap: 10, padding: '9px 14px', background: N.sideBg,
          borderBottom: `1px solid ${N.borderSft}`,
          fontSize: 10.5, fontWeight: 600, color: N.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          <span>N° client</span>
          <span>Client</span>
          <span>État</span>
          <span style={{ textAlign: 'right' }}>Créance abandonnée</span>
          <span style={{ textAlign: 'right' }}>Futur annulé</span>
          <span>Motif</span>
          <span>Actée le</span>
        </div>

        {[...enriched].sort((a, b) => b.creance - a.creance).map((l, i) => (
          <div
            key={l.id}
            onClick={() => onOpenClient?.(l.client_id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '84px minmax(180px, 2fr) 150px 120px 120px minmax(150px, 1fr) 110px',
              gap: 10, padding: '10px 14px', fontSize: 12.5, alignItems: 'center',
              borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
              cursor: onOpenClient ? 'pointer' : 'default',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = N.sideBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ color: N.textMuted, fontVariantNumeric: 'tabular-nums' }}>
              {l.numero_client || '—'}
            </span>
            <span style={{
              color: N.text, fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {l.societe || '—'}
            </span>
            <span style={{ color: N.textMuted, fontSize: 12 }}>{l.etat || '—'}</span>
            <span style={{
              textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              color: l.creance > 0 ? N.red : N.textFaint,
            }}>
              {formatEUR(l.creance)}
            </span>
            <span style={{
              textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: N.textMuted,
            }}>
              {formatEUR(l.futur)}
            </span>
            <span style={{
              color: N.textFaint, fontSize: 11.5,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={l.reason || ''}>
              {l.reason || '—'}
            </span>
            <span style={{ color: N.textFaint, fontSize: 11.5 }}>
              {l.declared_at ? formatDateFR(l.declared_at) : '—'}
              {l.declared_by_name ? (
                <span style={{ display: 'block', fontSize: 10.5 }}>{l.declared_by_name}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 12, fontSize: 11.5, color: N.textFaint, lineHeight: 1.6,
        display: 'flex', alignItems: 'flex-start', gap: 7, maxWidth: 720,
      }}>
        <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Ces montants sont <strong>sortis des totaux</strong> de la page : ils ne
          comptent plus ni dans l’attendu, ni dans les retards, ni dans les créances
          antérieures. Une perte reste annulable depuis la fiche du client, ce qui
          restaure l’attendu au centime.
        </span>
      </div>
    </div>
  );
}

function Carte({ label, value, hint, accent }) {
  return (
    <div style={{
      border: `1px solid ${N.borderSft}`, borderRadius: 10, background: '#fff',
      padding: '12px 18px', minWidth: 210,
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
