// src/components/sequenceMail/TestMailDialog.jsx
//
// « Tester son mail » : envoie le brouillon affiché dans l'éditeur, pour de VRAI, à l'adresse du compte connecté
// — et à aucune autre : l'adresse n'est pas saisissable ici et le serveur la relit dans le jeton de session.
// Route de test de la landing webinaire (cf. testMail.js), appelée avec le jeton de la session du CRM. Rien n'est
// enregistré, aucun inscrit ni aucune séquence n'est touché. L'e-mail de test est préfixé « [Test] », {{prénom}} y est
// remplacé par le prénom du compte et les liens personnels (désinscription, présence, agenda…) y sont désactivés.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, FlaskConical, Loader2, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import {
  TEST_MAIL_SENDER, TEST_SUBJECT_PREFIX, accountEmail, describeTestError, differingSender, hasTestContent, postWithSession,
  sendTestMail,
} from './testMail';

const post = (url, body) => postWithSession(apiClient, url, body);

/**
 * @param step E-mail édité, brouillon superposé (objet, HTML, texte, « répondre à », type, expéditeur).
 * @param hasMergeFields Le contenu a des champs `{{…}}` : la note sous le récapitulatif le précise.
 * @param onClose Ferme la fenêtre (Échap, croix, « Annuler », « Fermer ») ; impossible pendant l'envoi.
 * @param onSent Appelé avec le résultat quand le test est parti (annonce pour les lecteurs d'écran).
 */
export default function TestMailDialog({ step, hasMergeFields, onClose, onSent }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const sendRef = useRef(null);
  const closeRef = useRef(null);
  const [phase, setPhase] = useState('form'); // form | sending | done
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null); // { to, subject } du test parti, tels que le serveur les rapporte
  const to = useMemo(() => accountEmail(apiClient.getUser()), []);
  const sending = phase === 'sending';
  const blocker = !to
    ? 'Adresse e-mail de votre compte introuvable : reconnectez-vous, puis réessayez.'
    : !hasTestContent(step)
      ? "Cet e-mail est vide : il n'y a rien à envoyer."
      : '';
  const subject = step.subject || '(sans objet)';
  const otherSender = differingSender(step);

  // Le focus suit l'étape (le bouton qu'on vient d'activer disparaît ou se désactive) : sans cela il
  // tomberait sur la page et Échap n'atteindrait plus la fenêtre.
  useEffect(() => {
    if (phase === 'form') (sendRef.current && !sendRef.current.disabled ? sendRef.current : dialogRef.current)?.focus();
    else if (phase === 'sending') dialogRef.current?.focus();
    else closeRef.current?.focus();
  }, [phase]);

  const send = async () => {
    if (sending || blocker) return;
    setError('');
    setPhase('sending');
    try {
      const result = await sendTestMail(post, step);
      if (result.ok) {
        setSent(result);
        setPhase('done');
        onSent?.(result);
      } else {
        setError(result.error);
        setPhase('form');
      }
    } catch (err) {
      setError(describeTestError(err));
      setPhase('form');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!sending) onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    // La fenêtre est modale : le focus reste dedans.
    const items = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
    if (!items.length) {
      e.preventDefault(); // envoi en cours : rien n'est actif, le focus ne doit pas partir derrière la fenêtre
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="smx-ed-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}>
      <div ref={dialogRef} className="smx-ed-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="smx-ed-dialog-head">
          <FlaskConical size={18} aria-hidden />
          <h3 id={titleId}>Tester son mail</h3>
          <button type="button" className="smx-iconbtn is-sm" onClick={onClose} disabled={sending} aria-label="Fermer" title="Fermer">
            <X size={16} aria-hidden />
          </button>
        </div>

        {phase === 'done' ? (
          <>
            <div className="smx-ed-result" role="status">
              <span className="smx-ed-result-ico"><Check size={24} aria-hidden /></span>
              <strong>Test envoyé</strong>
              <dl className="smx-ed-recap">
                <div><dt>Destinataire</dt><dd>{sent?.to || to}</dd></div>
                <div><dt>Objet</dt><dd>{sent?.subject || TEST_SUBJECT_PREFIX + subject}</dd></div>
                <div><dt>Expéditeur</dt><dd>{TEST_MAIL_SENDER}</dd></div>
              </dl>
              <p>Vérifiez votre boîte de réception (et vos courriers indésirables). Les liens personnels y sont désactivés : ils fonctionneront dans l'envoi réel.</p>
            </div>
            <div className="smx-ed-dialog-actions">
              <button type="button" className="smx-btn" onClick={() => setPhase('form')}>Refaire un test</button>
              <button ref={closeRef} type="button" className="smx-btn is-solid" onClick={onClose}>Fermer</button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <p>Le brouillon affiché est envoyé à votre adresse uniquement. Rien n'est enregistré et aucun inscrit n'est contacté.</p>
            <dl className="smx-ed-recap">
              <div><dt>Destinataire</dt><dd>{to || '—'}</dd></div>
              <div><dt>Objet</dt><dd>{TEST_SUBJECT_PREFIX + subject}</dd></div>
              <div>
                <dt>Expéditeur</dt>
                <dd>
                  {TEST_MAIL_SENDER}
                  {otherSender && <span className="smx-ed-sub">L'envoi réel part de : {otherSender}</span>}
                </dd>
              </div>
            </dl>
            <p>
              Dans ce test, {hasMergeFields ? <>les champs <code>{'{{…}}'}</code> sont remplacés par vos données et </> : ''}
              les liens personnels (désinscription, présence, agenda…) sont désactivés : ils fonctionneront dans l'envoi réel.
            </p>
            {/* <div> et non <p> : en thème sombre, index.css force `body.dark-mode p` en blanc (!important), ce qui effacerait le rouge. */}
            {(error || blocker) && <div className="smx-ed-dialog-err" role="alert">{error || blocker}</div>}
            <div className="smx-ed-dialog-actions">
              <button type="button" className="smx-btn" onClick={onClose} disabled={sending}>Annuler</button>
              <button ref={sendRef} type="submit" className="smx-btn is-solid" disabled={Boolean(blocker) || sending} aria-busy={sending}>
                {sending ? (<><Loader2 size={14} aria-hidden className="smx-spin" /> Envoi…</>) : error ? "Réessayer l'envoi" : "Envoyer le test"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
