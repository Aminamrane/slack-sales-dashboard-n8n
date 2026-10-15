// src/components/sequenceMail/EmailViewer.jsx
//
// Lecteur d'un e-mail : objet, en-tête façon Gmail (expéditeur, destinataires, date), corps réel
// (HTML ou texte), puis « Informations de séquence ». Le même composant sert dans un onglet et
// dans une fenêtre flottante ; il ne reçoit que le détail déjà chargé (cf. useEmailDetail).
//
// Le lecteur n'est PAS remonté quand on passe à l'e-mail précédent/suivant (seul le corps l'est, via sa clé) :
// le bouton qui vient d'être activé garde le focus clavier.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, PictureInPicture2, TriangleAlert, SearchX } from 'lucide-react';
import { actions, useSeqStore } from './store';
import { fmtWhenLong, fromNow } from './format.js';
import { PHASES, SEGMENTS, SEQUENCES, audienceTone, describeTiming, emailKey, titleOf } from './model.js';
import { Chip, RetryButton } from './ui';
import EmailBodyFrame from './EmailBodyFrame';
import { hasMergeFields } from './emailHtml.js';
import SequenceInfo from './SequenceInfo';

/** @brief Position de défilement de chaque e-mail, gardée le temps de la session (changement d'onglet sans perte d'état). */
const scrollMemory = new Map();

/**
 * @brief Prestataire d'envoi des e-mails des cohortes webinaire. La donnée embarquée (instantané de la landing) ne le
 * nomme pas : c'est une constante documentée (cf. src/data/webinarSequences/README.md), seul le domaine d'envoi est lu dans l'e-mail.
 */
const SEND_PROVIDER = 'Resend';

/** @brief « Nom <adresse> » → { name, email }. */
function parseAddress(raw) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(raw || '');
  if (m) return { name: m[1].replace(/^"|"$/g, ''), email: m[2] };
  return { name: raw || '', email: '' };
}

/** @brief Domaine d'une adresse (« info@ownertechnology.com » → « ownertechnology.com »), ou chaîne vide. */
const domainOf = (address) => (address.includes('@') ? address.split('@').pop().trim() : '');

