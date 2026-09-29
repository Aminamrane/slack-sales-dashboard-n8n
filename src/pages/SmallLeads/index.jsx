// Page CEO « Leads < 100 k€ » (29/09/2026) : les leads qui ont déclaré moins de 100 000 € de chiffre
// d'affaires, la plupart jamais affectés (l'affectation automatique écarte les moins de 100 000 € de 1 à
// 3 salariés). Consultation avec la créa d'origine, filtres et export CSV. Données :
// GET /ceo-dashboard/small-revenue-leads (admin, CEO).
import { useEffect, useMemo, useState } from "react";
import apiClient from "../../services/apiClient";
import { CreativePopup } from "../../components/CreativePopup";
import { mediaUrl } from "../../utils/mediaUrl";

const PAGE_SIZE = 50;
const STATUS_LABELS = {
  new: "Nouveau", r1: "R1 placé", r2: "R2 placé", r3: "R3 placé", callback: "À rappeler", voicemail: "Répondeur",
  not_relevant: "Non pertinent", not_interested: "Pas intéressé", to_recontact: "À relancer", signed: "Signé",
  unreachable: "Injoignable", wrong_number: "Faux numéro",
};
const ASSIGN_FILTERS = [["all", "Tous"], ["unassigned", "Non affectés"], ["assigned", "Affectés"]];
const PERIODS = [["all", "Tout"], ["30", "30 jours"], ["90", "90 jours"]];

const fmtDateTime = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
}).format(new Date(iso)).replace(" ", " à ") : "");
const fmtInt = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);
const statusLabel = (s) => STATUS_LABELS[s] || (s ? s.replace(/_/g, " ") : "Nouveau");
const revenueLabel = (r) => {
  const s = (r || "").replace(/_/g, " ").trim();
  return /^\d+$/.test(s) ? `${fmtInt(Number(s))} €` : s;
};

