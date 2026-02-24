import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

/* ═══════════════════════════════════════════════════════════════════════════
   API LOGIC (commented out — reactivate when switching from mock to real data)
   ═══════════════════════════════════════════════════════════════════════════

   // Access check:
   // const response = await apiClient.get('/api/v1/tracking/my-sheets');
   // if (!response.sheets || response.sheets.length === 0) navigate("/");

   // Fetch leads:
   // const response = await apiClient.get('/api/v1/tracking/my-leads');
   // setLeads(response.leads || []);

   // Update status:
   // await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { status: newStatus });

   // Update date:
   // await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { [field]: newDate || null });

   // Update employee_range:
   // await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { employee_range: range });

   // Update notes:
   // await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { notes: editedNotes });

   ═══════════════════════════════════════════════════════════════════════════ */

// ── CATEGORIES ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "new",          label: "Nouveaux leads",  color: "#6366f1", softBg: "#e0e7ff", softBgDark: "rgba(99,102,241,0.18)",  softText: "#4338ca", description: "Leads assignés, pas encore contactés" },
  { key: "r1",           label: "R1 Placés",       color: "#3b82f6", softBg: "#dbeafe", softBgDark: "rgba(59,130,246,0.18)",  softText: "#1d4ed8", description: "Premier rendez-vous programmé" },
  { key: "r2",           label: "R2 Placés",       color: "#fb923c", softBg: "#ffedd5", softBgDark: "rgba(251,146,60,0.18)",  softText: "#c2410c", description: "Rendez-vous audit programmé" },
  { key: "callback",     label: "À rappeler",      color: "#94a3b8", softBg: "#f1f5f9", softBgDark: "rgba(148,163,184,0.18)", softText: "#64748b", description: "Prospect souhaite être rappelé" },
  { key: "voicemail",    label: "Répondeurs",      color: "#64748b", softBg: "#e2e8f0", softBgDark: "rgba(100,116,139,0.18)", softText: "#475569", description: "Pas de réponse" },
  { key: "not_relevant", label: "Non-pertinents",  color: "#f87171", softBg: "#fecaca", softBgDark: "rgba(248,113,113,0.18)", softText: "#dc2626", description: "Non qualifiés ou pas intéressés" },
  { key: "signed",       label: "Signés",          color: "#34d399", softBg: "#a7f3d0", softBgDark: "rgba(52,211,153,0.18)",  softText: "#059669", description: "Clients signés" },
];

// ── TODAY (for dynamic notifications in demo) ────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

// ── MOCK DATA ─────────────────────────────────────────────────────────────────
const EMPLOYEE_RANGES = [
  '1-2', '3-5', '6-10', '11-19', '20-29',
  '30-39', '40-49', '50-74', '75-99', '100-149',
  '150-199', '200-249', '250-299', '300-349', '350-400'
];

