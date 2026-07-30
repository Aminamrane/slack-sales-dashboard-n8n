// src/components/SalesSettersToggle.jsx
//
// Segmented control Sales / Setters de la page Équipe. Partagé par la page
// standalone (CeoSalesTeamView) et l'onglet sales_team du CeoDashboard.

export default function SalesSettersToggle({ view, setView, C, darkMode }) {
  const opts = [{ id: "sales", label: "Sales" }, { id: "setters", label: "Setters" }];
  return (
    <div style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: 12, background: darkMode ? "rgba(255,255,255,0.05)" : "#eef0f3", border: `1px solid ${C.border}` }}>
      {opts.map((o) => {
        const active = view === o.id;
        return (
          <button
            key={o.id}
            onClick={() => setView(o.id)}
            style={{
              padding: "7px 18px", borderRadius: 9, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 650,
              background: active ? (darkMode ? "#2a2e37" : "#fff") : "transparent",
              color: active ? C.text : C.muted,
              boxShadow: active ? "0 1px 3px rgba(16,24,40,0.10)" : "none",
              transition: "all 0.15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
