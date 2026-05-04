import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── TIME PICKER 24h FR ────────────────────────────────────────────────────────
// Inspired by TimeSelect in TrackingSheet.jsx (sacred zone — duplicated, not imported).
// Plages : 08h → 20h, pas de 5 minutes. Tout en 24h, pas d'AM/PM.
const HOURS_FR = Array.from({ length: 13 }, (_, i) => String(i + 8).padStart(2, "0")); // 08 → 20
const MINUTES_FR = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

/**
 * Modale Place R1 / Place R2.
 * - kind="r1" ou "r2"
 * - mode="team" (Scénario 1, sales déjà assigné, target_sales_email ignoré côté backend)
 *   OU mode="mine" (Scénario 2, lead créé par le setter, target_sales_email OBLIGATOIRE).
 * - teamSales : array [{ email, full_name }] pour le dropdown du Scénario 2.
 *
 * Soumission : onConfirm({ when: ISOString, target_sales_email?: string, notes?: string }).
 */
export default function PlaceR1R2Modal({
  open,
  onClose,
  onConfirm,
  kind = "r1",
  mode = "team",
  lead = null,
  teamSales = [],
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

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [targetSales, setTargetSales] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const dateRef = useRef(null);

  // Reset state when modal opens / lead changes
  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
    setTime("10:00");
    setTargetSales("");
    setNotes("");
    setError(null);
    setTimeout(() => dateRef.current?.focus(), 80);
  }, [open, lead?.id, kind, mode]);

  // Esc to close
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

    if (!date || !time) {
      setError("Date et heure requises.");
      return;
    }
    if (mode === "mine" && !targetSales) {
      setError("Choisis le sales propriétaire.");
      return;
    }
    if (!lead?.email?.trim()) {
      setError("Email obligatoire pour placer un R1/R2. Renseigne l'email du prospect avant de réserver le créneau.");
      return;
    }

    // Build local ISO with timezone — backend stores TIMESTAMPTZ
    const local = new Date(`${date}T${time}:00`);
    if (Number.isNaN(local.getTime())) {
      setError("Date / heure invalide.");
      return;
    }

    const payload = {
      when: local.toISOString(),
      notes: notes.trim() || undefined,
    };
    if (mode === "mine") {
      payload.target_sales_email = targetSales;
    }

    onConfirm?.(payload);
  };

  const title = kind === "r2" ? "Placer un R2" : "Placer un R1";

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
          {/* Backdrop */}
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

          {/* Panel */}
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
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: "-0.015em" }}>
                {title}
              </div>
              {lead?.full_name && (
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                  Lead : <strong style={{ color: C.text, fontWeight: 600 }}>{lead.full_name}</strong>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Date" darkMode={darkMode}>
                <input
                  ref={dateRef}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={inputStyle(C)}
                />
              </Field>
              <Field label="Heure" darkMode={darkMode}>
                <TimeSelectFR
                  value={time}
                  onChange={setTime}
                  C={C}
                  darkMode={darkMode}
                />
              </Field>
            </div>

            {mode === "mine" && (
              <Field
                label="Sales propriétaire"
                darkMode={darkMode}
                hint="Le lead sera assigné à ce commercial."
              >
                <select
                  value={targetSales}
                  onChange={(e) => setTargetSales(e.target.value)}
                  style={inputStyle(C)}
                >
                  <option value="">— Choisir —</option>
                  {teamSales.map((s) => (
                    <option key={s.email} value={s.email}>
                      {s.full_name || s.name || s.email}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Note pour le sales (facultatif)" darkMode={darkMode}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Contexte du RDV, points à transmettre au sales…"
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
                style={btnGhost(C, submitting)}
              >
                Annuler
              </button>
              <button type="submit" disabled={submitting} style={btnPrimary(C, submitting)}>
                {submitting ? "Envoi…" : "Confirmer"}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, hint, children, darkMode }) {
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
      {hint && (
        <span style={{ fontSize: 11, color: darkMode ? "#5e6273" : "#9ca3af" }}>{hint}</span>
      )}
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

function btnPrimary(C, disabled) {
  return {
    padding: "9px 16px",
    borderRadius: 10,
    border: "none",
    background: C.accent,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "transform 0.12s ease, opacity 0.15s ease",
    fontFamily: "inherit",
  };
}

function btnGhost(C, disabled) {
  return {
    padding: "9px 14px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: "transparent",
    color: C.text,
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  };
}

/**
 * TimeSelectFR — picker 24h FR (heure + minutes) en 2 selects natifs.
 * Format value/onChange : "HH:MM" sur 24h. Plages : 08h → 20h, pas de 5 min.
 * Auto-arrondi : si la minute reçue n'est pas un multiple de 5, on prend le
 * cran le plus proche (idem TimeSelect TrackingSheet).
 */
function TimeSelectFR({ value, onChange, C, darkMode }) {
  const safe = value && /^\d{2}:\d{2}$/.test(value) ? value : "10:00";
  const h = safe.slice(0, 2);
  const rawMin = safe.slice(3, 5);
  const m = MINUTES_FR.reduce(
    (prev, curr) =>
      Math.abs(parseInt(curr) - parseInt(rawMin)) <
      Math.abs(parseInt(prev) - parseInt(rawMin))
        ? curr
        : prev,
    "00"
  );
  // Si l'heure n'est pas dans la plage 08–20, on garde quand même la value
  // affichée en option custom pour ne pas perdre l'état (edge case).
  const hOptions = HOURS_FR.includes(h) ? HOURS_FR : [h, ...HOURS_FR];

  const selectStyle = {
    padding: "9px 22px 9px 11px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.inputBg,
    color: C.text,
    fontSize: 13.5,
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: "pointer",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    textAlign: "center",
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='${
      darkMode ? "%235e6273" : "%239ca3af"
    }' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  };

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
      <select
        value={h}
        onChange={(e) => onChange(e.target.value + ":" + m)}
        style={selectStyle}
        aria-label="Heure"
      >
        {hOptions.map((hr) => (
          <option key={hr} value={hr}>
            {hr}h
          </option>
        ))}
      </select>
      <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>:</span>
      <select
        value={m}
        onChange={(e) => onChange(h + ":" + e.target.value)}
        style={selectStyle}
        aria-label="Minutes"
      >
        {MINUTES_FR.map((mi) => (
          <option key={mi} value={mi}>
            {mi}
          </option>
        ))}
      </select>
    </div>
  );
}
