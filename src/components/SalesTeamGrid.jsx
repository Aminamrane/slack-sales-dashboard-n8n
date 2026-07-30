// src/components/SalesTeamGrid.jsx
//
// Grille "Équipe Sales" regroupée PAR ÉQUIPE (capitaine en tête).
// Source unique, utilisée par la page standalone (CeoSalesTeamView) et par
// l'onglet sales_team du CeoDashboard — pour éviter toute duplication.
//
// Données :
//   users : sortie de /api/v1/users/assignable  → [{id, full_name, role, email, avatar_url, unavailable_until}]
//           (déjà filtré is_active=True côté backend, donc les comptes
//            DÉSACTIVÉS n'y sont pas).
//   teams : sortie de /api/v1/teams              → [{id, label, color, captain{id,name,avatar_url}, members[...]}]
//           sert UNIQUEMENT à mapper chaque user → son équipe (via l'id).
//
// Règles d'affichage :
//   - on EXCLUT les comptes test / admin (Youcef Amrane, Test Admin…),
//     repérés par rôle "admin" ou par motif d'email/nom "test".
//   - on regroupe par équipe dans l'ordre de /teams, capitaine d'abord,
//     puis membres par ordre alphabétique.
//   - avatar = vraie photo (avatar_url) avec repli initiales sur la couleur
//     de l'équipe (jamais de violet — écran équipe, cf charte).

import { useMemo, useState } from "react";

const getInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Compte test / admin à ne jamais afficher dans "Équipe Sales".
const isTestOrAdmin = (u) =>
  u.role === "admin" ||
  /@test\.com$/i.test(u.email || "") ||
  /\btest\b/i.test(u.full_name || "");

// Avatar photo-first avec repli initiales. Ring = couleur d'équipe pour le
// capitaine. Fond du repli = couleur d'équipe (cohérent, pas de violet).
function MemberAvatar({ src, name, teamColor, isCaptain }) {
  const [err, setErr] = useState(false);
  const size = 44;
  const base = { width: size, height: size, borderRadius: 14, flexShrink: 0, boxSizing: "border-box" };
  const ring = isCaptain ? `2px solid ${teamColor}` : "2px solid transparent";
  if (src && !err) {
    return <img src={src} alt={name} onError={() => setErr(true)} style={{ ...base, objectFit: "cover", border: ring, background: teamColor }} />;
  }
  return (
    <div style={{ ...base, background: teamColor, border: ring, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>
      {getInitials(name)}
    </div>
  );
}

export default function SalesTeamGrid({ users = [], teams = [], loading = false, C, darkMode, onOpenSheet }) {
  // Regroupement par équipe (capitaine en tête), test/admin exclus.
  const groups = useMemo(() => {
    // id user -> {label, color, isCaptain}
    const teamOf = new Map();
    (teams || []).forEach((t) => {
      if (t.captain) teamOf.set(String(t.captain.id), { label: t.label, color: t.color, isCaptain: true });
      (t.members || []).forEach((m) => teamOf.set(String(m.id), { label: t.label, color: t.color, isCaptain: false }));
    });

    const byLabel = new Map();
    const order = [];
    (teams || []).forEach((t) => {
      byLabel.set(t.label, { label: t.label, color: t.color || "#64748b", members: [] });
      order.push(t.label);
    });
    const orphans = { label: "Sans équipe", color: "#1e2330", members: [] };

    (users || []).filter((u) => !isTestOrAdmin(u)).forEach((u) => {
      const info = teamOf.get(String(u.id));
      const row = { ...u, isCaptain: !!info?.isCaptain, teamColor: info?.color || orphans.color };
      if (info && byLabel.has(info.label)) byLabel.get(info.label).members.push(row);
      else orphans.members.push(row);
    });

    const sortMembers = (a, b) =>
      (Number(b.isCaptain) - Number(a.isCaptain)) ||
      String(a.full_name || a.email).localeCompare(String(b.full_name || b.email), "fr");

    const out = order
      .map((label) => byLabel.get(label))
      .filter((g) => g.members.length > 0);
    out.forEach((g) => g.members.sort(sortMembers));
    if (orphans.members.length) {
      orphans.members.sort(sortMembers);
      out.push(orphans);
    }
    return out;
  }, [users, teams]);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="ceo-card" style={{ padding: "18px 20px", height: 96, animation: `ceoCardPop 0.4s ease ${i * 60}ms both` }}>
            <div style={{ width: "100%", height: "100%", background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderRadius: 8, animation: "ceoPulse 1.4s ease-in-out infinite" }} />
          </div>
        ))}
      </div>
    );
  }

  const total = groups.reduce((n, g) => n + g.members.length, 0);
  if (total === 0) {
    return (
      <div className="ceo-card" style={{ padding: 40, textAlign: "center", color: C.muted, animation: "ceoCardPop 0.4s ease both" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
        <p style={{ fontSize: 14, margin: 0 }}>Aucun commercial trouvé.</p>
      </div>
    );
  }

  let cardIndex = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      {groups.map((g) => (
        <section key={g.label}>
          {/* En-tête d'équipe : pastille couleur + libellé + effectif. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", paddingLeft: 2 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: g.color, flexShrink: 0 }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0, letterSpacing: "-0.01em" }}>{g.label}</h2>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>{g.members.length}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {g.members.map((u) => {
              const name = u.full_name || u.name || u.email;
              const i = cardIndex++;
              return (
                <div key={u.email || u.id} className="ceo-card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: `ceoCardPop 0.4s ease ${Math.min(i, 12) * 45}ms both` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <MemberAvatar src={u.avatar_url} name={name} teamColor={u.teamColor} isCaptain={u.isCaptain} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 14, fontWeight: 650, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                        {u.isCaptain && (
                          <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", color: g.color, background: `${g.color}1f`, padding: "2px 7px", borderRadius: 20 }}>Capitaine</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{u.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenSheet(u.email)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "9px 14px", borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                      color: C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = C.accent; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"; e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.border; }}
                  >
                    Voir tracking sheet
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
