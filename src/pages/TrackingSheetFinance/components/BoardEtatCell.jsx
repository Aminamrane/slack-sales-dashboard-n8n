// BoardEtatCell.jsx — cellule « État » de la page Tracking Finance, branchée
// sur le board Owner/Opti'Lex (source de vérité des états clients).
//
// Pourquoi ce composant existe (2026-08-18) : l'ancien dropdown de la colonne
// État éditait `clients.etat` via PATCH /finance-periods — champ retiré du
// backend (le PATCH partait en 400). La vérité des états vit sur le board
// (`/api/v1/optilex/board` + POST `/api/v1/optilex/etat-change`).
//
// Réutilise les briques EXPORTÉES par OptilexBoard.jsx (badge, couleurs,
// config des états datés, displayEtat/isEtatPending) — aucune duplication de
// la règle métier ni des couleurs. Le picker est local car celui du board
// dérive ses options du rôle utilisateur ; ici la page finance utilise le
// jeu d'options du profil optilex (états actés Résiliation/Rétractation
// réservés à Owner, donc absents).
//
// Comportement :
//   - Badge board (displayEtat) + caret → menu portal (mêmes codes visuels
//     que le board : dot colorée par état, hover doux, check sur l'actif).
//   - État NON daté ("Signé", "En cours de …") → POST immédiat, menu fermé.
//   - État DATÉ (Pause, Liquidation, …, cf. ETAT_DATE_CONFIG) → POST immédiat
//     puis le menu reste ouvert et révèle la/les date(s) d'effet à saisir
//     (correction envoyée en second etat-change, comme la fiche du board).
//   - "Automatique" (etat: null) → efface l'override manuel, retour à l'état
//     calculé (Sheet / statut contrat) — même sémantique que le board.
//   - `boardRow` absent (client hors board) → tiret muet, pas d'édition.

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

import {
  EtatBadge, ETAT_STYLE, ETAT_DATE_CONFIG, displayEtat, isEtatPending,
} from '../../OptilexBoard.jsx';
import { formatDateFR, canEditAmounts, ACTED_EXIT_ETATS } from '../constants.js';
import apiClient from '../../../services/apiClient.js';

// Palette locale minimale (sync avec la charte du board — Attio/Linear sobre).
const MUTED = '#8a93a4';
const TEXT = '#1e2330';
const BORDER = '#e9ebf0';
const GREEN = '#15794a';
const AMBER = '#b45309';

// Options posables depuis la page finance.
//
// « Résiliation » et « Rétractation » sont des états ACTÉS : ils engagent
// l'entreprise et coupent la facturation. Ouverts à la DIRECTION seulement
// (admin, direction financière) le 2026-08-28, à la demande du dev — Ismahane
// acte désormais les sorties depuis la finance, sans passer par le board. Le
// serveur applique la même règle (403 pour les autres rôles) : cette liste ne
// fait que refléter l'écran.
const FINANCE_ETAT_OPTIONS = [
  'Signé',
  'En cours de résiliation',
  'En cours de rétractation',
  'Self-Résiliation',
  'Pause',
  'Liquidation',
  'En cours de liquidation',
];

const ACTED_ETAT_OPTIONS = ['Résiliation', 'Rétractation'];

// L'ordre suit celui du board : les états actés juste après les « en cours »,
// pour qu'on lise la progression d'un dossier de haut en bas.
const etatOptionsFor = (canActe) => (canActe
  ? [
    'Signé',
    'En cours de résiliation',
    'En cours de rétractation',
    ...ACTED_ETAT_OPTIONS,
    'Self-Résiliation',
    'Pause',
    'Liquidation',
    'En cours de liquidation',
  ]
  : FINANCE_ETAT_OPTIONS);

const MENU_MAX_H = 380;

