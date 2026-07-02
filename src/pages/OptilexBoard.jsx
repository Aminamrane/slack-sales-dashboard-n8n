import { useState, useEffect, useMemo, useCallback } from "react";
import apiClient from "../services/apiClient";

// ── Charte sobre (navy + neutre, style Attio/Linear) ─────────────────────────
const NAVY = "#1e2330";
const BORDER = "#e6e8ee";
const MUTED = "#8a93a4";
const TEXT = "#1e2330";
const BG = "#f7f8fa";
const CARD = "#ffffff";

const ETAT_STYLE = {
  "Signé":            { bg: "#e9f9f0", fg: "#15794a", dot: "#22c55e" },
  "Résiliation":      { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "Rétractation":     { bg: "#fff3e3", fg: "#b45309", dot: "#f59e0b" },
  "Self-Résiliation": { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "Pause":            { bg: "#eef1f6", fg: "#5b6472", dot: "#94a3b8" },
  "Liquidation":      { bg: "#f6e9e9", fg: "#7a271a", dot: "#991b1b" },
};
const ETAT_ORDER = ["Signé", "Résiliation", "Rétractation", "Self-Résiliation", "Pause", "Liquidation"];

const fmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");

const inputStyle = {
  padding: "6px 8px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD,
  color: TEXT, fontSize: 12.5, fontFamily: "inherit", outline: "none",
};

function EtatBadge({ etat }) {
  const s = ETAT_STYLE[etat] || { bg: "#eef1f6", fg: MUTED, dot: "#cbd2e0" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.fg, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />
      {etat || "—"}
    </span>
  );
}

function SignBadge({ status, date }) {
  const done = status === "done";
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: done ? "#15794a" : MUTED }}>
        {done ? "✓ Signé" : status ? "○ " + status : "—"}
      </span>
      {done && date && <span style={{ fontSize: 11, color: MUTED }}>{fmt(date)}</span>}
    </div>
  );
}

function Jalon({ done, date, onToggle, onDate }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <button
        onClick={() => onToggle(!done)}
        style={{
          padding: "4px 11px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", minWidth: 42,
          background: done ? NAVY : "#eef1f6", color: done ? "#fff" : MUTED, transition: "all 0.15s",
        }}
      >{done ? "Oui" : "Non"}</button>
      {done && (
        <input type="date" value={toDateInput(date)} onChange={(e) => onDate(e.target.value || null)}
          style={{ ...inputStyle, padding: "3px 4px", fontSize: 11, width: 106 }} />
      )}
    </div>
  );
}

