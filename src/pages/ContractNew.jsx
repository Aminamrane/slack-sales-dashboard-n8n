import { useEffect, useState } from "react";
import { CompanySchema, normalizeSiren, isValidSiren } from "../contracts/schemas.js";
import { companyClause } from "../contracts/format.js";
import "./contract.css";

const LEGAL_FORMS = ["SARL", "SAS", "SASU", "SA", "EURL", "SCI", "Autre"];

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
  });

  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState("");
  const [touched, setTouched] = useState({});
  const [showAllErrors, setShowAllErrors] = useState(false);

  // --- helpers pour le nom du fichier ---
  const stripDiacritics = (s = "") =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safeAscii = (s = "") =>
    stripDiacritics(s).replace(/[^a-zA-Z0-9 _.\-]+/g, "").replace(/\s+/g, " ").trim();

  const computePdfFilename = (c) => {
    const repName = c?.representatives?.[0]?.fullName?.trim();
    const display = repName || c?.legalName || "Document";
    const base = `${display} - Clause de confidentialité`;
    return `${safeAscii(base) || "Clause de confidentialite"}.pdf`;
  };

  // --- touches / setters ---
  const markTouched = (path) =>
    setTouched((t) => (t[path] ? t : { ...t, [path]: true }));

  const setField = (path, value) => {
    setCompany((prev) => {
      const next = structuredClone(prev);
      const parts = path.split(".");
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts.at(-1)] = value;
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

  // --- validation + aperçu ---
  const validateAndPreview = () => {
    const flat = {};

    // email
    const email = (company.email || "").trim();
    if (!email) flat["email"] = "Email requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) flat["email"] = "Email invalide";

    // phone léger
    const phone = (company.phone || "").trim();
    if (phone && !/^[\d+\s().-]{6,}$/.test(phone)) flat["phone"] = "Numéro invalide";

    const res = CompanySchema.safeParse(company);
    if (!res.success) {
      for (const issue of res.error.issues) {
        const key = issue.path.join(".");
        if (!flat[key]) flat[key] = issue.message;
      }
      setErrors(flat);
      setPreview("");
      return false;
    }

    setErrors({});
    setPreview(companyClause({ company: res.data }));
    return true;
  };

  useEffect(() => {
    validateAndPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  // --- Génération PDF (Option A: téléchargement avec nom custom) ---
  const generatePdfDraft = async () => {
    const ok = validateAndPreview();
    if (!ok) {
      setShowAllErrors(true);
      alert("Corrige les erreurs avant de générer le PDF.");
      return;
    }
    try {
      const resp = await fetch("/api/contract-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        alert("Erreur génération PDF: " + msg);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = computePdfFilename(company); // ← forcer le nom du fichier
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de la génération du PDF.");
    }
  };

  const showErr = (key) => errors[key] && (touched[key] || showAllErrors);

  const normalizedSiren = normalizeSiren(company.siren);
  const showSirenWarning =
    (touched["siren"] || showAllErrors) &&
    normalizedSiren.length === 9 &&
    !isValidSiren(normalizedSiren) &&
    !errors["siren"];

  return (
    <div className="contract-page">
      <h1 className="contract-title">Clause de confidentialité</h1>
      <p className="contract-subtitle">Renseigne les infos de l’entreprise.</p>

      <form>
        {/* Raison sociale */}
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

        {/* Forme juridique + SIREN */}
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
                <option key={f} value={f}>{f}</option>
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

        {/* Email + Téléphone */}
        <div className="grid2">
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
        </div>

        {/* Ville RCS */}
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

        {/* Siège */}
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
            {showErr("headOffice.line1") && (
              <span className="error">{errors["headOffice.line1"]}</span>
            )}
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
              {showErr("headOffice.city") && (
                <span className="error">{errors["headOffice.city"]}</span>
              )}
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

        {/* Représentants (facultatif) */}
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
                    placeholder="Le nom et le prénom"
                  />
                  {showErr(fullKey) && (
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
      </form>

      {/* Aperçu auto */}
      <div className="preview card">
        <div className="preview-title">Aperçu</div>
        <div className="preview-body">
          {preview || "Complète les champs."}
        </div>
      </div>

      {/* Bouton PDF centré sous l’aperçu */}
      <div className="actions-bottom">
        <button
          type="button"
          className="export-btn"
          onClick={generatePdfDraft}
        >
          Générer PDF
        </button>
      </div>
    </div>
  );
}
