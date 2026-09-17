import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowLeft, FileCheck2, ShieldCheck } from "lucide-react";
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

export function IntegrationDialog({ context, onClose, onSaved }) {
  const [sourceDraft, setSourceDraft] = useState(context.draft);
  const [sourceReset, setSourceReset] = useState(0);
  const revision = useRef(context.revision);
  const saved = useRef(JSON.stringify(context.draft));
  const current = useRef(saved.current);
  const dialog = useRef(null);
  const close = () => {
    if (
      current.current !== saved.current &&
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
      if (current.current !== saved.current) {
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
                current.current = JSON.stringify(next);
                setSourceReset((n) => n + 1);
              }}
            >
              Reprendre le périmètre NDA
            </button>
          </p>
        )}
        <IntegrationPreviewStudio
          key={sourceReset}
          embedded
          initialDraft={sourceDraft}
          initialValidated={context.ready && !sourceReset}
          clientName={context.client_name}
          onDirty={(value) => {
            current.current = value;
          }}
          validateDraft={(draft) => persist(draft, true)}
          saveDraft={(draft) => persist(draft, false)}
        />
      </section>
    </div>,
    document.body,
  );
}
