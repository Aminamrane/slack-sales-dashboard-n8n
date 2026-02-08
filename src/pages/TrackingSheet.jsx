import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

const COLORS = {
  primary: "#6366f1",
  secondary: "#fb923c",
  tertiary: "#10b981",
};

// Lead status options
const LEAD_STATUS_OPTIONS = [
  'À traiter',
  'À rappeler',
  'RDV fixé',
  'Répondeur',
  'Non pertinent',
  'Pas intéressé'
];

// Employee count ranges (from tarifs table)
const EMPLOYEE_RANGES = [
  '1-2', '3-5', '6-10', '11-19', '20-29',
  '30-39', '40-49', '50-74', '75-99', '100-149',
  '150-199', '200-249', '250-299', '300-349', '350-400'
];

export default function TrackingSheet() {
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

        // Check if user has an active tracking sheet
        const response = await apiClient.get('/api/v1/tracking/my-sheets');

        if (!response.sheets || response.sheets.length === 0) {
          navigate("/");
        } else {
          setHasAccess(true);
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

  // ── DATA LOADING ────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Modal state
  const [selectedLead, setSelectedLead] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [selectedEmployeeRange, setSelectedEmployeeRange] = useState('');

  // Saving states
  const [savingFields, setSavingFields] = useState(new Set());
  const [updatingStatus, setUpdatingStatus] = useState(new Set());

  const fetchData = async () => {
    setDataLoading(true);
    try {
      if (!session) return;

      // Fetch leads assigned to this sales user via backend API
      const response = await apiClient.get('/api/v1/tracking/my-leads');
      setLeads(response.leads || []);
    } catch (err) {
      console.error("Fetch error:", err);
      if (err.message?.includes('401')) {
        navigate("/login");
      }
    } finally {
      setTimeout(() => setDataLoading(false), 150);
    }
  };

  useEffect(() => {
    if (hasAccess && session) {
      fetchData();
    }
  }, [hasAccess, session]);

  // ── HANDLERS ────────────────────────────────────────────────────────────────

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const openModal = (lead) => {
    setSelectedLead(lead);
    setEditedNotes(lead.notes || '');
    setSelectedEmployeeRange(lead.employee_range || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setTimeout(() => {
      setSelectedLead(null);
      setEditedNotes('');
      setSelectedEmployeeRange('');
    }, 300);
  };

  const handleStatusChange = async (leadId, newStatus, e) => {
    e.stopPropagation();

    if (updatingStatus.has(leadId)) return;
    setUpdatingStatus(prev => new Set(prev).add(leadId));

    const previousLead = leads.find(l => l.id === leadId);

    // Optimistic update
    setLeads(prev => prev.map(lead =>
      lead.id === leadId ? { ...lead, status: newStatus } : lead
    ));

    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { status: newStatus });
    } catch (err) {
      console.error('Status update error:', err);
      setLeads(prev => prev.map(lead =>
        lead.id === leadId ? previousLead : lead
      ));
      alert('Erreur lors de la mise à jour du statut.');
    } finally {
      setUpdatingStatus(prev => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  const handleDateChange = async (field, newDate) => {
    if (!selectedLead) return;
    if (savingFields.has(field)) return;

    setSavingFields(prev => new Set(prev).add(field));

    const previousLead = { ...selectedLead };

    // Optimistic update
    setSelectedLead(prev => ({ ...prev, [field]: newDate }));
    setLeads(prev => prev.map(lead =>
      lead.id === selectedLead.id ? { ...lead, [field]: newDate } : lead
    ));

    try {
      await apiClient.patch(`/api/v1/tracking/leads/${selectedLead.id}`, { [field]: newDate || null });
    } catch (err) {
      console.error(`${field} update error:`, err);
      setSelectedLead(previousLead);
      setLeads(prev => prev.map(lead =>
        lead.id === selectedLead.id ? previousLead : lead
      ));
      alert(`Erreur lors de la sauvegarde de ${field}.`);
    } finally {
      setSavingFields(prev => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  const handleEmployeeRangeChange = async (range) => {
    if (!selectedLead) return;
    if (savingFields.has('employee_range')) return;

    setSavingFields(prev => new Set(prev).add('employee_range'));
    setSelectedEmployeeRange(range);

    const previousLead = { ...selectedLead };

    // Optimistic update
    setSelectedLead(prev => ({ ...prev, employee_range: range }));
    setLeads(prev => prev.map(lead =>
      lead.id === selectedLead.id ? { ...lead, employee_range: range } : lead
    ));

    try {
      await apiClient.patch(`/api/v1/tracking/leads/${selectedLead.id}`, { employee_range: range });
    } catch (err) {
      console.error('Employee range update error:', err);
      setSelectedLead(previousLead);
      setSelectedEmployeeRange(previousLead.employee_range || '');
      setLeads(prev => prev.map(lead =>
        lead.id === selectedLead.id ? previousLead : lead
      ));
      alert('Erreur lors de la sauvegarde du nombre de salariés.');
    } finally {
      setSavingFields(prev => {
        const next = new Set(prev);
        next.delete('employee_range');
        return next;
      });
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedLead) return;
    if (savingFields.has('notes')) return;

    setSavingFields(prev => new Set(prev).add('notes'));

    const previousLead = { ...selectedLead };

    // Optimistic update
    setSelectedLead(prev => ({ ...prev, notes: editedNotes }));
    setLeads(prev => prev.map(lead =>
      lead.id === selectedLead.id ? { ...lead, notes: editedNotes } : lead
    ));

    try {
      await apiClient.patch(`/api/v1/tracking/leads/${selectedLead.id}`, { notes: editedNotes });
    } catch (err) {
      console.error('Notes save error:', err);
      setSelectedLead(previousLead);
      setEditedNotes(previousLead.notes || '');
      setLeads(prev => prev.map(lead =>
        lead.id === selectedLead.id ? previousLead : lead
      ));
      alert('Erreur lors de la sauvegarde des notes.');
    } finally {
      setSavingFields(prev => {
        const next = new Set(prev);
        next.delete('notes');
        return next;
      });
    }
  };

  const handleSendContract = () => {
    alert("L'envoi de contrat sera disponible prochainement.");
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
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="board-frame" style={{
        width: 'fit-content',
        maxWidth: 'none',
        margin: 'var(--space-xl) auto',
        minWidth: '1400px'
      }}>
        {/* Title */}
        <div style={{
          position: 'absolute',
          top: 'var(--space-xl)',
          left: 'var(--space-2xl)',
          right: 'var(--space-2xl)',
          zIndex: 10
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: darkMode ? '#f5f5f7' : '#1d1d1f'
          }}>
            Tracking Sheet
          </h2>
        </div>

        {/* Content */}
        <div style={{ marginTop: '80px', padding: '0 var(--space-2xl) var(--space-2xl)' }}>
          {dataLoading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ color: darkMode ? '#8b8d93' : '#86868b' }}>Chargement...</p>
            </div>
          ) : (
            <div className="content-fade-in">
              <div style={{
                background: darkMode ? '#1e1e22' : '#ffffff',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: darkMode
                  ? '0 4px 24px rgba(0,0,0,0.4)'
                  : '0 4px 24px rgba(0,0,0,0.08)',
                border: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`
              }}>
                {leads.length === 0 ? (
                  <div style={{ padding: "60px", textAlign: "center" }}>
                    <p style={{ color: darkMode ? "#8b8d93" : "#86868b" }}>
                      Aucun lead assigné
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{
                      width: "100%",
                      minWidth: "1360px",
                      borderCollapse: "separate",
                      borderSpacing: 0
                    }}>
                      <thead>
                        <tr>
                          {[
                            { label: 'Date Assigné', width: '130px', align: 'center' },
                            { label: 'Origine', width: '140px', align: 'center' },
                            { label: 'Nom & Prénom', width: '200px', align: 'left' },
                            { label: 'Email', width: '260px', align: 'left' },
                            { label: 'Téléphone', width: '150px', align: 'center' },
                            { label: 'Nb Salariés', width: '120px', align: 'center' },
                            { label: 'CA', width: '180px', align: 'left' },
                            { label: 'Statut', width: '180px', align: 'center' }
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
                          const originBadgeColors = {
                            'Owner': { bg: darkMode ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)', text: '#6366f1' },
                            'Agicap': { bg: darkMode ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)', text: '#10b981' },
                            'Batch du jour': { bg: darkMode ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)', text: '#f59e0b' },
                            'WhatsApp': { bg: darkMode ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', text: '#22c55e' }
                          };
                          const badgeColor = originBadgeColors[lead.origin] || {
                            bg: darkMode ? 'rgba(107,114,128,0.15)' : 'rgba(107,114,128,0.1)',
                            text: darkMode ? '#9ca3af' : '#6b7280'
                          };

                          return (
                            <tr
                              key={lead.id || index}
                              onClick={() => openModal(lead)}
                              style={{
                                cursor: "pointer",
                                transition: "background 0.15s",
                                background: index % 2 === 0
                                  ? (darkMode ? '#1e1e22' : '#ffffff')
                                  : (darkMode ? '#232327' : '#f8fafc')
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2a2e' : '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0
                                ? (darkMode ? '#1e1e22' : '#ffffff')
                                : (darkMode ? '#232327' : '#f8fafc')}
                            >
                              <td style={{
                                padding: '16px 20px',
                                fontSize: '14px',
                                color: darkMode ? '#e5e7eb' : '#374151',
                                borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                borderRight: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                              }}>
                                {formatDate(lead.assigned_at)}
                              </td>
                              <td style={{
                                padding: '16px 20px',
                                fontSize: '14px',
                                borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                borderRight: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                textAlign: 'center'
                              }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  background: badgeColor.bg,
                                  color: badgeColor.text
                                }}>
                                  {lead.origin || "-"}
                                </span>
                              </td>
                              <td style={{
                                padding: '16px 20px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: darkMode ? '#f5f5f7' : '#1d1d1f',
                                borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                borderRight: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                textAlign: 'left'
                              }}>
                                {lead.full_name || "-"}
                              </td>
                              <td style={{
                                padding: '16px 20px',
                                fontSize: '14px',
                                color: darkMode ? '#9ca3af' : '#6b7280',
                                borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                borderRight: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                textAlign: 'left'
                              }}>
                                {lead.email || "-"}
                              </td>
                              <td style={{
                                padding: '16px 20px',
                                fontSize: '14px',
                                color: darkMode ? '#e5e7eb' : '#374151',
                                borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                borderRight: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                textAlign: 'center',
                                fontFamily: 'monospace'
                              }}>
                                {lead.phone || "-"}
                              </td>
                              <td style={{
                                padding: '16px 20px',
                                fontSize: '14px',
                                color: darkMode ? '#e5e7eb' : '#374151',
                                borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                borderRight: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                textAlign: 'center'
                              }}>
                                {lead.headcount || "-"}
                              </td>
                              <td style={{
                                padding: '16px 20px',
                                fontSize: '14px',
                                color: darkMode ? '#e5e7eb' : '#374151',
                                borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                borderRight: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                textAlign: 'left'
                              }}>
                                {lead.revenue || "-"}
                              </td>
                              <td style={{
                                padding: '12px 16px',
                                borderBottom: `1px solid ${darkMode ? '#2d2d32' : '#e2e8f0'}`,
                                textAlign: 'center'
                              }}>
                                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                  <select
                                    value={lead.status || 'À traiter'}
                                    onChange={(e) => handleStatusChange(lead.id, e.target.value, e)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={updatingStatus.has(lead.id)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 32px 8px 12px',
                                      borderRadius: '8px',
                                      border: `1px solid ${darkMode ? '#3f3f46' : '#d1d5db'}`,
                                      background: updatingStatus.has(lead.id)
                                        ? (darkMode ? '#1a1a1e' : '#f5f5f7')
                                        : (darkMode ? '#2a2a2e' : '#ffffff'),
                                      color: darkMode ? '#f5f5f7' : '#1d1d1f',
                                      fontSize: '13px',
                                      fontWeight: 500,
                                      cursor: updatingStatus.has(lead.id) ? 'wait' : 'pointer',
                                      opacity: updatingStatus.has(lead.id) ? 0.6 : 1,
                                      appearance: 'none',
                                      WebkitAppearance: 'none',
                                      MozAppearance: 'none'
                                    }}
                                  >
                                    {LEAD_STATUS_OPTIONS.map(status => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                  <div style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    pointerEvents: 'none'
                                  }}>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                      <path d="M3 4.5L6 7.5L9 4.5" stroke={darkMode ? '#9ca3af' : '#6b7280'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </div>
                                </div>
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

      {/* MODAL - NO BLUR */}
      {showModal && selectedLead && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)", // No blur, just opacity
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
              maxWidth: "700px",
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
                {selectedLead.full_name || "Lead"}
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
                  justifyContent: "center"
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px" }}>
              {/* Dates RDV */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: darkMode ? "#f5f5f7" : "#1d1d1f",
                  marginBottom: "12px"
                }}>
                  Placer les RDV
                </h3>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "12px"
                }}>
                  {[
                    { label: "R1", field: "r1" },
                    { label: "R2", field: "r2" },
                    { label: "RDV Lancement", field: "rdv_lancement" },
                    { label: "RDV Onboarding", field: "rdv_onboarding" }
                  ].map(({ label, field }) => (
                    <div key={field}>
                      <label style={{
                        fontSize: "11px",
                        color: darkMode ? "#8b8d93" : "#86868b",
                        marginBottom: "6px",
                        display: "block",
                        textTransform: "uppercase"
                      }}>
                        {label}
                      </label>
                      <input
                        type="date"
                        value={formatDateForInput(selectedLead[field])}
                        onChange={(e) => handleDateChange(field, e.target.value)}
                        disabled={savingFields.has(field)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
                          background: darkMode ? '#2a2b2e' : '#ffffff',
                          color: darkMode ? '#f5f5f7' : '#1d1d1f',
                          fontSize: "14px",
                          cursor: savingFields.has(field) ? 'wait' : 'pointer',
                          opacity: savingFields.has(field) ? 0.6 : 1
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Employee Range */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: darkMode ? "#f5f5f7" : "#1d1d1f",
                  marginBottom: "12px"
                }}>
                  Nombre de salariés
                </h3>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "8px"
                }}>
                  {EMPLOYEE_RANGES.map(range => (
                    <button
                      key={range}
                      onClick={() => handleEmployeeRangeChange(range)}
                      disabled={savingFields.has('employee_range')}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        border: `1px solid ${selectedEmployeeRange === range ? COLORS.primary : (darkMode ? '#333338' : '#e5e5e5')}`,
                        background: selectedEmployeeRange === range
                          ? COLORS.primary
                          : (darkMode ? '#2a2b2e' : '#ffffff'),
                        color: selectedEmployeeRange === range ? '#fff' : (darkMode ? '#f5f5f7' : '#1d1d1f'),
                        fontSize: "13px",
                        fontWeight: selectedEmployeeRange === range ? 600 : 400,
                        cursor: savingFields.has('employee_range') ? 'wait' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: savingFields.has('employee_range') ? 0.6 : 1
                      }}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: darkMode ? "#f5f5f7" : "#1d1d1f",
                  marginBottom: "12px"
                }}>
                  Notes / Commentaires
                </h3>
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Ajouter des commentaires internes..."
                  style={{
                    width: "100%",
                    minHeight: "100px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
                    background: darkMode ? '#2a2b2e' : '#ffffff',
                    color: darkMode ? '#f5f5f7' : '#1d1d1f',
                    fontSize: "14px",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={savingFields.has('notes')}
                  style={{
                    marginTop: "8px",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: savingFields.has('notes') ? (darkMode ? '#333338' : '#e5e5e5') : COLORS.primary,
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: savingFields.has('notes') ? 'wait' : 'pointer'
                  }}
                >
                  {savingFields.has('notes') ? 'Sauvegarde...' : 'Sauvegarder les notes'}
                </button>
              </div>

              {/* Contract Button */}
              <button
                onClick={handleSendContract}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "none",
                  background: COLORS.tertiary,
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                📄 Envoyer le contrat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
