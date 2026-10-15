// src/components/sequenceMail/SequenceSchema.jsx
//
// Contenu de la fenêtre « Schéma de séquence » : le parcours complet des e-mails de la cohorte
// sélectionnée dans « Gestion de séquence », sous forme de chaînes (une par séquence × segment)
// reliées par des flèches portant le délai entre deux étapes. Tant qu'aucune cohorte précise
// n'est choisie (« Toutes les cohortes »), la fenêtre ne montre que le logo Owner, très discret,
// et un court message : la cohorte se choisit dans « Gestion de séquence ».
//
// Données réelles uniquement, dérivées par `useSequenceMail` (hooks.js) — le même hook que
// « Gestion de séquence » — et regroupées par `buildSchemaChains` (schemaModel.js), qui reprend
// le découpage séquence/segment déjà utilisé pour afficher « Précédent »/« Suivant » dans le
// lecteur (neighborsOf, model.js). Les délais viennent de `delayBetween` (model.js) : `null` — « délai
// variable » — quand deux étapes ne sont pas comparables, jamais un délai inventé. Les `conditions`
// d'envoi de chaque étape (« Sauté si… », lues dans le contenu de la cohorte) sont montrées : une
// étape sautable porte sa condition et la flèche qui y mène est pointillée, pour que le schéma ne
// laisse pas croire à un enchaînement garanti.
//
// Ouvrir un e-mail = Ctrl/Cmd + clic ou Entrée (DÉCISION D'AMIN du 2026-09-28, inchangée) : c'est
// `actions.openEmail`, exactement l'action qu'utilise la liste de « Gestion de séquence » ; il n'existe
// qu'un seul mécanisme de sélection, partagé par les deux fenêtres via le store de module (store.js).
// La légende en haut de la fenêtre le dit. Au clavier, UNE seule tabulation pour tout le schéma
// (tabindex itinérant) : les flèches passent d'une étape à l'autre (haut/bas dans la chaîne, gauche/droite
// d'une chaîne à l'autre, Début/Fin), Entrée ouvre l'e-mail et l'annonce aux lecteurs d'écran ; la
// tabulation suivante atteint le stylo de l'étape courante.
//
// Chaque case porte aussi un petit stylo (au survol, au focus, toujours sur un écran sans survol) qui
// ouvre l'éditeur de mail de cette étape (MailEditor.jsx) : un bouton frère de la case, jamais imbriqué
// dedans. Le stylo reste affiché sur une étape déjà modifiée ou en cours d'édition. Les modifications
// sont des brouillons en mémoire (cf. dataStore.js).
//
// Survol, focus et mise en page vivent dans schemaStyles.js (CSS), pas dans un état par case : les cases
// sont mémoïsées et ne se re-rendent que si ce qu'elles montrent change.

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, Pencil, SkipForward } from 'lucide-react';
import { SCHEMA_TONES } from './schemaTheme';
import './schemaStyles';
import { actions, useSeqStore } from './store';
import { useLatest, useSequenceMail } from './hooks';
import { retryCohort, useDataStore } from './dataStore';
import { PHASES, SEGMENTS, shortRelative, titleOf } from './model';
import { RetryButton } from './ui';
import { fmtDayMonth, fmtInt, fmtWhenShort } from './format';
import {
  buildSchemaChains, conditionSummary, conditionsByKind, isFallbackEmail, schemaNeighborKey, schemaStopKey,
} from './schemaModel';
import { useDraftsUnloadGuard } from './draftsGuard';

const FAVICON_URL = `${import.meta.env.BASE_URL}favicon.png`;

/** Touches de la navigation fléchée → déplacement (cf. `schemaNeighborKey`). */
const KEY_MOVES = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Home: 'first', End: 'last' };
/**
 * Statuts sans information à montrer sur une case (le relevé n'a pas eu lieu, n'a pas fini ou a échoué) : ni à l'écran,
 * ni dans le libellé. Quand TOUTES les étapes sont dans ce cas, la légende le dit une seule fois (`statusNote`).
 */
const HIDDEN_STATUS = new Set(['loading', 'notloaded', 'unknown']);
const NO_CONDITION = Object.freeze({ full: '', short: '', skippable: false });
const toneOf = (name) => (SCHEMA_TONES[name] ? name : 'grey');
const plural = (n, word) => `${fmtInt(n)} ${word}${n > 1 ? 's' : ''}`;

/** @brief Clé de l'étape portée par l'élément ciblé (la case ou son stylo), ou `null`. */
const stepKeyOf = (el) => el?.getAttribute?.('data-email-key') ?? el?.getAttribute?.('data-email-edit') ?? null;

