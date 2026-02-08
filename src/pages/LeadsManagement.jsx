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
        setSession({ user: { email: user.email, user_metadata: { name: user.name } } });

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

  const fetchData = async () => {
    setDataLoading(true);
    try {
      // Fetch all data in parallel for faster loading
      const [leadsResult, clientsResult, salesResult, salesTeamResult, assignableResult] = await Promise.all([
        // Fetch leads from backend API (limit 200)
        apiClient.get('/api/v1/leads?page=1&limit=200').catch(err => {
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
        // Unassign: use dedicated unassign endpoint
        await apiClient.unassignLead(leadId);
      }
    } catch (err) {
      console.error('Assignment error:', err);

      // Rollback on error
      setLeads(prev => prev.map(lead =>
        lead.id === leadId ? previousLead : lead
      ));

      alert('Erreur lors de l\'assignation. Veuillez réessayer.');
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

  if (!hasAccess) {
    return null;
  }

  return (
    <div style={{
      padding: 0,
      fontFamily: "sans-serif",
      background: darkMode ? "#1a1a1e" : "#f5f5f7",
      minHeight: "100vh",
      paddingTop: '16px'
    }}>
      {/* ═══════════════════════════════════════════════════════════════════
          SHARED NAVBAR
      ═══════════════════════════════════════════════════════════════════ */}
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      {/* ═══════════════════════════════════════════════════════════════════
          LEADS MANAGEMENT BOARD-FRAME
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="board-frame">
        {/* Board Controls */}
        <div style={{
          position: 'absolute',
          top: 'var(--space-xl)',
          left: 'var(--space-2xl)',
          right: 'var(--space-2xl)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          {/* Left: Title */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-md)',
            alignItems: 'center'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: darkMode ? '#f5f5f7' : '#1d1d1f'
            }}>
              Gestion des Leads
            </h2>
            <span style={{
              fontSize: '11px',
              color: darkMode ? '#8b8d93' : '#86868b',
              padding: '4px 8px',
              borderRadius: '6px',
              background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              fontWeight: 500
            }}>
              200 plus récents
            </span>
          </div>

          {/* Right: Month filter */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="range-select"
            style={{
              padding: "8px 14px",
              paddingRight: "32px",
              borderRadius: "12px",
              border: `1px solid ${darkMode ? "#333338" : "#e5e5e5"}`,
              background: darkMode ? "#2a2b2e" : "#ffffff",
              color: darkMode ? "#f5f5f7" : "#1d1d1f",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Board Content */}
        <div style={{
          marginTop: '80px',
          padding: '0 var(--space-2xl) var(--space-2xl)',
        }}>
          {dataLoading ? (
            /* ── SKELETON LOADER ───────────────────────────────────────── */
            <div style={{
              textAlign: 'center',
              marginBottom: 'var(--space-2xl)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  fontSize: '42px',
                  opacity: 0.3
                }}>
                  🎯
                </div>
                <div className="skeleton" style={{
                  width: '300px',
                  height: '42px'
                }}></div>
              </div>

              {/* Skeleton KPIs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                maxWidth: '1200px',
                margin: '0 auto 32px'
              }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="skeleton" style={{
                    height: '120px'
                  }}></div>
                ))}
              </div>

              {/* Skeleton Table */}
              <div className="skeleton" style={{
                height: '400px',
                borderRadius: '16px'
              }}></div>
            </div>
          ) : (
            /* ── ACTUAL CONTENT ────────────────────────────────────────── */
            <div className="content-fade-in">
              {/* ── STATS SECTION ───────────────────────────────────────── */}
              <div style={{
                textAlign: 'center',
                marginBottom: 'var(--space-2xl)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    fontSize: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    🎯
                  </div>
                  <h1 style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    margin: 0,
                    color: darkMode ? '#f5f5f7' : '#1d1d1f'
                  }}>
                    Gestion des Leads
                  </h1>
                </div>

                {/* KPIs Grid */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '20px',
                  maxWidth: '1000px',
                  margin: '0 auto 32px'
                }}>
              {/* Conversion Rate */}
              <div style={{
                padding: '24px 32px',
                borderRadius: '16px',
                background: darkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                textAlign: 'center',
                minWidth: '200px',
                boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                <div style={{
                  fontSize: '11px',
                  color: darkMode ? '#8b8d93' : '#86868b',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Taux de Conversion
                </div>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: COLORS.primary
                }}>
                  {stats.conversionRate.toFixed(1)}%
                </div>
                <div style={{
                  fontSize: '11px',
                  color: darkMode ? '#8b8d93' : '#86868b',
                  marginTop: '4px'
                }}>
                  {stats.matchedCount} / {stats.totalLeads}
                </div>
              </div>

              {/* Total Revenue */}
              <div style={{
                padding: '24px 32px',
                borderRadius: '16px',
                background: darkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                textAlign: 'center',
                minWidth: '200px',
                boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                <div style={{
                  fontSize: '11px',
                  color: darkMode ? '#8b8d93' : '#86868b',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Revenu Total
                </div>
                <div style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: COLORS.tertiary
                }}>
                  {formatCurrency(stats.totalRevenue)}
                </div>
              </div>

              {/* Monthly Sales */}
              <div style={{
                padding: '24px 32px',
                borderRadius: '16px',
                background: darkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                textAlign: 'center',
                minWidth: '200px',
                boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                <div style={{
                  fontSize: '11px',
                  color: darkMode ? '#8b8d93' : '#86868b',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Ventes du Mois
                </div>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: COLORS.secondary
                }}>
                  {stats.monthlySales}
                </div>
              </div>
            </div>
          </div>

                {/* ── TABLE SECTION ───────────────────────────────────────── */}
                <div style={{
                  background: darkMode ? '#1e1e22' : '#ffffff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: darkMode
                    ? '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : '0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)'
                }}>
                  {leads.length === 0 ? (
                    <div style={{ padding: "60px", textAlign: "center" }}>
                      <p style={{
                        color: darkMode ? "#8b8d93" : "#86868b",
                        fontSize: '14px'
                      }}>
                        Aucun lead trouvé
                      </p>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{
                        width: "100%",
                        borderCollapse: "separate",
                        borderSpacing: 0
                      }}>
                        <thead>
                          <tr>
                            {[
                              { label: 'Origine', width: '130px', align: 'left' },
                              { label: 'Date', width: '110px', align: 'center' },
                              { label: 'Nom & Prénom', width: '200px', align: 'left' },
                              { label: 'Nb Salariés', width: '110px', align: 'center' },
                              { label: 'CA', width: '180px', align: 'left' },
                              { label: 'Assigné à', width: '200px', align: 'center' }
                            ].map((col, idx, arr) => (
                              <th key={col.label} style={{
                                padding: '16px 20px',
                                textAlign: col.align,
                                fontSize: '11px',
                                fontWeight: 700,
                                color: darkMode ? '#9ca3af' : '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.8px',
                                background: darkMode ? '#252529' : '#f8fafc',
                                borderBottom: `2px solid ${darkMode ? '#3f3f46' : '#e2e8f0'}`,
                                borderRight: idx < arr.length - 1 ? `1px solid ${darkMode ? '#3f3f46' : '#e2e8f0'}` : 'none',
                                width: col.width,
                                whiteSpace: 'nowrap'
                              }}>
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead, index) => {
                            const isEven = index % 2 === 0;
                            const rowBg = isEven
                              ? (darkMode ? 'transparent' : 'transparent')
                              : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)');

                            return (
                              <tr
                                key={lead.id || index}
                                onClick={() => openModal(lead)}
                                style={{
                                  background: rowBg,
                                  cursor: "pointer",
                                  transition: "all 0.15s ease"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = darkMode ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = rowBg;
                                }}
                              >
                                {/* Origine */}
                                <td style={{
                                  padding: '14px 20px',
                                  fontSize: '13px',
                                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                                  borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  borderRight: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  fontWeight: 500
                                }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    background: darkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
                                    color: COLORS.primary,
                                    border: `1px solid ${darkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`
                                  }}>
                                    {lead.origin || "-"}
                                  </span>
                                </td>

                                {/* Date */}
                                <td style={{
                                  padding: '14px 20px',
                                  fontSize: '13px',
                                  color: darkMode ? '#a1a1aa' : '#71717a',
                                  borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  borderRight: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  textAlign: 'center',
                                  fontFamily: 'monospace',
                                  letterSpacing: '0.5px'
                                }}>
                                  {formatDate(lead.created_at)}
                                </td>

                                {/* Nom & Prénom */}
                                <td style={{
                                  padding: '14px 20px',
                                  fontSize: '14px',
                                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                                  borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  borderRight: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  fontWeight: 600
                                }}>
                                  {lead.full_name || "-"}
                                </td>

                                {/* Nb Salariés */}
                                <td style={{
                                  padding: '14px 20px',
                                  fontSize: '13px',
                                  color: darkMode ? '#a1a1aa' : '#52525b',
                                  borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  borderRight: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  textAlign: 'center',
                                  fontWeight: 500
                                }}>
                                  {lead.headcount || "-"}
                                </td>

                                {/* CA */}
                                <td style={{
                                  padding: '14px 20px',
                                  fontSize: '13px',
                                  color: darkMode ? '#a1a1aa' : '#52525b',
                                  borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  borderRight: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  fontWeight: 500
                                }}>
                                  {lead.revenue || "-"}
                                </td>

                                {/* Assigné à */}
                                <td style={{
                                  padding: '14px 16px',
                                  borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#f1f5f9'}`,
                                  textAlign: 'center'
                                }}>
                                  <select
                                    value={lead.assigned_to || ''}
                                    onChange={(e) => handleAssignLead(lead.id, e.target.value, e)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={assigningLeads.has(lead.id)}
                                    style={{
                                      padding: '8px 12px',
                                      paddingRight: '28px',
                                      borderRadius: '8px',
                                      border: lead.assigned_to
                                        ? `2px solid ${COLORS.tertiary}40`
                                        : `1px solid ${darkMode ? '#3f3f46' : '#e2e8f0'}`,
                                      background: lead.assigned_to
                                        ? (darkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)')
                                        : (darkMode ? '#2a2b2e' : '#ffffff'),
                                      color: lead.assigned_to
                                        ? COLORS.tertiary
                                        : (darkMode ? '#9ca3af' : '#6b7280'),
                                      fontSize: '13px',
                                      fontWeight: lead.assigned_to ? 600 : 400,
                                      cursor: assigningLeads.has(lead.id) ? 'wait' : 'pointer',
                                      width: '100%',
                                      maxWidth: '180px',
                                      transition: 'all 0.2s ease',
                                      opacity: assigningLeads.has(lead.id) ? 0.5 : 1,
                                      appearance: 'none',
                                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${darkMode ? '%239ca3af' : '%236b7280'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                      backgroundRepeat: 'no-repeat',
                                      backgroundPosition: 'right 10px center'
                                    }}
                                  >
                                    <option value="">
                                      {assigningLeads.has(lead.id) ? 'Assignation...' : 'Non assigné'}
                                    </option>
                                    {assignableUsers.length > 0 ? (
                                      assignableUsers.map((user) => (
                                        <option key={user.id} value={user.email || user.id}>
                                          {user.full_name} ({user.role})
                                        </option>
                                      ))
                                    ) : (
                                      salesTeam.map((member) => (
                                        <option key={member.sales_email} value={member.sales_email}>
                                          {SALES_TEAM_NAMES[member.sales_email] || member.sales_email}
                                        </option>
                                      ))
                                    )}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
      </div>
    </div>

      {/* ── MODAL ─────────────────────────────────────────────────────────── */}
      {showModal && selectedLead && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "24px"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: darkMode ? "#242428" : "#fff",
              borderRadius: "20px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: "24px",
              borderBottom: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h2 style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 600,
                color: darkMode ? "#f5f5f7" : "#1d1d1f"
              }}>
                Détails du Lead
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "28px",
                  cursor: "pointer",
                  color: darkMode ? "#8b8d93" : "#86868b",
                  padding: "0",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px" }}>
              <div style={{
                display: "grid",
                gap: "20px"
              }}>
                {[
                  { label: "Origine", value: selectedLead.origin },
                  { label: "Date", value: formatDate(selectedLead.created_at) },
                  { label: "Nom & Prénom", value: selectedLead.full_name },
                  { label: "Téléphone", value: selectedLead.phone },
                  { label: "Email", value: selectedLead.email },
                  { label: "Plateforme", value: selectedLead.platform },
                  { label: "Source", value: selectedLead.source },
                  { label: "Nombre de Salariés", value: selectedLead.headcount },
                  { label: "Chiffre d'Affaires", value: selectedLead.revenue },
                  { label: "Projet", value: selectedLead.project },
                  { label: "Assigné à", value: (() => {
                    const user = assignableUsers.find(u => u.email === selectedLead.assigned_to || u.id === selectedLead.assigned_to);
                    return user ? user.full_name : (SALES_TEAM_NAMES[selectedLead.assigned_to] || selectedLead.assigned_to || "Non assigné");
                  })() },
                  { label: "Statut", value: selectedLead.status || "À traiter" },
                  { label: "Notes", value: selectedLead.notes, isMultiline: true }
                ].map((field, idx) => (
                  <div key={idx}>
                    <div style={{
                      fontSize: "11px",
                      color: darkMode ? "#8b8d93" : "#86868b",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>
                      {field.label}
                    </div>
                    <div style={{
                      fontSize: "15px",
                      color: darkMode ? "#f5f5f7" : "#1d1d1f",
                      wordBreak: "break-word",
                      whiteSpace: field.isMultiline ? 'pre-wrap' : 'normal'
                    }}>
                      {field.value || "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

