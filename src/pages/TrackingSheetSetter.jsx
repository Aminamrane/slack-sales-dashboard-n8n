import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import SetterTabs from "../components/setter/SetterTabs.jsx";
import LeadCardSetter from "../components/setter/LeadCardSetter.jsx";
import PlaceR1R2Modal from "../components/setter/PlaceR1R2Modal.jsx";
import DisqualifyModal from "../components/setter/DisqualifyModal.jsx";
import CreateColdLeadModal from "../components/setter/CreateColdLeadModal.jsx";
import "../index.css";

/**
 * TrackingSheetSetter — page dédiée au rôle `setter`.
 *
 * Deux onglets :
 *  - "Répondeurs équipe" : leads de l'équipe assignée au setter, ayant raté
 *    l'appel (statut voicemail / not_reached). Le setter peut marquer appelé,
 *    placer un R1/R2 sur la sheet du sales propriétaire, ou disqualifier.
 *  - "Mes cold calls" : leads créés par le setter lui-même (cold calls).
 *    Le setter peut placer un R1/R2 en assignant le lead à un sales de
 *    l'équipe (Scénario 2), ou disqualifier.
 *
 * Polling 30s + WS passif pour rafraîchissement temps réel.
 */
export default function TrackingSheetSetter() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  const C = useMemo(
    () => ({
      bg: darkMode ? "#1e1f28" : "#ffffff",
      surface: darkMode ? "#13141b" : "#f6f7f9",
      border: darkMode ? "#2a2b36" : "#e2e6ef",
      text: darkMode ? "#eef0f6" : "#1e2330",
      muted: darkMode ? "#9ca3af" : "#5e6273",
      accent: darkMode ? "#7c8adb" : "#5b6abf",
      success: "#10b981",
    }),
    [darkMode],
  );

  // ── Auth + role guard ─────────────────────────────────────────────────────
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
        // Admin OK + rôle setter OK + permission tracking_sheet_setter
        const isAdmin = me.role === "admin";
        const hasAccess =
          isAdmin || apiClient.hasAccess("tracking_sheet_setter") || me.role === "setter";
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

  // ── Tabs + data ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState("team");
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

  // ── Fetch all (parallel) ─────────────────────────────────────────────────
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

        // team-leads
        if (teamRes && !teamRes.__err) {
          const list = Array.isArray(teamRes)
            ? teamRes
            : teamRes?.leads || teamRes?.data || [];
          setTeamLeads(list);
        }
        // my-leads
        if (mineRes && !mineRes.__err) {
          const list = Array.isArray(mineRes)
            ? mineRes
            : mineRes?.leads || mineRes?.data || [];
          // Tri date desc (created_at fallback id desc)
          list.sort((a, b) => {
            const ta = new Date(a?.created_at || 0).getTime();
            const tb = new Date(b?.created_at || 0).getTime();
            if (tb !== ta) return tb - ta;
            return (b?.id || 0) - (a?.id || 0);
          });
          setMyLeads(list);
        }
        // my-team-sales
        if (salesRes && !salesRes.__err) {
          const list = Array.isArray(salesRes)
            ? salesRes
            : salesRes?.sales || salesRes?.users || salesRes?.data || [];
          setTeamSales(list);
        }

        // Si toutes les requêtes ont échoué, on remonte une erreur
        if (teamRes?.__err && mineRes?.__err && salesRes?.__err) {
          setFetchError(
            teamRes.__err?.message ||
              "Impossible de charger les leads — réessaie dans un instant.",
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

  // Initial fetch + polling 30s
  useEffect(() => {
    if (!authReady || !user) return;
    fetchAll();
    const itv = setInterval(() => fetchAll({ silent: true }), 30000);
    return () => clearInterval(itv);
  }, [authReady, user, fetchAll]);

  // ── WS passif (rafraîchit sur events de la sheet du setter) ─────────────
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
        // Sur un action_toast lié à un lead, on rafraîchit (silencieux)
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

  // ── Modales / état d'action ──────────────────────────────────────────────
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

  // Optimistic remove of a lead from a list (animation sortie)
  const removeFromTeam = (leadId) => {
    setTeamLeads((prev) => prev.filter((l) => String(l.id) !== String(leadId)));
  };
  const removeFromMine = (leadId) => {
    setMyLeads((prev) => prev.filter((l) => String(l.id) !== String(leadId)));
  };

  const handleAction = async (actionKey, lead) => {
    if (!lead?.id) return;
    if (actionKey === "markCalled") {
      // Optimistic : incrémente le compteur, met à jour called_at + called_by
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
        // pas de toast — feedback visuel via le badge
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

  // ── Modal submits ────────────────────────────────────────────────────────
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
      // Animation sortie : on retire le lead de la liste où il vit
      if (fromTab === "team") removeFromTeam(leadId);
      else removeFromMine(leadId);
      showToast(isR2 ? "R2 placé." : "R1 placé.");
      setActiveModal(null);
      // Refresh silencieux
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
      // Le backend renvoie le lead créé (objet) — on l'ajoute en tête
      const newLead = created?.lead || created?.data || created;
      if (newLead && newLead.id) {
        setMyLeads((list) => [newLead, ...list]);
      }
      setTab("mine");
      setActiveModal(null);
      showToast("Cold call créé.");
      // Refresh silencieux pour normaliser depuis la source
      fetchAll({ silent: true });
    } catch (e) {
      console.error("[Setter] create cold failed", e);
      showToast(e?.message || "Échec de la création.", "err");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render guards ────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", background: C.surface }} />
    );
  }
  if (!user) return null;

  const counts = { team: teamLeads.length, mine: myLeads.length };
  const visibleLeads = tab === "team" ? teamLeads : myLeads;

  return (
    <div
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        minHeight: "100vh",
        background: C.surface,
        paddingTop: 78,
        paddingBottom: 64,
        color: C.text,
      }}
    >
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "12px 22px 0",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: C.muted,
                marginBottom: 4,
              }}
            >
              Setter
            </div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: C.text,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Tracking Setter
            </h1>
            <p style={{ fontSize: 13, color: C.muted, margin: "6px 0 0", maxWidth: 560 }}>
              Reprise des répondeurs de l'équipe + tes cold calls. Place les
              R1/R2 directement sur la sheet du sales propriétaire.
            </p>
          </div>

          <button
            onClick={() => openModal("createCold")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 16px",
              borderRadius: 12,
              border: "none",
              background: C.accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: darkMode
                ? "0 6px 18px rgba(124,138,219,0.35)"
                : "0 6px 18px rgba(91,106,191,0.28)",
              transition: "transform 0.12s ease, box-shadow 0.15s ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nouveau cold call
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <SetterTabs value={tab} onChange={setTab} darkMode={darkMode} counts={counts} />
          <div
            style={{
              fontSize: 11.5,
              color: C.muted,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              opacity: refreshing ? 1 : 0.55,
              transition: "opacity 0.2s ease",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: refreshing ? C.success : C.muted,
                transition: "background 0.2s ease",
              }}
            />
            {refreshing ? "Synchronisation…" : "Auto-refresh 30s"}
          </div>
        </div>

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading && (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: C.muted,
                fontSize: 13,
              }}
            >
              Chargement…
            </div>
          )}

          {!loading && fetchError && (
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 12,
                background: darkMode ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#ef4444",
                fontSize: 13,
              }}
            >
              {fetchError}
            </div>
          )}

          {!loading && !fetchError && visibleLeads.length === 0 && (
            <EmptyState tab={tab} darkMode={darkMode} C={C} onCreate={() => openModal("createCold")} />
          )}

          {!loading && !fetchError && visibleLeads.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <AnimatePresence initial={false}>
                {visibleLeads.map((lead) => (
                  <LeadCardSetter
                    key={lead.id}
                    lead={lead}
                    mode={tab === "team" ? "team" : "mine"}
                    darkMode={darkMode}
                    onAction={handleAction}
                    busy={submitting}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
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

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
                  : darkMode
                    ? "rgba(16,185,129,0.95)"
                    : "rgba(16,185,129,0.95)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ tab, darkMode, C, onCreate }) {
  const isTeam = tab === "team";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: "44px 24px",
        textAlign: "center",
        borderRadius: 16,
        background: C.bg,
        border: `1px dashed ${C.border}`,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          margin: "0 auto 12px",
          borderRadius: "50%",
          background: `${C.accent}15`,
          color: C.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
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
          + Nouveau cold call
        </button>
      )}
    </motion.div>
  );
}
