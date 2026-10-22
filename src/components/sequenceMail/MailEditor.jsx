// src/components/sequenceMail/MailEditor.jsx
//
// Contenu de la fenêtre « Éditeur de mail » (PROTOTYPE) : ouverte par le stylo d'une étape du
// « Schéma de séquence », elle permet de modifier l'objet et le corps d'un e-mail dans une petite
// version d'un éditeur de texte riche.
//
//   Synchronisation en temps réel — il n'existe qu'une source de vérité : la couche des brouillons de
//   dataStore.js. Chaque frappe y écrit (`setMailDraft`) ; la liste, les onglets, le lecteur, les
//   fenêtres détachées et le schéma de « Gestion de séquence » lisent le même e-mail avec ce
//   brouillon superposé (cf. hooks.js) et se mettent donc à jour d'eux-mêmes. L'éditeur lit
//   lui aussi l'e-mail par `useEmailDetail` : s'il est modifié ailleurs (« Rétablir l'original »), il suit.
//
//   RIEN N'EST ENREGISTRÉ — les brouillons ne vivent qu'en mémoire (perdus au rechargement de la page) ;
//   « Confirmer les modifications » est une SIMULATION. Un seul bouton envoie un e-mail, et seulement à
//   soi-même : « Tester son mail » (TestMailDialog.jsx, testMail.js) adresse le brouillon affiché à l'adresse
//   du compte connecté, par un serveur d'Owner ; aucun inscrit, aucune séquence, aucune cohorte n'est touché. Un
//   bandeau PERMANENT le dit en haut de la fenêtre, et le navigateur demande confirmation avant de recharger
//   ou de quitter tant qu'un brouillon existe (draftsGuard.js).

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold, Check, CircleCheck, FlaskConical, Info, Italic, Link2, Link2Off, List, ListOrdered, Pencil, Redo2,
  RemoveFormatting, RotateCcw, ShieldCheck, TriangleAlert, Underline, Undo2, X,
} from 'lucide-react';
import './styles'; // feuilles posées une fois dans <head> (injectStyles.js)
import './mailEditorStyles';
import { actions } from './store';
import { useEmailDetail } from './hooks';
import { confirmMailDraft, resetMailDraft, retryCohort, setMailDraft } from './dataStore';
import { deriveFromHtml, draftState, normalizeLinkUrl, snippetOf } from './mailDraft';
import { normalizeEmailHtml } from './editorDom';
import { hasMergeFields } from './emailHtml';
import { PHASES, SEGMENTS, SEQUENCES, audienceTone } from './model';
import { Chip, RetryButton } from './ui';
import { parisParts } from '../../utils/parisDates';
import { useDraftsUnloadGuard } from './draftsGuard';
import RichTextFrame from './RichTextFrame';
import TestMailDialog from './TestMailDialog';

const NO_FORMAT = Object.freeze({
  hasSelection: false, bold: false, italic: false, underline: false, ul: false, ol: false, link: false, personalLink: false, locked: false,
});
const TOAST_MS = 8000;
/** Le bandeau permanent du haut de la fenêtre : le prototype n'enregistre rien ; seul le test s'envoie, à soi-même. */
const BANNER_TEXT = "Prototype : brouillons gardés en mémoire, rien n'est enregistré — perdus au rechargement. Seul « Tester son mail » envoie un e-mail, à votre adresse";
const NO_CARET_HINT = "placez d'abord le curseur dans le message (ou sélectionnez le texte à transformer en lien)";
const sameFormat = (a, b) => Object.keys(a).every((k) => a[k] === b[k]);
/** Heure à Paris, comme tout le reste de l'outil (les séquences sont planifiées en Europe/Paris). */
const clock = (ms) => {
  const p = parisParts(new Date(ms));
  return `${p.hour}:${p.minute}`;
};

