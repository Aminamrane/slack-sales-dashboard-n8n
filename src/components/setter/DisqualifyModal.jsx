import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Modale "Disqualifier le lead".
 * Champ unique : raison (textarea, min 3 caractères).
 * Soumission : onConfirm({ reason: string }).
 */
export default function DisqualifyModal({
  open,
  onClose,
  onConfirm,
  lead = null,
  darkMode = false,
  submitting = false,
}) {
  const C = {
    overlay: "rgba(0,0,0,0.45)",
    panel: darkMode ? "#1e1f28" : "#ffffff",
    border: darkMode ? "#2a2b36" : "#e2e6ef",
    text: darkMode ? "#eef0f6" : "#1e2330",
    muted: darkMode ? "#9ca3af" : "#5e6273",
    danger: "#ef4444",
    inputBg: darkMode ? "#13141b" : "#f6f7f9",
  };

  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError(null);
    setTimeout(() => taRef.current?.focus(), 80);
  }, [open, lead?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setError(null);
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("La raison doit faire au moins 3 caractères.");
      return;
    }
    onConfirm?.({ reason: trimmed });
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
              width: "min(440px, 92vw)",
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
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.text,
                  letterSpacing: "-0.015em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: `${C.danger}20`,
                    color: C.danger,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  !
                </span>
                Disqualifier ce lead
              </div>
              {lead?.full_name && (
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                  Lead : <strong style={{ color: C.text, fontWeight: 600 }}>{lead.full_name}</strong>
                </div>
              )}
            </div>

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
                Raison (visible par l'équipe)
              </span>
              <textarea
                ref={taRef}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Pourquoi ce lead est disqualifié ?"
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.inputBg,
                  color: C.text,
                  fontSize: 13.5,
                  fontFamily: "inherit",
                  outline: "none",
                  resize: "vertical",
                  minHeight: 90,
                  boxSizing: "border-box",
                }}
              />
            </label>

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
                  background: C.danger,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {submitting ? "Envoi…" : "Disqualifier"}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