const MOCK_LEADS = [
  // Nouveaux leads (4)
  { id: 1, full_name: "Sophie Martin", company: "Boulangerie du Marais", phone: "06 12 34 56 78", email: "s.martin@boulangeriemarais.fr", headcount: "6-10", revenue: "450K€", origin: "Ads", status: "new", notes: "", assigned_at: "2026-02-20" },
  { id: 2, full_name: "Thomas Dubois", company: "TechVision SAS", phone: "06 98 76 54 32", email: "t.dubois@techvision.fr", headcount: "20-29", revenue: "1.2M€", origin: "Ads", status: "new", notes: "", assigned_at: "2026-02-22" },
  { id: 3, full_name: "Claire Moreau", company: "Atelier Créatif", phone: "07 45 23 67 89", email: "c.moreau@ateliercrea.fr", headcount: "3-5", revenue: "180K€", origin: "CC", status: "new", notes: "", assigned_at: "2026-02-23" },
  { id: 4, full_name: "Marc Lefèvre", company: "Distribution Express", phone: "06 34 56 78 90", email: "m.lefevre@distri-express.fr", headcount: "50-74", revenue: "3.8M€", origin: "Ads", status: "new", notes: "", assigned_at: "2026-02-24" },
  // R1 Placés (3)
  { id: 5, full_name: "Julie Petit", company: "Agence Horizon", phone: "06 55 44 33 22", email: "j.petit@agencehorizon.fr", headcount: "11-19", revenue: "890K€", origin: "Ads", status: "r1", r1: TODAY, notes: "Très intéressée, a déjà un outil concurrent", assigned_at: "2026-02-15" },
  { id: 6, full_name: "Antoine Bernard", company: "Garage Moderne", phone: "07 11 22 33 44", email: "a.bernard@garagemoderne.fr", headcount: "6-10", revenue: "720K€", origin: "Ads", status: "r1", r1: "2026-02-27", notes: "", assigned_at: "2026-02-14" },
  { id: 7, full_name: "Émilie Rousseau", company: "Cabinet Conseil RH", phone: "06 77 88 99 00", email: "e.rousseau@conseilrh.fr", headcount: "30-39", revenue: "2.1M€", origin: "CC", status: "r1", r1: "2026-02-28", notes: "Demande une démo complète", assigned_at: "2026-02-12" },
  // R2 Placés (2)
  { id: 8, full_name: "Pierre Durand", company: "Logistique Plus", phone: "06 22 33 44 55", email: "p.durand@logistiqueplus.fr", headcount: "", revenue: "8.5M€", origin: "Ads", status: "r2", r1: "2026-02-10", r2: TODAY, notes: "Audit planifié, très motivé", assigned_at: "2026-02-05", employee_range: "" },
  { id: 9, full_name: "Nathalie Laurent", company: "Immobilière du Sud", phone: "07 66 55 44 33", email: "n.laurent@immosud.fr", headcount: "", revenue: "4.2M€", origin: "Ads", status: "r2", r1: "2026-02-08", r2: "2026-02-26", notes: "Comparait avec un concurrent", assigned_at: "2026-02-03", employee_range: "40-49" },
  // À rappeler (3)
  { id: 10, full_name: "François Garcia", company: "Restaurant Le Provençal", phone: "06 88 77 66 55", email: "f.garcia@leprovencal.fr", headcount: "11-19", revenue: "650K€", origin: "Ads", status: "callback", notes: "Rappeler lundi matin", assigned_at: "2026-02-18" },
  { id: 11, full_name: "Isabelle Robert", company: "Fleuriste Belle Rose", phone: "07 33 22 11 00", email: "i.robert@bellerose.fr", headcount: "3-5", revenue: "120K€", origin: "Ads", status: "callback", notes: "En réunion, rappeler après 16h", assigned_at: "2026-02-19" },
  { id: 12, full_name: "David Mercier", company: "Auto-École Conduite+", phone: "06 44 55 66 77", email: "d.mercier@conduiteplus.fr", headcount: "6-10", revenue: "380K€", origin: "CC", status: "callback", notes: "", assigned_at: "2026-02-21" },
  // Répondeurs (3)
  { id: 13, full_name: "Christophe Simon", company: "Plomberie Express", phone: "06 99 88 77 66", email: "c.simon@plomberieexpress.fr", headcount: "1-2", revenue: "95K€", origin: "Ads", status: "voicemail", notes: "3 appels sans réponse", assigned_at: "2026-02-10" },
  { id: 14, full_name: "Valérie Leroy", company: "Salon Beauté Chic", phone: "07 55 66 77 88", email: "v.leroy@beautechic.fr", headcount: "3-5", revenue: "210K€", origin: "Ads", status: "voicemail", notes: "", assigned_at: "2026-02-13" },
  { id: 15, full_name: "Stéphane Girard", company: "Imprimerie Rapide", phone: "06 11 00 99 88", email: "s.girard@imprimerierap.fr", headcount: "20-29", revenue: "1.5M€", origin: "Ads", status: "voicemail", notes: "Numéro peut-être erroné", assigned_at: "2026-02-16" },
  // Non-pertinents (2)
  { id: 16, full_name: "Alain Morel", company: "Morel & Fils", phone: "06 00 11 22 33", email: "a.morel@morelfils.fr", headcount: "1-2", revenue: "50K€", origin: "Ads", status: "not_relevant", notes: "Trop petit, pas dans la cible", assigned_at: "2026-02-08" },
  { id: 17, full_name: "Sandrine Faure", company: "Bijouterie Éclat", phone: "07 99 88 77 66", email: "s.faure@bijoueclat.fr", headcount: "1-2", revenue: "75K€", origin: "CC", status: "not_relevant", notes: "Pas intéressée, déjà équipée", assigned_at: "2026-02-11" },
  // Signés (1)
  { id: 18, full_name: "Laurent Blanc", company: "Groupe Blanc Construction", phone: "06 33 44 55 66", email: "l.blanc@groupeblanc.fr", headcount: "75-99", revenue: "6.2M€", origin: "Ads", status: "signed", r1: "2026-01-20", r2: "2026-01-28", notes: "Contrat signé le 05/02. Client très satisfait du process.", assigned_at: "2026-01-15", employee_range: "75-99" },
];

