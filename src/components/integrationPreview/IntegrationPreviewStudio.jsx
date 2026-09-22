import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Users,
  Check,
  Plus,
  Trash2,
  CloudSun,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  FileCheck2,
  CalendarDays,
  ShieldCheck,
  RotateCcw,
  Printer,
  CheckCircle2,
  LockKeyhole,
  LoaderCircle,
  NotebookPen,
  BriefcaseBusiness,
  FlaskConical,
  Send,
  X,
} from "lucide-react";
import {
  completeness,
  freshDraft,
  WEATHER_LABELS,
} from "./model";
import "./integrationPreview.css";
import { uniqueCompanies, applyCompanyLookup, companySiren } from './companies';

const STORAGE = "owner-integration-preview-v1";
const STEPS = ["Périmètre", "Transmission", "Météo client", "Synthèse"];
const WEATHER_ICONS = [CloudLightning, CloudRain, Cloud, CloudSun, Sun];
const readDraft = () => {
  try {
    const d = JSON.parse(sessionStorage.getItem(STORAGE));
    if (
      d?.companies?.length &&
      Array.isArray(d.directors) &&
      Array.isArray(d.missions)
    )
      return { ...freshDraft(), ...d };
  } catch {}
  return freshDraft();
};
function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  type = "text",
}) {
  const id = label.replaceAll(" ", "-");
  return (
    <label className="ip-field" htmlFor={id}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          maxLength={2000}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          maxLength={2000}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
export function IntegrationSummary({ draft, clientName, validated = false, embedded = true, phase = "full" }) {
  const { companies, directors } = completeness(draft);
  const ready = validated;
  const WeatherIcon = WEATHER_ICONS[(draft.weather || 3) - 1];
  return (
<div className="ip-summary">
                      <div className="ip-summary-title">
                        <div>
                          <span>FICHE DE TRANSMISSION</span>
                          <h3>{clientName}</h3>
                        </div>
                        <span className="ip-pill">
                          {ready ? "Validée" : "Brouillon"}
                        </span>
                      </div>
                      <div className="ip-summary-metrics">
                        <div>
                          <strong>{companies.length}</strong>
                          <span>Sociétés accompagnées</span>
                        </div>
                        <div>
                          <strong>{directors.length}</strong>
                          <span>Dirigeants accompagnés</span>
                        </div>
                        <div>
                          <strong>
                            {phase === "contract" ? directors.filter(d => d.provisional_access).length : draft.weather ? (
                              <>
                                {draft.weather}
                                <small>/5</small>
                              </>
                            ) : (
                              "—"
                            )}
                          </strong>
                          <span>{phase === "contract" ? "Accès sélectionnés" : "Météo initiale"}</span>
                        </div>
                      </div>
                      <h4>Périmètre d’accompagnement</h4>
                      {companies.map((c) => (
                        <div className="ip-summary-row" key={c.id}>
                          <Building2 size={17} />
                          <div>
                            <strong>{c.name || "Nom à renseigner"}</strong>
                            <p>
                              {directors
                                .filter((d) => d.companies.includes(c.id))
                                .map((d) => d.name)
                                .join(" · ") || "Dirigeant à renseigner"}
                            </p>
                          </div>
                        </div>
                      ))}
                      {phase !== "contract" && <div className="ip-handoff-summary">
                        <h4>Situation personnelle des dirigeants</h4>
                        <p>{draft.personal_situation || "Non renseignée"}</p>
                        <h4>Situation professionnelle des dirigeants</h4>
                        <p>{draft.professional_situation || "Non renseignée"}</p>
                      </div>}
                      {phase === "contract" && <div className="ip-soft-note"><LockKeyhole size={20} /><p>{directors.filter(d => d.provisional_access).length} accès provisoire(s) sélectionné(s). Les dirigeants non sélectionnés restent associés au dossier, sans compte. Le passage de relais et la météo seront complétés à la déclaration.</p></div>}
                      {draft.priorities && (
                        <>
                          <h4>Priorité du client</h4>
                          <p>{draft.priorities}</p>
                        </>
                      )}
                      {!!draft.missions?.length && (
                        <>
                          <h4>Missions recommandées</h4>
                          <div className="ip-summary-tags">
                            {draft.missions.map((m) => (
                              <span key={m}>{m}</span>
                            ))}
                          </div>
                        </>
                      )}
                      {draft.mission_notes && <p>{draft.mission_notes}</p>}
                      {draft.objective && (
                        <>
                          <h4>Résultat attendu</h4>
                          <p>{draft.objective}</p>
                        </>
                      )}
                      {draft.deadline && (
                        <>
                          <h4>Échéance importante</h4>
                          <p>
                            {new Date(
                              draft.deadline + "T12:00:00",
                            ).toLocaleDateString("fr-FR")}
                          </p>
                        </>
                      )}
                      {[
                        ["Expert-comptable", draft.accountant],
                        ["Gestion de la paie", draft.payroll],
                        ["Conseil juridique", draft.legal],
                        ["Contact privilégié", draft.contact],
                      ]
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k}>
                            <h4>{k}</h4>
                            <p>{v}</p>
                          </div>
                        ))}
                      {phase !== "contract" && draft.weather && (
                        <>
                          <h4>Météo client</h4>
                          <div className="ip-summary-weather">
                            <WeatherIcon size={29} />
                            <div>
                              <strong>
                                {WEATHER_LABELS[draft.weather - 1]}
                              </strong>
                              {draft.weather_note && (
                                <p>{draft.weather_note}</p>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                      {draft.notes && (
                        <>
                          <h4>Notes du commercial</h4>
                          <p>{draft.notes}</p>
                        </>
                      )}
                      <div className="ip-print-footer">
                        {embedded
                          ? "Owner · Fiche de transmission commerciale"
                          : "Démonstration Owner · Données fictives"}
                      </div>
                      <button
                        className="ip-secondary ip-print-button"
                        onClick={() => window.print()}
                      >
                        <Printer size={17} /> Imprimer la fiche
                      </button>
                    </div>
  );
}

export default function IntegrationPreviewStudio({
  validateDraft,
  embedded = false,
  initialDraft,
  initialValidated = false,
  clientName = "Atelier Horizon",
  saveDraft,
  onContinue,
  onDirty = () => {},
  lookupCompany,
  phase = "full",
  accessLocked = false,
  continueLabel,
}) {
  const stepIds = phase === "contract" ? [0, 3] : [0, 1, 2, 3];
  const [draft, setDraft] = useState(() => uniqueCompanies(initialDraft || readDraft())),
    [step, setStep] = useState(0),
    [future, setFuture] = useState(false),
    [view, setView] = useState("form");
  const [validated, setValidated] = useState(
      initialValidated ? JSON.stringify(initialDraft) : null,
    ),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(null),
    [booking, setBooking] = useState("");
  const heading = useRef(null);
  const lookupPending = useRef(false);
  const alive = useRef(true);
  const [companyLookup, setCompanyLookup] = useState(null);
  const [companyError, setCompanyError] = useState(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function retrieveCompany(company) {
    if (!lookupCompany || lookupPending.current || busy) return;
    if (company.in_registration) return;
    const siren = companySiren(company.siren);
    if (!siren || String(company.siren).replace(/\s/g, '').length !== 9) {
      setCompanyError({ id: company.id, message: 'Saisissez le SIREN à 9 chiffres de la société, pas le SIRET d’un établissement.' });
      return;
    }
    lookupPending.current = true;
    setCompanyLookup(company.id); setCompanyError(null); setValidated(null);
    try {
      const data = await lookupCompany(siren);
      if (!alive.current) return;
      if (companySiren(data?.siren) !== siren || !data?.legal_name?.trim()) throw new Error('Aucune société trouvée pour ce SIREN. Vérifiez le numéro.');
      setDraft(current => applyCompanyLookup(current, company.id, siren, data, () => crypto.randomUUID()));
      setValidated(null);
    } catch (error) {
      if (alive.current) setCompanyError({ id: company.id, message:
        error?.status === 404 ? 'Aucune société trouvée pour ce SIREN. Vérifiez le numéro.' :
        [400, 422].includes(error?.status) ? 'Ce SIREN est invalide. Vérifiez les 9 chiffres de la société.' :
        'Recherche Pappers indisponible. Vos informations sont conservées ; réessayez.' });
    } finally {
      lookupPending.current = false;
      if (alive.current) setCompanyLookup(null);
    }
  }
  const { companies, directors, checks } = completeness(draft);
  const count = checks.filter((c) => c.done).length;
  const ready = validated === JSON.stringify(draft);
  useEffect(() => {
    try {
      if (!embedded) sessionStorage.setItem(STORAGE, JSON.stringify(draft));
    } catch {}
    setFeedback(null);
    onDirty(JSON.stringify(draft));
  }, [draft]);
  const change = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setValidated(null);
  };
  const updateCompany = (id, key, value) =>
    change(
      "companies",
      draft.companies.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    );
  const updateDirector = (id, key, value) =>
    change(
      "directors",
      draft.directors.map((d) => (d.id === id ? { ...d, [key]: value } : d)),
    );
  const goStep = (n) => {
    setStep(n);
    setView("form");
    setTimeout(() => heading.current?.focus(), 0);
  };
  const reset = () => {
    setDraft(freshDraft());
    setValidated(null);
    setFeedback(null);
    setBooking("");
    setFuture(false);
    setStep(0);
    setView("form");
  };
  const validate = async () => {
    if (lookupPending.current || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await validateDraft(draft);
      if (result.ready) {
        setValidated(JSON.stringify(draft));
        setFeedback({
          success: true,
          text: embedded
            ? "Périmètre enregistré. Vous pouvez poursuivre vers le contrat ; le passage de relais sera complété à la déclaration."
            : "Fiche validée. Le parcours est prêt à être testé.",
        });
        setStep(3);
      } else setFeedback({ success: false, text: result.errors.join(" ") });
    } catch (error) {
      setFeedback({
        success: false,
        text:
          error?.message ||
          "La validation n’a pas abouti. Réessayez dans un instant.",
      });
    } finally {
      setBusy(false);
    }
  };
  const advance = async () => {
    if (busy) return;
    setBusy(true);
    try { await onContinue(); }
    catch (error) { setFeedback({success: false, text: error.message || "Impossible de poursuivre. Réessayez."}); }
    finally { setBusy(false); }
  };
  const send = () => {
    if (future && !ready) {
      setFeedback({
        success: false,
        text: "Envoi bloqué : validez la fiche d’intégration avant d’envoyer le contrat.",
      });
      return;
    }
    setFeedback({
      success: true,
      text: "Envoi simulé avec succès. Aucun contrat ni email n’a été envoyé.",
    });
  };
  const WeatherIcon = WEATHER_ICONS[(draft.weather || 3) - 1];
  return (
    <div className={`integration-preview ${embedded ? "ip-embedded" : ""}`}>
      {!embedded && (
        <div className="ip-studio-bar">
          <a href="/ceo" aria-label="Retour au dashboard">
            <ArrowLeft size={17} />
            <strong>OWNER</strong>
          </a>
          <span>
            <FlaskConical size={15} /> Espace privé · Sales de test
          </span>
          <div>
            <button onClick={reset}>
              <RotateCcw size={15} /> Réinitialiser
            </button>
            <span className="ip-live-state">
              <span /> Système actuel conservé
            </span>
          </div>
        </div>
      )}
      <main className="ip-shell">
        <header className="ip-page-head">
          <div>
            <div className="ip-eyebrow">PARCOURS CLIENT / AVANT SIGNATURE</div>
            <h1>
              Fiche d’intégration Owner<span>.</span>
            </h1>
            <p>Les bonnes informations, dès le premier jour.</p>
          </div>
          <button
            className="ip-secondary"
            onClick={() => {
              setStep(3);
              setView("form");
            }}
          >
            <FileCheck2 size={18} /> Voir la synthèse
          </button>
        </header>
        {!embedded && (
          <>
            <section
              className="ip-control"
              aria-label="Simulation de la bascule"
            >
              <div className="ip-control-icon">
                <ShieldCheck size={22} />
              </div>
              <div>
                <strong>
                  {future
                    ? "Nouveau parcours activé dans le test"
                    : "Préparation de la bascule"}
                </strong>
                <p>
                  {future
                    ? "Fiche obligatoire avant contrat · un seul rendez-vous onboarding."
                    : "Testez le futur parcours avant sa validation avec Paul."}
                </p>
              </div>
              <button
                className={future ? "ip-secondary" : "ip-primary"}
                aria-pressed={future}
                onClick={() => {
                  setFuture((v) => !v);
                  setFeedback(null);
                }}
              >
                {future ? "Revenir au parcours actuel" : "Simuler la bascule"}
                <ArrowRight size={17} />
              </button>
            </section>
            <div className="ip-demo-line">
              <span>
                <span className="ip-demo-dot" /> Dossier de démonstration ·
                données fictives
              </span>
              <span>Aucune activation réelle ni automatique</span>
            </div>
          </>
        )}
        <div className="ip-workspace">
          <div className="ip-main">
            {!embedded && (
              <div
                className="ip-workspace-tabs"
                role="tablist"
                aria-label="Parcours de test"
              >
                <button
                  role="tab"
                  aria-selected={view === "form"}
                  onClick={() => setView("form")}
                >
                  <NotebookPen size={17} /> Fiche commerciale
                </button>
                <button
                  role="tab"
                  aria-selected={view === "calendar"}
                  onClick={() => setView("calendar")}
                >
                  <CalendarDays size={17} /> Rendez-vous
                </button>
              </div>
            )}
            {view === "form" ? (
              <>
                <nav className="ip-steps" aria-label="Étapes de la fiche">
                  {stepIds.map((i, index) => (
                    <button
                      key={i}
                      aria-current={step === i ? "step" : undefined}
                      onClick={() => goStep(i)}
                    >
                      <span>{index + 1}</span>
                      {STEPS[i]}
                    </button>
                  ))}
                </nav>
                <section className="ip-panel" key={step}>
                  <div className="ip-section-head">
                    <span className="ip-section-number">0{stepIds.indexOf(step) + 1}</span>
                    <div>
                      <h2 ref={heading} tabIndex={-1}>
                        {
                          [
                            "Définir le périmètre",
                            "Passage de relais",
                            "Prendre la température",
                            "Une vue claire pour démarrer",
                          ][step]
                        }
                      </h2>
                      <p>
                        {
                          [
                            "Confirmez les structures et les personnes que nous allons accompagner.",
                            "Deux commentaires pour transmettre le contexte des dirigeants.",
                            "Votre première appréciation de la relation avec le client.",
                            "Les informations essentielles pour Vincent, la facturation et le cabinet.",
                          ][step]
                        }
                      </p>
                    </div>
                  </div>
                  {step === 0 && (
                    <>
                      <div className="ip-block-title">
                        <h3>
                          <Building2 size={19} /> Sociétés
                        </h3>
                        <span>
                          {embedded
                            ? "Une société par SIREN · établissements regroupés"
                            : "Préremplies depuis le NDA de démonstration"}
                        </span>
                      </div>
                      <div className="ip-company-list">
                        {draft.companies.map((c) => (
                          <div
                            className={`ip-company ${c.selected ? "" : "is-excluded"}`}
                            key={c.id}
                          >
                            <input
                              aria-label={`Accompagner ${c.name || "cette société"}`}
                              type="checkbox"
                              checked={c.selected}
                              onChange={(e) =>
                                updateCompany(
                                  c.id,
                                  "selected",
                                  e.target.checked,
                                )
                              }
                            />
                            <div className="ip-company-icon">
                              <Building2 size={20} />
                            </div>
                            <div>
                              <input
                                className="ip-inline-name"
                                aria-label="Nom de la société"
                                maxLength={200}
                                value={c.name}
                                onChange={(e) =>
                                  updateCompany(c.id, "name", e.target.value)
                                }
                              />
                              <input
                                className="ip-inline-meta"
                                aria-label={`SIREN ${c.name}`}
                                maxLength={20}
                                placeholder={embedded ? "SIREN de la société · 9 chiffres" : "SIREN — non renseigné dans cet exemple"}
                                disabled={!!c.in_registration}
                                value={c.siren}
                                onChange={(e) =>
                                  updateCompany(c.id, "siren", e.target.value)
                                }
                              />
                              {phase === "contract" && <label className="ip-registration"><input type="checkbox" checked={!!c.in_registration} onChange={e => change("companies", draft.companies.map(row => row.id === c.id ? {...row, in_registration: e.target.checked, siren: e.target.checked ? "" : row.siren} : row))} />En cours d’immatriculation</label>}
                              {lookupCompany && !c.in_registration && <div className="ip-company-lookup">
                                <button type="button" disabled={busy || !!companyLookup} onClick={() => retrieveCompany(c)}>
                                  {companyLookup === c.id ? <LoaderCircle size={14} className="ip-spin" /> : <Building2 size={14} />}
                                  {companyLookup === c.id ? 'Recherche…' : 'Récupérer depuis Pappers'}
                                </button>
                                {companyError?.id === c.id && <span role="alert">{companyError.message}</span>}
                              </div>}
                            </div>
                            <span className="ip-pill">
                              {c.selected ? "Accompagnée" : "Hors périmètre"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        className="ip-text-button"
                        disabled={draft.companies.length >= 40}
                        onClick={() =>
                          change("companies", [
                            ...draft.companies,
                            {
                              id: crypto.randomUUID(),
                              name: "",
                              siren: "",
                              selected: true,
                            },
                          ])
                        }
                      >
                        <Plus size={16} /> Ajouter une société
                      </button>
                      <div className="ip-block-title ip-spaced">
                        <h3>
                          <Users size={19} /> Dirigeants
                        </h3>
                        <span>Une personne, même sur plusieurs sociétés</span>
                      </div>
                      {draft.directors.map((d) => (
                        <div className="ip-director" key={d.id}>
                          <div className="ip-director-top">
                            <span className="ip-avatar">
                              {d.name
                                .trim()
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("") || "+"}
                            </span>
                            <div>
                              <input
                                aria-label="Nom du dirigeant"
                                placeholder="Prénom et nom"
                                maxLength={200}
                                value={d.name}
                                onChange={(e) =>
                                  updateDirector(d.id, "name", e.target.value)
                                }
                              />
                              <input
                                aria-label={`Fonction ${d.name}`}
                                placeholder="Fonction"
                                maxLength={100}
                                value={d.role}
                                onChange={(e) =>
                                  updateDirector(d.id, "role", e.target.value)
                                }
                              />
                            </div>
                            <button
                              className="ip-icon-button"
                              aria-label={`Retirer ${d.name || "ce dirigeant"}`}
                              disabled={accessLocked && d.provisional_access}
                              onClick={() =>
                                change(
                                  "directors",
                                  draft.directors.filter((p) => p.id !== d.id),
                                )
                              }
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                          {phase === "contract" && <section className={`ip-director-access ${d.provisional_access ? "is-active" : ""}`}>
                            <label><input type="checkbox" checked={!!d.provisional_access} disabled={accessLocked} onChange={e => updateDirector(d.id, "provisional_access", e.target.checked)} /><LockKeyhole size={18} /><span><strong>Ouvrir un compte provisoire · 15 jours</strong><small>{d.provisional_access ? "Accès nominatif, conservé à la déclaration de vente." : "Dirigeant associé au dossier, sans accès à l’espace client."}</small></span></label>
                            {d.provisional_access && <label className="ip-field"><span>Email personnel de connexion · obligatoire</span><input type="email" autoComplete="off" maxLength={254} value={d.email || ""} disabled={accessLocked} placeholder="prenom.nom@entreprise.fr" onChange={e => updateDirector(d.id, "email", e.target.value)} /></label>}
                            {accessLocked && <small>Demande d’accès déjà enregistrée. Le choix est conservé pour éviter tout doublon.</small>}
                          </section>}
                          <div className="ip-company-tags">
                            {companies.map((c) => (
                              <label key={c.id}>
                                <input
                                  type="checkbox"
                                  checked={d.companies.includes(c.id)}
                                  onChange={(e) =>
                                    updateDirector(
                                      d.id,
                                      "companies",
                                      e.target.checked
                                        ? [...d.companies, c.id]
                                        : d.companies.filter(
                                            (id) => id !== c.id,
                                          ),
                                    )
                                  }
                                />
                                {c.name || "Nouvelle société"}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        className="ip-text-button"
                        disabled={draft.directors.length >= 40}
                        onClick={() =>
                          change("directors", [
                            ...draft.directors,
                            {
                              id: crypto.randomUUID(),
                              name: "",
                              role: "", email: "", provisional_access: false,
                              companies: [],
                            },
                          ])
                        }
                      >
                        <Plus size={16} /> Ajouter un dirigeant
                      </button>
                    </>
                  )}
                  {step === 1 && (
                    <div className="ip-handoff-comments">
                      <section>
                        <h3>Informations personnelles</h3>
                        <Field label="Situation personnelle des dirigeants"
                          value={draft.personal_situation || ""}
                          onChange={v => change("personal_situation", v)} multiline
                          placeholder="Les éléments partagés par les dirigeants qui sont utiles à leur accompagnement…" />
                      </section>
                      <section>
                        <h3>Informations professionnelles</h3>
                        <Field label="Situation professionnelle des dirigeants"
                          value={draft.professional_situation || ""}
                          onChange={v => change("professional_situation", v)} multiline
                          placeholder="Activité, organisation, projets et besoins évoqués pendant l’échange…" />
                      </section>
                    </div>
                  )}
                  {step === 2 && (
                    <>
                      <div className="ip-weather-intro">
                        <div>
                          <CloudSun size={36} strokeWidth={1.6} />
                        </div>
                        <h3>Comment le client aborde-t-il la suite ?</h3>
                        <p>Choisissez la note qui reflète votre échange.</p>
                      </div>
                      <div className="ip-weather-options">
                        {WEATHER_ICONS.map((Icon, i) => (
                          <button
                            key={i}
                            aria-pressed={draft.weather === i + 1}
                            onClick={() => change("weather", i + 1)}
                          >
                            <Icon size={34} strokeWidth={1.6} />
                            <strong>
                              {i + 1}
                              <small>/5</small>
                            </strong>
                            <span>{WEATHER_LABELS[i]}</span>
                          </button>
                        ))}
                      </div>
                      <Field
                        label="Ce qui explique cette note"
                        multiline
                        value={draft.weather_note}
                        onChange={(v) => change("weather_note", v)}
                        placeholder="Attentes, points de vigilance ou signes de confiance observés…"
                      />
                      <div className="ip-soft-note">
                        <ShieldCheck size={18} />
                        <p>
                          Cette première météo permet à l’équipe de poursuivre
                          la relation avec le bon contexte.
                        </p>
                      </div>
                    </>
                  )}
                  {step === 3 && (
                    <IntegrationSummary draft={draft} clientName={clientName} validated={ready} embedded={embedded} phase={phase} />
                  )}
                  <div className="ip-step-footer">
                    <button
                      className="ip-text-button"
                      disabled={step === 0}
                      onClick={() => goStep(stepIds[stepIds.indexOf(step) - 1])}
                    >
                      <ArrowLeft size={16} /> Retour
                    </button>
                    {step < 3 ? (
                      <button
                        className="ip-primary"
                        onClick={() => goStep(stepIds[stepIds.indexOf(step) + 1])}
                      >
                        Continuer
                        <ArrowRight size={17} />
                      </button>
                    ) : (
                      <button
                        className="ip-primary"
                        disabled={busy || !!companyLookup}
                        onClick={ready && onContinue ? advance : validate}
                      >
                        {busy ? (
                          <LoaderCircle size={18} className="ip-spin" />
                        ) : (
                          <Check size={18} />
                        )}{" "}
                        {ready && onContinue ? (continueLabel || "Continuer vers le contrat") : (phase === "contract" ? "Valider le périmètre" : "Valider la fiche")}
                      </button>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <section className="ip-panel ip-calendar">
                <div className="ip-section-head">
                  <span className="ip-section-number">
                    <CalendarDays size={24} />
                  </span>
                  <div>
                    <h2>Les rendez-vous de démarrage</h2>
                    <p>
                      {future
                        ? "Un rendez-vous unique pour lancer l’accompagnement."
                        : "Le parcours actuellement proposé aux sales."}
                    </p>
                  </div>
                </div>
                <article>
                  <span className="ip-calendar-icon">
                    <CalendarDays size={26} />
                  </span>
                  <div>
                    <span className="ip-eyebrow">OWNER</span>
                    <h3>Onboarding & facturation</h3>
                    <p>Vincent · Équipe facturation</p>
                    <label className="ip-field">
                      <span>Créneau de démonstration</span>
                      <select
                        value={booking}
                        onChange={(e) => setBooking(e.target.value)}
                      >
                        <option value="">Choisir un créneau</option>
                        <option>Mardi 22 septembre · 10:00</option>
                        <option>Mercredi 23 septembre · 14:00</option>
                        <option>Jeudi 24 septembre · 11:00</option>
                      </select>
                    </label>
                    {booking && (
                      <span className="ip-booking-confirmation">
                        <CheckCircle2 size={16} /> Créneau sélectionné dans le
                        test
                      </span>
                    )}
                  </div>
                </article>
                {!future && (
                  <article>
                    <span className="ip-calendar-icon">
                      <BriefcaseBusiness size={26} />
                    </span>
                    <div>
                      <span className="ip-eyebrow">CABINET PARTENAIRE</span>
                      <h3>Rendez-vous d’intégration</h3>
                      <p>Lisa · Opti’Lex</p>
                      <span className="ip-pill">Parcours actuel</span>
                    </div>
                  </article>
                )}
                <div className="ip-soft-note">
                  <FlaskConical size={18} />
                  <p>
                    Les créneaux de cet espace sont fictifs. Aucun événement
                    n’est créé dans les agendas.
                  </p>
                </div>
              </section>
            )}
          </div>
          <aside className="ip-aside">
            <section className="ip-readiness">
              <div className="ip-aside-title">
                <span className="ip-overline">PRÊT POUR LA SIGNATURE</span>
                <FileCheck2 size={21} />
              </div>
              <div className="ip-readiness-value">
                {ready ? (phase === "contract" ? "Périmètre validé" : "Fiche validée") : `${count} sur 3`}
                <span>
                  {ready
                    ? (phase === "contract" ? "Le contrat peut être préparé." : "Le relais est prêt.")
                    : "informations essentielles renseignées"}
                </span>
              </div>
              <div className="ip-progress">
                <span style={{ width: `${(count / 3) * 100}%` }} />
              </div>
              <ul>
                {checks.map((c) => (
                  <li key={c.label} className={c.done ? "is-done" : ""}>
                    {c.done ? (
                      <CheckCircle2 size={19} />
                    ) : (
                      <span className="ip-empty-check" />
                    )}
                    {c.label}
                  </li>
                ))}
              </ul>
              <div className="ip-aside-counts">
                <div>
                  <Building2 size={17} />
                  <strong>{companies.length}</strong>
                  <span>sociétés</span>
                </div>
                <div>
                  <Users size={17} />
                  <strong>{directors.length}</strong>
                  <span>dirigeants</span>
                </div>
              </div>
              <button className="ip-primary" disabled={busy || !!companyLookup} onClick={ready && onContinue ? advance : validate}>
                {busy ? (
                  <LoaderCircle size={17} className="ip-spin" />
                ) : (
                  <Check size={17} />
                )}{" "}
                {ready && onContinue ? (continueLabel || "Continuer vers le contrat") : (phase === "contract" ? "Valider le périmètre" : "Valider la fiche")}
              </button>
            </section>
            {!embedded && (
              <>
                <section className="ip-contract">
                  <div className="ip-block-title">
                    <h3>
                      <FileCheck2 size={19} /> Contrat Owner
                    </h3>
                  </div>
                  <span
                    className={`ip-contract-state ${future && !ready ? "" : "is-ready"}`}
                  >
                    {future && !ready ? (
                      <LockKeyhole size={15} />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}{" "}
                    {future
                      ? ready
                        ? "Prêt à envoyer"
                        : "Fiche à valider"
                      : "Parcours actuel"}
                  </span>
                  <p>
                    {future
                      ? "La fiche validée accompagne la préparation du contrat."
                      : "La fiche reste facultative tant que la bascule n’est pas activée."}
                  </p>
                  <button className="ip-secondary" onClick={send}>
                    <Send size={16} /> Tester l’envoi du contrat
                  </button>
                </section>
                <div className="ip-test-note">
                  <FlaskConical size={17} />
                  <p>
                    Profil provisoire de simulation.
                    <br />
                    Votre session habituelle est conservée.
                  </p>
                </div>
              </>
            )}
            {embedded && saveDraft && (
              <button
                className="ip-secondary"
                disabled={busy || !!companyLookup}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saveDraft(draft);
                    setValidated(null);
                    setFeedback({
                      success: true,
                      text: "Brouillon enregistré.",
                    });
                  } catch (error) {
                    setFeedback({
                      success: false,
                      text: error?.message || "Enregistrement impossible.",
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Enregistrer le brouillon
              </button>
            )}
          </aside>
        </div>
        {feedback && (
          <div
            className={`ip-feedback ${feedback.success ? "is-success" : ""}`}
            role={feedback.success ? "status" : "alert"}
          >
            <div>
              {feedback.success ? (
                <CheckCircle2 size={22} />
              ) : (
                <LockKeyhole size={22} />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              aria-label="Fermer le message"
              onClick={() => setFeedback(null)}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
