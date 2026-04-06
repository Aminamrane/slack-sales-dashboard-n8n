import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient"; // Still needed for clients, Info, tracking_sheets
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

const COLORS = {
  primary: "#6366f1",
  secondary: "#fb923c",
  tertiary: "#10b981",
};

export default function LeadsManagement({ embedded = false, darkModeOverride, C: externalC } = {}) {
  const navigate = useNavigate();

  // ── DARK MODE ───────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    if (embedded && darkModeOverride !== undefined) return darkModeOverride;
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  useEffect(() => {
    if (embedded) return; // Parent manages dark mode
    localStorage.setItem("darkMode", darkMode);
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.documentElement.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark-mode");
    }
  }, [darkMode, embedded]);

  // ── AUTH & ACCESS CONTROL ───────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    if (embedded) {
      // In embedded mode, skip auth check — parent (TrackingSheet) handles access
      setHasAccess(true);
      setIsAdminUser(true);
      setLoading(false);
      return;
    }
    const checkAccess = async () => {
      try {
        // Check JWT auth
        const token = apiClient.getToken();
        const user = apiClient.getUser();

        if (!token || !user) {
          navigate("/login");
          return;
        }

        // Create session object for compatibility with SharedNavbar
        setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } });

        // Check if user has admin or leads_management permission
        if (user.role === 'admin' || apiClient.hasAccess('leads_management')) {
          setHasAccess(true);
          setIsAdminUser(user.role === 'admin');
        } else {
          navigate("/");
        }
      } catch (e) {
        console.error("Access check error:", e);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [navigate, embedded]);

  // ── LOGOUT ──────────────────────────────────────────────────────────────────
  // Logout is now handled by SharedNavbar using apiClient.logout()

  // ── DATA LOADING ────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [sales, setSales] = useState([]);
  const [salesTeam, setSalesTeam] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Sales team mapping: email → display name
  const SALES_TEAM_NAMES = {
    'youcefamrane227@gmail.com': 'Youcef Amran'
  };

  // Lead status options (from Google Sheets script)
  const LEAD_STATUS_OPTIONS = [
    'À traiter',
    'À rappeler',
    'RDV fixé',
    'Répondeur',
    'Non pertinent',
    'Pas intéressé'
  ];

  // Filter state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterOrigine, setFilterOrigine] = useState([]);
  const [filterStatut, setFilterStatut] = useState([]);
  const [filterAssigne, setFilterAssigne] = useState([]);
  const [openFilter, setOpenFilter] = useState(null); // 'origine' | 'statut' | 'assigne' | null
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedLead, setSelectedLead] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Assignment state
  const [assigningLeads, setAssigningLeads] = useState(new Set());
  const [assignDropdown, setAssignDropdown] = useState(null); // lead id with open assign dropdown
  const assignDropdownRef = useRef({ right: 0, top: 0, bottom: 0, openUp: false });
  const ROLE_COLORS = { head_of_sales_manager: '#3b82f6', head_of_sales: '#ef4444', sales: '#10b981', admin: '#94a3b8' };
  const ROLE_ORDER = { head_of_sales_manager: 0, head_of_sales: 1, sales: 2, admin: 3 };
  // Override roles for users whose backend role doesn't match their actual team role
  const ROLE_OVERRIDES = { 'y.zairi@ownertechnology.com': 'head_of_sales_manager' };
  // Custom color overrides per email (takes priority over role color)
  const COLOR_OVERRIDES = {
    'l.mafrici@ownertechnology.com': '#ef4444',
    's.itema@ownertechnology.com': '#ef4444',
    'd.dubois@ownertechnology.com': '#10b981',
    'g.derouet@ownertechnology.com': '#10b981',
  };
  // Hide specific users from the assign dropdown
  const HIDDEN_USERS = ['k.dif@ownertechnology.com'];
  const getUserRole = (u) => ROLE_OVERRIDES[u.email] || u.role;
  const NAME_COLOR_OVERRIDES = { 'léo mafrici': '#ef4444', 'leo mafrici': '#ef4444', 'sébastien itema': '#ef4444', 'sebastien itema': '#ef4444' };
  const getUserColor = (u) => COLOR_OVERRIDES[u.email] || NAME_COLOR_OVERRIDES[(u.full_name || '').toLowerCase()] || ROLE_COLORS[getUserRole(u)] || C.secondary;
  const COLOR_ORDER = { '#3b82f6': 0, '#10b981': 1, '#ef4444': 2, '#94a3b8': 3 };
  const sortedAssignableUsers = useMemo(() =>
    [...(assignableUsers.length > 0 ? assignableUsers : [])].filter(u => !HIDDEN_USERS.includes(u.email)).sort((a, b) => (COLOR_ORDER[getUserColor(a)] ?? 9) - (COLOR_ORDER[getUserColor(b)] ?? 9)),
  [assignableUsers]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      // Fetch all data in parallel for faster loading
      const [leadsResult, clientsResult, salesResult, salesTeamResult, assignableResult] = await Promise.all([
        // Fetch leads from backend API
        apiClient.get(`/api/v1/leads?limit=400&deduplicate=true`).catch(err => {
          console.error("Error fetching leads:", err);
          return { leads: [], items: [], data: [] };
        }),
        // Fetch clients from backend API
        apiClient.get('/api/v1/clients?limit=1000').catch(err => {
          console.error("Error fetching clients:", err);
          return { clients: [], items: [], data: [] };
        }),
        // Keep Supabase for Info, tracking_sheets (no backend endpoints yet)
        supabase
          .from("Info")
          .select("*"),
        supabase
          .from("tracking_sheets")
          .select("sales_email")
          .eq("is_active", true),
        // Fetch assignable users from backend API
        apiClient.getAssignableUsers().catch(err => {
          console.error("Error fetching assignable users:", err);
          return { users: [] };
        })
      ]);

      // Debug: log API responses to see structure
      console.log("📊 Leads API response:", leadsResult);
      console.log("📊 Clients API response:", clientsResult);
      console.log("📊 Assignable users:", assignableResult);

      // Set leads from API response - handle different response formats
      const leadsData = leadsResult?.leads || leadsResult?.items || leadsResult?.data || (Array.isArray(leadsResult) ? leadsResult : []);
      setLeads(leadsData);
      console.log("📊 Leads set:", leadsData.length, "items");

      // Set clients from API response - handle different response formats
      const clientsData = clientsResult?.clients || clientsResult?.items || clientsResult?.data || (Array.isArray(clientsResult) ? clientsResult : []);
      setClients(clientsData);
      console.log("📊 Clients set:", clientsData.length, "items");

      // Set assignable users from backend
      const usersData = assignableResult?.users || [];
      setAssignableUsers(usersData);
      console.log("📊 Assignable users set:", usersData.length, "users");

      if (salesResult.error) {
        console.error("Error fetching sales:", salesResult.error);
      } else {
        setSales(salesResult.data || []);
      }

      if (salesTeamResult.error) {
        console.error("Error fetching sales team:", salesTeamResult.error);
      } else {
        setSalesTeam(salesTeamResult.data || []);
      }

    } catch (err) {
      console.error("Fetch error:", err);
      if (err.message?.includes('401')) {
        navigate("/login");
      }
    } finally {
      // Small delay to ensure smooth transition
      setTimeout(() => setDataLoading(false), 150);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    }
  }, [hasAccess]);

  // ── CALCULATIONS ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    // Total leads
    const totalLeads = leads.length;

    // Matched leads (leads whose email exists in clients table)
    const clientEmails = new Set(
      clients.map(c => c.email?.toLowerCase().trim()).filter(Boolean)
    );

    const matchedLeads = leads.filter(lead => {
      const email = lead.email?.toLowerCase().trim();
      return email && clientEmails.has(email);
    });

    const matchedCount = matchedLeads.length;
    const conversionRate = totalLeads > 0 ? (matchedCount / totalLeads) * 100 : 0;

    // Calculate total revenue from matched leads
    const totalRevenue = matchedLeads.reduce((sum, lead) => {
      const email = lead.email?.toLowerCase().trim();
      const leadSales = sales.filter(s =>
        s.email?.toLowerCase().trim() === email
      );
      const revenue = leadSales.reduce((s, sale) => s + (Number(sale.amount) || 0), 0);
      return sum + revenue;
    }, 0);

    // Filter sales by selected month
    let monthlySales = 0;
    if (selectedMonth && selectedMonth !== 'all') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);

      monthlySales = sales.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate >= start && saleDate <= end;
      }).length;
    } else {
      monthlySales = sales.length;
    }

    return {
      totalLeads,
      matchedCount,
      conversionRate,
      totalRevenue,
      monthlySales
    };
  }, [leads, clients, sales, selectedMonth]);

  // ── FORMAT HELPERS ──────────────────────────────────────────────────────────

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // ── MODAL HANDLERS ──────────────────────────────────────────────────────────

  const openModal = (lead) => {
    setSelectedLead(lead);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setTimeout(() => setSelectedLead(null), 300);
  };

  // Generate month options for dropdown
  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'Tous les mois' }];

    // Generate last 12 months
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }

    return options;
  }, []);

  // ── ASSIGNMENT HANDLERS ─────────────────────────────────────────────────────

  const handleAssignLead = async (leadId, salesEmail, e) => {
    e.stopPropagation(); // Prevent modal from opening

    // Check if this lead is already being assigned
    if (assigningLeads.has(leadId)) {
      console.log('Assignment already in progress for lead:', leadId);
      return;
    }

    // Mark this lead as being assigned
    setAssigningLeads(prev => new Set(prev).add(leadId));

    // Store previous state for rollback
    const previousLead = leads.find(l => l.id === leadId);

    // Optimistic update - update UI immediately
    const newAssignment = {
      assigned_to: salesEmail || null,
      assigned_at: salesEmail ? new Date().toISOString() : null,
      assigned_by: salesEmail ? (session?.user?.email || 'admin') : null
    };

    setLeads(prev => prev.map(lead =>
      lead.id === leadId
        ? { ...lead, ...newAssignment }
        : lead
    ));

    try {
      // Perform assignment via backend API
      if (salesEmail) {
        await apiClient.assignLead(leadId, salesEmail);
      } else {
        // Unassign: POST /assign with assigned_to: null
        await apiClient.unassignLead(leadId);
      }
    } catch (err) {
      console.error('Assignment error:', err);

      // Handle 409 conflict — lead already assigned to someone else
      if (err.status === 409 || err.message?.includes('409')) {
        const confirmForce = window.confirm(
          `Ce lead est déjà assigné à un autre commercial. Voulez-vous forcer la réassignation ?`
        );
        if (confirmForce) {
          try {
            await apiClient.forceAssignLead(leadId, salesEmail);
            return; // Success — keep optimistic update
          } catch (forceErr) {
            console.error('Force assignment error:', forceErr);
          }
        }
      }

      // Rollback on error (or user declined force)
      setLeads(prev => prev.map(lead =>
        lead.id === leadId ? previousLead : lead
      ));

      if (err.status !== 409 && !err.message?.includes('409')) {
        alert('Erreur lors de l\'assignation. Veuillez réessayer.');
      }
    } finally {
      // Remove from assigning set
      setAssigningLeads(prev => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: darkMode ? "#1a1a1e" : "#f5f5f7"
      }}>
        <p style={{ color: darkMode ? "#8b8d93" : "#86868b" }}>
          Vérification des accès...
        </p>
      </div>
    );
  }

  if (!hasAccess) return null;

  const C = externalC || {
    bg: darkMode ? '#1e1f28' : '#ffffff', border: darkMode ? '#2a2b36' : '#e2e6ef',
    surface: darkMode ? '#13141b' : '#f6f7f9', text: darkMode ? '#eef0f6' : '#1e2330',
    muted: darkMode ? '#5e6273' : '#9ca3af', subtle: darkMode ? '#252636' : '#f4f6fb',
    secondary: darkMode ? '#8b8fa0' : '#6b7280', accent: darkMode ? '#7c8adb' : '#5b6abf',
    shadow: darkMode ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  };

  // ── EMBEDDED CONTENT (rendered inside TrackingSheet) ──────────────────────
  const mainContent = (
    <>
      <style>{`
        @keyframes lmReveal { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes lmRowIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
        .lm-scroll::-webkit-scrollbar { width: 3px; } .lm-scroll::-webkit-scrollbar-track { background: transparent; } .lm-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }
      `}</style>

          {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
          <div style={{ flex: 1, padding: '20px 28px', minWidth: 0 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>Gestion des Leads</h1>
                <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>{leads.filter(l => (l.origin || '').toLowerCase() !== 'cc').length} leads</p>
              </div>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{
                padding: '8px 32px 8px 14px', borderRadius: 10, border: `1px solid ${C.border}`,
                background: C.bg, color: C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${darkMode ? '%235e6273' : '%239ca3af'}' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
              }}>
                {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            {/* ── FILTER BAR ──────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {/* Search input */}
              <div style={{ position: 'relative', flex: '0 0 220px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  style={{
                    width: '100%', padding: '8px 12px 8px 34px', borderRadius: 10, border: `1px solid ${C.border}`,
                    background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = C.accent}
                  onBlur={(e) => e.target.style.borderColor = C.border}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: 2 }}>✕</button>
                )}
              </div>

              {/* Filter pills */}
              {[
                {
                  key: 'origine', label: 'Origine', state: filterOrigine, setter: setFilterOrigine,
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
                  options: (() => {
                    const origins = new Set();
                    leads.forEach(l => { const o = (l.origin || '').trim(); if (o && o.toLowerCase() !== 'cc') origins.add(o); });
                    return [...origins].sort();
                  })(),
                },
                {
                  key: 'statut', label: 'Statut', state: filterStatut, setter: setFilterStatut,
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>,
                  options: ['Non assigné', 'Assigné', ...LEAD_STATUS_OPTIONS],
                },
                {
                  key: 'assigne', label: 'Assigné à', state: filterAssigne, setter: setFilterAssigne,
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                  options: sortedAssignableUsers.map(u => u.full_name),
                },
              ].map(filter => {
                const isOpen = openFilter === filter.key;
                const hasActive = filter.state.length > 0;
                return (
                  <div key={filter.key} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setOpenFilter(isOpen ? null : filter.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                        borderRadius: 10, border: `1px solid ${hasActive ? C.accent : C.border}`,
                        background: hasActive ? (darkMode ? 'rgba(124,138,219,0.1)' : 'rgba(91,106,191,0.06)') : C.bg,
                        color: hasActive ? C.accent : C.secondary, fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                      }}
                    >
                      {filter.icon}
                      <span>{filter.label}</span>
                      {hasActive && <span style={{ background: C.accent, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', minWidth: 16, textAlign: 'center' }}>{filter.state.length}</span>}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 2, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    {isOpen && (
                      <>
                        <div onClick={() => setOpenFilter(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
                          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12,
                          boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
                          padding: 6, minWidth: 200, maxHeight: 280, overflowY: 'auto',
                        }}>
                          {filter.state.length > 0 && (
                            <button onClick={() => { filter.setter([]); }} style={{
                              width: '100%', padding: '6px 12px', border: 'none', borderRadius: 6, background: 'transparent',
                              fontSize: 12, color: C.accent, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                              marginBottom: 2,
                            }}>Effacer</button>
                          )}
                          {filter.options.map(opt => {
                            const isSelected = filter.state.includes(opt);
                            return (
                              <button key={opt} onClick={() => {
                                filter.setter(prev => isSelected ? prev.filter(v => v !== opt) : [...prev, opt]);
                              }} style={{
                                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px',
                                border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                                background: isSelected ? (darkMode ? 'rgba(124,138,219,0.12)' : 'rgba(91,106,191,0.06)') : 'transparent',
                                fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? C.accent : C.text,
                                transition: 'background 0.15s',
                              }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : '#f8f9fb'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? (darkMode ? 'rgba(124,138,219,0.12)' : 'rgba(91,106,191,0.06)') : 'transparent'; }}
                              >
                                <div style={{
                                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                  border: isSelected ? 'none' : `1.5px solid ${C.muted}`,
                                  background: isSelected ? C.accent : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
                                </div>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Active filter chips */}
              {(filterOrigine.length + filterStatut.length + filterAssigne.length > 0) && (
                <button onClick={() => { setFilterOrigine([]); setFilterStatut([]); setFilterAssigne([]); }} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: darkMode ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.06)',
                  color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>Tout effacer</button>
              )}
            </div>

            {dataLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Chargement...</div>
            ) : (
              <>
                {/* Table */}
                <div className="lm-scroll" style={{
                  background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: C.shadow,
                  overflow: 'auto', maxHeight: 'calc(100vh - 340px)',
                }}>
                  {leads.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Aucun lead trouvé</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Origine', 'Date', 'Nom & Prénom', 'Salariés', 'CA', 'Assigné à'].map((h, i) => (
                            <th key={h} style={{
                              padding: '12px 16px', fontSize: 10.5, fontWeight: 700, color: C.muted,
                              textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: h === 'Salariés' ? 'center' : 'left',
                              background: darkMode ? C.subtle : '#f8f9fb', borderBottom: `1px solid ${C.border}`,
                              position: 'sticky', top: 0, zIndex: 2,
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let filtered = leads.filter(l => (l.origin || '').toLowerCase() !== 'cc');
                          // Apply filters
                          if (filterOrigine.length > 0) filtered = filtered.filter(l => filterOrigine.includes((l.origin || '').trim()));
                          if (filterStatut.length > 0) filtered = filtered.filter(l => {
                            return filterStatut.some(s => {
                              if (s === 'Non assigné') return !l.assigned_to;
                              if (s === 'Assigné') return !!l.assigned_to;
                              return (l.status || 'À traiter') === s;
                            });
                          });
                          if (filterAssigne.length > 0) filtered = filtered.filter(l => {
                            const u = sortedAssignableUsers.find(u => u.email === l.assigned_to);
                            return u && filterAssigne.includes(u.full_name);
                          });
                          if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase().trim();
                            filtered = filtered.filter(l =>
                              (l.full_name || '').toLowerCase().includes(q) ||
                              (l.email || '').toLowerCase().includes(q) ||
                              (l.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
                              (l.origin || '').toLowerCase().includes(q)
                            );
                          }
                          return filtered.map((lead, idx) => (
                          <tr key={lead.id || idx} onClick={() => openModal(lead)} style={{
                            cursor: 'pointer', transition: 'background 0.15s',
                            animation: idx < 30 ? `lmRowIn 0.25s ease ${idx * 20}ms both` : undefined,
                          }}
                            onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.03)' : '#fafafb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                              {(() => {
                                const ORIGIN_COLORS = {
                                  'btp interne': { bg: '#EFF6FF', color: '#3B82F6' },
                                  'générale interne': { bg: '#F0FDF4', color: '#22C55E' },
                                  'generale interne': { bg: '#F0FDF4', color: '#22C55E' },
                                  'interne mc': { bg: '#FFF7ED', color: '#F97316' },
                                  'leadclub': { bg: '#FAF5FF', color: '#A855F7' },
                                  'lead club': { bg: '#FAF5FF', color: '#A855F7' },
                                  'lead club lp': { bg: '#FDF2F8', color: '#EC4899' },
                                  'konket': { bg: '#FEF3C7', color: '#D97706' },
                                  'konket lp': { bg: '#FFE4E6', color: '#E11D48' },
                                  'ads': { bg: '#FFFBEB', color: '#F59E0B' },
                                  'meta': { bg: '#EFF6FF', color: '#2563EB' },
                                  'systeme.io': { bg: '#F0F9FF', color: '#0EA5E9' },
                                  'cc': { bg: '#F1F5F9', color: '#64748B' },
                                };
                                const key = (lead.origin || '').toLowerCase().trim();
                                const oc = ORIGIN_COLORS[key] || { bg: '#F5F3FF', color: '#6366F1' };
                                return (
                                  <span style={{
                                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                    background: oc.bg, color: oc.color,
                                  }}>{lead.origin || '—'}</span>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.secondary, fontVariantNumeric: 'tabular-nums' }}>
                              {formatDate(lead.created_at)}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text }}>
                              {lead.full_name || '—'}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text, textAlign: 'center', fontWeight: 500 }}>
                              {lead.headcount || '—'}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text, fontWeight: 500 }}>
                              {lead.revenue || '—'}
                            </td>
                            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                const assignedUser = sortedAssignableUsers.find(u => u.email === lead.assigned_to);
                                const assignedColor = assignedUser ? getUserColor(assignedUser) : C.secondary;
                                const isOpen = assignDropdown === lead.id;
                                const btnRef = (el) => { if (el) el.__leadId = lead.id; };
                                return (
                                  <>
                                    <button ref={btnRef} data-assign-btn={lead.id} onClick={(e) => {
                                        if (assigningLeads.has(lead.id)) return;
                                        if (isOpen) { setAssignDropdown(null); return; }
                                        const r = e.currentTarget.getBoundingClientRect();
                                        assignDropdownRef.current = { right: window.innerWidth - r.right, top: r.bottom + 4 };
                                        setAssignDropdown(lead.id);
                                      }} style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                        borderRadius: 8, border: `1px solid ${C.border}`,
                                        background: 'transparent', cursor: assigningLeads.has(lead.id) ? 'wait' : 'pointer',
                                        fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: assignedColor,
                                        width: '100%', maxWidth: 200, textAlign: 'left',
                                        opacity: assigningLeads.has(lead.id) ? 0.5 : 1, transition: 'all 0.15s',
                                      }}>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {assigningLeads.has(lead.id) ? 'Assignation...' : (assignedUser?.full_name || 'Non assigné')}
                                        </span>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="m6 9 6 6 6-6"/></svg>
                                    </button>
                                    {isOpen && createPortal(
                                      <>
                                        <div onClick={() => setAssignDropdown(null)} style={{ position: 'fixed', inset: 0, zIndex: 9990 }} />
                                        <div style={{
                                          position: 'fixed', top: assignDropdownRef.current.top, right: assignDropdownRef.current.right, zIndex: 9991,
                                          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12,
                                          boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
                                          padding: 4, minWidth: 200, maxHeight: 300, overflowY: 'auto',
                                        }}>
                                          <button onClick={() => { setAssignDropdown(null); handleAssignLead(lead.id, '', { stopPropagation: () => {} }); }}
                                            style={{
                                              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                                              border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                                              background: !lead.assigned_to ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)') : 'transparent',
                                              fontSize: 13, fontWeight: 500, color: C.muted, transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = !lead.assigned_to ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)') : 'transparent'}
                                          >Non assigné</button>
                                          {sortedAssignableUsers.map(u => {
                                            const color = getUserColor(u);
                                            const isActive = lead.assigned_to === u.email;
                                            return (
                                              <button key={u.email} onClick={() => { setAssignDropdown(null); handleAssignLead(lead.id, u.email, { stopPropagation: () => {} }); }}
                                                style={{
                                                  display: 'flex', alignItems: 'center', width: '100%', padding: '8px 12px',
                                                  border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                                                  background: isActive ? `${color}10` : 'transparent',
                                                  fontSize: 13, fontWeight: isActive ? 600 : 500, color: color,
                                                  transition: 'background 0.15s', whiteSpace: 'nowrap',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = `${color}15`}
                                                onMouseLeave={(e) => e.currentTarget.style.background = isActive ? `${color}10` : 'transparent'}
                                              >{u.full_name}</button>
                                            );
                                          })}
                                        </div>
                                      </>,
                                      document.body
                                    )}
                                  </>
                                );
                              })()}
                            </td>
                          </tr>
                        )); })()}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>

      {/* ── DETAIL MODAL ─────────────────────────────────────────────── */}
      {showModal && selectedLead && (
        <>
          <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000 }} />
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2001,
            width: 480, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto',
            background: C.bg, borderRadius: 20, border: `1px solid ${C.border}`,
            boxShadow: darkMode ? '0 24px 48px rgba(0,0,0,0.4)' : '0 24px 48px rgba(0,0,0,0.1)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Détails du Lead</div>
              <button onClick={closeModal} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: C.muted, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>
              {[
                { label: 'Origine', value: selectedLead.origin },
                { label: 'Date', value: formatDate(selectedLead.created_at) },
                { label: 'Nom & Prénom', value: selectedLead.full_name },
                { label: 'Téléphone', value: selectedLead.phone },
                { label: 'Email', value: selectedLead.email },
                { label: 'Salariés', value: selectedLead.headcount },
                { label: "Chiffre d'Affaires", value: selectedLead.revenue },
                { label: 'Assigné à', value: (() => {
                  const u = assignableUsers.find(u => u.email === selectedLead.assigned_to);
                  return u ? u.full_name : (selectedLead.assigned_to || 'Non assigné');
                })() },
                { label: 'Statut', value: selectedLead.status || 'À traiter' },
                { label: 'Notes', value: selectedLead.notes },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 14, color: C.text, wordBreak: 'break-word' }}>{f.value || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  if (embedded) return mainContent;

  return (
    <>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />
      <style>{`html, body { background: ${darkMode ? '#13141b' : '#ffffff'}; scrollbar-gutter: stable; }`}</style>
      <div style={{ animation: 'lmReveal 0.5s ease both', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', minHeight: '100vh', paddingTop: 80 }}>
          {mainContent}
        </div>
      </div>
    </>
  );
}