function Skeleton() {
  return (
    <div className="smx-viewer-in" aria-busy="true" aria-label="Chargement de l'e-mail">
      <div className="smx-skel" style={{ width: '62%', height: 22, margin: '18px 0 14px' }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <div className="smx-skel" style={{ width: 90, height: 18 }} />
        <div className="smx-skel" style={{ width: 70, height: 18 }} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <div className="smx-skel" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="smx-skel" style={{ width: '34%' }} />
          <div className="smx-skel" style={{ width: '22%' }} />
        </div>
      </div>
      <div className="smx-skel" style={{ height: 180, borderRadius: 8 }} />
    </div>
  );
}

/**
 * @param detail Résultat de useEmailDetail.
 * @param context `'tab'` ou `'float'` : le bouton « Détacher » n'existe que dans un onglet (la fenêtre
 * flottante a déjà « Réintégrer » et « Fermer » dans sa barre de titre).
 * @param onNavigate Reçoit la clé de l'e-mail précédent/suivant de la cohorte.
 * @param onClose Fermeture de l'onglet/fenêtre (e-mail introuvable).
 * @param onRetry Recharge (erreur de chargement).
 */
export default function EmailViewer({ detail, context, tabId, panelId, apiStatus, onDetach, onNavigate, onClose, onRetry }) {
  const key = detail.key;
  const viewMode = useSeqStore((s) => s.viewMode[key]) || 'html';
  const detailsOpen = useSeqStore((s) => Boolean(s.detailsOpen[key]));
  const scrollRef = useRef(null);
  const copiedTimer = useRef(0);
  const [copied, setCopied] = useState(false);

  // Le minuteur de l'icône « copié » ne survit pas au lecteur.
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  // Restaure la position de lecture de cet e-mail. Elle est mémorisée au fil du défilement (et non au démontage :
  // le lecteur peut rester monté d'un e-mail à l'autre, et son contenu a déjà changé quand un nettoyage s'exécute).
  // Le corps est une iframe qui grandit après son chargement : la position est donc réappliquée à chaque
  // mesure (onFrameFit) tant que l'utilisateur n'a pas repris la main.
  const pendingScroll = useRef(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    pendingScroll.current = scrollMemory.get(key) || 0;
    el.scrollTop = pendingScroll.current;
  }, [key, detail.state]);
  const onFrameFit = useCallback(() => {
    const el = scrollRef.current;
    const want = pendingScroll.current;
    if (!el || !want || el.scrollHeight - el.clientHeight < want) return;
    el.scrollTop = want;
    pendingScroll.current = 0;
  }, []);
  const takeControl = useCallback(() => {
    pendingScroll.current = 0;
  }, []);

  // Dans un onglet, le lecteur est le panneau de cet onglet ; dans une fenêtre flottante, une simple région.
  const panelProps =
    context === 'tab'
      ? { role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, tabIndex: -1 }
      : { role: 'region', 'aria-label': "Contenu de l'e-mail" };

  const step = detail.step;
  const timing = useMemo(() => (step ? describeTiming(step, detail.meta?.liveAt || detail.cohort?.liveAt) : null), [step, detail.meta, detail.cohort]);

  if (detail.state === 'loading') {
    return (
      <div ref={scrollRef} className="smx-viewer" {...panelProps}>
        <Skeleton />
      </div>
    );
  }
  if (detail.state === 'error') {
    return (
      <div className="smx-viewer" {...panelProps}>
        <div className="smx-state" role="alert">
          <TriangleAlert size={28} aria-hidden />
          <strong>Contenu indisponible</strong>
          <p>{detail.error || "Le contenu de cette cohorte n'a pas pu être chargé."}</p>
          <RetryButton needsReload={detail.needsReload} onRetry={onRetry} />
        </div>
      </div>
    );
  }
  if (detail.state === 'missing' || !step) {
    return (
      <div className="smx-viewer" {...panelProps}>
        <div className="smx-state">
          <SearchX size={28} aria-hidden />
          <strong>E-mail introuvable</strong>
          <p>Cet e-mail n'existe plus dans la séquence de sa cohorte (le contenu a pu changer depuis l'ouverture de l'onglet).</p>
          {onClose && <button type="button" className="smx-btn" onClick={onClose}>Fermer</button>}
        </div>
      </div>
    );
  }

  const cohort = detail.cohort;
  const phase = PHASES[step.phase];
  const sender = parseAddress(step.from);
  const subject = step.subject || '';
  const recipients = step.recipientsLabel || `Inscrits de la cohorte ${cohort?.short ?? ''}`.trim();
  const mergeNote = hasMergeFields(step.html) || hasMergeFields(step.text);
  const calendarAt = step.timing?.mode === 'calendar' ? step.timing.at : null;
  const hasBody = Boolean(step.html || step.text);
  const prevTitle = detail.prev ? titleOf(detail.prev) : '';
  const nextTitle = detail.next ? titleOf(detail.next) : '';
  const sendDomain = domainOf(sender.email);
  // Une étape synthétisée (cohorte du CRM seul) n'a ni expéditeur, ni destinataires, ni séquence, ni date connus :
  // son lecteur n'en affiche aucun (rien n'est inventé).
  const hasDate = Boolean(calendarAt || timing?.when || timing?.note);

  const copySubject = async () => {
    try {
      await navigator.clipboard.writeText(subject);
      setCopied(true);
      actions.announce("Objet copié dans le presse-papiers");
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      actions.announce("Impossible de copier l'objet");
    }
  };

  return (
    <div
      ref={scrollRef}
      className="smx-viewer"
      {...panelProps}
      tabIndex={-1}
      onScroll={(e) => {
        // Tant qu'une restauration est en attente, les défilements sont les nôtres : ils n'écrasent pas la mémoire.
        if (!pendingScroll.current) scrollMemory.set(key, e.currentTarget.scrollTop);
      }}
      onWheel={takeControl}
      onPointerDown={takeControl}
      onKeyDown={takeControl}
      onTouchStart={takeControl}
    >
      <div className="smx-viewer-in">
        <div className="smx-vbar" role="group" aria-label="Actions sur l'e-mail">
          <button
            type="button" className="smx-iconbtn" disabled={!detail.prev}
            aria-label={detail.prev ? `E-mail précédent : ${prevTitle}` : 'Pas d\'e-mail précédent'}
            title={detail.prev ? `Précédent : ${prevTitle}` : 'Premier e-mail de la cohorte'}
            onClick={() => detail.prev && onNavigate(emailKey(detail.cohortId, detail.prev.kind))}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span className="smx-vbar-count" aria-live="polite">{detail.total ? `${detail.index + 1} sur ${detail.total}` : ''}</span>
          <button
            type="button" className="smx-iconbtn" disabled={!detail.next}
            aria-label={detail.next ? `E-mail suivant : ${nextTitle}` : 'Pas d\'e-mail suivant'}
            title={detail.next ? `Suivant : ${nextTitle}` : 'Dernier e-mail de la cohorte'}
            onClick={() => detail.next && onNavigate(emailKey(detail.cohortId, detail.next.kind))}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          <span className="smx-vbar-spacer" />
          <button type="button" className="smx-iconbtn" onClick={copySubject} disabled={!subject} aria-label="Copier l'objet" title="Copier l'objet">
            {copied ? <Check size={17} aria-hidden /> : <Copy size={17} aria-hidden />}
          </button>
          {context === 'tab' && (
            <button type="button" className="smx-iconbtn" onClick={onDetach} aria-label="Détacher dans une fenêtre flottante" title="Détacher dans une fenêtre flottante (ou glisser l'onglet hors de la barre)">
              <PictureInPicture2 size={17} aria-hidden />
            </button>
          )}
        </div>

        <h2 className={`smx-subject${subject ? '' : ' is-empty'}`} title={subject || undefined}>
          {subject || (step.fallback ? step.kind : '(sans objet)')}
        </h2>
        <div className="smx-chips">
          {cohort && <Chip large tone={audienceTone(cohort.audience)} title={cohort.label}>{cohort.short}{cohort.audience ? ` · ${cohort.audience}` : ''}</Chip>}
          {step.fallback ? (
            <Chip large title="Cette cohorte n'a pas de contenu embarqué : seuls le type d'e-mail et ses compteurs viennent du CRM">Contenu local absent</Chip>
          ) : (
            <>
              <Chip large>{SEQUENCES[step.sequence]?.label ?? step.sequence}</Chip>
              {phase && phase.label !== SEQUENCES[step.sequence]?.label && <Chip large tone={phase.tone}>{phase.label}</Chip>}
              {step.segment && <Chip large>{SEGMENTS[step.segment]}</Chip>}
            </>
          )}
          <Chip large tone={detail.status.tone}>{detail.status.label}</Chip>
          {step.draftStatus && (
            <Chip large tone="amber" title="Modifié dans l'éditeur de mail : brouillon en mémoire, ni enregistré ni envoyé (prototype)">
              {step.draftStatus === 'confirmed' ? 'Confirmé (démo)' : 'Brouillon local (démo)'}
            </Chip>
          )}
        </div>

        {!step.fallback && (
          <div className="smx-msg-head">
            <div className="smx-avatar" aria-hidden>{(sender.name || 'O').charAt(0).toUpperCase()}</div>
            <div className="smx-msg-who">
              <div className="smx-msg-from">
                <strong>{sender.name || 'Expéditeur inconnu'}</strong>
                {sender.email && <span className="smx-msg-addr">&lt;{sender.email}&gt;</span>}
              </div>
              <div className="smx-msg-to">
                <span className="smx-msg-to-text" title={recipients}>à {recipients}</span>
                <button type="button" aria-expanded={detailsOpen} aria-label={detailsOpen ? "Masquer les détails de l'en-tête" : "Afficher les détails de l'en-tête"} onClick={() => actions.setDetailsOpen(key, !detailsOpen)}>
                  <ChevronDown size={14} aria-hidden style={{ transform: detailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </button>
              </div>
            </div>
            {hasDate && (
              <div className="smx-msg-date">
                <strong>{calendarAt ? fmtWhenLong(calendarAt).replace(' à ', ', ') : timing?.when}</strong>
                {calendarAt ? fromNow(calendarAt) : timing?.note}
              </div>
            )}
          </div>
        )}

        {detailsOpen && !step.fallback && (
          <dl className="smx-details">
            <dt>De</dt><dd>{step.from || '—'}</dd>
            <dt>À</dt><dd>{recipients} <span className="smx-code">{'{{email}}'}</span></dd>
            {step.replyTo && (<><dt>Répondre à</dt><dd>{step.replyTo}</dd></>)}
            <dt>Objet</dt><dd>{subject || '(sans objet)'}</dd>
            {hasDate && (<><dt>Envoi</dt><dd>{timing?.when}{timing?.note ? ` — ${timing.note}` : ''}</dd></>)}
            <dt>Envoyé via</dt><dd>{SEND_PROVIDER}{sendDomain ? ` (domaine ${sendDomain})` : ''}</dd>
            <dt>Type</dt><dd><span className="smx-code">{step.kind}</span></dd>
          </dl>
        )}

        {step.preheader && <p className="smx-preheader">Aperçu dans la boîte de réception : {step.preheader}</p>}

        {step.attachments?.length > 0 && (
          <div className="smx-attach" role="group" aria-label="Pièces jointes">
            {step.attachments.map((a) => (
              <span key={a.filename} className="smx-attach-item" title={a.contentType}>{a.filename}</span>
            ))}
          </div>
        )}

        {hasBody ? (
          <>
            <div className="smx-body-tools">
              {step.html && (
                <div className="smx-seg" role="group" aria-label="Affichage du contenu">
                  <button type="button" className={viewMode === 'html' ? 'is-on' : ''} aria-pressed={viewMode === 'html'} onClick={() => actions.setViewMode(key, 'html')}>Aperçu</button>
                  <button type="button" className={viewMode === 'text' ? 'is-on' : ''} aria-pressed={viewMode === 'text'} onClick={() => actions.setViewMode(key, 'text')}>Texte brut</button>
                </div>
              )}
              {mergeNote && (
                <span style={{ fontSize: 12, color: 'var(--smx-text-3)' }}>
                  Les champs <span className="smx-code">{'{{…}}'}</span> et les liens personnels sont générés pour chaque inscrit à l'envoi.
                </span>
              )}
            </div>
            <div className="smx-paper">
              {/* Clé = l'e-mail : passer au suivant recrée l'iframe (un nouveau document), jamais le lecteur autour d'elle. */}
              <EmailBodyFrame key={key} memoKey={key} html={step.html} text={step.text} mode={viewMode} title={subject || step.kind} onFit={onFrameFit} />
            </div>
          </>
        ) : (
          <p className="smx-nobody">
            {detail.noContent
              ? "Le contenu de cet e-mail n'est pas disponible : cette cohorte n'a pas de contenu embarqué, seuls ses compteurs d'envoi viennent du CRM."
              : 'Cet e-mail ne contient aucun corps.'}
          </p>
        )}

        <SequenceInfo detail={detail} apiStatus={apiStatus} />
      </div>
    </div>
  );
}
