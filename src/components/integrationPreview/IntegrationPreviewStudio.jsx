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
  MISSION_OPTIONS,
  WEATHER_LABELS,
} from "./model";
import "./integrationPreview.css";

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
export default function IntegrationPreviewStudio({ validateDraft }) {
  const [draft, setDraft] = useState(readDraft),
    [step, setStep] = useState(0),
    [future, setFuture] = useState(false),
    [view, setView] = useState("form");
  const [validated, setValidated] = useState(null),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(null),
    [booking, setBooking] = useState("");
  const heading = useRef(null);
  const { companies, directors, checks } = completeness(draft);
  const count = checks.filter((c) => c.done).length;
  const ready = validated === JSON.stringify(draft);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(draft));
    } catch {}
    setFeedback(null);
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
    setBusy(true);
    setFeedback(null);
    try {
      const result = await validateDraft(draft);
      if (result.ready) {
        setValidated(JSON.stringify(draft));
        setFeedback({
          success: true,
          text: "Fiche validée. Le parcours est prêt à être testé.",
        });
        setStep(3);
      } else setFeedback({ success: false, text: result.errors.join(" ") });
    } catch {
      setFeedback({
        success: false,
        text: "La validation n’a pas abouti. Réessayez dans un instant.",
      });
    } finally {
      setBusy(false);
    }
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
    <div className="integration-preview">
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
        <section className="ip-control" aria-label="Simulation de la bascule">
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
            <span className="ip-demo-dot" /> Dossier de démonstration · données
            fictives
          </span>
          <span>Aucune activation réelle ni automatique</span>
        </div>
        <div className="ip-workspace">
          <div className="ip-main">
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
            {view === "form" ? (
              <>
                <nav className="ip-steps" aria-label="Étapes de la fiche">
                  {STEPS.map((s, i) => (
                    <button
                      key={s}
                      aria-current={step === i ? "step" : undefined}
                      onClick={() => goStep(i)}
                    >
                      <span>{i + 1}</span>
                      {s}
                    </button>
                  ))}
                </nav>
                <section className="ip-panel" key={step}>
                  <div className="ip-section-head">
                    <span className="ip-section-number">0{step + 1}</span>
                    <div>
                      <h2 ref={heading} tabIndex={-1}>
                        {
                          [
                            "Définir le périmètre",
                            "Passer le relais",
                            "Prendre la température",
                            "Une vue claire pour démarrer",
                          ][step]
                        }
                      </h2>
                      <p>
                        {
                          [
                            "Confirmez les structures et les personnes que nous allons accompagner.",
                            "Transmettez ce que le client attend et ce qui a été discuté pendant la vente.",
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
                        <span>Préremplies depuis le NDA de démonstration</span>
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
                                placeholder="SIREN — non renseigné dans cet exemple"
                                value={c.siren}
                                onChange={(e) =>
                                  updateCompany(c.id, "siren", e.target.value)
                                }
                              />
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
                              role: "",
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
                    <>
                      <Field
                        label="Priorité du client"
                        value={draft.priorities}
                        onChange={(v) => change("priorities", v)}
                        placeholder="Quel problème souhaite-t-il résoudre en premier ?"
                        multiline
                      />
                      <div className="ip-block-title">
                        <h3>
                          <BriefcaseBusiness size={19} /> Missions potentielles
                        </h3>
                        <span>Recommandations du commercial</span>
                      </div>
                      <div className="ip-mission-options">
                        {MISSION_OPTIONS.map((m) => (
                          <button
                            key={m}
                            aria-pressed={draft.missions.includes(m)}
                            onClick={() =>
                              change(
                                "missions",
                                draft.missions.includes(m)
                                  ? draft.missions.filter((x) => x !== m)
                                  : [...draft.missions, m],
                              )
                            }
                          >
                            {draft.missions.includes(m) ? (
                              <Check size={15} />
                            ) : (
                              <Plus size={15} />
                            )}{" "}
                            {m}
                          </button>
                        ))}
                      </div>
                      <Field
                        label="Précisions sur les missions"
                        multiline
                        value={draft.mission_notes}
                        onChange={(v) => change("mission_notes", v)}
                        placeholder="Contexte, besoin évoqué, point à approfondir…"
                      />
                      <div className="ip-fields-two">
                        <Field
                          label="Résultat attendu dans les prochains mois"
                          value={draft.objective}
                          onChange={(v) => change("objective", v)}
                          placeholder="Ce qui ferait un démarrage réussi"
                        />
                        <Field
                          label="Échéance importante"
                          type="date"
                          value={draft.deadline}
                          onChange={(v) => change("deadline", v)}
                        />
                      </div>
                      <details className="ip-details">
                        <summary>
                          Accompagnement actuel et organisation{" "}
                          <Plus size={17} />
                        </summary>
                        <div className="ip-fields-two">
                          <Field
                            label="Expert-comptable"
                            value={draft.accountant}
                            onChange={(v) => change("accountant", v)}
                            placeholder="Nom / cabinet, si connu"
                          />
                          <Field
                            label="Gestion de la paie"
                            value={draft.payroll}
                            onChange={(v) => change("payroll", v)}
                            placeholder="Prestataire ou gestion interne"
                          />
                          <Field
                            label="Conseil juridique actuel"
                            value={draft.legal}
                            onChange={(v) => change("legal", v)}
                            placeholder="Interlocuteur, si connu"
                          />
                          <Field
                            label="Contact privilégié"
                            value={draft.contact}
                            onChange={(v) => change("contact", v)}
                            placeholder="Personne qui suivra les échanges"
                          />
                        </div>
                        <Field
                          label="Préférences de communication"
                          value={draft.preferences}
                          onChange={(v) => change("preferences", v)}
                          placeholder="Disponibilités, canal préféré…"
                        />
                      </details>
                      <Field
                        label="Notes du commercial"
                        value={draft.notes}
                        onChange={(v) => change("notes", v)}
                        multiline
                        placeholder="Les éléments utiles pour comprendre le client et assurer la continuité de la relation."
                      />
                      <p className="ip-field-hint">
                        Notes internes transmises à l’équipe d’accompagnement.
                      </p>
                    </>
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
                    <div className="ip-summary">
                      <div className="ip-summary-title">
                        <div>
                          <span>FICHE DE TRANSMISSION</span>
                          <h3>Atelier Horizon</h3>
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
                            {draft.weather ? (
                              <>
                                {draft.weather}
                                <small>/5</small>
                              </>
                            ) : (
                              "—"
                            )}
                          </strong>
                          <span>Météo initiale</span>
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
                      {draft.priorities && (
                        <>
                          <h4>Priorité du client</h4>
                          <p>{draft.priorities}</p>
                        </>
                      )}
                      {!!draft.missions.length && (
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
                        ["Préférences de communication", draft.preferences],
                      ]
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k}>
                            <h4>{k}</h4>
                            <p>{v}</p>
                          </div>
                        ))}
                      {draft.weather && (
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
                        Démonstration Owner · Données fictives · Proposition à
                        valider avec Paul
                      </div>
                      <button
                        className="ip-secondary ip-print-button"
                        onClick={() => window.print()}
                      >
                        <Printer size={17} /> Imprimer la fiche
                      </button>
                    </div>
                  )}
                  <div className="ip-step-footer">
                    <button
                      className="ip-text-button"
                      disabled={step === 0}
                      onClick={() => goStep(step - 1)}
                    >
                      <ArrowLeft size={16} /> Retour
                    </button>
                    {step < 3 ? (
                      <button
                        className="ip-primary"
                        onClick={() => goStep(step + 1)}
                      >
                        Continuer
                        <ArrowRight size={17} />
                      </button>
                    ) : (
                      <button
                        className="ip-primary"
                        disabled={busy}
                        onClick={validate}
                      >
                        {busy ? (
                          <LoaderCircle size={18} className="ip-spin" />
                        ) : (
                          <Check size={18} />
                        )}{" "}
                        Valider la fiche
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
                {ready ? "Fiche validée" : `${count} sur 3`}
                <span>
                  {ready
                    ? "Le relais est prêt."
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
              <button className="ip-primary" disabled={busy} onClick={validate}>
                {busy ? (
                  <LoaderCircle size={17} className="ip-spin" />
                ) : (
                  <Check size={17} />
                )}{" "}
                Valider la fiche
              </button>
            </section>
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
