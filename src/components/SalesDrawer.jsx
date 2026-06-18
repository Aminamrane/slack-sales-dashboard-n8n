// Panneau profil d'un commercial (glisse depuis la droite). Profil + historique des absences
// (dates, type, durée, raison) + répartition des leads. But : couper court aux questions des
// utilisateurs. Style charte (neutre, sobre). Le stop/réactivation se fait ici (admin).
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import apiClient from "../services/apiClient";
import { CHARTE_CAT } from "../styles/charte";
import { StopButton } from "./AutoAssignControls";

const fullUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : apiClient.baseUrl + u) : null);
const ROLE = { sales: "Commercial", head_of_sales: "Manager", head_of_sales_manager: "Manager", admin: "Admin" };
const TYPE_LABEL = { conge: "Congé", maladie: "Maladie", absence: "Absence", autre: "Autre", rtt: "RTT", stop_auto_assign: "Stoppé" };
const fmtD = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const fmtDT = (iso) => { const d = new Date(iso); return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h"); };

export default function SalesDrawer({ sales, C, darkMode, isAdmin, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const email = sales?.email;

  const fetchDetail = useCallback(() => {
    if (!email) return;
    setLoading(true);
    apiClient.get(`/api/v1/admin/lead-assignment/sales-detail?email=${encodeURIComponent(email)}`)
      .then(setDetail).catch(() => setDetail({ absences: [] })).finally(() => setLoading(false));
  }, [email]);

  useEffect(() => { setDetail(null); fetchDetail(); }, [fetchDetail]);
  useEffect(() => {
    if (!email) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [email, onClose]);

  if (!sales) return null;
  const av = fullUrl(sales.avatar_url);
  const bonus = sales.elig?.includes(4);
  const handleChanged = (d) => { onChanged?.(d); fetchDetail(); };

  let status = { txt: "Actif aujourd'hui", color: C.ok };
  if (sales.stopped) status = { txt: "Stoppé" + (sales.stopped_since ? " depuis le " + fmtDT(sales.stopped_since) : ""), color: C.slate };
  else if (sales.active_today === false) status = sales.absent_until
    ? { txt: "Absent jusqu'au " + fmtD(sales.absent_until), color: C.warn }
    : { txt: "En repos aujourd'hui", color: C.muted };

  const absences = detail?.absences || [];
  const sectionTitle = (t) => <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, marginBottom: 11 }}>{t}</div>;

  const absenceRow = (a, i) => {
    const stop = a.is_stop;
    const chip = a.current ? { t: "En cours", c: stop ? C.slate : C.warn } : (new Date(a.start_date) > new Date() ? { t: "À venir", c: C.muted } : { t: "Passée", c: C.muted });
    const title = stop ? "Stoppé" : (TYPE_LABEL[a.type] || a.type || "Absence");
    const sub = stop
      ? (a.current ? "Depuis le " + (a.created_at ? fmtDT(a.created_at) : fmtD(a.start_date)) : "Terminé")
      : "Du " + fmtD(a.start_date) + " au " + fmtD(a.end_date) + " · " + a.days + " j";
    return (
      <div key={i} style={{ display: "flex", gap: 12, padding: "11px 0", borderTop: i ? "1px solid " + C.border : "none" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.surface, border: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {stop
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.slate} strokeWidth="2.2" strokeLinecap="round"><line x1="8" y1="5" x2="8" y2="19" /><line x1="16" y1="5" x2="16" y2="19" /></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 650, color: C.text }}>{title}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: chip.c, background: chip.c + "1c", padding: "1px 6px", borderRadius: 5 }}>{chip.t}</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{sub}</div>
          {a.description && <div style={{ fontSize: 11.5, color: C.text2, marginTop: 4, lineHeight: 1.45 }}>{a.description}</div>}
        </div>
      </div>
    );
  };

  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 180, background: "rgba(16,18,24,0.42)", display: "flex", justifyContent: "flex-end", fontFamily: "inherit", animation: "drawerFade 0.18s ease both" }}>
      <div style={{ width: "100%", maxWidth: 424, height: "100%", background: C.bg, borderLeft: "1px solid " + C.border, boxShadow: C.shadowLg, overflowY: "auto", animation: "drawerIn 0.28s cubic-bezier(0.16,1,0.3,1) both" }}>

        {/* En-tête profil */}
        <div style={{ padding: "20px 22px 18px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "flex-start", gap: 13 }}>
          {av ? <img src={av} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", border: "1px solid " + C.border, flexShrink: 0 }} />
              : <div style={{ width: 46, height: 46, borderRadius: "50%", background: C.slate, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 18, flexShrink: 0 }}>{(sales.full_name || "?").charAt(0).toUpperCase()}</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{sales.full_name}</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 1 }}>{ROLE[sales.role] || sales.role || "Commercial"} · {bonus ? "Catégories 1 à 5" : "Catégories 1 à 3"}</div>
          </div>
          <button onClick={onClose} title="Fermer (Échap)" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid " + C.border, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Statut du jour */}
        <div style={{ padding: "16px 22px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 8, background: status.color + "16", color: status.color, fontSize: 12.5, fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: status.color }} />
            {status.txt}
          </div>
          {sales.stopped && sales.stop_reason && <div style={{ fontSize: 12, color: C.text2, marginTop: 9, lineHeight: 1.5 }}>{sales.stop_reason}</div>}
          {sales.credit_total > 0 && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>≈ {sales.credit_total} lead{sales.credit_total > 1 ? "s" : ""} d'écart neutralisés (non rattrapés au retour).</div>}
          {isAdmin && sales.user_id && <div style={{ marginTop: 13 }}><StopButton p={sales} C={C} darkMode={darkMode} onChanged={handleChanged} /></div>}
        </div>

        {/* Historique des absences */}
        <div style={{ padding: "8px 22px 20px", borderTop: "1px solid " + C.border }}>
          {sectionTitle("Absences & arrêts")}
          {loading && <div style={{ fontSize: 12.5, color: C.muted, padding: "6px 0" }}>Chargement...</div>}
          {!loading && absences.length === 0 && <div style={{ fontSize: 12.5, color: C.muted, padding: "6px 0" }}>Aucune absence enregistrée.</div>}
          {!loading && absences.map(absenceRow)}
        </div>

        {/* Répartition des leads */}
        <div style={{ padding: "8px 22px 28px", borderTop: "1px solid " + C.border }}>
          {sectionTitle("Leads reçus par catégorie")}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CHARTE_CAT.map((c) => {
              const elig = sales.elig?.includes(c.c);
              const v = sales.cats?.[String(c.c)] || 0;
              return (
                <div key={c.c} style={{ flex: "1 1 60px", minWidth: 60, textAlign: "center", padding: "9px 6px", borderRadius: 9, background: C.surface, border: "1px solid " + C.border, opacity: elig ? 1 : 0.45 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: elig ? c.color : C.muted, fontVariantNumeric: "tabular-nums" }}>{elig ? v : "—"}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{c.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12.5, color: C.text2, marginTop: 11 }}>Total : <b style={{ color: C.text }}>{sales.total ?? 0}</b> lead{(sales.total ?? 0) > 1 ? "s" : ""} ce cycle.</div>
        </div>
      </div>
    </div>, document.body);
}
