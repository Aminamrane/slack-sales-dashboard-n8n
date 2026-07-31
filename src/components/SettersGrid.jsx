// src/components/SettersGrid.jsx
//
// Grille "Setters" regroupée PAR ÉQUIPE, pour le toggle Sales/Setters de la
// page Équipe. Un setter n'a pas d'équipe propre : son équipe est DÉRIVÉE des
// sales / équipes qu'il traite (il peut donc apparaître dans plusieurs équipes).
//
// Données : sortie de /api/v1/users/setters-overview
//   [{ id, full_name, email, avatar_url,
//      teams: [{label,color}],
//      assignments: [{target_type:'user'|'team', target_label, team_label,
//                     team_color, immediate_new_leads, manual_only, repondeur_only}] }]
//
// `teams` (prop) = liste canonique des équipes (même ordre/couleurs que la
// grille Sales) pour ordonner les sections.

import { useMemo, useState } from "react";

const getInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Compte test setter à ne jamais afficher (ex. "Setter Test").
const isTestSetter = (s) => /@test\.com$/i.test(s.email || "") || /\btest\b/i.test(s.full_name || "");

// Mode d'arrivée des leads pour un rattachement (navy, pas de violet).
const modeOf = (a) =>
  a.repondeur_only ? { key: "rep", label: "Répondeurs", color: "#b45309", bg: "#fff3e3" }
  : a.immediate_new_leads ? { key: "imm", label: "Immédiat", color: "#15803d", bg: "#e7f6ec" }
  : a.manual_only ? { key: "man", label: "Manuel", color: "#1e2330", bg: "#eef0f4" }
  : { key: "std", label: "Sous 24h", color: "#5a6473", bg: "#f0f2f5" };

function SetterAvatar({ src, name, teamColor }) {
  const [err, setErr] = useState(false);
  const size = 44;
  const base = { width: size, height: size, borderRadius: 14, flexShrink: 0, boxSizing: "border-box" };
  if (src && !err) {
    return <img src={src} alt={name} onError={() => setErr(true)} style={{ ...base, objectFit: "cover", background: teamColor }} />;
  }
  return (
    <div style={{ ...base, background: teamColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>
      {getInitials(name)}
    </div>
  );
}

export default function SettersGrid({ setters = [], teams = [], loading = false, C, darkMode, onOpenAccount }) {
  const groups = useMemo(() => {
    const order = (teams || []).map((t) => ({ label: t.label, color: t.color || "#64748b" }));
    const byLabel = new Map(order.map((t) => [t.label, { label: t.label, color: t.color || "#64748b", setters: [] }]));
    const orphan = { label: "Sans équipe", color: "#1e2330", setters: [] };

    (setters || []).filter((s) => !isTestSetter(s)).forEach((s) => {
      const labels = (s.teams || []).map((t) => t.label);
      if (labels.length === 0) {
        orphan.setters.push({ ...s, sectionLabel: orphan.label, sectionColor: orphan.color });
        return;
      }
      labels.forEach((tl) => {
        const g = byLabel.get(tl);
        (g || orphan).setters.push({ ...s, sectionLabel: tl, sectionColor: g ? g.color : orphan.color });
      });
    });

    const sortSetters = (a, b) => String(a.full_name || a.email).localeCompare(String(b.full_name || b.email), "fr");
    const out = order.map((t) => byLabel.get(t.label)).filter((g) => g.setters.length > 0);
    out.forEach((g) => g.setters.sort(sortSetters));
    if (orphan.setters.length) {
      orphan.setters.sort(sortSetters);
      out.push(orphan);
    }
    return out;
  }, [setters, teams]);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ceo-card" style={{ padding: "18px 20px", height: 132, animation: `ceoCardPop 0.4s ease ${i * 60}ms both` }}>
            <div style={{ width: "100%", height: "100%", background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderRadius: 8, animation: "ceoPulse 1.4s ease-in-out infinite" }} />
          </div>
        ))}
      </div>
    );
  }

  const total = groups.reduce((n, g) => n + g.setters.length, 0);
  if (total === 0) {
    return (
      <div className="ceo-card" style={{ padding: 40, textAlign: "center", color: C.muted, animation: "ceoCardPop 0.4s ease both" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
        <p style={{ fontSize: 14, margin: 0 }}>Aucun setter rattaché.</p>
      </div>
    );
  }

  let cardIndex = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      {groups.map((g) => (
        <section key={g.label}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", paddingLeft: 2 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: g.color, flexShrink: 0 }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0, letterSpacing: "-0.01em" }}>{g.label}</h2>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>{g.setters.length}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {g.setters.map((s) => {
              const name = s.full_name || s.email;
              const i = cardIndex++;
              // Rattachements de CE setter dans CETTE équipe.
              const here = (s.assignments || []).filter((a) => a.team_label === s.sectionLabel);
              const targets = here.map((a) => (a.target_type === "team" ? "Toute l'équipe" : a.target_label)).filter(Boolean);
              const uniqTargets = [...new Set(targets)];
              const modes = [];
              const seenMode = new Set();
              here.forEach((a) => { const m = modeOf(a); if (!seenMode.has(m.key)) { seenMode.add(m.key); modes.push(m); } });

              return (
                <div key={`${g.label}-${s.email || s.id}`} className="ceo-card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13, animation: `ceoCardPop 0.4s ease ${Math.min(i, 12) * 45}ms both` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <SetterAvatar src={s.avatar_url} name={name} teamColor={s.sectionColor} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 650, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                      <div style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{s.email}</div>
                    </div>
                  </div>

                  {/* Sur qui il traite les leads + mode d'arrivée. */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em", color: C.muted }}>Traite les leads de</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {uniqTargets.length ? uniqTargets.map((t) => (
                        <span key={t} style={{ fontSize: 11.5, fontWeight: 600, color: C.text, background: darkMode ? "rgba(255,255,255,0.05)" : "#f2f3f5", border: `1px solid ${C.border}`, borderRadius: 7, padding: "3px 8px" }}>{t}</span>
                      )) : <span style={{ fontSize: 11.5, color: C.muted }}>—</span>}
                    </div>
                    {modes.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 1 }}>
                        {modes.map((m) => (
                          <span key={m.key} style={{ fontSize: 10, fontWeight: 700, color: m.color, background: m.bg, borderRadius: 6, padding: "2px 7px" }}>{m.label}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenAccount && onOpenAccount(s.email)}
                    disabled={!onOpenAccount}
                    title={onOpenAccount ? "" : "Accès au compte setter bientôt disponible"}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "9px 14px", borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                      color: onOpenAccount ? C.text : C.muted, fontSize: 12.5, fontWeight: 600,
                      cursor: onOpenAccount ? "pointer" : "not-allowed", fontFamily: "inherit",
                      opacity: onOpenAccount ? 1 : 0.6, transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!onOpenAccount) return; e.currentTarget.style.background = C.accent; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = C.accent; }}
                    onMouseLeave={(e) => { if (!onOpenAccount) return; e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"; e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.border; }}
                  >
                    {onOpenAccount ? "Voir le compte" : "Compte (bientôt)"}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
