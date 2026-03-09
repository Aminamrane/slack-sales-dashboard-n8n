import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CompanySchema, normalizeSiren, isValidSiren } from "../contracts/schemas.js";
import { companyClause } from "../contracts/format.js";
import apiClient from "../services/apiClient";
import myLogo from "../assets/my_image.png";
import myLogoDark from "../assets/my_image2.png";
import "./contract.css";

// UI shows EI instead of "Autre"
const LEGAL_FORMS = ["SARL", "SAS", "SASU", "SA", "EURL", "SCI", "SNC", "EI"];

// New: business types list
const BUSINESS_TYPES = [
  "Ambulance",
  "Micro créche",
  "Dentiste",
  "Pharmacie",
  "Salle de sport",
  "Esthétique",
  "Tech",
  "Hôtellerie",
  "Grande Distribution",
  "Tertiaire",
  "BTP",
  "Boulangerie",
  "Immobilier",
  "Restauration",
  "Générales",
];

// Map UI value to what the schema expects
const toSchemaLegalForm = (lf) => (lf === "EI" ? "Autre" : lf);

export default function ContractNew() {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');

  const [company, setCompany] = useState({
    legalName: "",
    legalForm: "SARL",
    siren: "",
    rcsCity: "",
    email: "",
    phone: "",
    headOffice: { line1: "", postalCode: "", city: "", country: "France" },
    representatives: [{ fullName: "", role: "Président" }],
    // New: default business type
    businessType: "Générales",
    // New: flag for companies in registration process
    isInRegistration: false,
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [preview, setPreview] = useState("");
  const [step, setStep] = useState(0); // 0..4
  const [generationPhase, setGenerationPhase] = useState(null); // null | "success" | "loading"
  const [loadingMsg, setLoadingMsg] = useState("");
  const [displayedMsg, setDisplayedMsg] = useState("");

  // AI Prefill state
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuccess, setAiSuccess] = useState(false);
  const [aiFading, setAiFading] = useState(false);
  const [aiFieldsFilled, setAiFieldsFilled] = useState([]);
  const [aiContactNotif, setAiContactNotif] = useState(false);
  const hasGenerated = useRef(false);

  // Dark mode detection - IMMEDIATE pour éviter le flash
  const [darkMode, setDarkMode] = useState(() => {
    // Détection IMMÉDIATE au chargement
    return document.documentElement.classList.contains('dark-mode') || 
           document.body.classList.contains('dark-mode');
  });

  useEffect(() => {
    // Détecter si dark mode est actif
    const isDark = document.documentElement.classList.contains('dark-mode') || 
                   document.body.classList.contains('dark-mode');
    setDarkMode(isDark);

    // Écouter les changements
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark-mode') || 
                     document.body.classList.contains('dark-mode');
      setDarkMode(isDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

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

    // Prepare payload for schema: map EI -> Autre, blank RCS city if EI, blank SIREN if in registration
    const cForSchema = {
      ...rest,
      legalForm: toSchemaLegalForm(c.legalForm),
      rcsCity: c.legalForm === "EI" ? "" : c.rcsCity,
      siren: c.isInRegistration ? "" : c.siren,
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

    // In registration: SIREN is not required — drop any error about it
    if (c.isInRegistration) delete flat["siren"];

    const ok = Object.keys(flat).length === 0;

    // --- PREVIEW: keep the UI label "EI" so it displays (EI), and clean "au RCS de ,"
    const cForPreview = { ...cForSchema, legalForm: c.legalForm, isInRegistration: c.isInRegistration };
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
      { key: "identite", title: "Identité", desc: "Raison sociale & SIREN", fields: ["legalName", "legalForm", "siren", "rcsCity"] },
      { key: "contacts", title: "Contacts", desc: "Email & téléphone", fields: ["email", "phone"] },
      {
        key: "siege",
        title: "Siège social",
        desc: "Adresse du siège",
        fields: ["headOffice.line1", "headOffice.postalCode", "headOffice.city", "headOffice.country"],
      },
      { key: "reps", title: "Représentants", desc: "Dirigeants & type", fields: [] },
      { key: "apercu", title: "Aperçu & PDF", desc: "Vérifier & générer", fields: [] },
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
    const next = Math.min(step + 1, steps.length - 1);
    if (next === 1) setAiContactNotif(false);
    setStep(next);
  };
  const goBack = () => {
    const prev = Math.max(step - 1, 0);
    if (prev === 1) setAiContactNotif(false);
    setStep(prev);
  };
  const goTo = (idx) => {
    if (idx === 1) setAiContactNotif(false);
    setStep(idx);
  };

  // ----- AI PREFILL -----
  const handleAiPrefill = async () => {
    const q = aiQuery.trim();
    if (!q) return;
    setAiLoading(true);
    setAiError("");
    setAiSuccess(false);
    setAiFading(false);
    setAiFieldsFilled([]);

    try {
      const data = await apiClient.post('/api/v1/contracts/ai-prefill', { query: q });
      console.log('[AI Prefill] Backend response:', data);

      // Map response to company state
      const filled = [];
      const updates = {};

      if (data.legal_name) { updates.legalName = data.legal_name; filled.push("Raison sociale"); }
      if (data.legal_form) {
        // Match case-insensitive (backend may return "Sas", "SARL", etc.)
        const match = LEGAL_FORMS.find(f => f.toUpperCase() === data.legal_form.toUpperCase());
        if (match) {
          updates.legalForm = match; filled.push("Forme juridique");
        } else {
          console.warn('[AI Prefill] legal_form not matched:', data.legal_form, '— expected one of:', LEGAL_FORMS);
        }
      }
      if (data.siren) { updates.siren = data.siren; filled.push("SIREN"); }
      if (data.rcs_city) { updates.rcsCity = data.rcs_city; filled.push("Ville RCS"); }
      if (data.address) {
        updates.headOffice = {
          line1: data.address.line1 || "",
          postalCode: data.address.postal_code || "",
          city: data.address.city || "",
          country: data.address.country || "France",
        };
        if (data.address.line1) filled.push("Adresse");
      }
      if (data.representatives?.length) {
        updates.representatives = data.representatives.map(r => ({
          fullName: r.full_name || "",
          role: (r.role || "Gérant").replace(/\s+d[eu']\s+\S+$/i, ""),
        }));
        filled.push("Représentant(s)");
      }
      if (data.business_type && BUSINESS_TYPES.includes(data.business_type)) {
        updates.businessType = data.business_type; filled.push("Type d'entreprise");
      }

      setCompany(prev => ({ ...prev, ...updates }));
      setAiFieldsFilled(filled);
      setAiSuccess(true);
      setAiFading(false);
      setAiContactNotif(true);

      // Auto-dismiss: start fade+collapse at 6.5s, remove from DOM at 7.5s (after 1s transition)
      setTimeout(() => setAiFading(true), 6500);
      setTimeout(() => { setAiSuccess(false); setAiFading(false); }, 7500);
    } catch (err) {
      setAiError(err?.data?.detail || err?.message || "Erreur lors de la recherche IA");
    } finally {
      setAiLoading(false);
    }
  };

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
        siren: company.isInRegistration ? "" : company.siren,
        isInRegistration: company.isInRegistration || false,
      };

      const resp = await fetch("/api/contract-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: payloadCompany,
          meta: { typeEntreprise: company.businessType || "Général" },
          }),
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

      // Fire-and-forget: sync client data to backend DB
      try {
        const clientDataPayload = {
          company: payloadCompany,
          meta: { typeEntreprise: company.businessType || "Général" },
          client_info_text: preview,
        };
        if (leadId) clientDataPayload.lead_id = leadId;
        await apiClient.post('/api/v1/contracts/client-data', clientDataPayload);
      } catch (e) {
        console.warn("Backend client-data sync failed (non-blocking):", e);
      }

      // Post-generation flow
      if (hasGenerated.current) {
        // Re-generation → show loading animation
        setGenerationPhase("loading");
      } else {
        // First generation → show success screen
        hasGenerated.current = true;
        setGenerationPhase("success");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de la génération du PDF.");
    }
  };

  const handleModify = () => {
    setGenerationPhase(null);
    setStep(0);
  };

  // Loading animation timer (75s with rotating messages)
  useEffect(() => {
    if (generationPhase !== "loading") return;
    const messages = [
      { time: 0, text: "Prise en compte de la modification..." },
      { time: 15000, text: `Recherche de l'email "${company.email}"...` },
      { time: 30000, text: "Modification en cours..." },
      { time: 50000, text: "Vérification..." },
      { time: 65000, text: "Finalisation..." },
    ];
    setLoadingMsg(messages[0].text);
    const timers = messages.slice(1).map(m =>
      setTimeout(() => setLoadingMsg(m.text), m.time)
    );
    const endTimer = setTimeout(() => setGenerationPhase("success"), 75000);
    return () => { timers.forEach(clearTimeout); clearTimeout(endTimer); };
  }, [generationPhase, company.email]);

  // Typewriter effect + animated dots (. → .. → ...)
  useEffect(() => {
    if (generationPhase !== "loading" || !loadingMsg) {
      setDisplayedMsg("");
      return;
    }
    const base = loadingMsg.replace(/\.+$/, "");
    setDisplayedMsg("");
    let i = 0;
    let dotInterval;
    const typeId = setInterval(() => {
      i++;
      setDisplayedMsg(base.slice(0, i));
      if (i >= base.length) {
        clearInterval(typeId);
        let d = 0;
        dotInterval = setInterval(() => {
          d = (d % 3) + 1;
          setDisplayedMsg(base + ".".repeat(d));
        }, 400);
      }
    }, 28);
    return () => { clearInterval(typeId); if (dotInterval) clearInterval(dotInterval); };
  }, [loadingMsg, generationPhase]);

  return (
    <div className={`wizard-outer ${darkMode ? 'dark-mode' : ''}`}>
      <div className="wizard">
        {/* Left stepper */}
        <aside className="wizard-side">
          <div className="wizard-brand">
            <img 
              src={darkMode ? myLogoDark : myLogo} 
              alt="OWNER" 
              style={{ width: 48, height: 48, borderRadius: 12 }} 
            />
          </div>
          <div className="wizard-steps">
            {steps.map((s, i) => {
              const state = i < step ? "done" : i === step ? "active" : "todo";
              return (
                <button key={s.key} type="button" className={`step ${state}`} onClick={() => goTo(i)}>
                  <span className="bullet">
                    {state === "done" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="step-text">
                    <span className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {s.title}
                      {i === 1 && aiContactNotif && (
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: darkMode ? '#ff9f0a' : '#ff9500',
                          display: 'inline-block',
                          animation: 'contactPulse 1.5s ease-in-out infinite',
                          boxShadow: `0 0 6px ${darkMode ? 'rgba(255,159,10,0.5)' : 'rgba(255,149,0,0.5)'}`,
                          flexShrink: 0,
                        }} />
                      )}
                    </span>
                    <span className="step-desc">{s.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Content */}
        <section className="wizard-content">
          {/* Progress bar */}
          <div className="wizard-progress">
            <div className="wizard-progress-bar" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>

          <h1 className="contract-title">Clause de confidentialité</h1>
          <p className="contract-subtitle">
            {step < steps.length - 1
              ? `Étape ${step + 1}/${steps.length - 1} — ${steps[step].desc}`
              : "Vérifiez les informations et générez le PDF"}
          </p>

          {/* AI PREFILL BAR */}
          {generationPhase === null && (
            <div style={{
              background: darkMode
                ? 'linear-gradient(135deg, rgba(10,132,255,0.08) 0%, rgba(88,86,214,0.06) 100%)'
                : 'linear-gradient(135deg, rgba(0,122,255,0.04) 0%, rgba(88,86,214,0.03) 100%)',
              border: `1px solid ${darkMode ? 'rgba(10,132,255,0.2)' : 'rgba(0,122,255,0.15)'}`,
              borderRadius: 16,
              padding: '14px 18px',
              marginBottom: 8,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Shimmer overlay */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, position: 'relative' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#0a84ff' : '#007aff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#0a84ff' : '#007aff', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Pré-remplir
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={aiQuery}
                  onChange={(e) => { setAiQuery(e.target.value); setAiError(""); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAiPrefill(); } }}
                  placeholder={"Ex. : \u00ab Nom de l'entreprise - Nom Pr\u00e9nom \u00bb"}
                  disabled={aiLoading}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
                    background: darkMode ? '#2a2b2e' : '#ffffff',
                    color: darkMode ? '#f5f5f7' : '#1d1d1f',
                    fontSize: 14,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = darkMode ? '#0a84ff' : '#007aff'; }}
                  onBlur={(e) => { e.target.style.borderColor = darkMode ? '#333338' : '#e5e5e5'; }}
                />
                <button
                  type="button"
                  onClick={handleAiPrefill}
                  disabled={aiLoading || !aiQuery.trim()}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: darkMode ? '#0a84ff' : '#007aff',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: aiLoading || !aiQuery.trim() ? 'not-allowed' : 'pointer',
                    opacity: aiLoading || !aiQuery.trim() ? 0.5 : 1,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {aiLoading ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                      </svg>
                      Recherche...
                    </>
                  ) : 'Rechercher'}
                </button>
              </div>

              {/* Error message */}
              {aiError && (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: darkMode ? '#ff453a' : '#ff3b30', fontWeight: 500 }}>
                  {aiError}
                </p>
              )}

              {/* Success message + contact reminder */}
              {aiSuccess && aiFieldsFilled.length > 0 && (
                <div style={{
                  opacity: aiFading ? 0 : 1,
                  maxHeight: aiFading ? 0 : 80,
                  marginTop: aiFading ? 0 : 8,
                  overflow: 'hidden',
                  transform: aiFading ? 'translateY(-4px)' : 'translateY(0)',
                  transition: 'opacity 0.5s ease, transform 0.5s ease, max-height 0.6s ease 0.15s, margin-top 0.6s ease 0.15s',
                }}>
                  <p style={{
                    margin: '0 0 0', fontSize: 13, fontWeight: 500,
                    color: darkMode ? '#30d158' : '#34c759',
                    animation: 'fadeIn 0.3s ease',
                  }}>
                    ✓ {aiFieldsFilled.length} champ{aiFieldsFilled.length > 1 ? 's' : ''} pré-rempli{aiFieldsFilled.length > 1 ? 's' : ''} : {aiFieldsFilled.join(', ')}
                  </p>
                  <p style={{
                    margin: '6px 0 0', fontSize: 12, fontWeight: 500,
                    color: darkMode ? '#ff9f0a' : '#ff9500',
                    animation: 'fadeIn 0.3s ease 0.1s both',
                  }}>
                    Pensez à remplir l'email et le téléphone dans l'étape Contacts.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 0 — Identité */}
          {step === 0 && (
            <form key={step}>
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

              {/* Checkbox for in-registration companies - available for ALL legal forms */}
              <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={company.isInRegistration}
                  onChange={(e) => {
                    setField("isInRegistration", e.target.checked);
                    // Clear SIREN when checking "in registration"
                    if (e.target.checked) {
                      setField("siren", "");
                    }
                  }}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                <span>En cours d'immatriculation{company.legalForm === "EI" ? "" : " au RCS"}</span>
              </label>

              {/* SIREN field - show if NOT in registration (for ALL legal forms including EI) */}
              {!company.isInRegistration && (
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
              )}

              {/* RCS city is only relevant if NOT EI and NOT in registration */}
              {company.legalForm !== "EI" && !company.isInRegistration && (
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

              {/* If in registration, ask for the RCS city (different context) */}
              {company.legalForm !== "EI" && company.isInRegistration && (
                <label className="field">
                  Ville du RCS (en cours) *
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
            <form key={step}>
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
            <form key={step}>
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
            <form key={step}>
              <fieldset className="card">
                <legend>Représentant(s) légal(aux)</legend>
                {company.representatives.map((rep, idx) => {
                  const fullKey = `representatives.${idx}.fullName`;
                  const roleKey = `representatives.${idx}.role`;
                  return (
                    <div key={idx} className="reps-row">
                      <label className="field">
                        Nom complet (Obligatoire)
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
                        Fonction (Obligatoire)
                        <input
                          value={rep.role || ""}
                          onChange={(e) => setRep(idx, "role", e.target.value)}
                          onBlur={() => markTouched(roleKey)}
                          className="input"
                          placeholder="Gérant"
                        />
                        {errors[roleKey] && (touched[roleKey] || showAllErrors) && (
                          <span className="error">{errors[roleKey]}</span>
                        )}
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
          {step === 4 && generationPhase === null && (
            <>
              <div className="preview card">
                <div className="preview-title">Aperçu</div>
                <div className="preview-body">{preview || "Complète les champs."}</div>
              </div>

              <div className="actions-bottom">
                <button type="button" className="export-btn" onClick={generatePdfDraft}>
                  {hasGenerated.current ? "Régénérer le NDA" : "Générer PDF"}
                </button>
              </div>
            </>
          )}

          {/* SUCCESS SCREEN */}
          {step === 4 && generationPhase === "success" && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
              {/* Success ring with glow */}
              <div style={{ position: 'relative', marginBottom: 28 }}>
                <div style={{
                  position: 'absolute', inset: -8,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
                  animation: 'successGlow 2s ease-in-out infinite',
                }} />
                <svg viewBox="0 0 52 52" style={{ width: 68, height: 68, position: 'relative' }}>
                  <circle cx="26" cy="26" r="24" fill="none" stroke="#10b981" strokeWidth="2.5"
                    style={{ strokeDasharray: 151, strokeDashoffset: 151, animation: 'checkCircle 0.6s ease forwards' }} />
                  <path fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    d="M15 27l7 7 15-15"
                    style={{ strokeDasharray: 36, strokeDashoffset: 36, animation: 'checkMark 0.4s 0.5s ease forwards' }} />
                </svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: darkMode ? '#f5f5f7' : '#1d1d1f' }}>
                NDA généré avec succès
              </h2>
              <p style={{ fontSize: 14, color: darkMode ? '#a1a1a6' : '#6e6e73', margin: '0 0 28px', lineHeight: 1.5 }}>
                Le document a été téléchargé. Vous pouvez<br />désormais envoyer le contrat.
              </p>
              <button type="button" className="btn-ghost" onClick={handleModify}
                style={{
                  fontSize: 14, padding: '11px 24px', borderRadius: 50,
                  border: `1.5px solid ${darkMode ? '#0a84ff' : '#007aff'}`,
                  color: darkMode ? '#0a84ff' : '#007aff',
                  background: 'transparent', cursor: 'pointer', fontWeight: 600,
                  transition: 'all 0.25s',
                }}
                onMouseEnter={(e) => { e.target.style.background = darkMode ? 'rgba(10,132,255,0.1)' : 'rgba(0,122,255,0.06)'; }}
                onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
              >
                Modifier le contrat
              </button>
              <style>{`
                @keyframes checkCircle { to { stroke-dashoffset: 0; } }
                @keyframes checkMark { to { stroke-dashoffset: 0; } }
                @keyframes successGlow {
                  0%, 100% { opacity: 0.6; transform: scale(1); }
                  50% { opacity: 1; transform: scale(1.08); }
                }
              `}</style>
            </div>
          )}

          {/* LOADING SCREEN (75s) */}
          {step === 4 && generationPhase === "loading" && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 32 }}>
                <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="44" fill="none" stroke={darkMode ? '#333338' : '#e5e5ea'} strokeWidth="6" />
                  <circle cx="50" cy="50" r="44" fill="none" stroke={darkMode ? '#0a84ff' : '#007aff'} strokeWidth="6"
                    strokeLinecap="round"
                    style={{ strokeDasharray: 276.5, strokeDashoffset: 276.5, animation: 'loaderProgress 75s linear forwards' }} />
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: darkMode ? '#f5f5f7' : '#1d1d1f', margin: '0 0 8px', minHeight: 24 }}>
                {displayedMsg}
              </p>
              <p style={{ fontSize: 13, color: darkMode ? '#636366' : '#aeaeb2' }}>
                Veuillez patienter...
              </p>
              <style>{`
                @keyframes loaderProgress { to { stroke-dashoffset: 0; } }
              `}</style>
            </div>
          )}

          {/* Bottom nav - hidden during success/loading phases */}
          <div className="wizard-nav" style={generationPhase ? { display: 'none' } : undefined}>
            <button type="button" className="btn-ghost" onClick={goBack} disabled={step === 0}
              style={{ borderRadius: 50, padding: '10px 20px', fontSize: 13 }}>
              Précédent
            </button>
            {step < steps.length - 1 ? (
              <button type="button" className="export-btn" onClick={goNext}
                style={{ borderRadius: 50, padding: '10px 24px', fontSize: 13 }}>
                Suivant
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
