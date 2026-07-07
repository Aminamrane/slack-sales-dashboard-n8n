import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  "Attente Opti'Lex": { bg: "#fff3e3", fg: "#b45309", dot: "#f59e0b" },
  "En cours":         { bg: "#eaf1fd", fg: "#1e40af", dot: "#2563eb" },
  "En cours de résiliation":  { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "En cours de rétractation": { bg: "#fff3e3", fg: "#b45309", dot: "#f59e0b" },
};
const ETAT_ORDER = ["Signé", "En cours de résiliation", "En cours de rétractation", "Résiliation", "Rétractation", "Self-Résiliation", "Pause", "Liquidation"];
// États que le cabinet peut poser manuellement (badge cliquable, table + fiche).
const ETAT_OPTIONS = ["Signé", "En cours de résiliation", "En cours de rétractation", "Résiliation", "Rétractation", "Self-Résiliation", "Pause", "Liquidation"];

// Volet Opti'Lex actif : planifié (va être envoyé) ou envoyé (en attente signature).
const optilexPending = (r) => r.optilex_status === "scheduled" || r.optilex_status === "ongoing";
// "Attente Opti'Lex" = Owner SIGNÉ mais Opti'Lex encore en attente -> le cabinet doit agir.
const isAttenteOptilex = (r) => r.owner_status === "done" && optilexPending(r);
// "En cours" = Opti'Lex actif mais Owner PAS encore signé (les 2 contrats encore en vol).
const isEnCours = (r) => r.owner_status !== "done" && optilexPending(r);
// RDV à venir (date de RDV >= aujourd'hui à Paris, pas encore effectué) — onglets dédiés.
// Dates stockées en heure-mur Paris labellisée UTC -> on compare les PARTIES date (YYYY-MM-DD),
// indépendamment du fuseau du navigateur, pour coller à l'affichage. Restreint aux lignes avec
// un numéro client (RDV réellement pilotables ; un contrat pas encore résolu n'est pas actionnable).
const _todayParisISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
const isOnboardingUpcoming = (r) => !!r.numero_client && !!r.rdv_onboarding_date && !r.rdv_onboarding_done && String(r.rdv_onboarding_date).slice(0, 10) >= _todayParisISO();
const isIntegrationUpcoming = (r) => !!r.numero_client && !!r.rdv_lancement_date && !r.rdv_lancement_done && String(r.rdv_lancement_date).slice(0, 10) >= _todayParisISO();
// État affiché : l'état du Sheet en priorité, sinon le statut du contrat en cours.
const displayEtat = (r) => {
  if (r.etat_manuel) return r.etat_manuel;   // override manuel du cabinet (prioritaire)
  if (r.etat) return r.etat;                 // état du Sheet (vérité des ÉTATS)
  // Vérité des DATA = interne : signé Owner + Opti'Lex -> "Signé" même pas (encore) dans le Sheet.
  if (r.owner_status === "done" && r.optilex_status === "done") return "Signé";
  if (isAttenteOptilex(r)) return "Attente Opti'Lex";
  if (isEnCours(r)) return "En cours";
  return null;
};
// Valeur affichée = override cabinet si présent, sinon original Owner (antériorité préservée).
const ov = (r, ovrKey, origKey) => (r[ovrKey] != null && r[ovrKey] !== "" ? r[ovrKey] : r[origKey]);
// Clé de ligne stable (les contrats pré-client n'ont pas de numero_client).
const rowKey = (r) => r.row_key || r.numero_client;
// Nom de la société (Sheet/CRM), et nom mis en avant : la PERSONNE (contact CRM) si on
// l'a, sinon la société. Beaucoup de vieux clients n'ont que la société (pas de contrat lié).
const companyName = (r) => r.crm_societe || r.societe_sheet || null;
const primaryName = (r) => ov(r, "contact_name_ovr", "contact_name") || r.crm_societe || r.societe_sheet || "—";
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
const timeAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "à l'instant";
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24); if (j < 30) return `il y a ${j} j`;
  return fmt(iso);
};

const inputStyle = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: TEXT, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

const hashStr = (s) => { let h = 0; const str = s || ""; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; };

function Avatar({ name, n, src, size = 30 }) {
  const c = AVATAR_COLORS[(n != null ? n : hashStr(name)) % AVATAR_COLORS.length];
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.43), fontWeight: 700, flexShrink: 0 }}>{letter}</div>;
}

