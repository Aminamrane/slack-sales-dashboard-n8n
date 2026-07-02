import { useState, useEffect, useMemo, useCallback } from "react";
import apiClient from "../services/apiClient";

// ── Charte sobre (navy + neutre, style Attio/Linear) ─────────────────────────
const NAVY = "#1e2330";
const BORDER = "#e9ebf0";
const MUTED = "#8a93a4";
const TEXT = "#1e2330";
const BG = "#f6f7f9";
const CARD = "#ffffff";
const GREEN = "#15794a";

const ETAT_STYLE = {
  "Signé":            { bg: "#e9f9f0", fg: "#15794a", dot: "#22c55e" },
  "Résiliation":      { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "Rétractation":     { bg: "#fff3e3", fg: "#b45309", dot: "#f59e0b" },
  "Self-Résiliation": { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "Pause":            { bg: "#eef1f6", fg: "#5b6472", dot: "#94a3b8" },
  "Liquidation":      { bg: "#f6e9e9", fg: "#7a271a", dot: "#991b1b" },
  "En cours":         { bg: "#eaf1fd", fg: "#1e40af", dot: "#2563eb" },
};
const ETAT_ORDER = ["Signé", "Résiliation", "Rétractation", "Self-Résiliation", "Pause", "Liquidation"];

// "En cours" = volet Opti'Lex actif : planifié (va être envoyé) ou envoyé (en attente signature).
// Les contrats Owner non splittés (pas de volet Opti'Lex) ne concernent pas le cabinet.
const isEnCours = (r) =>
  r.optilex_status === "scheduled" || r.optilex_status === "ongoing";
// État affiché : l'état du Sheet, ou "En cours" pour un contrat pré-client (pas encore dans le Sheet).
const displayEtat = (r) => r.etat || (r.is_pending_contract ? "En cours" : null);
// Clé de ligne stable (les contrats pré-client n'ont pas de numero_client).
const rowKey = (r) => r.row_key || r.numero_client;
// Nom de la société (Sheet/CRM), et nom mis en avant : la PERSONNE (contact CRM) si on
// l'a, sinon la société. Beaucoup de vieux clients n'ont que la société (pas de contrat lié).
const companyName = (r) => r.crm_societe || r.societe_sheet || null;
const primaryName = (r) => r.contact_name || r.crm_societe || r.societe_sheet || "—";
const rowSubtitle = (r) => {
  const parts = [];
  const comp = companyName(r);
  if (comp && comp !== primaryName(r)) parts.push(comp);
  if (r.numero_client) parts.push(r.numero_client);
  else if (r.email) parts.push(r.email);
  return parts.join(" · ");
};
// Tranche salariale déclarée à la vente (employee_range CRM) -> libellé lisible.
const fmtTranche = (t) => {
  if (!t) return null;
  const s = String(t).trim();
  let m = s.match(/^(\d+)\s*[-_ ]+\s*(\d+)$/);
  if (m) return `${m[1]} à ${m[2]} salariés`;
  m = s.match(/^(\d+)\s*\+$/);
  if (m) return `${m[1]}+ salariés`;
  return s;
};
const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#db2777", "#4f46e5", "#0d9488"];

const fmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");

const inputStyle = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: TEXT, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const selectStyle = { ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", paddingRight: 26 };

function Avatar({ name, n }) {
  const c = AVATAR_COLORS[(n || 0) % AVATAR_COLORS.length];
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return <div style={{ width: 30, height: 30, borderRadius: "50%", background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{letter}</div>;
}

function EtatBadge({ etat }) {
  const s = ETAT_STYLE[etat] || { bg: "#eef1f6", fg: MUTED, dot: "#cbd2e0" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.fg, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />{etat || "—"}
    </span>
  );
}

// Statut de signature riche : signé / envoyé (en attente) / planifié / expiré…
function sigInfo(status, sentAt, signedAt, scheduledAt) {
  if (status === "done") return { label: "Signé", sub: fmt(signedAt), color: GREEN, icon: "✓" };
  if (status === "ongoing") return { label: "Envoyé", sub: fmt(sentAt) + " · en attente", color: "#b45309", icon: "•" };
  if (status === "scheduled") return { label: "Planifié", sub: fmt(scheduledAt), color: "#5b6472", icon: "◷" };
  if (status === "expired") return { label: "Expiré", sub: "", color: "#b42318", icon: "✕" };
  if (status === "canceled") return { label: "Annulé", sub: "", color: "#b42318", icon: "✕" };
  if (status === "failed") return { label: "Échec", sub: "", color: "#b42318", icon: "!" };
  return null;
}
function SigCell({ status, sentAt, signedAt, scheduledAt }) {
  const i = sigInfo(status, sentAt, signedAt, scheduledAt);
  if (!i) return <span style={{ color: "#cbd2e0" }}>—</span>;
  return (
    <div style={{ lineHeight: 1.25 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: i.color }}>{i.icon} {i.label}</div>
      {i.sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{i.sub}</div>}
    </div>
  );
}

export default function OptilexBoard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etatFilter, setEtatFilter] = useState("Signé");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null); // numero_client du client ouvert

  useEffect(() => {
    apiClient.get("/api/v1/optilex/board")
      .then((r) => setRows(r.clients || []))
      .catch((e) => console.error("board load failed", e))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { "En cours": 0 };
    for (const r of rows) {
      if (r.etat) c[r.etat] = (c[r.etat] || 0) + 1;
      if (isEnCours(r)) c["En cours"] += 1;
    }
    return c;
  }, [rows]);
  const establishedCount = useMemo(() => rows.filter((r) => !r.is_pending_contract).length, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (etatFilter === "En cours") { if (!isEnCours(r)) return false; }
      else if (etatFilter !== "Tous" && r.etat !== etatFilter) return false;
      if (ql) {
        const hay = `${r.crm_societe || ""} ${r.societe_sheet || ""} ${r.numero_client || ""} ${r.email || ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, etatFilter, q]);

  const patch = useCallback(async (numero, changes) => {
    if (!numero) return; // contrat pré-client : pas de jalons éditables
    setRows((prev) => prev.map((r) => (r.numero_client === numero ? { ...r, ...changes } : r)));
    try { await apiClient.patch("/api/v1/optilex/board-tracking", { numero_client: numero, ...changes }); }
    catch (e) { console.error("patch failed", e); }
  }, []);

  const selRow = useMemo(() => rows.find((r) => rowKey(r) === selected) || null, [rows, selected]);
  const TABS = ["Tous", "En cours", ...ETAT_ORDER];

  const th = { textAlign: "left", padding: "11px 14px", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#f2f4f7", zIndex: 1 };
  const td = { padding: "11px 14px", fontSize: 13, color: TEXT, borderTop: `1px solid ${BORDER}`, verticalAlign: "middle", whiteSpace: "nowrap" };

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "24px 28px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", color: TEXT }}>
      <style>{`@keyframes obOverlayIn{from{opacity:0}to{opacity:1}}@keyframes obSlideIn{from{transform:translateX(28px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>Suivi cabinet Opti'Lex</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{establishedCount} clients{counts["En cours"] ? ` · ${counts["En cours"]} en cours d'envoi` : ""} · signatures + jalons temps réel</div>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" style={{ ...inputStyle, width: 260, padding: "9px 12px" }} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const active = etatFilter === t;
          const n = t === "Tous" ? rows.length : (counts[t] || 0);
          return (
            <button key={t} onClick={() => setEtatFilter(t)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${active ? NAVY : BORDER}`, background: active ? NAVY : CARD, color: active ? "#fff" : TEXT, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
              {t}<span style={{ fontSize: 11, fontWeight: 700, color: active ? "rgba(255,255,255,0.7)" : MUTED }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, overflowX: "hidden", overflowY: "auto", maxHeight: "calc(100vh - 190px)" }}>
        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: MUTED }}>Chargement…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col />{/* client (reste) */}
              <col style={{ width: 130 }} />{/* état */}
              <col style={{ width: 150 }} />{/* owner */}
              <col style={{ width: 170 }} />{/* opti'lex */}
              <col style={{ width: 108 }} />{/* onboarding */}
              <col style={{ width: 108 }} />{/* lancement */}
              <col style={{ width: 120 }} />{/* facturation */}
              <col style={{ width: 44 }} />{/* chevron */}
            </colgroup>
            <thead>
              <tr>
                <th style={th}>Client</th>
                <th style={th}>État</th>
                <th style={th}>Contrat Owner</th>
                <th style={th}>Contrat Opti'Lex</th>
                <th style={th}>Onboarding</th>
                <th style={th}>Lancement</th>
                <th style={th}>Facturation</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const key = rowKey(r);
                const isSel = selected === key;
                return (
                  <tr key={key} onClick={() => setSelected(key)}
                    style={{ cursor: "pointer", background: isSel ? "#eff3fb" : "transparent" }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "#f7f8fa"; }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <Avatar name={primaryName(r)} n={r.sheet_num} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={primaryName(r)}>{primaryName(r)}</div>
                          <div style={{ fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rowSubtitle(r) || "en cours d'envoi"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}><EtatBadge etat={displayEtat(r)} /></td>
                    <td style={td}><SigCell status={r.owner_status} sentAt={r.owner_sent_at} signedAt={r.owner_signed_at} /></td>
                    <td style={td}><SigCell status={r.optilex_status} sentAt={r.optilex_sent_at} signedAt={r.optilex_signed_at} scheduledAt={r.optilex_scheduled_at} /></td>
                    <td style={{ ...td, color: r.rdv_onboarding_date ? TEXT : "#cbd2e0" }}>{fmt(r.rdv_onboarding_date) || "—"}</td>
                    <td style={{ ...td, color: r.rdv_lancement_date ? TEXT : "#cbd2e0" }}>{fmt(r.rdv_lancement_date) || "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <MiniDot label="O" on={r.facturation_honoraires_done} />
                        <MiniDot label="OL" on={r.setup_facturation_done} />
                        <MiniDot label="+1M" on={r.rdv_plus1mois_done} />
                      </div>
                    </td>
                    <td style={{ ...td, color: MUTED, textAlign: "center" }}>›</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: MUTED, padding: "40px 0" }}>Aucun client</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selRow && <DetailPanel row={selRow} onClose={() => setSelected(null)} patch={patch} />}
    </div>
  );
}

function MiniDot({ label, on }) {
  return (
    <span title={label} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 26, height: 20, padding: "0 5px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: on ? "#e9f9f0" : "#eef1f6", color: on ? GREEN : "#b6bdc9" }}>{label}</span>
  );
}

function InfoField({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: value ? TEXT : "#cbd2e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={value || ""}>{value || "—"}</div>
    </div>
  );
}

// ── PANNEAU DÉTAILS (slide-in droite, façon Notion) ──────────────────────────
function DetailPanel({ row, onClose, patch }) {
  const num = row.numero_client;
  const sigBlock = (title, status, sentAt, signedAt, scheduledAt) => {
    const i = sigInfo(status, sentAt, signedAt, scheduledAt);
    return (
      <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fafbfc" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>{title}</div>
        {i ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: i.color }}>{i.icon} {i.label}</div>
            {sentAt && <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Envoyé le {fmt(sentAt)}</div>}
            {scheduledAt && status === "scheduled" && <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Planifié le {fmt(scheduledAt)}</div>}
            {signedAt && <div style={{ fontSize: 12, color: GREEN, marginTop: 3 }}>Signé le {fmt(signedAt)}</div>}
          </>
        ) : <div style={{ fontSize: 13, color: "#cbd2e0" }}>—</div>}
      </div>
    );
  };
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 9998, animation: "obOverlayIn 0.2s ease both" }} />
      <div style={{ position: "fixed", top: 0, right: 0, height: "100vh", width: 460, maxWidth: "94vw", background: CARD, zIndex: 9999, boxShadow: "-12px 0 40px rgba(0,0,0,0.12)", overflowY: "auto", animation: "obSlideIn 0.28s cubic-bezier(0.22,1,0.36,1) both", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
        {/* Header */}
        <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, background: CARD, zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <Avatar name={primaryName(row)} n={row.sheet_num} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}>{primaryName(row)}</div>
                <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[companyName(row) !== primaryName(row) ? companyName(row) : null, row.numero_client, row.periodicite].filter(Boolean).join(" · ") || row.email || "—"}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "#eef1f6", color: MUTED, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ marginTop: 12 }}><EtatBadge etat={displayEtat(row)} /></div>
        </div>

        <div style={{ padding: "18px 22px 40px" }}>
          {/* Informations client (déclarées à la vente) */}
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Informations client</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px", marginBottom: 22 }}>
            <InfoField label="Nom du client" value={row.contact_name} />
            <InfoField label="Tranche salariale" value={fmtTranche(row.contact_tranche)} />
            <InfoField label="Email" value={row.email} />
            <InfoField label="Téléphone" value={row.contact_phone} />
            {companyName(row) && companyName(row) !== row.contact_name && <InfoField label="Société" value={companyName(row)} full />}
          </div>

          {/* Signatures */}
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Contrats</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
            {sigBlock("Owner", row.owner_status, row.owner_sent_at, row.owner_signed_at)}
            {sigBlock("Opti'Lex", row.optilex_status, row.optilex_sent_at, row.optilex_signed_at, row.optilex_scheduled_at)}
          </div>

          {/* RDV */}
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Rendez-vous</div>
          <div style={{ display: "flex", gap: 24, marginBottom: 22 }}>
            <div><div style={{ fontSize: 12, color: MUTED }}>Onboarding</div><div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(row.rdv_onboarding_date) || "—"}</div></div>
            <div><div style={{ fontSize: 12, color: MUTED }}>Lancement</div><div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(row.rdv_lancement_date) || "—"}</div></div>
          </div>

          {/* Jalons éditables (indisponibles tant que le client n'est pas établi) */}
          {num ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Suivi facturation</div>
              <JalonRow label="Statut facturation Owner" done={row.facturation_honoraires_done} date={row.facturation_honoraires_date}
                onToggle={(v) => patch(num, { facturation_honoraires_done: v })} onDate={(d) => patch(num, { facturation_honoraires_date: d })} />
              <JalonRow label="Statut facturation Opti'Lex" done={row.setup_facturation_done} date={row.setup_facturation_date}
                onToggle={(v) => patch(num, { setup_facturation_done: v })} onDate={(d) => patch(num, { setup_facturation_date: d })} />
              <JalonRow label="RDV +1 mois" done={row.rdv_plus1mois_done} date={row.rdv_plus1mois_date}
                onToggle={(v) => patch(num, { rdv_plus1mois_done: v })} onDate={(d) => patch(num, { rdv_plus1mois_date: d })} />

              {/* Commentaire */}
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", margin: "20px 0 10px" }}>Commentaire</div>
              <CommentBox value={row.commentaire || ""} onSave={(v) => patch(num, { commentaire: v })} />
            </>
          ) : (
            <div style={{ padding: "14px 16px", borderRadius: 10, border: `1px dashed ${BORDER}`, background: "#fafbfc", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
              Contrat en cours d'envoi. Le suivi facturation et les commentaires seront disponibles une fois la vente déclarée (client rattaché).
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function JalonRow({ label, done, date, onToggle, onDate }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>{label}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <select value={done ? "oui" : "non"} onChange={(e) => onToggle(e.target.value === "oui")} style={{ ...selectStyle, width: 86, padding: "7px 8px", paddingRight: 24 }}>
          <option value="non">Non</option>
          <option value="oui">Oui</option>
        </select>
        {done && <input type="date" value={toDateInput(date)} onChange={(e) => onDate(e.target.value || null)} style={{ ...inputStyle, width: 138, padding: "7px 8px", fontSize: 12.5 }} />}
      </div>
    </div>
  );
}

function CommentBox({ value, onSave }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v); }}
      placeholder="Ajouter une note…" rows={4}
      style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.4 }} />
  );
}
