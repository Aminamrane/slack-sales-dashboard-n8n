// src/components/SalesRecordingsGrid.jsx
//
// Grille des sales par équipe (avec photo de profil), cliquable. Le clic ouvre la
// fiche du sales (SalesRecordingsDetail) — analyses d'abord. Ici on n'affiche que
// le résumé par sales : nb analysées (primaire) + nb vidéos + nb transcriptions.

import { useMemo } from "react";

function Avatar({ url, name, size = 38 }) {
  const initials = (name || "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "#1e2330", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700 }}>{initials}</div>
  );
}

function Metric({ n, label, color, darkMode, dim }) {
  const on = n > 0 && !dim;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, flexShrink: 0, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: on ? color : (darkMode ? "#6b7280" : "#c4c8cf") }}>{n}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: on ? (darkMode ? "#9aa2ad" : "#6b7280") : (darkMode ? "#6b7280" : "#c4c8cf") }}>{label}</span>
    </span>
  );
}

export default function SalesRecordingsGrid({ data, loading, error, onRefresh, refreshing, onSelectSales, avatars = {}, C, darkMode }) {
  const teams = useMemo(() => {
    const sales = data?.sales || [];
    const byTeam = new Map();
    for (const s of sales) {
      const t = s.team || "Sans équipe";
      if (!byTeam.has(t)) byTeam.set(t, []);
      byTeam.get(t).push(s);
    }
    return Array.from(byTeam.entries()).map(([team, members]) => ({ team, members }));
  }, [data]);

  if (loading && !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "56px 24px" }}>
        <style>{`@keyframes recSpinG { to { transform: rotate(360deg); } }
          @keyframes recPulseG { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
        <span style={{ width: 34, height: 34, borderRadius: "50%", border: "3px solid " + (darkMode ? "rgba(255,255,255,0.12)" : "#E1DED5"), borderTopColor: "#E8A317", animation: "recSpinG 0.7s linear infinite" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text, fontWeight: 600 }}>Scan des enregistrements…</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, animation: "recPulseG 1.6s ease-in-out infinite" }}>Lecture des dossiers Meet de chaque sales, quelques secondes.</div>
        </div>
        {/* Aperçu structurel en fond, pour signaler que du contenu arrive */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 620, marginTop: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 52, borderRadius: 14, background: darkMode ? "rgba(255,255,255,0.035)" : "#f4f5f7", animation: "recPulseG 1.6s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: "32px 20px", textAlign: "center", color: C.muted, fontSize: 13.5 }}>Impossible de charger les enregistrements. {String(error).slice(0, 120)}</div>;
  }

  const totals = data?.totals || { sales: 0, videos: 0, transcriptions: 0 };
  const totalScored = (data?.sales || []).reduce((a, s) => a + (s.nb_scored || 0), 0);

  return (
    <div>
      <style>{`@keyframes recSpin { to { transform: rotate(360deg); } }
        .rec-sales:hover { background: ${darkMode ? "rgba(255,255,255,0.045)" : "#fafbfc"} !important; border-color: ${darkMode ? "rgba(255,255,255,0.14)" : "#d7dae0"} !important; }`}</style>

      {/* Bandeau totaux */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 13, color: C.muted }}><b style={{ color: "#2F6B4F", fontSize: 15 }}>{totalScored}</b> analyses</div>
          <div style={{ fontSize: 13, color: C.muted }}><b style={{ color: C.text, fontSize: 15 }}>{totals.sales}</b> sales</div>
          <div style={{ fontSize: 13, color: C.muted }}><b style={{ color: "#0891b2", fontSize: 15 }}>{totals.videos}</b> vidéos</div>
          <div style={{ fontSize: 13, color: C.muted }}><b style={{ color: "#7c3aed", fontSize: 15 }}>{totals.transcriptions}</b> transcriptions</div>
          {data?.cached && <span style={{ fontSize: 11, color: C.muted, opacity: 0.7 }}>· cache</span>}
        </div>
        <button onClick={onRefresh} disabled={refreshing} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12.5, fontWeight: 600, cursor: refreshing ? "wait" : "pointer", fontFamily: "inherit", opacity: refreshing ? 0.6 : 1 }}>
          <span style={{ display: "inline-block", animation: refreshing ? "recSpin 0.8s linear infinite" : "none" }}>↻</span>
          {refreshing ? "Scan en cours…" : "Rafraîchir"}
        </button>
      </div>

      {/* Sales par équipe */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {teams.map(({ team, members }) => (
          <div key={team}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, paddingLeft: 4 }}>{team}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {members.map((s) => {
                const clickable = !s.error;
                return (
                  <div
                    key={s.email}
                    className={clickable ? "rec-sales" : ""}
                    onClick={() => clickable && onSelectSales && onSelectSales(s.email)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderRadius: 14, border: `1px solid ${C.border}`, background: darkMode ? "rgba(255,255,255,0.03)" : "#fff", cursor: clickable ? "pointer" : "default", transition: "background 0.12s, border-color 0.12s" }}
                  >
                    <Avatar url={avatars[(s.email || "").toLowerCase()]} name={s.name} />
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                    {s.error ? (
                      <span title={s.error} style={{ fontSize: 11.5, color: "#ef4444", fontWeight: 600 }}>⚠ inaccessible</span>
                    ) : (
                      <>
                        <Metric n={s.nb_scored || 0} label="analysées" color="#2F6B4F" darkMode={darkMode} />
                        <span style={{ width: 1, height: 18, background: C.border }} />
                        <Metric n={s.nb_videos} label="vidéos" color="#0891b2" darkMode={darkMode} dim />
                        <span style={{ width: 1, height: 18, background: C.border }} />
                        <Metric n={s.nb_transcriptions} label="transcriptions" color="#7c3aed" darkMode={darkMode} dim />
                        <span style={{ fontSize: 15, color: C.muted, marginLeft: 4 }}>›</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