/** @brief État vide/chargement/erreur : le logo, très transparent, un court message et, au besoin, un bouton (`footer`). */
function SchemaMessage({ danger = false, footer, children }) {
  return (
    <div className="smx-sch-msg">
      <img className="smx-sch-logo" src={FAVICON_URL} alt="" draggable={false} />
      <p className={`smx-sch-text${danger ? ' is-danger' : ''}`}>{children}</p>
      {footer}
    </div>
  );
}

/** Champs d'une étape que la case montre : deux étapes égales sur ces champs donnent la même case. */
const STEP_FIELDS = ['key', 'kind', 'subject', 'hasContent', 'phase', 'segment', 'draftStatus', 'timing'];
const NODE_PROPS = [
  'ordinal', 'total', 'isSelected', 'isOpen', 'isEditing', 'isStop', 'hintId', 'conditionFull', 'conditionShort', 'skippable', 'onJump', 'onEdit',
];
const sameStep = (a, b) =>
  a === b ||
  (STEP_FIELDS.every((f) => a[f] === b[f]) &&
    a.status?.key === b.status?.key &&
    a.status?.label === b.status?.label &&
    a.status?.tone === b.status?.tone);
/** @brief Comparaison des props d'une case : l'objet `step` est recréé à chaque dérivation, ses champs affichés non. */
const sameNode = (prev, next) => sameStep(prev.step, next.step) && NODE_PROPS.every((k) => prev[k] === next[k]);

/**
 * @brief Une case : sujet, phase/segment, moment d'envoi, statut d'envoi et condition « Sauté si… », et, par-dessus son
 * coin, le stylo. Ctrl/Cmd + clic ou Entrée l'ouvre dans Gestion de séquence. Le wrapper a exactement la taille de la case :
 * la mise en page du schéma ne bouge pas.
 * @param isStop La case porte la tabulation (tabindex itinérant) ; son stylo aussi.
 * @param onJump `(clé, options?)` — `options.announceTitle` : l'ouverture vient du clavier, on l'annonce.
 */
const SchemaNode = memo(function SchemaNode({
  step, ordinal, total, isSelected, isOpen, isEditing, isStop, hintId, conditionFull, conditionShort, skippable, onJump, onEdit,
}) {
  const phase = PHASES[step.phase];
  const phaseLabel = phase?.label ?? step.phase;
  const segmentLabel = step.segment ? SEGMENTS[step.segment] : null;
  const title = titleOf(step);
  const t = step.timing;
  const when = t?.mode === 'calendar' ? fmtWhenShort(t.at) : shortRelative(t);
  const status = step.status && !HIDDEN_STATUS.has(step.status.key) ? step.status : null;
  const edited = Boolean(step.draftStatus);

  // Les morceaux sont séparés par un point : on retire celui qui termine déjà un sujet ou une condition (« là.. »).
  const ariaLabel = [`Étape ${ordinal} sur ${total}`, title, phaseLabel, segmentLabel, when, status?.label, conditionFull]
    .filter(Boolean)
    .map((part) => String(part).replace(/[.\s]+$/, ''))
    .join('. ');
  const hint = `Ctrl/Cmd + clic (ou Entrée) : ouvrir « ${title} » dans Gestion de séquence`;
  const editLabel = edited ? `Modifier l'e-mail « ${title} » (déjà modifié)` : `Modifier l'e-mail « ${title} »`;

  return (
    <div className={`smx-sn t-${toneOf(phase?.tone)}`}>
      <button
        type="button"
        className={`smx-sn-btn${isSelected ? ' is-selected' : ''}`}
        data-email-key={step.key}
        tabIndex={isStop ? 0 : -1}
        aria-label={ariaLabel}
        aria-current={isSelected ? 'true' : undefined}
        aria-describedby={hintId}
        title={conditionFull ? `${hint}\n\n${conditionFull}` : hint}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) onJump(step.key);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onJump(step.key, { announceTitle: title });
          }
        }}
      >
        <span className="smx-sn-top">
          <span className="smx-sn-badge">
            {String(ordinal).padStart(2, '0')}/{total}
          </span>
          <span>{phaseLabel}</span>
          {segmentLabel && <span className="smx-sn-seg">· {segmentLabel}</span>}
          {isOpen && <span className="smx-sn-open" aria-hidden title="Déjà ouvert dans Gestion de séquence" />}
        </span>
        <span className="smx-sn-title">{title}</span>
        {(when || status) && (
          <span className="smx-sn-meta">
            {when && <span>{when}</span>}
            {status && (
              <span className={`smx-sn-status t-${toneOf(status.tone)}`}>
                <span className="smx-sn-sdot" aria-hidden />
                {status.label}
              </span>
            )}
          </span>
        )}
        {skippable && conditionShort && (
          <span className="smx-sn-cond">
            <SkipForward aria-hidden size={11} />
            {conditionShort}
          </span>
        )}
      </button>
      {onEdit && (
        <button
          type="button"
          className={`smx-sn-edit${edited || isEditing ? ' is-active is-pinned' : ''}`}
          data-email-edit={step.key}
          tabIndex={isStop ? 0 : -1}
          aria-label={editLabel}
          title={edited ? 'Modifier le contenu de cet e-mail (déjà modifié, brouillon local)' : 'Modifier le contenu de cet e-mail'}
          onClick={() => onEdit(step.key)}
        >
          <Pencil aria-hidden size={12} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}, sameNode);

