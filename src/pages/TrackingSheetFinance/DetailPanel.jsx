// DetailPanel.jsx — Notion-style slide-in right panel for a client + period.
//
// Spec (2026-05-08, dev brief 3e passe) :
//   - Slide-in from the right (Framer x: 100% → 0, 250ms cubic-bezier)
//   - Width ~40% viewport (min 520px). Caller controls the main-area shrink.
//   - All values are EDITABLE inline (sauf calculés overdue_*) — réutilise
//     les mêmes EditableCell/EditableSelect/EditableNumber que la TableView.
//   - Every value gets a <CopyButton /> revealed at hover.
//   - Layout 2 cols Owner | Opti'lex pour toutes les paires (Attendu, Récupéré,
//     Retard cumul, Récupéré créances passées, Check PSP, Date paiement).
//   - Same PATCH endpoint as the table (/api/v1/finance-periods/{row_id}).
//
// Refonte phase 3 (2026-08-19, maquette dev + principe Ismahane « hyper
// synthétique, mais accès au détail via un dérouler ») :
//
// Sections (ordre vertical) :
//   1. Header barre            (existant : breadcrumb + icônes + X)
//   2. ClientHeader            (avatar initiales pastel + nom + « Client n°X ·
//                               Dossier ouvert le … » + badge statut paiement
//                               scope-aware + bouton Modifier → ouvre le
//                               détail. État board juste dessous : action
//                               fréquente, jamais dans l'accordéon)
//   3. KpiTiles                (Total contrat / Encaissé / Restant dû —
//                               dérivés de la timeline, scope-aware)
//   4. Informations contractuelles (liste compacte icône + libellé / valeur)
//   5. État de compte          (échéancier ligne par ligne : Encaissée /
//                               Partielle / En retard / À venir, 6 dernières
//                               + « Tout afficher »)
//   6. Timeline mensuelle      (EXISTANTE, telle quelle)
//   7. « Voir le détail complet » (accordéon fermé par défaut : TOUT le
//                               contenu historique du panneau — TitleBlock,
//                               MetaRow, Identité, Modalités, Owner|Opti'lex,
//                               Historique — déplacé tel quel, rien supprimé)
//
// Endpoints :
//   GET    /api/v1/finance-periods/client/{id}/timeline
//   GET    /api/v1/finance-periods/client/{id}/profile
//   GET    /api/v1/finance-periods/client/{id}/audit
//   GET    /api/v1/optilex/client-agenda?numero_client=…
//   PATCH  /api/v1/finance-periods/{row_id}  (via onPatchRow prop)
//   GET/POST/PATCH/DELETE  /api/v1/finance-periods/client/{id}/comments
//     (fil interne Owner — cf. ClientComments, 2026-08-25 ; remplace la
//      section « Timeline mensuelle » supprimée le même jour)

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, Maximize2, Minimize2, MoreHorizontal, ChevronsRight,
  Calendar, Briefcase, History, Lock, Landmark, PenLine, FileSignature,
  Hash, User, Box, CreditCard, Pencil, Download,
  Pin, Trash2, MessageSquarePlus,
  Scale, CalendarClock, CalendarCheck2,
} from 'lucide-react';

import apiClient from '../../services/apiClient.js';
import {
  formatEUR, formatDateFR, formatMonthLabel, periodFromDate, splitSocieteRep,
  ETAT_COLORS, ETAT_FALLBACK, TERMINATED_BOARD_ETATS,
  PAYMENT_SPECIFICITIES, PAYMENT_SPECIFICITY_COLORS, PAYMENT_SPECIFICITY_FALLBACK,
  AUTO_DEBIT_OPTIONS, AUTO_DEBIT_COLORS, AUTO_DEBIT_FALLBACK,
  PSP_OPTIONS, PSP_COLORS, PSP_FALLBACK,
  EMPLOYEE_RANGES, normalizeEmployeeRange, employeeRangeLabel,
  AUDIT_FIELD_LABELS,
  PROFILE_CHANGE_LABELS,
  ALLOWED_ROLES,
  canEditAmounts,
  canEditContract,
  toNumber,
  currentPeriod,
  parseDateFR,

  paymentModeLabel,
  normalizePaymentMode,
  PAYMENT_MODES, PAYMENT_MODE_LABELS,
  shiftMonth,
  scopedOverdueCurrent,
  scopedCredit,
  scopedOverdueCum,
  scopedPeriodAmounts,
} from './constants.js';
import {
  EditableNumber, EditableDate, EditableSelect, EditableText, CopyButton,
} from './EditableCell.jsx';
import ContactList from './ContactList.jsx';
// État board Owner/Opti'Lex : briques exportées par le board (source de
// vérité des états) + cellule picker partagée avec la TableView.
import { ETAT_STYLE, displayEtat } from '../OptilexBoard.jsx';
import BoardEtatCell from './components/BoardEtatCell.jsx';

// Notion palette (sync with index.jsx N).
const N = {
  pageBg:    '#ffffff',
  sideBg:    '#f7f7f5',
  sideHover: '#efeeec',
  border:    '#e9e9e7',
  borderSft: '#f1f1ef',
  text:      '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  green:     '#0f7b6c',
  greenBg:   '#cfe9e3',
  red:       '#b74133',
  redBg:     '#ffe2dd',
};

const PANEL_MIN_WIDTH = 520;

