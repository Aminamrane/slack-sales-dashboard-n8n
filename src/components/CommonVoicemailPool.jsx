// src/components/CommonVoicemailPool.jsx
//
// Onglet "Répondeur commun" du tracking sheet sales : liste le pool COMMUN des
// répondeurs anciens (statut Répondeur, dernier appel avant le début du mois
// dernier), récupérés via GET /api/v1/tracking/common-voicemail-pool. Chaque
// carte a un bouton "Prendre" (POST .../claim-common-voicemail) = prise
// exclusive → le lead bascule dans "Nouveau lead" du sales, badge "issu des
// répondeurs". Composant isolé pour ne toucher TrackingSheet.jsx (zone sacrée)
// qu'au strict minimum.

const ORIGIN_TONE = { bg: "rgba(100,116,139,0.12)", text: "#64748b" };

const fmtAge = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return "aujourd'hui";
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
};

export default function CommonVoicemailPool({ leads = [], loading = false, claimingId = null, onClaim, canClaim = true, C, darkMode }) {
  if (loading && leads.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 56, borderRadius: 14, background: darkMode ? "rgba(255,255,255,0.04)" : "#f4f5f7", opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted }}>
        <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.5 }}>📞</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Aucun répondeur commun disponible</div>
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, maxWidth: 420, margin: "0 auto" }}>
          Les répondeurs deviennent communs après 2 mois (hors mois en cours et précédent). Le premier qui clique « Prendre » se l'attribue.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {leads.map((lead) => {
        const claiming = String(claimingId) === String(lead.id);
        const age = fmtAge(lead.last_call_at || lead.created_at);
        return (
          <div key={lead.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "11px 16px",
            borderRadius: 14, border: `1px solid ${C.border}`,
            background: darkMode ? "rgba(255,255,255,0.03)" : "#fff",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748b", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 60, flexShrink: 1 }}>
              {lead.full_name || lead.company_name || lead.company || "Sans nom"}
            </span>
            {lead.origin && (
              <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 50, fontSize: 10, fontWeight: 600, background: ORIGIN_TONE.bg, color: ORIGIN_TONE.text, flexShrink: 0 }}>
                {lead.origin}
              </span>
            )}
            {(lead.company_name || lead.company) && (lead.full_name) && (
              <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1, minWidth: 0 }}>
                {lead.company_name || lead.company}
              </span>
            )}
            {lead.phone && (
              <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{lead.phone}</span>
            )}
            <div style={{ flex: 1 }} />
            {(() => {
              // Compteur d'appels ; si une trace d'appel existe mais compteur à 0, au moins 1.
              const nc = Math.max(
                lead.call_attempts || 0, lead.sales_call_count || 0, lead.setter_call_count || 0,
                (lead.last_call_at || lead.first_call_at) ? 1 : 0,
              );
              return (
                <span title="Nombre d'appels déjà passés à ce lead par le sales propriétaire" style={{
                  fontSize: 11, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap",
                  color: nc > 0 ? "#b45309" : C.muted,
                  background: nc > 0 ? (darkMode ? "rgba(180,83,9,0.16)" : "#fff3e3") : "transparent",
                  borderRadius: 20, padding: nc > 0 ? "2px 9px" : 0,
                }}>{nc} appel{nc > 1 ? "s" : ""}</span>
              );
            })()}
            {age && (
              <span title="Dernier appel" style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", flexShrink: 0 }}>répondeur {age}</span>
            )}
            {canClaim && (
              <button
                onClick={() => onClaim && onClaim(lead.id)}
                disabled={claiming}
                style={{
                  flexShrink: 0, padding: "6px 16px", borderRadius: 9, border: "none",
                  background: claiming ? C.muted : "#0891b2", color: "#fff",
                  fontSize: 12.5, fontWeight: 700, cursor: claiming ? "wait" : "pointer",
                  fontFamily: "inherit", transition: "opacity 0.15s", opacity: claiming ? 0.7 : 1,
                }}
              >
                {claiming ? "…" : "Prendre"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
