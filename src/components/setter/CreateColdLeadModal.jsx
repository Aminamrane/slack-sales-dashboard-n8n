import { useEffect, useRef, useState } from "react";

/**
 * Modale "Ajouter un lead" (setter — création cold call).
 *
 * UX/UI alignée 1:1 avec le Modal "Add Lead" de TrackingSheet.jsx (sales) :
 * - Mêmes 5 champs core (full_name *, phone *, email, sector select 15 options,
 *   company_type select 8 options).
 * - Mêmes animations CSS (modalOverlayIn, modalCardInFlex, toastSlideIn,
 *   successPulse, checkmarkDraw) — keyframes définis dans TrackingSheetSetter.jsx
 *   (composant parent), donc pas de duplication.
 * - Mêmes patterns visuels (chevron SVG inline, border focus + shadow).
 *
 * Champs additionnels conservés vs TS sales (utiles côté setter, supportés
 * par le backend `POST /api/v1/tracking/setter/leads` qui réécrit
 * `company_name` et `notes` après `create_lead`) :
 *   - company_name (Nom de l'entreprise)
 *   - notes (Contexte, source, points clés…)
 *
 * Submission : onConfirm({ full_name, phone, email?, sector?, company_type?,
 *                          company_name?, notes? }).
 */

const SECTOR_OPTIONS = [
  "Ambulance",
  "Micro crèche",
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

const COMPANY_TYPE_OPTIONS = ["SARL", "SAS", "SASU", "SA", "EURL", "SCI", "SNC", "EI"];

const FORM_FIELDS = [
  { key: "full_name", label: "Nom complet *", placeholder: "Jean Dupont", type: "text" },
  { key: "phone", label: "Téléphone *", placeholder: "06 12 34 56 78", type: "tel" },
  { key: "email", label: "Email", placeholder: "jean@example.com", type: "email" },
  { key: "sector", label: "Secteur d'activité", placeholder: "Sélectionner...", type: "select", options: SECTOR_OPTIONS },
  { key: "company_type", label: "Type d'entreprise", placeholder: "Sélectionner...", type: "select", options: COMPANY_TYPE_OPTIONS },
];

const INITIAL_FORM = {
  full_name: "",
  phone: "",
  email: "",
  sector: "",
  company_type: "",
  company_name: "",
  notes: "",
};

export default function CreateColdLeadModal({
  open,
  onClose,
  onConfirm,
  darkMode = false,
  submitting = false,
}) {
  // Palette identique à TrackingSheet.jsx (cohérence visuelle parfaite)
  const C = {
    bg: darkMode ? "#1e1f28" : "#ffffff",
    border: darkMode ? "#2a2b36" : "#e2e6ef",
    text: darkMode ? "#eef0f6" : "#1e2330",
    muted: darkMode ? "#5e6273" : "#9ca3af",
    secondary: darkMode ? "#8b8fa0" : "#6b7280",
    accent: darkMode ? "#7c8adb" : "#5b6abf",
  };

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);
  const firstFieldRef = useRef(null);

  // Reset à chaque ouverture + autofocus
  useEffect(() => {
    if (!open) return;
    setFormData(INITIAL_FORM);
    setFormError("");
    setFormSuccess(false);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  // ESC pour fermer
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  // Détection succès via fin de submission (le parent ferme la modale après onConfirm,
  // mais le toast interne s'affiche aussi quand submitting passe true → false sans erreur).
  // Stratégie simple : on délègue 100% à `submitting` (parent).

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const handleFormSubmit = async () => {
    setFormError("");
    if (!formData.full_name.trim()) {
      setFormError("Le nom complet est requis");
      return false;
    }
    if (!formData.phone.trim()) {
      setFormError("Le numéro de téléphone est requis");
      return false;
    }

    const payload = {
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim(),
    };
    if (formData.email.trim()) payload.email = formData.email.trim();
    if (formData.sector.trim()) payload.sector = formData.sector.trim();
    if (formData.company_type.trim()) payload.company_type = formData.company_type.trim();
    if (formData.company_name.trim()) payload.company_name = formData.company_name.trim();
    if (formData.notes.trim()) payload.notes = formData.notes.trim();

    // Le parent retourne un boolean : true = succès, false = échec.
    // En cas d'échec, le parent affiche déjà son toast d'erreur — on se
    // contente de ne pas afficher le success inline (et de garder la modale
    // ouverte pour permettre une correction).
    const ok = await onConfirm?.(payload);
    if (ok) {
      setFormSuccess(true);
      return true;
    }
    return false;
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "modalOverlayIn 0.2s ease both",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose?.();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "85vh",
          overflowY: "auto",
          background: C.bg,
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          boxShadow: darkMode
            ? "0 8px 40px rgba(0,0,0,0.5)"
            : "0 8px 40px rgba(0,0,0,0.12)",
          padding: "28px 28px 24px",
          animation: "modalCardInFlex 0.25s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: C.text,
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Ajouter un lead
            </h2>
            <p style={{ fontSize: 12, color: C.muted, margin: "3px 0 0" }}>
              Créez un nouveau lead pour le cold call
            </p>
          </div>
          <button
            onClick={() => !submitting && onClose?.()}
            disabled={submitting}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
              color: C.muted,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              lineHeight: 1,
              fontFamily: "inherit",
              transition: "all 0.15s",
              opacity: submitting ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (submitting) return;
              e.currentTarget.style.color = C.text;
              e.currentTarget.style.borderColor = C.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = C.muted;
              e.currentTarget.style.borderColor = C.border;
            }}
          >
            ×
          </button>
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {FORM_FIELDS.map((field, idx) => (
            <div key={field.key}>
              <label
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: C.secondary,
                  marginBottom: 5,
                  display: "block",
                }}
              >
                {field.label}
              </label>
              {field.type === "select" ? (
                <select
                  value={formData[field.key]}
                  onChange={(e) => handleFormChange(field.key, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    border: `1px solid ${C.border}`,
                    background: darkMode ? "#16171e" : "#fff",
                    color: formData[field.key] ? C.text : C.muted,
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    boxSizing: "border-box",
                    cursor: "pointer",
                    appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(
                      C.muted,
                    )}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                    paddingRight: 36,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = C.accent;
                    e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = C.border;
                    e.target.style.boxShadow = "none";
                  }}
                >
                  <option value="" disabled>
                    {field.placeholder}
                  </option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  ref={idx === 0 ? firstFieldRef : undefined}
                  type={field.type}
                  value={formData[field.key]}
                  onChange={(e) => handleFormChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    border: `1px solid ${C.border}`,
                    background: darkMode ? "#16171e" : "#fff",
                    color: C.text,
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = C.accent;
                    e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = C.border;
                    e.target.style.boxShadow = "none";
                  }}
                />
              )}
            </div>
          ))}

          {/* Champs additionnels — utiles côté setter, supportés par le backend.
              Séparés visuellement par un divider léger pour rester focus sur les
              5 champs core (parité TS sales). */}
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              marginTop: 4,
              paddingTop: 14,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: C.secondary,
                  marginBottom: 5,
                  display: "block",
                }}
              >
                Nom de l'entreprise
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => handleFormChange("company_name", e.target.value)}
                placeholder="Entreprise Dupont SARL"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  border: `1px solid ${C.border}`,
                  background: darkMode ? "#16171e" : "#fff",
                  color: C.text,
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = C.accent;
                  e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = C.border;
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: C.secondary,
                  marginBottom: 5,
                  display: "block",
                }}
              >
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                placeholder="Contexte, source, points clés…"
                rows={3}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  border: `1px solid ${C.border}`,
                  background: darkMode ? "#16171e" : "#fff",
                  color: C.text,
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxSizing: "border-box",
                  resize: "vertical",
                  minHeight: 70,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = C.accent;
                  e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = C.border;
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {formError && (
            <p style={{ fontSize: 12, color: "#ef4444", margin: 0, fontWeight: 500 }}>
              {formError}
            </p>
          )}

          <button
            onClick={handleFormSubmit}
            disabled={submitting}
            style={{
              width: "100%",
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: submitting ? C.muted : darkMode ? "#fff" : "#1e2330",
              color: darkMode ? "#1e2330" : "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
              opacity: submitting ? 0.7 : 1,
              marginTop: 2,
            }}
            onMouseEnter={(e) => {
              if (submitting) return;
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {submitting ? "Ajout en cours..." : "Ajouter le lead"}
          </button>

          {formSuccess && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                background: darkMode ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)",
                border: `1px solid ${
                  darkMode ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)"
                }`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                animation: "toastSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                style={{ animation: "successPulse 0.4s ease both", flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="10" fill="#10b981" opacity="0.15" />
                <path
                  d="M7 12.5l3 3 7-7"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="24"
                  strokeDashoffset="0"
                  style={{ animation: "checkmarkDraw 0.5s ease 0.15s both" }}
                />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>
                Lead ajouté avec succès
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
