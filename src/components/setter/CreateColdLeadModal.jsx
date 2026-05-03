import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Modale "Créer un lead cold call" (réservé setters).
 * Champs obligatoires : full_name, phone.
 * Champs optionnels : email, sector, company_type, company_name, notes.
 * Soumission : onConfirm({ full_name, phone, email?, sector?, company_type?, company_name?, notes? }).
 */
export default function CreateColdLeadModal({
  open,
  onClose,
  onConfirm,
  darkMode = false,
  submitting = false,
}) {
  const C = {
    overlay: "rgba(0,0,0,0.45)",
    panel: darkMode ? "#1e1f28" : "#ffffff",
    border: darkMode ? "#2a2b36" : "#e2e6ef",
    text: darkMode ? "#eef0f6" : "#1e2330",
    muted: darkMode ? "#9ca3af" : "#5e6273",
    accent: darkMode ? "#7c8adb" : "#5b6abf",
    danger: "#ef4444",
    inputBg: darkMode ? "#13141b" : "#f6f7f9",
  };

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    sector: "",
    company_type: "",
    company_name: "",
    notes: "",
  });
  const [error, setError] = useState(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      full_name: "",
      phone: "",
      email: "",
      sector: "",
      company_type: "",
      company_name: "",
      notes: "",
    });
    setError(null);
    setTimeout(() => firstFieldRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setError(null);

    const full_name = form.full_name.trim();
    const phone = form.phone.trim();
    if (!full_name) {
      setError("Le nom est obligatoire.");
      return;
    }
    if (!phone) {
      setError("Le téléphone est obligatoire.");
      return;
    }

    const payload = { full_name, phone };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.sector.trim()) payload.sector = form.sector.trim();
    if (form.company_type.trim()) payload.company_type = form.company_type.trim();
    if (form.company_name.trim()) payload.company_name = form.company_name.trim();
    if (form.notes.trim()) payload.notes = form.notes.trim();

    onConfirm?.(payload);
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !submitting && onClose?.()}
            style={{
              position: "fixed",
              inset: 0,
              background: C.overlay,
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              pointerEvents: "auto",
            }}
          />
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{
              pointerEvents: "auto",
              position: "relative",
              width: "min(520px, 94vw)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: C.panel,
              borderRadius: 18,
              border: `1px solid ${C.border}`,
              boxShadow: darkMode
                ? "0 24px 60px rgba(0,0,0,0.5)"
                : "0 24px 60px rgba(15,23,42,0.18)",
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              fontFamily: "inherit",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: "-0.015em" }}>
                Nouveau cold call
              </div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                Le lead sera créé dans tes "Mes cold calls" et reste sans propriétaire jusqu'au transfert R1/R2.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Nom *" darkMode={darkMode}>
                <input
                  ref={firstFieldRef}
                  type="text"
                  value={form.full_name}
                  onChange={upd("full_name")}
                  placeholder="Jean Dupont"
                  style={inputStyle(C)}
                />
              </Field>
              <Field label="Téléphone *" darkMode={darkMode}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={upd("phone")}
                  placeholder="06 12 34 56 78"
                  style={inputStyle(C)}
                />
              </Field>
            </div>

            <Field label="Email" darkMode={darkMode}>
              <input
                type="email"
                value={form.email}
                onChange={upd("email")}
                placeholder="contact@entreprise.fr"
                style={inputStyle(C)}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Secteur" darkMode={darkMode}>
                <input
                  type="text"
                  value={form.sector}
                  onChange={upd("sector")}
                  placeholder="BTP, Restauration…"
                  style={inputStyle(C)}
                />
              </Field>
              <Field label="Type de société" darkMode={darkMode}>
                <input
                  type="text"
                  value={form.company_type}
                  onChange={upd("company_type")}
                  placeholder="SARL, SAS…"
                  style={inputStyle(C)}
                />
              </Field>
            </div>

            <Field label="Nom de l'entreprise" darkMode={darkMode}>
              <input
                type="text"
                value={form.company_name}
                onChange={upd("company_name")}
                placeholder="Entreprise Dupont SARL"
                style={inputStyle(C)}
              />
            </Field>

            <Field label="Notes" darkMode={darkMode}>
              <textarea
                value={form.notes}
                onChange={upd("notes")}
                rows={3}
                placeholder="Contexte, source, points clés…"
                style={{ ...inputStyle(C), resize: "vertical", minHeight: 70, fontFamily: "inherit" }}
              />
            </Field>

            {error && (
              <div style={{ fontSize: 12.5, color: C.danger, fontWeight: 500 }}>{error}</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => !submitting && onClose?.()}
                disabled={submitting}
                style={{
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: "transparent",
                  color: C.text,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: C.accent,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {submitting ? "Création…" : "Créer le lead"}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children, darkMode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: darkMode ? "#9ca3af" : "#6b7280",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(C) {
  return {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.inputBg,
    color: C.text,
    fontSize: 13.5,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    boxSizing: "border-box",
  };
}