// Export : toutes les informations du lead, sur la sélection filtrée (même format que le board :
// virgules, BOM UTF-8 pour les accents dans Excel, fins de ligne CRLF).
const CSV_COLUMNS = [
  ["ID", (l) => l.id], ["Inscrit le", (l) => fmtDateTime(l.created_at)], ["Nom", (l) => l.full_name],
  ["Entreprise", (l) => l.company], ["Email", (l) => l.email], ["Téléphone", (l) => l.phone],
  ["CA déclaré", (l) => revenueLabel(l.revenue)], ["Effectif", (l) => l.headcount], ["Secteur", (l) => l.sector],
  ["SIREN", (l) => l.siren], ["Origine", (l) => l.origin], ["Plateforme", (l) => l.platform], ["Source", (l) => l.source],
  ["Campagne", (l) => l.campaign_name], ["Ad set", (l) => l.adset_name], ["Pub", (l) => l.ad_name],
  ["Formulaire", (l) => l.form_name], ["Créa", (l) => (l.creative ? l.creative.title || l.ad_name : "")],
  ["Lien créa", (l) => (l.creative ? mediaUrl(l.creative.video_url || l.creative.image_url) : "")],
  ["Statut", (l) => statusLabel(l.status)], ["Affecté à", (l) => (l.assigned ? l.assigned_name || l.assigned_to : "Non affecté")],
  ["Affecté le", (l) => (l.assigned ? fmtDateTime(l.assigned_at) : "")],
];
const csvCell = (v) => {
  const s = (v ?? "").toString();
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function exportCsv(rows) {
  const lines = [CSV_COLUMNS.map(([h]) => h), ...rows.map((l) => CSV_COLUMNS.map(([, get]) => get(l)))]
    .map((cells) => cells.map(csvCell).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-moins-100k-${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" })}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SmallLeads({ C, darkMode }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [assign, setAssign] = useState("all");
  const [origin, setOrigin] = useState("");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(0);
  const [creativeOpen, setCreativeOpen] = useState(null); // { creative, rect } : même pop-up que la fiche sales

  useEffect(() => {
    let alive = true;
    apiClient.get("/api/v1/ceo-dashboard/small-revenue-leads")
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError("Impossible de charger les leads. Réessayez dans un instant."); });
    return () => { alive = false; };
  }, []);

  const leads = useMemo(() => data?.leads || [], [data]);
  const origins = useMemo(() => {
    const counts = new Map();
    for (const l of leads) counts.set(l.origin || "Sans origine", (counts.get(l.origin || "Sans origine") || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);
  const kpis = useMemo(() => {
    const since = Date.now() - 30 * 86400000;
    return {
      total: leads.length,
      unassigned: leads.filter((l) => !l.assigned).length,
      recent: leads.filter((l) => l.created_at && new Date(l.created_at).getTime() >= since).length,
    };
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const since = period === "all" ? null : Date.now() - Number(period) * 86400000;
    return leads.filter((l) => {
      if (assign === "unassigned" && l.assigned) return false;
      if (assign === "assigned" && !l.assigned) return false;
      if (origin && (l.origin || "Sans origine") !== origin) return false;
      if (since && !(l.created_at && new Date(l.created_at).getTime() >= since)) return false;
      if (needle) {
        const hay = `${l.full_name || ""} ${l.company || ""} ${l.email || ""} ${l.phone || ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [leads, q, assign, origin, period]);

  useEffect(() => { setPage(0); }, [q, assign, origin, period]);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const card = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow };
  const seg = (active) => ({
    padding: "7px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
    fontWeight: 600, background: active ? C.bg : "transparent", color: active ? C.text : C.secondary,
    boxShadow: active ? (darkMode ? "none" : "0 1px 2px rgba(16,24,40,0.08)") : "none", transition: "background 0.15s, color 0.15s",
  });
  const th = { padding: "10px 12px", fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", fontSize: 12.5, color: C.text, verticalAlign: "top" };
  const sub = { fontSize: 11.5, color: C.secondary, marginTop: 2 };

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1480 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Leads &lt; 100 k€</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: "0 0 22px", maxWidth: 820, lineHeight: 1.55 }}>
        Leads qui ont déclaré moins de 100 000 € de chiffre d'affaires. La plupart ne sont affectés à personne :
        l'affectation automatique écarte les moins de 100 000 € de 1 à 3 salariés.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 220px))", gap: 12, marginBottom: 18 }}>
        {[["Leads < 100 k€", kpis.total], ["Non affectés", kpis.unassigned], ["30 derniers jours", kpis.recent]].map(([label, value]) => (
          <div key={label} style={{ ...card, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{data ? fmtInt(value) : "—"}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, entreprise, e-mail, téléphone"
          style={{ width: 280, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 10, background: C.subtle, border: `1px solid ${C.border}` }}>
          {ASSIGN_FILTERS.map(([key, label]) => <button key={key} type="button" onClick={() => setAssign(key)} style={seg(assign === key)}>{label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 10, background: C.subtle, border: `1px solid ${C.border}` }}>
          {PERIODS.map(([key, label]) => <button key={key} type="button" onClick={() => setPeriod(key)} style={seg(period === key)}>{label}</button>)}
        </div>
        <select value={origin} onChange={(e) => setOrigin(e.target.value)}
          style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
          <option value="">Toutes les origines</option>
          {origins.map(([name, n]) => <option key={name} value={name}>{name} ({n})</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: C.secondary, fontWeight: 600 }}>{fmtInt(filtered.length)} lead{filtered.length > 1 ? "s" : ""}</span>
        <button type="button" onClick={() => exportCsv(filtered)} disabled={!filtered.length}
          style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: filtered.length ? "pointer" : "default", opacity: filtered.length ? 1 : 0.5 }}>
          Exporter en CSV
        </button>
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        {error ? (
          <div role="alert" style={{ padding: 22, fontSize: 13.5, color: "#b42318" }}>{error}</div>
        ) : !data ? (
          <div style={{ padding: 22, fontSize: 13.5, color: C.muted }}>Chargement des leads…</div>
        ) : !filtered.length ? (
          <div style={{ padding: 22, fontSize: 13.5, color: C.muted }}>Aucun lead pour ces filtres.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  {["Inscrit le", "Contact", "Coordonnées", "CA · effectif", "Origine", "Campagne · pub", "Créa", "Statut", "Affecté à"].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((l) => (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.12s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.subtle; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.secondary }}>{fmtDateTime(l.created_at)}</td>
                    <td style={td}><div style={{ fontWeight: 600 }}>{l.full_name || "—"}</div>{l.company && <div style={sub}>{l.company}</div>}</td>
                    <td style={td}>
                      {l.phone && <div style={{ whiteSpace: "nowrap" }}>{l.phone}</div>}
                      {l.email && <a href={`mailto:${l.email}`} style={{ ...sub, display: "block", color: C.accent, textDecoration: "none", overflowWrap: "anywhere" }}>{l.email}</a>}
                    </td>
                    <td style={td}><div style={{ whiteSpace: "nowrap" }}>{revenueLabel(l.revenue)}</div>{l.headcount && <div style={sub}>{String(l.headcount).replace(/_/g, " ")}</div>}</td>
                    <td style={td}><div>{l.origin || "—"}</div>{l.platform && <div style={sub}>{l.platform}</div>}</td>
                    <td style={{ ...td, maxWidth: 240 }}><div style={{ overflowWrap: "anywhere" }}>{l.campaign_name || "—"}</div>{l.ad_name && <div style={{ ...sub, overflowWrap: "anywhere" }}>{l.ad_name}</div>}</td>
                    <td style={td}>
                      {l.creative ? (() => {
                        const thumb = l.creative.image_thumbnail_url || l.creative.video_thumbnail_url || l.creative.image_url;
                        return (
                          <button type="button" title={l.creative.title || l.ad_name || "Voir la créa"}
                            onClick={(e) => setCreativeOpen({ creative: l.creative, rect: e.currentTarget.getBoundingClientRect() })}
                            style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", color: C.accent }}>
                            {thumb && <img src={mediaUrl(thumb)} alt="" loading="lazy" style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }} />}
                            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>Voir la créa</span>
                          </button>
                        );
                      })() : <span style={{ color: C.muted }}>—</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: C.subtle, color: C.secondary }}>{statusLabel(l.status)}</span>
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {l.assigned
                        ? <><div>{l.assigned_name || l.assigned_to}</div>{l.assigned_at && <div style={sub}>{fmtDateTime(l.assigned_at)}</div>}</>
                        : <span style={{ color: C.muted, fontStyle: "italic" }}>Non affecté</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creativeOpen && <CreativePopup creative={creativeOpen.creative} triggerRect={creativeOpen.rect} darkMode={darkMode} onClose={() => setCreativeOpen(null)} />}

      {filtered.length > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 12, fontSize: 12.5, color: C.secondary }}>
          <span>{fmtInt(page * PAGE_SIZE + 1)}–{fmtInt(Math.min((page + 1) * PAGE_SIZE, filtered.length))} sur {fmtInt(filtered.length)}</span>
          {[["Précédent", page > 0, -1], ["Suivant", page < pages - 1, 1]].map(([label, enabled, step]) => (
            <button key={label} type="button" disabled={!enabled} onClick={() => setPage((p) => p + step)}
              style={{ padding: "7px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.bg, color: enabled ? C.text : C.muted, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: enabled ? "pointer" : "default" }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
