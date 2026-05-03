import { motion } from "framer-motion";

/**
 * Carte lead pour la page Setter.
 * Modes :
 *  - mode="team" : lead appartenant à un sales de l'équipe (Scénario 1).
 *      Actions : Mark-called (+badge compteur), Place R1, Place R2, Disqualifier.
 *  - mode="mine" : lead cold call créé par le setter (Scénario 2).
 *      Actions : Place R1 (avec target sales), Place R2 (avec target sales), Disqualifier.
 *
 * Appel `onAction(actionKey, lead)` avec actionKey ∈
 *   "markCalled" | "placeR1" | "placeR2" | "disqualify".
 *
 * Animation de sortie via AnimatePresence côté parent (key=lead.id),
 * fade + collapse height (variants `exit`).
 */

const formatPhone = (raw) => {
  if (!raw) return "—";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("33")) {
    const local = "0" + digits.slice(2);
    return local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return raw;
};

const formatDate = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return null;
  }
};

const STATUS_LABELS = {
  new: "Nouveau",
  voicemail: "Répondeur",
  callback: "À rappeler",
  not_reached: "Pas joint",
  not_interested: "Pas intéressé",
  not_relevant: "Non pertinent",
  long_term: "Long terme",
  r1: "R1 placé",
  r2: "R2 placé",
  signed: "Signé",
};

export default function LeadCardSetter({ lead, mode, darkMode, onAction, busy }) {
  const C = {
    bg: darkMode ? "#1e1f28" : "#ffffff",
    bgHover: darkMode ? "#252636" : "#fafbfc",
    border: darkMode ? "#2a2b36" : "#e2e6ef",
    text: darkMode ? "#eef0f6" : "#1e2330",
    muted: darkMode ? "#5e6273" : "#9ca3af",
    accent: darkMode ? "#7c8adb" : "#5b6abf",
    danger: "#ef4444",
    success: "#10b981",
    warning: "#f59e0b",
  };

  const callCount = Number(lead?.setter_call_count || 0);
  const calledByName = lead?.setter_called_by_name || null;
  const calledAt = formatDate(lead?.setter_called_at);
  const ownerSalesName = lead?.assigned_to_name || lead?.assigned_to || null;
  const phone = formatPhone(lead?.phone);
  const status = STATUS_LABELS[lead?.status] || lead?.status || "—";

  const handle = (key) => (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (busy) return;
    onAction?.(key, lead);
  };

  const ActionButton = ({ children, onClick, color = C.accent, variant = "primary", disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      style={{
        padding: "7px 12px",
        borderRadius: 9,
        border: variant === "ghost" ? `1px solid ${C.border}` : "none",
        background:
          variant === "ghost"
            ? "transparent"
            : variant === "soft"
              ? `${color}18`
              : color,
        color: variant === "primary" ? "#fff" : color,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled || busy ? "not-allowed" : "pointer",
        opacity: disabled || busy ? 0.55 : 1,
        transition: "transform 0.12s ease, background 0.15s ease, opacity 0.15s ease",
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(e) => {
        if (disabled || busy) return;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
      }}
    >
      {children}
    </button>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, scale: 0.96 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "hidden",
      }}
    >
      {/* Top row : nom + statut + tél */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
            {lead?.full_name || "Sans nom"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, fontSize: 12, color: C.muted }}>
            <span>{phone}</span>
            {lead?.email && (
              <>
                <span style={{ opacity: 0.4 }}>•</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                  {lead.email}
                </span>
              </>
            )}
          </div>
        </div>
        <div
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: `${C.accent}15`,
            color: C.accent,
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {status}
        </div>
      </div>

      {/* Meta row : sales propriétaire (mode team) + dernier mark-called */}
      {(mode === "team" || lead?.company_name) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11.5, color: C.muted }}>
          {mode === "team" && ownerSalesName && (
            <span>
              <strong style={{ color: C.text, fontWeight: 600 }}>Sales :</strong>{" "}
              {ownerSalesName}
            </span>
          )}
          {lead?.company_name && (
            <span>
              <strong style={{ color: C.text, fontWeight: 600 }}>Entreprise :</strong>{" "}
              {lead.company_name}
            </span>
          )}
          {lead?.sector && (
            <span>
              <strong style={{ color: C.text, fontWeight: 600 }}>Secteur :</strong>{" "}
              {lead.sector}
            </span>
          )}
        </div>
      )}

      {/* Badge mark-called */}
      {callCount > 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: `${C.success}15`,
            color: C.success,
            fontSize: 11.5,
            fontWeight: 600,
          }}
          title={
            calledByName
              ? `Dernier appel : ${calledByName}${calledAt ? ` • ${calledAt}` : ""}`
              : undefined
          }
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          Appelé{callCount > 1 ? ` ×${callCount}` : ""}
          {calledByName && (
            <span style={{ color: C.muted, fontWeight: 500 }}>
              • {calledByName}
            </span>
          )}
        </div>
      )}

      {/* Notes (si présentes) */}
      {lead?.notes && (
        <div
          style={{
            fontSize: 12.5,
            color: darkMode ? "#c5c8d2" : "#4b5165",
            background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)",
            borderRadius: 8,
            padding: "8px 10px",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {lead.notes}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
        {mode === "team" && (
          <ActionButton onClick={handle("markCalled")} color={C.success} variant="soft">
            Marquer appelé{callCount > 0 ? ` (${callCount})` : ""}
          </ActionButton>
        )}
        <ActionButton onClick={handle("placeR1")}>Placer R1</ActionButton>
        <ActionButton onClick={handle("placeR2")} color={darkMode ? "#a78bfa" : "#7c3aed"}>
          Placer R2
        </ActionButton>
        <ActionButton onClick={handle("disqualify")} color={C.danger} variant="ghost">
          Disqualifier
        </ActionButton>
      </div>
    </motion.div>
  );
}
