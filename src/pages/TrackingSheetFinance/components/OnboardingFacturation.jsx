// src/pages/TrackingSheetFinance/components/OnboardingFacturation.jsx
//
// Validation FACTURATION du RDV d'onboarding Owner + recalage, pour l'équipe
// finance (Aurélie, Ismahane). Demande dev 2026-09-02.
//
// Le point clé du besoin : il n'y a QU'UN rendez-vous, mais DEUX constats
// indépendants. Vincent peut avoir mené son onboarding plateforme alors que la
// facturation n'a pas pu se faire (client sans carte bancaire, etc.). La finance
// pose donc son propre statut, distinct de `rdv_onboarding_done` qui appartient
// au Client Success, et distinct du board Owner/Opti'Lex.
//
// Le recalage, lui, est PARTAGÉ : même rendez-vous, agendas liés. Il déplace la
// date CRM (les sales la voient sur le lead) et les deux événements Google
// (Vincent + facturation), via l'endpoint déjà utilisé par le board.
// Créneaux = exactement ceux de la déclaration de vente (freebusy Vincent +
// facturation), donc aucune règle de disponibilité n'est réinventée ici.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import apiClient from "../../../services/apiClient";

const GREEN = "#15794a";
const NAVY = "#1e2330";
const MUTED = "#8a93a4";
const BORDER = "#e9ebf0";
const RED = "#b42318";
const CARD = "#ffffff";

const todayIso = () =>
  new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });

const dayLabel = (iso) => {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
      weekday: "short", day: "numeric", month: "short",
    });
  } catch { return iso; }
};

// Heure-mur : la date d'onboarding est stockée telle que saisie (convention CRM),
// on l'affiche sans conversion de fuseau.
const whenLabel = (raw) => {
  const s = String(raw || "");
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return s;
  const [, y, mo, d, hh, mm] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
    .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return hh ? `${date} à ${hh}h${mm}` : date;
};