// ── Rangée date (commit au BLUR, pattern DateRow du board) ────────────────
// Un input date natif émet un change par segment valide : commit à la frappe
// enverrait des années partielles ("0002") en base ET dans l'historique.
function DateField({ label, value, onCommit }) {
  const cancelRef = useRef(false);
  const committed = value ? String(value).slice(0, 10) : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap' }}>{label}</div>
      <input
        key={committed}
        type="date"
        defaultValue={committed}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          if (cancelRef.current) { cancelRef.current = false; return; }
          const v = e.target.value || null;
          if (v !== (committed || null)) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { cancelRef.current = true; e.currentTarget.value = committed; e.currentTarget.blur(); }
        }}
        style={{
          padding: '6px 8px', borderRadius: 7, border: `1px solid ${BORDER}`,
          background: '#fff', color: TEXT, fontSize: 12, fontFamily: 'inherit',
          outline: 'none', width: 138, boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// `onActedEtat` (optionnel) : quand un état ACTÉ est choisi (Résiliation,
// Rétractation, Self-Résiliation, Liquidation), on ne pose rien ici — on passe
// la main au dialogue de sortie client, qui demande la date d'effet et règle le
// sort des créances. Sans cette prop (tableau), le comportement historique
// reste : POST immédiat.
export default function BoardEtatCell({ boardRow, onEtatChange, disabled = false, onActedEtat = null }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  // Acter une résiliation ou une rétractation : direction seulement.
  const canActe = canEditAmounts(apiClient.getUser()?.role);

  // Même hygiène que le board : le menu (position: fixed) se ferme dès que la
  // table scrolle ou que la fenêtre est resize, sinon il "flotte" détaché.
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      // Ne pas fermer quand l'événement vient du menu lui-même (scroll interne
      // de la liste, ou blur/focus des inputs date).
      if (e?.target?.closest?.('[data-board-etat-menu]')) return;
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Client absent du board (pas de numero_client résolu) : rien à piloter.
  if (!boardRow) {
    return <span style={{ color: '#c8cdd7', fontSize: 13 }}>—</span>;
  }

  const etat = displayEtat(boardRow);
  const pending = isEtatPending(boardRow);
  const posedEtat = boardRow.etat_manuel;          // état POSÉ (dont on édite les dates)
  const dateCfg = posedEtat ? ETAT_DATE_CONFIG[posedEtat] : null;

  const toggle = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const up = r.bottom + MENU_MAX_H > window.innerHeight && r.top > MENU_MAX_H;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, up });
    setOpen(true);
  };

  const pick = (opt) => {
    // Acter une résiliation depuis la finance, c'est ouvrir une sortie client
    // (dev 2026-09-03) : la date d'effet et le sort des créances se décident
    // dans le dialogue, pas dans une liste déroulante.
    if (onActedEtat && opt && ACTED_EXIT_ETATS.has(opt)) {
      setOpen(false);
      onActedEtat(opt);
      return;
    }
    onEtatChange({ etat: opt });
    // État daté : le menu reste ouvert et révèle la saisie de date (l'update
    // optimiste de la Map board fait apparaître la section dessous).
    if (!opt || !ETAT_DATE_CONFIG[opt]) setOpen(false);
  };

  // Correction de date : renvoie un etat-change complet (état + dates
  // courantes + le champ modifié), comme `applyDate` de la fiche board.
  const applyDate = (chg) => onEtatChange({
    etat: posedEtat,
    etat_date: boardRow.etat_date,
    pause_end_date: boardRow.pause_end_date,
    pause_relance_date: boardRow.pause_relance_date,
    ...chg,
  });

  // "Automatique" (null) = retirer l'override manuel — même entrée que le
  // picker optilex du board. Sans elle, une pose erronée serait irréversible
  // depuis cette page.
  const items = [
    { opt: null, label: 'Automatique' },
    ...etatOptionsFor(canActe).map((o) => ({ opt: o, label: o })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 0 }}>
      {disabled ? (
        <EtatBadge etat={etat} />
      ) : (
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          title="Changer l'état (board Owner/Opti'Lex)"
          style={{
            border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <EtatBadge etat={etat} />
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={MUTED}
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.16s ease', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* État daté posé mais pas encore effectif : le client reste actif
          jusqu'à la date d'effet — même restitution que le board. */}
      {pending && boardRow.etat_date && (
        <div
          style={{
            fontSize: 10.5, fontWeight: 700, color: AMBER, lineHeight: 1.25,
            whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
          title={`${posedEtat} prévue le ${formatDateFR(boardRow.etat_date)} — pas encore effective, le client reste actif jusqu'à cette date`}
        >
          ⏳ {posedEtat} · prévu {formatDateFR(boardRow.etat_date)}
        </div>
      )}
      {pending && !boardRow.etat_date && (
        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#a3a9b6', lineHeight: 1.25, whiteSpace: 'nowrap' }}>
          date à renseigner
        </div>
      )}

      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10050 }} />
          <motion.div
            data-board-etat-menu="1"
            initial={{ opacity: 0, scale: 0.96, y: pos.up ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
              left: pos.left, zIndex: 10051,
              background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10,
              boxShadow: '0 8px 28px rgba(17,24,39,0.14)', padding: 5, minWidth: 224,
              maxHeight: MENU_MAX_H, overflowY: 'auto',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              transformOrigin: pos.up ? 'bottom left' : 'top left',
            }}
          >
            {items.map(({ opt, label }) => {
              const st = opt ? (ETAT_STYLE[opt] || {}) : null;
              const sel = opt === posedEtat || (opt !== null && opt === etat);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => { if (sel) { setOpen(false); return; } pick(opt); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    border: 'none', background: sel ? '#f3f4f6' : 'transparent', borderRadius: 7,
                    padding: '8px 10px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                    color: opt ? TEXT : MUTED, fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = '#f7f8fa'; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: st ? (st.dot || '#cbd2e0') : 'transparent',
                    border: opt ? 'none' : `1.5px dashed ${MUTED}`, flexShrink: 0,
                  }} />
                  {label}
                  {sel && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}

            {/* Saisie des dates d'effet — révélée quand l'état POSÉ est daté.
                Pause = période : début + fin CONNUE (pause_end_date) OU
                indéterminée -> relance (pause_relance_date) ; saisir l'une
                efface l'autre (règle de la fiche board). */}
            <AnimatePresence initial={false}>
              {dateCfg && (
                <motion.div
                  key={posedEtat}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    borderTop: `1px solid ${BORDER}`, marginTop: 5, padding: '9px 6px 5px',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {posedEtat} — date(s) d'effet
                    </div>
                    {dateCfg.pause ? (
                      <>
                        <DateField label="Début de pause" value={boardRow.etat_date}
                          onCommit={(d) => applyDate({ etat_date: d })} />
                        <DateField label="Fin de pause" value={boardRow.pause_end_date}
                          onCommit={(d) => applyDate({ pause_end_date: d, pause_relance_date: null })} />
                        <DateField label="Relancer le" value={boardRow.pause_relance_date}
                          onCommit={(d) => applyDate({ pause_relance_date: d, pause_end_date: null })} />
                        <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.4 }}>
                          Fin connue OU date de relance : saisir l'une efface l'autre.
                        </div>
                      </>
                    ) : (
                      <DateField label={dateCfg.label} value={boardRow.etat_date}
                        onCommit={(d) => applyDate({ etat_date: d })} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>,
        document.body,
      )}
    </div>
  );
}
