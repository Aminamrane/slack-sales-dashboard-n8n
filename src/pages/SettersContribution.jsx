// src/pages/SettersContribution.jsx
// Contribution des setters, par mois : leads signés dont le setter a placé lui-même le R1 ou le R2, répartis Cold Call
// (leads qu'il a créés ou démarchés) et ADS. Liste sans montant, lue par /api/v1/variables/setters-contribution.
// Seul reste de l'ancienne page /variables : son calcul des variables (mois de signature) a été retiré le 27/10/2026,
// les variables se calculent dans /ceo/variables (une seule page, une vente n'y est versée qu'une fois).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import { makeCharte } from "../styles/charte.js";
import "../index.css";

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const ALLOWED_ROLES = new Set(["admin", "ceo", "hr", "finance_director"]);

const monthLabel = (m) => { const [y, mm] = m.split("-"); return `${MOIS[parseInt(mm, 10) - 1]} ${y}`; };
const shiftMonth = (m, delta) => {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mm - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export default function SettersContributionPage() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);
  const C = makeCharte(darkMode);

  useEffect(() => {
    if (!ALLOWED_ROLES.has(apiClient.getUser()?.role)) navigate("/login");
  }, [navigate]);

  const [month, setMonth] = useState(currentMonth);

  return (
    <div style={{ minHeight: "100vh", background: C.surface, fontFamily: FONT, color: C.text }}>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.accentText, letterSpacing: 0.3 }}>Setters</div>
            <h1 style={{ margin: "4px 0 2px", fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>Contribution des setters</h1>
          </div>
          <MonthPicker C={C} month={month} setMonth={setMonth} />
        </div>
        <SettersContribution C={C} month={month} />
      </div>
    </div>
  );
}

// Leads SIGNÉS où le setter a placé lui-même le R1 ou le R2, répartis Cold Call (origin cc/setter) vs ADS, avec le détail.
function SettersContribution({ C, month }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    let alive = true; setLoading(true);
    apiClient.get(`/api/v1/variables/setters-contribution?month=${month}`)
      .then((r) => { if (alive) setD(r); })
      .catch(() => { if (alive) setD({ setters: [] }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month]);
  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>Chargement…</div>;
  const setters = d?.setters || [];
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12.5, color: C.text2, margin: "0 0 14px" }}>
        Leads <b style={{ color: C.text }}>signés</b> où le setter a placé lui-même le R1 ou le R2, répartis <b style={{ color: C.text }}>Cold Call</b> (leads qu'il a créés / démarchés) vs <b style={{ color: C.text }}>ADS</b>. Clique un setter pour le détail.
      </div>
      {setters.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>Aucune contribution setter.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {setters.map((s) => (
          <div key={s.email} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div onClick={() => setOpen(open === s.email ? null : s.email)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", cursor: "pointer", flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, flex: 1, minWidth: 120 }}>{s.setter}</div>
              <div style={{ fontSize: 13, color: C.text2 }}><b style={{ color: C.text, fontSize: 17 }}>{s.leads}</b> leads signés</div>
              <div style={{ fontSize: 12.5, color: "#0891b2", fontWeight: 600 }}>{s.cc} Cold Call</div>
              <div style={{ fontSize: 12.5, color: "#7c3aed", fontWeight: 600 }}>{s.ads} ADS</div>
              <span style={{ fontSize: 13, color: C.muted }}>{open === s.email ? "▲" : "▼"}</span>
            </div>
            {open === s.email && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "6px 18px 14px" }}>
                {s.detail.map((row, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < s.detail.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0 }}>{row.prospect}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: row.rdv.includes("R1") ? "#3b82f6" : "#fb923c", width: 44, textAlign: "center" }}>{row.rdv}</span>
                    <span style={{ fontSize: 12, color: C.muted, width: 140, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.origin}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: row.canal === "CC" ? "#0891b2" : "#7c3aed", width: 40, textAlign: "right" }}>{row.canal}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthPicker({ C, month, setMonth }) {
  const btn = { width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={btn} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mois précédent">‹</button>
      <div style={{ minWidth: 150, textAlign: "center", fontSize: 15, fontWeight: 600, color: C.text, padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg }}>{monthLabel(month)}</div>
      <button style={btn} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mois suivant">›</button>
    </div>
  );
}
