import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { supabase } from "../lib/supabaseClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

// ── SIDEBAR ICONS ────────────────────────────────────────────────────────────
import iconMyLead from "../assets/global.png";
import iconPlus from "../assets/plus.png";
import iconEmail from "../assets/email.png";
import iconCampaigns from "../assets/tar.png";
import iconKpis from "../assets/finance.png";
import iconCalendrier from "../assets/calendrier.png";
import iconNotif from "../assets/icon2.png";
import companyLogo from "../assets/my_image.png";
import campaignImg1 from "../assets/audit-document.jpg";
import campaignImg2 from "../assets/charges-fatales-2.png";
import rabbitIcon from "../assets/lapin.png";
import completedIcon from "../assets/completed.png";
import meetIcon from "../assets/meet.png";
import mynoteIcon from "../assets/mynote.svg";

// ── CATEGORIES ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "new",          label: "Nouveaux leads",  color: "#6366f1", softBg: "#f0f1fb", softBgDark: "rgba(99,102,241,0.18)",  softText: "#7578c4", description: "Leads assignés, pas encore contactés" },
  { key: "r1",           label: "R1 Placés",       color: "#3b82f6", softBg: "#edf4fc", softBgDark: "rgba(59,130,246,0.18)",  softText: "#6a9fd8", description: "Premier rendez-vous programmé" },
  { key: "r2",           label: "R2 Placés",       color: "#fb923c", softBg: "#fdf3eb", softBgDark: "rgba(251,146,60,0.18)",  softText: "#c48a5a", description: "Rendez-vous audit programmé" },
  { key: "callback",     label: "À rappeler",      color: "#94a3b8", softBg: "#f4f5f7", softBgDark: "rgba(148,163,184,0.18)", softText: "#8993a4", description: "Prospect souhaite être rappelé" },
  { key: "voicemail",    label: "Répondeurs",      color: "#64748b", softBg: "#f0f1f4", softBgDark: "rgba(100,116,139,0.18)", softText: "#7a8594", description: "Pas de réponse" },
  { key: "not_relevant", label: "Non-pertinents",  color: "#f87171", softBg: "#fceeed", softBgDark: "rgba(248,113,113,0.18)", softText: "#c47272", description: "Non qualifiés ou pas intéressés" },
  { key: "signed",       label: "Signés",          color: "#34d399", softBg: "#edfbf3", softBgDark: "rgba(52,211,153,0.18)",  softText: "#5ab896", description: "Clients signés" },
];

// ── TODAY (for dynamic notifications in demo) ────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

// ── STATUS MAPPING (extra statuses → closest tab) ───────────────────────────
const EXTRA_STATUS_MAP = {
  not_interested: 'not_relevant',
  not_reached: 'voicemail',
  wrong_number: 'not_relevant',
  long_term: 'callback',
};

