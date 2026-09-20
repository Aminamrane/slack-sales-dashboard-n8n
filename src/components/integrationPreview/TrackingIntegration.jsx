import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowLeft, FileCheck2, ShieldCheck, PenLine, CalendarDays, Check, Send, ReceiptText, ClipboardCheck, UsersRound, ArrowRight } from "lucide-react";
import apiClient from "../../services/apiClient";
import IntegrationPreviewStudio from "./IntegrationPreviewStudio";
import "./trackingIntegration.css";

export function IntegrationRollout({ state, onChange }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!state?.can_manage) return null;
  async function update(target, enabled) {
    setBusy(true);
    setError("");
    try {
      const result = await apiClient.put("/api/v1/owner-integration/rollout", {
        target,
        enabled,
        revision: state.revision,
        confirmation: target === "all" && enabled ? confirmation : "CONFIRMER",
      });
      onChange(result);
      setConfirming(false);
      setConfirmation("");
    } catch (e) {
      setError(e.message || "Le réglage n’a pas été modifié.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ti-rollout">
      <div>
        <ShieldCheck size={18} />
        <strong>Fiche d’intégration Owner</strong>
        <span>
          {state.enabled
            ? "Activée pour tous"
            : state.pilot_enabled
              ? "Active uniquement sur mes dossiers"
              : "Parcours actuel"}
        </span>
      </div>
      <div>
        {!state.enabled && (
          <button
            disabled={busy}
            onClick={() => update("pilot", !state.pilot_enabled)}
          >
            {state.pilot_enabled
              ? "Suspendre mon test"
              : "Activer sur mes dossiers"}
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => {
            setConfirming(!confirming);
            setConfirmation("");
          }}
        >
          {state.enabled ? "Suspendre la généralisation" : "Activer pour tous…"}
        </button>
      </div>
      {confirming && (
        <section
          className="ti-confirm"
          role="group"
          aria-label="Confirmation de la bascule"
        >
          <strong>
            {state.enabled
              ? "Suspendre les nouveaux dossiers"
              : "Généraliser le parcours aux sales"}
          </strong>
          <p>
            Les contrats déjà envoyés conservent leur parcours. Aucun
            rendez-vous existant ne sera annulé.
          </p>
          {!state.enabled && (
            <label>
              Saisissez « ACTIVER POUR TOUS » après votre validation
              <input
                autoFocus
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          )}
          <button
            disabled={
              busy || (!state.enabled && confirmation !== "ACTIVER POUR TOUS")
            }
            onClick={() => update("all", !state.enabled)}
          >
            {busy ? "Enregistrement…" : "Confirmer"}
          </button>
          <button disabled={busy} onClick={() => setConfirming(false)}>
            Annuler
          </button>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function IntegrationButton({ onClick, ready }) {
  return (
    <button className="ti-open" onClick={onClick}>
      <FileCheck2 size={17} />
      <span>
        Fiche d’intégration Owner
        <small>
          {ready
            ? "Validée · consulter"
            : "Sociétés, dirigeants et météo client"}
        </small>
      </span>
      <span>↗</span>
    </button>
  );
}

export function SalesJourneySteps({ phase = "intake", compact = false }) {
  const declaring = ["details", "booking", "billing"].includes(phase);
  const steps = declaring
    ? [["details", "Vente", ClipboardCheck], ["booking", "Rendez-vous", CalendarDays], ["billing", "Facturation", ReceiptText]]
    : [["setup", "Salariés", UsersRound], ["intake", "Fiche client", FileCheck2], ["contract", "Contrat", PenLine], ["signed", "Onboarding", CalendarDays]];
  const current = steps.findIndex(([key]) => key === phase);
  return <ol className={`ti-journey ${compact ? "is-compact" : ""}`} aria-label="Parcours de vente">
    {steps.map(([key, label, Icon], index) => <li key={key} className={index < current ? "is-complete" : index === current ? "is-current" : ""} aria-current={index === current ? "step" : undefined}>
      <span className="ti-step-icon">{index < current ? <Check size={17} /> : <Icon size={17} />}</span>
      <span>{label}</span>
    </li>)}
  </ol>;
}

export function IntegrationDialog({ context, onClose, onSaved, contractDetails = {}, onSend, onPrepared }) {
  const [stage, setStage] = useState(context.nextAction ? "setup" : "intake");
  const [preparation, setPreparation] = useState(context.preparation || {});
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");
  const preparationSaved = useRef(JSON.stringify(context.preparation || {}));
  const preparationCurrent = useRef(preparationSaved.current);
  preparationCurrent.current = JSON.stringify(preparation);
  const bands = ['1-2','3-5','6-10','11-19','20-29','30-39','40-49','50-74','75-99','100-149','150-199','200-249','250-299','300-349','350-400'];
  async function prepare(event) {
    event.preventDefault(); setSetupBusy(true); setSetupError("");
    try {
      const result = await apiClient.put(`/api/v1/owner-integration/leads/${context.lead_id}/contract-preparation`, {
        employee_range: preparation.employee_range, email: preparation.email,
        phone: preparation.phone || "", fingerprint: preparation.fingerprint,
      });
      setPreparation(result); preparationSaved.current = JSON.stringify(result);
      onPrepared?.(result); setStage("intake"); dialog.current?.scrollTo({ top: 0, behavior: "instant" });
    } catch (error) { setSetupError(error.message || "Vérifiez les coordonnées du signataire."); }
    finally { setSetupBusy(false); }
  }
  const [sourceDraft, setSourceDraft] = useState(context.draft);
  const [validated, setValidated] = useState(context.ready);
  const [sourceReset, setSourceReset] = useState(0);
  const revision = useRef(context.revision);
  const saved = useRef(JSON.stringify(context.draft));
  const current = useRef(saved.current);
  const dialog = useRef(null);
  const close = () => {
    if (
      (current.current !== saved.current || preparationCurrent.current !== preparationSaved.current) &&
      !window.confirm("Fermer sans enregistrer les dernières modifications ?")
    )
      return;
    onClose();
  };
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const keydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab") {
        const items = [
          ...dialog.current.querySelectorAll(
            "button:not(:disabled), input, select, textarea, a[href], summary",
          ),
        ].filter((el) => el.getClientRects().length);
        const first = items[0],
          last = items[items.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const unload = (e) => {
      if (current.current !== saved.current || preparationCurrent.current !== preparationSaved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("keydown", keydown);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      window.removeEventListener("beforeunload", unload);
      previous?.focus();
    };
  }, []);
  async function persist(draft, validate) {
    const result = await apiClient.put(
      `/api/v1/owner-integration/leads/${context.lead_id}`,
      {
        draft,
        validate,
        revision: revision.current,
        source_fingerprint: context.source_fingerprint,
      },
    );
    if (result.saved) {
      revision.current = result.revision;
      saved.current = JSON.stringify(draft);
      setSourceDraft(draft);
      setValidated(result.ready);
      onSaved(result);
    }
    return result;
  }
  return createPortal(
    <div className="ti-overlay">
      <section
        ref={dialog}
        tabIndex={-1}
        className="ti-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ti-title"
      >
        <header className="ti-dialog-head">
          <button onClick={close}>
            <ArrowLeft size={17} />
            Retour à ma tracking sheet
          </button>
          <strong id="ti-title">{context.client_name}</strong>
          <button onClick={close} aria-label="Fermer la fiche">
            <X size={20} />
          </button>
        </header>
        {context.source_changed && (
          <p className="ti-source-note">
            Le NDA a évolué depuis la dernière validation. Vérifiez les sociétés
            et les dirigeants avant de valider à nouveau.{" "}
            <button
              onClick={() => {
                const next = {
                  ...JSON.parse(current.current),
                  companies: context.source_draft.companies,
                  directors: context.source_draft.directors,
                };
                setSourceDraft(next);
                setValidated(false);
                current.current = JSON.stringify(next);
                setSourceReset((n) => n + 1);
              }}
            >
              Reprendre le périmètre NDA
            </button>
          </p>
        )}
        {context.nextAction && <SalesJourneySteps phase={stage} />}
        {stage === "setup" ? (
          <form className="ti-contract-review ti-preparation" onSubmit={prepare}>
            <div className="ti-review-icon"><UsersRound size={30} strokeWidth={1.6} /></div>
            <span className="ti-review-eyebrow">PRÉPARER LE CONTRAT</span>
            <h1>Commençons par l’essentiel</h1>
            <p>Confirmez le nombre de salariés et les coordonnées du signataire.</p>
            <fieldset className="ti-band-field"><legend>Nombre de salariés</legend>
              <div className="ti-band-options">{bands.map(band => <button type="button" key={band} aria-pressed={preparation.employee_range === band} onClick={() => setPreparation(p => ({ ...p, employee_range: band }))}>{band}</button>)}</div>
            </fieldset>
            <div className="ti-contact-fields">
              <label>Email du signataire<input type="email" required maxLength={254} value={preparation.email || ""} onChange={e => setPreparation(p => ({ ...p, email: e.target.value }))} autoComplete="email" /></label>
              <label>Téléphone du signataire <small>(facultatif)</small><input type="tel" maxLength={80} value={preparation.phone || ""} onChange={e => setPreparation(p => ({ ...p, phone: e.target.value }))} placeholder="06 12 34 56 78 ou +33 6…" autoComplete="tel" /></label>
            </div>
            {preparation.signer_name && <p className="ti-signer-name">Signataire : <strong>{preparation.signer_name}</strong></p>}
            {!preparation.nda_ready && <p role="alert">Générez d’abord le NDA depuis votre dossier pour préparer le contrat.</p>}
            {setupError && <p className="ti-setup-error" role="alert">{setupError}</p>}
            <div className="ti-review-actions"><button className="ip-primary" type="submit" disabled={setupBusy || !preparation.employee_range || !preparation.nda_ready}>{setupBusy ? "Vérification…" : "Continuer vers la fiche"}<ArrowRight size={17} /></button></div>
          </form>
        ) : stage === "contract" ? (
          <section className="ti-contract-review" aria-labelledby="ti-review-title">
            <div className="ti-review-icon"><FileCheck2 size={32} strokeWidth={1.6} /></div>
            <span className="ti-review-eyebrow">FICHE CLIENT VALIDÉE</span>
            <h1 id="ti-review-title" tabIndex={-1}>Prêt pour la signature</h1>
            <p>Vérifiez les informations du dossier avant l’envoi au client.</p>
            <dl>
              <div><dt>Société</dt><dd>{context.client_name}</dd></div>
              <div><dt>Email du signataire</dt><dd>{preparation.email || contractDetails.email || "À renseigner dans le NDA"}</dd></div>
              <div><dt>Nombre de salariés</dt><dd>{preparation.employee_range || contractDetails.employeeRange || "À renseigner"}</dd></div>
              <div><dt>Téléphone du signataire</dt><dd>{preparation.phone || "Non renseigné"}</dd></div>
              <div><dt>Date du contrat</dt><dd>{contractDetails.displayDate ? new Date(`${contractDetails.displayDate}T12:00:00`).toLocaleDateString("fr-FR") : "Date du jour"}</dd></div>
            </dl>
            <div className="ti-next-appointment"><CalendarDays size={23} /><span><strong>Après la signature</strong>Un rendez-vous onboarding avec Vincent et la facturation.</span></div>
            <div className="ti-review-actions">
              <button className="ip-secondary" onClick={() => setStage("intake")}><ArrowLeft size={17} /> Revoir la fiche</button>
              <button className="ip-primary" onClick={() => onSend(preparation)}><Send size={17} />{context.nextAction.type === "resend" ? "Poursuivre le renvoi" : "Envoyer le contrat"}</button>
            </div>
          </section>
        ) : <>
        {context.nextAction && <button className="ti-back-setup" onClick={() => { setSourceDraft(JSON.parse(current.current)); setValidated(validated && current.current === saved.current); setStage("setup"); }}><ArrowLeft size={16} /> Salariés et coordonnées</button>}
        <IntegrationPreviewStudio
          key={sourceReset}
          embedded
          initialDraft={sourceDraft}
          initialValidated={validated}
          clientName={context.client_name}
          onDirty={(value) => {
            current.current = value;
          }}
          validateDraft={(draft) => persist(draft, true)}
          saveDraft={(draft) => persist(draft, false)}
          onContinue={context.nextAction ? () => {
            setStage("contract");
            dialog.current?.scrollTo({ top: 0, behavior: "instant" });
            requestAnimationFrame(() => document.getElementById("ti-review-title")?.focus());
          } : onClose}
        /></>}
      </section>
    </div>,
    document.body,
  );
}