export default function DetailPanel({
  open,
  clientId,
  rowId,           // currently focused period row (the one user clicked)
  onClose,
  onSelectRow,     // (rowId) → caller updates rowId
  onPatchRow,      // (rowId, patch) → reuses table's optimistic patch flow
  boardMap,        // Map numero_client → row board Owner/Opti'Lex (états)
  onBoardEtatChange, // (numero_client, payload) → POST /optilex/etat-change
  onShowToast,     // (msg, type?) → reuses page-level toast
  rows,            // current period rows (so we can find focused row immediately)
  scope = 'global', // vision active du tableau : 'owner' | 'optilex' | 'global'
}) {
  const [timeline, setTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  // 2026-08-21 : l'audit PAR ROW (states audit/loadingAudit + GET
  // /finance-periods/{row_id}/audit) est retiré — doublon strict de l'audit
  // client-level (`clientAudit`, toutes périodes avec badge période) qui
  // alimente désormais la ligne « Dernière action » ET l'historique de
  // l'accordéon. Une requête de moins par changement de row.
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  // Fiche client (profil) : SIREN, contacts typés, effectif courant, état
  // hérité du board, fin de contrat, journal des changements de la fiche.
  const [profile, setProfile] = useState(null);
  // Accordéon « Voir le détail complet » (phase 3) — fermé par défaut.
  // Le bouton Modifier du header l'ouvre et scrolle dessus.
  const [detailOpen, setDetailOpen] = useState(false);
  // Édition en place des informations contractuelles (crayon de section).
  const [contractEditing, setContractEditing] = useState(false);
  const detailRef = useRef(null);
  // Historique des actions client (vue synthétique, demande Ismahane) —
  // endpoint en cours de déploiement côté backend : toute erreur (404…)
  // masque simplement la section, jamais de crash.
  const [clientAudit, setClientAudit] = useState(null);
  // Écriture réservée à l'équipe finance + admin (le CEO lit).
  // Deux niveaux de droits (dev 2026-08-27) : l'équipe finance entretient la
  // fiche (modalités, sociétés, associés, contacts) mais ne touche ni aux
  // encaissements, ni à la formule, ni au SIREN, ni à l'état board.
  const role = apiClient.getUser()?.role;
  const canEdit = canEditContract(role);
  const canEditMoney = canEditAmounts(role);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeline(null);
      setError(null);
      setFullscreen(false);
      setProfile(null);
      setDetailOpen(false);
      setClientAudit(null);
    }
  }, [open]);

  // Audit client (toutes périodes confondues) pour la « Dernière action » de
  // la vue synthétique. Défensif sur la forme de la réponse ({entries} ou
  // tableau nu) — le contrat backend est en cours de validation.
  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    setClientAudit(null);
    apiClient.get(`/api/v1/finance-periods/client/${clientId}/audit`)
      .then((data) => {
        if (cancelled) return;
        const entries = Array.isArray(data?.entries) ? data.entries
          : Array.isArray(data) ? data : [];
        setClientAudit(entries);
      })
      .catch(() => { if (!cancelled) setClientAudit(null); });
    return () => { cancelled = true; };
  }, [open, clientId]);

  // Profil client — rechargeable après chaque édition (SIREN, contacts,
  // effectif) pour que la fiche et son journal restent d'accord.
  const refreshProfile = useCallback(() => {
    if (!clientId) return;
    apiClient.get(`/api/v1/finance-periods/client/${clientId}/profile`)
      .then(setProfile)
      .catch((e) => console.error('[DetailPanel profile]', e));
  }, [clientId]);

  useEffect(() => {
    if (!open || !clientId) return;
    setProfile(null);
    refreshProfile();
  }, [open, clientId, refreshProfile]);

  // Fetch timeline whenever clientId changes
  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    setLoadingTimeline(true);
    apiClient.get(`/api/v1/finance-periods/client/${clientId}/timeline`)
      .then((data) => { if (!cancelled) { setTimeline(data); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message || 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoadingTimeline(false); });
    return () => { cancelled = true; };
  }, [open, clientId]);

  // ESC handler
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focused row : prefer the row coming from the table's `rows` prop (fresh
  // optimistic state) before falling back to the timeline payload (less fresh).
  // This guarantees the panel reflects edits made elsewhere immediately.
  const focusedRow = useMemo(() => {
    if (rowId && Array.isArray(rows)) {
      const fromTable = rows.find((r) => r.id === rowId);
      if (fromTable) return fromTable;
    }
    return (timeline?.periods || []).find((p) => p.id === rowId) || null;
  }, [rowId, rows, timeline]);

  // Mémoïsé : référence stable pour les useMemo dérivés (kpis, échéancier).
  const periods = useMemo(() => timeline?.periods || [], [timeline]);

  // Mois de signature 'YYYY-MM' — MÊME source/parsing que le header
  // (« Dossier ouvert le … ») : profile.date_signature via parseDateFR,
  // qui gère les formats mixtes ISO et DD/MM/YYYY. Null si absente ou
  // illisible → aucun filtrage (comportement historique, pas de crash).
  const signatureMonth = useMemo(() => {
    const d = parseDateFR(profile?.date_signature);
    if (!d) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [profile]);

  // Règle Ismahane 2026-08-19 : la timeline (et l'échéancier) COMMENCE au
  // mois de signature — les mois à 0,00 € antérieurs n'existent pas pour le
  // client. Signature antérieure au premier mois de données → le filtre ne
  // retire rien (comparaison lexicale 'YYYY-MM'). Les KPIs restent calculés
  // sur `periods` complet (les mois pré-signature sont à 0 de toute façon).
  const visiblePeriods = useMemo(() => {
    if (!signatureMonth) return periods;
    return periods.filter((p) => String(p.period).slice(0, 7) >= signatureMonth);
  }, [periods, signatureMonth]);

  // 2026-08-25 : le marqueur « Signature » vivait dans la timeline mensuelle,
  // supprimée depuis. L'information reste portée par le header du panneau
  // (« Dossier ouvert le {date longue} ») — rien de perdu.

  const client = focusedRow?.client || periods[0]?.client || null;
  // État du client = celui du board Owner/Opti'Lex (source de vérité depuis
  // 2026-08-18). Fallbacks conservés pour les clients hors board : état
  // hérité (résiliation/rétractation actée) puis `clients.etat` legacy.
  const boardRow = (client?.numero_client && boardMap?.get(client.numero_client)) || null;
  const boardEtat = boardRow ? displayEtat(boardRow) : null;

  // ── Agenda client (RDV + juriste de référence) — retour dev 2026-08-21 ──
  // Même endpoint que la modale agenda du board (GET /optilex/client-agenda,
  // accessible aux rôles finance). Fetch seulement si le client est au board
  // (numero_client résolu) ; toute erreur → section masquée, jamais de crash.
  const numeroClient = client?.numero_client || null;
  const [clientAgenda, setClientAgenda] = useState(null);
  useEffect(() => {
    if (!open || !numeroClient) { setClientAgenda(null); return undefined; }
    let alive = true;
    apiClient.get(`/api/v1/optilex/client-agenda?numero_client=${encodeURIComponent(numeroClient)}`)
      .then((r) => { if (alive) setClientAgenda(r); })
      .catch(() => { if (alive) setClientAgenda(null); });
    return () => { alive = false; };
  }, [open, numeroClient]);
  const inheritedEtat = profile?.etat_inherited || null;
  const effectiveEtat = inheritedEtat || client?.etat;
  const etatMeta = (boardEtat && ETAT_STYLE[boardEtat])
    || (effectiveEtat && ETAT_COLORS[effectiveEtat])
    || ETAT_FALLBACK;

  // ── Dérivés phase 3 (synthèse scope-aware) ─────────────────────────────

  // Badge statut paiement du header — priorité retard courant > créances
  // antérieures > à jour, dans la vision active (même sémantique que les
  // vues-filtres du tableau).
  const paymentStatus = useMemo(() => {
    if (!focusedRow) return null;
    if (scopedOverdueCurrent(focusedRow, scope) > 0) {
      return { label: 'En retard', bg: '#fdecec', fg: '#b42318' };
    }
    if (scopedOverdueCum(focusedRow, scope) > 0) {
      return { label: 'Créances antérieures', bg: '#fff3e3', fg: '#b45309' };
    }
    return { label: 'À jour', bg: '#e9f9f0', fg: '#15794a' };
  }, [focusedRow, scope]);

  // KPIs contrat — dérivés de la timeline déjà chargée (aucun nouvel appel).
  //
  // Total contrat = engagement de 12 mois, décompté depuis le début de la
  // facturation, c'est-à-dire le RDV d'onboarding Owner (règle dev
  // 2026-08-26). Sommer les lignes présentes ne marchait pas : notre
  // historique s'arrête en janvier 2027, donc l'engagement d'un client
  // récent était tronqué (L'EMAN n°722 : 1 695 € sur cinq mois au lieu de
  // 4 068 €) et celui d'un ancien gonflé, cumulé sur seize mois.
  //
  // Encaissé et Restant dû portent sur la MÊME fenêtre : sinon un client
  // entré dans sa deuxième année afficherait un faux trop-perçu, son
  // encaissé cumulé dépassant l'engagement d'une seule année.
  const kpis = useMemo(() => {
    const byMonth = new Map();
    for (const p of periods) {
      const key = periodFromDate(p.period);
      if (key) byMonth.set(key, scopedPeriodAmounts(p, scope));
    }

    // Départ : mois de l'onboarding Owner, avec repli sur le premier mois
    // facturé — deux tiers des fiches n'ont pas de date d'onboarding.
    const onboarding = parseDateFR(client?.rdv_onboarding);
    const firstBilled = periods.find((p) => scopedPeriodAmounts(p, scope).expected > 0);
    let start = onboarding
      ? `${onboarding.getFullYear()}-${String(onboarding.getMonth() + 1).padStart(2, '0')}`
      : periodFromDate(firstBilled?.period || periods[0]?.period || '');
    if (!start) return { total: 0, encaisse: 0, restant: 0 };

    // Année d'engagement en cours : la fenêtre avance d'un an à chaque
    // anniversaire, sans quoi elle resterait figée sur la première année.
    const [sy, sm] = start.split('-').map(Number);
    const [cy, cm] = currentPeriod().split('-').map(Number);
    const elapsed = (cy - sy) * 12 + (cm - sm);
    if (elapsed >= 12) start = shiftMonth(start, Math.floor(elapsed / 12) * 12);

    const yearly = normalizePaymentMode(
      focusedRow?.payment_mode || client?.payment_mode,
    ) === 'YEARLY';

    let total = 0;
    let encaisse = 0;
    let monthly = 0;  // mensualité de référence pour les mois hors horizon
    for (let i = 0; i < 12; i += 1) {
      const a = byMonth.get(shiftMonth(start, i));
      if (a) {
        total += a.expected;
        encaisse += a.received + a.receivedOverdue;
        if (!yearly && a.expected > 0) monthly = a.expected;
      } else if (!yearly) {
        total += monthly;
      }
    }
    return { total, encaisse, restant: total - encaisse };
  }, [periods, scope, client, focusedRow]);

  // Échéancier « État de compte » — une entrée par période à montant
  // (attendu ou reçu), triée chronologiquement et numérotée. Statuts :
  //   reçu ≥ attendu            → Encaissée
  //   0 < reçu < attendu        → Partielle
  //   mois futur                → À venir
  //   mois courant              → En retard si retard courant calculé, sinon À venir
  //   mois passé sans paiement  → En retard
  const installments = useMemo(() => {
    const nowMonth = currentPeriod();
    // `visiblePeriods` : une échéance ne peut pas précéder la signature.
    const sorted = [...visiblePeriods].sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const list = [];
    for (const p of sorted) {
      const a = scopedPeriodAmounts(p, scope);
      if (a.expected <= 0 && a.received <= 0) continue;
      const month = String(p.period).slice(0, 7);
      let status;
      if (a.received >= a.expected && a.received > 0) status = 'paid';
      else if (a.received > 0) status = 'partial';
      else if (month > nowMonth) status = 'upcoming';
      else if (month === nowMonth) status = scopedOverdueCurrent(p, scope) > 0 ? 'late' : 'upcoming';
      else status = 'late';
      list.push({ id: p.id, n: list.length + 1, month, status, ...a });
    }
    return list;
  }, [visiblePeriods, scope]);

  // (Le forfait mensuel dérivé des échéances a été retiré avec le « N × … »
  // de la modalité — 2026-08-25. La Formule affiche la tranche seule.)

  // ── État de compte PDF (phase 4) ───────────────────────────────────────
  // L'état de compte suit la VISION active (dev 2026-08-25) : Owner et
  // Opti'lex sont deux entités juridiques → deux documents distincts (jamais
  // de fusion). En vision Globale, les deux sont proposés séparément.
  // Le bouton est TOUJOURS actif : un client sans échéance facturée obtient
  // quand même son document (en-tête + bloc client + tableau vide).
  // Génération 100 % frontend depuis les données déjà chargées, module PDF
  // chargé en lazy (dynamic import → chunk séparé pour @react-pdf/renderer).

  // `entity` : 'owner' | 'optilex' — pilote émetteur ET champs de montants.
  const [pdfGenerating, setPdfGenerating] = useState(null); // null | 'owner' | 'optilex'
  const downloadStatement = useCallback(async (entity = 'owner') => {
    if (pdfGenerating) return;
    setPdfGenerating(entity);
    try {
      const { generateEtatDeCompte } = await import('./pdf/EtatDeComptePdf.jsx');

      // Société découpée + personne(s) (source unique splitSocieteRep) ;
      // numero_client arrive préfixé « n° » en base → strip (le PDF pose
      // son propre « n° »).
      const { societeName, representant: repFromSociete } = splitSocieteRep(client?.societe);
      const personne = client?.representative_name || repFromSociete;

      // Lignes de l'entité demandée. Périmètre comptable (retour dev ZILWA
      // n°637, 2026-08-21) : de la signature au mois de la date d'émission
      // INCLUS — les mois futurs ne sont pas facturés, ils sortent du
      // document ET du total. Les mois vides (ni facturé ni payé) sautés.
      const nowMonth = currentPeriod();
      const sorted = [...visiblePeriods]
        .sort((a, b) => String(a.period).localeCompare(String(b.period)));
      const entityRows = [];
      let latestExpected = null;
      for (const p of sorted) {
        const month = String(p.period).slice(0, 7);
        if (month > nowMonth) continue; // mois futur — hors périmètre
        const a = scopedPeriodAmounts(p, entity);
        if (a.expected <= 0 && a.received <= 0) continue;
        if (a.expected > 0) latestExpected = a.expected;
        // « Payé » inclut le récupéré sur créances passées du mois : le
        // solde cumulé (calculé dans le PDF) régularise ainsi les mois
        // précédents au fil des lignes.
        entityRows.push({
          month,
          billed: a.expected,
          paid: a.received + a.receivedOverdue,
        });
      }

      // Offre = libellé de la Formule : tranche, sinon forfait (tarif client
      // prioritaire côté Owner, sinon dernier attendu de l'entité).
      const range = profile?.employee_range || focusedRow?.employee_range || client?.employee_range;
      const tarif = entity === 'owner' ? toNumber(client?.tarif) : null;
      const price = (tarif && tarif > 0) ? tarif : latestExpected;
      const offre = range ? `${range} salariés` : (price ? formatEUR(price) : '—');

      const rows = entityRows.map((r) => ({
        periodLabel: formatMonthLabel(r.month),
        offre,
        billed: r.billed,
        paid: r.paid,
      }));

      // Adresse client : exposée par le profil (backend 2026-08-25) —
      // code défensif, les champs peuvent ne pas encore être présents.
      const addressLine = [
        profile?.address_line1 || null,
        [profile?.postal_code, profile?.city].filter(Boolean).join(' ') || null,
      ].filter(Boolean).join(', ');

      const blob = await generateEtatDeCompte({
        entity,
        recipient: {
          company: societeName,
          person: personne || '',
          clientNumber: client?.numero_client
            ? String(client.numero_client).replace(/^n°\s*/i, '')
            : '',
          address: addressLine,
          email: client?.email || '',
          // Siret du modèle : `profile.siret` (14 chiffres, backend
          // 2026-08-25) → repli sur le SIREN connu → vide (libellé
          // conservé, comme le modèle).
          siret: profile?.siret || profile?.siren || '',
        },
        rows,
        // Date courte DD/MM/YY — format de la référence.
        issueDate: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (societeName || 'Client').replace(/[\\/:*?"<>|]/g, '-').trim();
      const entityLabel = entity === 'optilex' ? "Opti'lex" : 'Owner';
      a.href = url;
      a.download = `Etat de compte ${entityLabel} - ${safeName} - ${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('[DetailPanel pdf]', e);
      onShowToast?.('Erreur lors de la génération du PDF', 'error');
    } finally {
      setPdfGenerating(null);
    }
  }, [pdfGenerating, visiblePeriods, profile, focusedRow, client, onShowToast]);

  // Bouton Modifier : déplie le détail complet puis scrolle dessus (léger
  // délai pour laisser l'accordéon commencer son expansion).
  const openDetail = useCallback(() => {
    setDetailOpen(true);
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, []);

  // Patch helper bound to current rowId — reuses table's onPatchRow flow.
  // Falls back to a direct PATCH if the parent didn't wire onPatchRow.
  // `extra` : champs accompagnant la saisie sans être eux-mêmes édités —
  // aujourd'hui `change_effective`, le mois d'effet d'un changement de
  // formule ou de modalité.
  const patch = useCallback((field, extra = null) => async (value) => {
    if (!rowId) return;
    const body = { [field]: value, ...(extra || {}) };
    if (onPatchRow) {
      await onPatchRow(rowId, body);
    } else {
      await apiClient.patch(`/api/v1/finance-periods/${rowId}`, body);
    }
  }, [rowId, onPatchRow]);

  const onCopied = useCallback(() => {
    onShowToast?.('Copié dans le presse-papiers', 'info');
  }, [onShowToast]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="detail-panel"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            height: '100vh',
            width: fullscreen ? '100vw' : `clamp(${PANEL_MIN_WIDTH}px, 40vw, 720px)`,
            background: N.pageBg,
            borderLeft: `1px solid ${N.border}`,
            boxShadow: '-12px 0 24px rgba(15,15,15,0.06)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}
        >
          {/* HEADER */}
          <PanelHeader
            client={client}
            onClose={onClose}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
          />

          {/* SCROLLABLE BODY */}
          <div className="tsf-scroll" style={{
            flex: 1, overflowY: 'auto',
            padding: '24px 32px 64px',
          }}>
            {/* Header client synthétique (phase 3) : avatar + nom + statut
                paiement + Modifier. L'État board reste ici — action
                fréquente, jamais dans l'accordéon. */}
            <ClientHeader
              client={client}
              profile={profile}
              paymentStatus={paymentStatus}
              onModify={openDetail}
              boardRow={boardRow}
              // L'état du client (Signé, résiliation…) est une décision
              // engageante : direction financière et direction seulement.
              canEdit={canEditMoney}
              onBoardEtatChange={onBoardEtatChange}
              inheritedEtat={inheritedEtat}
            />

            {/* Error state */}
            {error && (
              <div style={{
                marginTop: 20, padding: 12, background: N.redBg,
                color: N.red, borderRadius: 6, fontSize: 13,
              }}>
                {error}
              </div>
            )}

            {/* Bandeau de contexte : État, Période, Effectif, SIREN, et
                l'échéance du contrat. Il vivait dans l'accordéon « Voir le
                détail complet » — donc invisible en pratique. Sorti au
                premier plan le 2026-08-27 : le SIREN et l'échéance sont
                justement les deux informations qu'on allait y chercher. */}
            <MetaRow profile={profile} boardRow={boardRow} />

            {/* 4 tuiles KPI contrat (scope-aware, dérivées de la timeline).
                « Restant dû » = tout ce que le contrat doit encore
                rapporter (mois à venir inclus) ; « Retard à date » = ce qui
                est réellement en retard aujourd'hui (mois courant + créances
                antérieures) — deux notions distinctes, à ne pas confondre. */}
            <KpiTiles
              kpis={kpis}
              overdueCurrent={focusedRow ? scopedOverdueCurrent(focusedRow, scope) : 0}
              overdueCum={focusedRow ? scopedOverdueCum(focusedRow, scope) : 0}
              credit={focusedRow ? scopedCredit(focusedRow, scope) : 0}
              loading={loadingTimeline}
            />

            {/* Section : Informations contractuelles.
                Le crayon ouvre l'édition sur place (demande dev 2026-08-27) :
                c'est ici qu'on corrige la fiche, plus dans l'accordéon. */}
            <Section
              title="Informations contractuelles"
              delay={0.08}
              action={canEdit ? (
                <button
                  type="button"
                  onClick={() => setContractEditing((v) => !v)}
                  title={contractEditing ? 'Terminer l’édition' : 'Modifier la fiche'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    border: 'none', cursor: 'pointer',
                    background: contractEditing ? N.sideHover : 'transparent',
                    color: contractEditing ? N.text : N.textMuted,
                    borderRadius: 5, padding: '3px 7px',
                    fontSize: 11, fontWeight: 600,
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  <Pencil size={12} />
                  {contractEditing ? 'Terminer' : 'Modifier'}
                </button>
              ) : null}
            >
              <ContractInfoList
                client={client}
                profile={profile}
                focusedRow={focusedRow}
                boardRow={boardRow}

                patch={patch}
                canEdit={canEdit}
                editing={contractEditing}
                clientId={clientId}
                onProfileChanged={refreshProfile}
                onShowToast={onShowToast}
                onCopied={onCopied}
              />
            </Section>

            {/* Section : État de compte (échéancier) — bouton(s) PDF à côté
                du titre. Le document suit la vision active ; en Globale les
                deux entités sont proposées séparément (jamais fusionnées).
                Toujours actif, même sans échéance facturée. */}
            <Section
              title="État de compte"
              delay={0.11}
              action={(
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {(scope === 'global' ? ['owner', 'optilex'] : [scope]).map((entity) => (
                    <StatementButton
                      key={entity}
                      entity={entity}
                      label={scope === 'global'
                        ? (entity === 'optilex' ? "État de compte Opti'lex" : 'État de compte Owner')
                        : "Télécharger l'état de compte"}
                      busy={pdfGenerating === entity}
                      disabled={!!pdfGenerating}
                      onClick={() => downloadStatement(entity)}
                    />
                  ))}
                </span>
              )}
            >
              <InstallmentsList
                installments={installments}
                loading={loadingTimeline}
                focusedRowId={rowId}
                onSelectRow={onSelectRow}
              />
            </Section>

            {/* Dernière action + historique des actions (vue synthétique) —
                masqué si l'endpoint audit client est absent ou vide. */}
            <ActionsHistory entries={clientAudit} />

            {/* Section : Commentaires — remplace la timeline mensuelle
                (2026-08-25) : celle-ci faisait doublon avec l'échéancier
                « État de compte » et ne servait pas le travail réel de la
                finance (recouvrement). Ici vit le contexte que seul un
                humain écrit : « promesse de règlement au 15 », « en attente
                retour cabinet ». Fil INTERNE Owner — le cabinet Opti'Lex
                n'y a pas accès (aucun lien vers le fil du board). */}
            <ClientComments clientId={clientId} onShowToast={onShowToast} />

            {/* Section : Rendez-vous & juriste référent — vue synthétique
                depuis le retour dev 2026-08-21 (sortie de l'accordéon).
                Masquée si client hors board / aucune donnée agenda. */}
            {boardRow && (clientAgenda?.reference_jurist || (clientAgenda?.rdv?.length || 0) > 0
              || boardRow.rdv_onboarding_date || boardRow.rdv_lancement_date
              || boardRow.rdv_fiscal_date || boardRow.rdv_social_date) && (
              <Section title="Rendez-vous & juriste référent" delay={0.16}>
                <RdvJuristeSection boardRow={boardRow} agenda={clientAgenda} onCopied={onCopied} />
              </Section>
            )}

            {/* « Voir le détail complet » — accordéon fermé par défaut.
                TOUT le contenu historique du panneau vit ici, déplacé tel
                quel (rien supprimé). Le bouton Modifier du header l'ouvre. */}
            <DetailAccordion
              open={detailOpen}
              onToggle={() => setDetailOpen((v) => !v)}
              innerRef={detailRef}
              delay={0.17}
            >
              {/* Title block */}
              <TitleBlock client={client} etatMeta={etatMeta} focusedRow={focusedRow} inheritedEtat={inheritedEtat} onCopied={onCopied} />

              {/* Section : Identité client */}
              <Section title="Identité client" delay={0.03}>
                <IdentitySection
                  client={client}
                  clientId={clientId}
                  focusedRow={focusedRow}
                  profile={profile}
                  canEdit={canEdit}
                  refreshProfile={refreshProfile}
                  boardRow={boardRow}
                  onBoardEtatChange={onBoardEtatChange}
                  onCopied={onCopied}
                  onShowToast={onShowToast}
                />
              </Section>

              {/* Section : Modalités */}
              <Section title="Modalités" delay={0.06}>
                <ModalitesSection
                  client={client}
                  clientId={clientId}
                  focusedRow={focusedRow}
                  profile={profile}
                  canEdit={canEdit}
                  refreshProfile={refreshProfile}
                  patch={patch}
                  onCopied={onCopied}
                  onShowToast={onShowToast}
                />
              </Section>

              {/* Section : Owner | Opti'lex (split 2 cols) */}
              <Section title="Owner | Opti'lex" delay={0.09}>
                <OwnerOptilexSection
                  focusedRow={focusedRow}
                  patch={patch}
                  onCopied={onCopied}
                />
              </Section>

              {/* Section : Historique des actions — repliée par défaut.
                  Fusion 2026-08-21 : l'audit client-level (toutes périodes,
                  badge période) remplace l'ancien audit par-row (doublon
                  strict de la même donnée) ; le journal de la fiche client
                  (ProfileChangesList) reste, c'est une donnée distincte. */}
              <CollapsibleSection
                title="Historique des actions"
                count={(clientAudit?.length || 0) + (profile?.changes?.length || 0)}
                delay={0.12}
              >
                <ClientAuditList entries={clientAudit} />
                <ProfileChangesList changes={profile?.changes} />
              </CollapsibleSection>
            </DetailAccordion>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
function PanelHeader({ client, onClose, fullscreen, onToggleFullscreen }) {
  const { societeName } = splitSocieteRep(client?.societe);
  return (
    <div style={{
      height: 44,
      flexShrink: 0,
      display: 'flex', alignItems: 'center',
      gap: 6, padding: '0 12px',
      borderBottom: `1px solid ${N.border}`,
      background: N.pageBg,
    }}>
      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: N.textMuted, minWidth: 0, flex: 1,
      }}>
        <span>Tracking Finance</span>
        <ChevronRight size={12} style={{ color: N.textFaint, flexShrink: 0 }} />
        <span style={{
          color: N.text, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {societeName || 'Client'}
        </span>
      </div>

      {/* Action icons */}
      <button
        onClick={onToggleFullscreen}
        title={fullscreen ? 'Réduire' : 'Étendre en plein écran'}
        style={iconBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
      <button
        onClick={onClose}
        title="Réduire le panneau"
        style={iconBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <ChevronsRight size={14} />
      </button>
      <button
        title="Plus d'actions"
        style={iconBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <MoreHorizontal size={14} />
      </button>
      <button
        onClick={onClose}
        title="Fermer (Esc)"
        style={iconBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <X size={15} />
      </button>
    </div>
  );
}

const iconBtnStyle = {
  width: 28, height: 28,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: 'transparent', cursor: 'pointer',
  borderRadius: 4, color: N.textMuted,
  transition: 'background 0.12s',
};

// ════════════════════════════════════════════════════════════════════════════
// PHASE 3 — vue synthétique (maquette 2026-08-19)
// ════════════════════════════════════════════════════════════════════════════

// Avatar initiales : pastel déterministe dérivé du nom (mêmes familles de
// couleurs que ETAT_STYLE du board — finition homogène avec EtatBadge).
const AVATAR_PASTELS = [
  { bg: '#e9f9f0', fg: '#15794a' },
  { bg: '#eaf1fd', fg: '#1e40af' },
  { bg: '#fff3e3', fg: '#b45309' },
  { bg: '#f3e8ff', fg: '#6940a5' },
  { bg: '#e0f2fe', fg: '#0e7490' },
  { bg: '#fdf2f8', fg: '#ad1a72' },
];

function avatarMeta(name) {
  const str = String(name || '?').trim();
  const words = str.split(/\s+/).filter(Boolean);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : str.slice(0, 2).toUpperCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return { initials, ...AVATAR_PASTELS[hash % AVATAR_PASTELS.length] };
}

// « Dossier ouvert le 12 mars 2026 » — date de signature en format long FR.
function formatDateLongFR(iso) {
  const d = parseDateFR(iso);
  if (!d) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Header client synthétique ───────────────────────────────────────────────
function ClientHeader({
  client, profile, paymentStatus, onModify,
  boardRow, canEdit, onBoardEtatChange, inheritedEtat,
}) {
  // Séparation nom du client / société (2026-08-21) : la ligne principale
  // porte la/les personne(s), la société passe en sous-ligne. Pas de
  // personne détectée (181 cas en base) → société seule, pas de ligne vide.
  // L'avatar reste sur la SOCIÉTÉ (identité visuelle stable).
  const { societeName, representant: repFromSociete } = splitSocieteRep(client?.societe);
  const personne = client?.representative_name || repFromSociete;
  const av = avatarMeta(societeName);
  const openedOn = formatDateLongFR(profile?.date_signature);
  const subtitle = [
    // numero_client contient déjà le préfixe « n° » en base (ex. « n°691 »)
    client?.numero_client ? `Client n°${String(client.numero_client).replace(/^n°\s*/i, '')}` : null,
    openedOn ? `Dossier ouvert le ${openedOn}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Avatar initiales */}
        <div style={{
          width: 52, height: 52,
          borderRadius: '50%',
          background: av.bg, color: av.fg,
          flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, letterSpacing: '0.02em',
          userSelect: 'none',
        }}>
          {av.initials}
        </div>

        {/* Nom du client (personne) + société + sous-titre */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: N.text,
            margin: 0, letterSpacing: '-0.02em', lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {personne || societeName || '—'}
          </h1>
          {personne && societeName && (
            <div style={{
              marginTop: 2, fontSize: 13.5, fontWeight: 500, color: N.textMuted,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {societeName}
            </div>
          )}
          {subtitle && (
            <div style={{ marginTop: 3, fontSize: 12.5, color: N.textMuted }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Modifier (ouvre le détail complet) + badge statut paiement */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          gap: 8, flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onModify}
            title="Ouvrir le détail complet pour modifier"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 28, padding: '0 11px',
              background: '#fff', color: N.text,
              border: `1px solid ${N.border}`, borderRadius: 6,
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 1px 2px rgba(15,15,15,0.04)',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = N.sideBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            <Pencil size={12} strokeWidth={2} />
            Modifier
          </button>
          {paymentStatus && (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={paymentStatus.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 999,
                  background: paymentStatus.bg, color: paymentStatus.fg,
                  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: paymentStatus.fg,
                }} />
                {paymentStatus.label}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* État board — action fréquente, toujours visible (jamais dans
          l'accordéon). Mêmes fallbacks que le Field État du détail. */}
      <div style={{
        marginTop: 12,
        display: 'flex', alignItems: 'center', gap: 10,
        // Aligné à gauche avec le bandeau SIREN / Renouvellement qui suit
        // (demande dev 2026-08-27). L'ancien décalage de 66 px le calait
        // sous le nom du client, ce qui créait un décrochage avec les
        // badges désormais posés juste en dessous.
        minHeight: 24,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: N.textFaint,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          État
        </span>
        {boardRow ? (
          <BoardEtatCell
            boardRow={boardRow}
            disabled={!canEdit}
            onEtatChange={(payload) => onBoardEtatChange?.(client?.numero_client, payload)}
          />
        ) : inheritedEtat ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '2px 10px', borderRadius: 4,
            background: (ETAT_COLORS[inheritedEtat] || ETAT_FALLBACK).bg,
            color: (ETAT_COLORS[inheritedEtat] || ETAT_FALLBACK).fg,
            fontSize: 12.5, fontWeight: 600,
          }}>
            <Lock size={11} />
            {(ETAT_COLORS[inheritedEtat] || ETAT_FALLBACK).label || inheritedEtat}
          </span>
        ) : client?.etat ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '2px 10px', borderRadius: 4,
            background: (ETAT_COLORS[client.etat] || ETAT_FALLBACK).bg,
            color: (ETAT_COLORS[client.etat] || ETAT_FALLBACK).fg,
            fontSize: 12.5, fontWeight: 600,
          }}>
            {(ETAT_COLORS[client.etat] || ETAT_FALLBACK).label || client.etat}
          </span>
        ) : (
          <span style={{ color: '#c8cdd7', fontSize: 13 }}>—</span>
        )}
      </div>
    </motion.div>
  );
}

// ── Bouton de téléchargement d'un état de compte ────────────────────────────
// Un bouton par entité juridique (Owner / Opti'lex). Toujours cliquable :
// un client sans échéance facturée obtient un document au tableau vide.
function StatementButton({ entity, label, busy, disabled, onClick }) {
  const entityLabel = entity === 'optilex' ? "Opti'lex" : 'Owner';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Télécharger l'état de compte ${entityLabel} (PDF)`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 26, padding: '0 10px',
        background: '#fff', color: N.text,
        border: `1px solid ${N.border}`, borderRadius: 6,
        fontSize: 12, fontWeight: 600,
        cursor: disabled ? 'wait' : 'pointer',
        fontFamily: 'inherit', whiteSpace: 'nowrap',
        boxShadow: '0 1px 2px rgba(15,15,15,0.04)',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.12s, opacity 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = N.sideBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
    >
      <motion.span
        animate={busy ? { y: [0, 2, 0] } : { y: 0 }}
        transition={busy ? { duration: 0.7, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
        style={{ display: 'inline-flex' }}
      >
        <Download size={12} strokeWidth={2} />
      </motion.span>
      {busy ? 'Génération…' : label}
    </button>
  );
}

// ── 4 tuiles KPI (Total contrat / Encaissé / Restant dû / Retard à date) ────
// Distinction métier à respecter (dev 2026-08-25) :
//   « Restant dû »   = tout ce que le contrat doit encore rapporter, mois à
//                      VENIR inclus (total − encaissé).
//   « Retard à date » = ce qui est en retard AUJOURD'HUI, soit le retard du
//                      mois courant + les créances antérieures.
// `overdueCurrent` / `overdueCum` arrivent scope-aware du parent.
function KpiTiles({ kpis, overdueCurrent = 0, overdueCum = 0, credit = 0, loading }) {
  const surplus = kpis.restant < 0 ? -kpis.restant : 0;
  const overdueToDate = overdueCurrent + overdueCum;
  // Trop-perçu reporté (backend `credit_*`) : un solde créditeur n'est pas
  // un retard. Sans retard, il PREND LA PLACE de la valeur de la tuile (en
  // vert) pour rendre l'action visible ; avec un retard (possible entre
  // entités en vision Globale), le retard reste la valeur principale et le
  // crédit passe en sous-ligne.
  const creditOnly = credit > 0 && overdueToDate === 0;
  const tiles = [
    { label: 'Total contrat', value: kpis.total, color: N.text },
    { label: 'Encaissé', value: kpis.encaisse, color: N.green },
    {
      label: 'Restant dû',
      value: Math.max(0, kpis.restant), // plancher 0 — le trop-perçu est restitué en sous-note
      color: kpis.restant > 0 ? '#b42318' : N.green,
      notes: [
        surplus > 0 ? { text: `+${formatEUR(surplus)} trop-perçu`, color: N.green } : null,
      ].filter(Boolean),
    },
    {
      label: 'Retard à date',
      value: overdueToDate,
      display: creditOnly ? `Trop-perçu · ${formatEUR(credit)}` : null,
      color: creditOnly ? N.green : (overdueToDate > 0 ? '#b42318' : N.text),
      notes: [
        creditOnly
          ? { text: 'à déduire ou à rembourser', color: N.green }
          : null,
        // La ventilation des créances antérieures a davantage de sens ici
        // que sous « Restant dû » (déplacée le 2026-08-25).
        !creditOnly && overdueCum > 0
          ? { text: `dont ${formatEUR(overdueCum)} de créances antérieures`, color: '#b42318' }
          : null,
        // Retard ET crédit coexistent (entités différentes en Globale).
        !creditOnly && credit > 0
          ? { text: `+${formatEUR(credit)} de trop-perçu`, color: N.green }
          : null,
      ].filter(Boolean),
    },
  ];
  return (
    <div style={{
      display: 'grid',
      // 4 tuiles : `auto-fit` + minmax(160px) → 4 colonnes sur panneau large
      // ou plein écran, bascule automatiquement en 2×2 sur panneau étroit
      // (520 px) plutôt que d'écraser les montants.
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: 10,
      marginTop: 22,
    }}>
      {tiles.map((t, i) => (
        <motion.div
          key={t.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.04 + i * 0.05, ease: [0.4, 0, 0.2, 1] }}
          style={{
            border: `1px solid ${N.borderSft}`,
            borderRadius: 10,
            // padding resserré depuis la 4e tuile : garde ~130px utiles pour
            // les montants à 6 chiffres sans troncature.
            padding: '12px 12px',
            background: '#fff',
            display: 'flex', flexDirection: 'column', gap: 4,
            minWidth: 0,
          }}
        >
          <span style={{
            fontSize: 10.5, fontWeight: 600, color: N.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {t.label}
          </span>
          {loading ? (
            <div style={{
              height: 20, width: '70%', background: '#f3f4f6', borderRadius: 4,
              animation: 'tsfPulse 1.4s ease-in-out infinite',
            }} />
          ) : (
            <>
              <span style={{
                // 19 → 17 px avec la 4e tuile : un montant à 6 chiffres
                // (« 264 770,18 € ») tient sans ellipse en colonne étroite.
                // `display` (libellé + montant, ex. trop-perçu) est plus long
                // qu'un montant seul : légèrement réduit et autorisé à passer
                // sur 2 lignes plutôt que d'être tronqué.
                fontSize: t.display ? 13.5 : 17,
                fontWeight: 700, color: t.color,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
                lineHeight: t.display ? 1.25 : undefined,
                whiteSpace: t.display ? 'normal' : 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {t.display || formatEUR(t.value)}
              </span>
              {(t.notes || []).map((note, j) => (
                <span key={j} style={{
                  fontSize: 10.5, fontWeight: 600, color: note.color,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {note.text}
                </span>
              ))}
            </>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ── Informations contractuelles (liste compacte icône + libellé / valeur) ───
function ContractInfoList({
  client, profile, focusedRow, boardRow, patch, canEdit, onCopied,
  editing = false, clientId, onProfileChanged, onShowToast,
}) {
  // Séparation nom du client / société (2026-08-21) : « Nom du client » =
  // la/les personne(s), la société a sa propre ligne. Pas de personne
  // détectée → « Nom du client » = société, pas de ligne Société en doublon.
  const { societeName, representant: repFromSociete } = splitSocieteRep(client?.societe);
  const personne = client?.representative_name || repFromSociete;
  // numero_client contient déjà le préfixe « n° » en base (ex. « n°691 »).
  const numeroValue = client?.numero_client
    ? String(client.numero_client).replace(/^n°\s*/i, '')
    : null;

  // Formule = TRANCHE SEULE, éditable (retour dev 2026-08-21) — plus de
  // montant accolé (le prix vit dans les tuiles KPI et le PDF). Snapshot de
  // la period focus prioritaire : l'édition PATCHe `employee_range` sur la
  // period (champ accepté par le backend, historisé automatiquement dans
  // l'audit → visible dans l'historique des actions).
  const range = normalizeEmployeeRange(
    focusedRow?.employee_range || profile?.employee_range || client?.employee_range,
  );
  const rangeLabels = EMPLOYEE_RANGES.reduce((acc, v) => {
    acc[v] = employeeRangeLabel(v); return acc;
  }, {});
  // Une tranche hors grille (saisie ancienne : « 3-4 », « 20+ ») garde son
  // libellé, sinon elle s'affichait nue à côté des autres.
  if (range && !rangeLabels[range]) rangeLabels[range] = employeeRangeLabel(range);

  // Modalité : le rythme de paiement, rien d'autre — Mensuel / Annuel /
  // Trimestriel. Le « N × {montant} » dérivé de `payment_specificity` a été
  // retiré (demande dev 2026-08-25) : cette colonne du classeur est souvent
  // périmée et annonçait des échéanciers que le client n'a jamais eus.
  let modalite = null;
  {
    // Chaîne de fallback (2026-08-21) : mode de la period → mode normalisé
    // du client (backend, MONTHLY/YEARLY/QUARTERLY) → `periodicite` du board
    // (libellés FR, ~27 % des clients — ex. client n°1 Shake'N OUT :
    // « Annuel »). paymentModeLabel canonicalise les deux formats.
    modalite = paymentModeLabel(focusedRow?.payment_mode)
      || paymentModeLabel(client?.payment_mode)
      || paymentModeLabel(boardRow?.periodicite);
  }

  // Formule et modalité commandent toutes deux l'attendu : on demande à
  // quel mois le changement s'applique avant d'écrire (demande dev
  // 2026-08-27). `pending` porte la saisie en attente de ce choix.
  const [pending, setPending] = useState(null);
  const askEffective = useCallback((field, value, label) => {
    setPending({ field, value, label });
  }, []);
  const applyPending = useCallback(async (effective) => {
    if (!pending) return;
    const { field, value } = pending;
    setPending(null);
    await patch(field, { change_effective: effective })(value);
  }, [pending, patch]);

  const rows = [
    { Icon: Hash,       label: 'Client n°',            value: numeroValue, mono: true },
    ...(personne ? [
      {
        Icon: Briefcase,
        label: 'Société',
        copyValue: societeName,
        node: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span>{societeName}</span>
            <RelatedEntityList
              items={profile?.companies || []}
              kind="societe"
              clientId={clientId}
              editing={editing}
              onChanged={onProfileChanged}
              onShowToast={onShowToast}
            />
          </div>
        ),
      },
    ] : []),
    {
      Icon: User,
      label: 'Nom du client',
      copyValue: personne || societeName,
      node: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <span>{personne || societeName}</span>
          <RelatedEntityList
            items={profile?.partners || []}
            kind="associe"
            clientId={clientId}
            editing={editing}
            onChanged={onProfileChanged}
            onShowToast={onShowToast}
          />
        </div>
      ),
    },
    { Icon: PenLine,    label: 'Date de signature',    value: formatDateLongFR(profile?.date_signature) },
    // RDV d'onboarding : c'est lui qui déclenche la facturation — premier
    // mois facturé, départ de l'engagement 12 mois, et bascule en retard
    // (demande dev 2026-08-26). Servi par /profile, qui prend la date du
    // classeur puis celle de la fiche CRM ; le payload de liste ne la porte
    // pas, d'où la lecture sur `profile` uniquement.
    {
      Icon: CalendarCheck2,
      label: "RDV d'onboarding",
      // LECTURE SEULE, volontairement (arbitrage dev 2026-08-27) : la date
      // vient de la déclaration de vente. La finance la consulte, elle ne
      // la saisit pas — sinon deux vérités pour la date qui déclenche la
      // facturation.
      value: formatDateLongFR(profile?.rdv_onboarding),
    },
    // Formule = tranche seule, éditable (PATCH employee_range sur la period
    // focus — optimiste + rollback + toast via le flow onPatchRow standard).
    {
      Icon: Box,
      label: 'Formule',
      copyValue: employeeRangeLabel(range),
      node: (
        <EditableSelect
          value={range}
          options={EMPLOYEE_RANGES}
          optionLabels={rangeLabels}
          onCommit={(v) => askEffective('employee_range', v, employeeRangeLabel(v))}
          // La formule commande le montant facturé : direction financière
          // seulement. La modalité, elle, reste ouverte à l'équipe.
          disabled={!canEditMoney}
          placeholderItalic
          width="auto"
        />
      ),
    },
    // Modalité éditable (demande dev 2026-08-27) : passer d'annuel à mensuel
    // change le rythme de facturation, donc l'attendu — même traitement que
    // la formule, mois d'effet demandé avant écriture.
    {
      Icon: CreditCard,
      label: 'Modalité de paiement',
      copyValue: modalite,
      node: (
        <EditableSelect
          value={normalizePaymentMode(focusedRow?.payment_mode || client?.payment_mode)}
          options={PAYMENT_MODES}
          optionLabels={PAYMENT_MODE_LABELS}
          onCommit={(v) => askEffective('payment_mode', v, paymentModeLabel(v))}
          disabled={!canEdit}
          placeholderItalic
          width="auto"
        />
      ),
    },
  ];

  return (
    <div style={{
      border: `1px solid ${N.borderSft}`,
      borderRadius: 10,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {pending && (
        <EffectiveMonthPrompt
          label={pending.label}
          onPick={applyPending}
          onCancel={() => setPending(null)}
        />
      )}
      {rows.map((r, i) => (
        <motion.div
          key={r.label}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, delay: i * 0.03, ease: [0.4, 0, 0.2, 1] }}
          className="tsf-copy-wrap"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12,
            padding: '9px 14px',
            borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
            fontSize: 13,
            minWidth: 0,
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: N.textMuted, fontSize: 12.5,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <r.Icon size={13} strokeWidth={1.9} style={{ color: N.textFaint }} />
            {r.label}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            minWidth: 0, justifyContent: 'flex-end',
          }}>
            {r.node ? (
              r.node
            ) : r.value ? (
              <span style={{
                fontSize: 13, fontWeight: 500, color: N.text,
                fontFamily: r.mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
                fontVariantNumeric: 'tabular-nums',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.value}
              </span>
            ) : (
              <span style={{ color: '#c7c7c2', fontStyle: 'italic', fontSize: 12.5 }}>Vide</span>
            )}
            {(r.value || r.copyValue) && (
              <CopyButton value={r.copyValue || r.value} onCopied={onCopied} size={12} />
            )}
          </span>
        </motion.div>
      ))}

      {/* Emails et téléphones, en bas de la fiche (demande dev 2026-08-27) :
          copiables en un clic à tout moment, typés (pro, perso, comptable…)
          et enrichissables — le bouton d'ajout n'apparaît qu'en mode
          édition. Composant partagé avec le board, donc une seule vérité. */}
      {clientId && (
        <div style={{
          padding: '4px 14px 8px',
          borderTop: `1px solid ${N.borderSft}`,
          background: N.sideBg,
        }}>
          <ContactList
            clientId={clientId}
            kind="email"
            contacts={profile?.contacts}
            canEdit={canEdit && editing}
            onChanged={onProfileChanged}
            onShowToast={onShowToast}
            onCopied={onCopied}
          />
          <ContactList
            clientId={clientId}
            kind="phone"
            contacts={profile?.contacts}
            inheritedValue={client?.phone}
            canEdit={canEdit && editing}
            onChanged={onProfileChanged}
            onShowToast={onShowToast}
            onCopied={onCopied}
          />
        </div>
      )}
    </div>
  );
}

// ── État de compte (échéancier) ─────────────────────────────────────────────
const INSTALLMENT_BADGES = {
  paid:     { label: 'Encaissée', bg: '#e9f9f0', fg: '#15794a' },
  partial:  { label: 'Partielle', bg: '#fff3e3', fg: '#b45309' },
  late:     { label: 'En retard', bg: '#fdecec', fg: '#b42318' },
  upcoming: { label: 'À venir',   bg: '#faf3dd', fg: '#9f6b00' },
};

const INSTALLMENTS_PREVIEW = 6;

function installmentSubline(inst) {
  // Format long FR (« 12 mars 2026 ») — demande dev 2026-08-19.
  const date = inst.payDate ? formatDateLongFR(inst.payDate) : null;
  const monthLabel = formatMonthLabel(inst.month);
  switch (inst.status) {
    case 'paid':
      return date ? `Prélevée le ${date}` : monthLabel;
    case 'partial':
      return `${formatEUR(inst.received)} / ${formatEUR(inst.expected)}${date ? ` · Prélevée le ${date}` : ` · ${monthLabel}`}`;
    case 'upcoming':
      return date ? `Prévue le ${date}` : `Prévue · ${monthLabel}`;
    default: // late
      return date ? `Prévue le ${date}` : monthLabel;
  }
}

function InstallmentsList({ installments, loading, focusedRowId, onSelectRow }) {
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            height: 40, background: '#f3f4f6', borderRadius: 6,
            animation: 'tsfPulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.12,
          }} />
        ))}
      </div>
    );
  }
  if (!installments.length) return <Empty text="Aucune échéance sur la période." />;

  const hiddenCount = Math.max(0, installments.length - INSTALLMENTS_PREVIEW);
  const older = hiddenCount > 0 ? installments.slice(0, hiddenCount) : [];
  const visible = hiddenCount > 0 ? installments.slice(hiddenCount) : installments;

  const renderRow = (inst, i, first = false) => {
    const badge = INSTALLMENT_BADGES[inst.status];
    const isActive = focusedRowId === inst.id;
    return (
      <motion.button
        key={inst.id}
        type="button"
        onClick={() => onSelectRow?.(inst.id)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: i * 0.025, ease: [0.4, 0, 0.2, 1] }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, width: '100%',
          padding: '9px 14px',
          border: 'none',
          borderTop: first ? 'none' : `1px solid ${N.borderSft}`,
          background: isActive ? N.sideHover : 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
          transition: 'background 0.12s',
          minWidth: 0,
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = N.sideBg; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: N.text,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Échéance {inst.n} · {formatEUR(inst.expected > 0 ? inst.expected : inst.received)}
          </span>
          <span style={{
            fontSize: 11.5, color: N.textMuted,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {installmentSubline(inst)}
          </span>
        </span>
        <span style={{
          padding: '2px 9px', borderRadius: 999,
          background: badge.bg, color: badge.fg,
          fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {badge.label}
        </span>
      </motion.button>
    );
  };

  return (
    <div style={{
      border: `1px solid ${N.borderSft}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '8px 14px',
            border: 'none', background: N.sideBg,
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, fontWeight: 600, color: N.textMuted,
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = N.sideHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = N.sideBg; }}
        >
          <motion.span
            animate={{ rotate: showAll ? 90 : 0 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            style={{ display: 'inline-flex', color: N.textFaint }}
          >
            <ChevronRight size={12} />
          </motion.span>
          {showAll ? 'Réduire' : `Tout afficher (${hiddenCount} échéance${hiddenCount > 1 ? 's' : ''} de plus)`}
        </button>
      )}
      <AnimatePresence initial={false}>
        {showAll && older.length > 0 && (
          <motion.div
            key="older"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {older.map((inst, i) => renderRow(inst, i))}
          </motion.div>
        )}
      </AnimatePresence>
      {visible.map((inst, i) => renderRow(inst, i, hiddenCount === 0 && i === 0))}
    </div>
  );
}

// ── Dernière action + historique des actions (vue synthétique) ──────────────
// Demande Ismahane 2026-08-19 : la traçabilité (ex. effectif modifié → les
// attendus changent) doit être visible SANS ouvrir l'accordéon détail.
// Source : GET /finance-periods/client/{id}/audit (toutes périodes). La
// section est absente si l'endpoint ne répond pas ou n'a rien.

// « il y a 2 h », « hier », « il y a 3 j », sinon date longue FR.
function formatRelativeFR(iso) {
  const d = parseDateFR(iso) || (iso ? new Date(iso) : null);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return formatDateLongFR(iso) || '—';
}

const auditEntryDate = (e) => e.changed_at || e.created_at || null;

// Ligne « Dernière action » SEULE dans la vue synthétique (demande Ismahane) ;
// la liste complète vit dans l'accordéon Détails (ClientAuditList) depuis le
// retour dev 2026-08-21.
function ActionsHistory({ entries }) {
  if (!entries?.length) return null;

  const sorted = [...entries].sort((a, b) =>
    String(auditEntryDate(b) || '').localeCompare(String(auditEntryDate(a) || ''))
  );
  const last = sorted[0];
  const lastLabel = AUDIT_FIELD_LABELS[last.field_name] || last.field_name;
  const lastAuthor = last.changed_by_name || null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.13, ease: [0.4, 0, 0.2, 1] }}
      style={{ marginTop: 24 }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        border: `1px solid ${N.borderSft}`,
        borderRadius: 10,
        fontSize: 12.5, color: N.textMuted,
        flexWrap: 'wrap', minWidth: 0,
      }}>
        <History size={13} style={{ color: N.textFaint, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: N.text, whiteSpace: 'nowrap' }}>
          Dernière action :
        </span>
        <span style={{ whiteSpace: 'nowrap' }}>{lastLabel} modifié</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <AuditValue v={last.old_value} muted />
          <ChevronRight size={11} style={{ color: N.textFaint }} />
          <AuditValue v={last.new_value} />
        </span>
        <span style={{ whiteSpace: 'nowrap', color: N.textFaint }}>
          {lastAuthor ? `· ${lastAuthor} ` : ''}· {formatRelativeFR(auditEntryDate(last))}
        </span>
      </div>
    </motion.section>
  );
}

// Liste complète de l'audit client (toutes périodes, badge période) — rendue
// dans la section « Historique des actions » de l'accordéon Détails.
function ClientAuditList({ entries }) {
  if (!entries?.length) {
    return <Empty text="Aucune action enregistrée pour ce client." />;
  }
  const sorted = [...entries].sort((a, b) =>
    String(auditEntryDate(b) || '').localeCompare(String(auditEntryDate(a) || ''))
  );
  return (
    <div style={{
      border: `1px solid ${N.borderSft}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {sorted.slice(0, 30).map((e, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10,
          padding: '8px 14px',
          borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
          fontSize: 12, minWidth: 0,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            minWidth: 0, flexWrap: 'wrap',
          }}>
            <span style={{ fontWeight: 600, color: N.text, whiteSpace: 'nowrap' }}>
              {AUDIT_FIELD_LABELS[e.field_name] || e.field_name}
            </span>
            <AuditValue v={e.old_value} muted />
            <ChevronRight size={10} style={{ color: N.textFaint }} />
            <AuditValue v={e.new_value} />
            {e.period && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: N.textMuted,
                background: N.sideBg, borderRadius: 3, padding: '1px 6px',
                whiteSpace: 'nowrap',
              }}>
                {formatMonthLabel(periodFromDate(e.period))}
              </span>
            )}
          </span>
          <span style={{
            fontSize: 10.5, color: N.textFaint, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {formatAuditDate(auditEntryDate(e))}{e.changed_by_name ? ` · ${e.changed_by_name}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Rendez-vous & juriste référent (vue synthétique) ────────────────────────
// Réplique inline de la modale « Agenda du client » du board Owner/Opti'Lex
// (OptilexBoard.jsx → ClientAgendaModal — non réutilisable telle quelle :
// c'est une modale portalisée plein écran). Mêmes données : RDV standards de
// la row board + RDV juristes et juriste de référence de client-agenda.
// Styles repris du board (carte juriste verte, rows label|date|badge).
// Retouches dev 2026-08-21 : icône balance (Scale) dans la carte juriste,
// email du juriste cliquable (mailto + copy), icône calendrier teintée
// passé/à venir sur chaque ligne RDV.
const AGENDA_GREEN = '#15794a';
const AGENDA_NAVY = '#1e2330';
const AGENDA_MUTED = '#8a93a4';
const AGENDA_BORDER = '#e9ebf0';
const AGENDA_AMBER = '#b45309';

function RdvJuristeSection({ boardRow, agenda, onCopied }) {
  // Consolidation identique à ClientAgendaModal (board) : 4 RDV standards de
  // la fiche + RDV juristes, triés du plus récent au plus ancien.
  const items = useMemo(() => {
    if (!boardRow) return [];
    const std = [
      { key: 'onb', label: 'Onboarding Owner', type: 'Owner', date: boardRow.rdv_onboarding_date_manual || boardRow.rdv_onboarding_date, done: boardRow.rdv_onboarding_done },
      { key: 'int', label: "Intégration Opti'Lex", type: "Opti'Lex", date: boardRow.rdv_lancement_date, done: boardRow.rdv_lancement_done },
      { key: 'fis', label: 'Lancement fiscal', type: "Opti'Lex", date: boardRow.rdv_fiscal_date_manual || boardRow.rdv_fiscal_date, done: boardRow.rdv_fiscal_done },
      { key: 'soc', label: 'Lancement social', type: "Opti'Lex", date: boardRow.rdv_social_date_manual || boardRow.rdv_social_date, done: boardRow.rdv_social_done },
    ].filter((x) => x.date).map((x) => ({ ...x, kind: 'standard', when: String(x.date) }));
    const jur = ((agenda && agenda.rdv) || []).map((b, i) => ({
      key: `jur-${b.juriste_email || ''}-${b.slot_start || i}`,
      label: b.summary || `RDV juriste ${b.team || ''}`.trim(),
      juriste: `${b.juriste_name || 'Juriste'}${b.team ? ' · ' + b.team : ''}`,
      cancelled: b.status === 'cancelled',
      kind: 'jurist',
      when: String(b.slot_start),
    }));
    return [...std, ...jur].sort((a, b) => (b.when || '').localeCompare(a.when || ''));
  }, [boardRow, agenda]);

  const ref = agenda?.reference_jurist || null;
  // Email du juriste de référence — nom de champ défensif : la réponse
  // client-agenda expose `juriste_email` sur les RDV ; sur reference_jurist
  // on tolère les deux variantes plausibles.
  const refEmail = ref ? (ref.juriste_email || ref.email || null) : null;

  // Client absent du board ET rien à montrer → section masquée proprement.
  if (!boardRow || (!ref && items.length === 0)) return null;

  // Date + heure Paris ; date seule pour les RDV standards sans heure.
  const whenLabel = (iso) => {
    const s = String(iso || '');
    try {
      const d = new Date(iso);
      const day = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
      if (!/T\d\d:\d\d/.test(s)) return day;
      const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
      return `${day} · ${time}`;
    } catch {
      return s.slice(0, 10);
    }
  };

  // RDV « à venir » : non annulé, non effectué, jour (Paris) >= aujourd'hui.
  const todayParis = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const isUpcoming = (it) => {
    if (it.cancelled) return false;
    if (it.kind === 'standard' && it.done) return false;
    try {
      return new Date(it.when).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) >= todayParis;
    } catch {
      return String(it.when).slice(0, 10) >= todayParis;
    }
  };

  return (
    <div>
      {/* Juriste de référence — carte du board, badge balance (Scale) +
          email cliquable avec copy au hover */}
      <div style={{
        padding: '11px 14px', borderRadius: 10,
        border: `1px solid ${ref ? AGENDA_GREEN + '55' : AGENDA_BORDER}`,
        background: ref ? '#f0f7f3' : '#fafbfc',
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
      }}>
        <span style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: ref ? AGENDA_GREEN : '#e5e8ee', color: '#fff',
        }}>
          <Scale size={16} strokeWidth={2} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10.5, color: AGENDA_MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Juriste de référence
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: ref ? AGENDA_NAVY : AGENDA_MUTED }}>
            {ref ? `${ref.name}${ref.team ? ' · ' + ref.team : ''}` : "Aucun RDV juriste pour l'instant"}
          </div>
          {refEmail && (
            <span className="tsf-copy-wrap" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 2, minWidth: 0, maxWidth: '100%',
            }}>
              <a
                href={`mailto:${refEmail}`}
                style={{
                  fontSize: 11.5, color: AGENDA_GREEN, textDecoration: 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
              >
                {refEmail}
              </a>
              <CopyButton value={refEmail} onCopied={onCopied} size={11} />
            </span>
          )}
        </div>
      </div>

      {/* Liste des RDV — icône calendrier teintée (ambre = à venir,
          gris = passé/effectué), puis titre + date · heure · juriste/pôle */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it, i) => {
            const upcoming = isUpcoming(it);
            return (
              <motion.div
                key={it.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.03, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 12px', borderRadius: 10,
                  border: `1px solid ${AGENDA_BORDER}`, background: '#fff',
                  opacity: it.cancelled ? 0.5 : 1,
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: upcoming ? '#fff3e3' : '#eef1f6',
                  color: upcoming ? AGENDA_AMBER : '#5b6472',
                }}>
                  {upcoming
                    ? <CalendarClock size={14} strokeWidth={2} />
                    : <CalendarCheck2 size={14} strokeWidth={2} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: AGENDA_NAVY,
                    textDecoration: it.cancelled ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {it.label}
                  </div>
                  <div style={{
                    fontSize: 11.5, color: AGENDA_MUTED,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {whenLabel(it.when)}
                    {' · '}
                    {it.kind === 'jurist' ? (it.juriste || 'Juriste') + (it.cancelled ? ' · annulé' : '') : it.type}
                  </div>
                </div>
                {it.kind === 'standard' && (
                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 700,
                    padding: '3px 9px', borderRadius: 20,
                    color: it.done ? AGENDA_GREEN : AGENDA_MUTED,
                    background: it.done ? '#e7f3ec' : '#eef1f6',
                  }}>
                    {it.done ? 'Effectué' : 'À venir'}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Accordéon « Voir le détail complet » ────────────────────────────────────
// Contient TOUT le contenu historique du panneau (rien supprimé). Contrôlé
// par le parent : le bouton Modifier du header l'ouvre et scrolle dessus.
function DetailAccordion({ open, onToggle, innerRef, delay = 0, children }) {
  return (
    <motion.section
      ref={innerRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      style={{
        marginTop: 32,
        borderTop: `1px solid ${N.border}`,
        paddingTop: 14,
        // scroll-margin : le scrollIntoView du bouton Modifier laisse un peu
        // d'air au-dessus au lieu de coller le bord.
        scrollMarginTop: 12,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', border: `1px solid ${N.borderSft}`,
          background: open ? N.sideBg : '#fff',
          cursor: 'pointer', padding: '9px 14px',
          borderRadius: 8,
          fontFamily: 'inherit', textAlign: 'left',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = N.sideBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = open ? N.sideBg : '#fff'; }}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          style={{ display: 'inline-flex', color: N.textFaint }}
        >
          <ChevronRight size={14} />
        </motion.span>
        <span style={{ fontSize: 13, fontWeight: 600, color: N.text }}>
          Voir le détail complet
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 20 }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ── Title Block ─────────────────────────────────────────────────────────────
// `focusedRow` reserved for future use (e.g. period badge in the title).
// Kept in the prop list so callers don't break if we re-introduce it.
// eslint-disable-next-line no-unused-vars
function TitleBlock({ client, etatMeta, focusedRow, inheritedEtat, onCopied }) {
  const { societeName, representant: repFromSociete } = splitSocieteRep(client?.societe);
  const rep = client?.representative_name || repFromSociete;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
      {/* État-color circle */}
      <div style={{
        width: 56, height: 56,
        borderRadius: 12,
        background: etatMeta.bg,
        color: etatMeta.fg,
        flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 0 rgba(15,15,15,0.04)',
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: etatMeta.fg,
        }} />
      </div>

      {/* Titles */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, color: N.textFaint,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          fontWeight: 600, marginBottom: 4,
        }}>
          {client?.numero_client ? `Client ${client.numero_client}` : 'Détail client'}
        </div>
        <span className="tsf-copy-wrap" style={{
          display: 'inline-flex', alignItems: 'flex-start', gap: 6,
          maxWidth: '100%',
        }}>
          <h1 style={{
            fontSize: 28, fontWeight: 700, color: N.text,
            margin: 0, letterSpacing: '-0.02em',
            lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {societeName || '—'}
          </h1>
          {societeName && (
            <CopyButton value={societeName} onCopied={onCopied} size={14} style={{ marginTop: 4 }} />
          )}
        </span>
        {rep && (
          <span className="tsf-copy-wrap" style={{
            marginTop: 6,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 14, color: N.textMuted,
          }}>
            <span>{rep}</span>
            <CopyButton value={rep} onCopied={onCopied} size={12} />
          </span>
        )}
        {inheritedEtat && (
          <div style={{
            marginTop: 8,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 9px', borderRadius: 4,
            background: N.redBg, color: N.red,
            fontSize: 11.5, fontWeight: 600,
          }}>
            <Lock size={11} />
            {inheritedEtat === 'retractation' ? 'Rétractation' : 'Résiliation'} actée sur le board Owner/Opti'Lex
          </div>
        )}
      </div>
    </div>
  );
}

// ── Meta row (pills) ────────────────────────────────────────────────────────
// ── Sociétés couvertes / associés ──────────────────────────────────────────
// Un client couvre parfois plusieurs sociétés, et son dossier porte plusieurs
// associés (demande dev 2026-08-27). Rien ne pouvait les stocker : la table
// des sociétés de convention est rattachée au lead, celle des contacts ne
// gère que des emails. Backend : `client_related_entity`, archivage logique.
function RelatedEntityList({ items, kind, clientId, editing, onChanged, onShowToast }) {
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const societe = kind === 'societe';

  const add = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || busy) return;
    setBusy(true);
    try {
      await apiClient.post(`/api/v1/finance-periods/client/${clientId}/entities`, {
        kind,
        name: trimmed,
        ...(societe ? { siren: extra.trim() || null } : { role: extra.trim() || null }),
      });
      setName(''); setExtra('');
      onChanged?.();
    } catch (e) {
      onShowToast?.(e?.data?.detail || "Ajout impossible", 'error');
    } finally {
      setBusy(false);
    }
  }, [name, extra, busy, clientId, kind, societe, onChanged, onShowToast]);

  const remove = useCallback(async (id) => {
    try {
      await apiClient.delete(`/api/v1/finance-periods/client/${clientId}/entities/${id}`);
      onChanged?.();
    } catch (e) {
      onShowToast?.(e?.data?.detail || 'Retrait impossible', 'error');
    }
  }, [clientId, onChanged, onShowToast]);

  if (!items.length && !editing) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      {items.map((it) => (
        <span key={it.id} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: N.sideBg, borderRadius: 5, padding: '2px 6px 2px 8px',
          fontSize: 12.5, color: N.text,
        }}>
          {it.name}
          {(it.siren || it.role) && (
            <span style={{ color: N.textFaint }}>· {it.siren || it.role}</span>
          )}
          {editing && (
            <button
              type="button"
              onClick={() => remove(it.id)}
              title="Retirer"
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: N.textFaint, display: 'inline-flex', padding: 0,
              }}
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      {editing && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder={societe ? 'Autre société' : 'Nom de l’associé'}
            style={{
              border: `1px solid ${N.border}`, borderRadius: 5,
              padding: '3px 7px', fontSize: 12.5, width: 140,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder={societe ? 'SIREN' : 'Rôle'}
            style={{
              border: `1px solid ${N.border}`, borderRadius: 5,
              padding: '3px 7px', fontSize: 12.5, width: 90,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || name.trim().length < 2}
            style={{
              border: 'none', borderRadius: 5, padding: '3px 9px',
              fontSize: 12.5, fontWeight: 600,
              cursor: name.trim().length < 2 ? 'default' : 'pointer',
              background: name.trim().length < 2 ? N.sideBg : N.text,
              color: name.trim().length < 2 ? N.textFaint : '#fff',
            }}
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

// ── Mois d'effet d'un changement de formule ou de modalité ─────────────────
// Les deux commandent l'attendu : appliqués au mois en cours, ils réécrivent
// la ligne que la finance est peut-être en train de rapprocher ; appliqués au
// mois suivant, l'historique reste intact. Personne ne peut trancher à notre
// place — d'où la question, posée une fois, au moment de la saisie.
function EffectiveMonthPrompt({ label, onPick, onCancel }) {
  const moisProchain = formatMonthLabel(shiftMonth(currentPeriod(), 1));
  const moisCourant = formatMonthLabel(currentPeriod());
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: 'rgba(255,255,255,0.96)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        padding: 20, textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, color: N.text, fontWeight: 600 }}>
        Passer à « {label} » à partir de quand ?
      </div>
      <div style={{ fontSize: 12, color: N.textMuted, maxWidth: 320, lineHeight: 1.5 }}>
        Le montant attendu est recalculé à partir du mois choisi, jusqu’au
        dernier mois de la fiche.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => onPick('current')}
          style={{
            border: 'none', cursor: 'pointer', borderRadius: 6,
            padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
            background: N.text, color: '#fff',
          }}
        >
          Dès {moisCourant}
        </button>
        <button
          type="button"
          onClick={() => onPick('next')}
          style={{
            border: `1px solid ${N.border}`, cursor: 'pointer', borderRadius: 6,
            padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
            background: '#fff', color: N.text,
          }}
        >
          À partir de {moisProchain}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            border: 'none', cursor: 'pointer', borderRadius: 6,
            padding: '7px 10px', fontSize: 12.5,
            background: 'transparent', color: N.textMuted,
          }}
        >
          Annuler
        </button>
      </div>
    </motion.div>
  );
}

// Bandeau réduit à ce qui n'est écrit nulle part ailleurs (arbitrage dev
// 2026-08-27) : le SIREN, et l'échéance du contrat. L'État était en double
// avec l'en-tête juste au-dessus, l'Effectif avec la Formule des
// informations contractuelles, et la Période est déjà celle du tableau.
function MetaRow({ profile, boardRow }) {
  const items = [];
  if (profile?.siren) {
    items.push({
      icon: <Landmark size={12} />,
      label: 'SIREN',
      value: profile.siren,
    });
  }
  // Sortie de contrat posée au board : elle prime sur le renouvellement —
  // un contrat qui s'arrête ne se renouvelle pas. La date vient de l'état
  // daté du board (`etat_date`), seul endroit où la résiliation est datée.
  // Correction du libellé 2026-08-27 : ce badge annonçait « Fin contrat »
  // alors qu'il compte les jours jusqu'à l'échéance ANNUELLE, c'est-à-dire
  // le renouvellement.
  const exitEtat = TERMINATED_BOARD_ETATS.has(boardRow?.etat_manuel)
    ? boardRow.etat_manuel
    : null;
  const exitDate = exitEtat ? parseDateFR(boardRow?.etat_date) : null;
  if (exitEtat && exitDate) {
    const meta = ETAT_STYLE[exitEtat] || ETAT_FALLBACK;
    const aVenir = exitDate > new Date();
    items.push({
      icon: <FileSignature size={12} />,
      label: exitEtat,
      value: `${aVenir ? 'le' : 'depuis le'} ${formatDateLongFR(boardRow.etat_date)}`,
      pillBg: meta.bg, pillFg: meta.fg,
    });
  } else if (!exitEtat && profile?.contract_end) {
    // Le renouvellement est annuel et tombe à la date anniversaire : tout
    // client signé en a un. Il ne s'affichait qu'à moins de 90 jours, donc
    // presque jamais (retour dev 2026-08-27) — on montre désormais la date,
    // et la couleur ne s'allume qu'à l'approche : orange dans la fenêtre de
    // renouvellement (90 j), rouge à un mois, mêmes seuils que le board.
    const d = profile.contract_days_left;
    const proche = d != null && d <= 90;
    const urgent = d != null && d <= 30;
    items.push({
      icon: <FileSignature size={12} />,
      label: 'Renouvellement',
      // Le compte à rebours seul : c'est l'information utile d'un coup
      // d'œil, la date exacte encombrait la pastille (dev 2026-08-27).
      // Elle reste lisible en survol.
      value: d != null ? `J-${d}` : formatDateLongFR(profile.contract_end),
      title: formatDateLongFR(profile.contract_end),
      pillBg: urgent ? N.redBg : (proche ? '#fdecc8' : undefined),
      pillFg: urgent ? N.red : (proche ? '#9f6b00' : undefined),
    });
  }

  if (!items.length) return null;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      marginBottom: 28,
    }}>
      {items.map((it, idx) => (
        <div key={idx} title={it.title || undefined} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          borderRadius: 4,
          background: it.pillBg || 'transparent',
          color: it.pillFg || N.textMuted,
          fontSize: 12.5,
          border: it.pillBg ? 'none' : `1px solid ${N.borderSft}`,
          fontWeight: 500,
        }}>
          <span style={{ display: 'inline-flex', color: it.pillFg || N.textFaint }}>
            {it.icon}
          </span>
          <span style={{ color: it.pillFg || N.textMuted }}>{it.label}</span>
          <span style={{
            color: it.pillFg || N.text, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 180,
          }}>
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────
// `action` (optionnel, phase 4) : nœud rendu à droite du titre — ex. le
// bouton de téléchargement de l'état de compte. Rétro-compatible.
function Section({ title, children, delay = 0, action = null }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      style={{ marginTop: 28 }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, margin: '0 0 12px',
      }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, color: N.textMuted,
          margin: 0,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

// ── Field row helper ────────────────────────────────────────────────────────
// Renders a label + a value control (any React node) in a horizontal row.
// `copyValue` triggers the hover-revealed Copy button next to the value.
// `controlWidth` lets the editable input take a natural width (Notion-style).
function Field({ label, children, copyValue, onCopied, align = 'right' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '6px 0',
      borderBottom: `1px solid ${N.borderSft}`,
      fontSize: 13,
      minWidth: 0,
    }}>
      <span style={{
        color: N.textMuted, fontSize: 12.5,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flexShrink: 0,
        maxWidth: '55%',
      }}>
        {label}
      </span>
      <span
        className="tsf-copy-wrap"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          gap: 4,
          flex: 1,
          minWidth: 0,
        }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          minWidth: 0, maxWidth: '100%',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        }}>
          {children}
        </span>
        {copyValue !== null && copyValue !== undefined && copyValue !== '' && (
          <CopyButton value={copyValue} onCopied={onCopied} size={13} />
        )}
      </span>
    </div>
  );
}

// ── Section : Identité client ───────────────────────────────────────────────
function IdentitySection({
  client, clientId, focusedRow, profile, canEdit, refreshProfile,
  boardRow, onBoardEtatChange, onCopied, onShowToast,
}) {
  if (!focusedRow) return <Empty />;
  // Pattern "Société - Nom Prénom" présent sur la grande majorité des
  // clients (cf. splitSocieteRep dans constants.js). La donnée brute
  // (`client.societe`) reste la "vraie" valeur backend ; on extrait juste
  // l'affichage UI pour cohérence visuelle entre clients anciens et récents.
  const { societeName, representant: repFromSociete } = splitSocieteRep(client?.societe);
  const rep = client?.representative_name || repFromSociete;
  const inherited = profile?.etat_inherited || null;

  // SIREN : le backfill est une donnée sourcée (lecture) ; sans lui, la
  // saisie alimente l'override du board (siren_ovr) et le journal.
  const sirenEditable = canEditMoney && profile && profile.siren_source !== 'backfill';
  const commitSiren = async (value) => {
    await apiClient.patch(`/api/v1/finance-periods/client/${clientId}/profile`, { siren: value || '' });
    refreshProfile();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Field label="Numéro client" copyValue={client?.numero_client} onCopied={onCopied}>
        <ReadOnlyText value={client?.numero_client} mono />
      </Field>

      <Field label="Société" copyValue={societeName} onCopied={onCopied}>
        <ReadOnlyText value={societeName} />
      </Field>

      <Field label="Représentant" copyValue={rep} onCopied={onCopied}>
        <ReadOnlyText value={rep} />
      </Field>

      <Field label="SIREN" copyValue={profile?.siren} onCopied={onCopied}>
        {sirenEditable ? (
          <EditableText
            value={profile?.siren}
            placeholder="9 chiffres"
            onCommit={commitSiren}
            width="auto"
          />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ReadOnlyText value={profile?.siren} mono />
            {profile?.siren_source === 'backfill' && (
              <span style={{ fontSize: 10.5, color: N.textFaint }}>source interne</span>
            )}
          </span>
        )}
      </Field>

      {/* Contacts typés : DÉPLACÉS dans « Informations contractuelles »
          (demande dev 2026-08-27) — la finance a besoin du mail et du
          téléphone sous les yeux, pas au fond d'un accordéon. Ils ne sont
          pas dupliqués ici pour éviter deux endroits où éditer la même
          donnée. */}

      {/* État = celui du board Owner/Opti'Lex (source de vérité, même picker
          que la colonne État du tableau). Fallbacks pour les clients hors
          board : état hérité verrouillé, sinon `clients.etat` legacy en
          lecture seule (le PATCH etat sur finance-periods est mort côté back). */}
      <Field
        label="État"
        copyValue={
          boardRow
            ? displayEtat(boardRow)
            : inherited
              ? (ETAT_COLORS[inherited]?.label || inherited)
              : (client?.etat && (ETAT_COLORS[client.etat]?.label || client.etat))
        }
        onCopied={onCopied}
      >
        {boardRow ? (
          <BoardEtatCell
            boardRow={boardRow}
            disabled={!canEdit}
            onEtatChange={(payload) => onBoardEtatChange?.(client?.numero_client, payload)}
          />
        ) : inherited ? (
          // L'état est imposé par le board : on l'affiche verrouillé plutôt
          // que d'offrir une édition qui serait écrasée à la prochaine sync.
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '2px 10px', borderRadius: 4,
            background: (ETAT_COLORS[inherited] || ETAT_FALLBACK).bg,
            color: (ETAT_COLORS[inherited] || ETAT_FALLBACK).fg,
            fontSize: 12.5, fontWeight: 600,
          }}>
            <Lock size={11} />
            {(ETAT_COLORS[inherited] || ETAT_FALLBACK).label || inherited}
          </span>
        ) : client?.etat ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '2px 10px', borderRadius: 4,
            background: (ETAT_COLORS[client.etat] || ETAT_FALLBACK).bg,
            color: (ETAT_COLORS[client.etat] || ETAT_FALLBACK).fg,
            fontSize: 12.5, fontWeight: 600,
          }}>
            {(ETAT_COLORS[client.etat] || ETAT_FALLBACK).label || client.etat}
          </span>
        ) : (
          <ReadOnlyText value={null} />
        )}
      </Field>

      <Field label="RDV lancement" copyValue={client?.rdv_lancement && formatDateFR(client.rdv_lancement)} onCopied={onCopied}>
        <ReadOnlyDate value={client?.rdv_lancement} />
      </Field>

      <Field label="RDV onboarding" copyValue={client?.rdv_onboarding && formatDateFR(client.rdv_onboarding)} onCopied={onCopied}>
        <ReadOnlyDate value={client?.rdv_onboarding} />
      </Field>
    </div>
  );
}

// ── Section : Modalités ─────────────────────────────────────────────────────
function ModalitesSection({
  client, clientId, focusedRow, profile, canEdit, refreshProfile,
  patch, onCopied, onShowToast,
}) {
  if (!focusedRow) return <Empty />;

  // Effectif COURANT du client (fiche), pas le snapshot du mois affiché.
  // L'édition alimente l'override partagé avec le board (tranche_ovr) et le
  // journal de la fiche — d'où vient le mini-historique juste dessous.
  const commitEffectif = async (value) => {
    try {
      await apiClient.patch(`/api/v1/finance-periods/client/${clientId}/profile`, { employee_range: value });
      refreshProfile();
    } catch (e) {
      onShowToast?.(e?.message || 'Erreur', 'error');
      throw e;
    }
  };
  const lastRangeChange = (profile?.changes || []).find((c) => c.field === 'employee_range');
  // Même libellé « X salariés » que la Formule, tranche hors grille comprise.
  const effectifRange = normalizeEmployeeRange(profile?.employee_range);
  const effectifLabels = EMPLOYEE_RANGES.reduce((acc, v) => {
    acc[v] = employeeRangeLabel(v); return acc;
  }, {});
  if (effectifRange && !effectifLabels[effectifRange]) {
    effectifLabels[effectifRange] = employeeRangeLabel(effectifRange);
  }

  // Fin de contrat = anniversaire de la signature (contrats d'un an) —
  // calculée par le backend avec la même règle que le renouvellement du board.
  const daysLeft = profile?.contract_days_left;
  const endBadge = daysLeft != null && daysLeft <= 90
    ? { bg: daysLeft <= 30 ? N.redBg : '#fdecc8', fg: daysLeft <= 30 ? N.red : '#9f6b00' }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Field label="Modalité de paiement" copyValue={focusedRow.payment_specificity} onCopied={onCopied}>
        <EditableSelect
          value={focusedRow.payment_specificity}
          options={PAYMENT_SPECIFICITIES}
          onCommit={patch('payment_specificity')}
          pillColors={PAYMENT_SPECIFICITY_COLORS}
          pillFallback={PAYMENT_SPECIFICITY_FALLBACK}
          notionSolid
          placeholderItalic
          width="auto"
        />
      </Field>

      <Field label="Prélèvement automatisé" copyValue={focusedRow.auto_debit} onCopied={onCopied}>
        <EditableSelect
          value={focusedRow.auto_debit}
          options={AUTO_DEBIT_OPTIONS}
          onCommit={patch('auto_debit')}
          pillColors={AUTO_DEBIT_COLORS}
          pillFallback={AUTO_DEBIT_FALLBACK}
          notionSolid
          placeholderItalic
          truncate={false}
          width="auto"
        />
      </Field>

      <Field label="Effectif" copyValue={employeeRangeLabel(profile?.employee_range)} onCopied={onCopied}>
        <EditableSelect
          value={normalizeEmployeeRange(profile?.employee_range)}
          options={EMPLOYEE_RANGES}
          optionLabels={effectifLabels}
          onCommit={commitEffectif}
          disabled={!canEdit}
          placeholderItalic
          width="auto"
        />
      </Field>
      {lastRangeChange && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '2px 0 6px', marginTop: -2,
          borderBottom: `1px solid ${N.borderSft}`,
          fontSize: 11, color: N.textFaint,
        }}>
          <PenLine size={10} />
          <span>
            {lastRangeChange.old_value || '∅'} → {lastRangeChange.new_value || '∅'}
            {' · '}{formatAuditDate(lastRangeChange.changed_at)}
            {lastRangeChange.changed_by ? ` · ${lastRangeChange.changed_by}` : ''}
          </span>
        </div>
      )}

      <Field
        label="Fin contrat"
        copyValue={profile?.contract_end && formatDateFR(profile.contract_end)}
        onCopied={onCopied}
      >
        {profile?.contract_end ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, color: N.text, fontVariantNumeric: 'tabular-nums' }}>
              {formatDateFR(profile.contract_end)}
            </span>
            {endBadge && (
              <span style={{
                padding: '1px 8px', borderRadius: 4,
                background: endBadge.bg, color: endBadge.fg,
                fontSize: 11.5, fontWeight: 700,
              }}>
                J-{daysLeft}
              </span>
            )}
          </span>
        ) : (
          <ReadOnlyDate value={client?.finance_contract_end_date} />
        )}
      </Field>
      {profile?.date_signature && (
        <div style={{
          padding: '2px 0 6px', marginTop: -2,
          fontSize: 11, color: N.textFaint,
        }}>
          Anniversaire de la signature du {formatDateFR(profile.date_signature)} (contrat 1 an)
        </div>
      )}
    </div>
  );
}

// ── Section : Owner | Opti'lex split (2 cols) ───────────────────────────────
function OwnerOptilexSection({ focusedRow, patch, onCopied }) {
  if (!focusedRow) return <Empty />;

  const overdueOwnerCM   = toNumber(focusedRow.overdue_owner_current_month) || 0;
  const overdueOptilexCM = toNumber(focusedRow.overdue_optilex_current_month) || 0;
  const overdueOwnerCum  = toNumber(focusedRow.overdue_owner_cumulative) || 0;
  const overdueOptilexCum = toNumber(focusedRow.overdue_optilex_cumulative) || 0;

  // Each row in the split has : { label, ownerNode, optiNode, ownerCopy, optiCopy }
  const rowsDef = [
    {
      label: 'Montant Attendu',
      ownerNode: <ReadOnlyAmount value={focusedRow.expected_owner} />,
      optiNode:  <ReadOnlyAmount value={focusedRow.expected_optilex_ttc} />,
      ownerCopy: formatAmountForCopy(focusedRow.expected_owner),
      optiCopy:  formatAmountForCopy(focusedRow.expected_optilex_ttc),
    },
    {
      label: 'Montant Récupéré',
      ownerNode: <EditableNumber value={focusedRow.received_owner} onCommit={patch('received_owner')} align="right" placeholderItalic />,
      optiNode:  <EditableNumber value={focusedRow.received_optilex_ttc} onCommit={patch('received_optilex_ttc')} align="right" placeholderItalic />,
      ownerCopy: formatAmountForCopy(focusedRow.received_owner),
      optiCopy:  formatAmountForCopy(focusedRow.received_optilex_ttc),
    },
    {
      label: 'Retard mois courant',
      ownerNode: <OverdueInline amount={overdueOwnerCM} />,
      optiNode:  <OverdueInline amount={overdueOptilexCM} />,
      ownerCopy: overdueOwnerCM > 0 ? formatEUR(overdueOwnerCM) : null,
      optiCopy:  overdueOptilexCM > 0 ? formatEUR(overdueOptilexCM) : null,
    },
    {
      label: 'Retard mois précédents (cumul)',
      ownerNode: <OverdueInline amount={overdueOwnerCum} />,
      optiNode:  <OverdueInline amount={overdueOptilexCum} />,
      ownerCopy: overdueOwnerCum > 0 ? formatEUR(overdueOwnerCum) : null,
      optiCopy:  overdueOptilexCum > 0 ? formatEUR(overdueOptilexCum) : null,
    },
    {
      label: 'Récupéré sur créances passées',
      ownerNode: <EditableNumber value={focusedRow.received_overdue_owner} onCommit={patch('received_overdue_owner')} align="right" placeholderItalic />,
      optiNode:  <EditableNumber value={focusedRow.received_overdue_optilex_ttc} onCommit={patch('received_overdue_optilex_ttc')} align="right" placeholderItalic />,
      ownerCopy: formatAmountForCopy(focusedRow.received_overdue_owner),
      optiCopy:  formatAmountForCopy(focusedRow.received_overdue_optilex_ttc),
    },
    {
      label: 'Check (PSP)',
      ownerNode: (
        <EditableSelect
          value={focusedRow.psp_owner}
          options={PSP_OPTIONS}
          onCommit={patch('psp_owner')}
          pillColors={PSP_COLORS}
          pillFallback={PSP_FALLBACK}
          notionSolid
          placeholderItalic
          width="auto"
        />
      ),
      optiNode: (
        <EditableSelect
          value={focusedRow.psp_optilex}
          options={PSP_OPTIONS}
          onCommit={patch('psp_optilex')}
          pillColors={PSP_COLORS}
          pillFallback={PSP_FALLBACK}
          notionSolid
          placeholderItalic
          width="auto"
        />
      ),
      ownerCopy: focusedRow.psp_owner,
      optiCopy:  focusedRow.psp_optilex,
    },
    {
      label: 'Date paiement',
      // « prévue » = date issue d'une formule du classeur (échéance +30 j),
      // pas d'une saisie. Elle date une attente, jamais un encaissement —
      // le badge empêche de confondre les deux. Une saisie manuelle ici
      // fait tomber le drapeau (côté backend).
      ownerNode: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {focusedRow.payment_date_owner_projected && focusedRow.payment_date_owner && (
            <span style={projectedBadgeStyle}>prévue</span>
          )}
          <EditableDate value={focusedRow.payment_date_owner} onCommit={patch('payment_date_owner')} />
        </span>
      ),
      optiNode: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {focusedRow.payment_date_optilex_projected && focusedRow.payment_date_optilex && (
            <span style={projectedBadgeStyle}>prévue</span>
          )}
          <EditableDate value={focusedRow.payment_date_optilex} onCommit={patch('payment_date_optilex')} />
        </span>
      ),
      ownerCopy: focusedRow.payment_date_owner && formatDateFR(focusedRow.payment_date_owner),
      optiCopy:  focusedRow.payment_date_optilex && formatDateFR(focusedRow.payment_date_optilex),
    },
  ];

  return (
    <div style={{
      border: `1px solid ${N.borderSft}`,
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      {/* Header bar : Owner | Opti'lex */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1.1fr) 1fr 1fr',
        gap: 0,
        background: N.sideBg,
        fontSize: 11, fontWeight: 600,
        color: N.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        borderBottom: `1px solid ${N.borderSft}`,
      }}>
        <div style={{ padding: '8px 12px' }} />
        <div style={{ textAlign: 'right', padding: '8px 12px 8px 8px' }}>Owner</div>
        <div style={{ textAlign: 'right', padding: '8px 12px 8px 12px', borderLeft: `2px solid ${N.border}` }}>Opti'lex</div>
      </div>

      {rowsDef.map((r, idx) => (
        <div
          key={r.label}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 1.1fr) 1fr 1fr',
            gap: 0,
            borderTop: idx === 0 ? 'none' : `1px solid ${N.borderSft}`,
            fontSize: 13,
            minHeight: 42,
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '8px 12px',
            color: N.textMuted, fontSize: 12.5,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {r.label}
          </div>

          {/* Owner cell */}
          <div
            className="tsf-copy-wrap"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              padding: '8px 12px 8px 8px',
              minWidth: 0,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '100%' }}>
              {r.ownerNode}
            </span>
            {r.ownerCopy !== null && r.ownerCopy !== undefined && r.ownerCopy !== '' && (
              <CopyButton value={r.ownerCopy} onCopied={onCopied} size={13} />
            )}
          </div>

          {/* Opti'lex cell */}
          <div
            className="tsf-copy-wrap"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              padding: '8px 12px 8px 12px',
              borderLeft: `2px solid ${N.border}`,
              minWidth: 0,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '100%' }}>
              {r.optiNode}
            </span>
            {r.optiCopy !== null && r.optiCopy !== undefined && r.optiCopy !== '' && (
              <CopyButton value={r.optiCopy} onCopied={onCopied} size={13} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Read-only / display helpers ─────────────────────────────────────────────
function ReadOnlyText({ value, mono = false }) {
  if (!value) {
    return <span style={{ color: '#c7c7c2', fontStyle: 'italic', fontSize: 13 }}>Vide</span>;
  }
  return (
    <span style={{
      fontSize: 13.5, color: N.text,
      fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      maxWidth: '100%',
    }}>
      {value}
    </span>
  );
}

function ReadOnlyDate({ value }) {
  if (!value) {
    return <span style={{ color: '#c7c7c2', fontStyle: 'italic', fontSize: 13 }}>Vide</span>;
  }
  return (
    <span style={{ fontSize: 13.5, color: N.text, fontVariantNumeric: 'tabular-nums' }}>
      {formatDateFR(value)}
    </span>
  );
}

function ReadOnlyAmount({ value }) {
  const n = toNumber(value);
  if (n === null || n === 0) {
    return <span style={{ color: '#c7c7c2', fontStyle: 'italic', fontSize: 13 }}>Vide</span>;
  }
  return (
    <span style={{ fontSize: 13.5, color: N.text, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
      {formatEUR(n)}
    </span>
  );
}

function OverdueInline({ amount }) {
  if (!amount || amount <= 0) {
    return <span style={{ color: '#c7c7c2', fontStyle: 'italic', fontSize: 13 }}>Aucun</span>;
  }
  return (
    <span style={{
      background: N.redBg,
      color: N.red,
      padding: '2px 10px',
      borderRadius: 4,
      fontSize: 12.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {formatEUR(amount)}
    </span>
  );
}

const projectedBadgeStyle = {
  padding: '1px 6px', borderRadius: 3,
  background: '#fdecc8', color: '#9f6b00',
  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.03em', flexShrink: 0,
};

function formatAmountForCopy(v) {
  const n = toNumber(v);
  if (n === null || n === 0) return null;
  return formatEUR(n);
}

// ── Section repliable ───────────────────────────────────────────────────────
// L'historique complet allongeait la fiche au point de noyer la timeline :
// replié par défaut, le compteur dit qu'il y a de la matière, le chevron
// l'ouvre. (Demande dev : « qu'il soit plié et qu'on puisse le déplier ».)
function CollapsibleSection({ title, count, children, delay = 0 }) {
  const [openSec, setOpenSec] = useState(false);
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      style={{ marginTop: 28 }}
    >
      <button
        type="button"
        onClick={() => setOpenSec((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', border: 'none', background: 'transparent',
          cursor: 'pointer', padding: 0, margin: '0 0 12px',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <motion.span
          animate={{ rotate: openSec ? 90 : 0 }}
          transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
          style={{ display: 'inline-flex', color: N.textFaint }}
        >
          <ChevronRight size={13} />
        </motion.span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: N.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {title}
        </span>
        {count > 0 && (
          <span style={{
            fontSize: 10.5, fontWeight: 600, color: N.textMuted,
            background: N.sideBg, borderRadius: 999, padding: '1px 8px',
          }}>
            {count}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {openSec && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ── Journal de la FICHE client (effectif, SIREN, contacts, état…) ───────────
// Complète l'audit mensuel : ici vivent les changements du client lui-même,
// qu'ils viennent du classeur (origin=sheet) ou d'une édition interne.
function ProfileChangesList({ changes }) {
  if (!changes?.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, color: N.textFaint,
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
      }}>
        Fiche client
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {changes.slice(0, 15).map((c, i) => (
          <div key={i} style={{
            padding: '10px 12px', background: N.sideBg, borderRadius: 6,
            display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{
                fontSize: 12.5, fontWeight: 600, color: N.text,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <History size={11} style={{ color: N.textFaint }} />
                {PROFILE_CHANGE_LABELS[c.field] || c.field}
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'uppercase', borderRadius: 3, padding: '1px 5px',
                  background: c.origin === 'internal' ? '#e7f0fb' : '#efeeec',
                  color: c.origin === 'internal' ? '#1e40af' : N.textMuted,
                }}>
                  {c.origin === 'internal' ? 'interne' : 'sheet'}
                </span>
              </span>
              <span style={{ fontSize: 11, color: N.textFaint, whiteSpace: 'nowrap' }}>
                {formatAuditDate(c.changed_at)}{c.changed_by ? ` · ${c.changed_by}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: N.textMuted, flexWrap: 'wrap' }}>
              <AuditValue v={c.old_value} muted />
              <ChevronRight size={11} style={{ color: N.textFaint }} />
              <AuditValue v={c.new_value} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Audit : helpers d'affichage ─────────────────────────────────────────────
// 2026-08-21 : AuditList/AuditRow (audit PAR ROW) supprimés — doublon strict
// de l'audit client-level rendu par ClientAuditList dans l'accordéon.
function AuditValue({ v, muted = false }) {
  const display = v === null || v === undefined || v === '' ? '∅' : String(v);
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 3,
      background: muted ? '#ececeb' : '#e7f0fb',
      color: muted ? N.textMuted : '#1e40af',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 11.5,
      maxWidth: 220,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {display}
    </span>
  );
}

function formatAuditDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Section : Commentaires (fil interne Owner) ──────────────────────────────
// Remplace la timeline mensuelle (2026-08-25). Porte le contexte humain du
// recouvrement — « promesse de règlement au 15 », « en attente retour
// cabinet » — que ni l'échéancier ni l'audit ne capturent.
//
// Endpoints (backend en cours de déploiement → code défensif) :
//   GET    /finance-periods/client/{id}/comments        (trié serveur)
//   POST   /finance-periods/client/{id}/comments        {body}
//   PATCH  /finance-periods/client/{id}/comments/{cid}  {pinned}
//   DELETE /finance-periods/client/{id}/comments/{cid}
//
// Toutes les mutations sont optimistes + rollback + toast, comme le reste de
// la page. Les actions (épingler / supprimer) ne s'affichent que si le
// backend a calculé `can_moderate` sur l'entrée.
//
// Fil INTERNE Owner : aucun lien vers le fil du board (le cabinet Opti'Lex
// ne doit pas le voir).

// Tri local appliqué après chaque mutation optimiste — même ordre que le
// serveur : épinglés d'abord, puis du plus récent au plus ancien.
const sortComments = (list) => [...list].sort((a, b) => {
  if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
  return String(b.created_at || '').localeCompare(String(a.created_at || ''));
});

function ClientComments({ clientId, onShowToast }) {
  const [comments, setComments] = useState(null);   // null = en cours / indispo
  const [available, setAvailable] = useState(true); // false = endpoint absent
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // id en attente
  const taRef = useRef(null);

  const base = clientId ? `/api/v1/finance-periods/client/${clientId}/comments` : null;

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    setComments(null);
    setAvailable(true);
    setDraft('');
    setConfirmDelete(null);
    apiClient.get(base)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.comments) ? data.comments
          : Array.isArray(data) ? data : [];
        setComments(sortComments(list));
      })
      .catch(() => {
        // Endpoint pas encore déployé / erreur : section masquée, pas de
        // composer inutilisable ni de crash.
        if (!cancelled) { setAvailable(false); setComments([]); }
      });
    return () => { cancelled = true; };
  }, [clientId, base]);

  // Textarea auto-grow (pas de scrollbar interne, la fiche scrolle déjà).
  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, []);

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body || posting || !base) return;
    setPosting(true);
    // Optimiste : entrée temporaire en tête, remplacée par la réponse.
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      body,
      // Même convention que CommentPopup.jsx : full_name > name > email.
      author_name: (() => {
        const u = apiClient.getUser();
        return u?.full_name || u?.name || u?.email || 'Moi';
      })(),
      pinned: false,
      created_at: new Date().toISOString(),
      can_moderate: true,
      _pending: true,
    };
    setComments((prev) => sortComments([...(prev || []), optimistic]));
    setDraft('');
    if (taRef.current) taRef.current.style.height = 'auto';
    try {
      const created = await apiClient.post(base, { body });
      setComments((prev) => sortComments(
        (prev || []).map((c) => (c.id === tempId ? { ...optimistic, ...created, _pending: false } : c))
      ));
    } catch (e) {
      setComments((prev) => (prev || []).filter((c) => c.id !== tempId));
      setDraft(body); // le texte n'est pas perdu
      onShowToast?.(e?.data?.detail || 'Erreur lors de la publication du commentaire', 'error');
    } finally {
      setPosting(false);
    }
  }, [draft, posting, base, onShowToast]);

  const togglePin = useCallback(async (comment) => {
    if (!base) return;
    const next = !comment.pinned;
    const snapshot = comments;
    setComments((prev) => sortComments(
      (prev || []).map((c) => (c.id === comment.id ? { ...c, pinned: next } : c))
    ));
    try {
      await apiClient.patch(`${base}/${comment.id}`, { pinned: next });
    } catch (e) {
      setComments(snapshot);
      onShowToast?.(e?.data?.detail || "Erreur lors de l'épinglage", 'error');
    }
  }, [base, comments, onShowToast]);

  const remove = useCallback(async (comment) => {
    if (!base) return;
    const snapshot = comments;
    setConfirmDelete(null);
    setComments((prev) => (prev || []).filter((c) => c.id !== comment.id));
    try {
      await apiClient.delete(`${base}/${comment.id}`);
    } catch (e) {
      setComments(snapshot);
      onShowToast?.(e?.data?.detail || 'Erreur lors de la suppression', 'error');
    }
  }, [base, comments, onShowToast]);

  if (!available) return null;

  return (
    <Section title="Commentaires" delay={0.14}>
      {/* Composer */}
      <div style={{
        border: `1px solid ${N.borderSft}`,
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: comments?.length ? 10 : 0,
      }}>
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => { setDraft(e.currentTarget.value); autoGrow(); }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
          }}
          rows={2}
          placeholder="Ajouter un commentaire… (promesse de règlement, retour cabinet…)"
          style={{
            width: '100%', border: 'none', outline: 'none', resize: 'none',
            background: 'transparent',
            fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', color: N.text,
            minHeight: 38, maxHeight: 220, boxSizing: 'border-box',
          }}
        />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginTop: 4,
        }}>
          <span style={{ fontSize: 10.5, color: N.textFaint }}>
            ⌘ + Entrée pour publier
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || posting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 26, padding: '0 12px',
              border: 'none', borderRadius: 6,
              background: draft.trim() ? '#2383e2' : '#e9e9e7',
              color: draft.trim() ? '#fff' : N.textFaint,
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              cursor: draft.trim() && !posting ? 'pointer' : 'default',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <MessageSquarePlus size={12} strokeWidth={2} />
            {posting ? 'Envoi…' : 'Commenter'}
          </button>
        </div>
      </div>

      {/* Fil */}
      {comments === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{
              height: 52, background: '#f3f4f6', borderRadius: 10,
              animation: 'tsfPulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.15,
            }} />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div style={{
          padding: '10px 12px', fontSize: 12.5, color: N.textFaint,
          fontStyle: 'italic',
        }}>
          Aucun commentaire pour ce client.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AnimatePresence initial={false}>
            {comments.map((c, i) => (
              <CommentRow
                key={c.id}
                comment={c}
                index={i}
                confirming={confirmDelete === c.id}
                onAskDelete={() => setConfirmDelete(c.id)}
                onCancelDelete={() => setConfirmDelete(null)}
                onConfirmDelete={() => remove(c)}
                onTogglePin={() => togglePin(c)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </Section>
  );
}

const COMMENT_AMBER = '#b45309';

function CommentRow({
  comment, index, confirming,
  onAskDelete, onCancelDelete, onConfirmDelete, onTogglePin,
}) {
  const [hover, setHover] = useState(false);
  const av = avatarMeta(comment.author_name || comment.author_email || '?');
  const edited = comment.updated_at && comment.updated_at !== comment.created_at;
  const showActions = comment.can_moderate && (hover || confirming);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: comment._pending ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index, 6) * 0.025, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px',
        border: `1px solid ${N.borderSft}`,
        borderLeft: comment.pinned ? `2px solid ${COMMENT_AMBER}` : `1px solid ${N.borderSft}`,
        borderRadius: 10,
        background: comment.pinned ? '#fffdf8' : '#fff',
        overflow: 'hidden',
        transition: 'background 0.2s ease',
      }}
    >
      {/* Avatar initiales de l'auteur */}
      <span style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: av.bg, color: av.fg,
        fontSize: 10.5, fontWeight: 700, userSelect: 'none',
      }}>
        {av.initials}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          flexWrap: 'wrap', minWidth: 0,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: N.text }}>
            {comment.author_name || comment.author_email || 'Inconnu'}
          </span>
          <span style={{ fontSize: 11, color: N.textFaint, whiteSpace: 'nowrap' }}>
            {formatRelativeFR(comment.created_at)}
          </span>
          {edited && (
            <span style={{ fontSize: 10.5, color: N.textFaint, fontStyle: 'italic' }}>
              modifié
            </span>
          )}
          {comment.pinned && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 7px', borderRadius: 999,
              background: '#fff3e3', color: COMMENT_AMBER,
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.03em',
            }}>
              <Pin size={9} strokeWidth={2.4} />
              Épinglé
            </span>
          )}
        </div>
        {/* Texte : les retours à la ligne saisis sont préservés */}
        <div style={{
          marginTop: 3,
          fontSize: 13, lineHeight: 1.5, color: N.text,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {comment.body}
        </div>
      </div>

      {/* Actions — réservées à `can_moderate` (direction financière ou
          auteur du message), révélées au survol. Suppression confirmée
          INLINE : un window.confirm bloquerait l'UI. */}
      {showActions && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          flexShrink: 0, alignSelf: 'flex-start',
        }}>
          {confirming ? (
            <>
              <span style={{ fontSize: 11, color: N.textMuted, whiteSpace: 'nowrap' }}>
                Supprimer ?
              </span>
              <button
                type="button"
                onClick={onConfirmDelete}
                style={{ ...commentActionStyle, color: '#b42318', fontWeight: 700, width: 'auto', padding: '0 7px' }}
              >
                Oui
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                style={{ ...commentActionStyle, color: N.textMuted, width: 'auto', padding: '0 7px' }}
              >
                Annuler
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                title={comment.pinned ? 'Désépingler' : 'Épingler en tête'}
                onClick={onTogglePin}
                style={{ ...commentActionStyle, color: comment.pinned ? COMMENT_AMBER : N.textFaint }}
                onMouseEnter={(e) => { e.currentTarget.style.background = N.sideBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Pin size={12} strokeWidth={2} />
              </button>
              <button
                type="button"
                title="Supprimer"
                onClick={onAskDelete}
                style={{ ...commentActionStyle, color: N.textFaint }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fdecec'; e.currentTarget.style.color = '#b42318'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = N.textFaint; }}
              >
                <Trash2 size={12} strokeWidth={2} />
              </button>
            </>
          )}
        </span>
      )}
    </motion.div>
  );
}

const commentActionStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  height: 22, width: 22, padding: 0,
  border: 'none', background: 'transparent',
  borderRadius: 5, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 11,
  transition: 'background 0.12s, color 0.12s',
};

// ── Empty state ─────────────────────────────────────────────────────────────
function Empty({ text = 'Aucune donnée disponible.' }) {
  return (
    <div style={{
      padding: '20px 14px',
      background: N.sideBg,
      borderRadius: 6,
      color: N.textMuted,
      fontSize: 13,
      textAlign: 'center',
    }}>
      {text}
    </div>
  );
}
