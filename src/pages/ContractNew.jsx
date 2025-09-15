import { useEffect, useMemo, useState } from "react";
import { CompanySchema, normalizeSiren, isValidSiren } from "../contracts/schemas.js";
import { companyClause } from "../contracts/format.js";
import "./contract.css";

// UI shows EI instead of "Autre"
const LEGAL_FORMS = ["SARL", "SAS", "SASU", "SA", "EURL", "SCI", "EI"];

// New: business types list
const BUSINESS_TYPES = [
  "Ambulance",
  "Micro créche",
  "Dentiste",
  "Pharmacie",
  "Salle de sport",
  "Esthétique",
  "Batiment",
  "Tech",
  "Générale",
];

// Map UI value to what the schema expects
const toSchemaLegalForm = (lf) => (lf === "EI" ? "Autre" : lf);

export default function ContractNew() {
  const [company, setCompany] = useState({
    legalName: "",
    legalForm: "SARL",
    siren: "",
    rcsCity: "",
    email: "",
    phone: "",
    headOffice: { line1: "", postalCode: "", city: "", country: "France" },
    representatives: [{ fullName: "", role: "" }],
    // New: default business type
    businessType: "Générale",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [preview, setPreview] = useState("");
  const [step, setStep] = useState(0); // 0..4

  // ----- filename helpers -----
  const stripDiacritics = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safeAscii = (s = "") =>
    stripDiacritics(s).replace(/[^a-zA-Z0-9 _.\-]+/g, "").replace(/\s+/g, " ").trim();
  const computePdfFilename = (c) => {
    const repName = c?.representatives?.[0]?.fullName?.trim();
    const display = repName || c?.legalName || "Document";
    const base = `${display} - Clause de confidentialité`;
    return `${safeAscii(base) || "Clause de confidentialite"}.pdf`;
  };

  // ----- setters -----
  const markTouched = (path) => setTouched((t) => (t[path] ? t : { ...t, [path]: true }));

  const setField = (path, value) => {
    setCompany((prev) => {
      const next = structuredClone(prev);
      const parts = path.split(".");
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts.at(-1)] = value;

      // If switching to EI, clear RCS city since it's not applicable
      if (path === "legalForm" && value === "EI") {
        next.rcsCity = "";
      }
      return next;
    });
  };

  const setRep = (idx, key, val) => {
    setCompany((prev) => {
      const reps = [...prev.representatives];
      reps[idx] = { ...reps[idx], [key]: val };
      return { ...prev, representatives: reps };
    });
  };
  const addRep = () =>
    setCompany((prev) => ({
      ...prev,
      representatives: [...prev.representatives, { fullName: "", role: "" }],
    }));
  const removeRep = (idx) =>
    setCompany((prev) => ({
      ...prev,
      representatives: prev.representatives.filter((_, i) => i !== idx),
    }));

  // ----- central synchronous validation -----
  const buildValidation = (c) => {
    const flat = {};

    // light email / phone checks
    const email = (c.email || "").trim();
    if (!email) flat["email"] = "Email requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) flat["email"] = "Email invalide";

    const phone = (c.phone || "").trim();
    if (phone && !/^[\d+\s().-]{6,}$/.test(phone)) flat["phone"] = "Numéro invalide";

    // Remove the UI-only businessType from schema payload (in case schema is strict)
    const { businessType: _bt, ...rest } = c;

    // Prepare payload for schema: map EI -> Autre, blank RCS city if EI
    const cForSchema = {
      ...rest,
      legalForm: toSchemaLegalForm(c.legalForm),
      rcsCity: c.legalForm === "EI" ? "" : c.rcsCity,
    };

    const res = CompanySchema.safeParse(cForSchema);
    if (!res.success) {
      for (const issue of res.error.issues) {
        const key = issue.path.join(".");
        if (!flat[key]) flat[key] = issue.message;
      }
    }

    // EI: RCS city is not required — drop any error about it
    if (c.legalForm === "EI") delete flat["rcsCity"];

    const ok = Object.keys(flat).length === 0;

    // --- PREVIEW: keep the UI label "EI" so it displays (EI), and clean "au RCS de ,"
    const cForPreview = { ...cForSchema, legalForm: c.legalForm };
    let previewText = "";
    if (ok) {
      previewText = companyClause({ company: cForPreview });
      if (c.legalForm === "EI") {
        previewText = previewText.replace(/\s*au RCS de\s*,\s*/i, " ");
      }
    }

    return { ok, flat, previewText };
  };

  // keep state (errors + preview) in sync while typing
  const validateAndPreview = () => {
    const { ok, flat, previewText } = buildValidation(company);
    setErrors(flat);
    setPreview(previewText);
    return ok;
  };

  useEffect(() => {
    validateAndPreview();
    // eslint-disable-next-line
  }, [company]);

  // ----- steps -----
  const steps = useMemo(
    () => [
      { key: "identite", title: "Identité", fields: ["legalName", "legalForm", "siren", "rcsCity"] },
      { key: "contacts", title: "Contacts", fields: ["email", "phone"] },
      {
        key: "siege",
        title: "Siège social",
        fields: ["headOffice.line1", "headOffice.postalCode", "headOffice.city", "headOffice.country"],
      },
      { key: "reps", title: "Représentants", fields: [] },
      { key: "apercu", title: "Aperçu & PDF", fields: [] },
    ],
    []
  );

  const stepFields = steps[step].fields;

  const showErr = (key) => errors[key] && (touched[key] || showAllErrors);

  const normalizedSiren = normalizeSiren(company.siren);
  const showSirenWarning =
    (touched["siren"] || showAllErrors) &&
    normalizedSiren.length === 9 &&
    !isValidSiren(normalizedSiren) &&
    !errors["siren"];

  // use synchronous validation result here (no stale state)
  const isCurrentStepValid = () => {
    const { flat } = buildValidation(company);
    if (!stepFields.length) return true; // reps / preview steps
    const fieldsToCheck =
      company.legalForm === "EI" ? stepFields.filter((k) => k !== "rcsCity") : stepFields;
    return !fieldsToCheck.some((k) => flat[k]);
  };

  const goNext = () => {
    stepFields.forEach((k) => markTouched(k));
    if (!isCurrentStepValid()) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  const goTo = (idx) => setStep(idx);

  // ----- PDF -----
  const generatePdfDraft = async () => {
    const ok = validateAndPreview();
    if (!ok) {
      setShowAllErrors(true);
      alert("Corrige les erreurs avant de générer le PDF.");
      return;
    }
    try {
      // Strip UI-only field from server payload as well
      const { businessType: _bt, ...rest } = company;

      const payloadCompany = {
        ...rest,
        legalForm: toSchemaLegalForm(company.legalForm),
        rcsCity: company.legalForm === "EI" ? "" : company.rcsCity,
      };

      const resp = await fetch("/api/contract-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: payloadCompany }),
      });
      if (!resp.ok) {
        alert("Erreur génération PDF: " + (await resp.text()));
        return;
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = computePdfFilename(payloadCompany);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de la génération du PDF.");
    }
  };

  return (
    <div className="wizard-outer">
      <div className="wizard">
        {/* Left stepper */}
        <aside className="wizard-side">
          <div className="wizard-brand">OWNER</div>
          <div className="wizard-steps">
            {steps.map((s, i) => {
              const state = i < step ? "done" : i === step ? "active" : "todo";
              return (
                <button key={s.key} type="button" className={`step ${state}`} onClick={() => goTo(i)}>
                  <span className="bullet">{i + 1}</span>
                  <span className="label">{s.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Content */}
        <section className="wizard-content">
          <h1 className="contract-title">Clause de confidentialité</h1>
          <p className="contract-subtitle">Renseigne les infos de l’entreprise.</p>

          {/* STEP 0 — Identité */}
          {step === 0 && (
            <form>
              <label className="field">
                Raison sociale *
                <input
                  value={company.legalName}
                  onChange={(e) => setField("legalName", e.target.value)}
                  onBlur={() => markTouched("legalName")}
                  className="input"
                  placeholder="OWNER"
                />
                {showErr("legalName") && <span className="error">{errors["legalName"]}</span>}
              </label>

              <div className="grid2">
                <label className="field">
                  Forme juridique *
                  <select
                    value={company.legalForm}
                    onChange={(e) => setField("legalForm", e.target.value)}
                    onBlur={() => markTouched("legalForm")}
                    className="input"
                  >
                    {LEGAL_FORMS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  {showErr("legalForm") && <span className="error">{errors["legalForm"]}</span>}
                </label>

                <label className="field">
                  SIREN (9 chiffres) *
                  <input
                    value={company.siren}
                    onChange={(e) => setField("siren", e.target.value)}
                    onBlur={() => markTouched("siren")}
                    className="input"
                    placeholder="981 817 166"
                  />
                  {showErr("siren") && <span className="error">{errors["siren"]}</span>}
                  {showSirenWarning && <span className="warn">⚠️ SIREN non valide.</span>}
                </label>
              </div>

              {/* RCS city is only relevant if NOT EI */}
              {company.legalForm !== "EI" && (
                <label className="field">
                  Ville du RCS *
                  <input
                    value={company.rcsCity}
                    onChange={(e) => setField("rcsCity", e.target.value)}
                    onBlur={() => markTouched("rcsCity")}
                    className="input"
                    placeholder="Lille"
                  />
                  {showErr("rcsCity") && <span className="error">{errors["rcsCity"]}</span>}
                </label>
              )}
            </form>
          )}

          {/* STEP 1 — Contacts (phone below email) */}
          {step === 1 && (
            <form>
              <label className="field">
                Email (contact) *
                <input
                  type="email"
                  value={company.email}
                  onChange={(e) => setField("email", e.target.value)}
                  onBlur={() => markTouched("email")}
                  className="input"
                  placeholder="contact@domaine.com"
                />
                {showErr("email") && <span className="error">{errors["email"]}</span>}
              </label>

              <label className="field">
                Numéro (téléphone)
                <input
                  value={company.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  onBlur={() => markTouched("phone")}
                  className="input"
                  placeholder="+33 6 12 34 56 78"
                />
                {showErr("phone") && <span className="error">{errors["phone"]}</span>}
              </label>
            </form>
          )}

          {/* STEP 2 — Siège social */}
          {step === 2 && (
            <form>
              <fieldset className="card">
                <legend>Siège social *</legend>

                <label className="field">
                  Adresse (ligne 1)
                  <input
                    value={company.headOffice.line1}
                    onChange={(e) => setField("headOffice.line1", e.target.value)}
                    onBlur={() => markTouched("headOffice.line1")}
                    className="input"
                    placeholder="18 rue du commerce"
                  />
                  {showErr("headOffice.line1") && <span className="error">{errors["headOffice.line1"]}</span>}
                </label>

                <div className="grid2">
                  <label className="field">
                    Code postal
                    <input
                      value={company.headOffice.postalCode}
                      onChange={(e) => setField("headOffice.postalCode", e.target.value)}
                      onBlur={() => markTouched("headOffice.postalCode")}
                      className="input"
                      placeholder="59000"
                    />
                    {showErr("headOffice.postalCode") && (
                      <span className="error">{errors["headOffice.postalCode"]}</span>
                    )}
                  </label>

                  <label className="field">
                    Ville
                    <input
                      value={company.headOffice.city}
                      onChange={(e) => setField("headOffice.city", e.target.value)}
                      onBlur={() => markTouched("headOffice.city")}
                      className="input"
                      placeholder="Lille"
                    />
                    {showErr("headOffice.city") && <span className="error">{errors["headOffice.city"]}</span>}
                  </label>
                </div>

                <label className="field">
                  Pays
                  <input
                    value={company.headOffice.country}
                    onChange={(e) => setField("headOffice.country", e.target.value)}
                    onBlur={() => markTouched("headOffice.country")}
                    className="input"
                    placeholder="France"
                  />
                </label>
              </fieldset>
            </form>
          )}

          {/* STEP 3 — Représentants */}
          {step === 3 && (
            <form>
              <fieldset className="card">
                <legend>Représentant(s) légal(aux)</legend>
                {company.representatives.map((rep, idx) => {
                  const fullKey = `representatives.${idx}.fullName`;
                  const roleKey = `representatives.${idx}.role`;
                  return (
                    <div key={idx} className="reps-row">
                      <label className="field">
                        Nom complet
                        <input
                          value={rep.fullName}
                          onChange={(e) => setRep(idx, "fullName", e.target.value)}
                          onBlur={() => markTouched(fullKey)}
                          className="input"
                          placeholder="Nom et prénom"
                        />
                        {errors[fullKey] && (touched[fullKey] || showAllErrors) && (
                          <span className="error">{errors[fullKey]}</span>
                        )}
                      </label>

                      <label className="field">
                        Fonction (facultatif)
                        <input
                          value={rep.role || ""}
                          onChange={(e) => setRep(idx, "role", e.target.value)}
                          onBlur={() => markTouched(roleKey)}
                          className="input"
                          placeholder="Gérant"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => removeRep(idx)}
                        className="btn-ghost"
                        disabled={company.representatives.length === 1}
                      >
                        Suppr
                      </button>
                    </div>
                  );
                })}
                <button type="button" onClick={addRep} className="btn-ghost">
                  + Ajouter un représentant
                </button>
              </fieldset>

              {/* New: Type D'entreprise */}
              <label className="field" style={{ marginTop: 12 }}>
                Type D'entreprise
                <select
                  value={company.businessType}
                  onChange={(e) => setField("businessType", e.target.value)}
                  className="input"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </form>
          )}

          {/* STEP 4 — Aperçu & PDF */}
          {step === 4 && (
            <>
              <div className="preview card">
                <div className="preview-title">Aperçu</div>
                <div className="preview-body">{preview || "Complète les champs."}</div>
              </div>

              <div className="actions-bottom">
                <button type="button" className="export-btn" onClick={generatePdfDraft}>
                  Générer PDF
                </button>
              </div>
            </>
          )}

          {/* Bottom nav */}
          <div className="wizard-nav">
            <button type="button" className="btn-ghost" onClick={goBack} disabled={step === 0}>
              ← Précédent
            </button>
            {step < steps.length - 1 ? (
              <button type="button" className="export-btn" onClick={goNext}>
                Suivant →
              </button>
            ) : (
              <span />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