// ── ORIGIN BADGE COLORS ───────────────────────────────────────────────────────
const ORIGIN_COLORS = {
  Ads: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  CC:  { bg: "rgba(99,102,241,0.12)", text: "#6366f1" },
};
const DEFAULT_ORIGIN = { bg: "rgba(107,114,128,0.12)", text: "#6b7280" };

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function TrackingSheet() {
  const navigate = useNavigate();

  // ── DARK MODE ─────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

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

  // ── CARD COLORS ───────────────────────────────────────────────────────────
  const C = {
    bg:        darkMode ? '#1e1f28' : '#ffffff',
    border:    darkMode ? '#2a2b36' : '#e2e6ef',
    surface:   darkMode ? '#13141b' : '#edf0f8',
    text:      darkMode ? '#eef0f6' : '#1e2330',
    muted:     darkMode ? '#5e6273' : '#9ca3af',
    subtle:    darkMode ? '#252636' : '#f4f6fb',
    secondary: darkMode ? '#8b8fa0' : '#6b7280',
    accent:    darkMode ? '#7c8adb' : '#5b6abf',
    shadow:    darkMode
      ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)'
      : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  };

  // ── AUTH ───────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const token = apiClient.getToken();
        const user = apiClient.getUser();
        if (!token || !user) { navigate("/login"); return; }
        setSession({ user: { email: user.email, user_metadata: { name: user.name } } });
      } catch {
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [navigate]);

  // ── LEAD STATE ────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState(MOCK_LEADS);
  const [activeTab, setActiveTab] = useState(0);
  const [expandedCard, setExpandedCard] = useState(null);
  const [exitingCards, setExitingCards] = useState(new Set());
  const [animatingBadges, setAnimatingBadges] = useState(new Set());
  const [editingNotes, setEditingNotes] = useState({});
  const [tabKey, setTabKey] = useState(0); // forces re-animation on tab switch
  const prevCountsRef = useRef(null);

  // ── DERIVED DATA ──────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts = {};
    CATEGORIES.forEach(cat => { counts[cat.key] = 0; });
    leads.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const catKey = CATEGORIES[activeTab].key;
    return leads.filter(l => l.status === catKey && !exitingCards.has(l.id));
  }, [leads, activeTab, exitingCards]);

  // Notification badges: count leads with meetings today per tab
  const tabNotifications = useMemo(() => {
    const notifs = {};
    CATEGORIES.forEach(cat => { notifs[cat.key] = 0; });
    leads.forEach(l => {
      if (l.status === 'r1' && l.r1 === TODAY) notifs.r1++;
      if (l.status === 'r2' && l.r2 === TODAY) notifs.r2++;
    });
    return notifs;
  }, [leads]);

  // Badge bounce when counts change
  useEffect(() => {
    if (prevCountsRef.current) {
      const changed = new Set();
      CATEGORIES.forEach((cat, i) => {
        if (prevCountsRef.current[cat.key] !== tabCounts[cat.key]) changed.add(i);
      });
      if (changed.size > 0) {
        setAnimatingBadges(changed);
        setTimeout(() => setAnimatingBadges(new Set()), 350);
      }
    }
    prevCountsRef.current = { ...tabCounts };
  }, [tabCounts]);

  // ── HANDLERS ──────────────────────────────────────────────────────────────
  const handleTabChange = (idx) => {
    if (idx === activeTab) return;
    setExpandedCard(null);
    setActiveTab(idx);
    setTabKey(k => k + 1);
  };

  const handleStatusChange = (leadId, newStatus) => {
    if (newStatus === CATEGORIES[activeTab].key) return;
    // Animate exit
    setExitingCards(prev => new Set(prev).add(leadId));
    setTimeout(() => {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      setExitingCards(prev => { const s = new Set(prev); s.delete(leadId); return s; });
    }, 380);
  };

  const handleNotesSave = (leadId) => {
    const newNotes = editingNotes[leadId];
    if (newNotes === undefined) return;
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: newNotes } : l));
    setEditingNotes(prev => { const n = { ...prev }; delete n[leadId]; return n; });
    setExpandedCard(null);
  };

  const handleDateChange = (leadId, field, value) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: value } : l));
  };

  const handleEmployeeRangeChange = (leadId, range) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, employee_range: range } : l));
  };

  const handleSendContract = (lead) => {
    alert(`Envoi du contrat pour ${lead.full_name} (${lead.company}) — fonctionnalité bientôt disponible.`);
  };

  const handleRenewContract = (lead) => {
    alert(`Renouvellement du contrat pour ${lead.full_name} (${lead.company}) — fonctionnalité bientôt disponible.`);
  };

  const formatDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.surface }}>
        <p style={{ color: C.muted, fontFamily: "'Inter', sans-serif" }}>Chargement...</p>
      </div>
    );
  }

  const activeCat = CATEGORIES[activeTab];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: 0,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      background: C.surface,
      minHeight: "100vh",
      paddingTop: "80px",
    }}>
      {/* Keyframe animations */}
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
          from { opacity: 0; transform: translateX(-20px) scale(0.98); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes cardSlideOut {
          0%   { opacity: 1; transform: translateX(0) scale(1); }
          100% { opacity: 0; transform: translateX(50px) scale(0.95); max-height: 0; margin-top: 0; margin-bottom: 0; padding: 0; overflow: hidden; }
        }
        @keyframes badgePop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        @keyframes notifPulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
          70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes emptyFade {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes noteExpand {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 300px; }
        }
      `}</style>

      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      {/* ── PAGE CONTAINER ──────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 1100,
        margin: '0 auto 64px',
        padding: '18px',
        background: darkMode ? 'rgba(0,0,0,0.10)' : 'rgba(190,197,215,0.20)',
        borderRadius: '32px',
        animation: 'pageReveal 0.5s cubic-bezier(0.4,0,0.2,1) both',
      }}>

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div style={{ padding: '28px 32px 0', marginBottom: '4px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '26px',
            fontWeight: 700,
            color: C.text,
            letterSpacing: '-0.02em',
          }}>
            Tracking sheet
          </h1>
          <p style={{
            margin: '6px 0 0',
            fontSize: '14px',
            color: C.muted,
          }}>
            {leads.length} leads au total
          </p>
        </div>

        {/* ── INTERCALAIRE TABS ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '2px',
          padding: '20px 32px 0',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map((cat, idx) => {
            const isActive = idx === activeTab;
            const count = tabCounts[cat.key];
            const badgeBounce = animatingBadges.has(idx);
            const notifCount = tabNotifications[cat.key] || 0;

            return (
              <button
                key={cat.key}
                onClick={() => handleTabChange(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: isActive ? '10px 16px 12px' : '10px 14px 10px',
                  borderRadius: '12px 12px 0 0',
                  border: 'none',
                  borderTop: `3px solid ${isActive ? cat.color : cat.color}`,
                  background: isActive ? C.bg : (darkMode ? cat.softBgDark : cat.softBg),
                  color: isActive ? C.text : (darkMode ? cat.color : cat.softText),
                  fontSize: '12.5px',
                  fontWeight: isActive ? 600 : 550,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  opacity: 1,
                  whiteSpace: 'nowrap',
                  position: 'relative',
                  marginBottom: isActive ? '-1px' : '0',
                  zIndex: isActive ? 2 : 1,
                  fontFamily: 'inherit',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = darkMode ? (cat.color + '28') : (cat.color + '25');
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = darkMode ? cat.softBgDark : cat.softBg;
                  }
                }}
              >
                <span>{cat.label}</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 6px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: `${cat.color}20`,
                  color: cat.color,
                  animation: badgeBounce ? 'badgePop 0.3s ease both' : 'none',
                  transition: 'background 0.2s, color 0.2s',
                  fontFamily: 'inherit',
                }}>
                  {count}
                </span>
                {/* Red notification badge */}
                {notifCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    borderRadius: '9px',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    lineHeight: 1,
                    boxShadow: '0 1px 4px rgba(239,68,68,0.4)',
                    animation: 'notifPulse 2s ease-in-out infinite',
                    zIndex: 3,
                  }}>
                    {notifCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── CONTENT AREA ──────────────────────────────────────────────────── */}
        <div style={{
          background: C.bg,
          borderRadius: '0 0 24px 24px',
          border: `1px solid ${C.border}`,
          borderTop: `1px solid ${C.border}`,
          boxShadow: C.shadow,
          minHeight: '400px',
          padding: '24px 28px 32px',
        }}>
          {/* Tab header */}
          <div key={`header-${tabKey}`} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            animation: 'tabFadeIn 0.3s ease-out both',
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: activeCat.color,
              flexShrink: 0,
            }} />
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: C.text,
                letterSpacing: '-0.01em',
              }}>
                {activeCat.label}
              </h2>
              <p style={{
                margin: '2px 0 0',
                fontSize: '13px',
                color: C.muted,
              }}>
                {activeCat.description} — {tabCounts[activeCat.key]} lead{tabCounts[activeCat.key] !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Lead cards */}
          <div key={`cards-${tabKey}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredLeads.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                animation: 'emptyFade 0.4s ease both',
              }}>
                <p style={{ color: C.muted, fontSize: '14px', margin: 0 }}>Aucun lead dans cette catégorie</p>
              </div>
            ) : (
              filteredLeads.map((lead, index) => {
                const isExiting = exitingCards.has(lead.id);
                const isExpanded = expandedCard === lead.id;
                const origin = ORIGIN_COLORS[lead.origin] || DEFAULT_ORIGIN;
                const notesVal = editingNotes[lead.id] !== undefined ? editingNotes[lead.id] : lead.notes;

                return (
                  <div
                    key={lead.id}
                    style={{
                      background: darkMode ? '#16171e' : C.bg,
                      borderRadius: '16px',
                      border: `1px solid ${C.border}`,
                      borderLeft: `4px solid ${activeCat.color}`,
                      boxShadow: C.shadow,
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      animation: isExiting
                        ? 'cardSlideOut 0.38s ease-in forwards'
                        : `cardStaggerIn 0.35s cubic-bezier(0.34,1.56,0.64,1) ${index * 60}ms both`,
                      cursor: 'default',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      if (!isExiting) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = darkMode
                          ? '0 4px 20px rgba(0,0,0,0.35)'
                          : '0 4px 20px rgba(0,0,0,0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = C.shadow;
                    }}
                  >
                    {/* Card content */}
                    <div style={{ padding: '18px 20px' }}>

                      {/* ─ ROW 1: Name + Company + Origin + Date ─ */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '15px',
                              fontWeight: 650,
                              color: C.text,
                              letterSpacing: '-0.01em',
                            }}>
                              {lead.full_name}
                            </span>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '50px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: origin.bg,
                              color: origin.text,
                            }}>
                              {lead.origin}
                            </span>
                          </div>
                          <p style={{
                            margin: '3px 0 0',
                            fontSize: '13px',
                            color: C.secondary,
                            fontWeight: 500,
                          }}>
                            {lead.company}
                          </p>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          color: C.muted,
                          whiteSpace: 'nowrap',
                          marginLeft: '12px',
                          marginTop: '2px',
                        }}>
                          {formatDate(lead.assigned_at)}
                        </span>
                      </div>

                      {/* ─ ROW 2: Info grid ─ */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '8px 16px',
                        marginBottom: '14px',
                      }}>
                        {/* Phone */}
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Tel</div>
                          <div style={{ fontSize: '13px', color: C.text, fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500 }}>{lead.phone}</div>
                        </div>
                        {/* Email */}
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Email</div>
                          <div style={{ fontSize: '13px', color: C.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</div>
                        </div>
                        {/* Headcount */}
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Salariés</div>
                          <div style={{ fontSize: '13px', color: C.text, fontWeight: 500 }}>{lead.headcount}</div>
                        </div>
                        {/* Revenue */}
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>CA</div>
                          <div style={{ fontSize: '13px', color: C.text, fontWeight: 600 }}>{lead.revenue}</div>
                        </div>
                      </div>

                      {/* ─ ROW 3: Dates (if R1/R2 exist) ─ */}
                      {(lead.r1 || lead.r2) && (
                        <div style={{
                          display: 'flex',
                          gap: '16px',
                          marginBottom: '14px',
                          flexWrap: 'wrap',
                        }}>
                          {lead.r1 && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: '8px',
                              background: darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)',
                              border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)'}`,
                            }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>R1</span>
                              <input
                                type="date"
                                value={lead.r1}
                                onChange={(e) => handleDateChange(lead.id, 'r1', e.target.value)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: C.text,
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  fontFamily: 'inherit',
                                  cursor: 'pointer',
                                  padding: 0,
                                  outline: 'none',
                                }}
                              />
                            </div>
                          )}
                          {lead.r2 && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: '8px',
                              background: darkMode ? 'rgba(251,146,60,0.1)' : 'rgba(251,146,60,0.06)',
                              border: `1px solid ${darkMode ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.12)'}`,
                            }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#fb923c', textTransform: 'uppercase' }}>R2</span>
                              <input
                                type="date"
                                value={lead.r2}
                                onChange={(e) => handleDateChange(lead.id, 'r2', e.target.value)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: C.text,
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  fontFamily: 'inherit',
                                  cursor: 'pointer',
                                  padding: 0,
                                  outline: 'none',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* ─ ROW 4: Notes indicator + existing notes ─ */}
                      {lead.notes && !isExpanded && (
                        <div
                          onClick={() => setExpandedCard(lead.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '12px',
                            cursor: 'pointer',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                        >
                          <span style={{ fontSize: '12px', color: C.muted }}>Note :</span>
                          <span style={{
                            fontSize: '12px',
                            color: C.secondary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}>
                            {lead.notes}
                          </span>
                          <span style={{ fontSize: '10px', color: C.muted }}>▼</span>
                        </div>
                      )}

                      {/* Expanded notes editor */}
                      {isExpanded && (
                        <div style={{
                          marginBottom: '12px',
                          animation: 'noteExpand 0.3s ease-out both',
                          overflow: 'hidden',
                        }}>
                          <textarea
                            value={notesVal}
                            onChange={(e) => setEditingNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                            placeholder="Ajouter un commentaire..."
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              border: `1px solid ${C.border}`,
                              background: darkMode ? '#252636' : '#f8f9fc',
                              color: C.text,
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              outline: 'none',
                              transition: 'border-color 0.2s',
                              boxSizing: 'border-box',
                            }}
                            onFocus={(e) => e.target.style.borderColor = C.accent}
                            onBlur={(e) => e.target.style.borderColor = C.border}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => { setExpandedCard(null); setEditingNotes(prev => { const n = { ...prev }; delete n[lead.id]; return n; }); }}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: `1px solid ${C.border}`,
                                background: 'transparent',
                                color: C.secondary,
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => handleNotesSave(lead.id)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: C.accent,
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              Sauvegarder
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ─ ROW 5: Employee range selector (R2 only) ─ */}
                      {activeCat.key === 'r2' && (
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                            Tranche salariale
                          </div>
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                          }}>
                            {EMPLOYEE_RANGES.map(range => {
                              const isSelected = lead.employee_range === range;
                              return (
                                <button
                                  key={range}
                                  onClick={() => handleEmployeeRangeChange(lead.id, range)}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    border: `1px solid ${isSelected ? '#fb923c' : C.border}`,
                                    background: isSelected ? (darkMode ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.1)') : 'transparent',
                                    color: isSelected ? '#fb923c' : C.secondary,
                                    fontSize: '11.5px',
                                    fontWeight: isSelected ? 650 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    fontFamily: 'inherit',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.borderColor = darkMode ? 'rgba(251,146,60,0.4)' : 'rgba(251,146,60,0.3)';
                                      e.currentTarget.style.background = darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.borderColor = C.border;
                                      e.currentTarget.style.background = 'transparent';
                                    }
                                  }}
                                >
                                  {range}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ─ ROW 6: Actions ─ */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                        borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                        paddingTop: '12px',
                      }}>
                        {/* Left: Status change */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: C.muted, fontWeight: 500 }}>Déplacer vers</span>
                          <div style={{ position: 'relative' }}>
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) handleStatusChange(lead.id, e.target.value); }}
                              style={{
                                padding: '6px 28px 6px 10px',
                                borderRadius: '8px',
                                border: `1px solid ${C.border}`,
                                background: C.bg,
                                color: C.text,
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                fontFamily: 'inherit',
                                outline: 'none',
                              }}
                            >
                              <option value="" disabled>Choisir...</option>
                              {CATEGORIES.filter(cat => cat.key !== activeCat.key).map(cat => (
                                <option key={cat.key} value={cat.key}>{cat.label}</option>
                              ))}
                            </select>
                            <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M3 4.5L6 7.5L9 4.5" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Right: Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Comment button */}
                          {!isExpanded && (
                            <button
                              onClick={() => {
                                setExpandedCard(lead.id);
                                if (editingNotes[lead.id] === undefined) {
                                  setEditingNotes(prev => ({ ...prev, [lead.id]: lead.notes || '' }));
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${C.border}`,
                                background: 'transparent',
                                color: C.secondary,
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                fontFamily: 'inherit',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                                e.currentTarget.style.borderColor = C.accent;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = C.border;
                              }}
                            >
                              <span>Commenter</span>
                            </button>
                          )}

                          {/* Send contract — only for R2, requires employee_range */}
                          {activeCat.key === 'r2' && (() => {
                            const hasRange = !!lead.employee_range;
                            return (<>
                            <button
                              onClick={() => hasRange ? handleSendContract(lead) : null}
                              disabled={!hasRange}
                              title={!hasRange ? 'Sélectionnez une tranche salariale d\'abord' : ''}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: hasRange ? '#10b981' : (darkMode ? '#2a2b36' : '#e2e6ef'),
                                color: hasRange ? '#fff' : C.muted,
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: hasRange ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit',
                                opacity: hasRange ? 1 : 0.6,
                              }}
                              onMouseEnter={(e) => {
                                if (hasRange) {
                                  e.currentTarget.style.background = '#059669';
                                  e.currentTarget.style.transform = 'scale(1.03)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = hasRange ? '#10b981' : (darkMode ? '#2a2b36' : '#e2e6ef');
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              <span>Envoyer le contrat</span>
                            </button>
                            <button
                              onClick={() => hasRange ? handleRenewContract(lead) : null}
                              disabled={!hasRange}
                              title={!hasRange ? 'Sélectionnez une tranche salariale d\'abord' : ''}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: hasRange ? '#fb923c' : (darkMode ? '#2a2b36' : '#e2e6ef'),
                                color: hasRange ? '#fff' : C.muted,
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: hasRange ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit',
                                opacity: hasRange ? 1 : 0.6,
                              }}
                              onMouseEnter={(e) => {
                                if (hasRange) {
                                  e.currentTarget.style.background = '#ea580c';
                                  e.currentTarget.style.transform = 'scale(1.03)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = hasRange ? '#fb923c' : (darkMode ? '#2a2b36' : '#e2e6ef');
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              <span>Renouveler</span>
                            </button>
                            </>);
                          })()}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
