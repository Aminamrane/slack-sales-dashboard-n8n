import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import PlaceR1R2Modal from "../components/setter/PlaceR1R2Modal.jsx";
import DisqualifyModal from "../components/setter/DisqualifyModal.jsx";
import CreateColdLeadModal from "../components/setter/CreateColdLeadModal.jsx";

// Assets — palette identique à TrackingSheet (sidebar logo + note sticker)
import companyLogo from "../assets/my_image.png";
import iconMyLead from "../assets/global.png";
import mynoteIcon from "../assets/mynote.svg";

import "../index.css";

/**
 * TrackingSheetSetter — page dédiée au rôle `setter`.
 *
 * Layout calqué fidèlement sur TrackingSheet :
 *  - Sidebar gauche 220px (logo Owner + item "Mes leads" actif)
 *  - KPI bar 76px (2 KPIs : Mes leads / Répondeurs équipe)
 *  - Content card avec folder tabs ("Nouveau lead" / "Répondeurs") et bouton
 *    "+ Nouveau lead" aligné à droite des tabs
 *  - Cards leads inspirées du `renderLeadCard` de TS (note sticker, pill view,
 *    badges, actions inline)
 *
 * Onglets :
 *  - "Nouveau lead"  (key=mine) : leads cold call créés par le setter
 *  - "Répondeurs"    (key=team) : leads de l'équipe ayant raté l'appel
 *
 * Polling 30s + WS passif pour rafraîchissement temps réel.
 *
 * Aucune touche à TrackingSheet.jsx (sacred zone) au-delà du badge anti-spam
 * livré dans la même session — voir commit séparé.
 */

// ── CATEGORIES (folder tabs setter) ──────────────────────────────────────────
const SETTER_TABS = [
  {
    key: "mine",
    label: "Nouveau lead",
    color: "#6366f1",
    dotColor: "#a8c8f0",
    description: "Cold calls créés par toi",
  },
  {
    key: "team",
    label: "Répondeurs",
    color: "#64748b",
    dotColor: "#94a3b8",
    description: "Répondeurs de l'équipe à reprendre",
  },
];

// ── ORIGIN BADGE COLORS (mêmes que TS) ───────────────────────────────────────
const ORIGIN_COLORS = {
  Ads: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  CC: { bg: "rgba(99,102,241,0.12)", text: "#6366f1" },
};
const DEFAULT_ORIGIN = { bg: "rgba(107,114,128,0.12)", text: "#6b7280" };

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatPhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("33")) {
    const local = "0" + digits.slice(2);
    return local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return raw;
};

