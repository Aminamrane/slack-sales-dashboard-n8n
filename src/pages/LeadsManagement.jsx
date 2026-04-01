import { useEffect, useState, useMemo } from "react";
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

export default function LeadsManagement() {
  const navigate = useNavigate();

  // ── DARK MODE ───────────────────────────────────────────────────────────────
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

  // ── AUTH & ACCESS CONTROL ───────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
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
  }, [navigate]);

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

  // Modal state
  const [selectedLead, setSelectedLead] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Assignment state
  const [assigningLeads, setAssigningLeads] = useState(new Set());
  const [assignDropdown, setAssignDropdown] = useState(null); // lead id with open assign dropdown
  const [assignDropdownPos, setAssignDropdownPos] = useState({ x: 0, y: 0 });
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
        // Fetch leads from backend API (limit 200)
        apiClient.get(`/api/v1/leads?limit=1000&created_after=${(() => { const d = new Date(); d.setDate(d.getDate() - 3); return d.toISOString().slice(0, 10); })()}`).catch(err => {
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

  const C = {
    bg: darkMode ? '#1e1f28' : '#ffffff', border: darkMode ? '#2a2b36' : '#e2e6ef',
    surface: darkMode ? '#13141b' : '#f6f7f9', text: darkMode ? '#eef0f6' : '#1e2330',
    muted: darkMode ? '#5e6273' : '#9ca3af', subtle: darkMode ? '#252636' : '#f4f6fb',
    secondary: darkMode ? '#8b8fa0' : '#6b7280', accent: darkMode ? '#7c8adb' : '#5b6abf',
    shadow: darkMode ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  };

  return (
    <>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <style>{`
        html, body { background: ${darkMode ? '#13141b' : '#ffffff'}; scrollbar-gutter: stable; }
        @keyframes lmReveal { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes lmRowIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
        .lm-scroll::-webkit-scrollbar { width: 3px; } .lm-scroll::-webkit-scrollbar-track { background: transparent; } .lm-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }
      `}</style>

      <div style={{ animation: 'lmReveal 0.5s ease both', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', minHeight: '100vh', paddingTop: 80 }}>

          {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
          <div style={{ flex: 1, padding: '20px 28px', minWidth: 0 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>Gestion des Leads</h1>
                <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>{leads.filter(l => {
                  if ((l.origin || '').toLowerCase() === 'cc') return false;
                  const d = new Date(l.created_at); const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3); cutoff.setHours(0,0,0,0);
                  return d >= cutoff;
                }).length} leads — 4 derniers jours</p>
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

            {dataLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Chargement...</div>
            ) : (
              <>
                {/* Table */}
                <div className="lm-scroll" style={{
                  background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: C.shadow,
                  overflow: 'auto', maxHeight: 'calc(100vh - 280px)',
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
                          const filtered = leads.filter(l => {
                            if ((l.origin || '').toLowerCase() === 'cc') return false;
                            const d = new Date(l.created_at); const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3); cutoff.setHours(0,0,0,0);
                            return d >= cutoff;
                          });
                          // Detect duplicates by email — most recent (first) is NOT duplicate, older ones are
                          const emailCount = {};
                          const emailSeen = {};
                          filtered.forEach(l => { const e = (l.email || '').toLowerCase().trim(); if (e) emailCount[e] = (emailCount[e] || 0) + 1; });
                          return filtered.map((lead, idx) => {
                          const email = (lead.email || '').toLowerCase().trim();
                          const isDuplicate = email && emailCount[email] > 1 && emailSeen[email];
                          if (email && emailCount[email] > 1) emailSeen[email] = true;
                          return (
                          <tr key={lead.id || idx} onClick={() => openModal(lead)} style={{
                            cursor: 'pointer', transition: 'background 0.15s',
                            background: isDuplicate ? (darkMode ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.1)') : 'transparent',
                            animation: idx < 30 ? `lmRowIn 0.25s ease ${idx * 20}ms both` : undefined,
                          }}
                            onMouseEnter={(e) => { if (!isDuplicate) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.03)' : '#fafafb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = isDuplicate ? (darkMode ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.1)') : 'transparent'; }}
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
                                return (
                                  <>
                                    <button onClick={(e) => {
                                      if (assigningLeads.has(lead.id)) return;
                                      if (isOpen) { setAssignDropdown(null); return; }
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setAssignDropdownPos({ x: rect.left, y: rect.bottom + 4 });
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
                                  </>
                                );
                              })()}
                            </td>
                          </tr>
                        ); }); })()}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── ASSIGN DROPDOWN (portaled) ─────────────────────────────── */}
      {assignDropdown && (() => {
        const lead = leads.find(l => l.id === assignDropdown);
        if (!lead) return null;
        return (
          <>
            <div onClick={() => setAssignDropdown(null)} style={{ position: 'fixed', inset: 0, zIndex: 9990 }} />
            <div style={{
              position: 'fixed', top: assignDropdownPos.y, left: assignDropdownPos.x, zIndex: 9991,
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12,
              boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)',
              padding: 4, minWidth: 200, maxHeight: 300, overflowY: 'auto',
            }}>
              {/* Unassign option */}
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
              {/* Users grouped by role color */}
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
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = `${color}15`}
                    onMouseLeave={(e) => e.currentTarget.style.background = isActive ? `${color}10` : 'transparent'}
                  >
                    {u.full_name}
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}

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
}