export default function OptilexBoard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etatFilter, setEtatFilter] = useState("Signé");
  const [q, setQ] = useState("");

  useEffect(() => {
    apiClient.get("/api/v1/optilex/board")
      .then((r) => setRows(r.clients || []))
      .catch((e) => console.error("board load failed", e))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = {};
    for (const r of rows) c[r.etat || "?"] = (c[r.etat || "?"] || 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (etatFilter !== "Tous" && r.etat !== etatFilter) return false;
      if (ql) {
        const hay = `${r.crm_societe || ""} ${r.societe_sheet || ""} ${r.numero_client || ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, etatFilter, q]);

  const patch = useCallback(async (numero, changes) => {
    setRows((prev) => prev.map((r) => (r.numero_client === numero ? { ...r, ...changes } : r)));
    try {
      await apiClient.patch("/api/v1/optilex/board-tracking", { numero_client: numero, ...changes });
    } catch (e) { console.error("patch failed", e); }
  }, []);

  const TABS = ["Tous", ...ETAT_ORDER];

  const th = { textAlign: "left", padding: "8px 8px", fontSize: 10.5, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#f2f4f7", zIndex: 1, overflow: "hidden", textOverflow: "ellipsis" };
  const td = { padding: "8px 8px", fontSize: 12.5, color: TEXT, borderTop: `1px solid ${BORDER}`, verticalAlign: "middle", whiteSpace: "nowrap" };

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "24px 28px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", color: TEXT }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>Suivi cabinet Opti'Lex</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{rows.length} clients · état temps réel (Google Sheet) + signatures + jalons</div>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…"
          style={{ ...inputStyle, width: 260, padding: "9px 12px", fontSize: 13 }} />
      </div>

      {/* Filtres état */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const active = etatFilter === t;
          const n = t === "Tous" ? rows.length : (counts[t] || 0);
          return (
            <button key={t} onClick={() => setEtatFilter(t)}
              style={{
                padding: "7px 14px", borderRadius: 20, border: `1px solid ${active ? NAVY : BORDER}`,
                background: active ? NAVY : CARD, color: active ? "#fff" : TEXT, fontSize: 12.5, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7,
              }}>
              {t}
              <span style={{ fontSize: 11, fontWeight: 700, color: active ? "rgba(255,255,255,0.7)" : MUTED }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, overflowX: "hidden", overflowY: "auto", maxHeight: "calc(100vh - 190px)" }}>
        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: MUTED }}>Chargement…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 210 }} />{/* client */}
              <col style={{ width: 104 }} />{/* état */}
              <col style={{ width: 84 }} />{/* owner */}
              <col style={{ width: 88 }} />{/* opti'lex */}
              <col style={{ width: 74 }} />{/* onboarding */}
              <col style={{ width: 74 }} />{/* lancement */}
              <col style={{ width: 116 }} />{/* fact hono */}
              <col style={{ width: 116 }} />{/* setup */}
              <col style={{ width: 104 }} />{/* rdv +1m */}
              <col />{/* commentaire (reste) */}
            </colgroup>
            <thead>
              <tr>
                <th style={th}>Client</th>
                <th style={th}>État</th>
                <th style={th}>Owner</th>
                <th style={th}>Opti'Lex</th>
                <th style={th}>Onboard.</th>
                <th style={th}>Lancemt</th>
                <th style={th}>Fact. hono.</th>
                <th style={th}>Setup fact.</th>
                <th style={th}>RDV +1M</th>
                <th style={th}>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.numero_client}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.crm_societe || r.societe_sheet || ""}>{r.crm_societe || r.societe_sheet || "—"}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{r.numero_client}</div>
                  </td>
                  <td style={td}><EtatBadge etat={r.etat} /></td>
                  <td style={td}><SignBadge status={r.owner_status} date={r.owner_signed_at} /></td>
                  <td style={td}><SignBadge status={r.optilex_status} date={r.optilex_signed_at} /></td>
                  <td style={td}>{fmt(r.rdv_onboarding_date) || <span style={{ color: MUTED }}>—</span>}</td>
                  <td style={td}>{fmt(r.rdv_lancement_date) || <span style={{ color: MUTED }}>—</span>}</td>
                  <td style={td}>
                    <Jalon done={!!r.facturation_honoraires_done} date={r.facturation_honoraires_date}
                      onToggle={(v) => patch(r.numero_client, { facturation_honoraires_done: v })}
                      onDate={(d) => patch(r.numero_client, { facturation_honoraires_date: d })} />
                  </td>
                  <td style={td}>
                    <Jalon done={!!r.setup_facturation_done} date={r.setup_facturation_date}
                      onToggle={(v) => patch(r.numero_client, { setup_facturation_done: v })}
                      onDate={(d) => patch(r.numero_client, { setup_facturation_date: d })} />
                  </td>
                  <td style={td}>
                    <Jalon done={!!r.rdv_plus1mois_done} date={r.rdv_plus1mois_date}
                      onToggle={(v) => patch(r.numero_client, { rdv_plus1mois_done: v })}
                      onDate={(d) => patch(r.numero_client, { rdv_plus1mois_date: d })} />
                  </td>
                  <td style={{ ...td, whiteSpace: "normal" }}>
                    <CommentCell value={r.commentaire || ""}
                      onSave={(v) => patch(r.numero_client, { commentaire: v })} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: MUTED, padding: "40px 0" }}>Aucun client</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CommentCell({ value, onSave }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <input value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onSave(v); }}
      placeholder="Note…"
      style={{ ...inputStyle, width: "100%", minWidth: 0, boxSizing: "border-box" }} />
  );
}