// ── DATE/TIME HELPERS ─────────────────────────────────────────────────────────
// Backend now returns ISO timestamps (e.g. "2026-03-11T14:00:00+00:00")
// datetime-local inputs need "YYYY-MM-DDTHH:MM" format (no timezone suffix)
const toDatetimeLocal = (val) => {
  if (!val) return '';
  if (val.length === 10) return val + 'T09:00'; // date-only → default 9am
  return val.slice(0, 16); // trim seconds + timezone
};
const toDateOnly = (val) => {
  if (!val) return '';
  return val.slice(0, 10);
};
const formatDateTimeFR = (val) => {
  if (!val) return '';
  const d = val.slice(0, 10).split('-');
  const t = val.length > 10 ? val.slice(11, 16) : null;
  const date = `${d[2]}/${d[1]}`;
  return t && t !== '00:00' ? `${date} à ${t.replace(':', 'h')}` : date;
};

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const EMPLOYEE_RANGES = [
  '1-2', '3-5', '6-10', '11-19', '20-29',
  '30-39', '40-49', '50-74', '75-99', '100-149',
  '150-199', '200-249', '250-299', '300-349', '350-400'
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
    surface:   darkMode ? '#13141b' : '#f6f7f9',
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

  // ── ADMIN VIEW: viewing another sales rep's sheet ──────────────────────────
  const viewingSheetId = new URLSearchParams(window.location.search).get('sheet_id');
  const isAdminView = !!viewingSheetId;

  // ── REFRESH DATA (reusable — called on mount + polling) ────────────────────
  const refreshData = useCallback(async () => {
    // If admin is viewing another user's sheet, use the admin endpoint
    const leadsUrl = isAdminView
      ? `/api/v1/tracking/leads?assigned_to=${encodeURIComponent(viewingSheetId)}`
      : '/api/v1/tracking/my-leads';
    const leadsResp = await apiClient.get(leadsUrl);
    const mappedLeads = (leadsResp.leads || []).map(l => ({
      ...l,
      status: EXTRA_STATUS_MAP[l.status] || l.status,
      full_name: l.full_name || l.client || '',
      r1: l.r1_date || l.r1 || null,
      r2: l.r2_date || l.r2 || null,
    }));
    setLeads(mappedLeads);

    // Fetch dismissed notifications from backend
    try {
      const dismissedResp = await apiClient.get('/api/v1/notifications/dismissed');
      if (dismissedResp.dismissed) setDismissedNotifs(dismissedResp.dismissed);
    } catch (e) { console.warn('Failed to fetch dismissed notifs:', e); }

    // Fetch performance alerts from backend (skip in admin view)
    if (!isAdminView) {
      try {
        const perfResp = await apiClient.get('/api/v1/notifications/performance?period=current_week');
        if (perfResp.alerts) setBackendPerfAlerts(perfResp.alerts);
      } catch (e) { console.warn('Failed to fetch perf alerts:', e); }
    }

    // Fetch personal KPIs (skip in admin view)
    if (!isAdminView) {
      try {
        const kpiResp = await apiClient.get('/api/v1/tracking/my-kpis');
        setKpis(kpiResp);
      } catch (e) { console.warn('Failed to fetch KPIs:', e); }
    }
  }, [isAdminView, viewingSheetId]);

  useEffect(() => {
    const check = async () => {
      try {
        const token = apiClient.getToken();
        const user = apiClient.getUser();
        if (!token || !user) { navigate("/login"); return; }
        setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } });

        // Access check — skip if admin view OR user has tracking_sheet permission
        const hasPermission = user.role === 'admin' || apiClient.hasAccess('tracking_sheet');
        if (!isAdminView && !hasPermission) {
          navigate("/");
          return;
        }

        await refreshData();
      } catch (e) {
        console.error('[TrackingSheet] Init failed:', e);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [navigate, refreshData]);

  // ── POLLING: refresh leads + notifications every 30s ─────────────────────
  useEffect(() => {
    if (loading) return; // don't poll until initial load is done
    const interval = setInterval(() => {
      refreshData().catch(e => console.warn('Poll refresh failed:', e));
    }, 30000);
    return () => clearInterval(interval);
  }, [loading, refreshData]);

  // ── WEBSOCKET CONNECTION ──────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const user = apiClient.getUser();
    if (!user?.email) return;

    // Admin can view another sales rep's sheet via ?sheet_id= query param
    const urlParams = new URLSearchParams(window.location.search);
    const sheetId = urlParams.get('sheet_id') || user.email;

    const wsUrl = `wss://ws.ownertechnology.com/ws?sheet_id=${encodeURIComponent(sheetId)}`;
    let ws;
    try { ws = new WebSocket(wsUrl); } catch { return; }
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: 'join', email: user.email, full_name: user.name || user.full_name || '' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'presence_list':
            setPresenceUsers(msg.users || []);
            break;
          case 'user_joined':
            setPresenceUsers(prev => [...prev.filter(u => u.email !== msg.email), { email: msg.email, full_name: msg.full_name }]);
            break;
          case 'user_left':
            setPresenceUsers(prev => prev.filter(u => u.email !== msg.email));
            setRemoteCursors(prev => { const next = { ...prev }; delete next[msg.email]; return next; });
            setRemoteUserTabs(prev => { const next = { ...prev }; delete next[msg.email]; return next; });
            setRemoteLeadFocus(prev => { const next = { ...prev }; delete next[msg.email]; return next; });
            break;
          case 'cursor_move':
            if (msg.email === user.email) break; // ignore own cursor
            setRemoteCursors(prev => ({
              ...prev,
              [msg.email]: { full_name: msg.full_name, x: msg.x, y: msg.y, lastSeen: Date.now(), color: getCursorColor(msg.email) },
            }));
            break;
          case 'action_toast': {
            setActionToasts(prev => [...prev, { ...msg, id: Date.now() + Math.random(), ts: Date.now() }].slice(-5));
            setTimeout(() => setActionToasts(prev => prev.filter(t => Date.now() - t.ts < 3000)), 3500);
            // Highlight the lead card briefly
            if (msg.lead_id) {
              setHighlightedLeadId(String(msg.lead_id));
              setTimeout(() => setHighlightedLeadId(null), 2500);
              const lid = String(msg.lead_id);

              // Contract signed — move lead to "signed" tab immediately
              if (msg.action === 'Contrat signé') {
                setTimeout(async () => {
                  try {
                    const updated = await apiClient.get(`/api/v1/tracking/leads/${lid}`);
                    if (updated && updated.id) {
                      const oldLead = leadsRef.current.find(l => String(l.id) === lid);
                      setLeads(prev => prev.map(l => String(l.id) === lid ? { ...l, ...updated, status: 'signed' } : l));
                      if (oldLead && oldLead.status !== 'signed') {
                        triggerFlyAnimation(lid, oldLead, 'signed');
                        triggerLeadMovedNotif(oldLead, 'signed');
                      }
                    }
                  } catch {}
                }, 300);
                break;
              }

              // Contract expired — re-fetch lead to update contract status
              if (msg.action === 'Contrat expiré') {
                setTimeout(async () => {
                  try {
                    const updated = await apiClient.get(`/api/v1/tracking/leads/${lid}`);
                    if (updated && updated.id) {
                      setLeads(prev => prev.map(l => String(l.id) === lid ? { ...l, ...updated } : l));
                      // Re-fetch contracts for this lead
                      if (typeof fetchLeadContracts === 'function') fetchLeadContracts(updated.id);
                    }
                  } catch {}
                }, 300);
                break;
              }

              // Default: debounced single-lead re-fetch for real-time sync
              if (leadFetchTimers.current[lid]) clearTimeout(leadFetchTimers.current[lid]);
              leadFetchTimers.current[lid] = setTimeout(async () => {
                delete leadFetchTimers.current[lid];
                try {
                  const updated = await apiClient.get(`/api/v1/tracking/leads/${lid}`);
                  if (updated && updated.id) {
                    setLeads(prev => {
                      const exists = prev.some(l => String(l.id) === lid);
                      if (exists) {
                        return prev.map(l => String(l.id) === lid ? { ...l, ...updated } : l);
                      } else {
                        return [...prev, updated];
                      }
                    });
                  }
                } catch (err) {
                  if (err.status === 404 || err.status === 403) {
                    setLeads(prev => prev.filter(l => String(l.id) !== lid));
                  }
                }
              }, 300);
            }
            break;
          }
          case 'tab_change':
            if (msg.email === user.email) break;
            setRemoteUserTabs(prev => ({ ...prev, [msg.email]: msg.tab }));
            break;
          case 'lead_focus':
            if (msg.email === user.email) break;
            if (msg.lead_id) {
              const cursorColor = getCursorColor(msg.email);
              setRemoteLeadFocus(prev => ({ ...prev, [msg.email]: { lead_id: String(msg.lead_id), full_name: msg.full_name, color: cursorColor } }));
            } else {
              setRemoteLeadFocus(prev => { const next = { ...prev }; delete next[msg.email]; return next; });
            }
            break;
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = (e) => {
      setWsConnected(false);
      if (e.code === 4001) console.warn('[WS] Room full (max 3)');
    };

    // Send own cursor position (throttled ~15/sec)
    let lastSend = 0;
    const handleMouseMove = (e) => {
      if (!ws || ws.readyState !== 1) return;
      if (Date.now() - lastSend < 66) return;
      lastSend = Date.now();
      ws.send(JSON.stringify({ type: 'cursor_move', x: e.clientX, y: e.clientY }));
    };
    document.addEventListener('mousemove', handleMouseMove);

    // Idle cursor cleanup (hide after 30s without movement)
    const idleInterval = setInterval(() => {
      setRemoteCursors(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(email => {
          if (Date.now() - next[email].lastSeen > 30000) delete next[email];
        });
        return next;
      });
    }, 5000);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearInterval(idleInterval);
      if (ws.readyState === 1) ws.close();
      wsRef.current = null;
    };
  }, [loading]);

  // ── LEAD STATE ────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const leadsRef = useRef([]);
  useEffect(() => { leadsRef.current = leads; }, [leads]);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedLead, setSelectedLead] = useState(null);
  const [copiedField, setCopiedField] = useState(null); // 'phone-{id}' or 'email-{id}'
  const [exitingCards, setExitingCards] = useState(new Set());
  const [animatingBadges, setAnimatingBadges] = useState(new Set());
  const [editingNotes, setEditingNotes] = useState({});
  const [tabKey, setTabKey] = useState(0); // forces re-animation on tab switch
  const prevCountsRef = useRef(null);
  const [sendingContract, setSendingContract] = useState(null); // lead.id or null
  const [navNotif, setNavNotif] = useState(null); // 'sending' | 'sent' | null
  const [resendingContract, setResendingContract] = useState(null); // lead.id or null
  const [cancelingContract, setCancelingContract] = useState(null); // contract.id or null
  const [leadContracts, setLeadContracts] = useState({}); // { [lead_id]: contract[] }
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [signingCard, setSigningCard] = useState(null); // lead.id when signing animation plays
  const [completedSticker, setCompletedSticker] = useState(false); // triggers sticker stamp animation on completed container icon
  const [calendarError, setCalendarError] = useState(null); // { leadId, message } — shown when Google Calendar returns 409
  const [kpis, setKpis] = useState(null); // { leads_assigned, leads_treated, closing_r1, closing_audit, conversion_rate, revenue, ... }
  const [noteJustSaved, setNoteJustSaved] = useState(null); // lead.id — triggers mynote sticker appear animation
  const [flyingCard, setFlyingCard] = useState(null); // { lead, sourceRect, dx, dy, catColor, destCatIndex }
  const [glowingTab, setGlowingTab] = useState(null); // category index receiving a card
  const flyCleanupRef = useRef([]);
  const prevTabRef = useRef(0); // track previous tab for tabDrop animation
  const [droppingTab, setDroppingTab] = useState(null); // index of tab that just became inactive
  const detailContainerRef = useRef(null); // portal target for detail panel (separate card)

  // ── SALE DECLARATION MODAL (signed tab) ────────────────────────────────────
  const [showSaleModal, setShowSaleModal] = useState(null); // lead.id when modal is open
  const [saleForm, setSaleForm] = useState({ email: '', paymentModality: 'M', employeeRange: '' });
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);
  const EMPLOYEE_RANGES = [
    '1-2','3-5','6-10','11-19','20-29','30-39','40-49','50-74','75-99',
    '100-149','150-199','200-249','250-299','300-349','350-400',
  ];

  const [saleClientNumero, setSaleClientNumero] = useState(null);

  const handleSaleSubmit = async (leadId) => {
    setSaleSubmitting(true);
    try {
      const user = apiClient.getUser();
      const lead = leads.find(l => l.id === leadId);
      const paymentMode = saleForm.paymentModality === 'M' ? 'MONTHLY' : 'YEARLY';
      const emailVal = saleForm.email.trim().toLowerCase();

      // Step 1: Backend — create client
      let clientNumero = null;
      try {
        const res = await apiClient.post(`/api/v1/tracking/leads/${leadId}/declare-sale`, {
          email: emailVal,
          payment_mode: paymentMode,
          employee_band: saleForm.employeeRange,
        });
        clientNumero = res.client_numero || null;
      } catch (err) {
        const msg = err?.message || err?.detail || '';
        if (err?.status === 400) { alert(msg || 'Les dates Onboarding et Lancement doivent être remplies.'); setSaleSubmitting(false); return; }
        if (err?.status === 409) { alert(msg || 'Un client avec cet email existe déjà.'); setSaleSubmitting(false); return; }
        if (err?.status === 403 || err?.status === 404) { alert(msg || 'Lead introuvable ou accès refusé.'); setSaleSubmitting(false); return; }
        console.warn('declare-sale failed, continuing with webhook:', err);
      }

      // Step 2: Webhook n8n (fire-and-forget with retries, same as Leaderboard)
      const webhookUrl = import.meta.env.VITE_N8N_SALES_WEBHOOK_URL || 'https://n8nmay.xyz/webhook/6c57e2c2-79c7-4e21-ad42-6dfe0abc6839';
      const payload = {
        email: emailVal,
        payment_mode: paymentMode,
        employee_band: saleForm.employeeRange,
        submitted_at: new Date().toISOString(),
        source: 'TRACKING_SHEET',
        reporter_name: user?.full_name || user?.name || '',
        reporter_first_name: (user?.full_name || user?.name || '').split(' ')[0],
        reporter_email: user?.email || null,
        lead_id: leadId,
        lead_name: lead?.full_name || '',
      };
      // Fire-and-forget with retries (non-blocking)
      (async () => {
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000 + (attempt - 1) * 5000);
            const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) break;
          } catch { if (attempt < 5) await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1))); }
        }
      })();

      // Step 3: Success
      setSaleClientNumero(clientNumero);
      setSaleSuccess(true);
      setTimeout(() => { setSaleSuccess(false); setSaleClientNumero(null); setShowSaleModal(null); setSaleForm({ email: '', paymentModality: 'M', employeeRange: '' }); }, 2500);
    } catch (e) { console.error('Sale submit error:', e); }
    setSaleSubmitting(false);
  };

  // ── WEBSOCKET: PRESENCE + CURSORS + TOASTS ────────────────────────────────
  const [remoteCursors, setRemoteCursors] = useState({}); // { email: { full_name, x, y, lastSeen, color } }
  const [remoteUserTabs, setRemoteUserTabs] = useState({}); // { email: 'r1' }
  const [remoteLeadFocus, setRemoteLeadFocus] = useState({}); // { email: { lead_id, full_name, color } }
  const [actionToasts, setActionToasts] = useState([]); // [{ id, user_name, action, lead_id, email, ts }]
  const [presenceUsers, setPresenceUsers] = useState([]); // [{ email, full_name }]
  const [wsConnected, setWsConnected] = useState(false);
  const [highlightedLeadId, setHighlightedLeadId] = useState(null);
  const wsRef = useRef(null);
  const leadFetchTimers = useRef({}); // debounce re-fetch per lead_id
  const cursorColorsRef = useRef({});
  const CURSOR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
  const getCursorColor = (email) => {
    if (!cursorColorsRef.current[email]) {
      const idx = Object.keys(cursorColorsRef.current).length % CURSOR_COLORS.length;
      cursorColorsRef.current[email] = CURSOR_COLORS[idx];
    }
    return cursorColorsRef.current[email];
  };

  // ── SIDEBAR NAV + FORM STATE ────────────────────────────────────────────
  const [sidebarView, setSidebarView] = useState('leads'); // 'leads' | 'add_lead' | 'calendar' | 'notifications' | 'kpis' | 'campaigns'
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
  const [formData, setFormData] = useState({ full_name: '', phone: '', email: '', sector: '', company_type: '' });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState([]); // multi-select: r1_result or r2_result values (e.g. ['no_show', 'done'])
  const [filterOrigins, setFilterOrigins] = useState([]); // multi-select: origin values (e.g. ['BTP', 'cc'])
  const [filterStatuses, setFilterStatuses] = useState([]); // multi-select: ['r1_done', 'r1_not_done', 'r2_done', 'r2_not_done']
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [openFilter, setOpenFilter] = useState(''); // '' | 'tag' | 'status' | 'sort' — which dropdown is open
  const [showFilters, setShowFilters] = useState(true); // toggle filter sidebar visibility
  const [openFilterSections, setOpenFilterSections] = useState(new Set()); // which sidebar filter sections are open
  const [dismissedNotifs, setDismissedNotifs] = useState([]); // loaded from backend GET /notifications/dismissed
  const [backendPerfAlerts, setBackendPerfAlerts] = useState(null); // from GET /notifications/performance
  const [notifBadgeFlash, setNotifBadgeFlash] = useState(false); // pulse when new notifs arrive
  const prevNotifKeysRef = useRef(null); // track notif keys across polls
  const [activeWorkflow, setActiveWorkflow] = useState(null); // { leadId, contactResult, appointmentResult, r1Result, r1FollowUp, r2Result, newDate }

  // ── INLINE EDIT STATE ──────────────────────────────────────────────────
  const [editingField, setEditingField] = useState(null); // { leadId, field, value } or null
  const editInputRef = useRef(null);

  // ── NDA POPUP STATE ────────────────────────────────────────────────────
  const [ndaPopup, setNdaPopup] = useState(null); // { leadId } or null — which lead's NDA popup is open
  const [ndaData, setNdaData] = useState(null); // AI-prefilled company data for popup
  const [ndaLoading, setNdaLoading] = useState(false); // ai-prefill loading state
  const [ndaError, setNdaError] = useState('');
  const [ndaSuccess, setNdaSuccess] = useState(false);
  const [ndaGenerating, setNdaGenerating] = useState(false); // PDF generation in progress

  // ── CAMPAIGN STATE ──────────────────────────────────────────────────────
  const [openCampaign, setOpenCampaign] = useState(null); // campaign object or null
  const [campaignRect, setCampaignRect] = useState(null); // source DOMRect for animation
  const [campaignClosing, setCampaignClosing] = useState(false); // closing animation flag

  // ── DERIVED DATA ──────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts = {};
    CATEGORIES.forEach(cat => { counts[cat.key] = 0; });
    leads.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const catKey = CATEGORIES[activeTab].key;
    let result = leads.filter(l => l.status === catKey && !exitingCards.has(l.id));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(l =>
        (l.full_name && l.full_name.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.phone && l.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
      );
    }
    // Filter by origin (niche)
    if (filterOrigins.length > 0) {
      result = result.filter(l => filterOrigins.includes(l.origin));
    }
    // Filter by tag (qualification result) — tab-contextual field
    if (filterTags.length > 0) {
      if (catKey === 'r1') {
        result = result.filter(l => filterTags.includes(l.r1_result));
      } else if (catKey === 'r2') {
        result = result.filter(l => filterTags.includes(l.r2_result));
      } else {
        result = result.filter(l => filterTags.includes(l.r1_result) || filterTags.includes(l.r2_result));
      }
    }
    // Filter by qualification status (multi-select)
    if (filterStatuses.length > 0) {
      result = result.filter(l => {
        return filterStatuses.some(s => {
          if (s === 'r1_done') return l.r1_result === 'done';
          if (s === 'r1_not_done') return !l.r1_result || l.r1_result !== 'done';
          if (s === 'r2_done') return l.r2_result === 'done';
          if (s === 'r2_not_done') return !l.r2_result || l.r2_result !== 'done';
          if (s === 'contacted') return !!l.first_contact_date;
          if (s === 'not_contacted') return !l.first_contact_date;
          return false;
        });
      });
    }
    // Sort by arrival date
    if (sortOrder === 'oldest') {
      result = [...result].sort((a, b) => (a.assigned_at || '').localeCompare(b.assigned_at || ''));
    } else {
      result = [...result].sort((a, b) => (b.assigned_at || '').localeCompare(a.assigned_at || ''));
    }
    return result;
  }, [leads, activeTab, exitingCards, searchQuery, filterTags, filterStatuses, filterOrigins, sortOrder]);

  // Dismiss a notification (optimistic + backend persist)
  const dismissNotif = (key) => {
    setDismissedNotifs(prev => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
    apiClient.post('/api/v1/notifications/dismiss', { key }).catch(e => console.warn('Dismiss failed:', e));
  };

  // Notification badges: count leads with meetings today per tab
  const tabNotifications = useMemo(() => {
    const notifs = {};
    CATEGORIES.forEach(cat => { notifs[cat.key] = 0; });
    leads.forEach(l => {
      if (l.status === 'r1' && toDateOnly(l.r1) === TODAY) notifs.r1++;
      if (l.status === 'r2' && toDateOnly(l.r2) === TODAY) notifs.r2++;
    });
    return notifs;
  }, [leads]);

  // Weekly performance alerts (from backend, with client-side fallback)
  const perfAlerts = useMemo(() => {
    const LABELS = {
      r1_closing: { name: 'R1', threshold: 60, warnColor: '#f59e0b', warnMsg: 'Trop de R1 annulés.' },
      r2_closing: { name: 'R2', threshold: 80, warnColor: '#fb923c', warnMsg: 'Trop de no-shows R2.' },
      signature_closing: { name: 'signature', threshold: 33, warnColor: '#ef4444', warnMsg: 'Objectif 1/3 non atteint.' },
    };

    if (backendPerfAlerts) {
      return backendPerfAlerts.map(a => {
        const cfg = LABELS[a.type] || { name: a.type, threshold: a.threshold, warnColor: '#ef4444', warnMsg: '' };
        return {
          key: a.key,
          type: 'perf',
          icon: a.good ? '✓' : '⚠',
          color: a.good ? '#10b981' : cfg.warnColor,
          title: a.good ? `Bon closing ${cfg.name} : ${a.rate}%` : `Closing ${cfg.name} faible : ${a.rate}%`,
          desc: a.good
            ? `Objectif ${a.threshold}% atteint`
            : `${a.rate}% — objectif ${a.threshold}% non atteint. ${cfg.warnMsg}`,
        };
      });
    }

    // Fallback: client-side calculation
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const weekNum = Math.ceil(((now - jan4) / 86400000 + jan4.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    const alerts = [];
    const r1Total = leads.filter(l => l.r1_result).length;
    const r1Done = leads.filter(l => l.r1_result === 'done').length;
    const r1Rate = r1Total > 0 ? Math.round((r1Done / r1Total) * 100) : null;
    if (r1Rate !== null) {
      const good = r1Rate >= 60;
      alerts.push({ key: `perf-r1-${weekKey}`, type: 'perf', icon: good ? '✓' : '⚠', color: good ? '#10b981' : '#f59e0b',
        title: good ? `Bon closing R1 : ${r1Rate}%` : `Closing R1 faible : ${r1Rate}%`,
        desc: good ? `${r1Done}/${r1Total} R1 effectués — objectif 60% atteint` : `${r1Done}/${r1Total} R1 effectués — objectif 60% non atteint. Trop de R1 annulés.` });
    }
    const r2Total = leads.filter(l => l.r2_result).length;
    const r2Done = leads.filter(l => l.r2_result === 'done').length;
    const r2Rate = r2Total > 0 ? Math.round((r2Done / r2Total) * 100) : null;
    if (r2Rate !== null) {
      const good = r2Rate >= 80;
      alerts.push({ key: `perf-r2-${weekKey}`, type: 'perf', icon: good ? '✓' : '⚠', color: good ? '#10b981' : '#fb923c',
        title: good ? `Bon closing R2 : ${r2Rate}%` : `Closing R2 faible : ${r2Rate}%`,
        desc: good ? `${r2Done}/${r2Total} R2 effectués — objectif 80% atteint` : `${r2Done}/${r2Total} R2 effectués — objectif 80% non atteint. Trop de no-shows.` });
    }
    const signed = leads.filter(l => l.status === 'signed').length;
    const sigRate = r2Done > 0 ? Math.round((signed / r2Done) * 100) : null;
    if (sigRate !== null) {
      const good = sigRate >= 33;
      alerts.push({ key: `perf-sig-${weekKey}`, type: 'perf', icon: good ? '✓' : '⚠', color: good ? '#10b981' : '#ef4444',
        title: good ? `Bon closing signature : ${sigRate}%` : `Closing signature faible : ${sigRate}%`,
        desc: good ? `${signed}/${r2Done} signés après R2 — objectif 1/3 atteint` : `${signed}/${r2Done} signés après R2 — objectif 1/3 non atteint.` });
    }
    return alerts;
  }, [leads, backendPerfAlerts]);

  // Detect new notifications arriving (polling) → flash sidebar badge
  useEffect(() => {
    const meetingKeys = leads
      .filter(l => (l.status === 'r1' && toDateOnly(l.r1) === TODAY) || (l.status === 'r2' && toDateOnly(l.r2) === TODAY))
      .map(l => l.status === 'r1' ? `r1-${l.id}-${TODAY}` : `r2-${l.id}-${TODAY}`);
    const allUnread = [...meetingKeys, ...perfAlerts.map(a => a.key)].filter(k => !dismissedNotifs.includes(k));
    const currentKeySet = new Set(allUnread);

    if (prevNotifKeysRef.current !== null) {
      // Check if any key is new compared to last poll
      const hasNewNotif = allUnread.some(k => !prevNotifKeysRef.current.has(k));
      if (hasNewNotif) {
        setNotifBadgeFlash(true);
        setTimeout(() => setNotifBadgeFlash(false), 1200);
      }
    }
    prevNotifKeysRef.current = currentKeySet;
  }, [leads, perfAlerts, dismissedNotifs]);

  // Auto-dismiss all notifications when user visits the Notifications view
  useEffect(() => {
    if (sidebarView !== 'notifications') return;
    const meetingKeys = leads
      .filter(l => (l.status === 'r1' && toDateOnly(l.r1) === TODAY) || (l.status === 'r2' && toDateOnly(l.r2) === TODAY))
      .map(l => l.status === 'r1' ? `r1-${l.id}-${TODAY}` : `r2-${l.id}-${TODAY}`);
    const allKeys = [...meetingKeys, ...perfAlerts.map(a => a.key)];
    const unread = allKeys.filter(k => !dismissedNotifs.includes(k));
    if (unread.length > 0) {
      unread.forEach(k => dismissNotif(k));
    }
  }, [sidebarView]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── SCROLL SELECTED PILL INTO VIEW ──────────────────────────────────────────
  useEffect(() => {
    if (selectedLead) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`lead-pill-${selectedLead}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }, [selectedLead]);

  // ── FLYING CARD ANIMATION (FLIP shared-element transition) ───────────────
  const triggerFlyAnimation = (leadId, lead, newStatus) => {
    flyCleanupRef.current.forEach(clearTimeout);
    flyCleanupRef.current = [];
    const pillEl = document.getElementById(`lead-pill-${leadId}`);
    const srcEl = pillEl;
    const destCatIdx = CATEGORIES.findIndex(c => c.key === newStatus);
    const tabEl = document.querySelector(`[data-tab-key="${newStatus}"]`);
    if (!srcEl || !tabEl || destCatIdx === -1) return;
    const badgeEl = tabEl.querySelector('[data-tab-badge]');
    const sourceRect = srcEl.getBoundingClientRect();
    const destRect = (badgeEl || tabEl).getBoundingClientRect();
    const dx = (destRect.left + destRect.width / 2) - (sourceRect.left + sourceRect.width / 2);
    const dy = (destRect.top + destRect.height / 2) - (sourceRect.top + sourceRect.height / 2);
    setFlyingCard({
      lead: { full_name: lead.full_name, origin: lead.origin },
      sourceRect: { left: sourceRect.left, top: sourceRect.top, width: sourceRect.width, height: sourceRect.height },
      dx, dy,
      catColor: CATEGORIES[destCatIdx].color,
      destCatIndex: destCatIdx,
      wasExpanded: false,
    });
    flyCleanupRef.current = [
      setTimeout(() => setGlowingTab(destCatIdx), 520),
      setTimeout(() => setFlyingCard(null), 820),
      setTimeout(() => setGlowingTab(null), 1060),
    ];
  };

  useEffect(() => {
    if (!flyingCard) return;
    const el = document.getElementById('flying-card-clone');
    if (!el) return;
    const { dx, dy } = flyingCard;
    // Apple Genie suction — exaggerated stretch + trapezoid pinch
    // perspective(600px) = very close camera → heavy 3D distortion on rotateX
    // Phase 1 (0-22%): card stretches tall + top edges pinch hard = visible trapezoid
    // Phase 2 (22-100%): funnel compresses toward destination tab
    el.animate([
      { transform: 'perspective(600px) translate3d(0, 0, 0) rotateX(0deg) scaleX(1) scaleY(1)', opacity: 1 },
      { transform: `perspective(600px) translate3d(0, ${dy * 0.005}px, 0) rotateX(6deg) scaleX(0.96) scaleY(1.18)`, opacity: 1, offset: 0.06 },
      { transform: `perspective(600px) translate3d(0, ${dy * 0.01}px, 0) rotateX(12deg) scaleX(0.91) scaleY(1.28)`, opacity: 1, offset: 0.13 },
      { transform: `perspective(600px) translate3d(${dx * 0.04}px, ${dy * 0.04}px, 0) rotateX(16deg) scaleX(0.86) scaleY(1.18)`, opacity: 1, offset: 0.20 },
      { transform: `perspective(600px) translate3d(${dx * 0.22}px, ${dy * 0.14}px, 0) rotateX(24deg) scaleX(0.62) scaleY(0.82)`, opacity: 0.97, offset: 0.32 },
      { transform: `perspective(600px) translate3d(${dx * 0.48}px, ${dy * 0.34}px, 0) rotateX(36deg) scaleX(0.32) scaleY(0.55)`, opacity: 0.92, offset: 0.46 },
      { transform: `perspective(600px) translate3d(${dx * 0.74}px, ${dy * 0.60}px, 0) rotateX(46deg) scaleX(0.11) scaleY(0.28)`, opacity: 0.70, offset: 0.62 },
      { transform: `perspective(600px) translate3d(${dx * 0.91}px, ${dy * 0.84}px, 0) rotateX(54deg) scaleX(0.03) scaleY(0.10)`, opacity: 0.35, offset: 0.78 },
      { transform: `perspective(600px) translate3d(${dx}px, ${dy}px, 0) rotateX(60deg) scaleX(0.01) scaleY(0.02)`, opacity: 0.08 },
    ], { duration: 740, easing: 'cubic-bezier(0.22, 0, 0.68, 0.35)', fill: 'forwards' });
  }, [flyingCard]);

  // Cleanup fly timers on unmount
  useEffect(() => () => { flyCleanupRef.current.forEach(clearTimeout); }, []);

  // ── CONTRACT FETCH ────────────────────────────────────────────────────────
  const fetchLeadContracts = async (leadId) => {
    try {
      const resp = await apiClient.get(`/api/v1/contracts/my-contracts?lead_id=${leadId}`);
      const contracts = resp.contracts || resp || [];
      const list = Array.isArray(contracts) ? contracts : [];
      setLeadContracts(prev => ({ ...prev, [leadId]: list }));
      return list;
    } catch {
      setLeadContracts(prev => ({ ...prev, [leadId]: [] }));
      return [];
    }
  };

  // Fetch contracts for all R2 leads when R2 tab is active
  // Auto-move leads with signed contracts to "signed" tab
  const r2CatIndex = CATEGORIES.findIndex(c => c.key === 'r2');
  useEffect(() => {
    if (activeTab !== r2CatIndex) return;
    const r2Leads = leads.filter(l => l.status === 'r2');
    if (r2Leads.length === 0) return;
    setLoadingContracts(true);
    Promise.all(r2Leads.map(async (l) => {
      const contracts = await fetchLeadContracts(l.id);
      const latest = contracts[0];
      if (latest?.yousign_status === 'done') {
        apiClient.patch(`/api/v1/tracking/leads/${l.id}`, { status: 'signed' }).catch(() => {});
        setLeads(prev => prev.map(ld => ld.id === l.id ? { ...ld, status: 'signed' } : ld));
      }
    })).finally(() => setLoadingContracts(false));
  }, [activeTab, leads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SUPABASE REALTIME: contract status updates ──────────────────────────
  useEffect(() => {
    if (activeTab !== r2CatIndex) return;
    const r2Leads = leads.filter(l => l.status === 'r2');
    if (r2Leads.length === 0) return;

    const r2LeadIds = r2Leads.map(l => l.id);
    const channel = supabase
      .channel('contract-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contracts' },
        (payload) => {
          const updated = payload.new;
          if (!updated.lead_id || !r2LeadIds.includes(updated.lead_id)) return;
          fetchLeadContracts(updated.lead_id);
          // Auto-move lead to "signed" tab when contract is signed
          if (updated.yousign_status === 'done') {
            apiClient.patch(`/api/v1/tracking/leads/${updated.lead_id}`, { status: 'signed' }).catch(() => {});
            setSigningCard(updated.lead_id);
            setTimeout(() => {
              setSigningCard(null);
              const lead = leads.find(l => l.id === updated.lead_id);
              if (lead) triggerFlyAnimation(updated.lead_id, lead, 'signed');
              if (selectedLead === updated.lead_id) setSelectedLead(null);
              setExitingCards(prev => new Set(prev).add(updated.lead_id));
            }, 700);
            setTimeout(() => {
              setLeads(prev => prev.map(l => l.id === updated.lead_id ? { ...l, status: 'signed' } : l));
              setExitingCards(prev => { const s = new Set(prev); s.delete(updated.lead_id); return s; });
            }, 1550);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, leads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── TAB KEYBOARD NAVIGATION ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleTabChange(Math.min(activeTab + 1, CATEGORIES.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleTabChange(Math.max(activeTab - 1, 0));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Toggle "effectués" filter (done tag)
        setFilterTags(prev => prev.includes('done') ? prev.filter(t => t !== 'done') : [...prev, 'done']);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HANDLERS ──────────────────────────────────────────────────────────────
  const handleTabChange = (idx) => {
    if (idx === activeTab) return;
    setDroppingTab(activeTab);
    prevTabRef.current = activeTab;
    setSelectedLead(null);
    setActiveTab(idx);
    setTabKey(k => k + 1);
    setFilterTags([]);
    setFilterStatuses([]);
    setFilterOrigins([]);
    setOpenFilter('');
    // Clear dropping state after animation completes
    setTimeout(() => setDroppingTab(null), 320);
    // Broadcast lead deselection + tab change to other WebSocket users
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'lead_focus', lead_id: null }));
    }
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'tab_change', tab: CATEGORIES[idx]?.key || 'new' }));
    }
  };

  const copyToClipboard = (text, fieldKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const triggerLeadMovedNotif = (lead, newStatus) => {
    const destCat = CATEGORIES.find(c => c.key === newStatus);
    if (!destCat || !lead) return;
    const firstName = (lead.full_name || '').split(' ')[0];
    if (newStatus === 'r1' || newStatus === 'r2') {
      const rdvType = newStatus === 'r1' ? 'R1' : 'R2';
      setNavNotif({ type: 'calendar_created', firstName, rdvType });
    } else {
      setNavNotif({ type: 'lead_moved', name: lead.full_name, destLabel: destCat.label, destColor: destCat.color });
    }
    setTimeout(() => setNavNotif(null), 3000);
  };

  const handleStatusChange = async (leadId, newStatus) => {
    if (newStatus === CATEGORIES[activeTab].key) return;
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { status: newStatus });
    } catch (err) {
      console.error("Erreur changement statut:", err);
      return;
    }
    if (newStatus === 'signed') {
      setSigningCard(leadId);
      setTimeout(() => {
        setSigningCard(null);
        const lead = leads.find(l => l.id === leadId);
        if (lead) { triggerFlyAnimation(leadId, lead, 'signed'); triggerLeadMovedNotif(lead, 'signed'); }
        if (selectedLead === leadId) setSelectedLead(null);
        setExitingCards(prev => new Set(prev).add(leadId));
      }, 700);
      setTimeout(() => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
        setExitingCards(prev => { const s = new Set(prev); s.delete(leadId); return s; });
      }, 1550);
    } else {
      const lead = leads.find(l => l.id === leadId);
      if (lead) { triggerFlyAnimation(leadId, lead, newStatus); triggerLeadMovedNotif(lead, newStatus); }
      if (selectedLead === leadId) setSelectedLead(null);
      setExitingCards(prev => new Set(prev).add(leadId));
      setTimeout(() => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
        setExitingCards(prev => { const s = new Set(prev); s.delete(leadId); return s; });
      }, 900);
    }
  };

  const handleNotesSave = async (leadId) => {
    const newNotes = editingNotes[leadId];
    if (newNotes === undefined) return;
    const hadNotes = leads.find(l => l.id === leadId)?.notes?.trim();
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { notes: newNotes });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: newNotes } : l));
      setEditingNotes(prev => { const n = { ...prev }; delete n[leadId]; return n; });
      setSelectedLead(null);
      // Trigger sticker animation if note was just added (didn't have one before)
      if (!hadNotes && newNotes?.trim()) {
        setNoteJustSaved(leadId);
        setTimeout(() => setNoteJustSaved(null), 800);
      }
    } catch (err) {
      console.error("Erreur sauvegarde notes:", err);
    }
  };

  const handleDateChange = async (leadId, field, value) => {
    const backendField = field === 'r1' ? 'r1_date' : field === 'r2' ? 'r2_date' : field;
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { [backendField]: value || null });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: value } : l));
    } catch (err) {
      console.error("Erreur mise à jour date:", err);
    }
  };

  const handleEmployeeRangeChange = async (leadId, range) => {
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { employee_range: range });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, employee_range: range } : l));
    } catch (err) {
      console.error("Erreur mise à jour tranche:", err);
    }
  };

  const handleDocsReceivedToggle = async (leadId, currentValue) => {
    const newValue = !currentValue;
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, docs_received: newValue } : l));
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { docs_received: newValue });
    } catch (err) {
      console.error("Erreur mise à jour docs_received:", err);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, docs_received: currentValue } : l));
    }
  };

  const handleSendContract = async (lead) => {
    if (!lead.employee_range) return;
    if (!lead.company_count) { alert('Veuillez renseigner le nombre de sociétés avant d\'envoyer le contrat.'); return; }
    setSendingContract(lead.id);
    setNavNotif('sending');
    try {
      await apiClient.post('/api/v1/contracts/send', {
        lead_id: lead.id,
        employee_range: lead.employee_range,
      });
      await fetchLeadContracts(lead.id);
      setNavNotif('sent'); // triggers check animation → auto-clears after 2.5s in navbar
      // Clear navNotif from parent side after navbar has finished its animation
      setTimeout(() => setNavNotif(null), 3000);
    } catch (err) {
      console.error("Erreur envoi contrat:", err);
      const message = err?.response?.data?.detail || err?.message || "Erreur inconnue";
      alert(`Erreur lors de l'envoi du contrat : ${message}`);
      setNavNotif(null);
    } finally {
      setSendingContract(null);
    }
  };

  const handleResendContract = async (contractId, leadId) => {
    if (!window.confirm("Renvoyer ce contrat ? Un nouveau contrat sera créé et envoyé au client.")) return;
    setResendingContract(leadId);
    try {
      await apiClient.post(`/api/v1/contracts/${contractId}/resend`);
      await fetchLeadContracts(leadId);
    } catch (err) {
      console.error("Erreur renvoi contrat:", err);
      const message = err?.response?.data?.detail || err?.message || "Erreur inconnue";
      alert(`Erreur lors du renvoi : ${message}`);
    } finally {
      setResendingContract(null);
    }
  };

  const handleCancelContract = async (contractId, leadId) => {
    if (!window.confirm("Annuler ce contrat ? Le client ne pourra plus signer.")) return;
    setCancelingContract(contractId);
    try {
      await apiClient.post(`/api/v1/contracts/${contractId}/cancel`);
      await fetchLeadContracts(leadId);
    } catch (err) {
      console.error("Erreur annulation contrat:", err);
      const message = err?.response?.data?.detail || err?.message || "Erreur inconnue";
      alert(`Erreur lors de l'annulation : ${message}`);
    } finally {
      setCancelingContract(null);
    }
  };

  // ── WORKFLOW HANDLER ─────────────────────────────────────────────────────
  const handleWorkflowSubmit = async (leadId, patchData) => {
    const currentStatus = CATEGORIES[activeTab].key;
    const newStatus = patchData.status;
    // Check email required for R1/R2 date changes
    if (patchData.r1_date || patchData.r2_date) {
      const lead = leads.find(l => l.id === leadId);
      if (lead && !lead.email) {
        setCalendarError({ leadId, message: "Remplissez l'email du prospect avant de fixer un rendez-vous" });
        setTimeout(() => setCalendarError(null), 5000);
        return;
      }
    }
    let resp;
    try {
      resp = await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, patchData);
    } catch (err) {
      console.error("Erreur workflow:", err);
      // Handle 409 — commercial is busy on this slot
      if (err.status === 409) {
        const detail = err.data?.detail;
        const busyMsg = typeof detail === 'string' ? detail : detail?.message || "Vous êtes occupé sur ce créneau. Vérifiez votre Google Calendar.";
        setCalendarError({ leadId, message: busyMsg });
        setTimeout(() => setCalendarError(null), 5000);
      }
      return;
    }
    // Update meet_link from backend response
    if (resp) {
      const meetFields = {};
      if (resp.r1_meet_link) meetFields.r1_meet_link = resp.r1_meet_link;
      if (resp.r2_meet_link) meetFields.r2_meet_link = resp.r2_meet_link;
      if (resp.r1_event_id) meetFields.r1_event_id = resp.r1_event_id;
      if (resp.r2_event_id) meetFields.r2_event_id = resp.r2_event_id;
      if (Object.keys(meetFields).length > 0) {
        patchData = { ...patchData, ...meetFields };
      }
    }
    setActiveWorkflow(null);
    if (newStatus && newStatus !== currentStatus) {
      if (newStatus === 'signed') {
        setSigningCard(leadId);
        setTimeout(() => {
          setSigningCard(null);
          const lead = leads.find(l => l.id === leadId);
          if (lead) { triggerFlyAnimation(leadId, lead, 'signed'); triggerLeadMovedNotif(lead, 'signed'); }
          if (selectedLead === leadId) setSelectedLead(null);
          setExitingCards(prev => new Set(prev).add(leadId));
        }, 700);
        setTimeout(() => {
          setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...patchData } : l));
          setExitingCards(prev => { const s = new Set(prev); s.delete(leadId); return s; });
        }, 1550);
      } else {
        const lead = leads.find(l => l.id === leadId);
        if (lead) { triggerFlyAnimation(leadId, lead, newStatus); triggerLeadMovedNotif(lead, newStatus); }
        if (selectedLead === leadId) setSelectedLead(null);
        setExitingCards(prev => new Set(prev).add(leadId));
        setTimeout(() => {
          setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...patchData } : l));
          setExitingCards(prev => { const s = new Set(prev); s.delete(leadId); return s; });
        }, 900);
      }
    } else {
      // Update in place (no tab change)
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...patchData } : l));
      // Trigger completed sticker animation when R1/R2 marked as done
      if (patchData.r1_result === 'done' || patchData.r2_result === 'done') {
        setCompletedSticker(true);
        setTimeout(() => setCompletedSticker(false), 600);
      }
    }
  };

  const formatDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  // ── SIDEBAR FORM HANDLERS ──────────────────────────────────────────────
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  };

  const handleFormSubmit = async () => {
    if (!formData.full_name.trim()) { setFormError('Le nom complet est requis'); return false; }
    if (!formData.phone.trim()) { setFormError('Le numéro de téléphone est requis'); return false; }
    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = { full_name: formData.full_name.trim(), phone: formData.phone.trim() };
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.sector.trim()) payload.sector = formData.sector.trim();
      if (formData.company_type.trim()) payload.company_type = formData.company_type.trim();
      // Admin viewing another commercial's sheet → assign to that commercial
      if (isAdminView && viewingSheetId) payload.assigned_to = viewingSheetId;
      const resp = await apiClient.post('/api/v1/tracking/leads', payload);
      const newLead = resp.lead;
      if (newLead) {
        setLeads(prev => [...prev, {
          ...newLead,
          full_name: newLead.full_name || newLead.client || '',
          r1: newLead.r1_date || newLead.r1 || null,
          r2: newLead.r2_date || newLead.r2 || null,
        }]);
      }
      setFormSuccess(true);
      setFormData({ full_name: '', phone: '', email: '', sector: '', company_type: '' });
      setTimeout(() => setFormSuccess(false), 2500);
      return true;
    } catch (err) {
      console.error("Erreur création lead:", err);
      const message = err?.response?.data?.detail || err?.message || "Erreur lors de la création du lead";
      setFormError(message);
      return false;
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── INLINE FIELD EDIT ──────────────────────────────────────────────────
  const startFieldEdit = (leadId, field, currentValue) => {
    setEditingField({ leadId, field, value: currentValue || '' });
    setTimeout(() => editInputRef.current?.focus(), 50);
  };
  const saveFieldEdit = async () => {
    if (!editingField) return;
    const { leadId, field, value } = editingField;
    const trimmed = value.trim();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) { setEditingField(null); return; }
    // No change → just close
    if (trimmed === (lead[field] || '').trim()) { setEditingField(null); return; }
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { [field]: trimmed || null });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: trimmed || null } : l));
    } catch (err) {
      console.error('Erreur mise à jour champ:', err);
    }
    setEditingField(null);
  };
  const cancelFieldEdit = () => setEditingField(null);

  // ── NDA POPUP HANDLERS ──────────────────────────────────────────────────
  const NDA_LEGAL_FORMS = ["SARL", "SAS", "SASU", "SA", "EURL", "SCI", "SNC", "EI"];
  const NDA_BUSINESS_TYPES = [
    "Ambulance", "Micro créche", "Dentiste", "Pharmacie", "Salle de sport",
    "Esthétique", "Tech", "Hôtellerie", "Grande Distribution", "Tertiaire",
    "BTP", "Boulangerie", "Immobilier", "Restauration", "Générales",
  ];
  const toSchemaLegalForm = (lf) => (lf === "EI" ? "Autre" : lf);

  const openNdaPopup = (lead) => {
    setNdaPopup({ leadId: lead.id });
    setNdaData({
      legalName: lead.company_name || '',
      legalForm: 'SARL',
      siren: '',
      rcsCity: '',
      email: lead.email || '',
      phone: lead.phone || '',
      headOffice: { line1: '', postalCode: '', city: '', country: 'France' },
      representatives: [{ fullName: lead.full_name || '', role: 'Gérant' }],
      businessType: 'Générales',
      isInRegistration: false,
    });
    setNdaError('');
    setNdaSuccess(false);
    setNdaLoading(false);
    setNdaGenerating(false);
  };

  const handleNdaPrefill = async () => {
    if (!ndaData || !ndaPopup) return;
    const lead = leads.find(l => l.id === ndaPopup.leadId);
    const query = `${ndaData.legalName || lead?.company_name || ''} - ${lead?.full_name || ''}`.trim();
    if (!query || query === '-') { setNdaError('Renseignez le nom de la société'); return; }
    setNdaLoading(true);
    setNdaError('');
    setNdaSuccess(false);
    try {
      const data = await apiClient.post('/api/v1/contracts/ai-prefill', { query });
      const updates = {};
      if (data.legal_name) updates.legalName = data.legal_name;
      if (data.legal_form) {
        const match = NDA_LEGAL_FORMS.find(f => f.toUpperCase() === data.legal_form.toUpperCase());
        if (match) updates.legalForm = match;
      }
      if (data.siren) updates.siren = data.siren;
      if (data.rcs_city) updates.rcsCity = data.rcs_city;
      if (data.address) {
        updates.headOffice = {
          line1: data.address.line1 || '',
          postalCode: data.address.postal_code || '',
          city: data.address.city || '',
          country: data.address.country || 'France',
        };
      }
      if (data.representatives?.length) {
        updates.representatives = data.representatives.map(r => ({
          fullName: r.full_name || '',
          role: (r.role || 'Gérant').replace(/\s+d[eu']\s+\S+$/i, ''),
        }));
      }
      if (data.business_type && NDA_BUSINESS_TYPES.includes(data.business_type)) {
        updates.businessType = data.business_type;
      }
      setNdaData(prev => ({ ...prev, ...updates }));
      setNdaSuccess(true);
      setTimeout(() => setNdaSuccess(false), 4000);
    } catch (err) {
      setNdaError(err?.data?.detail || err?.message || 'Erreur lors de la recherche IA');
    } finally {
      setNdaLoading(false);
    }
  };

  const handleNdaGenerate = async () => {
    if (!ndaData || !ndaPopup) return;
    const lead = leads.find(l => l.id === ndaPopup.leadId);
    if (!lead) return;
    if (!ndaData.legalName.trim()) { setNdaError('La raison sociale est requise'); return; }
    if (!ndaData.siren.trim() && !ndaData.isInRegistration) { setNdaError('Le SIREN est requis (ou cochez "En cours d\'immatriculation")'); return; }
    setNdaGenerating(true);
    setNdaError('');
    try {
      // Save company_name to lead if changed
      if (ndaData.legalName !== (lead.company_name || '')) {
        await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { company_name: ndaData.legalName });
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, company_name: ndaData.legalName } : l));
      }
      // Build payload same as ContractNew
      const { businessType: _bt, ...rest } = ndaData;
      const payloadCompany = {
        ...rest,
        legalForm: toSchemaLegalForm(ndaData.legalForm),
        rcsCity: ndaData.legalForm === 'EI' ? '' : ndaData.rcsCity,
        siren: ndaData.isInRegistration ? '' : ndaData.siren,
        isInRegistration: ndaData.isInRegistration || false,
      };
      // Generate PDF
      const resp = await fetch('/api/contract-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: payloadCompany,
          meta: { typeEntreprise: ndaData.businessType || 'Général' },
        }),
      });
      if (!resp.ok) {
        setNdaError('Erreur génération PDF: ' + (await resp.text()));
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NDA_${ndaData.legalName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // Fire-and-forget: sync client data to backend
      try {
        await apiClient.post('/api/v1/contracts/client-data', {
          company: payloadCompany,
          meta: { typeEntreprise: ndaData.businessType || 'Général' },
          client_info_text: '',
          lead_id: lead.id,
        });
      } catch (e) { console.warn('Backend client-data sync failed (non-blocking):', e); }
      // Success → close popup
      setNdaPopup(null);
      setNdaData(null);
      // Refresh leads to get updated sector
      refreshData().catch(() => {});
    } catch (err) {
      console.error('Erreur NDA:', err);
      setNdaError(err?.message || 'Erreur réseau lors de la génération');
    } finally {
      setNdaGenerating(false);
    }
  };

  // ── LOADING (blank screen — text only after 3s) ─────────────────────────────
  if (loading) {
    return <div style={{ minHeight: "100vh", background: C.surface }} />;
  }

  const activeCat = CATEGORIES[activeTab];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: 0,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      background: C.surface,
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
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes stickerRoll {
          0%   { transform: perspective(800px) rotateY(-90deg); transform-origin: right center; opacity: 0; filter: brightness(0.6); }
          40%  { transform: perspective(800px) rotateY(-20deg); transform-origin: right center; opacity: 1; filter: brightness(0.85); }
          70%  { transform: perspective(800px) rotateY(8deg);   transform-origin: right center; filter: brightness(1.05); }
          85%  { transform: perspective(800px) rotateY(-3deg);  transform-origin: right center; filter: brightness(1); }
          100% { transform: perspective(800px) rotateY(0deg);   transform-origin: right center; opacity: 1; filter: brightness(1); }
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
        @keyframes expandIn {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 800px; }
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
        @keyframes notifBadgeFlash {
          0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          15%  { transform: scale(1.6); box-shadow: 0 0 12px 4px rgba(239,68,68,0.4); }
          30%  { transform: scale(0.9); }
          45%  { transform: scale(1.3); box-shadow: 0 0 8px 2px rgba(239,68,68,0.3); }
          60%  { transform: scale(1); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes emptyFade {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes modalOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalCardIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes noteExpand {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 300px; }
        }
        @keyframes sidebarReveal {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes checkmarkDraw {
          0%   { stroke-dashoffset: 24; opacity: 0; }
          40%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes successPulse {
          0%   { transform: scale(0.8); opacity: 0; }
          50%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes signatureStroke {
          0%   { stroke-dashoffset: 200; opacity: 0; }
          10%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes signatureFade {
          0%   { opacity: 1; transform: scale(1); }
          70%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.92) translateY(-6px); }
        }
        @keyframes signedGlow {
          0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
          30%  { box-shadow: 0 0 0 4px rgba(52,211,153,0.25); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
        @keyframes tabReceive {
          0%   { transform: translateY(0); }
          30%  { transform: translateY(3px); }
          60%  { transform: translateY(-1px); }
          100% { transform: translateY(0); }
        }
        @keyframes badgeReceive {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.5); }
          65%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes tabLift {
          0%   { transform: translateY(0); }
          55%  { transform: translateY(-11px); }
          80%  { transform: translateY(-7px); }
          100% { transform: translateY(-8px); }
        }
        @keyframes tabDrop {
          0%   { transform: translateY(-8px); }
          50%  { transform: translateY(2px); }
          80%  { transform: translateY(-1px); }
          100% { transform: translateY(0); }
        }
        @keyframes contentReveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes campaignCardIn {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* ── Copied toast animation ───────────────────── */
        @keyframes copiedToastIn {
          0%   { opacity: 0; transform: translateY(4px) scale(0.9); }
          30%  { opacity: 1; transform: translateY(-1px) scale(1.02); }
          50%  { transform: translateY(0) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes copiedToastOut {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.92); }
        }
        /* ── Workflow split animations ─────────────────── */
        @keyframes wfSplitIn {
          0%   { opacity: 0; transform: translateY(6px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wfParentShrink {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.85) translateY(-4px); }
        }
        @keyframes wfSelectedPulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.06); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; }
        }
        @keyframes wfDateCardIn {
          0%   { opacity: 0; max-height: 0; transform: translateY(-8px); }
          100% { opacity: 1; max-height: 300px; transform: translateY(0); }
        }
        @keyframes detailSlideIn {
          from { opacity: 0; transform: translateX(30px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes detailSlideOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to   { opacity: 0; transform: translateX(30px) scale(0.97); }
        }
        @keyframes avatarPulse {
          0%   { box-shadow: 0 0 0 0 rgba(91,106,191,0.2); }
          70%  { box-shadow: 0 0 0 10px rgba(91,106,191,0); }
          100% { box-shadow: 0 0 0 0 rgba(91,106,191,0); }
        }
        @keyframes campaignOpen {
          0% {
            left: var(--cr-left); top: var(--cr-top);
            width: var(--cr-width); height: var(--cr-height);
            border-radius: 24px; opacity: 0.85;
            transform: translate(0, 0);
          }
          100% {
            left: 50%; top: 50%;
            width: min(92vw, 860px); height: min(88vh, 720px);
            border-radius: 20px; opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
        .leads-scroll::-webkit-scrollbar {
          width: 3px;
        }
        .leads-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .leads-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 4px;
        }
        .leads-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.22);
        }
      `}</style>

      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} notification={navNotif} />

      {/* ── FLYING CARD CLONE (Genie effect transition) ───────────────────── */}
      {flyingCard && (
        <div
          id="flying-card-clone"
          style={{
            position: 'fixed',
            zIndex: 99999,
            left: flyingCard.sourceRect.left,
            top: flyingCard.sourceRect.top,
            width: flyingCard.sourceRect.width,
            height: flyingCard.sourceRect.height,
            borderRadius: '20px',
            background: darkMode ? 'rgba(30,31,40,0.97)' : 'rgba(255,255,255,0.98)',
            border: `1.5px solid ${flyingCard.catColor}40`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px ${flyingCard.catColor}15`,
            pointerEvents: 'none',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            willChange: 'transform, opacity',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Top row — pill content */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: flyingCard.wasExpanded ? '16px 20px' : '0 18px',
            height: flyingCard.wasExpanded ? 'auto' : '100%',
            gap: '10px',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: flyingCard.catColor, flexShrink: 0 }} />
            <span style={{
              fontSize: flyingCard.wasExpanded ? '15px' : '14px', fontWeight: 600, color: C.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {flyingCard.lead.full_name}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: '50px',
              fontSize: '10px', fontWeight: 600,
              background: (ORIGIN_COLORS[flyingCard.lead.origin] || DEFAULT_ORIGIN).bg,
              color: (ORIGIN_COLORS[flyingCard.lead.origin] || DEFAULT_ORIGIN).text,
              flexShrink: 0,
            }}>
              {flyingCard.lead.origin}
            </span>
          </div>
          {/* Expanded: subtle content placeholder lines */}
          {flyingCard.wasExpanded && (
            <div style={{ padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ height: 10, width: '30%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />
                <div style={{ height: 10, width: '25%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)' }} />
                <div style={{ height: 10, width: '20%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ height: 10, width: '40%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)' }} />
                <div style={{ height: 10, width: '22%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PAGE CONTAINER ──────────────────────────────────────────────────── */}
      <div style={{
        animation: 'pageReveal 0.5s cubic-bezier(0.4,0,0.2,1) both',
      }}>

        {/* ── FLEX ROW: sidebar + board + detail panel ──────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>

          {/* ── LEFT SIDEBAR (full height) ──────────────────────────────────── */}
          <div style={{
            width: 220,
            minWidth: 220,
            borderRight: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            background: darkMode ? C.subtle : '#eceef2',
            animation: 'sidebarReveal 0.4s ease both',
          }}>
            {/* Sidebar header — company logo like Quno */}
            <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px',
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: darkMode ? '#fff' : '#1e2330',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <img src={companyLogo} alt="" style={{ width: 20, height: 20, objectFit: 'contain', filter: darkMode ? 'none' : 'brightness(0) invert(1)' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Owner</div>
              </div>
            </div>

            {/* Nav items */}
            {[
              { key: 'leads', label: 'Mes leads', iconSrc: iconMyLead, accent: C.accent, keepColor: true },
              { key: 'calendar', label: 'Calendrier', iconSrc: iconCalendrier, accent: '#3b82f6' },
              { key: 'notifications', label: 'Notifications', iconSrc: iconNotif, accent: '#ef4444', iconSize: 55, badgeCount: (() => {
                const meetingKeys = [
                  ...leads.filter(l => l.status === 'r1' && toDateOnly(l.r1) === TODAY).map(l => `r1-${l.id}-${TODAY}`),
                  ...leads.filter(l => l.status === 'r2' && toDateOnly(l.r2) === TODAY).map(l => `r2-${l.id}-${TODAY}`),
                ];
                const allKeys = [...meetingKeys, ...perfAlerts.map(a => a.key)];
                return allKeys.filter(k => !dismissedNotifs.includes(k)).length;
              })() },
              { key: 'email', label: 'Relance', iconSrc: iconEmail, accent: C.accent },
              { key: 'campaigns', label: 'Campagnes', iconSrc: iconCampaigns, accent: '#f59e0b' },
              { key: 'kpis', label: 'KPIs & Stats', iconSrc: iconKpis, accent: '#6366f1' },
            ].map(item => {
              const isActive = sidebarView === item.key;
              return (
                <div
                  key={item.key}
                  onClick={() => setSidebarView(item.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: item.iconSize ? '2px 12px' : '9px 12px', margin: '1px 12px', cursor: 'pointer',
                    borderRadius: 10,
                    background: isActive ? (darkMode ? '#fff' : '#1e2330') : 'transparent',
                    boxShadow: 'none',
                    border: '1px solid transparent',
                    color: isActive ? (darkMode ? '#1e2330' : '#fff') : C.muted,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {item.iconSrc && item.keepColor ? (
                    <div style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={item.iconSrc} alt="" style={{ width: 25, height: 25, opacity: isActive ? 1 : 0.5, transition: 'all 0.15s', filter: isActive ? (darkMode ? 'none' : 'brightness(0) invert(1)') : 'none' }} />
                    </div>
                  ) : item.iconSrc ? (
                    <div style={{
                      width: item.iconSize || 28, height: item.iconSize || 28, flexShrink: 0, marginRight: item.iconSize ? -((item.iconSize - 28) / 2) : 0, marginLeft: item.iconSize ? -((item.iconSize - 28) / 2) : 0, marginTop: item.iconSize ? -((item.iconSize - 28) / 2) : 0, marginBottom: item.iconSize ? -((item.iconSize - 28) / 2) : 0,
                      backgroundColor: isActive ? (darkMode ? '#1e2330' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)'),
                      WebkitMaskImage: `url(${item.iconSrc})`,
                      WebkitMaskSize: 'contain',
                      WebkitMaskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskImage: `url(${item.iconSrc})`,
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'center',
                      transition: 'all 0.15s',
                    }} />
                  ) : (
                    <span style={{
                      fontSize: 14, fontWeight: 700, width: 28, textAlign: 'center',
                      color: isActive ? (darkMode ? '#1e2330' : '#fff') : C.muted, transition: 'color 0.15s',
                    }}>
                      {item.icon}
                    </span>
                  )}
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 600 : 500,
                    color: isActive ? (darkMode ? '#1e2330' : '#fff') : C.muted, transition: 'color 0.15s',
                  }}>
                    {item.label}
                  </span>
                  {item.key === 'leads' && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                      padding: '2px 6px', borderRadius: 4,
                      background: C.subtle, color: C.muted,
                    }}>
                      {leads.length}
                    </span>
                  )}
                  {item.badgeCount > 0 && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 50,
                      background: '#ef4444', color: '#fff',
                      animation: notifBadgeFlash ? 'notifBadgeFlash 1.2s ease both' : 'notifPulse 2s ease-in-out infinite',
                    }}>
                      {item.badgeCount}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Spacer */}
            <div style={{ flex: 1 }} />
          </div>

        {/* ── RIGHT COLUMN (single top card + content row) ─────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '8px 8px 8px 0', gap: 12 }}>

          {/* ── KPI HEADER CARD (3 left + gap for navbar + 3 right) ────────── */}
          <div style={{ height: 76, background: darkMode ? C.bg : '#f6f7f9', borderRadius: 8, flexShrink: 0, border: `1px solid ${C.border}`, marginLeft: 8, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
            {kpis && (() => {
              const left = [
                { label: 'Leads', value: kpis.leads_assigned ?? '—' },
                { label: 'Traités', value: kpis.leads_treated ?? '—' },
                { label: 'Closing R1', value: kpis.closing_r1 != null ? `${kpis.closing_r1.toFixed(1)}%` : '—' },
              ];
              const right = [
                { label: 'R1 Placés', value: kpis.closing_r1_placed != null ? `${kpis.closing_r1_placed.toFixed(1)}%` : '—' },
                { label: 'Closing Audit', value: kpis.closing_audit != null ? `${kpis.closing_audit.toFixed(1)}%` : '—' },
                { label: 'Conv. Globale', value: kpis.conversion_rate != null ? `${kpis.conversion_rate.toFixed(1)}%` : '—' },
                { label: 'Revenu', value: kpis.revenue != null ? `${kpis.revenue.toLocaleString('fr-FR')}€` : '—' },
              ];
              const renderKpi = (kpi, i, arr) => {
                const valStr = String(kpi.value);
                const fs = valStr.length > 8 ? 15 : valStr.length > 5 ? 17 : 20;
                return (
                <div key={kpi.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', padding: '0 36px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: fs, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>{kpi.value}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</span>
                </div>
                );
              };
              return <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>{left.map(renderKpi)}</div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginRight: 16 }}>{right.map(renderKpi)}</div>
              </>;
            })()}
          </div>

          {/* ── CONTENT ROW (board + detail panel side by side) ──────────────── */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0, marginLeft: 8 }}>

          {/* ── INNER BOARD WRAPPER ──────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          {/* ── MAIN CONTENT CARD ────────────────────────────────────────────── */}
          <div style={{ flex: 1, background: darkMode ? C.bg : '#f6f7f9', borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ── FOLDER TABS (top bar, classic site style) ────────────────────── */}
          {sidebarView === 'leads' && (
            <div style={{
              display: 'flex', gap: 6,
              padding: '10px 20px',
              borderBottom: `1px solid ${C.border}`,
              background: 'transparent',
              zIndex: 3,
              overflow: 'visible',
              flexWrap: 'wrap',
            }}>
              {CATEGORIES.map((cat, idx) => {
                const isActive = idx === activeTab;
                const count = tabCounts[cat.key];
                const badgeBounce = animatingBadges.has(idx);
                return (
                  <button
                    key={cat.key}
                    data-tab-key={cat.key}
                    onClick={() => handleTabChange(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: `1px solid ${isActive ? C.border : 'transparent'}`,
                      background: isActive ? (darkMode ? 'rgba(255,255,255,0.06)' : '#ffffff') : 'transparent',
                      color: isActive ? C.text : C.muted,
                      fontSize: '12.5px',
                      fontWeight: isActive ? 650 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      fontFamily: 'inherit',
                      letterSpacing: '-0.01em',
                      boxShadow: isActive ? (darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.04)') : 'none',
                      animation: glowingTab === idx ? 'tabReceive 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = C.text; }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; }
                    }}
                  >
                    <span>{cat.label}</span>
                    <span data-tab-badge="" style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px',
                      fontSize: '10.5px', fontWeight: 700,
                      background: `${cat.color}20`, color: cat.color,
                      animation: badgeBounce ? 'badgePop 0.3s ease both' : (glowingTab === idx ? 'badgeReceive 0.45s cubic-bezier(0.34,1.56,0.64,1) both' : 'none'),
                      fontFamily: 'inherit',
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── INNER BOARD ───────────────────────────────────────────────────── */}
          <div style={{
            background: 'transparent',
            display: 'flex',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}>

          {/* ── RIGHT MAIN CONTENT ──────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ADD LEAD view removed — now a modal (see end of component) */}


        {/* ════ VIEW: KPIs (mockup) ═══════════════════════════════════════════ */}
        {sidebarView === 'kpis' && (
          <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              KPIs & Statistiques
            </h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px' }}>
              Vos performances de prospection
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Leads total', value: leads.length, color: C.accent },
                { label: 'R1 placés', value: tabCounts.r1 || 0, color: '#3b82f6' },
                { label: 'R2 placés', value: tabCounts.r2 || 0, color: '#fb923c' },
                { label: 'Signés', value: tabCounts.signed || 0, color: '#10b981' },
                { label: 'Non traités', value: tabCounts.new || 0, color: '#6366f1' },
                { label: 'Non pertinents', value: tabCounts.not_relevant || 0, color: '#f87171' },
              ].map(kpi => (
                <div key={kpi.label} style={{
                  background: darkMode ? '#16171e' : '#fff', borderRadius: 12,
                  border: `1px solid ${C.border}`, padding: '18px 20px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color, letterSpacing: '-0.02em' }}>
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ VIEW: CAMPAIGNS ═══════════════════════════════════════════ */}
        {sidebarView === 'campaigns' && (() => {
          const MOCK_CAMPAIGNS = [
            {
              id: 1,
              niche: 'Ambulances internes',
              date: '04 mars 2026',
              image: campaignImg1,
              status: 'En cours',
              objectif: "Générer des leads qualifiés d'ambulanciers / structures d'ambulance avec besoin de structuration et optimisation.",
              angle: 'Audit + optimisation charges / conformité.',
              canaux: 'Cold email + SMS + retargeting.',
              message: '"Réduisez vos charges et sécurisez votre structure en 30 min."',
              cta: 'Prendre rendez-vous / Demander un audit.',
            },
            {
              id: 2,
              niche: 'BTP Interne',
              date: '12 février 2026',
              image: campaignImg2,
              status: 'En cours',
              objectif: "Cibler les entreprises BTP avec des besoins de structuration interne et d'optimisation des charges.",
              angle: 'Audit conformité + optimisation charges sociales BTP.',
              canaux: 'Cold email + LinkedIn Ads + call.',
              message: '"Structurez votre entreprise BTP et réduisez vos charges en 30 min."',
              cta: 'Demander un audit gratuit.',
            },
          ];
          return (
          <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              Campagnes marketing
            </h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px' }}>
              Vue sur les campagnes marketing en cours
            </p>

            {/* Campaign cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 18 }}>
              {MOCK_CAMPAIGNS.map((camp, i) => (
                <div
                  key={camp.id}
                  data-campaign-id={camp.id}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setCampaignRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
                    setOpenCampaign(camp);
                  }}
                  style={{
                    position: 'relative',
                    borderRadius: 18,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    aspectRatio: '3 / 4',
                    animation: `campaignCardIn 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.08}s both`,
                    boxShadow: darkMode
                      ? '0 3px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25)'
                      : '0 3px 16px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = darkMode ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.14)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = darkMode ? '0 3px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25)' : '0 3px 16px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05)'; }}
                >
                  {/* Background image */}
                  <img
                    src={camp.image}
                    alt=""
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover', objectPosition: 'center',
                      transform: 'scale(1.06)',
                    }}
                  />
                  {/* Dark overlay */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.4) 100%)' }} />

                  {/* Status pill */}
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    padding: '3px 10px', borderRadius: 20,
                    fontSize: 10, fontWeight: 700,
                    background: '#10b981', color: '#fff',
                    boxShadow: '0 2px 6px rgba(16,185,129,0.35)',
                  }}>
                    {camp.status}
                  </div>

                  {/* Glass banner */}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    padding: '14px 16px',
                    background: darkMode ? 'rgba(30,31,40,0.6)' : 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(20px) saturate(1.6)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                    borderTop: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.4)',
                  }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: darkMode ? '#eef0f6' : '#1e2330',
                      letterSpacing: '-0.01em', lineHeight: 1.25,
                    }}>
                      {camp.niche}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 500, color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                      marginTop: 3,
                    }}>
                      Lancée le {camp.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })()}

        {/* ════ CAMPAIGN FULLSCREEN DETAIL (Apple open animation) ══════════ */}
        {(openCampaign || campaignClosing) && (() => {
          const camp = openCampaign || {};
          return createPortal(
            <>
              {/* Backdrop dim */}
              <div
                onClick={() => {
                  setCampaignClosing(true);
                  setTimeout(() => { setOpenCampaign(null); setCampaignClosing(false); setCampaignRect(null); }, 380);
                }}
                style={{
                  position: 'fixed', inset: 0, zIndex: 99990,
                  background: 'rgba(0,0,0,0.5)',
                  opacity: campaignClosing ? 0 : 1,
                  transition: 'opacity 0.38s ease',
                }}
              />
              {/* Expanding card → fullscreen */}
              <div
                style={{
                  position: 'fixed', zIndex: 99991,
                  ...(campaignClosing && campaignRect ? {
                    left: campaignRect.left, top: campaignRect.top,
                    width: campaignRect.width, height: campaignRect.height,
                    borderRadius: 14,
                  } : {
                    left: '50%', top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(92vw, 860px)', height: 'min(88vh, 720px)',
                    borderRadius: 14,
                  }),
                  background: C.bg,
                  overflow: 'hidden',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.15)',
                  transition: campaignClosing
                    ? 'all 0.38s cubic-bezier(0.4, 0, 0.6, 1)'
                    : 'none',
                  animation: !campaignClosing ? 'campaignOpen 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
                  '--cr-left': campaignRect ? `${campaignRect.left}px` : '50%',
                  '--cr-top': campaignRect ? `${campaignRect.top}px` : '50%',
                  '--cr-width': campaignRect ? `${campaignRect.width}px` : '860px',
                  '--cr-height': campaignRect ? `${campaignRect.height}px` : '260px',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Hero image */}
                <div style={{ position: 'relative', height: 260, flexShrink: 0, overflow: 'hidden' }}>
                  <img
                    src={camp.image}
                    alt=""
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center',
                      transform: 'scale(1.05)',
                    }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.45) 100%)',
                  }} />
                  {/* Close button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCampaignClosing(true);
                      setTimeout(() => { setOpenCampaign(null); setCampaignClosing(false); setCampaignRect(null); }, 380);
                    }}
                    style={{
                      position: 'absolute', top: 16, right: 16,
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', fontSize: 18, fontWeight: 400,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.35)'; }}
                  >
                    ✕
                  </button>
                  {/* Glass title overlay */}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    padding: '20px 32px',
                    background: darkMode ? 'rgba(30,31,40,0.5)' : 'rgba(255,255,255,0.45)',
                    backdropFilter: 'blur(16px) saturate(1.4)', WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                    borderTop: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.4)',
                  }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: darkMode ? '#eef0f6' : '#1e2330', letterSpacing: '-0.02em' }}>
                      Campagne — {camp.niche}
                    </div>
                    <div style={{ fontSize: 12, color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', marginTop: 3 }}>
                      Campagne lancée le {camp.date}
                    </div>
                  </div>
                </div>

                {/* Detail content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 32px' }}>
                  {[
                    { label: 'Objectif', value: camp.objectif },
                    { label: 'Angle', value: camp.angle },
                    { label: 'Canaux', value: camp.canaux },
                    { label: 'Message', value: camp.message },
                    { label: 'CTA', value: camp.cta },
                    { label: 'Statut', value: camp.status },
                  ].map((row, idx) => (
                    <div key={row.label} style={{
                      marginBottom: 18,
                      opacity: 0, animation: `tabFadeIn 0.35s ease ${0.15 + idx * 0.05}s forwards`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                        {row.label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.text, lineHeight: 1.55 }}>
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>,
            document.body
          );
        })()}

        {/* ════ VIEW: CALENDAR ═════════════════════════════════════════════ */}
        {sidebarView === 'calendar' && (() => {
          // Build week days: Monday → Sunday of the selected week
          const calWeekOffset = calendarWeekOffset || 0;
          const now = new Date();
          const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const monday = new Date(now);
          monday.setDate(now.getDate() + mondayOffset + calWeekOffset * 7);
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return d;
          });
          const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
          const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

          // Collect R1 and R2 events
          const events = [];
          leads.forEach(l => {
            if (l.r1 && (l.status === 'r1' || l.status === 'r2' || l.status === 'signed')) {
              events.push({ lead: l, type: 'R1', datetime: l.r1, color: '#3b82f6', bgLight: 'rgba(59,130,246,0.08)', bgDark: 'rgba(59,130,246,0.15)' });
            }
            if (l.r2 && (l.status === 'r2' || l.status === 'signed')) {
              events.push({ lead: l, type: 'R2', datetime: l.r2, color: '#fb923c', bgLight: 'rgba(251,146,60,0.08)', bgDark: 'rgba(251,146,60,0.15)' });
            }
          });

          // Hours range: 8am - 20pm
          const HOUR_START = 8;
          const HOUR_END = 20;
          const HOUR_HEIGHT = 60; // px per hour
          const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

          // Position events in the grid
          const getEventsForDay = (dayDate) => {
            const dayStr = dayDate.toISOString().split('T')[0];
            return events.filter(ev => toDateOnly(ev.datetime) === dayStr).map(ev => {
              const t = ev.datetime.length > 10 ? ev.datetime.slice(11, 16) : '09:00';
              const [h, m] = t.split(':').map(Number);
              const startHour = h + m / 60;
              const duration = 1; // 1h per RDV
              return { ...ev, startHour, duration };
            });
          };

          const isToday = (d) => d.toISOString().split('T')[0] === TODAY;

          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'tabFadeIn 0.3s ease-out both' }}>
              {/* Header */}
              <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
                    Calendrier
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setCalendarWeekOffset(prev => (prev || 0) - 1)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: 'inherit' }}
                    >&lsaquo;</button>
                    <button onClick={() => setCalendarWeekOffset(0)}
                      style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: calWeekOffset === 0 ? C.accent : 'transparent', color: calWeekOffset === 0 ? '#fff' : C.text, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                    >Aujourd'hui</button>
                    <button onClick={() => setCalendarWeekOffset(prev => (prev || 0) + 1)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: 'inherit' }}
                    >&rsaquo;</button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginLeft: 8 }}>
                      {monthNames[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}
                    </span>
                  </div>
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}` }}>
                  <div />
                  {weekDays.map((d, i) => (
                    <div key={i} style={{
                      textAlign: 'center', padding: '8px 0 10px',
                      borderLeft: `1px solid ${C.border}`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase' }}>{dayLabels[i]}</div>
                      <div style={{
                        fontSize: 20, fontWeight: 700, lineHeight: 1.3,
                        color: isToday(d) ? '#fff' : C.text,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 34, height: 34, borderRadius: '50%',
                        background: isToday(d) ? C.accent : 'transparent',
                      }}>
                        {d.getDate()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time grid */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', position: 'relative' }}>
                  {hours.map(h => (
                    <React.Fragment key={h}>
                      {/* Hour label */}
                      <div style={{
                        height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                        paddingRight: 10, paddingTop: 0,
                        fontSize: 11, fontWeight: 500, color: C.muted,
                        borderTop: `1px solid ${C.border}`,
                      }}>
                        {h}h
                      </div>
                      {/* Day cells */}
                      {weekDays.map((d, di) => (
                        <div key={di} style={{
                          height: HOUR_HEIGHT, position: 'relative',
                          borderTop: `1px solid ${C.border}`,
                          borderLeft: `1px solid ${C.border}`,
                          background: isToday(d) ? (darkMode ? 'rgba(124,138,219,0.04)' : 'rgba(91,106,191,0.03)') : 'transparent',
                        }}>
                          {/* Render events that start in this hour */}
                          {getEventsForDay(d).filter(ev => Math.floor(ev.startHour) === h).map((ev, ei) => {
                            const topOffset = (ev.startHour - h) * HOUR_HEIGHT;
                            const height = ev.duration * HOUR_HEIGHT - 4;
                            return (
                              <div key={ei}
                                onClick={() => { setSidebarView('leads'); setTimeout(() => setSelectedLead(ev.lead.id), 100); }}
                                style={{
                                  position: 'absolute', top: topOffset + 2, left: 3, right: 3,
                                  height, borderRadius: 8, padding: '6px 8px',
                                  background: darkMode ? ev.bgDark : ev.bgLight,
                                  borderLeft: `3px solid ${ev.color}`,
                                  cursor: 'pointer', overflow: 'hidden',
                                  transition: 'transform 0.15s, box-shadow 0.15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = `0 2px 8px ${ev.color}25`; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700, color: ev.color, marginBottom: 2 }}>{ev.type}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {ev.lead.full_name}
                                </div>
                                <div style={{ fontSize: 10, color: C.muted }}>
                                  {ev.datetime.length > 10 ? ev.datetime.slice(11, 16).replace(':', 'h') : '09h00'} - {(() => {
                                    const t = ev.datetime.length > 10 ? ev.datetime.slice(11, 16) : '09:00';
                                    const [hh, mm] = t.split(':').map(Number);
                                    const end = hh + 1;
                                    return `${end}h${mm.toString().padStart(2, '0')}`;
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Current time indicator */}
                  {calWeekOffset === 0 && (() => {
                    const nowH = new Date().getHours();
                    const nowM = new Date().getMinutes();
                    if (nowH < HOUR_START || nowH >= HOUR_END) return null;
                    const topPx = (nowH - HOUR_START) * HOUR_HEIGHT + (nowM / 60) * HOUR_HEIGHT;
                    const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Mon
                    return (
                      <>
                        {/* Time badge */}
                        <div style={{
                          position: 'absolute', top: topPx - 10, left: 0, width: 56,
                          display: 'flex', justifyContent: 'flex-end', paddingRight: 6, zIndex: 5,
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#fff',
                            background: C.accent, borderRadius: 4, padding: '2px 5px',
                          }}>
                            {nowH}:{nowM.toString().padStart(2, '0')}
                          </span>
                        </div>
                        {/* Red line across today's column */}
                        <div style={{
                          position: 'absolute', top: topPx, left: `calc(56px + ${todayIdx} * ((100% - 56px) / 7))`,
                          width: `calc((100% - 56px) / 7)`, height: 2,
                          background: C.accent, zIndex: 4, borderRadius: 1,
                        }} />
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ════ VIEW: NOTIFICATIONS ═══════════════════════════════════════ */}
        {sidebarView === 'notifications' && (() => {
          const r1Today = leads.filter(l => l.status === 'r1' && toDateOnly(l.r1) === TODAY);
          const r2Today = leads.filter(l => l.status === 'r2' && toDateOnly(l.r2) === TODAY);
          const meetingNotifs = [
            ...r1Today.map(l => ({ id: l.id, key: `r1-${l.id}-${TODAY}`, type: 'meeting', notifType: 'r1', full_name: l.full_name, company: l.company, time: (l.r1 || '').slice(11, 16), color: '#3b82f6', lead: l })),
            ...r2Today.map(l => ({ id: l.id, key: `r2-${l.id}-${TODAY}`, type: 'meeting', notifType: 'r2', full_name: l.full_name, company: l.company, time: (l.r2 || '').slice(11, 16), color: '#fb923c', lead: l })),
          ];
          // Separate new (unread) vs history (read) for perf alerts
          const newMeetings = meetingNotifs.filter(n => !dismissedNotifs.includes(n.key));
          const newPerf = perfAlerts.filter(n => !dismissedNotifs.includes(n.key));
          const historyPerf = perfAlerts.filter(n => dismissedNotifs.includes(n.key));
          const hasNew = newMeetings.length > 0 || newPerf.length > 0;
          let idx = 0;

          // Render a perf alert card (used in both new and history)
          const renderPerfCard = (alert, i, isRead) => (
            <div key={alert.key} onClick={() => { if (!isRead) dismissNotif(alert.key); }} style={{
              padding: '14px 16px', borderRadius: 14, cursor: isRead ? 'default' : 'pointer',
              background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff',
              border: `1px solid ${C.border}`, borderLeft: `3px solid ${isRead ? C.muted : alert.color}`,
              opacity: isRead ? 0.6 : 1,
              transition: 'all 0.15s', animation: `cardStaggerIn 0.3s ease ${i * 50}ms both`,
            }}
              onMouseEnter={(e) => { if (!isRead) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = C.shadow; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{alert.icon === '✓' ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, color: isRead ? C.muted : C.text }}>{alert.title}</div>
                </div>
                {!isRead && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: alert.color, flexShrink: 0, boxShadow: `0 0 6px ${alert.color}50` }} />
                )}
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.5, paddingLeft: 26 }}>
                {alert.desc}
              </div>
              {!isRead && (
                <div style={{ fontSize: 10, color: C.accent, marginTop: 8, paddingLeft: 26, fontWeight: 600 }}>
                  Cliquer pour marquer comme lu
                </div>
              )}
            </div>
          );

          return (
            <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                Notifications
              </h2>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Rendez-vous du jour et alertes performance</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* ══ NOUVELLES ══ */}
                {hasNew && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, animation: 'notifPulse 2s ease-in-out infinite' }} />
                      Nouvelles
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Meetings today */}
                      {newMeetings.map(notif => {
                        const i = idx++;
                        return (
                          <div key={notif.key} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                            borderRadius: 14, background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff',
                            border: `1px solid ${C.border}`, cursor: 'pointer',
                            transition: 'all 0.15s', animation: `cardStaggerIn 0.3s ease ${i * 50}ms both`,
                          }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = C.shadow; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                            onClick={() => { dismissNotif(notif.key); setSidebarView('leads'); setActiveTab(CATEGORIES.findIndex(c => c.key === notif.notifType)); setSelectedLead(notif.lead); }}
                          >
                            <div style={{ width: 9, height: 9, borderRadius: '50%', background: notif.color, flexShrink: 0, boxShadow: `0 0 8px ${notif.color}60`, animation: 'notifPulse 2s ease-in-out infinite' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 650, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.full_name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{notif.company || 'Entreprise non renseignée'}</div>
                            </div>
                            <span style={{ padding: '3px 9px', borderRadius: 50, fontSize: 10.5, fontWeight: 650, background: `${notif.color}12`, color: notif.color, border: `1.5px solid ${notif.color}30`, flexShrink: 0 }}>
                              {notif.notifType === 'r1' ? 'R1' : 'R2'}
                            </span>
                            {notif.time && <span style={{ fontSize: 12, fontWeight: 600, color: notif.color, flexShrink: 0 }}>{notif.time}</span>}
                          </div>
                        );
                      })}

                      {/* New performance alerts */}
                      {newPerf.map(alert => renderPerfCard(alert, idx++, false))}
                    </div>
                  </div>
                )}

                {/* ══ EMPTY STATE ══ */}
                {!hasNew && historyPerf.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', borderRadius: 16, border: `1.5px dashed ${C.border}`, background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Aucune notification</p>
                  </div>
                )}

                {/* ══ HISTORIQUE ══ */}
                {historyPerf.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      Historique
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {historyPerf.map(alert => renderPerfCard(alert, idx++, true))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ════ VIEW: EMAIL (placeholder) ══════════════════════════════════ */}
        {sidebarView === 'email' && (
          <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              Relance
            </h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px' }}>
              Relancez vos prospects par email
            </p>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '60px 20px', borderRadius: 16, border: `1.5px dashed ${C.border}`,
              background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            }}>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Cette fonctionnalité sera bientôt disponible</p>
            </div>
          </div>
        )}

        {/* ════ VIEW: LEADS (content) ═══════════════════════════════════════ */}
        {sidebarView === 'leads' && (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ── FILTER SIDEBAR (pixel-match Freshsales) ────────────────────── */}
        {showFilters && (() => {
          const catKey = CATEGORIES[activeTab].key;
          const R1_TAGS = [
            { value: 'no_show', label: 'Lapin', color: '#f59e0b' },
            { value: 'rescheduled', label: 'Reporté', color: '#3b82f6' },
            { value: 'done', label: 'R1 effectué', color: '#10b981' },
            { value: 'cancelled', label: 'Annulé', color: '#ef4444' },
          ];
          const R2_TAGS = [
            { value: 'done', label: 'R2 effectué', color: '#10b981' },
            { value: 'comptable', label: 'Comptable', color: '#8b5cf6' },
            { value: 'associe', label: 'Associé', color: '#6366f1' },
            { value: 'reflexion', label: 'Réflexion', color: '#3b82f6' },
            { value: 'tresorerie', label: 'Trésorerie', color: '#f59e0b' },
            { value: 'reporte', label: 'Reporté', color: '#fb923c' },
            { value: 'pas_interesse', label: 'Pas intéressé', color: '#ef4444' },
            { value: 'annule', label: 'Annulé', color: '#ef4444' },
          ];
          const tagOptions = catKey === 'r1' ? R1_TAGS : catKey === 'r2' ? R2_TAGS : catKey === 'new' ? [] : [...R1_TAGS, ...R2_TAGS.filter(t => t.value !== 'done')];
          const statusOptions = catKey === 'new'
            ? [{ value: 'contacted', label: 'Contacté', color: '#10b981' }, { value: 'not_contacted', label: 'Pas contacté', color: '#94a3b8' }]
            : catKey === 'r1'
              ? [{ value: 'r1_done', label: 'R1 qualifié', color: '#3b82f6' }, { value: 'r1_not_done', label: 'R1 non qualifié', color: '#94a3b8' }]
              : catKey === 'r2'
                ? [{ value: 'r2_done', label: 'R2 qualifié', color: '#fb923c' }, { value: 'r2_not_done', label: 'R2 non qualifié', color: '#94a3b8' }]
                : [{ value: 'r1_done', label: 'R1 qualifié', color: '#3b82f6' }, { value: 'r1_not_done', label: 'R1 non qualifié', color: '#94a3b8' }, { value: 'r2_done', label: 'R2 qualifié', color: '#fb923c' }, { value: 'r2_not_done', label: 'R2 non qualifié', color: '#94a3b8' }];

          // Shared colors
          const greyBorder = darkMode ? '#3a3b46' : '#d4d4d8';
          const accentDot = darkMode ? '#818cf8' : '#6366f1';
          const optionsBg = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

          // Toggle a filter section open/closed (stable state, survives re-renders)
          const toggleSection = (key) => setOpenFilterSections(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
          });

          // Render a filter item row (icon + label + chevron)
          const renderFilterRow = (key, icon, label, hasChildren) => {
            const isOpen = openFilterSections.has(key);
            return (
              <div
                onClick={() => hasChildren ? toggleSection(key) : null}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px 9px 16px', cursor: hasChildren ? 'pointer' : 'default',
                }}
              >
                <span style={{ color: C.muted, flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: isOpen ? 600 : 500, color: C.text }}>{label}</span>
                {hasChildren && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(0)' : 'rotate(-90deg)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>
            );
          };

          // Render radio option
          const renderRadio = (selected, label, color, onClick) => (
            <div onClick={onClick} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0',
              cursor: 'pointer', fontSize: 13, color: C.text, fontFamily: 'inherit',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selected ? (color || accentDot) : greyBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s',
              }}>
                {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: color || accentDot }} />}
              </div>
              <span style={{ fontWeight: selected ? 500 : 400, color: selected ? C.text : C.secondary }}>{label}</span>
            </div>
          );

          // Options container (mini grey container with radius)
          const renderOptionsBox = (children) => (
            <div style={{
              margin: '0 10px 10px 16px', padding: '8px 12px 8px 26px',
              background: optionsBg, borderRadius: 10,
            }}>
              {children}
            </div>
          );

          return (
              <div style={{
                width: 220, flexShrink: 0, alignSelf: 'flex-start',
                background: darkMode ? C.bg : '#fafafb',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                marginTop: 10, marginLeft: 4,
                overflowY: 'auto', display: 'flex', flexDirection: 'column',
                scrollbarWidth: 'thin', scrollbarColor: `${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} transparent`,
                boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
              }}>

              {/* ── "Filtres" title ── */}
              <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Filtres</span>
              </div>

              {/* ═══ GROUP: PROPRIÉTÉS DU LEAD ═══ */}
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ padding: '14px 14px 8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Propriétés du lead</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>

                {/* Qualification */}
                {tagOptions.length > 0 && (
                  <>
                    {renderFilterRow('qualification', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>, 'Qualification', true)}
                    {openFilterSections.has('qualification') && renderOptionsBox(
                      tagOptions.map(opt => <div key={opt.value}>{renderRadio(filterTags.includes(opt.value), opt.label, opt.color, () => setFilterTags(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]))}</div>)
                    )}
                  </>
                )}

                {/* Statut */}
                {statusOptions.length > 0 && (
                  <>
                    {renderFilterRow('statut', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, 'Statut', true)}
                    {openFilterSections.has('statut') && renderOptionsBox(
                      statusOptions.map(opt => <div key={opt.value}>{renderRadio(filterStatuses.includes(opt.value), opt.label, opt.color, () => setFilterStatuses(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]))}</div>)
                    )}
                  </>
                )}

                {/* Origine */}
                {renderFilterRow('origine', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, 'Origine', true)}
                {openFilterSections.has('origine') && (() => {
                  const uniqueOrigins = [...new Set(leads.map(l => l.origin).filter(Boolean))].sort();
                  return renderOptionsBox(
                    uniqueOrigins.map(o => (
                      <div key={o}>{renderRadio(filterOrigins.includes(o), o, C.accent, () => setFilterOrigins(prev => prev.includes(o) ? prev.filter(v => v !== o) : [...prev, o]))}</div>
                    ))
                  );
                })()}
              </div>

              {/* ═══ GROUP: TRI & DATES ═══ */}
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ padding: '14px 14px 8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tri & dates</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>

                {/* Ordre */}
                {renderFilterRow('ordre', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>, 'Ordre', true)}
                {openFilterSections.has('ordre') && renderOptionsBox(
                  [{ value: 'newest', label: 'Plus récents' }, { value: 'oldest', label: 'Plus anciens' }].map(opt => <div key={opt.value}>{renderRadio(sortOrder === opt.value, opt.label, null, () => setSortOrder(opt.value))}</div>)
                )}

                {/* Date d'assignation */}
                {renderFilterRow('date_assign', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, "Date d'assignation", false)}

                {/* Dernière activité */}
                {renderFilterRow('last_activity', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, 'Dernière activité', false)}
              </div>

              {/* ═══ GROUP: AUTRES ═══ */}
              <div>
                <div style={{ padding: '14px 14px 8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Autres</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>

                {renderFilterRow('notes', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, 'Notes', false)}
              </div>

              <div style={{ flex: 1 }} />

              {/* Clear all — bottom */}
              {(filterTags.length > 0 || filterStatuses.length > 0 || filterOrigins.length > 0 || sortOrder !== 'newest') && (
                <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => { setFilterTags([]); setFilterStatuses([]); setFilterOrigins([]); setSortOrder('newest'); }} style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${C.accent}40`, background: `${C.accent}08`, color: C.accent,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${C.accent}18`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = `${C.accent}08`; }}
                  >Effacer tous les filtres</button>
                </div>
              )}
              </div>
          );
        })()}


        {/* ── LEFT: Lead list ──────────────────────────────────────────── */}
        <div className="leads-scroll" style={{
          flex: 1,
          minWidth: 0,
          padding: '24px 24px 32px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.12) transparent',
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
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {activeCat.description} — {tabCounts[activeCat.key]} lead{tabCounts[activeCat.key] !== 1 ? 's' : ''}
                <button
                  onClick={() => setShowAddLeadModal(true)}
                  title="Ajouter un lead"
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    border: `1px solid ${C.border}`, background: darkMode ? 'rgba(255,255,255,0.05)' : '#ffffff',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', flexShrink: 0, padding: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'; }}
                >
                  <div style={{
                    width: 32, height: 32,
                    backgroundColor: C.muted,
                    WebkitMaskImage: `url(${iconPlus})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
                    maskImage: `url(${iconPlus})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center',
                    transition: 'background-color 0.15s',
                  }} />
                </button>
              </p>
            </div>
          </div>

          {/* Search bar + filters */}
          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Search input row */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Hide/Show Filters toggle */}
              <button
                onClick={() => setShowFilters(prev => !prev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 10px', borderRadius: 8, flexShrink: 0,
                  border: `1px solid ${C.border}`, background: C.bg,
                  color: C.secondary, fontSize: 11.5, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.secondary; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                {showFilters ? 'Masquer filtres' : 'Afficher filtres'}
              </button>

              <div style={{ width: 200, flexShrink: 0, position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 30px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    color: C.text,
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = C.accent;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accent}15`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                    color: C.muted, fontSize: '13px', lineHeight: 1, fontFamily: 'inherit',
                  }}>×</button>
                )}
              </div>

              {/* Filter buttons */}
              {(() => {
                const catKey = CATEGORIES[activeTab].key;
                const R1_TAGS = [
                  { value: 'no_show', label: 'Lapin', color: '#f59e0b' },
                  { value: 'rescheduled', label: 'Reporté', color: '#3b82f6' },
                  { value: 'done', label: 'R1 effectué', color: '#10b981' },
                  { value: 'cancelled', label: 'Annulé', color: '#ef4444' },
                ];
                const R2_TAGS = [
                  { value: 'done', label: 'R2 effectué', color: '#10b981' },
                  { value: 'comptable', label: 'Comptable', color: '#8b5cf6' },
                  { value: 'associe', label: 'Associé', color: '#6366f1' },
                  { value: 'reflexion', label: 'Réflexion', color: '#3b82f6' },
                  { value: 'tresorerie', label: 'Trésorerie', color: '#f59e0b' },
                  { value: 'reporte', label: 'Reporté', color: '#fb923c' },
                  { value: 'pas_interesse', label: 'Pas intéressé', color: '#ef4444' },
                  { value: 'annule', label: 'Annulé', color: '#ef4444' },
                ];
                const tagOptions = catKey === 'r1' ? R1_TAGS : catKey === 'r2' ? R2_TAGS : catKey === 'new' ? [] : [...R1_TAGS, ...R2_TAGS.filter(t => t.value !== 'done')];
                const statusOptions = catKey === 'new'
                  ? [{ value: 'contacted', label: 'Contacté', color: '#10b981' }, { value: 'not_contacted', label: 'Pas contacté', color: '#94a3b8' }]
                  : catKey === 'r1'
                    ? [{ value: 'r1_done', label: 'R1 qualifié', color: '#3b82f6' }, { value: 'r1_not_done', label: 'R1 non qualifié', color: '#94a3b8' }]
                    : catKey === 'r2'
                      ? [{ value: 'r2_done', label: 'R2 qualifié', color: '#fb923c' }, { value: 'r2_not_done', label: 'R2 non qualifié', color: '#94a3b8' }]
                      : [{ value: 'r1_done', label: 'R1 qualifié', color: '#3b82f6' }, { value: 'r1_not_done', label: 'R1 non qualifié', color: '#94a3b8' }, { value: 'r2_done', label: 'R2 qualifié', color: '#fb923c' }, { value: 'r2_not_done', label: 'R2 non qualifié', color: '#94a3b8' }];
                const hasTagFilter = tagOptions.length > 0;
                const hasStatusFilter = statusOptions.length > 0;
                const toggleTag = (val) => setFilterTags(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
                const toggleStatus = (val) => setFilterStatuses(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

                return (
                  <>
                    {hasTagFilter && (
                      <button onClick={() => setOpenFilter(prev => prev === 'tag' ? '' : 'tag')} style={{
                        width: 34, height: 34, borderRadius: 10, border: `1px solid ${filterTags.length > 0 ? C.accent : C.border}`,
                        background: filterTags.length > 0 ? `${C.accent}12` : (darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                        color: filterTags.length > 0 ? C.accent : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', flexShrink: 0, position: 'relative',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                        onMouseLeave={(e) => { if (!filterTags.length) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; } }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        {filterTags.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: C.accent, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{filterTags.length}</span>}
                      </button>
                    )}
                    {hasStatusFilter && (
                      <button onClick={() => setOpenFilter(prev => prev === 'status' ? '' : 'status')} style={{
                        width: 34, height: 34, borderRadius: 10, border: `1px solid ${filterStatuses.length > 0 ? C.accent : C.border}`,
                        background: filterStatuses.length > 0 ? `${C.accent}12` : (darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                        color: filterStatuses.length > 0 ? C.accent : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', flexShrink: 0, position: 'relative',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                        onMouseLeave={(e) => { if (!filterStatuses.length) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; } }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        {filterStatuses.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: C.accent, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{filterStatuses.length}</span>}
                      </button>
                    )}
                    <button onClick={() => setOpenFilter(prev => prev === 'sort' ? '' : 'sort')} style={{
                      width: 34, height: 34, borderRadius: 10, border: `1px solid ${sortOrder === 'oldest' ? C.accent : C.border}`,
                      background: sortOrder === 'oldest' ? `${C.accent}12` : (darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                      color: sortOrder === 'oldest' ? C.accent : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s', flexShrink: 0,
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={(e) => { if (sortOrder !== 'oldest') { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; } }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><polyline points={sortOrder === 'newest' ? '19 12 12 19 5 12' : '5 12 12 5 19 12'} />
                      </svg>
                    </button>
                  </>
                );
              })()}
            </div>

            {/* ── Dropdown: Tag filter (multi-select, tab-contextual) ── */}
            {openFilter === 'tag' && (() => {
              const catKey = CATEGORIES[activeTab].key;
              const R1_TAGS = [
                { value: 'no_show', label: 'Lapin', color: '#f59e0b' },
                { value: 'rescheduled', label: 'Reporté', color: '#3b82f6' },
                { value: 'done', label: 'R1 effectué', color: '#10b981' },
                { value: 'cancelled', label: 'Annulé', color: '#ef4444' },
              ];
              const R2_TAGS = [
                { value: 'done', label: 'R2 effectué', color: '#10b981' },
                { value: 'comptable', label: 'Comptable', color: '#8b5cf6' },
                { value: 'associe', label: 'Associé', color: '#6366f1' },
                { value: 'reflexion', label: 'Réflexion', color: '#3b82f6' },
                { value: 'tresorerie', label: 'Trésorerie', color: '#f59e0b' },
                { value: 'reporte', label: 'Reporté', color: '#fb923c' },
                { value: 'pas_interesse', label: 'Pas intéressé', color: '#ef4444' },
                { value: 'annule', label: 'Annulé', color: '#ef4444' },
              ];
              const opts = catKey === 'r1' ? R1_TAGS : catKey === 'r2' ? R2_TAGS : [...R1_TAGS, ...R2_TAGS.filter(t => t.value !== 'done')];
              return (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px',
                  borderRadius: 12, border: `1px solid ${C.border}`, background: darkMode ? C.bg : '#fff',
                  animation: 'wfSplitIn 0.2s ease both', alignItems: 'center',
                }}>
                  {opts.map(opt => {
                    const sel = filterTags.includes(opt.value);
                    return (
                      <button key={opt.value} onClick={() => setFilterTags(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])} style={{
                        padding: '4px 10px', borderRadius: 50, border: `1.5px solid ${sel ? opt.color : 'transparent'}`,
                        background: sel ? `${opt.color}18` : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        color: sel ? opt.color : C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.12s',
                      }}>{opt.label}</button>
                    );
                  })}
                  {filterTags.length > 0 && (
                    <button onClick={() => setFilterTags([])} style={{
                      padding: '3px 8px', borderRadius: 50, border: 'none',
                      background: 'none', color: C.muted, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', textDecoration: 'underline',
                    }}>Effacer</button>
                  )}
                </div>
              );
            })()}

            {/* ── Dropdown: Status filter (multi-select, tab-contextual) ── */}
            {openFilter === 'status' && (() => {
              const catKey = CATEGORIES[activeTab].key;
              const opts = catKey === 'new'
                ? [{ value: 'contacted', label: 'Contacté', color: '#10b981' }, { value: 'not_contacted', label: 'Pas contacté', color: '#94a3b8' }]
                : catKey === 'r1'
                  ? [{ value: 'r1_done', label: 'R1 qualifié', color: '#3b82f6' }, { value: 'r1_not_done', label: 'R1 non qualifié', color: '#94a3b8' }]
                  : catKey === 'r2'
                    ? [{ value: 'r2_done', label: 'R2 qualifié', color: '#fb923c' }, { value: 'r2_not_done', label: 'R2 non qualifié', color: '#94a3b8' }]
                    : [{ value: 'r1_done', label: 'R1 qualifié', color: '#3b82f6' }, { value: 'r1_not_done', label: 'R1 non qualifié', color: '#94a3b8' }, { value: 'r2_done', label: 'R2 qualifié', color: '#fb923c' }, { value: 'r2_not_done', label: 'R2 non qualifié', color: '#94a3b8' }];
              return (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px',
                  borderRadius: 12, border: `1px solid ${C.border}`, background: darkMode ? C.bg : '#fff',
                  animation: 'wfSplitIn 0.2s ease both', alignItems: 'center',
                }}>
                  {opts.map(opt => {
                    const sel = filterStatuses.includes(opt.value);
                    return (
                      <button key={opt.value} onClick={() => setFilterStatuses(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])} style={{
                        padding: '4px 10px', borderRadius: 50, border: `1.5px solid ${sel ? opt.color : 'transparent'}`,
                        background: sel ? `${opt.color}18` : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        color: sel ? opt.color : C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.12s',
                      }}>{opt.label}</button>
                    );
                  })}
                  {filterStatuses.length > 0 && (
                    <button onClick={() => setFilterStatuses([])} style={{
                      padding: '3px 8px', borderRadius: 50, border: 'none',
                      background: 'none', color: C.muted, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', textDecoration: 'underline',
                    }}>Effacer</button>
                  )}
                </div>
              );
            })()}

            {/* ── Dropdown: Sort order ── */}
            {openFilter === 'sort' && (
              <div style={{
                display: 'flex', gap: 6, padding: '10px 12px',
                borderRadius: 12, border: `1px solid ${C.border}`, background: darkMode ? C.bg : '#fff',
                animation: 'wfSplitIn 0.2s ease both',
              }}>
                {[
                  { value: 'newest', label: 'Plus récents', icon: '↓' },
                  { value: 'oldest', label: 'Plus anciens', icon: '↑' },
                ].map(opt => {
                  const sel = sortOrder === opt.value;
                  return (
                    <button key={opt.value} onClick={() => { setSortOrder(opt.value); setOpenFilter(''); }} style={{
                      flex: 1, padding: '6px 12px', borderRadius: 50, border: `1.5px solid ${sel ? C.accent : 'transparent'}`,
                      background: sel ? `${C.accent}15` : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      color: sel ? C.accent : C.text, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                      <span style={{ fontSize: 13 }}>{opt.icon}</span>{opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active filters summary — removable chips */}
            {(filterTags.length > 0 || filterStatuses.length > 0) && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {filterTags.map(tag => {
                  const label = tag === 'no_show' ? 'Lapin' : tag === 'rescheduled' ? 'Reporté' : tag === 'done' ? 'Effectué' : tag === 'cancelled' ? 'Annulé' : tag === 'comptable' ? 'Comptable' : tag === 'associe' ? 'Associé' : tag === 'reflexion' ? 'Réflexion' : tag === 'tresorerie' ? 'Trésorerie' : tag === 'reporte' ? 'Reporté R2' : tag === 'pas_interesse' ? 'Pas intéressé' : tag === 'annule' ? 'Annulé R2' : tag;
                  return (
                    <span key={`tag-${tag}`} onClick={() => setFilterTags(prev => prev.filter(v => v !== tag))} style={{
                      padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      background: `${C.accent}12`, color: C.accent, border: `1px solid ${C.accent}30`,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      {label} ×
                    </span>
                  );
                })}
                {filterStatuses.map(s => {
                  const label = s === 'r1_done' ? 'R1 qualifié' : s === 'r1_not_done' ? 'R1 non qualifié' : s === 'r2_done' ? 'R2 qualifié' : s === 'r2_not_done' ? 'R2 non qualifié' : s === 'contacted' ? 'Contacté' : s === 'not_contacted' ? 'Pas contacté' : s;
                  return (
                    <span key={`st-${s}`} onClick={() => setFilterStatuses(prev => prev.filter(v => v !== s))} style={{
                      padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      background: `${C.accent}12`, color: C.accent, border: `1px solid ${C.accent}30`,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      {label} ×
                    </span>
                  );
                })}
                {(filterTags.length + filterStatuses.length > 1) && (
                  <span onClick={() => { setFilterTags([]); setFilterStatuses([]); }} style={{
                    padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    color: C.muted, textDecoration: 'underline',
                  }}>
                    Tout effacer
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Lead cards — with grouped containers for R1/R2 tabs */}
          {(() => {
            const isR1Tab = activeCat.key === 'r1';
            const isR2Tab = activeCat.key === 'r2';
            const isGroupedTab = isR1Tab || isR2Tab;

            // R1 groups
            const r1Scheduled  = isR1Tab ? filteredLeads.filter(l => !l.r1_result || l.r1_result === 'rescheduled') : [];
            const r1Pending    = isR1Tab ? filteredLeads.filter(l => l.r1_result === 'no_show') : [];
            const r1Cancelled  = isR1Tab ? filteredLeads.filter(l => l.r1_result === 'cancelled') : [];
            const r1Completed  = isR1Tab ? filteredLeads.filter(l => l.r1_result === 'done') : [];

            // R2 groups
            const R2_PENDING_STATES = ['comptable', 'associe', 'reflexion', 'relire_contrat', 'pas_decision_jour', 'tresorerie'];
            const r2Scheduled  = isR2Tab ? filteredLeads.filter(l => !l.r2_result || l.r2_result === 'reporte') : [];
            const r2Pending    = isR2Tab ? filteredLeads.filter(l => R2_PENDING_STATES.includes(l.r2_result)) : [];
            const r2Cancelled  = isR2Tab ? filteredLeads.filter(l => l.r2_result === 'pas_interesse' || l.r2_result === 'annule') : [];
            const r2Completed  = isR2Tab ? filteredLeads.filter(l => l.r2_result === 'done') : [];

            // Unified groups array for the active tab
            const groups = isR1Tab ? [
              { key: 'scheduled', leads: r1Scheduled, label: 'Planifiés', color: '#3b82f6' },
              { key: 'pending',   leads: r1Pending,   label: 'En attente', color: '#f59e0b' },
              { key: 'completed', leads: r1Completed, label: 'Effectués',  color: '#10b981' },
              { key: 'cancelled', leads: r1Cancelled, label: 'Annulés',     color: '#ef4444' },
            ] : isR2Tab ? [
              { key: 'scheduled', leads: r2Scheduled, label: 'Planifiés', color: '#fb923c' },
              { key: 'pending',   leads: r2Pending,   label: 'En attente', color: '#f59e0b' },
              { key: 'completed', leads: r2Completed, label: 'Effectués',  color: '#10b981' },
              { key: 'cancelled', leads: r2Cancelled, label: 'Annulés',     color: '#ef4444' },
            ] : [];

            // Renders a single lead card (reused for both groups)
            const renderLeadCard = (lead, index) => {
              const isExiting = exitingCards.has(lead.id);
              const isSelected = selectedLead === lead.id;
              const origin = ORIGIN_COLORS[lead.origin] || DEFAULT_ORIGIN;
              // Check if a remote user is focusing this lead
              const remoteFocuser = Object.values(remoteLeadFocus).find(f => f.lead_id === String(lead.id));
              const isRemoteFocused = !!remoteFocuser;
              const focusColor = remoteFocuser?.color || '#6366f1';
              return (
                  <div
                    key={lead.id}
                    id={`lead-card-${lead.id}`}
                    style={{
                      position: 'relative',
                      borderRadius: '14px',
                      border: `1px solid ${highlightedLeadId === String(lead.id) ? '#f59e0b' : isRemoteFocused ? focusColor : isSelected ? (C.accent + '50') : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
                      background: highlightedLeadId === String(lead.id)
                        ? (darkMode ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)')
                        : isRemoteFocused
                        ? `${focusColor}15`
                        : isSelected
                        ? (darkMode ? `${C.accent}12` : `${C.accent}08`)
                        : (darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'),
                      boxShadow: highlightedLeadId === String(lead.id)
                        ? '0 0 0 2px rgba(245,158,11,0.3), 0 4px 12px rgba(245,158,11,0.15)'
                        : isRemoteFocused
                        ? `0 0 0 2px ${focusColor}40, 0 4px 12px ${focusColor}20`
                        : undefined,
                      transition: 'all 0.3s ease',
                      animation: signingCard === lead.id
                        ? 'signedGlow 0.8s ease both'
                        : isExiting
                          ? 'cardSlideOut 0.35s cubic-bezier(0.22,1,0.36,1) both'
                          : `cardStaggerIn 0.5s cubic-bezier(0.34,1.56,0.64,1) ${index * 40}ms both`,
                      cursor: 'pointer',
                      overflow: isExiting ? 'hidden' : 'visible',
                    }}
                    onMouseEnter={(e) => {
                      if (!isExiting && !isSelected) {
                        e.currentTarget.style.borderColor = darkMode ? 'rgba(124,138,219,0.3)' : 'rgba(91,106,191,0.25)';
                        e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
                        e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)';
                      }
                    }}
                    onClick={() => {
                      if (!isExiting) {
                        const newVal = isSelected ? null : lead.id;
                        setSelectedLead(newVal);
                        // Broadcast lead focus to other WS users
                        if (wsRef.current && wsRef.current.readyState === 1) {
                          wsRef.current.send(JSON.stringify({ type: 'lead_focus', lead_id: newVal ? String(newVal) : null }));
                        }
                      }
                    }}
                  >

                    {/* ═══ NOTE STICKER ═══ */}
                    {lead.notes && lead.notes.trim() && (
                      <img
                        src={mynoteIcon}
                        alt="Note"
                        style={{
                          position: 'absolute',
                          top: -7,
                          left: -14,
                          width: 50,
                          height: 50,
                          objectFit: 'contain',
                          pointerEvents: 'auto',
                          zIndex: 2,
                          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.12))',
                          transition: 'transform 0.2s ease',
                          cursor: 'default',
                          ...(noteJustSaved === lead.id ? { animation: 'noteStickIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both' } : {}),
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                      />
                    )}

                    {/* ═══ PILL VIEW ═══ */}
                    <div
                      id={`lead-pill-${lead.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '11px 18px',
                      }}
                    >
                      {/* Category color dot */}
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: activeCat.color,
                        flexShrink: 0,
                      }} />

                      {/* Name */}
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isSelected ? C.accent : C.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                        maxWidth: '160px',
                        letterSpacing: '-0.01em',
                        transition: 'color 0.2s ease',
                      }}>
                        {lead.full_name}
                      </span>

                      {/* Origin badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '2px 8px', borderRadius: '50px',
                        fontSize: '10px', fontWeight: 600,
                        background: origin.bg, color: origin.text,
                        flexShrink: 0,
                      }}>
                        {lead.origin}
                      </span>

                      {/* Compact info pills */}
                      <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
                      <span
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(lead.phone, `phone-card-${lead.id}`); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', color: copiedField === `phone-card-${lead.id}` ? '#10b981' : C.secondary, fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500, flexShrink: 0, cursor: lead.phone ? 'pointer' : 'default', borderRadius: 6, padding: '1px 5px', margin: '-1px -5px', transition: 'color 0.2s, background 0.15s' }}
                        onMouseEnter={(e) => { if (lead.phone) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        title={lead.phone ? 'Copier le numéro' : ''}
                      >
                        {copiedField === `phone-card-${lead.id}` ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.45 }}>
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        )}
                        {copiedField === `phone-card-${lead.id}` ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', fontFamily: 'inherit', animation: 'copiedToastIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>Copié</span>
                        ) : lead.phone}
                      </span>
                      {lead.headcount && (
                        <>
                          <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', color: C.muted, flexShrink: 0 }}>
                            <span style={{ fontWeight: 600, color: C.text }}>{lead.headcount}</span> sal.
                          </span>
                        </>
                      )}
                      {lead.company_name && (
                        <>
                          <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', color: C.secondary, fontWeight: 500, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lead.company_name}
                          </span>
                        </>
                      )}
                      {lead.sector && (
                        <>
                          <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', fontWeight: 600, color: C.accent, flexShrink: 0 }}>
                            {lead.sector}
                          </span>
                        </>
                      )}

                      {/* Google Meet link */}
                      {(lead.r1_meet_link || lead.r2_meet_link) && (
                        <>
                          <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
                          <a
                            href={lead.r2_meet_link || lead.r1_meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Rejoindre le Google Meet"
                            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, borderRadius: 6, padding: '2px 4px', transition: 'background 0.15s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <img src={meetIcon} alt="Meet" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                          </a>
                        </>
                      )}

                      {/* Spacer */}
                      <div style={{ flex: 1 }} />

                      {/* R1 qualification badge */}
                      {activeCat.key === 'r1' && lead.r1_result && (() => {
                        const R1_BADGES = {
                          no_show:     { icon: 'rabbit', label: 'Lapin',   color: '#f59e0b' },
                          rescheduled: { icon: '↻',  label: 'Reporté',     color: '#3b82f6' },
                          done:        { icon: '✓',  label: 'R1 effectué', color: '#10b981' },
                          cancelled:   { icon: '✕',  label: 'Annulé',      color: '#ef4444' },
                        };
                        const badge = R1_BADGES[lead.r1_result];
                        if (!badge) return null;
                        return (
                          <span title={badge.label} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 0,
                            padding: '3px 10px', borderRadius: 50, fontSize: 11.5, fontWeight: 650, flexShrink: 0,
                            background: `${badge.color}${darkMode ? '22' : '12'}`, color: badge.color,
                            border: `2px solid ${badge.color}40`,
                          }}>
                            {badge.icon === 'rabbit' ? (
                              <span style={{ width: 20, height: 20, display: 'inline-block', flexShrink: 0, position: 'relative', top: 0.5, backgroundColor: badge.color, WebkitMaskImage: `url(${rabbitIcon})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: `url(${rabbitIcon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                            ) : (
                              <span style={{ fontSize: 13, lineHeight: 1 }}>{badge.icon}</span>
                            )}
                            {badge.label}
                          </span>
                        );
                      })()}

                      {/* R2 qualification badge */}
                      {activeCat.key === 'r2' && lead.r2_result && (() => {
                        const R2_BADGES = {
                          done:            { icon: '✓',  label: 'R2 effectué',  color: '#10b981' },
                          comptable:       { icon: '🧮', label: 'Comptable',     color: '#8b5cf6' },
                          associe:         { icon: '🤝', label: 'Associé',       color: '#6366f1' },
                          reflexion:       { icon: '💭', label: 'Réflexion',     color: '#3b82f6' },
                          relire_contrat:  { icon: '📄', label: 'Relire contrat', color: '#0ea5e9' },
                          pas_decision_jour: { icon: '⏸', label: 'Pas de décision', color: '#94a3b8' },
                          tresorerie:      { icon: '💰', label: 'Trésorerie',    color: '#f59e0b' },
                          reporte:         { icon: '↻',  label: 'Reporté',       color: '#fb923c' },
                          pas_interesse:   { icon: '✕',  label: 'Pas intéressé', color: '#ef4444' },
                          annule:          { icon: '🚫', label: 'Annulé',        color: '#ef4444' },
                        };
                        const badge = R2_BADGES[lead.r2_result];
                        if (!badge) return null;
                        return (
                          <span title={badge.label} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 50, fontSize: 11.5, fontWeight: 650, flexShrink: 0,
                            background: `${badge.color}${darkMode ? '22' : '12'}`, color: badge.color,
                            border: `2px solid ${badge.color}40`,
                          }}>
                            <span style={{ fontSize: 13, lineHeight: 1 }}>{badge.icon}</span>
                            {badge.label}
                          </span>
                        );
                      })()}

                      {/* Right side indicators */}
                      {lead.notes && (
                        <span style={{ fontSize: '11px', color: C.muted, flexShrink: 0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: '-1px' }}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </span>
                      )}
                      {(lead.r1 || lead.r2) && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600,
                          padding: '2px 8px', borderRadius: '4px',
                          background: lead.r2 ? (darkMode ? 'rgba(251,146,60,0.12)' : 'rgba(251,146,60,0.08)') : (darkMode ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)'),
                          color: lead.r2 ? '#fb923c' : '#3b82f6',
                          flexShrink: 0,
                        }}>
                          {lead.r2 ? 'R2' : 'R1'} {formatDate(lead.r2 || lead.r1)}
                        </span>
                      )}
                      <span style={{
                        fontSize: '10px', color: C.muted, flexShrink: 0, whiteSpace: 'nowrap',
                      }}>
                        {formatDate(lead.assigned_at)}
                      </span>

                      {/* Selection chevron */}
                      <span style={{
                        fontSize: '12px', color: isSelected ? C.accent : C.muted, flexShrink: 0,
                        transition: 'color 0.2s ease',
                        display: 'flex', alignItems: 'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    </div>

                    {/* Signing animation overlay */}
                    {signingCard === lead.id && (
                      <div style={{
                        position: 'absolute', bottom: 8, right: 12, zIndex: 10,
                        pointerEvents: 'none', animation: 'signatureFade 1.1s ease-in both',
                      }}>
                        <svg width="60" height="24" viewBox="0 0 90 36" fill="none">
                          <path d="M5 28 C 12 8, 18 32, 26 16 S 34 4, 42 20 Q 50 34, 58 14 C 64 6, 70 26, 80 10"
                            stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" fill="none"
                            strokeDasharray="200" strokeDashoffset="0"
                            style={{ animation: 'signatureStroke 0.8s ease-out both' }} />
                        </svg>
                      </div>
                    )}


                  </div>
                );
              };

            return (
              <div key={`cards-${tabKey}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredLeads.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', animation: 'emptyFade 0.4s ease both' }}>
                    <p style={{ color: C.muted, fontSize: '14px', margin: 0 }}>
                      {searchQuery.trim() ? 'Aucun résultat pour cette recherche' : 'Aucun lead dans cette catégorie'}
                    </p>
                  </div>
                ) : isGroupedTab ? (
                  (() => {
                    let runningIdx = 0;
                    return (
                      <>
                        {groups.map(grp => {
                          const startIdx = runningIdx;
                          runningIdx += grp.leads.length;
                          if (grp.leads.length === 0) return null;
                          return (
                            <div key={grp.key} style={{
                              border: `1.5px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#dfe1e6'}`,
                              borderRadius: 14,
                              background: darkMode ? 'rgba(255,255,255,0.04)' : '#fafafb',
                              padding: '14px 10px 10px',
                              marginBottom: 8,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 6px' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center',
                                  padding: grp.key === 'completed' ? '4px 4px 4px 14px' : '4px 14px', borderRadius: 50,
                                  border: `1.5px solid ${grp.color}35`,
                                  background: `${grp.color}10`,
                                  fontSize: 12.5, fontWeight: 600, color: grp.color,
                                }}>{grp.label}{grp.key === 'completed' && <span style={{ width: 28, height: 28, overflow: 'hidden', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: -1 }}><img src={completedIcon} alt="" style={{ width: 84, height: 84 }} /></span>}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{grp.leads.length}</span>
                                <div style={{ flex: 1 }} />
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45 }}>
                                  <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                                <span style={{ fontSize: 15, color: C.muted, lineHeight: 1, fontWeight: 300 }}>+</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {grp.leads.map((lead, i) => renderLeadCard(lead, startIdx + i))}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()
                ) : (
                  filteredLeads.map((lead, i) => renderLeadCard(lead, i))
                )}
              </div>
            );
          })()}
        </div>{/* end left column */}

        {/* ── RIGHT: Lead Detail Panel (portaled to separate card) ──────── */}
        {detailContainerRef.current && (() => {
          const lead = selectedLead ? leads.find(l => l.id === selectedLead) : null;
          if (!lead) return null;
          const origin = ORIGIN_COLORS[lead.origin] || DEFAULT_ORIGIN;
          const notesVal = editingNotes[lead.id] !== undefined ? editingNotes[lead.id] : lead.notes;
          const selectStyle = {
            padding: '7px 28px 7px 12px', borderRadius: '10px', border: `1px solid ${C.border}`,
            background: darkMode ? '#16171e' : '#fff', color: C.text, fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            appearance: 'none', WebkitAppearance: 'none', fontFamily: 'inherit', outline: 'none', width: '100%',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
          };
          return createPortal(
          <div
            key={`detail-${lead.id}`}
            style={{
              width: 380,
              overflowY: 'auto',
              overflowX: 'hidden',
              animation: 'detailSlideIn 0.4s cubic-bezier(0.4,0,0.2,1) both',
              background: darkMode ? C.bg : '#fafafb',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              boxShadow: C.shadow,
              height: '100%',
            }}
          >
            <div style={{ padding: '10px 20px 20px' }}>

              {/* Close button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <button
                  onClick={() => {
                    setSelectedLead(null); setActiveWorkflow(null);
                    if (wsRef.current && wsRef.current.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'lead_focus', lead_id: null }));
                  }}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', border: 'none',
                    background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: C.muted, fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'; e.currentTarget.style.color = C.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = C.muted; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* ─── PROFILE HEADER ─── */}
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
                {/* Name (editable) */}
                {editingField?.leadId === lead.id && editingField?.field === 'full_name' ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                    <input ref={editInputRef} value={editingField.value} onChange={(e) => setEditingField(prev => ({ ...prev, value: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveFieldEdit(); if (e.key === 'Escape') cancelFieldEdit(); }}
                      style={{ flex: 1, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.02em', border: `1px solid ${C.accent}`, borderRadius: 8, padding: '3px 8px', background: C.bg, fontFamily: 'inherit', outline: 'none' }}
                    />
                    <button onClick={saveFieldEdit} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                    <button onClick={cancelFieldEdit} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
                      {lead.full_name}
                    </h3>
                    <button onClick={() => startFieldEdit(lead.id, 'full_name', lead.full_name)} title="Modifier le nom"
                      style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, transition: 'opacity 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.4; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                )}
                {/* Origin badge + company_name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 600,
                    background: origin.bg, color: origin.text,
                  }}>
                    {lead.origin}
                  </span>
                  {/* Company name (editable inline) */}
                  {editingField?.leadId === lead.id && editingField?.field === 'company_name' ? (
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <input ref={editInputRef} value={editingField.value} onChange={(e) => setEditingField(prev => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveFieldEdit(); if (e.key === 'Escape') cancelFieldEdit(); }}
                        placeholder="Nom de la société"
                        style={{ width: 160, fontSize: 12, color: C.text, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '2px 7px', background: C.bg, fontFamily: 'inherit', outline: 'none', fontWeight: 500 }}
                      />
                      <button onClick={saveFieldEdit} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: C.accent, color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                      <button onClick={cancelFieldEdit} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => startFieldEdit(lead.id, 'company_name', lead.company_name)}
                      title={lead.company_name ? 'Modifier la société' : 'Ajouter le nom de la société'}
                      style={{
                        fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                        color: lead.company_name ? C.secondary : C.muted,
                        fontStyle: lead.company_name ? 'normal' : 'italic',
                        borderRadius: 6, padding: '1px 5px', margin: '-1px -5px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {lead.company_name || '+ Société'}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </span>
                  )}
                </div>
              </div>

              {/* ─── STATS ROW ─── */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1,
                borderRadius: 10, overflow: 'hidden', marginBottom: 14,
                background: C.border,
                animation: 'contentReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.08s both',
              }}>
                {[
                  { label: 'Salariés', value: lead.headcount || '—' },
                  { label: 'CA', value: lead.revenue || '—' },
                  { label: 'Assigné', value: formatDate(lead.assigned_at) || '—' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    padding: '10px 6px', textAlign: 'center',
                    background: darkMode ? '#16171e' : '#fafbfd',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>{stat.value}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* ─── INFO DETAILS ─── */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14,
                animation: 'contentReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.12s both',
              }}>
                {/* Phone */}
                {editingField?.leadId === lead.id && editingField?.field === 'phone' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </div>
                    <input ref={editInputRef} value={editingField.value} onChange={(e) => setEditingField(prev => ({ ...prev, value: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveFieldEdit(); if (e.key === 'Escape') cancelFieldEdit(); }}
                      style={{ flex: 1, fontSize: 12, color: C.text, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '5px 8px', background: C.bg, fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500, outline: 'none' }}
                    />
                    <button onClick={saveFieldEdit} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: C.accent, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                    <button onClick={cancelFieldEdit} style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ) : (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '4px 6px', margin: '-4px -6px', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div onClick={() => copyToClipboard(lead.phone, `phone-detail-${lead.id}`)} style={{ flex: 1, minWidth: 0, cursor: lead.phone ? 'pointer' : 'default' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Téléphone</div>
                    <div style={{ fontSize: 12, color: C.text, fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500 }}>{lead.phone || '—'}</div>
                  </div>
                  {copiedField === `phone-detail-${lead.id}` ? (
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#10b981', padding: '2px 10px', borderRadius: 50, background: darkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', animation: 'copiedToastIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>Copié</span>
                  ) : (
                    <>
                      {lead.phone && (
                        <svg onClick={() => copyToClipboard(lead.phone, `phone-detail-${lead.id}`)} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5, cursor: 'pointer' }} title="Copier">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                      <svg onClick={(e) => { e.stopPropagation(); startFieldEdit(lead.id, 'phone', lead.phone); }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.35, cursor: 'pointer', transition: 'opacity 0.15s' }} title="Modifier"
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.8; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.35; }}
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </>
                  )}
                </div>
                )}
                {/* Email */}
                {editingField?.leadId === lead.id && editingField?.field === 'email' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <input ref={editInputRef} value={editingField.value} onChange={(e) => setEditingField(prev => ({ ...prev, value: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveFieldEdit(); if (e.key === 'Escape') cancelFieldEdit(); }}
                      style={{ flex: 1, fontSize: 12, color: C.text, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '5px 8px', background: C.bg, fontFamily: 'inherit', outline: 'none' }}
                    />
                    <button onClick={saveFieldEdit} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: C.accent, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                    <button onClick={cancelFieldEdit} style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ) : (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '4px 6px', margin: '-4px -6px', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <div onClick={() => copyToClipboard(lead.email, `email-detail-${lead.id}`)} style={{ flex: 1, minWidth: 0, cursor: lead.email ? 'pointer' : 'default' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</div>
                    <div style={{ fontSize: 12, color: C.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email || '—'}</div>
                  </div>
                  {copiedField === `email-detail-${lead.id}` ? (
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#10b981', padding: '2px 10px', borderRadius: 50, background: darkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', animation: 'copiedToastIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>Copié</span>
                  ) : (
                    <>
                      {lead.email && (
                        <svg onClick={() => copyToClipboard(lead.email, `email-detail-${lead.id}`)} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5, cursor: 'pointer' }} title="Copier">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                      <svg onClick={(e) => { e.stopPropagation(); startFieldEdit(lead.id, 'email', lead.email); }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.35, cursor: 'pointer', transition: 'opacity 0.15s' }} title="Modifier"
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.8; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.35; }}
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </>
                  )}
                </div>
                )}
                {/* Sector */}
                {lead.sector && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Secteur</div>
                      <div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{lead.sector}</div>
                    </div>
                  </div>
                )}
                {/* Google Meet */}
                {(lead.r1_meet_link || lead.r2_meet_link) && (
                  <a
                    href={lead.r2_meet_link || lead.r1_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                      borderRadius: 8, padding: '4px 6px', margin: '-4px -6px', transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <img src={meetIcon} alt="Meet" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Google Meet</div>
                      <div style={{ fontSize: 12, color: '#1a73e8', fontWeight: 600 }}>Rejoindre le meeting</div>
                    </div>
                  </a>
                )}
              </div>

              {/* ─── CALENDAR ERROR ─── */}
              {calendarError?.leadId === lead.id && (
                <div style={{
                  padding: '8px 14px', borderRadius: 10, marginBottom: 10,
                  background: darkMode ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${darkMode ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)'}`,
                  display: 'flex', alignItems: 'center', gap: 8,
                  animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                }}>
                  <span style={{ fontSize: 14 }}>⚠</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#ef4444' }}>{calendarError.message}</span>
                </div>
              )}

              {/* ─── CONTACTED INDICATOR (NEW tab) ─── */}
              {activeCat.key === 'new' && (
                <div style={{ marginBottom: 10, animation: 'contentReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.14s both' }}>
                  {lead.first_contact_date ? (
                    <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>
                      Contacté le {formatDate(lead.first_contact_date)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
                      Pas encore contacté
                    </span>
                  )}
                </div>
              )}

              {/* ─── DATE CHIPS ─── */}
              {(lead.r1 || lead.r2) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', animation: 'contentReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.16s both' }}>
                  {lead.r1 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8,
                      background: darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)',
                      border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)'}`,
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>R1</span>
                      <input type="datetime-local" value={toDatetimeLocal(lead.r1)} onChange={(e) => handleDateChange(lead.id, 'r1', e.target.value)}
                        style={{ border: 'none', background: 'transparent', color: C.text, fontSize: 11, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', padding: 0, outline: 'none', width: 145 }}
                      />
                    </div>
                  )}
                  {lead.r2 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8,
                      background: darkMode ? 'rgba(251,146,60,0.1)' : 'rgba(251,146,60,0.06)',
                      border: `1px solid ${darkMode ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.12)'}`,
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#fb923c', textTransform: 'uppercase' }}>R2</span>
                      <input type="datetime-local" value={toDatetimeLocal(lead.r2)} onChange={(e) => handleDateChange(lead.id, 'r2', e.target.value)}
                        style={{ border: 'none', background: 'transparent', color: C.text, fontSize: 11, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', padding: 0, outline: 'none', width: 145 }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ─── NOTES ─── */}
              {lead.notes && !editingNotes.hasOwnProperty(lead.id) && (
                <div style={{
                  marginBottom: 10, padding: '8px 12px', borderRadius: 8,
                  background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}`,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note</span>
                  <p style={{ fontSize: 13, color: C.secondary, margin: '4px 0 0', lineHeight: 1.5, fontStyle: 'italic' }}>{lead.notes}</p>
                </div>
              )}
              {editingNotes.hasOwnProperty(lead.id) && (
                <div style={{ marginBottom: 10 }}>
                  <textarea
                    value={notesVal}
                    onChange={(e) => setEditingNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                    placeholder="Ajouter un commentaire..."
                    style={{
                      width: '100%', minHeight: 60, padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${C.border}`, background: darkMode ? '#252636' : '#f8f9fc',
                      color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                      outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.target.style.borderColor = C.accent}
                    onBlur={(e) => e.target.style.borderColor = C.border}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setEditingNotes(prev => { const n = { ...prev }; delete n[lead.id]; return n; })}
                      style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.secondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                    >Annuler</button>
                    <button
                      onClick={() => handleNotesSave(lead.id)}
                      style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >Sauvegarder</button>
                  </div>
                </div>
              )}

              {/* ─── SEPARATOR ─── */}
              <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', margin: '2px 0 12px' }} />

              {/* ─── DOCS RECEIVED + QUALIFIER R2 (same row, R2 only) ─── */}
              {activeCat.key === 'r2' && (() => {
                const wfLocal = activeWorkflow?.leadId === lead.id ? activeWorkflow : null;
                const r2Options = [
                  { value: 'done',             label: 'R2 effectué',      icon: '✓' },
                  { value: 'comptable',        label: 'Parler comptable', icon: '🧮' },
                  { value: 'associe',          label: 'Parler associé',   icon: '🤝' },
                  { value: 'reflexion',        label: 'Doit réfléchir',   icon: '💭' },
                  { value: 'relire_contrat',   label: 'Relire contrat',   icon: '📄' },
                  { value: 'pas_decision_jour',label: 'Pas de décision',  icon: '⏸' },
                  { value: 'tresorerie',       label: 'Pb trésorerie',    icon: '💰' },
                  { value: 'reporte',          label: 'R2 reporté',       icon: '↻' },
                  { value: 'pas_interesse',    label: 'Pas intéressé',    icon: '✕' },
                  { value: 'annule',           label: 'R2 annulé',        icon: '🚫' },
                ];
                const handleR2Select = (val) => {
                  if (!val) return;
                  if (val === 'done') return handleWorkflowSubmit(lead.id, { r2_result: 'done', r2_completed_at: new Date().toISOString() });
                  if (val === 'reporte') return setActiveWorkflow({ leadId: lead.id, r2Result: 'reporte', newDate: '' });
                  if (val === 'pas_interesse') return handleWorkflowSubmit(lead.id, { r2_result: 'pas_interesse' });
                  if (val === 'annule') return handleWorkflowSubmit(lead.id, { r2_result: 'annule' });
                  handleWorkflowSubmit(lead.id, { r2_result: val });
                };
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      {/* Docs received toggle */}
                      <button
                        onClick={() => handleDocsReceivedToggle(lead.id, !!lead.docs_received)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: '7px 14px', borderRadius: 10,
                          border: `1px solid ${lead.docs_received ? '#10b981' : C.border}`,
                          background: lead.docs_received
                            ? (darkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)')
                            : (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)'),
                          color: lead.docs_received ? '#10b981' : C.muted,
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.25,0.1,0.25,1)', fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => {
                          if (!lead.docs_received) {
                            e.currentTarget.style.borderColor = darkMode ? 'rgba(16,185,129,0.4)' : 'rgba(16,185,129,0.3)';
                            e.currentTarget.style.color = '#10b981';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!lead.docs_received) {
                            e.currentTarget.style.borderColor = C.border;
                            e.currentTarget.style.color = C.muted;
                          }
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1.5px solid ${lead.docs_received ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)')}`,
                          background: lead.docs_received ? '#10b981' : 'transparent',
                          transition: 'all 0.2s cubic-bezier(0.25,0.1,0.25,1)',
                        }}>
                          {lead.docs_received && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </span>
                        Documents reçus
                      </button>

                      {/* Qualifier R2 dropdown (inline) */}
                      {!(wfLocal?.r2Result === 'reporte') && (
                        <select
                          value=""
                          onChange={(e) => handleR2Select(e.target.value)}
                          style={{
                            flex: 1, minWidth: 180, padding: '8px 32px 8px 12px', borderRadius: 10,
                            border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                            fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                            outline: 'none', appearance: 'none', WebkitAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(C.muted)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                          }}
                          onFocus={(e) => { e.target.style.borderColor = '#fb923c'; e.target.style.boxShadow = '0 0 0 3px rgba(251,146,60,0.12)'; }}
                          onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
                        >
                          <option value="" disabled>Qualifier le R2...</option>
                          {r2Options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.icon}  {opt.label}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Reschedule date picker (when R2 reporté selected) */}
                    {wfLocal?.r2Result === 'reporte' && (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12,
                        padding: '16px 18px', borderRadius: 16,
                        background: darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)',
                        border: `1px solid ${darkMode ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.12)'}`,
                        animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>↻</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#fb923c' }}>Reporter le R2</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date" value={wfLocal.newDate ? wfLocal.newDate.slice(0, 10) : ''}
                              onChange={(e) => { const time = wfLocal.newDate?.slice(10) || 'T09:00'; setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time })); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                            <input type="time" value={wfLocal.newDate?.slice(11, 16) || '09:00'}
                              onChange={(e) => { const date = wfLocal.newDate?.slice(0, 10) || new Date().toISOString().slice(0, 10); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + e.target.value })); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                            />
                          </div>
                        </div>
                        {wfLocal.newDate && wfLocal.newDate.length >= 10 && (
                          <button onClick={() => handleWorkflowSubmit(lead.id, { r2_result: 'reporte', r2_date: wfLocal.newDate })}
                            style={{ padding: '10px 20px', borderRadius: 50, border: 'none', background: '#fb923c', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both', transition: 'transform 0.15s, box-shadow 0.15s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(251,146,60,0.35)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >Confirmer nouvelle date</button>
                        )}
                        <button onClick={() => setActiveWorkflow(null)}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    )}

                    {/* Employee range (only after qualification) */}
                    {lead.r2_result && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                          Tranche salariale
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {EMPLOYEE_RANGES.map(range => {
                            const isSel = lead.employee_range === range;
                            return (
                              <button key={range}
                                onClick={() => handleEmployeeRangeChange(lead.id, range)}
                                style={{
                                  padding: '3px 8px', borderRadius: 6,
                                  border: `1px solid ${isSel ? '#fb923c' : C.border}`,
                                  background: isSel ? (darkMode ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.1)') : 'transparent',
                                  color: isSel ? '#fb923c' : C.secondary,
                                  fontSize: '10px', fontWeight: isSel ? 650 : 500,
                                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                                }}
                              >{range}</button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Company count (only after qualification) */}
                    {lead.r2_result && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                          Nbr de sociétés
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={lead.company_count || ''}
                          placeholder="Ex: 3"
                          onChange={async (e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, company_count: val } : l));
                          }}
                          onBlur={async (e) => {
                            const val = e.target.value.trim();
                            if (val !== (lead._prevCompanyCount || '')) {
                              try { await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { company_count: val || null }); } catch {}
                            }
                          }}
                          onFocus={() => { lead._prevCompanyCount = lead.company_count || ''; }}
                          style={{
                            width: 80, padding: '5px 10px', borderRadius: 6,
                            border: `1px solid ${lead.company_count ? '#fb923c' : C.border}`,
                            background: lead.company_count ? (darkMode ? 'rgba(251,146,60,0.1)' : 'rgba(251,146,60,0.05)') : 'transparent',
                            color: C.text, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                            outline: 'none', transition: 'all 0.15s',
                          }}
                        />
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ═══ NEW TAB WORKFLOW ═══ */}
              {activeCat.key === 'new' && (() => {
                const wf = activeWorkflow?.leadId === lead.id ? activeWorkflow : null;
                const today = new Date().toISOString().split('T')[0];
                const wfPill = (label, color, icon, delay, onClick) => (
                  <button key={label} onClick={onClick} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 50,
                    border: 'none', background: darkMode ? `${color}22` : `${color}12`, color,
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    animation: `wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) ${delay}ms both`,
                    transition: 'background 0.15s, transform 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? `${color}35` : `${color}20`; e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? `${color}22` : `${color}12`; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
                    {label}
                  </button>
                );
                return (
                  <div style={{ marginBottom: 16 }}>
                    {!wf ? (
                      <button
                        onClick={() => setActiveWorkflow({ leadId: lead.id, contactResult: '', appointmentResult: '', newDate: '' })}
                        style={{
                          width: '100%', padding: '10px 16px', borderRadius: 50, border: 'none',
                          background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = `0 4px 16px ${C.accent}40`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        Premier contact
                      </button>
                    ) : !wf.contactResult ? (
                      /* ── Step 1: Contact result pills ── */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2, animation: 'wfSplitIn 0.3s ease both' }}>
                          Résultat du contact
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {wfPill('A décroché', '#10b981', '✓', 30, () => setActiveWorkflow(prev => ({ ...prev, contactResult: 'reached', appointmentResult: '', newDate: '' })))}
                          {wfPill('Répondeur', '#64748b', '📞', 70, () => handleWorkflowSubmit(lead.id, { first_contact_date: today, contact_result: 'voicemail', status: 'voicemail' }))}
                          {wfPill('Non pertinent', '#ef4444', '✕', 110, () => handleWorkflowSubmit(lead.id, { first_contact_date: today, contact_result: 'not_relevant', status: 'not_relevant' }))}
                          {wfPill('Non traitable', '#f59e0b', '⚠', 150, () => handleWorkflowSubmit(lead.id, { first_contact_date: today, contact_result: 'not_processable', status: 'not_relevant' }))}
                        </div>
                        <button onClick={() => setActiveWorkflow(null)}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', marginTop: 2, opacity: 0.7, animation: 'wfSplitIn 0.3s ease 200ms both' }}
                        >Annuler</button>
                      </div>
                    ) : wf.contactResult === 'reached' && !wf.appointmentResult ? (
                      /* ── Step 2: Follow-up pills ── */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, animation: 'wfSplitIn 0.3s ease both' }}>
                          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓ A décroché</span>
                          <span style={{ fontSize: 10, color: C.muted }}>→</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Suite ?</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {wfPill('RDV fixé', '#3b82f6', '📅', 30, () => setActiveWorkflow(prev => ({ ...prev, appointmentResult: 'appointment_set', newDate: '' })))}
                          {wfPill('Pas de RDV', '#94a3b8', '↩', 70, () => handleWorkflowSubmit(lead.id, { first_contact_date: today, contact_result: 'reached', appointment_result: 'no_appointment', status: 'callback' }))}
                          {wfPill('Pas intéressé', '#ef4444', '✕', 110, () => handleWorkflowSubmit(lead.id, { first_contact_date: today, contact_result: 'reached', appointment_result: 'not_interested', status: 'not_relevant' }))}
                        </div>
                        <button onClick={() => setActiveWorkflow(prev => ({ ...prev, contactResult: '', appointmentResult: '' }))}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', marginTop: 2, opacity: 0.7, animation: 'wfSplitIn 0.3s ease 150ms both' }}
                        >← Retour</button>
                      </div>
                    ) : wf.contactResult === 'reached' && wf.appointmentResult === 'appointment_set' ? (
                      /* ── Step 3: Date picker for R1 ── */
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '16px 18px', borderRadius: 16,
                        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
                        border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)'}`,
                        animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>📅</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>Planifier le R1</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date"
                              value={wf.newDate ? wf.newDate.slice(0, 10) : ''}
                              onChange={(e) => {
                                const time = wf.newDate?.slice(10) || 'T09:00';
                                setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time }));
                              }}
                              style={{
                                width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500,
                                border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                                fontFamily: 'inherit', outline: 'none',
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                            <input type="time"
                              value={wf.newDate?.slice(11, 16) || '09:00'}
                              onChange={(e) => {
                                const date = wf.newDate?.slice(0, 10) || new Date().toISOString().slice(0, 10);
                                setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + e.target.value }));
                              }}
                              style={{
                                width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500,
                                border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                                fontFamily: 'inherit', outline: 'none',
                              }}
                            />
                          </div>
                        </div>
                        {wf.newDate && wf.newDate.length >= 10 && (
                          <button
                            onClick={() => handleWorkflowSubmit(lead.id, {
                              first_contact_date: today,
                              contact_result: 'reached', appointment_result: 'appointment_set',
                              r1_date: wf.newDate, status: 'r1',
                            })}
                            style={{
                              padding: '10px 20px', borderRadius: 50, border: 'none',
                              background: '#3b82f6', color: '#fff', fontSize: 12.5, fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit',
                              animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                              transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.35)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >Confirmer → R1</button>
                        )}
                        <button onClick={() => setActiveWorkflow(prev => ({ ...prev, appointmentResult: '', newDate: '' }))}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {/* ═══ R1 TAB WORKFLOW ═══ */}
              {activeCat.key === 'r1' && (() => {
                const wfR2 = activeWorkflow?.leadId === lead.id && activeWorkflow?.r1Result === 'r2_set_standalone' ? activeWorkflow : null;
                const wf = activeWorkflow?.leadId === lead.id && !wfR2 ? activeWorkflow : null;
                const wfPill = (label, color, icon, delay, onClick, isImg) => (
                  <button key={label} onClick={onClick} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 50,
                    border: 'none', background: darkMode ? `${color}22` : `${color}12`, color,
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    animation: `wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) ${delay}ms both`,
                    transition: 'background 0.15s, transform 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? `${color}35` : `${color}20`; e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? `${color}22` : `${color}12`; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {isImg ? (
                      <span style={{ width: 18, height: 18, display: 'inline-block', flexShrink: 0, position: 'relative', top: 1, backgroundColor: color, WebkitMaskImage: `url(${icon})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: `url(${icon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                    ) : (
                      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
                    )}
                    {label}
                  </button>
                );
                return (
                  <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {!wf ? (
                      <>
                        <button
                          onClick={() => setActiveWorkflow({ leadId: lead.id, r1Result: '', r1FollowUp: '', newDate: '' })}
                          style={{
                            width: '100%', padding: '10px 16px', borderRadius: 50,
                            border: `1px solid ${C.border}`, background: 'transparent',
                            color: C.text, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; e.currentTarget.style.transform = 'scale(1)'; }}
                        >Qualifier le R1</button>
                        {/* ── R2 placé: separate standalone button (only after R1 qualified) ── */}
                        {!lead.r1_result ? null : !wfR2 ? (
                          <button
                            onClick={() => setActiveWorkflow({ leadId: lead.id, r1Result: 'r2_set_standalone', newDate: '' })}
                            style={{
                              width: '100%', padding: '10px 16px', borderRadius: 50,
                              border: `1px solid ${darkMode ? 'rgba(251,146,60,0.3)' : 'rgba(251,146,60,0.25)'}`,
                              background: darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)',
                              color: '#fb923c', fontSize: 13, fontWeight: 600,
                              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: 'inherit',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(251,146,60,0.15)' : 'rgba(251,146,60,0.08)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)'; e.currentTarget.style.transform = 'scale(1)'; }}
                          ><span style={{ fontSize: 15, lineHeight: 1 }}>📅</span> R2 placé</button>
                        ) : (
                          /* ── R2 date picker (standalone) ── */
                          <div style={{
                            display: 'flex', flexDirection: 'column', gap: 10,
                            padding: '16px 18px', borderRadius: 16,
                            background: darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)',
                            border: `1px solid ${darkMode ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.12)'}`,
                            animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 15 }}>📅</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#fb923c' }}>Planifier le R2</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                                <input type="date" value={wfR2.newDate ? wfR2.newDate.slice(0, 10) : ''}
                                  onChange={(e) => { const time = wfR2.newDate?.slice(10) || 'T09:00'; setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time })); }}
                                  style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                                <input type="time" value={wfR2.newDate?.slice(11, 16) || '09:00'}
                                  onChange={(e) => { const date = wfR2.newDate?.slice(0, 10) || new Date().toISOString().slice(0, 10); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + e.target.value })); }}
                                  style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                                />
                              </div>
                            </div>
                            {wfR2.newDate && wfR2.newDate.length >= 10 && (
                              <button onClick={() => handleWorkflowSubmit(lead.id, { r1_result: 'done', r1_completed_at: new Date().toISOString(), r1_follow_up: 'r2_set', r2_date: wfR2.newDate, status: 'r2' })}
                                style={{ padding: '10px 20px', borderRadius: 50, border: 'none', background: '#fb923c', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both', transition: 'transform 0.15s, box-shadow 0.15s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(251,146,60,0.35)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                              >Confirmer → R2</button>
                            )}
                            <button onClick={() => setActiveWorkflow(null)}
                              style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                            >← Retour</button>
                          </div>
                        )}
                      </>
                    ) : !wf.r1Result ? (
                      /* ── Step 1: R1 qualification pills ── */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2, animation: 'wfSplitIn 0.3s ease both' }}>
                          Qualifier le R1
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {wfPill('Lapin', '#f59e0b', rabbitIcon, 30, () => handleWorkflowSubmit(lead.id, { r1_result: 'no_show' }), true)}
                          {wfPill('Reporter', '#3b82f6', '↻', 70, () => setActiveWorkflow(prev => ({ ...prev, r1Result: 'rescheduled', newDate: '' })))}
                          {wfPill('R1 effectué', '#10b981', '✓', 110, () => handleWorkflowSubmit(lead.id, { r1_result: 'done', r1_completed_at: new Date().toISOString() }))}
                          {wfPill('Annulé', '#ef4444', '✕', 150, () => handleWorkflowSubmit(lead.id, { r1_result: 'cancelled' }))}
                        </div>
                        <button onClick={() => setActiveWorkflow(null)}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', marginTop: 2, opacity: 0.7, animation: 'wfSplitIn 0.3s ease 190ms both' }}
                        >Fermer</button>
                      </div>
                    ) : wf.r1Result === 'rescheduled' ? (
                      /* ── Reschedule: date picker ── */
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '16px 18px', borderRadius: 16,
                        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
                        border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)'}`,
                        animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>↻</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>Reporter le R1</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date" value={wf.newDate ? wf.newDate.slice(0, 10) : ''}
                              onChange={(e) => { const time = wf.newDate?.slice(10) || 'T09:00'; setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time })); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                            <input type="time" value={wf.newDate?.slice(11, 16) || '09:00'}
                              onChange={(e) => { const date = wf.newDate?.slice(0, 10) || new Date().toISOString().slice(0, 10); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + e.target.value })); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                            />
                          </div>
                        </div>
                        {wf.newDate && wf.newDate.length >= 10 && (
                          <button onClick={() => handleWorkflowSubmit(lead.id, { r1_result: 'rescheduled', r1_date: wf.newDate })}
                            style={{ padding: '10px 20px', borderRadius: 50, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both', transition: 'transform 0.15s, box-shadow 0.15s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.35)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >Confirmer nouvelle date</button>
                        )}
                        <button onClick={() => setActiveWorkflow(prev => ({ ...prev, r1Result: '', newDate: '' }))}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    ) : null}
                  </div>
                );
              })()}


              {/* ═══ OTHER TABS: Déplacer vers ═══ */}
              {!['new', 'r1', 'r2'].includes(activeCat.key) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>Déplacer vers</span>
                  <select value=""
                    onChange={(e) => { if (e.target.value) handleStatusChange(lead.id, e.target.value); }}
                    style={selectStyle}
                  >
                    <option value="" disabled>Choisir...</option>
                    {CATEGORIES.filter(cat => cat.key !== activeCat.key).map(cat => (
                      <option key={cat.key} value={cat.key}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ═══ CONTRACT (R2 only) ═══ */}
              {activeCat.key === 'r2' && (() => {
                const hasRange = !!lead.employee_range;
                const hasCompanyCount = !!lead.company_count;
                const isSending = sendingContract === lead.id;
                const isResending = resendingContract === lead.id;
                const contracts = leadContracts[lead.id] || [];
                const latestContract = contracts[0] || null;
                const status = latestContract?.yousign_status;
                const isCanceling = cancelingContract === latestContract?.id;
                const STATUS_COLORS = { ongoing: '#3b82f6', done: '#10b981', expired: '#fb923c', canceled: '#94a3b8', failed: '#ef4444', draft: '#d1d5db' };
                const STATUS_LABELS = { ongoing: 'En attente de signature', done: 'Signé', expired: 'Expiré', canceled: 'Annulé', failed: 'Erreur', draft: 'Brouillon' };
                const badgeColor = STATUS_COLORS[status] || C.muted;
                const badgeLabel = STATUS_LABELS[status] || status;
                const daysLeft = latestContract?.expiry_date ? Math.ceil((new Date(latestContract.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const actionBtnStyle = (color) => ({
                  padding: '5px 12px', borderRadius: 8, border: `1px solid ${color}`,
                  background: 'transparent', color, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                });
                return (
                  <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {latestContract && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
                          borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: `${badgeColor}20`, color: badgeColor,
                        }}>{badgeLabel}</span>
                        {status === 'ongoing' && daysLeft !== null && <span style={{ fontSize: 11, color: C.muted }}>Expire dans {daysLeft} jour{daysLeft !== 1 ? 's' : ''}</span>}
                        {status === 'done' && latestContract.signed_at && <span style={{ fontSize: 11, color: C.muted }}>Signé le {formatDate(latestContract.signed_at)}</span>}
                        {status === 'expired' && latestContract.expired_at && <span style={{ fontSize: 11, color: C.muted }}>Expiré le {formatDate(latestContract.expired_at)}</span>}
                        {status === 'canceled' && latestContract.canceled_at && <span style={{ fontSize: 11, color: C.muted }}>Annulé le {formatDate(latestContract.canceled_at)}</span>}
                        {status === 'failed' && latestContract.yousign_error && <span style={{ fontSize: 11, color: '#ef4444' }}>{latestContract.yousign_error}</span>}
                      </div>
                    )}
                    {/* View contract PDFs */}
                    {latestContract && (status === 'ongoing' || status === 'done') && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['owner', 'optilex'].map(docType => (
                          <button key={docType} onClick={async () => {
                            try {
                              const token = apiClient.getToken();
                              const resp = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.ownertechnology.com'}/api/v1/contracts/${latestContract.id}/download/${docType}`, {
                                headers: { 'Authorization': `Bearer ${token}` },
                              });
                              if (!resp.ok) throw new Error('Download failed');
                              const blob = await resp.blob();
                              window.open(URL.createObjectURL(blob), '_blank');
                            } catch (e) { alert('Erreur lors du téléchargement du contrat'); console.error(e); }
                          }} style={{
                            padding: '4px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                            background: 'transparent', color: C.accent, fontSize: 10.5, fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = `${C.accent}10`; e.currentTarget.style.borderColor = C.accent; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border; }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            {docType === 'owner' ? 'Convention Owner' : "Convention Opti'Lex"}
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {status === 'ongoing' && (
                        <button onClick={() => !isCanceling && handleCancelContract(latestContract.id, lead.id)} disabled={isCanceling}
                          style={actionBtnStyle('#ef4444')}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                        >{isCanceling ? 'Annulation...' : 'Annuler'}</button>
                      )}
                      {(status === 'expired' || status === 'canceled' || status === 'failed') && (
                        <button onClick={() => !isResending && handleResendContract(latestContract.id, lead.id)} disabled={isResending}
                          style={actionBtnStyle('#fb923c')}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#fb923c'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#fb923c'; }}
                        >{isResending ? 'Renvoi...' : (status === 'failed' ? 'Réessayer' : 'Renvoyer')}</button>
                      )}
                      {(!latestContract || status === 'canceled' || status === 'expired' || status === 'failed') && (
                        <>
                          <button onClick={() => openNdaPopup(lead)}
                            style={actionBtnStyle('#6366f1')}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6366f1'; }}
                          >Générer NDA</button>
                          <button
                            onClick={() => hasRange && !isSending ? handleSendContract(lead) : null}
                            disabled={!hasRange || isSending}
                            title={!hasRange ? "Sélectionnez une tranche salariale d'abord" : ''}
                            style={{
                              padding: '5px 12px', borderRadius: 8, border: 'none',
                              background: hasRange && hasCompanyCount && !isSending ? '#10b981' : (darkMode ? '#2a2b36' : '#e2e6ef'),
                              color: hasRange && hasCompanyCount && !isSending ? '#fff' : C.muted,
                              fontSize: 11, fontWeight: 600,
                              cursor: hasRange && hasCompanyCount && !isSending ? 'pointer' : 'not-allowed',
                              transition: 'all 0.15s', fontFamily: 'inherit',
                              opacity: hasRange && hasCompanyCount && !isSending ? 1 : 0.6,
                            }}
                          >{isSending ? 'Envoi...' : 'Envoyer le contrat'}</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ SIGNED TAB: Onboarding + Lancement + Déclarer vente ═══ */}
              {activeCat.key === 'signed' && (() => {
                const hasOnboarding = !!lead.rdv_onboarding_date;
                const hasLancement = !!lead.rdv_lancement_date;
                const canDeclare = hasOnboarding && hasLancement;
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Post-signature</div>

                    {/* RDV Onboarding */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, flex: 1, padding: '8px 12px', borderRadius: 10,
                        background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
                        border: `1px solid ${darkMode ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Onboarding</span>
                        <input type="datetime-local" value={lead.rdv_onboarding_date ? toDatetimeLocal(lead.rdv_onboarding_date) : ''}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, rdv_onboarding_date: val } : l));
                            try { await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { rdv_onboarding_date: val || null }); }
                            catch { setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, rdv_onboarding_date: lead.rdv_onboarding_date } : l)); }
                          }}
                          style={{ border: 'none', background: 'transparent', color: C.text, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', padding: 0, outline: 'none', flex: 1, minWidth: 0 }}
                        />
                      </div>
                    </div>

                    {/* RDV Lancement */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, flex: 1, padding: '8px 12px', borderRadius: 10,
                        background: darkMode ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
                        border: `1px solid ${darkMode ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`,
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Lancement</span>
                        <input type="datetime-local" value={lead.rdv_lancement_date ? toDatetimeLocal(lead.rdv_lancement_date) : ''}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, rdv_lancement_date: val } : l));
                            try { await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { rdv_lancement_date: val || null }); }
                            catch { setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, rdv_lancement_date: lead.rdv_lancement_date } : l)); }
                          }}
                          style={{ border: 'none', background: 'transparent', color: C.text, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', padding: 0, outline: 'none', flex: 1, minWidth: 0 }}
                        />
                      </div>
                    </div>

                    {/* Déclarer une vente button */}
                    <button
                      onClick={() => {
                        if (!canDeclare) return;
                        setSaleForm({ email: lead.email || '', paymentModality: 'M', employeeRange: lead.employee_range || '' });
                        setShowSaleModal(lead.id);
                      }}
                      disabled={!canDeclare}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 10, border: 'none', cursor: canDeclare ? 'pointer' : 'default',
                        background: canDeclare ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.06)' : '#e5e7eb'),
                        color: canDeclare ? '#fff' : C.muted,
                        fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                        transition: 'all 0.2s ease', opacity: canDeclare ? 1 : 0.6,
                      }}
                      onMouseEnter={(e) => { if (canDeclare) e.currentTarget.style.background = '#059669'; }}
                      onMouseLeave={(e) => { if (canDeclare) e.currentTarget.style.background = '#10b981'; }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      Déclarer une vente
                    </button>
                    {!canDeclare && (
                      <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>
                        Remplissez les dates Onboarding et Lancement pour déclarer
                      </div>
                    )}

                    <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', margin: '14px 0 12px' }} />
                  </div>
                );
              })()}

              {/* ═══ ACTION BUTTONS ═══ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!editingNotes.hasOwnProperty(lead.id) && (
                  <button
                    onClick={() => setEditingNotes(prev => ({ ...prev, [lead.id]: lead.notes || '' }))}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border}`,
                      background: 'transparent', color: C.secondary,
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.borderColor = C.accent; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Commenter
                  </button>
                )}
                <button
                  onClick={() => openNdaPopup(lead)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 14px', borderRadius: 10, border: `1px solid ${darkMode ? 'rgba(99,102,241,0.25)' : 'rgba(91,106,191,0.2)'}`,
                    background: 'transparent', color: '#6366f1',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6366f1'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  Générer NDA
                </button>
              </div>

            </div>{/* end detail padding */}
          </div>,
          detailContainerRef.current
          );
        })()}

        </div>
        )}

          </div>{/* end right main */}
        </div>{/* end inner board */}
          </div>{/* end main content card */}
          </div>{/* end inner board wrapper */}

          {/* ── DETAIL PANEL AREA (portal only) ──────────────────────────────── */}
          <div style={{
            width: selectedLead ? 396 : 0,
            flexShrink: 0,
            overflow: 'hidden',
            transition: 'width 0.45s cubic-bezier(0.4,0,0.2,1), margin-left 0.45s cubic-bezier(0.4,0,0.2,1)',
            marginLeft: selectedLead ? 12 : 0,
            position: 'sticky',
            top: 8,
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 120px)',
          }}>
            {/* Portal target */}
            <div
              ref={detailContainerRef}
              style={{
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}
            />
          </div>

          </div>{/* end content row */}
        </div>{/* end right column */}

        </div>{/* end flex row */}
      </div>{/* end outer wrapper */}

      {/* ════ MODAL: ADD LEAD ═══════════════════════════════════════════════ */}
      {showAddLeadModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'modalOverlayIn 0.2s ease both',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddLeadModal(false); }}
        >
          <div style={{
            width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto',
            background: C.bg, borderRadius: 16, border: `1px solid ${C.border}`,
            boxShadow: darkMode ? '0 8px 40px rgba(0,0,0,0.5)' : '0 8px 40px rgba(0,0,0,0.12)',
            padding: '28px 28px 24px',
            animation: 'modalCardIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Ajouter un lead</h2>
                <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>Créez un nouveau lead pour le cold call</p>
              </div>
              <button onClick={() => setShowAddLeadModal(false)} style={{
                width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`,
                background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, lineHeight: 1, fontFamily: 'inherit', transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
              >×</button>
            </div>

            {/* Form fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'full_name', label: 'Nom complet *', placeholder: 'Jean Dupont', type: 'text' },
                { key: 'phone', label: 'Téléphone *', placeholder: '06 12 34 56 78', type: 'tel' },
                { key: 'email', label: 'Email', placeholder: 'jean@example.com', type: 'email' },
                { key: 'sector', label: "Secteur d'activité", placeholder: 'Sélectionner...', type: 'select', options: ["Ambulance","Micro crèche","Dentiste","Pharmacie","Salle de sport","Esthétique","Tech","Hôtellerie","Grande Distribution","Tertiaire","BTP","Boulangerie","Immobilier","Restauration","Générales"] },
                { key: 'company_type', label: "Type d'entreprise", placeholder: 'Sélectionner...', type: 'select', options: ["SARL","SAS","SASU","SA","EURL","SCI","SNC","EI"] },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: C.secondary, marginBottom: 5, display: 'block' }}>
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={formData[field.key]}
                      onChange={(e) => handleFormChange(field.key, e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 10,
                        fontSize: 13, fontWeight: 500,
                        border: `1px solid ${C.border}`,
                        background: darkMode ? '#16171e' : '#fff', color: formData[field.key] ? C.text : C.muted,
                        outline: 'none', fontFamily: 'inherit',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxSizing: 'border-box', cursor: 'pointer',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: 36,
                      }}
                      onFocus={(e) => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                      onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
                    >
                      <option value="" disabled>{field.placeholder}</option>
                      {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.key]}
                      onChange={(e) => handleFormChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 10,
                        fontSize: 13, fontWeight: 500,
                        border: `1px solid ${C.border}`,
                        background: darkMode ? '#16171e' : '#fff', color: C.text,
                        outline: 'none', fontFamily: 'inherit',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                      onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
                    />
                  )}
                </div>
              ))}

              {formError && (
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0, fontWeight: 500 }}>{formError}</p>
              )}

              <button
                onClick={async () => {
                  const ok = await handleFormSubmit();
                  if (ok) setTimeout(() => setShowAddLeadModal(false), 1200);
                }}
                disabled={formSubmitting}
                style={{
                  width: '100%', padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: formSubmitting ? C.muted : (darkMode ? '#fff' : '#1e2330'),
                  color: darkMode ? '#1e2330' : '#fff', fontSize: 13, fontWeight: 600,
                  cursor: formSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  opacity: formSubmitting ? 0.7 : 1, marginTop: 2,
                }}
                onMouseEnter={(e) => { if (!formSubmitting) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {formSubmitting ? 'Ajout en cours...' : 'Ajouter le lead'}
              </button>

              {formSuccess && (
                <div style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)',
                  border: `1px solid ${darkMode ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  animation: 'toastSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'successPulse 0.4s ease both', flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" fill="#10b981" opacity="0.15" />
                    <path d="M7 12.5l3 3 7-7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray="24" strokeDashoffset="0" style={{ animation: 'checkmarkDraw 0.5s ease 0.15s both' }} />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>Lead ajouté avec succès</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── NDA GENERATION POPUP ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {ndaPopup && ndaData && (() => {
        const lead = leads.find(l => l.id === ndaPopup.leadId);
        if (!lead) return null;
        const inputStyle = {
          width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
          border: `1px solid ${C.border}`, background: darkMode ? '#16171e' : '#fafbfd',
          color: C.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        };
        const labelStyle = { fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 };
        const selectStyle = {
          ...inputStyle, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(C.muted)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 30,
        };
        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'modalOverlayIn 0.25s ease both',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) { setNdaPopup(null); setNdaData(null); } }}
          >
            <div style={{
              width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
              background: C.bg, borderRadius: 16, border: `1px solid ${C.border}`,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '24px 28px',
              animation: 'modalCardIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Générer le NDA</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>{lead.full_name} {lead.company_name ? `— ${lead.company_name}` : ''}</p>
                </div>
                <button onClick={() => { setNdaPopup(null); setNdaData(null); }}
                  style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: C.muted, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >✕</button>
              </div>

              {/* Prefill bar */}
              <div style={{
                display: 'flex', gap: 8, marginBottom: 16, padding: '12px 14px', borderRadius: 12,
                background: darkMode ? 'rgba(99,102,241,0.08)' : 'rgba(91,106,191,0.06)',
                border: `1px solid ${darkMode ? 'rgba(99,102,241,0.2)' : 'rgba(91,106,191,0.12)'}`,
              }}>
                <div style={{ flex: 1, fontSize: 12, color: C.secondary }}>
                  <span style={{ fontWeight: 600, color: C.accent }}>Pré-remplir</span> — Recherche automatique via SIREN
                </div>
                <button onClick={handleNdaPrefill} disabled={ndaLoading}
                  style={{
                    padding: '6px 16px', borderRadius: 50, border: 'none',
                    background: ndaLoading ? C.muted : C.accent, color: '#fff',
                    fontSize: 11.5, fontWeight: 700, cursor: ndaLoading ? 'wait' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >{ndaLoading ? 'Recherche...' : 'Pré-remplir'}</button>
              </div>

              {/* Success / Error messages */}
              {ndaSuccess && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.15)`, fontSize: 12, color: '#10b981', fontWeight: 600, animation: 'toastSlideIn 0.3s ease both' }}>
                  Informations pré-remplies avec succès
                </div>
              )}
              {ndaError && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: darkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.15)`, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                  {ndaError}
                </div>
              )}

              {/* Form fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Row 1: Raison sociale + Forme juridique */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
                  <div>
                    <div style={labelStyle}>Raison sociale *</div>
                    <input value={ndaData.legalName} onChange={(e) => setNdaData(prev => ({ ...prev, legalName: e.target.value }))}
                      style={inputStyle} placeholder="Nom de la société"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Forme juridique</div>
                    <select value={ndaData.legalForm} onChange={(e) => setNdaData(prev => ({ ...prev, legalForm: e.target.value }))} style={selectStyle}>
                      {NDA_LEGAL_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: SIREN + Ville RCS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={labelStyle}>SIREN *</div>
                    <input value={ndaData.siren} onChange={(e) => setNdaData(prev => ({ ...prev, siren: e.target.value }))}
                      style={inputStyle} placeholder="123 456 789" disabled={ndaData.isInRegistration}
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Ville RCS</div>
                    <input value={ndaData.rcsCity} onChange={(e) => setNdaData(prev => ({ ...prev, rcsCity: e.target.value }))}
                      style={inputStyle} placeholder="Paris" disabled={ndaData.legalForm === 'EI'}
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                </div>

                {/* En cours d'immatriculation */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.secondary, cursor: 'pointer' }}>
                  <input type="checkbox" checked={ndaData.isInRegistration} onChange={(e) => setNdaData(prev => ({ ...prev, isInRegistration: e.target.checked }))} style={{ cursor: 'pointer' }} />
                  En cours d'immatriculation
                </label>

                {/* Address */}
                <div>
                  <div style={labelStyle}>Adresse du siège</div>
                  <input value={ndaData.headOffice.line1} onChange={(e) => setNdaData(prev => ({ ...prev, headOffice: { ...prev.headOffice, line1: e.target.value } }))}
                    style={{ ...inputStyle, marginBottom: 6 }} placeholder="Adresse"
                    onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 6 }}>
                    <input value={ndaData.headOffice.postalCode} onChange={(e) => setNdaData(prev => ({ ...prev, headOffice: { ...prev.headOffice, postalCode: e.target.value } }))}
                      style={inputStyle} placeholder="CP"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                    <input value={ndaData.headOffice.city} onChange={(e) => setNdaData(prev => ({ ...prev, headOffice: { ...prev.headOffice, city: e.target.value } }))}
                      style={inputStyle} placeholder="Ville"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                </div>

                {/* Representatives */}
                <div>
                  <div style={labelStyle}>Représentant</div>
                  {ndaData.representatives.map((rep, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 6, marginBottom: i < ndaData.representatives.length - 1 ? 6 : 0 }}>
                      <input value={rep.fullName} onChange={(e) => {
                        const reps = [...ndaData.representatives];
                        reps[i] = { ...reps[i], fullName: e.target.value };
                        setNdaData(prev => ({ ...prev, representatives: reps }));
                      }} style={inputStyle} placeholder="Nom complet"
                        onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                      />
                      <input value={rep.role} onChange={(e) => {
                        const reps = [...ndaData.representatives];
                        reps[i] = { ...reps[i], role: e.target.value };
                        setNdaData(prev => ({ ...prev, representatives: reps }));
                      }} style={inputStyle} placeholder="Fonction"
                        onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                      />
                    </div>
                  ))}
                </div>

                {/* Row: Email + Phone (from lead, editable here) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={labelStyle}>Email</div>
                    <input value={ndaData.email} onChange={(e) => setNdaData(prev => ({ ...prev, email: e.target.value }))}
                      style={inputStyle} placeholder="contact@example.com"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Téléphone</div>
                    <input value={ndaData.phone} onChange={(e) => setNdaData(prev => ({ ...prev, phone: e.target.value }))}
                      style={inputStyle} placeholder="06 12 34 56 78"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                </div>

                {/* Business type */}
                <div>
                  <div style={labelStyle}>Type d'entreprise</div>
                  <select value={ndaData.businessType} onChange={(e) => setNdaData(prev => ({ ...prev, businessType: e.target.value }))} style={selectStyle}>
                    {NDA_BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Separator */}
              <div style={{ height: 1, background: C.border, margin: '18px 0' }} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setNdaPopup(null); setNdaData(null); }}
                  style={{
                    flex: 1, padding: '11px 16px', borderRadius: 10, border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.secondary, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >Annuler</button>
                <button onClick={handleNdaGenerate} disabled={ndaGenerating}
                  style={{
                    flex: 2, padding: '11px 16px', borderRadius: 10, border: 'none',
                    background: ndaGenerating ? C.muted : (darkMode ? '#fff' : '#1e2330'),
                    color: ndaGenerating ? '#fff' : (darkMode ? '#1e2330' : '#fff'),
                    fontSize: 13, fontWeight: 700, cursor: ndaGenerating ? 'wait' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!ndaGenerating) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.2)'; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >{ndaGenerating ? 'Génération en cours...' : 'Confirmer la génération'}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── REMOTE CURSORS OVERLAY ──────────────────────────────────────────── */}
      {Object.entries(remoteCursors).map(([email, cur]) => (
        <div key={email} style={{
          position: 'fixed', left: cur.x, top: cur.y, zIndex: 99998, pointerEvents: 'none',
          transition: 'left 0.08s linear, top 0.08s linear',
        }}>
          {/* Cursor arrow — Figma style without stem */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))', transform: 'rotate(-12deg)' }}>
            <path d="M2 1L2 16L6.5 11.5L14 11.5L2 1Z" fill={cur.color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          {/* Name label + current tab */}
          <div style={{
            position: 'absolute', left: 14, top: 14,
            background: cur.color, color: '#fff', fontSize: 10, fontWeight: 600,
            padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {(cur.full_name || email).split(' ')[0]}
            {remoteUserTabs[email] && (() => {
              const tabCat = CATEGORIES.find(c => c.key === remoteUserTabs[email]);
              return tabCat ? (
                <span style={{ opacity: 0.8, fontSize: 9, fontWeight: 500 }}>
                  · {tabCat.label}
                </span>
              ) : null;
            })()}
          </div>
          {/* Action toast bubble (if any active toast for this user) */}
          {actionToasts.filter(t => (t.email === email || t.user_name === cur.full_name)).map(toast => (
            <div key={toast.id} style={{
              position: 'absolute', left: 20, top: -28,
              background: darkMode ? '#2a2b36' : '#fff', color: darkMode ? '#eef0f6' : '#1e2330',
              fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 8, whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)', border: `1px solid ${cur.color}40`,
              animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
            }}>
              {toast.action}{toast.lead_name ? ` sur ${toast.lead_name}` : ''}
            </div>
          ))}
        </div>
      ))}

      {/* Fallback toasts (no cursor visible for user) */}
      {actionToasts.filter(t => {
        const matchEmail = Object.keys(remoteCursors).find(e => e === t.email || remoteCursors[e]?.full_name === t.user_name);
        return !matchEmail;
      }).map((toast, i) => (
        <div key={toast.id} style={{
          position: 'fixed', top: 80 + i * 50, right: 20, zIndex: 99997,
          background: darkMode ? '#2a2b36' : '#fff', color: darkMode ? '#eef0f6' : '#1e2330',
          fontSize: 12, fontWeight: 500, padding: '8px 16px', borderRadius: 10, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: `1px solid ${C.border}`,
          animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontWeight: 600 }}>{toast.user_name}</span>
          <span style={{ color: C.muted }}>·</span>
          <span>{toast.action}{toast.lead_name ? ` sur ${toast.lead_name}` : ''}</span>
        </div>
      ))}

      {/* Presence indicator (bottom-left) */}
      {presenceUsers.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 16, left: 236, zIndex: 99996,
          display: 'flex', gap: -6, alignItems: 'center',
        }}>
          {presenceUsers.slice(0, 3).map((u, i) => (
            <div key={u.email} title={u.full_name} style={{
              width: 28, height: 28, borderRadius: '50%', border: '2px solid ' + (darkMode ? '#1e1f28' : '#fff'),
              background: getCursorColor(u.email), display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', marginLeft: i > 0 ? -8 : 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}>
              {(u.full_name || u.email).charAt(0).toUpperCase()}
            </div>
          ))}
          {presenceUsers.length > 0 && (
            <span style={{ fontSize: 10, color: C.muted, marginLeft: 6, fontWeight: 500 }}>
              {presenceUsers.length} en ligne
            </span>
          )}
        </div>
      )}
      {/* ═══ SALE DECLARATION MODAL ═══ */}
      {showSaleModal && (() => {
        const lead = leads.find(l => l.id === showSaleModal);
        return (
          <>
            <div onClick={() => { if (!saleSubmitting) { setShowSaleModal(null); setSaleSuccess(false); } }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9998, animation: 'modalOverlayIn 0.25s ease both' }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
              width: 420, maxWidth: '90vw', background: C.bg, borderRadius: 20, border: `1px solid ${C.border}`,
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)', padding: '28px 28px 24px',
              animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              {/* Close */}
              <button onClick={() => { if (!saleSubmitting) { setShowSaleModal(null); setSaleSuccess(false); } }}
                style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: C.muted, fontSize: 14,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

              {saleSuccess ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#10b98120', margin: '0 auto 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✓</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Vente déclarée !</div>
                  {saleClientNumero && <div style={{ fontSize: 14, fontWeight: 600, color: '#10b981', marginBottom: 4 }}>{saleClientNumero}</div>}
                  <div style={{ fontSize: 13, color: C.muted }}>La vente a été enregistrée avec succès</div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: darkMode ? '#10b98120' : '#ecfdf5', margin: '0 auto 10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💼</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Déclarer une vente</div>
                    {lead && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{lead.full_name}</div>}
                  </div>

                  {/* Email */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.secondary, display: 'block', marginBottom: 4 }}>Email client</label>
                    <input value={saleForm.email} onChange={(e) => setSaleForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="client@exemple.com" type="email"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
                        background: darkMode ? '#252636' : '#f9fafb', color: C.text, fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                      onFocus={(e) => e.target.style.borderColor = C.accent}
                      onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>

                  {/* Payment toggle */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.secondary, display: 'block', marginBottom: 6 }}>Mode de paiement</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[{ key: 'M', label: 'Mensuel' }, { key: 'A', label: 'Annuel' }].map(opt => (
                        <button key={opt.key} onClick={() => setSaleForm(p => ({ ...p, paymentModality: opt.key }))}
                          style={{
                            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                            border: `1px solid ${saleForm.paymentModality === opt.key ? C.accent : C.border}`,
                            background: saleForm.paymentModality === opt.key ? (darkMode ? C.accent + '20' : '#f0f1ff') : 'transparent',
                            color: saleForm.paymentModality === opt.key ? C.accent : C.muted,
                            transition: 'all 0.2s',
                          }}>{opt.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Employee range grid */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.secondary, display: 'block', marginBottom: 6 }}>Tranche salariale</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                      {EMPLOYEE_RANGES.map(r => (
                        <button key={r} onClick={() => setSaleForm(p => ({ ...p, employeeRange: r }))}
                          style={{
                            padding: '6px 2px', borderRadius: 6, fontSize: 11, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                            border: `1px solid ${saleForm.employeeRange === r ? C.accent : C.border}`,
                            background: saleForm.employeeRange === r ? (darkMode ? C.accent + '20' : '#f0f1ff') : 'transparent',
                            color: saleForm.employeeRange === r ? C.accent : C.muted,
                            transition: 'all 0.15s',
                          }}>{r}</button>
                      ))}
                    </div>
                  </div>

                  {/* Submit */}
                  <button onClick={() => handleSaleSubmit(showSaleModal)}
                    disabled={!saleForm.email.trim() || !saleForm.employeeRange || saleSubmitting}
                    style={{
                      width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600,
                      fontFamily: 'inherit', cursor: saleForm.email.trim() && saleForm.employeeRange && !saleSubmitting ? 'pointer' : 'default',
                      background: saleForm.email.trim() && saleForm.employeeRange ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.06)' : '#e5e7eb'),
                      color: saleForm.email.trim() && saleForm.employeeRange ? '#fff' : C.muted,
                      opacity: saleSubmitting ? 0.7 : 1, transition: 'all 0.2s',
                    }}
                  >{saleSubmitting ? 'Envoi en cours...' : 'Déclarer la vente'}</button>
                </>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