// ── Modale de recalage (réplique du board, non réutilisable telle quelle : elle
//    y est définie en interne). Créneaux et endpoint strictement identiques.
function ReschedModal({ numeroClient, label, onClose, onDone }) {
  const [start, setStart] = useState(todayIso());
  const [days, setDays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiClient.get(`/api/v1/tracking/sale-slots?kind=onboarding&start=${start}&days=7`)
      .then((r) => { if (alive) { setDays(r.days || []); setLoading(false); } })
      .catch(() => { if (alive) { setDays([]); setLoading(false); } });
    return () => { alive = false; };
  }, [start]);

  const shiftWeek = (dir) => {
    const d = new Date(start + "T00:00:00");
    d.setDate(d.getDate() + dir * 7);
    const iso = d.toLocaleDateString("fr-CA");
    setSel(null);
    setStart(iso < todayIso() ? todayIso() : iso);
  };

  const confirm = async () => {
    if (!sel || saving) return;
    setSaving(true); setError(null);
    try {
      await apiClient.post("/api/v1/optilex/board-reschedule-onboarding", {
        numero_client: numeroClient, new_dt: `${sel.date}T${sel.slot}`,
      });
      onDone(`${sel.date}T${sel.slot}`);
    } catch (e) {
      const d = e.data && e.data.detail;
      setError(typeof d === "string" ? d : e.message || "Erreur");
      setSaving(false);
    }
  };

  const shown = (days || []).filter((d) => d.slots && d.slots.length > 0);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 10080, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.42)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "min(640px, 100%)", maxHeight: "82vh", display: "flex",
          flexDirection: "column", background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`,
          boxShadow: "0 24px 60px rgba(17,24,39,0.28)", overflow: "hidden" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Reprogrammer le rendez-vous</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {label} : le créneau change aussi pour Vincent et pour le sales sur le lead
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none",
            cursor: "pointer", color: MUTED, fontSize: 17, lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <button type="button" onClick={() => shiftWeek(-1)} disabled={start <= todayIso()}
            style={{ border: `1px solid ${BORDER}`, background: CARD, borderRadius: 8, padding: "5px 11px",
              fontSize: 12, fontWeight: 600, color: start <= todayIso() ? MUTED : NAVY,
              cursor: start <= todayIso() ? "default" : "pointer", fontFamily: "inherit" }}>← Sem. préc.</button>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>Créneaux libres (Vincent + facturation)</span>
          <button type="button" onClick={() => shiftWeek(1)}
            style={{ border: `1px solid ${BORDER}`, background: CARD, borderRadius: 8, padding: "5px 11px",
              fontSize: 12, fontWeight: 600, color: NAVY, cursor: "pointer", fontFamily: "inherit" }}>Sem. suiv. →</button>
        </div>

        <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: "center", color: MUTED, fontSize: 13 }}>Chargement des créneaux…</div>
          ) : shown.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: MUTED, fontSize: 13 }}>Aucun créneau libre sur cette semaine.</div>
          ) : shown.map((d) => (
            <div key={d.date} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED,
                textTransform: "capitalize", marginBottom: 7 }}>{dayLabel(d.date)}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {d.slots.map((s) => {
                  const on = sel && sel.date === d.date && sel.slot === s.t;
                  return (
                    <button key={s.t} type="button" disabled={!s.free}
                      onClick={() => s.free && setSel({ date: d.date, slot: s.t })}
                      style={{ padding: "6px 12px", borderRadius: 8,
                        border: `1px solid ${on ? GREEN : (s.free ? BORDER : "transparent")}`,
                        background: on ? GREEN : (s.free ? CARD : "#f3f4f6"),
                        color: on ? "#fff" : (s.free ? NAVY : "#c3cad6"),
                        textDecoration: s.free ? "none" : "line-through",
                        fontSize: 12.5, fontWeight: 600, cursor: s.free ? "pointer" : "default",
                        fontFamily: "inherit", transition: "all .12s ease" }}>{s.t}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex",
          alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 12, color: error ? "#b42318" : MUTED, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis" }}>
            {error || (sel ? `Nouveau créneau : ${dayLabel(sel.date)} à ${sel.slot}` : "Sélectionne un créneau")}
          </span>
          <motion.button type="button" whileTap={sel ? { scale: 0.97 } : undefined}
            disabled={!sel || saving} onClick={confirm}
            style={{ padding: "9px 18px", borderRadius: 10, border: "none",
              background: sel ? GREEN : "#e5e8ee", color: sel ? "#fff" : MUTED,
              fontSize: 13, fontWeight: 700, cursor: sel && !saving ? "pointer" : "default",
              fontFamily: "inherit", flexShrink: 0 }}>
            {saving ? "Reprogrammation…" : "Confirmer"}
          </motion.button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ── Bloc principal, inséré dans la section « Rendez-vous » du panneau détail ──
export default function OnboardingFacturation({ numeroClient, boardRow }) {
  const [done, setDone] = useState(!!boardRow?.rdv_onboarding_facturation_done);
  const [when, setWhen] = useState(
    boardRow?.rdv_onboarding_date_manual || boardRow?.rdv_onboarding_date || null
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    setDone(!!boardRow?.rdv_onboarding_facturation_done);
    setWhen(boardRow?.rdv_onboarding_date_manual || boardRow?.rdv_onboarding_date || null);
  }, [boardRow]);

  if (!numeroClient || !boardRow) return null;

  const setStatut = async (value) => {
    if (busy || value === done) return;
    setBusy(true); setErr(null);
    const previous = done;
    setDone(value);                                  // optimiste
    try {
      await apiClient.patch("/api/v1/optilex/board-tracking", {
        numero_client: numeroClient, rdv_onboarding_facturation_done: value,
      });
    } catch (e) {
      setDone(previous);                             // rollback visuel
      const d = e.data && e.data.detail;
      setErr(typeof d === "string" ? d : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  const Choice = ({ value, label, tone }) => {
    const active = done === value;
    return (
      <button type="button" onClick={() => setStatut(value)} disabled={busy}
        style={{ padding: "6px 13px", borderRadius: 8,
          border: `1px solid ${active ? tone : BORDER}`,
          background: active ? tone : CARD,
          color: active ? "#fff" : NAVY,
          fontSize: 12.5, fontWeight: 700, cursor: busy ? "default" : "pointer",
          fontFamily: "inherit", opacity: busy ? 0.6 : 1, transition: "all .12s ease" }}>
        {label}
      </button>
    );
  };

  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12,
      border: `1px solid ${BORDER}`, background: "#fbfcfd" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: NAVY }}>Facturation Owner</div>
        <button type="button" onClick={() => setModal(true)}
          style={{ border: `1px solid ${BORDER}`, background: CARD, borderRadius: 8,
            padding: "5px 11px", fontSize: 12, fontWeight: 600, color: NAVY,
            cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
          Reprogrammer
        </button>
      </div>

      <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
        {when ? whenLabel(when) : "Aucune date de rendez-vous connue"}
      </div>

      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 10 }}>
        Le rendez-vous a-t-il été validé ?
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Choice value label="Validé" tone={GREEN} />
        <Choice value={false} label="Non effectué" tone={RED} />
      </div>

      {err && (
        <div style={{ fontSize: 11, color: RED, marginTop: 8, lineHeight: 1.45 }}>{err}</div>
      )}

      {modal && (
        <ReschedModal
          numeroClient={numeroClient}
          label={boardRow.crm_societe || boardRow.contact_name || numeroClient}
          onClose={() => setModal(false)}
          onDone={(newDt) => { setWhen(newDt); setModal(false); }}
        />
      )}
    </div>
  );
}