function EtatBadge({ etat }) {
  const s = ETAT_STYLE[etat] || { bg: "#eef1f6", fg: MUTED, dot: "#cbd2e0" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.fg, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />{etat || "—"}
    </span>
  );
}

// Badge d'état CLIQUABLE : menu pour changer l'état (override cabinet). Read-only si disabled.
// Menu en PORTAL (échappe l'overflow de la table) + fontFamily Inter réappliquée. "Automatique
// (Sheet)" -> onPick(null) efface l'override. Se ferme au scroll/resize ; flip vers le haut.
const ETAT_MENU_H = 360;
function EtatPicker({ etat, onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  if (disabled) return <EtatBadge etat={etat} />;
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const up = r.bottom + ETAT_MENU_H > window.innerHeight && r.top > ETAT_MENU_H;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, up });
    setOpen(true);
  };
  const items = [{ opt: null, label: "Automatique (Sheet)" }, ...ETAT_OPTIONS.map((o) => ({ opt: o, label: o }))];
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} type="button" onClick={toggle} title="Changer l'état"
        style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
        <EtatBadge etat={etat} />
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: "0 8px 28px rgba(17,24,39,0.14)", padding: 5, minWidth: 210, maxHeight: ETAT_MENU_H, overflowY: "auto", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
            {items.map(({ opt, label }) => {
              const st = opt ? (ETAT_STYLE[opt] || {}) : null;
              const sel = opt === etat;
              return (
                <button key={label} type="button" onClick={() => { setOpen(false); onPick(opt); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none",
                    background: sel ? "#f3f4f6" : "transparent", borderRadius: 7, padding: "8px 10px", cursor: "pointer",
                    fontSize: 12.5, fontWeight: 600, color: opt ? TEXT : MUTED, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#f7f8fa"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: st ? (st.dot || "#cbd2e0") : "transparent", border: opt ? "none" : `1.5px dashed ${MUTED}`, flexShrink: 0 }} />
                  {label}
                  {sel && <span style={{ marginLeft: "auto", color: GREEN }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </span>
  );
}

// Petit crayon = modification.
function PencilIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
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

export default function OptilexBoard({ embed = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etatFilter, setEtatFilter] = useState("Signé");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null); // numero_client du client ouvert

  useEffect(() => {
    let alive = true;
    const load = (spinner) => {
      if (spinner) setLoading(true);
      apiClient.get("/api/v1/optilex/board")
        .then((r) => { if (alive) setRows(r.clients || []); })
        .catch((e) => console.error("board load failed", e))
        .finally(() => { if (alive && spinner) setLoading(false); });
    };
    load(true);
    const id = setInterval(() => load(false), 30000);   // temps réel : refetch toutes les 30 s
    return () => { alive = false; clearInterval(id); };
  }, []);

  const counts = useMemo(() => {
    const c = { "En cours": 0, "Attente Opti'Lex": 0 };
    for (const r of rows) {
      const e = displayEtat(r);   // état effectif (override / Sheet / signé interne / attente / en cours)
      if (e) c[e] = (c[e] || 0) + 1;
      if (isOnboardingUpcoming(r)) c["Onboarding à venir"] = (c["Onboarding à venir"] || 0) + 1;
      if (isIntegrationUpcoming(r)) c["Intégration à venir"] = (c["Intégration à venir"] || 0) + 1;
    }
    return c;
  }, [rows]);
  const establishedCount = useMemo(() => rows.filter((r) => !r.is_pending_contract).length, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (etatFilter === "Onboarding à venir") { if (!isOnboardingUpcoming(r)) return false; }
      else if (etatFilter === "Intégration à venir") { if (!isIntegrationUpcoming(r)) return false; }
      else if (etatFilter !== "Tous" && displayEtat(r) !== etatFilter) return false;
      if (ql) {
        const hay = `${ov(r, "contact_name_ovr", "contact_name") || ""} ${r.crm_societe || ""} ${r.societe_sheet || ""} ${r.numero_client || ""} ${ov(r, "email_ovr", "email") || ""}`.toLowerCase();
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
  const TABS = ["Tous", "Attente Opti'Lex", "En cours", "Onboarding à venir", "Intégration à venir", ...ETAT_ORDER];

  const th = { textAlign: "left", padding: "11px 14px", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#f2f4f7", zIndex: 1 };
  const td = { padding: "11px 14px", fontSize: 13, color: TEXT, borderTop: `1px solid ${BORDER}`, verticalAlign: "middle", whiteSpace: "nowrap" };

  return (
    <div style={{ minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : BG, padding: embed ? "10px 24px 28px" : "24px 28px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", color: TEXT }}>
      <style>{`@keyframes obOverlayIn{from{opacity:0}to{opacity:1}}@keyframes obSlideIn{from{transform:translateX(28px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes mailWiggle{0%,100%{transform:translateX(0)}25%{transform:translateX(-2.5px)}75%{transform:translateX(2.5px)}}`}</style>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>Suivi cabinet Opti'Lex</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{establishedCount} clients{counts["Attente Opti'Lex"] ? ` · ${counts["Attente Opti'Lex"]} en attente Opti'Lex` : ""}{counts["En cours"] ? ` · ${counts["En cours"]} en cours` : ""} · temps réel</div>
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
              <col style={{ width: 232 }} />{/* état (large pour "En cours de rétractation", le libellé le plus long) */}
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
                <th style={th}>Intégration</th>
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
                    <td style={td}><EtatPicker etat={displayEtat(r)} disabled={!r.numero_client} onPick={(v) => patch(r.numero_client, { etat_manuel: v })} /></td>
                    <td style={td}><SigCell status={r.owner_status} sentAt={r.owner_sent_at} signedAt={r.owner_signed_at} /></td>
                    <td style={td}><SigCell status={r.optilex_status} sentAt={r.optilex_sent_at} signedAt={r.optilex_signed_at} scheduledAt={r.optilex_scheduled_at} /></td>
                    <td style={{ ...td, color: r.rdv_onboarding_date ? TEXT : "#cbd2e0" }}>{fmt(r.rdv_onboarding_date) || "—"}</td>
                    <td style={{ ...td, color: r.rdv_lancement_date ? TEXT : "#cbd2e0" }}>{fmt(r.rdv_lancement_date) || "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <MiniDot label="O" on={r.facturation_honoraires_done} />
                        <MiniDot label="OL" on={r.setup_facturation_done} />
                        <MiniDot label="+2M" on={r.rdv_plus1mois_done} />
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

// Bloc "Informations client" éditable : affiche override ?? original ; l'édition écrit la
// couche cabinet (optilex_client_tracking) SANS toucher client_data (antériorité Owner préservée).
const INFO_FIELDS = [
  { ovr: "contact_name_ovr", orig: "contact_name", label: "Nom du client" },
  { ovr: "tranche_ovr", orig: "contact_tranche", label: "Tranche salariale" },
  { ovr: "email_ovr", orig: "email", label: "Email" },
  { ovr: "phone_ovr", orig: "contact_phone", label: "Téléphone" },
  { ovr: "siren_ovr", orig: "siren", label: "SIREN" },
];
function ClientInfoSection({ row, num, patch }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const startEdit = () => {
    const d = {};
    INFO_FIELDS.forEach((f) => { d[f.ovr] = ov(row, f.ovr, f.orig) || ""; });
    setDraft(d); setEditing(true);
  };
  const save = () => {
    // Antériorité : on ne pose un override QUE s'il diffère de l'original ; sinon null
    // (efface l'override -> retombe sur l'original Owner, et permet de réinitialiser).
    const out = {};
    INFO_FIELDS.forEach((f) => {
      const v = (draft[f.ovr] || "").trim();
      const orig = (row[f.orig] ?? "").toString();
      out[f.ovr] = v && v !== orig ? v : null;
    });
    patch(num, out);
    setEditing(false);
  };
  const name = ov(row, "contact_name_ovr", "contact_name");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em" }}>Informations client</div>
        {num && !editing && (
          <button type="button" onClick={startEdit} title="Modifier les informations"
            style={{ border: "none", background: "transparent", padding: 3, cursor: "pointer", color: MUTED, display: "inline-flex", lineHeight: 0 }}>
            <PencilIcon size={14} />
          </button>
        )}
      </div>
      {editing ? (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
            {INFO_FIELDS.map((f) => (
              <div key={f.ovr} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>{f.label}</div>
                <input value={draft[f.ovr] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.ovr]: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", fontSize: 13 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button type="button" onClick={() => setEditing(false)}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
            <button type="button" onClick={save}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: NAVY, color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Enregistrer</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px", marginBottom: 22 }}>
          <InfoField label="Nom du client" value={name} />
          <InfoField label="Tranche salariale" value={fmtTranche(ov(row, "tranche_ovr", "contact_tranche"))} />
          <InfoField label="Email" value={ov(row, "email_ovr", "email")} />
          <InfoField label="Téléphone" value={ov(row, "phone_ovr", "contact_phone")} />
          <InfoField label="SIREN" value={ov(row, "siren_ovr", "siren")} />
          {companyName(row) && companyName(row) !== name && <InfoField label="Société" value={companyName(row)} full />}
        </div>
      )}
    </>
  );
}

// Toggle segmenté animé (remplace le dropdown Oui/Non). Pastille qui glisse en
// spring (navy -> vert quand positif) + check qui pop. labels[1] = état positif.
function StatusToggle({ value, onChange, labels = ["Non", "Oui"] }) {
  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", background: "#eef1f6", borderRadius: 9, minWidth: 150, userSelect: "none", flexShrink: 0 }}>
      <motion.div
        animate={{ x: value ? "100%" : "0%", backgroundColor: value ? GREEN : NAVY }}
        transition={{ type: "spring", stiffness: 480, damping: 34 }}
        style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", borderRadius: 9, zIndex: 0, boxShadow: "0 1px 3px rgba(30,35,48,0.18)" }}
      />
      {labels.map((lab, i) => {
        const active = (i === 1) === !!value;
        return (
          <button key={i} type="button" onClick={() => onChange(i === 1)}
            style={{ position: "relative", zIndex: 1, border: "none", background: "transparent", cursor: "pointer",
              padding: "7px 6px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
              color: active ? "#fff" : MUTED, transition: "color 0.25s",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, whiteSpace: "nowrap" }}>
            {i === 1 && (
              <motion.svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
                initial={false} animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }} transition={{ type: "spring", stiffness: 600, damping: 18 }} style={{ overflow: "visible" }}>
                <path d="M20 6 9 17l-5-5" />
              </motion.svg>
            )}
            {lab}
          </button>
        );
      })}
    </div>
  );
}

// Ligne RDV : date (planifiée ou saisie manuellement) + toggle "effectué" + lien (optionnel).
// onDate présent -> crayon pour saisir/modifier la date à la main (antériorité).
function RdvRow({ label, date, done, editable, onToggle, link, onDate }) {
  const [editing, setEditing] = useState(false);
  const cancelRef = useRef(false);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fafbfc" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
        {editing ? (
          <input type="date" autoFocus defaultValue={toDateInput(date)}
            onBlur={(e) => { if (cancelRef.current) { cancelRef.current = false; setEditing(false); return; } onDate(e.target.value || null); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { cancelRef.current = true; setEditing(false); } }}
            style={{ ...inputStyle, width: 156, padding: "6px 9px", fontSize: 13, marginTop: 2 }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: date ? TEXT : "#cbd2e0" }}>{fmt(date) || "—"}</div>
            {onDate && (
              <button type="button" onClick={() => setEditing(true)} title="Saisir/modifier la date"
                style={{ border: "none", background: "transparent", padding: 2, cursor: "pointer", color: MUTED, display: "inline-flex", lineHeight: 0 }}>
                <PencilIcon />
              </button>
            )}
          </div>
        )}
        {link && <RdvLink url={link} />}
      </div>
      {editable && <StatusToggle value={!!done} onChange={onToggle} labels={["À venir", "Effectué"]} />}
    </div>
  );
}

// Lien de prise de RDV (fiscal/social) : ouvrir dans un onglet + copier.
function RdvLink({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.preventDefault(); e.stopPropagation();
    try { navigator.clipboard.writeText(url); } catch { /* fallback: sélection manuelle */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5 }}>
      <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        style={{ fontSize: 11.5, fontWeight: 600, color: NAVY, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        Lien de prise de RDV
      </a>
      <button type="button" onClick={copy}
        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: copied ? GREEN : MUTED, padding: 0, fontFamily: "inherit" }}>
        {copied ? "copié ✓" : "copier"}
      </button>
    </div>
  );
}

// Enveloppe email qui gigote de droite à gauche (attire l'œil sur "Relancer").
function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: "mailWiggle 0.9s ease-in-out infinite" }}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// Lien de signature Opti'Lex (copier) + relance native Yousign (double-clic de confirmation).
function OptilexSignatureBlock({ email }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [relance, setRelance] = useState(null); // null | 'sending' | 'sent' | 'error'

  useEffect(() => {
    let alive = true;
    setLoading(true); setData(null); setConfirming(false); setRelance(null);
    apiClient.get(`/api/v1/optilex/optilex-signature?email=${encodeURIComponent(email)}`)
      .then((r) => { if (alive) { setData(r); setLoading(false); } })
      .catch(() => { if (alive) { setData({ available: false }); setLoading(false); } });
    return () => { alive = false; };
  }, [email]);

  const link = data?.signature_link;
  const canRemind = data?.can_remind;

  const copy = () => {
    if (!link) return;
    try { navigator.clipboard.writeText(link); } catch { /* fallback: sélection manuelle */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  const sendReminder = async () => {
    setRelance("sending"); setConfirming(false);
    try { await apiClient.post("/api/v1/optilex/optilex-reminder", { email }); setRelance("sent"); }
    catch { setRelance("error"); setTimeout(() => setRelance(null), 2600); }
  };

  if (loading) return <div style={{ fontSize: 13, color: MUTED }}>Chargement du lien…</div>;
  if (!data?.available || !link) return <div style={{ fontSize: 13, color: "#cbd2e0" }}>Lien de signature indisponible.</div>;

  const done = relance === "sent";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input readOnly value={link} onFocus={(e) => e.target.select()}
          style={{ ...inputStyle, flex: 1, minWidth: 0, fontSize: 11.5, color: MUTED, background: "#fafbfc" }} />
        <button onClick={copy}
          style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 8, border: "none", background: copied ? GREEN : NAVY, color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s" }}>
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>

      {canRemind && (
        <>
          <div style={{ fontSize: 11.5, color: MUTED, margin: "10px 0 6px" }}>
            Rappel Yousign à <strong style={{ color: TEXT }}>{data.recipient || email}</strong>
          </div>
          <button onClick={confirming ? sendReminder : () => setConfirming(true)}
            onMouseLeave={() => { if (relance !== "sending") setConfirming(false); }}
            disabled={relance === "sending" || done}
            style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 0", borderRadius: 9, border: confirming ? "none" : `1px solid ${NAVY}`, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              background: done ? GREEN : confirming ? "#b42318" : "transparent",
              color: done || confirming ? "#fff" : NAVY, cursor: relance === "sending" || done ? "default" : "pointer", transition: "all 0.2s" }}>
            {!done && relance !== "sending" && <MailIcon />}
            {done ? "Rappel envoyé ✓" : relance === "sending" ? "Envoi…" : relance === "error" ? "Échec, réessayer" : confirming ? "Confirmer l'envoi du rappel" : "Relancer le client"}
          </button>
        </>
      )}
      {!canRemind && <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Rappel indisponible (statut : {data.signer_status || data.optilex_status || "—"}).</div>}
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
          <div style={{ marginTop: 12 }}><EtatPicker etat={displayEtat(row)} disabled={!num} onPick={(v) => patch(num, { etat_manuel: v })} /></div>
        </div>

        <div style={{ padding: "18px 22px 40px" }}>
          {/* Informations client (override cabinet ?? original Owner, antériorité préservée) */}
          <ClientInfoSection row={row} num={num} patch={patch} />

          {/* Signatures */}
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Contrats</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
            {sigBlock("Owner", row.owner_status, row.owner_sent_at, row.owner_signed_at)}
            {sigBlock("Opti'Lex", row.optilex_status, row.optilex_sent_at, row.optilex_signed_at, row.optilex_scheduled_at)}
          </div>

          {/* Lien de signature Opti'Lex + relance (uniquement si le contrat est envoyé) */}
          {row.optilex_status === "ongoing" && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Signature Opti'Lex</div>
              <div style={{ marginBottom: 22 }}><OptilexSignatureBlock email={row.email} /></div>
            </>
          )}

          {/* RDV + statut "effectué" */}
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Rendez-vous</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            <RdvRow label="Rendez-vous Onboarding Owner" date={row.rdv_onboarding_date} done={row.rdv_onboarding_done} editable={!!num}
              onToggle={(v) => patch(num, { rdv_onboarding_done: v })} />
            <RdvRow label="Rendez-vous Intégration Opti'Lex" date={row.rdv_lancement_date} done={row.rdv_lancement_done} editable={!!num}
              onToggle={(v) => patch(num, { rdv_lancement_done: v })} />
            <RdvRow label="Rendez-vous lancement fiscal" date={row.rdv_fiscal_date_manual || row.rdv_fiscal_date} done={row.rdv_fiscal_done} editable={!!num && !!(row.rdv_fiscal_date_manual || row.rdv_fiscal_date)}
              link={!(row.rdv_fiscal_date_manual || row.rdv_fiscal_date) && row.fiscal_url ? row.fiscal_url : null}
              onDate={num ? (d) => patch(num, { rdv_fiscal_date_manual: d }) : undefined}
              onToggle={(v) => patch(num, { rdv_fiscal_done: v })} />
            <RdvRow label="Rendez-vous lancement social" date={row.rdv_social_date_manual || row.rdv_social_date} done={row.rdv_social_done} editable={!!num && !!(row.rdv_social_date_manual || row.rdv_social_date)}
              link={!(row.rdv_social_date_manual || row.rdv_social_date) && row.social_url ? row.social_url : null}
              onDate={num ? (d) => patch(num, { rdv_social_date_manual: d }) : undefined}
              onToggle={(v) => patch(num, { rdv_social_done: v })} />
          </div>

          {/* Jalons éditables (indisponibles tant que le client n'est pas établi) */}
          {num ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Suivi facturation</div>
              <JalonRow label="Statut facturation Owner" done={row.facturation_honoraires_done} date={row.facturation_honoraires_date}
                onToggle={(v) => patch(num, { facturation_honoraires_done: v })} onDate={(d) => patch(num, { facturation_honoraires_date: d })} />
              <JalonRow label="Statut facturation Opti'Lex" done={row.setup_facturation_done} date={row.setup_facturation_date}
                onToggle={(v) => patch(num, { setup_facturation_done: v })} onDate={(d) => patch(num, { setup_facturation_date: d })} />
              <JalonRow label="RDV +2 mois" done={row.rdv_plus1mois_done} date={row.rdv_plus1mois_date}
                onToggle={(v) => patch(num, { rdv_plus1mois_done: v })} onDate={(d) => patch(num, { rdv_plus1mois_date: d })} />

              {/* Commentaires (fil façon YouTube) */}
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", margin: "22px 0 12px" }}>Commentaires{row.comment_count ? ` · ${row.comment_count}` : ""}</div>
              <CommentThread numero={num} />
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
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>{label}</div>
        <StatusToggle value={!!done} onChange={onToggle} />
      </div>
      <AnimatePresence initial={false}>
        {done && (
          <motion.div key="date" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10 }}>
              <input type="date" value={toDateInput(date)} onChange={(e) => onDate(e.target.value || null)}
                style={{ ...inputStyle, width: 168, padding: "7px 10px", fontSize: 12.5 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommentThread({ numero }) {
  const me = useMemo(() => apiClient.getUser() || {}, []);
  const meName = me.name || me.full_name || me.first_name || me.email || "Moi";
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let alive = true;
    setComments([]); setExpanded(false);
    apiClient.get(`/api/v1/optilex/comments?numero_client=${encodeURIComponent(numero)}`)
      .then((r) => { if (alive) setComments(r.comments || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [numero]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const created = await apiClient.post("/api/v1/optilex/comments", { numero_client: numero, body });
      setComments((prev) => [created, ...prev]);
      setDraft("");
    } catch (e) { console.error("comment failed", e); }
    finally { setPosting(false); }
  };

  const shown = expanded ? comments : comments.slice(0, 3);

  return (
    <div>
      {/* Nouveau commentaire */}
      <div style={{ display: "flex", gap: 10, marginBottom: comments.length ? 18 : 4 }}>
        <Avatar name={meName} src={me.avatar_url} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
            placeholder="Ajouter un commentaire…" rows={2}
            style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={submit} disabled={!draft.trim() || posting}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: draft.trim() && !posting ? "pointer" : "default",
                background: draft.trim() ? NAVY : "#e5e7eb", color: draft.trim() ? "#fff" : MUTED, transition: "background 0.2s" }}>
              {posting ? "…" : "Publier"}
            </button>
          </div>
        </div>
      </div>

      {/* Fil */}
      <AnimatePresence initial={false}>
        {shown.map((c) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <Avatar name={c.author_name || c.author_email} size={32} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{c.author_name || c.author_email || "—"}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{timeAgo(c.created_at)}</span>
              </div>
              <div style={{ fontSize: 13.5, color: TEXT, lineHeight: 1.45, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.body}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {comments.length > 3 && (
        <button onClick={() => setExpanded((v) => !v)}
          style={{ border: "none", background: "transparent", color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "2px 0", fontFamily: "inherit" }}>
          {expanded ? "Voir moins" : `Voir plus (${comments.length - 3})`}
        </button>
      )}
      {comments.length === 0 && <div style={{ fontSize: 13, color: "#cbd2e0", marginTop: 6 }}>Aucun commentaire pour l'instant.</div>}
    </div>
  );
}
