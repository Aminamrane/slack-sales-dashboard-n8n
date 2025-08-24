// src/pages/ContractNew.jsx
import { useState } from "react";
import { CompanySchema, normalizeSiren, isValidSiren } from "../contracts/schemas.js";
import { companyClause } from "../contracts/format.js";

const LEGAL_FORMS = ["SARL", "SAS", "SASU", "SA", "EURL", "SCI", "Autre"];

export default function ContractNew() {
  const [company, setCompany] = useState({
    legalName: "",
    legalForm: "SARL",
    siren: "",
    rcsCity: "",
    email: "",            // NEW
    phone: "",            // NEW (Numéro)
    headOffice: { line1: "", postalCode: "", city: "", country: "France" },
    representatives: [{ fullName: "", role: "" }], // facultatif V1
  });

  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState("");

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

  const validateAndPreview = () => {
    const flat = {};

    // email simple (requis + format)
    const email = (company.email || "").trim();
    if (!email) flat["email"] = "Email requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) flat["email"] = "Email invalide";

    // phone léger (autoriser +, espace, chiffres)
    const phone = (company.phone || "").trim();
    if (phone && !/^[\d+\s().-]{6,}$/.test(phone)) {
      flat["phone"] = "Numéro invalide";
    }

    const res = CompanySchema.safeParse(company);
    if (!res.success) {
      for (const issue of res.error.issues) {
        const key = issue.path.join(".");
        if (!flat[key]) flat[key] = issue.message;
      }
    }

    if (Object.keys(flat).length) {
      setErrors(flat);
      setPreview("");
      return false;
    }

    setErrors({});
    setPreview(companyClause({ company: res.success ? res.data : company }));
    return true;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (validateAndPreview()) alert("Société validée ✔️");
  };

  const generatePdfDraft = async () => {
    const ok = validateAndPreview();
    if (!ok) { alert("Corrige les erreurs."); return; }
    try {
      const resp = await fetch("/api/contract-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }), // l’API enverra à n8n pour Google Sheets
      });
      if (!resp.ok) {
        const msg = await resp.text();
        alert("Erreur génération PDF: " + msg);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de la génération du PDF.");
    }
  };

  const normalizedSiren = normalizeSiren(company.siren);
  const showSirenWarning =
    normalizedSiren.length === 9 && !isValidSiren(normalizedSiren) && !errors["siren"];

  const inputStyle = { width: "100%", padding: ".5rem", border: "1px solid #ddd", borderRadius: 8 };

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Nouveau contrat</h1>
      <p style={{ color: "#555" }}>Renseigne les infos de l’entreprise.</p>

      <form onSubmit={onSubmit} onBlur={validateAndPreview}>
        {/* Raison sociale */}
        <label style={{ display: "block", marginTop: "1rem" }}>
          Raison sociale *
          <input
            value={company.legalName}
            onChange={(e) => setField("legalName", e.target.value)}
            style={inputStyle}
            placeholder="OWNER"
          />
          {errors["legalName"] && <span style={{ color: "crimson" }}>{errors["legalName"]}</span>}
        </label>

        {/* Forme juridique */}
        <label style={{ display: "block", marginTop: "1rem" }}>
          Forme juridique *
          <select
            value={company.legalForm}
            onChange={(e) => setField("legalForm", e.target.value)}
            style={inputStyle}
          >
            {LEGAL_FORMS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {errors["legalForm"] && <span style={{ color: "crimson" }}>{errors["legalForm"]}</span>}
        </label>

        {/* Email */}
        <label style={{ display: "block", marginTop: "1rem" }}>
          Email (contact) *
          <input
            type="email"
            value={company.email}
            onChange={(e) => setField("email", e.target.value)}
            style={inputStyle}
            placeholder="contact@domaine.com"
          />
          {errors["email"] && <span style={{ color: "crimson" }}>{errors["email"]}</span>}
        </label>

        {/* Numéro */}
        <label style={{ display: "block", marginTop: "1rem" }}>
          Numéro (téléphone)
          <input
            value={company.phone}
            onChange={(e) => setField("phone", e.target.value)}
            style={inputStyle}
            placeholder="+33 6 12 34 56 78"
          />
          {errors["phone"] && <span style={{ color: "crimson" }}>{errors["phone"]}</span>}
        </label>

        {/* SIREN */}
        <label style={{ display: "block", marginTop: "1rem" }}>
          SIREN (9 chiffres) *
          <input
            value={company.siren}
            onChange={(e) => setField("siren", e.target.value)}
            style={inputStyle}
            placeholder="981 817 166"
          />
        </label>
        {errors["siren"] && <span style={{ color: "crimson" }}>{errors["siren"]}</span>}
        {showSirenWarning && (
          <span style={{ color: "#8a6d3b", display: "block", marginTop: ".25rem" }}>
            ⚠️ SIREN non valide.
          </span>
        )}

        {/* Ville RCS */}
        <label style={{ display: "block", marginTop: "1rem" }}>
          Ville du RCS *
          <input
            value={company.rcsCity}
            onChange={(e) => setField("rcsCity", e.target.value)}
            style={inputStyle}
            placeholder="Lille"
          />
          {errors["rcsCity"] && <span style={{ color: "crimson" }}>{errors["rcsCity"]}</span>}
        </label>

        {/* Siège */}
        <fieldset style={{ marginTop: "1rem", border: "1px solid #eee", borderRadius: 10, padding: "1rem" }}>
          <legend style={{ padding: "0 .4rem", color: "#333" }}>Siège social *</legend>

          <label style={{ display: "block", marginTop: ".5rem" }}>
            Adresse (ligne 1)
            <input
              value={company.headOffice.line1}
              onChange={(e) => setField("headOffice.line1", e.target.value)}
              style={inputStyle}
              placeholder="18 rue du commerce"
            />
            {errors["headOffice.line1"] && (
              <span style={{ color: "crimson" }}>{errors["headOffice.line1"]}</span>
            )}
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: ".5rem" }}>
            <label>
              Code postal
              <input
                value={company.headOffice.postalCode}
                onChange={(e) => setField("headOffice.postalCode", e.target.value)}
                style={inputStyle}
                placeholder="59000"
              />
              {errors["headOffice.postalCode"] && (
                <span style={{ color: "crimson" }}>{errors["headOffice.postalCode"]}</span>
              )}
            </label>

            <label>
              Ville
              <input
                value={company.headOffice.city}
                onChange={(e) => setField("headOffice.city", e.target.value)}
                style={inputStyle}
                placeholder="Lille"
              />
              {errors["headOffice.city"] && (
                <span style={{ color: "crimson" }}>{errors["headOffice.city"]}</span>
              )}
            </label>
          </div>

          <label style={{ display: "block", marginTop: ".5rem" }}>
            Pays
            <input
              value={company.headOffice.country}
              onChange={(e) => setField("headOffice.country", e.target.value)}
              style={inputStyle}
              placeholder="France"
            />
          </label>
        </fieldset>

        {/* Représentants (facultatif) */}
        <fieldset style={{ marginTop: "1rem", border: "1px solid #eee", borderRadius: 10, padding: "1rem" }}>
          <legend style={{ padding: "0 .4rem", color: "#333" }}>Représentant(s) légal(aux)</legend>

          {company.representatives.map((rep, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr auto",
                gap: "1rem",
                alignItems: "end",
                marginBottom: ".5rem",
              }}
            >
              <label>
                Nom complet
                <input
                  value={rep.fullName}
                  onChange={(e) => setRep(idx, "fullName", e.target.value)}
                  style={inputStyle}
                  placeholder="Ismah"
                />
              </label>

              <label>
                Fonction (facultatif)
                <input
                  value={rep.role || ""}
                  onChange={(e) => setRep(idx, "role", e.target.value)}
                  style={inputStyle}
                  placeholder="Gérant"
                />
              </label>

              <button
                type="button"
                onClick={() => removeRep(idx)}
                style={{ padding: ".5rem .8rem", borderRadius: 8, border: "1px solid #ddd" }}
                disabled={company.representatives.length === 1}
              >
                Suppr
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addRep}
            style={{ padding: ".5rem .8rem", borderRadius: 8, border: "1px solid #ddd" }}
          >
            + Ajouter un représentant
          </button>
        </fieldset>

        <div style={{ marginTop: "1.5rem", display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          <button type="submit" className="export-btn">Valider la société</button>
          <button type="button" className="export-btn" onClick={validateAndPreview}>Aperçu</button>
          <button type="button" className="export-btn" onClick={generatePdfDraft}>Générer PDF (brouillon)</button>
        </div>
      </form>

      {/* Aperçu clause */}
      <div
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          border: "1px dashed #bbb",
          borderRadius: 10,
          background: "#fafafa",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: ".5rem" }}>Aperçu</div>
        <div style={{ whiteSpace: "pre-wrap" }}>
          {preview || "Vérifie l’aperçu avant de générer le PDF."}
        </div>
      </div>
    </div>
  );
}