const formatDate = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function TrackingSheetSetter() {
  const navigate = useNavigate();

  // ── DARK MODE ─────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.documentElement.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // ── COLOR PALETTE (verbatim TrackingSheet) ────────────────────────────────
  const C = {
    bg: darkMode ? "#1e1f28" : "#ffffff",
    border: darkMode ? "#2a2b36" : "#e2e6ef",
    surface: darkMode ? "#13141b" : "#f6f7f9",
    text: darkMode ? "#eef0f6" : "#1e2330",
    muted: darkMode ? "#5e6273" : "#9ca3af",
    subtle: darkMode ? "#252636" : "#f4f6fb",
    secondary: darkMode ? "#8b8fa0" : "#6b7280",
    accent: darkMode ? "#7c8adb" : "#5b6abf",
    shadow: darkMode
      ? "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)"
      : "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
  };

  // ── AUTH GUARD ────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const token = apiClient.getToken();
        if (!token) {
          navigate("/login");
          return;
        }
        const me = apiClient.getUser();
        if (!me) {
          navigate("/login");
          return;
        }
        const isAdmin = me.role === "admin";
        const hasAccess =
          isAdmin
          || apiClient.hasAccess("tracking_sheet_setter")
          || me.role === "setter";
        if (!hasAccess) {
          navigate("/");
          return;
        }
        setUser(me);
      } catch (e) {
        console.error("[Setter] auth init failed", e);
        navigate("/login");
      } finally {
        setAuthReady(true);
      }
    };
    init();
  }, [navigate]);

  // ── DATA STATE ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("mine"); // default = "Nouveau lead"
  const [teamLeads, setTeamLeads] = useState([]);
  const [myLeads, setMyLeads] = useState([]);
  const [teamSales, setTeamSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Toast
  const [toast, setToast] = useState(null); // { kind: 'ok'|'err', text: string }
  const showToast = useCallback((text, kind = "ok") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ── FETCH ALL (parallel) ─────────────────────────────────────────────────
  const fetchAll = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setFetchError(null);
      try {
        const [teamRes, mineRes, salesRes] = await Promise.all([
          apiClient.get("/api/v1/tracking/setter/team-leads").catch((e) => ({ __err: e })),
          apiClient.get("/api/v1/tracking/setter/my-leads").catch((e) => ({ __err: e })),
          apiClient
            .get("/api/v1/tracking/setter/my-team-sales")
            .catch((e) => ({ __err: e })),
        ]);

        if (teamRes && !teamRes.__err) {
          const list = Array.isArray(teamRes)
            ? teamRes
            : teamRes?.leads || teamRes?.data || [];
          setTeamLeads(list);
        }
        if (mineRes && !mineRes.__err) {
          const list = Array.isArray(mineRes)
            ? mineRes
            : mineRes?.leads || mineRes?.data || [];
          list.sort((a, b) => {
            const ta = new Date(a?.created_at || 0).getTime();
            const tb = new Date(b?.created_at || 0).getTime();
            if (tb !== ta) return tb - ta;
            return (b?.id || 0) - (a?.id || 0);
          });
          setMyLeads(list);
        }
        if (salesRes && !salesRes.__err) {
          const list = Array.isArray(salesRes)
            ? salesRes
            : salesRes?.sales || salesRes?.users || salesRes?.data || [];
          setTeamSales(list);
        }

        if (teamRes?.__err && mineRes?.__err && salesRes?.__err) {
          setFetchError(
            teamRes.__err?.message
              || "Impossible de charger les leads — réessaie dans un instant.",
          );
        }
      } catch (e) {
        console.error("[Setter] fetchAll failed", e);
        setFetchError(e?.message || "Erreur de chargement.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!authReady || !user) return;
    fetchAll();
    const itv = setInterval(() => fetchAll({ silent: true }), 30000);
    return () => clearInterval(itv);
  }, [authReady, user, fetchAll]);

  // ── WS PASSIF ─────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  useEffect(() => {
    if (!authReady || !user?.email) return;
    let ws;
    try {
      const sid = encodeURIComponent(user.email);
      ws = new WebSocket(`wss://ws.ownertechnology.com/ws?sheet_id=${sid}`);
    } catch (e) {
      console.warn("[Setter] WS init failed", e);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      try {
        ws.send(
          JSON.stringify({
            type: "join",
            email: user.email,
            full_name: user.name || user.full_name || "",
            role: user.role || "setter",
            ghost: true,
          }),
        );
      } catch {}
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "action_toast" || msg?.type === "lead_update") {
          fetchAll({ silent: true });
        }
      } catch {}
    };
    ws.onerror = () => {};

    return () => {
      try {
        ws.close();
      } catch {}
      wsRef.current = null;
    };
  }, [authReady, user, fetchAll]);

  // ── MODALES / ACTIONS ─────────────────────────────────────────────────────
  const [activeModal, setActiveModal] = useState(null);
  // activeModal shape: { kind: 'placeR1'|'placeR2'|'disqualify'|'createCold', lead?, mode? }
  const [submitting, setSubmitting] = useState(false);

  const openModal = (kind, lead = null, mode = null) => {
    setActiveModal({ kind, lead, mode });
  };
  const closeModal = () => {
    if (submitting) return;
    setActiveModal(null);
  };

  const removeFromTeam = (leadId) => {
    setTeamLeads((prev) => prev.filter((l) => String(l.id) !== String(leadId)));
  };
  const removeFromMine = (leadId) => {
    setMyLeads((prev) => prev.filter((l) => String(l.id) !== String(leadId)));
  };

  const handleAction = async (actionKey, lead) => {
    if (!lead?.id) return;
    if (actionKey === "markCalled") {
      const prevTeam = teamLeads;
      setTeamLeads((list) =>
        list.map((l) =>
          String(l.id) === String(lead.id)
            ? {
                ...l,
                setter_call_count: Number(l.setter_call_count || 0) + 1,
                setter_called_at: new Date().toISOString(),
                setter_called_by_name:
                  user?.name || user?.full_name || l.setter_called_by_name || "Vous",
              }
            : l,
        ),
      );
      try {
        await apiClient.post(
          `/api/v1/tracking/setter/leads/${lead.id}/mark-called`,
          {},
        );
      } catch (e) {
        console.error("[Setter] mark-called failed", e);
        setTeamLeads(prevTeam);
        showToast(e?.message || "Échec mark-called.", "err");
      }
      return;
    }
    if (actionKey === "placeR1") {
      const mode = tab === "team" ? "team" : "mine";
      openModal("placeR1", lead, mode);
      return;
    }
    if (actionKey === "placeR2") {
      const mode = tab === "team" ? "team" : "mine";
      openModal("placeR2", lead, mode);
      return;
    }
    if (actionKey === "disqualify") {
      openModal("disqualify", lead, tab === "team" ? "team" : "mine");
      return;
    }
  };

  // ── MODAL SUBMITS ─────────────────────────────────────────────────────────
  const submitPlaceRDV = async ({ when, target_sales_email, notes }) => {
    if (!activeModal?.lead?.id) return;
    const leadId = activeModal.lead.id;
    const isR2 = activeModal.kind === "placeR2";
    const fromTab = activeModal.mode === "mine" ? "mine" : "team";
    const path = isR2
      ? `/api/v1/tracking/setter/leads/${leadId}/place-r2`
      : `/api/v1/tracking/setter/leads/${leadId}/place-r1`;
    const body = isR2
      ? { r2_date: when, target_sales_email, notes }
      : { r1_date: when, target_sales_email, notes };

    setSubmitting(true);
    try {
      await apiClient.post(path, body);
      if (fromTab === "team") removeFromTeam(leadId);
      else removeFromMine(leadId);
      showToast(isR2 ? "R2 placé." : "R1 placé.");
      setActiveModal(null);
      fetchAll({ silent: true });
    } catch (e) {
      console.error("[Setter] place RDV failed", e);
      showToast(e?.message || "Échec du placement.", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisqualify = async ({ reason }) => {
    if (!activeModal?.lead?.id) return;
    const leadId = activeModal.lead.id;
    const fromTab = activeModal.mode === "mine" ? "mine" : "team";
    setSubmitting(true);
    try {
      await apiClient.patch(
        `/api/v1/tracking/setter/leads/${leadId}/disqualify`,
        { reason },
      );
      if (fromTab === "team") removeFromTeam(leadId);
      else removeFromMine(leadId);
      showToast("Lead disqualifié.");
      setActiveModal(null);
      fetchAll({ silent: true });
    } catch (e) {
      console.error("[Setter] disqualify failed", e);
      showToast(e?.message || "Échec de la disqualification.", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCreateCold = async (payload) => {
    setSubmitting(true);
    try {
      const created = await apiClient.post(
        "/api/v1/tracking/setter/leads",
        payload,
      );
      const newLead = created?.lead || created?.data || created;
      if (newLead && newLead.id) {
        setMyLeads((list) => [newLead, ...list]);
      }
      setTab("mine");
      setActiveModal(null);
      showToast("Cold call créé.");
      fetchAll({ silent: true });
    } catch (e) {
      console.error("[Setter] create cold failed", e);
      showToast(e?.message || "Échec de la création.", "err");
    } finally {
      setSubmitting(false);
    }
  };

  // ── COUNTS ────────────────────────────────────────────────────────────────
  const counts = { mine: myLeads.length, team: teamLeads.length };
  const visibleLeads = tab === "team" ? teamLeads : myLeads;
  const activeCat = useMemo(
    () => SETTER_TABS.find((t) => t.key === tab) || SETTER_TABS[0],
    [tab],
  );

  // ── RENDER GUARDS ─────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", background: C.surface }} />
    );
  }
  if (!user) return null;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        minHeight: "100vh",
        background: C.surface,
        color: C.text,
        paddingTop: 78,
      }}
    >
      {/* Animations keyframes — répliquées de TrackingSheet (style local, pas
          d'extraction qui toucherait TS). Sous-ensemble strictement nécessaire
          au rendu setter (cards, sidebar, tabs, empty state, copied toast). */}
      <style>{`
        @keyframes pageReveal {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardStaggerIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes noteStickIn {
          0%   { opacity: 0; transform: scale(0.7) translateY(-8px); }
          60%  { opacity: 1; transform: scale(1.04) translateY(1px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes cardSlideOut {
          0%   { opacity: 1; transform: translateX(0) scale(1); }
          30%  { opacity: 0.8; transform: translateX(0) scale(0.97); }
          100% { opacity: 0; transform: translateX(50px) translateY(-6px) scale(0.94); max-height: 0; margin-bottom: 0; padding: 0; overflow: hidden; border-width: 0; }
        }
        @keyframes badgePop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        @keyframes emptyFade {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes sidebarReveal {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes copiedToastIn {
          0%   { opacity: 0; transform: translateY(4px) scale(0.9); }
          30%  { opacity: 1; transform: translateY(-1px) scale(1.02); }
          50%  { transform: translateY(0) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

      {/* ── PAGE CONTAINER ──────────────────────────────────────────────── */}
      <div style={{ animation: "pageReveal 0.5s cubic-bezier(0.4,0,0.2,1) both" }}>

        {/* ── FLEX ROW: sidebar + content ───────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "stretch", minHeight: "calc(100vh - 78px)" }}>

          {/* ── LEFT SIDEBAR ────────────────────────────────────────────── */}
          <div style={{
            width: 220,
            minWidth: 220,
            borderRight: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            background: darkMode ? C.subtle : "#eceef2",
            animation: "sidebarReveal 0.4s ease both",
          }}>
            {/* Sidebar header — logo Owner */}
            <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 8px",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: darkMode ? "rgba(255,255,255,0.04)" : "#fff",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: darkMode ? "#fff" : "#1e2330",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <img src={companyLogo} alt="" style={{ width: 20, height: 20, objectFit: "contain", filter: darkMode ? "none" : "brightness(0) invert(1)" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>Owner</div>
              </div>
            </div>

            {/* Single nav item — "Mes leads" actif (le setter n'a qu'un écran) */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 12px", margin: "1px 12px",
              borderRadius: 10,
              background: darkMode ? "#fff" : "#1e2330",
              color: darkMode ? "#1e2330" : "#fff",
              border: "1px solid transparent",
              transition: "all 0.2s ease",
            }}>
              <div style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img
                  src={iconMyLead}
                  alt=""
                  style={{
                    width: 25, height: 25,
                    opacity: 1,
                    filter: darkMode ? "none" : "brightness(0) invert(1)",
                  }}
                />
              </div>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: darkMode ? "#1e2330" : "#fff",
              }}>
                Mes leads
              </span>
              <span style={{
                marginLeft: "auto", fontSize: 10, fontWeight: 600,
                padding: "2px 6px", borderRadius: 4,
                background: darkMode ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.25)",
                color: darkMode ? "#1e2330" : "#fff",
              }}>
                {counts.mine + counts.team}
              </span>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />
          </div>

          {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "8px 8px 8px 0", gap: 12 }}>

            {/* ── KPI BAR (76px, 2 KPIs simples) ────────────────────────── */}
            <div style={{
              height: 76,
              background: darkMode ? C.bg : "#f6f7f9",
              borderRadius: 8,
              flexShrink: 0,
              border: `1px solid ${C.border}`,
              marginLeft: 8,
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
            }}>
              {(() => {
                const left = [
                  { label: "Mes leads", value: counts.mine, color: SETTER_TABS[0].color },
                  { label: "Répondeurs équipe", value: counts.team, color: SETTER_TABS[1].color },
                ];
                const renderKpi = (kpi, i, arr) => {
                  const valStr = String(kpi.value);
                  const fs = valStr.length > 8 ? 15 : valStr.length > 5 ? 17 : 20;
                  return (
                    <div
                      key={kpi.label}
                      style={{
                        display: "flex", flexDirection: "column",
                        alignItems: "center", gap: 3,
                        borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                        padding: "0 36px", whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontSize: fs, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>{kpi.value}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 500, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{kpi.label}</span>
                    </div>
                  );
                };
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>{left.map(renderKpi)}</div>
                    <div style={{ flex: 1 }} />
                    <div style={{
                      fontSize: 11.5,
                      color: C.muted,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: refreshing ? 1 : 0.55,
                      transition: "opacity 0.2s ease",
                      marginRight: 16,
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: refreshing ? "#10b981" : C.muted,
                        transition: "background 0.2s ease",
                      }} />
                      {refreshing ? "Synchronisation…" : "Auto-refresh 30s"}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ── CONTENT ROW ──────────────────────────────────────────── */}
            <div style={{ flex: 1, display: "flex", minHeight: 0, marginLeft: 8 }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

                {/* ── MAIN CONTENT CARD ────────────────────────────────── */}
                <div style={{
                  flex: 1,
                  background: darkMode ? C.bg : "#f6f7f9",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}>

                  {/* ── FOLDER TABS + bouton + Nouveau lead ─────────────── */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 20px",
                    borderBottom: `1px solid ${C.border}`,
                    background: "transparent",
                  }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {SETTER_TABS.map((cat) => {
                        const isActive = cat.key === tab;
                        const count = counts[cat.key];
                        return (
                          <button
                            key={cat.key}
                            onClick={() => setTab(cat.key)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "7px 14px",
                              borderRadius: 8,
                              border: `1px solid ${isActive ? C.border : "transparent"}`,
                              background: isActive ? (darkMode ? "rgba(255,255,255,0.06)" : "#ffffff") : "transparent",
                              color: isActive ? C.text : C.muted,
                              fontSize: "12.5px",
                              fontWeight: isActive ? 650 : 500,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              whiteSpace: "nowrap",
                              position: "relative",
                              fontFamily: "inherit",
                              letterSpacing: "-0.01em",
                              boxShadow: isActive ? (darkMode ? "none" : "0 1px 3px rgba(0,0,0,0.04)") : "none",
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
                                e.currentTarget.style.color = C.text;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = C.muted;
                              }
                            }}
                          >
                            <span>{cat.label}</span>
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              minWidth: "18px", height: "18px", padding: "0 5px", borderRadius: "9px",
                              fontSize: "10.5px", fontWeight: 700,
                              background: `${cat.color}20`, color: cat.color,
                              fontFamily: "inherit",
                            }}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Bouton "+ Nouveau lead" — aligné à droite des tabs */}
                    <button
                      onClick={() => openModal("createCold")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: C.accent,
                        color: "#fff",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: darkMode
                          ? "0 4px 12px rgba(124,138,219,0.30)"
                          : "0 4px 12px rgba(91,106,191,0.22)",
                        transition: "transform 0.12s ease, box-shadow 0.15s ease",
                        fontFamily: "inherit",
                        letterSpacing: "-0.01em",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Nouveau lead
                    </button>
                  </div>

                  {/* ── BOARD (cards leads) ──────────────────────────────── */}
                  <div style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "16px 20px",
                    animation: "tabFadeIn 0.3s ease-out both",
                  }}>
                    {loading && (
                      <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted, fontSize: 13 }}>
                        Chargement…
                      </div>
                    )}

                    {!loading && fetchError && (
                      <div style={{
                        padding: "16px 18px",
                        borderRadius: 12,
                        background: darkMode ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#ef4444",
                        fontSize: 13,
                      }}>
                        {fetchError}
                      </div>
                    )}

                    {!loading && !fetchError && visibleLeads.length === 0 && (
                      <EmptyState
                        tab={tab}
                        darkMode={darkMode}
                        C={C}
                        onCreate={() => openModal("createCold")}
                      />
                    )}

                    {!loading && !fetchError && visibleLeads.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {visibleLeads.map((lead, idx) => (
                          <SetterLeadCard
                            key={lead.id}
                            lead={lead}
                            mode={tab}
                            activeCat={activeCat}
                            index={idx}
                            darkMode={darkMode}
                            C={C}
                            onAction={handleAction}
                            busy={submitting}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALES ─────────────────────────────────────────────────────── */}
      <PlaceR1R2Modal
        open={activeModal?.kind === "placeR1" || activeModal?.kind === "placeR2"}
        onClose={closeModal}
        onConfirm={submitPlaceRDV}
        kind={activeModal?.kind === "placeR2" ? "r2" : "r1"}
        mode={activeModal?.mode || "team"}
        lead={activeModal?.lead}
        teamSales={teamSales}
        darkMode={darkMode}
        submitting={submitting}
      />
      <DisqualifyModal
        open={activeModal?.kind === "disqualify"}
        onClose={closeModal}
        onConfirm={submitDisqualify}
        lead={activeModal?.lead}
        darkMode={darkMode}
        submitting={submitting}
      />
      <CreateColdLeadModal
        open={activeModal?.kind === "createCold"}
        onClose={closeModal}
        onConfirm={submitCreateCold}
        darkMode={darkMode}
        submitting={submitting}
      />

      {/* ── TOAST ───────────────────────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2200,
            padding: "10px 16px",
            borderRadius: 12,
            background:
              toast.kind === "err"
                ? "rgba(239,68,68,0.95)"
                : "rgba(16,185,129,0.95)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            animation: "toastSlideIn 0.22s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SetterLeadCard — calqué fidèlement sur `renderLeadCard` de TrackingSheet
// ══════════════════════════════════════════════════════════════════════════════
function SetterLeadCard({ lead, mode, activeCat, index, darkMode, C, onAction, busy }) {
  const [hover, setHover] = useState(false);
  const origin = ORIGIN_COLORS[lead.origin] || DEFAULT_ORIGIN;
  const phone = formatPhone(lead.phone);

  const callCount = Number(lead?.setter_call_count || 0);
  const calledByName = lead?.setter_called_by_name || lead?.setter_called_by || null;
  const calledAt = formatDate(lead?.setter_called_at);

  // Sales propriétaire — uniquement utile en mode team
  const ownerSalesName = lead?.assigned_to_name || lead?.assigned_to || null;

  const handle = (key) => (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (busy) return;
    onAction?.(key, lead);
  };

  return (
    <div
      id={`lead-card-${lead.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        borderRadius: "14px",
        border: `1px solid ${
          hover
            ? (darkMode ? "rgba(124,138,219,0.3)" : "rgba(91,106,191,0.25)")
            : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")
        }`,
        background: hover
          ? (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)")
          : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)"),
        transition: "all 0.3s ease",
        animation: `cardStaggerIn 0.5s cubic-bezier(0.34,1.56,0.64,1) ${index * 40}ms both`,
        overflow: "visible",
      }}
    >
      {/* ═══ NOTE STICKER (verbatim) ═══ */}
      {lead.notes && lead.notes.trim() && (
        <img
          src={mynoteIcon}
          alt="Note"
          title={lead.notes}
          style={{
            position: "absolute",
            top: -7,
            left: -14,
            width: 50,
            height: 50,
            objectFit: "contain",
            pointerEvents: "auto",
            zIndex: 2,
            filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.12))",
            transition: "transform 0.2s ease",
            cursor: "default",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        />
      )}

      {/* ═══ PILL VIEW ═══ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "11px 18px",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {/* Category color dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: activeCat.dotColor || activeCat.color,
          flexShrink: 0,
        }} />

        {/* Name */}
        <span style={{
          fontSize: "14px",
          fontWeight: 600,
          color: C.text,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          minWidth: "60px",
          flexShrink: 1,
          letterSpacing: "-0.01em",
        }}>
          {lead.full_name || "Sans nom"}
        </span>

        {/* Sales owner badge — uniquement en mode "team" (Répondeurs) */}
        {mode === "team" && ownerSalesName && (
          <span
            title={`Sales propriétaire : ${ownerSalesName}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 50,
              fontSize: 10, fontWeight: 600, flexShrink: 0,
              background: darkMode ? "rgba(91,106,191,0.18)" : "rgba(91,106,191,0.10)",
              color: C.accent,
              border: `1px solid ${darkMode ? "rgba(91,106,191,0.30)" : "rgba(91,106,191,0.22)"}`,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Sales : {ownerSalesName}
          </span>
        )}

        {/* Origin badge (si défini) */}
        {lead.origin && (
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 8px", borderRadius: "50px",
            fontSize: "10px", fontWeight: 600,
            background: origin.bg, color: origin.text,
            flexShrink: 0,
          }}>
            {lead.origin}
          </span>
        )}

        {/* Compact info pills */}
        {phone && (
          <>
            <span style={{ width: "1px", height: "14px", background: C.border, flexShrink: 0 }} />
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: "12px", color: C.secondary,
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontWeight: 500, flexShrink: 0,
            }}>
              {phone}
            </span>
          </>
        )}
        {lead.headcount && (
          <>
            <span style={{ width: "1px", height: "14px", background: C.border, flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: C.muted, flexShrink: 0 }}>
              <span style={{ fontWeight: 600, color: C.text }}>{lead.headcount}</span> sal.
            </span>
          </>
        )}
        {lead.company_name && (
          <>
            <span style={{ width: "1px", height: "14px", background: C.border, flexShrink: 0 }} />
            <span style={{
              fontSize: "11px", color: C.secondary, fontWeight: 500, flexShrink: 0,
              maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {lead.company_name}
            </span>
          </>
        )}
        {lead.sector && (
          <>
            <span style={{ width: "1px", height: "14px", background: C.border, flexShrink: 0 }} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: C.accent, flexShrink: 0 }}>
              {lead.sector}
            </span>
          </>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* SMS count badge (verbatim TS) */}
        {lead.sms_count > 0 && (
          <span
            title={`${lead.sms_count} SMS envoyé${lead.sms_count > 1 ? "s" : ""}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "2px 8px", borderRadius: 50, fontSize: 10, fontWeight: 650, flexShrink: 0,
              background: darkMode ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.08)",
              color: "#10b981",
              border: "1px solid rgba(16,185,129,0.2)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {lead.sms_count}
          </span>
        )}

        {/* Badge "Appelé ×N par [setter]" — couleur success vert (statut interne setter) */}
        {callCount > 0 && (
          <span
            title={
              calledByName
                ? `Dernier appel : ${calledByName}${calledAt ? ` • ${calledAt}` : ""}`
                : undefined
            }
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 10px", borderRadius: 50,
              fontSize: 11, fontWeight: 650, flexShrink: 0,
              background: darkMode ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.08)",
              color: "#10b981",
              border: "1px solid rgba(16,185,129,0.2)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Appelé{callCount > 1 ? ` ×${callCount}` : ""}
            {calledByName && (
              <span style={{ color: C.muted, fontWeight: 500, marginLeft: 2 }}>
                par {calledByName}
              </span>
            )}
          </span>
        )}

        {/* Date assignation / création */}
        <span style={{
          fontSize: "10px", color: C.muted, flexShrink: 0, whiteSpace: "nowrap",
        }}>
          {formatDate(lead.assigned_at || lead.created_at)}
        </span>
      </div>

      {/* ═══ ACTIONS INLINE ═══ */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "0 18px 12px",
        borderTop: `1px solid ${darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
        paddingTop: 10,
        marginTop: 0,
      }}>
        {mode === "team" && (
          <ActionBtn
            onClick={handle("markCalled")}
            color="#10b981"
            variant="soft"
            darkMode={darkMode}
            busy={busy}
          >
            Marquer appelé{callCount > 0 ? ` (${callCount})` : ""}
          </ActionBtn>
        )}
        <ActionBtn onClick={handle("placeR1")} color="#3b82f6" darkMode={darkMode} busy={busy}>
          Placer R1
        </ActionBtn>
        <ActionBtn
          onClick={handle("placeR2")}
          color={darkMode ? "#a78bfa" : "#7c3aed"}
          darkMode={darkMode}
          busy={busy}
        >
          Placer R2
        </ActionBtn>
        <ActionBtn
          onClick={handle("disqualify")}
          color="#ef4444"
          variant="ghost"
          darkMode={darkMode}
          busy={busy}
        >
          Disqualifier
        </ActionBtn>
      </div>
    </div>
  );
}

// ── ActionBtn ────────────────────────────────────────────────────────────────
function ActionBtn({ children, onClick, color, variant = "primary", darkMode, busy }) {
  const [h, setH] = useState(false);
  const bg =
    variant === "ghost"
      ? "transparent"
      : variant === "soft"
        ? `${color}${darkMode ? "22" : "14"}`
        : color;
  const fg = variant === "primary" ? "#fff" : color;
  const border =
    variant === "ghost"
      ? `1px solid ${darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.12)"}`
      : variant === "soft"
        ? `1px solid ${color}30`
        : "none";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 600,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.55 : 1,
        transform: h && !busy ? "translateY(-1px)" : "none",
        transition: "transform 0.12s ease, background 0.15s ease, opacity 0.15s ease",
        fontFamily: "inherit",
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </button>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ tab, darkMode, C, onCreate }) {
  const isTeam = tab === "team";
  return (
    <div
      style={{
        padding: "52px 24px",
        textAlign: "center",
        borderRadius: 14,
        background: darkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)",
        border: `1px dashed ${C.border}`,
        animation: "emptyFade 0.4s ease both",
      }}
    >
      <div style={{
        width: 44, height: 44, margin: "0 auto 12px",
        borderRadius: "50%",
        background: `${C.accent}15`,
        color: C.accent,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isTeam ? (
            <>
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </>
          ) : (
            <>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </>
          )}
        </svg>
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>
        {isTeam ? "Aucun répondeur à reprendre" : "Aucun cold call pour le moment"}
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, maxWidth: 360, margin: "0 auto 14px" }}>
        {isTeam
          ? "Tous les leads de l'équipe ont été traités. Reviens plus tard ou crée un cold call."
          : "Crée ton premier cold call pour le faire suivre par un sales."}
      </div>
      {!isTeam && (
        <button
          onClick={onCreate}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: C.accent,
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          + Nouveau lead
        </button>
      )}
    </div>
  );
}