/**
 * @brief Flèche entre deux étapes d'une même chaîne, avec le délai (ou « délai variable » si non comparable).
 * @param conditional L'étape suivante peut être sautée : flèche pointillée, `conditionShort` en infobulle.
 */
const SchemaConnector = memo(function SchemaConnector({ delay, conditional, conditionShort }) {
  const tip = [
    delay ? null : "Délai variable : dépend de la date d'inscription de chaque destinataire.",
    conditional ? `Étape suivante conditionnelle — ${conditionShort}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`smx-sc${conditional ? ' is-cond' : ''}`}>
      <span className="smx-sc-line" aria-hidden />
      <span className="smx-sc-pill" title={tip || undefined}>
        {delay || 'délai variable'}
      </span>
      <span className="smx-sc-line" aria-hidden />
      <ArrowDown className="smx-sc-arrow" aria-hidden size={13} />
    </div>
  );
});

/** @brief Une chaîne : son titre (séquence, segment éventuel), collé en haut quand on défile, puis ses étapes, reliées sauf pour un envoi ponctuel. */
function SchemaChainColumn({ chain, selectedKey, openKeys, editingKey, stopKey, hintId, summaryOf, onJump, onEdit }) {
  const n = chain.steps.length;
  return (
    <div role="group" aria-label={`${chain.label}, ${plural(n, 'e-mail')}`} className="smx-sch-chain">
      <div className="smx-sch-head">
        {chain.label} <span>· {n}</span>
      </div>
      <div className={`smx-sch-steps${chain.connected ? '' : ' is-row'}`}>
        {chain.steps.map((step, i) => {
          const cond = summaryOf(step);
          const next = chain.steps[i + 1];
          const nextCond = next ? summaryOf(next) : NO_CONDITION;
          return (
            <div key={step.key} className="smx-sch-step">
              <SchemaNode
                step={step}
                ordinal={i + 1}
                total={n}
                isSelected={step.key === selectedKey}
                isOpen={openKeys.has(step.key)}
                isEditing={step.key === editingKey}
                isStop={step.key === stopKey}
                hintId={hintId}
                conditionFull={cond.full}
                conditionShort={cond.short}
                skippable={cond.skippable}
                onJump={onJump}
                onEdit={onEdit}
              />
              {chain.connected && next && <SchemaConnector delay={chain.gaps[i]} conditional={nextCond.skippable} conditionShort={nextCond.short} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** @brief Le schéma complet : la légende, puis toutes les chaînes de la cohorte, côte à côte, dans une zone qui défile. */
function SchemaCanvas({ chains, selectedKey, openKeys, editingKey, snapshot, summaryOf, onJump, onEdit }) {
  const hintId = useId();
  // Compteurs d'envoi indisponibles (cohorte absente du CRM, CRM injoignable) : une seule mention, pas une par case.
  const statusNote = chains.every((c) => c.steps.every((s) => s.status?.key === 'unknown')) ? "Compteurs d'envoi indisponibles" : '';
  const scrollRef = useRef(null);
  const chainsRef = useLatest(chains);
  // Dernière étape visitée au clavier ou à la souris : c'est elle qui porte la tabulation.
  const [lastStop, setLastStop] = useState(null);
  const stopKey = schemaStopKey(chains, lastStop, selectedKey);

  // Un e-mail sélectionné depuis « Gestion de séquence » (liste, onglets) : sa case est amenée dans le champ si elle n'y est
  // pas. Seule la sélection compte — pas les chaînes, recalculées à chaque frappe de l'éditeur — sinon on arracherait le
  // défilement de l'utilisateur à chaque lettre.
  useEffect(() => {
    if (!selectedKey) return;
    scrollRef.current?.querySelector(`[data-email-key="${CSS.escape(selectedKey)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedKey]);

  const onFocus = useCallback((e) => {
    const key = stepKeyOf(e.target);
    if (key) setLastStop(key);
  }, []);

  const onKeyDown = useCallback(
    (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const move = KEY_MOVES[e.key];
      const current = stepKeyOf(e.target);
      if (!move || !current) return;
      e.preventDefault();
      const next = schemaNeighborKey(chainsRef.current, current, move);
      if (!next || next === current) return;
      setLastStop(next);
      scrollRef.current?.querySelector(`[data-email-key="${CSS.escape(next)}"]`)?.focus();
    },
    [chainsRef]
  );

  return (
    <>
      <div className="smx-sch-bar">
        <span id={hintId} className="smx-sch-hint">
          <span className="smx-sch-seg">
            <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + clic ou <kbd>Entrée</kbd> pour ouvrir
          </span>
          <span className="smx-sch-seg">
            <kbd>←</kbd>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>→</kbd> pour naviguer
          </span>
          <span className="smx-sch-seg">
            <Pencil aria-hidden size={11} /> pour modifier
          </span>
        </span>
        {statusNote && <span className="smx-sch-snap">{statusNote}</span>}
        {snapshot && <span className="smx-sch-snap">Instantané du {snapshot}</span>}
      </div>
      <div ref={scrollRef} className="smx-sch-scroll" onFocus={onFocus} onKeyDown={onKeyDown}>
        <div className="smx-sch-chains">
          {chains.map((chain) => (
            <SchemaChainColumn
              key={chain.id}
              chain={chain}
              selectedKey={selectedKey}
              openKeys={openKeys}
              editingKey={editingKey}
              stopKey={stopKey}
              hintId={hintId}
              summaryOf={summaryOf}
              onJump={onJump}
              onEdit={onEdit}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * @param onOpenManager Ramène la fenêtre « Gestion de séquence » au premier plan (elles peuvent se
 *   recouvrir si l'une des deux a été déplacée) ; appelé juste avant d'y ouvrir l'e-mail visé.
 * @param onEditEmail Ouvre l'éditeur de mail de l'étape (clé en argument) ; sans lui, aucun stylo n'est affiché.
 * @param editingKey Clé de l'e-mail actuellement ouvert dans l'éditeur (son stylo reste affiché).
 */
export default function SequenceSchema({ onOpenManager, onEditEmail, editingKey = null }) {
  useDraftsUnloadGuard();
  const cohortId = useSeqStore((s) => s.cohortId);
  const selectedKey = useSeqStore((s) => s.selectedKey);
  const tabs = useSeqStore((s) => s.tabs);
  const floating = useSeqStore((s) => s.floating);

  const openKeys = useMemo(() => [...tabs, ...floating.map((f) => f.key)], [tabs, floating]);
  const openSet = useMemo(() => new Set(openKeys), [openKeys]);
  const { cohorts, api, emails, loadingContent, contentError, contentNeedsReload } = useSequenceMail({ cohortId, openKeys });
  const cohort = cohortId === 'all' ? null : cohorts.find((c) => c.id === cohortId) ?? null;
  const chains = useMemo(() => buildSchemaChains(emails), [emails]);

  // Conditions d'envoi et date de l'instantané : lues dans le contenu chargé de la cohorte (les e-mails dérivés
  // ne portent pas les `conditions` ; s'ils les portent un jour, ils priment).
  const content = useDataStore((d) => d.content[cohortId]?.data ?? null);
  const conditionsOfKind = useMemo(() => conditionsByKind(content?.steps), [content]);
  const summaryOf = useCallback(
    (step) => (Array.isArray(step.conditions) ? conditionSummary(step.conditions) : conditionsOfKind.get(step.kind) ?? NO_CONDITION),
    [conditionsOfKind]
  );
  const generatedAt = cohort?.generatedAt ?? content?.generatedAt ?? null;
  const snapshot = generatedAt ? fmtDayMonth(generatedAt) : '';

  // Callbacks STABLES quelles que soient les props (la page en passe de nouvelles à chaque rendu) : les cases mémoïsées
  // ne se re-rendent pas pour rien.
  const latest = useLatest({ onOpenManager, onEditEmail });
  const jump = useCallback(
    (key, options) => {
      latest.current.onOpenManager?.();
      actions.openEmail(key);
      // Ouverture au clavier : rien ne bouge sous les doigts, on l'annonce (même zone que « Gestion de séquence »).
      if (options?.announceTitle) actions.announce(`E-mail « ${options.announceTitle} » ouvert dans Gestion de séquence`);
    },
    [latest]
  );
  // Le stylo ouvre l'e-mail dans « Gestion de séquence » (c'est là que se voit, en direct, ce qui est
  // écrit dans l'éditeur) puis l'éditeur lui-même. Le clic sur la case, lui, reste inchangé (`jump`).
  const edit = useCallback(
    (key) => {
      actions.openEmail(key);
      latest.current.onEditEmail?.(key);
    },
    [latest]
  );
  // Comme dans la navigation de « Gestion de séquence » : choisir une cohorte ramène aussi sur la liste.
  const pick = useCallback((id) => {
    actions.selectCohort(id);
    actions.activate(null);
  }, []);
  // « Réessayer » : le contenu en échec, la liste des cohortes si elle l'est aussi, et les compteurs de cette cohorte.
  const retry = useCallback(() => void retryCohort(cohortId), [cohortId]);

  // Une cohorte absente du catalogue local (connue du seul CRM), ou dont tous les e-mails sont synthétisés :
  // pas de contenu, donc pas de parcours — on le dit au lieu d'en dessiner un.
  const localMissing = Boolean(cohort) && (cohort.inCatalog === false || (emails.length > 0 && emails.every(isFallbackEmail)));

  let state;
  if (!cohort) state = cohortId !== 'all' && (api.status === 'idle' || api.status === 'loading') ? 'loading' : 'pick';
  else if (cohort.inCatalog === false) state = 'missing';
  else if (loadingContent) state = 'loading';
  else if (contentError) state = 'error';
  else if (localMissing) state = 'missing';
  else if (chains.length === 0) state = 'empty';
  else state = 'ready';

  const missingText = "Contenu local absent pour cette cohorte : régénérer l'instantané.";
  const live = {
    pick: 'Aucune cohorte sélectionnée : choisissez une cohorte pour afficher son schéma de séquence.',
    loading: 'Chargement du schéma de séquence…',
    error: `Schéma indisponible : ${contentError}`,
    missing: missingText,
    empty: 'Cette cohorte ne contient aucune séquence.',
    ready: cohort ? `Schéma de séquence : ${cohort.label}, ${plural(chains.length, 'chaîne')}.` : '',
  }[state];

  let view;
  if (state === 'pick') view = <SchemaMessage>Choisissez une cohorte pour afficher son schéma de séquence.</SchemaMessage>;
  else if (state === 'loading') view = <SchemaMessage>Chargement du schéma de séquence…</SchemaMessage>;
  else if (state === 'error') {
    view = (
      // Après une mise à jour du site, « Réessayer » ne servirait à rien : le bouton propose alors de recharger la page.
      <SchemaMessage danger footer={<RetryButton needsReload={contentNeedsReload} onRetry={retry} className="smx-sch-btn" />}>
        Schéma indisponible : {contentError}
      </SchemaMessage>
    );
  } else if (state === 'missing') {
    view = (
      <SchemaMessage
        footer={
          <button type="button" className="smx-sch-btn" onClick={() => pick('all')}>
            Choisir une autre cohorte
          </button>
        }
      >
        <strong>{missingText}</strong>
        <br />
        Ses e-mails existent côté CRM, mais leur contenu n'est pas dans l'instantané embarqué : aucun parcours n'est dessiné plutôt que d'en inventer un.
      </SchemaMessage>
    );
  } else if (state === 'empty') view = <SchemaMessage>Cette cohorte ne contient aucune séquence.</SchemaMessage>;
  else {
    view = (
      <SchemaCanvas
        chains={chains}
        selectedKey={selectedKey}
        openKeys={openSet}
        editingKey={editingKey}
        snapshot={snapshot}
        summaryOf={summaryOf}
        onJump={jump}
        onEdit={onEditEmail ? edit : undefined}
      />
    );
  }

  return (
    <div className="smx-sch" role="region" aria-label={cohort ? `Schéma de séquence : ${cohort.label}` : 'Schéma de séquence'}>
      {/* Zone vivante PERMANENTE : chargement, erreur, liste vide ou schéma prêt sont annoncés, même quand le bloc visible est remplacé. */}
      <div className="smx-sch-sr" role="status" aria-live="polite">
        {live}
      </div>
      {view}
    </div>
  );
}