/** Vrai sur un appareil Apple : les raccourcis s'y écrivent ⌘ plutôt que Ctrl. */
const isApplePlatform = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || '');
/** « Ctrl+Z » ou « ⌘Z » selon l'appareil. */
const modKey = (key) => (isApplePlatform() ? `⌘${key}` : `Ctrl+${key}`);
/** Rétablir : Ctrl+Y ailleurs, ⇧⌘Z sur Apple. */
const redoKey = () => (isApplePlatform() ? '⇧⌘Z' : 'Ctrl+Y');

/** Les outils de la barre, par groupes (un séparateur entre deux groupes). */
const TOOL_GROUPS = [['undo', 'redo'], ['bold', 'italic', 'underline'], ['ul', 'ol'], ['link', 'unlink', 'clear']];
const TOOL_ORDER = TOOL_GROUPS.flat();

/** @brief Bouton de la barre d'outils : il ne prend jamais le focus à la souris, pour ne pas perdre la sélection du texte. */
function Tool({ id, icon, label, shortcut, hint, pressed, disabled, tabStop, buttonRef, onFocus, onClick }) {
  const tip = [shortcut ? `${label} (${shortcut})` : label, hint].filter(Boolean).join(' — ');
  return (
    <button
      type="button"
      className="smx-iconbtn"
      data-tool={id}
      ref={buttonRef}
      aria-label={label}
      aria-pressed={pressed}
      title={tip}
      disabled={disabled}
      tabIndex={tabStop ? 0 : -1}
      onMouseDown={(e) => e.preventDefault()}
      onFocus={onFocus}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

/**
 * @brief Barre d'outils de mise en forme (`role="toolbar"`) : UNE seule tabulation pour toute la barre (tabindex
 * itinérant), les flèches gauche/droite et Début/Fin passent d'un outil actif à l'autre.
 * @param run Exécute une commande de mise en forme sur le corps (`exec` de RichTextFrame).
 * @param onLink Ouvre la saisie d'un lien ; @param onUnlink retire le lien sous le curseur.
 */
function Toolbar({ fmt, run, onLink, onUnlink }) {
  const [stop, setStop] = useState('undo');
  const refs = useRef({});
  const tools = {
    undo: { icon: <Undo2 size={17} aria-hidden />, label: 'Annuler', shortcut: modKey('Z'), onClick: () => run('undo') },
    redo: { icon: <Redo2 size={17} aria-hidden />, label: 'Rétablir', shortcut: redoKey(), onClick: () => run('redo') },
    bold: { icon: <Bold size={17} aria-hidden />, label: 'Gras', shortcut: modKey('B'), pressed: fmt.bold, onClick: () => run('bold') },
    italic: { icon: <Italic size={17} aria-hidden />, label: 'Italique', shortcut: modKey('I'), pressed: fmt.italic, onClick: () => run('italic') },
    underline: { icon: <Underline size={17} aria-hidden />, label: 'Souligné', shortcut: modKey('U'), pressed: fmt.underline, onClick: () => run('underline') },
    ul: { icon: <List size={17} aria-hidden />, label: 'Liste à puces', pressed: fmt.ul, onClick: () => run('insertUnorderedList') },
    ol: { icon: <ListOrdered size={17} aria-hidden />, label: 'Liste numérotée', pressed: fmt.ol, onClick: () => run('insertOrderedList') },
    link: {
      icon: <Link2 size={17} aria-hidden />,
      label: fmt.link ? 'Modifier le lien' : 'Insérer un lien',
      shortcut: modKey('K'),
      pressed: fmt.link,
      // Sans curseur dans le corps, poser un lien ne ferait rien : l'outil l'explique au lieu d'échouer en silence.
      disabled: fmt.personalLink || !fmt.hasSelection,
      hint: fmt.personalLink ? undefined : fmt.hasSelection ? undefined : NO_CARET_HINT,
      onClick: onLink,
    },
    unlink: { icon: <Link2Off size={17} aria-hidden />, label: 'Retirer le lien', disabled: !fmt.link || fmt.personalLink, onClick: onUnlink },
    clear: { icon: <RemoveFormatting size={17} aria-hidden />, label: 'Effacer la mise en forme', onClick: () => run('removeFormat') },
  };
  const enabled = TOOL_ORDER.filter((id) => !tools[id].disabled);
  const stopId = enabled.includes(stop) ? stop : enabled[0] ?? null;

  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const i = enabled.indexOf(e.target.closest?.('[data-tool]')?.getAttribute('data-tool'));
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = enabled[(i + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(i - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    setStop(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="smx-ed-toolbar" role="toolbar" aria-label="Mise en forme du message" aria-orientation="horizontal" onKeyDown={onKeyDown}>
      {TOOL_GROUPS.map((group, g) => (
        <Fragment key={group[0]}>
          {g > 0 && <span className="smx-ed-sep" aria-hidden />}
          {group.map((id) => (
            <Tool
              key={id}
              id={id}
              {...tools[id]}
              tabStop={id === stopId}
              buttonRef={(el) => {
                refs.current[id] = el;
              }}
              onFocus={() => setStop(id)}
            />
          ))}
        </Fragment>
      ))}
      {fmt.personalLink && <span className="smx-ed-toolhint">Lien personnel : généré à l'envoi, non modifiable</span>}
    </div>
  );
}

function EditorBody({ emailKey, detail }) {
  const { step, originalStep, draft, cohort } = detail;
  const isHtml = Boolean(originalStep.html);
  const frameRef = useRef(null);
  const subjectRef = useRef(null);
  const linkInputRef = useRef(null);
  const testButtonRef = useRef(null);
  const [fmt, setFmt] = useState(NO_FORMAT);
  const [linkBar, setLinkBar] = useState(null); // null | { value, error, range }
  const [testOpen, setTestOpen] = useState(false);
  const [toast, setToast] = useState(null); // null | { id, kind: 'confirmed' | 'protected' }

  const status = draftState(draft) ?? 'pristine';
  // Rang de l'étape dans SA chaîne (séquence × segment), le même découpage et le même libellé que « Schéma de séquence » :
  // « Étape 3 sur 13 », pas un rang dans toute la cohorte.
  const chain = useMemo(() => {
    const same = (detail.steps ?? [])
      .filter((s) => s.sequence === step.sequence && (s.segment || null) === (step.segment || null))
      .sort((a, b) => a.order - b.order);
    return { index: same.findIndex((s) => s.kind === step.kind), total: same.length };
  }, [detail.steps, step.kind, step.sequence, step.segment]);
  // Le HTML d'origine passé par la même sérialisation que celui de la zone de rédaction : un contenu
  // qui lui est égal n'est pas une modification (l'utilisateur est revenu à l'original).
  const pristineHtml = useMemo(() => (isHtml ? normalizeEmailHtml(originalStep.html) : ''), [isHtml, originalStep.html]);
  // Dernier corps écrit par l'éditeur dans le brouillon (`null` = aucun) : l'écart avec le store
  // signale une modification venue d'ailleurs (« Rétablir l'original »).
  const lastDraftHtmlRef = useRef(draft?.html ?? null);

  useEffect(() => {
    subjectRef.current?.focus({ preventScroll: true });
  }, []);

  // ── Corps ─────────────────────────────────────────────────────────────────
  const onBodyChange = useCallback(
    (html) => {
      const next = html === pristineHtml ? null : html;
      if (next === lastDraftHtmlRef.current) return;
      lastDraftHtmlRef.current = next;
      if (next === null) setMailDraft(emailKey, { html: null, text: null, snippet: null, links: null });
      else setMailDraft(emailKey, { html: next, ...deriveFromHtml(next) });
    },
    [emailKey, pristineHtml]
  );

  const storeDraftHtml = draft?.html ?? null;
  useEffect(() => {
    if (!isHtml || storeDraftHtml === lastDraftHtmlRef.current) return;
    lastDraftHtmlRef.current = storeDraftHtml;
    frameRef.current?.setHtml(storeDraftHtml ?? originalStep.html);
  }, [isHtml, storeDraftHtml, originalStep.html]);

  const onTextChange = (e) => {
    const value = e.target.value;
    if (value === originalStep.text) setMailDraft(emailKey, { text: null, snippet: null });
    else setMailDraft(emailKey, { text: value, snippet: snippetOf(value) });
  };

  // ── Objet ─────────────────────────────────────────────────────────────────
  const onSubjectChange = (e) => {
    const value = e.target.value;
    setMailDraft(emailKey, { subject: value === originalStep.subject ? null : value });
  };

  // ── Mise en forme et liens ────────────────────────────────────────────────
  const run = (command) => frameRef.current?.exec(command);
  const onFormat = useCallback((next) => setFmt((prev) => (sameFormat(prev, next) ? prev : next)), []);

  const openLinkBar = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const current = frame.currentLink();
    setLinkBar({ value: current ?? '', error: '', range: frame.captureSelection() });
  }, []);
  useEffect(() => {
    if (linkBar) linkInputRef.current?.focus();
    // Seule l'ouverture/fermeture de la barre compte, pas chaque frappe dans son champ.
  }, [linkBar === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeLinkBar = () => {
    setLinkBar(null);
    frameRef.current?.focus();
  };
  const applyLinkBar = () => {
    const url = normalizeLinkUrl(linkBar.value);
    if (!url) {
      setLinkBar((bar) => ({ ...bar, error: 'Adresse invalide : saisissez un lien (https://…), une adresse e-mail ou un numéro (tel:…).' }));
      return;
    }
    // `applyLink` dit s'il a pu poser le lien : sans curseur dans le corps (ou sur un bloc protégé), on l'explique.
    if (!frameRef.current?.applyLink(url, linkBar.range)) {
      setLinkBar((bar) => ({ ...bar, error: `Le lien n'a pas pu être posé : ${NO_CARET_HINT}, hors du pied de désinscription.` }));
      return;
    }
    setLinkBar(null);
  };

  // ── Rétablir, confirmer (simulation), tester (envoi réel, à soi-même) ─────
  const onReset = () => {
    resetMailDraft(emailKey);
    setToast(null);
    setLinkBar(null);
    actions.announce("E-mail rétabli à son contenu d'origine");
  };
  const onConfirm = () => {
    // SIMULATION : seul un horodatage local est posé (dataStore.js) ; rien n'est enregistré.
    confirmMailDraft(emailKey);
    setToast({ id: Date.now(), kind: 'confirmed' });
    actions.announce("Confirmation simulée : rien n'est enregistré ni envoyé, les modifications restent en mémoire jusqu'au rechargement de la page");
  };
  const onProtectedRestore = useCallback(() => setToast({ id: Date.now(), kind: 'protected' }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);
  const closeTest = () => {
    setTestOpen(false);
    testButtonRef.current?.focus();
  };

  const phase = PHASES[step.phase];
  const recipients = step.recipientsLabel || `Inscrits de la cohorte ${cohort?.short ?? ''}`.trim();
  const showToast = toast && (toast.kind !== 'confirmed' || status === 'confirmed');
  const statusText =
    status === 'confirmed'
      ? `Confirmation simulée à ${clock(draft.confirmedAt)} — rien n'est enregistré ni envoyé`
      : status === 'editing'
        ? 'Modifications en cours — visibles en direct dans Gestion de séquence, en mémoire seulement'
        : "Aucune modification — c'est l'e-mail d'origine";

  return (
    <>
      <div className="smx-ed-head">
        <div className="smx-ed-title">
          <span className="smx-ed-title-mark" aria-hidden><Pencil size={15} /></span>
          <h2>Modifier l'e-mail</h2>
          <Chip tone="amber" title="Prototype : rien n'est enregistré ; seul « Tester son mail » envoie un e-mail, à votre adresse">Mode démonstration</Chip>
        </div>
        <div className="smx-ed-ctx">
          {cohort && <Chip tone={audienceTone(cohort.audience)} title={cohort.label}>{cohort.short}{cohort.audience ? ` · ${cohort.audience}` : ''}</Chip>}
          <Chip>{SEQUENCES[step.sequence]?.label ?? step.sequence}</Chip>
          {phase && phase.label !== SEQUENCES[step.sequence]?.label && <Chip tone={phase.tone}>{phase.label}</Chip>}
          {step.segment && <Chip>{SEGMENTS[step.segment] ?? step.segment}</Chip>}
          {chain.index >= 0 && chain.total > 0 ? <Chip>Étape {chain.index + 1} sur {chain.total}</Chip> : null}
        </div>
        <div className="smx-ed-field">
          <span className="smx-ed-label">De</span>
          <span className="smx-ed-static" title={step.from}>{step.from || '—'}</span>
        </div>
        <div className="smx-ed-field">
          <span className="smx-ed-label">À</span>
          <span className="smx-ed-static" title={recipients}>{recipients}</span>
        </div>
        <div className="smx-ed-field">
          <label className="smx-ed-label" htmlFor="smx-ed-subject">Objet</label>
          <input
            ref={subjectRef}
            id="smx-ed-subject"
            className="smx-ed-input"
            type="text"
            value={step.subject}
            placeholder="Objet de l'e-mail"
            autoComplete="off"
            onChange={onSubjectChange}
          />
        </div>
      </div>

      {isHtml ? (
        <Toolbar fmt={fmt} run={run} onLink={openLinkBar} onUnlink={() => frameRef.current?.removeLink()} />
      ) : (
        <p className="smx-ed-note">Cet e-mail est envoyé en texte brut : il n'a pas de mise en forme.</p>
      )}

      {linkBar && (
        <form
          className="smx-ed-linkbar"
          onSubmit={(e) => {
            e.preventDefault();
            applyLinkBar();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              closeLinkBar();
            }
          }}
        >
          <label htmlFor="smx-ed-link">Adresse du lien</label>
          <input
            ref={linkInputRef}
            id="smx-ed-link"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={linkBar.value}
            aria-invalid={linkBar.error ? 'true' : undefined}
            aria-describedby={linkBar.error ? 'smx-ed-link-err' : undefined}
            onChange={(e) => setLinkBar((bar) => ({ ...bar, value: e.target.value, error: '' }))}
          />
          <button type="submit" className="smx-btn is-solid">Appliquer</button>
          <button type="button" className="smx-btn" onClick={closeLinkBar}>Annuler</button>
          {linkBar.error && <p id="smx-ed-link-err" className="smx-ed-linkerr" role="alert">{linkBar.error}</p>}
        </form>
      )}

      <div className="smx-ed-canvas">
        <div className="smx-ed-paper">
          {isHtml ? (
            <RichTextFrame
              ref={frameRef}
              html={step.html}
              title={originalStep.subject || originalStep.kind}
              onChange={onBodyChange}
              onFormatChange={onFormat}
              onRequestLink={openLinkBar}
              onProtectedRestore={onProtectedRestore}
            />
          ) : (
            <textarea
              className="smx-ed-textarea"
              aria-label="Contenu de l'e-mail (texte brut)"
              value={step.text || ''}
              spellCheck
              onChange={onTextChange}
            />
          )}
        </div>
        {showToast && (
          <div className={`smx-ed-toast${toast.kind === 'confirmed' ? ' is-ok' : ''}`} role="status">
            <span className="smx-ed-toast-ico">
              {toast.kind === 'confirmed' ? <CircleCheck size={18} aria-hidden /> : <ShieldCheck size={18} aria-hidden />}
            </span>
            <div className="smx-ed-toast-body">
              {toast.kind === 'confirmed' ? (
                <>
                  <strong>Confirmation simulée</strong>
                  <span>Rien n'est enregistré ni envoyé : les modifications restent en mémoire jusqu'au rechargement de la page.</span>
                </>
              ) : (
                <>
                  <strong>Bloc protégé</strong>
                  <span>Le pied de page de désinscription ne peut pas être supprimé : il a été rétabli.</span>
                </>
              )}
            </div>
            <button type="button" className="smx-iconbtn is-sm" onClick={() => setToast(null)} aria-label="Fermer le message" title="Fermer">
              <X size={15} aria-hidden />
            </button>
          </div>
        )}
        {testOpen && (
          <TestMailDialog
            step={step}
            hasMergeFields={hasMergeFields(step.html) || hasMergeFields(step.text)}
            onClose={closeTest}
            onSent={(result) => actions.announce(`Test envoyé à ${result.to || 'votre adresse'} : vérifiez votre boîte de réception`)}
          />
        )}
      </div>

      <div className="smx-ed-foot">
        <span className={`smx-ed-status is-${status}`} role="status">
          <span className="smx-ed-dot" aria-hidden />
          {statusText}
        </span>
        <div className="smx-ed-actions">
        <button type="button" className="smx-btn is-ghost" onClick={onReset} disabled={status === 'pristine'} title="Abandonner les modifications et revenir à l'e-mail d'origine">
          <RotateCcw size={14} aria-hidden /> Rétablir l'original
        </button>
        <button ref={testButtonRef} type="button" className="smx-btn" onClick={() => setTestOpen(true)}>
          <FlaskConical size={14} aria-hidden /> Tester son mail
        </button>
        <button
          type="button"
          className="smx-btn is-solid"
          onClick={onConfirm}
          disabled={status !== 'editing'}
          title={status === 'pristine' ? 'Aucune modification à confirmer' : 'Simulation : rien n\'est enregistré'}
        >
          {status === 'confirmed' ? (<><Check size={14} aria-hidden /> Modifications confirmées</>) : 'Confirmer les modifications'}
        </button>
        </div>
      </div>
    </>
  );
}

/**
 * @param emailKey Clé de l'e-mail édité (cohorte + type, cf. model.js).
 * @param darkMode Mode sombre de la page : l'éditeur suit celui de « Gestion de séquence ».
 */
export default function MailEditor({ emailKey, darkMode = false }) {
  useDraftsUnloadGuard();
  const detail = useEmailDetail(emailKey);
  let content;
  if (detail.state === 'ready' && detail.originalStep) {
    content = <EditorBody key={emailKey} emailKey={emailKey} detail={detail} />;
  } else if (detail.state === 'loading') {
    content = <div className="smx-ed-state" role="status" aria-busy="true">Chargement de l'e-mail…</div>;
  } else {
    content = (
      <div className="smx-ed-state" role="alert">
        <TriangleAlert size={26} aria-hidden />
        <strong>E-mail indisponible</strong>
        <span>
          {detail.error ||
            (detail.noContent
              ? "Contenu local absent pour cet e-mail : régénérer l'instantané."
              : "Cet e-mail n'existe plus dans la séquence de sa cohorte, ou son contenu n'est pas disponible.")}
        </span>
        {/* Même bouton que le schéma et le lecteur : « Réessayer », ou « Recharger la page » après une mise à jour du site. */}
        {detail.cohortId && <RetryButton needsReload={detail.needsReload} onRetry={() => void retryCohort(detail.cohortId)} />}
      </div>
    );
  }
  return (
    <div className={`smx-ed smx-theme-${darkMode ? 'dark' : 'light'}`} role="region" aria-label="Éditeur de mail">
      {/* Bandeau PERMANENT, quel que soit l'état de l'e-mail : rien de ce qui est écrit ici n'est enregistré, et seul le test s'envoie (à soi-même). */}
      <p className="smx-ed-banner" role="note">
        <Info size={14} aria-hidden />
        <span>{BANNER_TEXT}</span>
      </p>
      {content}
    </div>
  );
}
