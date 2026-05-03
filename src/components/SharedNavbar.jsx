import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import apiClient from "../services/apiClient";
import lightIcon from "../assets/light.png";
import darkIcon from "../assets/dark.png";
import meetIcon from "../assets/meet.png";

const COLORS = {
  primary: "#6366f1",
  secondary: "#fb923c",
  tertiary: "#10b981",
};

// Role display names
const ROLE_LABELS = {
  admin: "Admin",
  sales: "Sales",
  head_of_sales: "Head of Sales",
  head_of_sales_manager: "Head of Sales Manager",
  ceo: "CEO",
  tech: "Tech",
  marketing: "Marketing",
  hr: "HR",
  finance_director: "Finance Director",
};

// ── KEYFRAMES (injected once) ───────────────────────────────────────────────
const NOTIF_STYLES_ID = 'navbar-notif-styles';
if (typeof document !== 'undefined' && !document.getElementById(NOTIF_STYLES_ID)) {
  const style = document.createElement('style');
  style.id = NOTIF_STYLES_ID;
  style.textContent = `
    @keyframes islandNotifOpen {
      16%  { transform: scale(0.94, 0.84); }
      55%  { transform: scale(1.015, 1.02); }
    }
    @keyframes navDotPulse {
      0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
      40% { opacity: 1; transform: translateY(-3px); }
    }
    @keyframes navCheckDraw {
      0% { stroke-dashoffset: 24; }
      100% { stroke-dashoffset: 0; }
    }
    @keyframes navCheckScale {
      0% { transform: scale(0.5); opacity: 0; }
      50% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes navNotifFadeIn {
      0% { opacity: 0; transform: translateX(8px); }
      100% { opacity: 1; transform: translateX(0); }
    }
    @keyframes navDotPop {
      0%   { transform: scale(0);    opacity: 0; }
      55%  { transform: scale(1.35); opacity: 1; }
      75%  { transform: scale(0.88); }
      100% { transform: scale(1);    opacity: 1; }
    }
    @keyframes navDestLabel {
      0%   { opacity: 0; transform: translateX(10px) scale(0.9); }
      65%  { opacity: 1; transform: translateX(-2px) scale(1.03); }
      100% { opacity: 1; transform: translateX(0) scale(1); }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes bellShake {
      0%, 100% { transform: rotate(0deg); }
      10% { transform: rotate(14deg); }
      20% { transform: rotate(-12deg); }
      30% { transform: rotate(10deg); }
      40% { transform: rotate(-8deg); }
      50% { transform: rotate(5deg); }
      60% { transform: rotate(-3deg); }
      70% { transform: rotate(1deg); }
      80% { transform: rotate(0deg); }
    }
    @keyframes notifIslandAppear {
      0% { opacity: 0; transform: scale(0.6) translateZ(0); }
      60% { opacity: 1; transform: scale(1.06) translateZ(0); }
      100% { opacity: 1; transform: scale(1) translateZ(0); }
    }
    @keyframes notifPanelExpand {
      0% { opacity: 0; clip-path: inset(0 0 100% 0 round 22px); }
      50% { opacity: 1; clip-path: inset(0 0 2% 0 round 22px); }
      100% { opacity: 1; clip-path: inset(0 0 0% 0 round 22px); }
    }
    @keyframes notifItemSlide {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes notifBadgePop {
      0% { transform: scale(0.5); }
      60% { transform: scale(1.3); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

export default function SharedNavbar({ session, darkMode, setDarkMode, notification, hideDarkToggle }) {
  const navigate = useNavigate();

  // ── COLLAPSE STATE (Dynamic Island) ─────────────────────────────────────────
  const [islandOpen, setIslandOpen] = useState(false);

  // ── NOTIFICATION STATE (internal phase tracking) ────────────────────────────
  const [notifPhase, setNotifPhase] = useState(null); // 'sending' | 'sent' | { type: 'lead_moved', ... } | null
  const [isOpening, setIsOpening] = useState(false);  // triggers squeeze animation on open
  const [isClosing, setIsClosing] = useState(false);  // keeps notification content during close transition
  const [closingWidth, setClosingWidth] = useState(null); // measured content-box width at close start
  const notifTimerRef = useRef(null);
  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const islandRef = useRef(null);
  const closeAnimRef = useRef(null);  // WAAPI close animation — stored for reliable cancel
  const hoverDelayRef = useRef(null); // delay before collapsing when notifs present

  useEffect(() => {
    return () => {
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
    };
  }, []);

  const triggerOpenAnim = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    setIsOpening(true);
    openTimerRef.current = setTimeout(() => setIsOpening(false), 560);
  };

  const triggerClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    const el = islandRef.current;
    if (!el) { setNotifPhase(null); return; }

    // ── Web Animations API: bypass React batching entirely ──
    // Measure the ACTUAL rendered dimensions right now
    const cs = getComputedStyle(el);
    const fromWidth = el.offsetWidth;                       // border-box
    const fromPadding = cs.padding;                          // e.g. "10px 16px"
    const fromRadius = cs.borderRadius;                      // e.g. "16px"
    const fromGap = cs.gap || '12px';

    // Target collapsed values (must match the collapsed inline styles)
    const toWidth = 56;                                      // border-box ≈ avatar + padding
    const toPadding = '8px 10px';
    const toRadius = '50px';
    const toGap = '0px';

    // Keep notification content visible during animation
    setIsClosing(true);
    // Clear notifPhase immediately — the animation holds the visual state
    setNotifPhase(null);

    // Animate with WAAPI — runs on compositor, immune to React renders
    const duration = 650;
    const easing = 'cubic-bezier(0.65, 0, 0.35, 1)'; // ease-in-out: visible deceleration at end

    // Cancel any previous close animation still running
    if (closeAnimRef.current) { try { closeAnimRef.current.cancel(); } catch (_) {} }

    closeAnimRef.current = el.animate([
      { width: `${fromWidth}px`, padding: fromPadding, borderRadius: fromRadius, gap: fromGap, overflow: 'hidden', offset: 0 },
      { width: `${toWidth}px`,   padding: toPadding,   borderRadius: toRadius,   gap: toGap,   overflow: 'hidden', offset: 1 },
    ], {
      duration,
      easing,
      fill: 'forwards',  // hold final frame until React catches up
    });
    // No WAAPI on content — island overflow:hidden clips it naturally as width shrinks

    // After animation completes, clean up
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false);
      setClosingWidth(null);
      // Cancel WAAPI fill so React inline styles take over
      if (closeAnimRef.current) { try { closeAnimRef.current.cancel(); } catch (_) {} closeAnimRef.current = null; }
    }, duration + 50);
  };

  useEffect(() => {
    if (notification === 'sending') {
      triggerOpenAnim();
      setNotifPhase('sending');
    } else if (notification === 'sent') {
      setNotifPhase('sent');
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => triggerClose(), 2500);
    } else if (notification?.type === 'lead_moved' || notification?.type === 'calendar_created') {
      // Cancel any running close animation from previous notification
      if (closeAnimRef.current) { try { closeAnimRef.current.cancel(); } catch (_) {} closeAnimRef.current = null; }
      if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); }
      setIsClosing(false);
      triggerOpenAnim();
      setNotifPhase(notification);
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => triggerClose(), 2500);
    } else if (!notification) {
      if (notifPhase === 'sending') setNotifPhase(null);
    }
  }, [notification]);

  // ── USER STATE ──────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('Utilisateur');
  const [userRole, setUserRole] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      let user = apiClient.getUser();

      // Always refresh from backend to get latest data (avatar_url, etc.)
      if (apiClient.getToken()) {
        try {
          const fresh = await apiClient.getMe();
          user = apiClient.getUser(); // Re-read after getMe updates localStorage
          console.log('SharedNavbar: fresh user from getMe:', JSON.stringify(user));
        } catch (e) {
          // Ignore - use whatever we have
        }
      }

      const firstName = user?.first_name || user?.name?.split(' ')[0] || null;
      const name = firstName ||
                   user?.name ||
                   session?.name ||
                   session?.user?.user_metadata?.name ||
                   session?.user?.user_metadata?.full_name ||
                   'Utilisateur';

      setDisplayName(name);
      setUserRole(user?.role);
      const resolvedAvatar = user?.avatar_url || session?.user?.avatar_url || session?.user?.user_metadata?.avatar_url || null;
      console.log('SharedNavbar: avatar_url resolved to:', resolvedAvatar);
      setAvatarUrl(resolvedAvatar);
    };

    checkUser();
  }, [session]);

  // ── NOTIFICATION ISLAND STATE ────────────────────────────────────────────────
  const [notifIslandOpen, setNotifIslandOpen] = useState(false);
  const [notifBellShake, setNotifBellShake] = useState(false);
  const [notifTab, setNotifTab] = useState('unread'); // 'unread' | 'read'
  const notifIslandRef = useRef(null);

  const [globalNotifs, setGlobalNotifs] = useState([]);
  const unreadCount = globalNotifs.filter(n => !n.read).length;
  const notifPollRef = useRef(null);

  // Fetch global notifications on mount + poll every 30s
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const token = apiClient.getToken();
        if (!token) return;
        const data = await apiClient.get('/api/v1/notifications/global?limit=20');
        if (data?.notifications) setGlobalNotifs(data.notifications);
      } catch {}
    };
    fetchNotifs();
    notifPollRef.current = setInterval(fetchNotifs, 30000);
    return () => { if (notifPollRef.current) clearInterval(notifPollRef.current); };
  }, []);

  // Handle WebSocket global_notification push (listen on window custom event)
  useEffect(() => {
    const handler = (e) => {
      const notif = e.detail;
      if (!notif?.id) return;
      // Check role filter
      const user = apiClient.getUser();
      if (notif.target_roles && !notif.target_roles.includes(user?.role)) return;
      setGlobalNotifs(prev => {
        if (prev.some(n => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
    };
    window.addEventListener('global_notification', handler);
    return () => window.removeEventListener('global_notification', handler);
  }, []);

  // Mark as read
  const markNotifsRead = async (ids) => {
    try {
      await apiClient.post('/api/v1/notifications/global/read', { ids });
      setGlobalNotifs(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
    } catch {}
  };
  const markAllRead = async () => {
    try {
      await apiClient.post('/api/v1/notifications/global/read-all');
      setGlobalNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  // Time ago helper
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    return `Il y a ${Math.floor(diff / 86400)}j`;
  };

  // Close panel on outside click
  useEffect(() => {
    if (!notifIslandOpen) return;
    const close = (e) => {
      if (notifIslandRef.current && !notifIslandRef.current.contains(e.target)) {
        setNotifIslandOpen(false);
        if (islandRef.current && !islandRef.current.contains(e.target)) {
          setIslandOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [notifIslandOpen]);

  // Bell shake every 4s while unread and panel is closed
  useEffect(() => {
    if (unreadCount > 0 && !notifIslandOpen) {
      setNotifBellShake(true);
      const shakeOff = setTimeout(() => setNotifBellShake(false), 800);
      const interval = setInterval(() => {
        setNotifBellShake(true);
        setTimeout(() => setNotifBellShake(false), 800);
      }, 4000);
      return () => { clearTimeout(shakeOff); clearInterval(interval); };
    } else {
      setNotifBellShake(false);
    }
  }, [unreadCount, notifIslandOpen]);

  const NOTIF_ICONS = {
    new_sale: { icon: '💰', color: '#10b981' },
    eod_alert: { icon: '⚠', color: '#f59e0b' },
    perf_alert: { icon: '📊', color: '#6366f1' },
    contract_signed: { icon: '✓', color: '#10b981' },
    contract_expired: { icon: '⏰', color: '#fb923c' },
    sheet_invitation: { icon: '📋', color: '#8b5cf6' },
    eod_missed: { icon: '⚠', color: '#f59e0b' },
    eod_low_score: { icon: '📉', color: '#ef4444' },
    setter_placed_r1: { icon: 'R1', color: '#3b82f6' },
    setter_placed_r2: { icon: 'R2', color: '#fb923c' },
    default: { icon: '●', color: '#94a3b8' },
  };

  // ── KEYBOARD SHORTCUT ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Shift+S → TrackingSheet (ignore if typing in an input/textarea, and only if user has access)
      if (e.shiftKey && e.key === 'S' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        if (apiClient.hasAccess('tracking_sheet')) {
          e.preventDefault();
          navigate('/tracking-sheet');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // ── LOGOUT ──────────────────────────────────────────────────────────────────
  const logout = () => {
    apiClient.logout();
  };

  // ── DERIVED STATE ─────────────────────────────────────────────────────────
  const isNotifActive = !!notifPhase;
  const forceOpen = isNotifActive || isClosing; // Keep island "open" during WAAPI close animation
  const collapsed = !islandOpen && !forceOpen;

  return (
    <div style={{
      position: 'fixed',
      top: '6px',
      left: 0,
      right: 0,
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      padding: '12px 24px',
      pointerEvents: 'none',
      fontFamily: 'sans-serif',
    }}>
      <div
        ref={islandRef}
        onMouseEnter={() => { if (hoverDelayRef.current) { clearTimeout(hoverDelayRef.current); hoverDelayRef.current = null; } !isNotifActive && setIslandOpen(true); }}
        onMouseLeave={() => { if (!isNotifActive && !notifIslandOpen) { if (unreadCount > 0) { hoverDelayRef.current = setTimeout(() => setIslandOpen(false), 450); } else { setIslandOpen(false); } } }}
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? (unreadCount > 0 ? '6px' : '0px') : '12px',
          padding: collapsed ? (unreadCount > 0 ? '8px 3px 8px 10px' : '8px 10px') : '10px 16px',
          borderRadius: collapsed ? '50px' : '16px',
          background: darkMode ? 'rgba(30,31,40,0.45)' : 'rgba(255,255,255,0.40)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${darkMode ? 'rgba(42,43,54,0.6)' : 'rgba(226,230,239,0.6)'}`,
          boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)',
          fontFamily: 'sans-serif',
          // Permanent GPU layer — prevents subpixel drop when animation de-promotes the layer
          transform: 'translateZ(0)',
          overflow: collapsed ? 'hidden' : 'visible',
          maxWidth: collapsed ? (unreadCount > 0 ? '105px' : '56px') : (notifPhase?.type === 'lead_moved' || notifPhase?.type === 'calendar_created' ? '480px' : isNotifActive ? '360px' : '700px'),
          // CSS transition handles hover open/close only. Notification close uses WAAPI (triggerClose).
          transition: 'max-width 0.55s cubic-bezier(0.16, 1, 0.3, 1), padding 0.4s cubic-bezier(0.16, 1, 0.3, 1), gap 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.04s',
          animation: isOpening ? 'islandNotifOpen 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) both' : undefined,
        }}>

        {/* ── NOTIFICATION MODE ── */}
        {(isNotifActive || isClosing) ? (
          <>
            {/* Avatar — height:34px wrapper matches normal-mode collapsed height (dark mode + logout are 34px) */}
            <div style={{ height: 34, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${darkMode ? '#2a2b36' : '#e2e6ef'}` }}
                />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: userRole === 'admin' ? COLORS.primary : COLORS.tertiary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', color: '#fff', fontWeight: 600
                }}>
                  {userRole === 'admin' ? '👑' : '👤'}
                </div>
              )}
            </div>

            {/* Notification content — WAAPI handles close fade. Children have own stagger animations. */}
            <div data-notif-content style={{
              display: 'flex', alignItems: 'center', gap: 8,
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}>
              {notifPhase === 'sending' ? (
                <>
                  {/* Spinner circle */}
                  <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}>
                    <circle cx="9" cy="9" r="7" fill="none" stroke={darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'} strokeWidth="2" />
                    <circle cx="9" cy="9" r="7" fill="none" stroke={COLORS.secondary} strokeWidth="2" strokeLinecap="round"
                      strokeDasharray="32" strokeDashoffset="24" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f5f5f7' : '#1d1d1f' }}>
                    Envoi en cours
                  </span>
                  <span style={{ display: 'flex', gap: 2, marginLeft: -4 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 3, height: 3, borderRadius: '50%',
                        background: darkMode ? '#f5f5f7' : '#1d1d1f',
                        animation: `navDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </span>
                </>
              ) : notifPhase === 'sent' ? (
                <>
                  {/* Animated check */}
                  <div style={{ animation: 'navCheckScale 0.45s cubic-bezier(0.34,1.56,0.64,1) both', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="11" fill={COLORS.tertiary} opacity="0.15" />
                      <path d="M7 12.5l3.5 3.5 6.5-7"
                        stroke={COLORS.tertiary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ strokeDasharray: 24, animation: 'navCheckDraw 0.4s cubic-bezier(0.22,1,0.36,1) 0.15s both' }}
                      />
                    </svg>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: COLORS.tertiary,
                    animation: 'navNotifFadeIn 0.3s cubic-bezier(0.22,1,0.36,1) 0.1s both',
                  }}>
                    Contrat envoyé
                  </span>
                </>
              ) : notifPhase?.type === 'calendar_created' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {/* Meet icon — spring pop, 150ms delay */}
                  <img src={meetIcon} alt="Meet" style={{
                    width: 20, height: 20, objectFit: 'contain', flexShrink: 0,
                    animation: 'navDotPop 0.42s cubic-bezier(0.34,1.56,0.64,1) 0.15s backwards',
                  }} />
                  {/* Text — slide in, 210ms delay */}
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)',
                    whiteSpace: 'nowrap',
                    animation: 'navNotifFadeIn 0.32s cubic-bezier(0.16,1,0.3,1) 0.21s backwards',
                  }}>
                    Le rendez-vous {notifPhase.rdvType} a été créé pour
                  </span>
                  {/* First name — spring slide, 340ms delay */}
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: darkMode ? '#f5f5f7' : '#1d1d1f', flexShrink: 0,
                    animation: 'navDestLabel 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.34s backwards',
                  }}>
                    {notifPhase.firstName}
                  </span>
                </div>
              ) : notifPhase?.type === 'lead_moved' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {/* Dot — spring pop, 150ms delay */}
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                    background: notifPhase.destColor,
                    boxShadow: `0 0 8px ${notifPhase.destColor}90`,
                    animation: 'navDotPop 0.42s cubic-bezier(0.34,1.56,0.64,1) 0.15s backwards',
                  }} />
                  {/* Lead name — slide in, 210ms delay */}
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: darkMode ? '#f5f5f7' : '#1d1d1f',
                    maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    animation: 'navNotifFadeIn 0.32s cubic-bezier(0.16,1,0.3,1) 0.21s backwards',
                  }}>
                    {notifPhase.name}
                  </span>
                  {/* Arrow — fade in, 280ms delay */}
                  <span style={{
                    fontSize: 12, color: darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)', flexShrink: 0,
                    animation: 'navNotifFadeIn 0.25s cubic-bezier(0.16,1,0.3,1) 0.28s backwards',
                  }}>→</span>
                  {/* Destination label — spring slide, 340ms delay */}
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: notifPhase.destColor, flexShrink: 0,
                    animation: 'navDestLabel 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.34s backwards',
                  }}>
                    {notifPhase.destLabel}
                  </span>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            {/* ── NORMAL MODE ── */}
            {/* User Profile — clickable → /profile */}
            <div
              onClick={() => collapsed ? setIslandOpen(true) : navigate('/profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? '0px' : '10px',
                paddingRight: collapsed ? '0' : '12px',
                borderRight: collapsed ? 'none' : `1px solid ${darkMode ? '#2a2b36' : '#e2e6ef'}`,
                cursor: 'pointer',
                borderRadius: '10px',
                transition: 'background 0.15s, gap 0.35s ease, padding 0.35s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (!collapsed) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: `2px solid ${darkMode ? '#2a2b36' : '#e2e6ef'}`
                  }}
                />
              ) : (
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: userRole === 'admin' ? COLORS.primary : COLORS.tertiary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: '#fff',
                  fontWeight: 600
                }}>
                  {userRole === 'admin' ? '👑' : '👤'}
                </div>
              )}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '1px',
                maxWidth: collapsed ? 0 : '140px',
                opacity: collapsed ? 0 : 1,
                overflow: 'hidden', whiteSpace: 'nowrap',
                transition: 'max-width 0.35s ease, opacity 0.25s ease',
              }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                  lineHeight: 1.2
                }}>
                  {displayName}
                </span>
                <span style={{
                  fontSize: '11px',
                  color: darkMode ? '#8b8d93' : '#86868b',
                  lineHeight: 1.2
                }}>
                  {ROLE_LABELS[userRole] || userRole || 'Membre'}
                </span>
              </div>
            </div>

            {/* Bell + badge inside navbar pill (collapsed only) */}
            {unreadCount > 0 && (
              <div style={{
                position: 'relative',
                maxWidth: collapsed ? 25 : 0,
                opacity: collapsed ? 1 : 0,
                overflow: collapsed ? 'visible' : 'hidden',
                transition: 'max-width 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease',
                pointerEvents: collapsed ? 'auto' : 'none',
                flexShrink: 0,
                cursor: 'pointer',
              }}
                onClick={(e) => { e.stopPropagation(); setIslandOpen(true); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke={darkMode ? '#f5f5f7' : '#1d1d1f'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: (notifBellShake && collapsed) ? 'bellShake 0.8s ease-in-out' : 'none', transformOrigin: 'top center', marginTop: 3, marginLeft: 4 }}
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span style={{
                  position: 'absolute', top: -5, right: -7,
                  minWidth: 15, height: 15, borderRadius: 8,
                  background: '#ef4444', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px',
                  animation: 'notifBadgePop 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
                  border: `2px solid ${darkMode ? 'rgba(30,31,40,0.9)' : 'rgba(255,255,255,0.9)'}`,
                }}>
                  {unreadCount}
                </span>
              </div>
            )}

            {/* Mes pages - Dropdown */}
            <div style={{
              position: 'relative',
              opacity: collapsed ? 0 : 1,
              maxWidth: collapsed ? 0 : '200px',
              overflow: collapsed ? 'hidden' : 'visible',
              transition: 'opacity 0.25s ease, max-width 0.35s ease',
              pointerEvents: collapsed ? 'none' : 'auto',
              flexShrink: 0,
            }}>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  padding: '8px 12px',
                  minHeight: 34,
                  maxHeight: 34,
                  borderRadius: 10,
                  border: 'none',
                  background: darkMode ? '#2a2b2e' : '#eef0f6',
                  color: darkMode ? '#eef0f6' : '#1e2330',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b36' : '#e2e6ef'}
                onMouseLeave={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#eef0f6'}
                onClick={(e) => {
                  const dropdown = e.currentTarget.nextElementSibling;
                  dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
                }}
              >
                <span>Mes pages</span>
                <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '6px' }}>▼</span>
              </button>
              {/* Dropdown menu */}
              <div
                style={{
                  display: 'none',
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '8px',
                  borderRadius: '12px',
                  background: darkMode ? '#242428' : '#ffffff',
                  border: `1px solid ${darkMode ? '#2a2b36' : '#e2e6ef'}`,
                  boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
                  minWidth: '160px',
                  zIndex: 1000
                }}
                onMouseLeave={(e) => e.currentTarget.style.display = 'none'}
              >
                {/* Navigation items - dynamically shown based on backend permissions */}
                {apiClient.hasAccess('leaderboard') && (
                  <button
                    onClick={() => navigate("/")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: '8px', border: 'none', background: 'transparent',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Suivi des ventes
                  </button>
                )}

                {apiClient.hasAccess('admin_leads') && (
                  <button
                    onClick={() => navigate("/admin/leads")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: '8px', border: 'none', background: 'transparent',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Monitoring Lead
                  </button>
                )}

                {apiClient.hasAccess('leads_management') && (
                  <button
                    onClick={() => navigate("/leads-management")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: '8px', border: 'none', background: 'transparent',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Gestion des Leads
                  </button>
                )}

                {apiClient.hasAccess('monitoring_perf') && (
                  <button
                    onClick={() => navigate("/monitoring-perf")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: '8px', border: 'none', background: 'transparent',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Monitoring Sales
                  </button>
                )}

                {apiClient.hasAccess('tracking_sheet') && (
                  <button
                    onClick={() => navigate("/tracking-sheet")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: '8px', border: 'none', background: 'transparent',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Tracking Sheet
                  </button>
                )}

                {apiClient.hasAccess('tracking_sheet_setter') && (
                  <button
                    onClick={() => navigate("/tracking-setter")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: '8px', border: 'none', background: 'transparent',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Tracking Setter
                  </button>
                )}

                {apiClient.hasAccess('eod_reports') && (
                  <button
                    onClick={() => navigate("/eod-report")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: '8px', border: 'none', background: 'transparent',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    End of Day
                  </button>
                )}

                {apiClient.hasAccess('eod_dashboard') && (
                  <button
                    onClick={() => navigate("/eod-dashboard")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: '8px', border: 'none', background: 'transparent',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Dashboard EOD
                  </button>
                )}

                <button
                  onClick={() => navigate("/campaigns")}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                    borderRadius: '8px', border: 'none', background: 'transparent',
                    color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Campagnes
                </button>

                {(apiClient.getUser()?.role === 'admin' || apiClient.getUser()?.role === 'ceo') && (
                  <button
                    onClick={() => navigate("/perf-closing")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                      borderRadius: '8px', border: 'none', background: 'transparent',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f', fontSize: '14px', fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    CEO Dashboard
                  </button>
                )}

              </div>
            </div>

            {/* Dark Mode Toggle */}
            <div style={{
              width: collapsed ? 0 : '80px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: collapsed ? 'hidden' : 'visible',
              opacity: collapsed ? 0 : hideDarkToggle ? 0.4 : 1,
              transition: 'width 0.35s ease, opacity 0.25s ease',
              pointerEvents: collapsed || hideDarkToggle ? 'none' : 'auto',
              flexShrink: 0,
            }}>
              <img
                src={darkMode ? darkIcon : lightIcon}
                alt={darkMode ? "Dark mode" : "Light mode"}
                onClick={() => { if (!hideDarkToggle) setDarkMode(!darkMode); }}
                title={hideDarkToggle ? "Reposez vos yeux 🌙" : darkMode ? "Mode clair" : "Mode sombre"}
                style={{
                  width: '80px',
                  height: 'auto',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              />
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              title="Déconnexion"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: collapsed ? 0 : '34px',
                height: '34px',
                borderRadius: '10px',
                border: 'none',
                background: darkMode ? '#2a2b2e' : '#f5f5f7',
                color: darkMode ? '#8b8d93' : '#86868b',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s, width 0.35s ease, opacity 0.25s ease',
                opacity: collapsed ? 0 : 1,
                overflow: 'hidden',
                padding: collapsed ? 0 : undefined,
                pointerEvents: collapsed ? 'none' : 'auto',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = darkMode ? '#ff453a' : '#ff3b30';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7';
                e.currentTarget.style.color = darkMode ? '#8b8d93' : '#86868b';
              }}
            >
              ⏻
            </button>
          </>
        )}
      </div>

      {/* ── NOTIFICATION ISLAND (visible only when navbar is expanded) ── */}
      {unreadCount > 0 && !collapsed && (
        <div
          ref={notifIslandRef}
          onMouseEnter={() => { if (hoverDelayRef.current) { clearTimeout(hoverDelayRef.current); hoverDelayRef.current = null; } setIslandOpen(true); }}
          onMouseLeave={() => { if (!notifIslandOpen) { hoverDelayRef.current = setTimeout(() => setIslandOpen(false), 450); } }}
          style={{
            pointerEvents: 'auto',
            position: 'relative',
            marginLeft: 8,
            animation: 'notifIslandAppear 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            transform: 'translateZ(0)',
          }}
        >
          {/* Notification pill */}
          <button
            onClick={() => { setNotifIslandOpen(!notifIslandOpen); if (!notifIslandOpen) setNotifTab('unread'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', height: 52,
              borderRadius: 16,
              border: `1px solid ${darkMode ? 'rgba(42,43,54,0.6)' : 'rgba(226,230,239,0.6)'}`,
              background: darkMode ? 'rgba(30,31,40,0.45)' : 'rgba(255,255,255,0.40)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(30,31,40,0.65)' : 'rgba(255,255,255,0.65)'}
            onMouseLeave={(e) => e.currentTarget.style.background = darkMode ? 'rgba(30,31,40,0.45)' : 'rgba(255,255,255,0.40)'}
          >
            {/* Bell icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={darkMode ? '#f5f5f7' : '#1d1d1f'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: notifBellShake ? 'bellShake 0.8s ease-in-out' : 'none', transformOrigin: 'top center' }}
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {/* Badge */}
            <span style={{
              minWidth: 18, height: 18, borderRadius: 10,
              background: '#ef4444', color: '#fff',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px',
              animation: 'notifBadgePop 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              {unreadCount}
            </span>
          </button>

          {/* Expanded panel */}
          {notifIslandOpen && (
            <div style={{
              position: 'fixed', top: 68, left: 'calc(50% - 206px)', transform: 'translateX(-50%)',
              width: 400, maxHeight: 440,
              borderRadius: 22,
              background: darkMode ? 'rgba(30,31,40,0.97)' : 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(56px)', WebkitBackdropFilter: 'blur(56px)',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              boxShadow: darkMode ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              animation: 'notifPanelExpand 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}>
              {/* Header + Tabs */}
              <div style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                <div style={{ padding: '14px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#f5f5f7' : '#1d1d1f', letterSpacing: '-0.02em' }}>
                    Notifications
                  </span>
                  {notifTab === 'unread' && unreadCount > 0 && (
                    <button onClick={() => {
                      markAllRead();
                    }} style={{
                      border: 'none', background: 'transparent', fontSize: 11, fontWeight: 600,
                      color: COLORS.primary, cursor: 'pointer', fontFamily: 'inherit',
                      padding: '2px 6px', borderRadius: 6,
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >Tout lire</button>
                  )}
                </div>
                {/* Tabs */}
                <div style={{ display: 'flex', padding: '8px 18px 0', gap: 0 }}>
                  {[{ key: 'unread', label: 'Non lues' }, { key: 'read', label: 'Lues' }].map(tab => (
                    <button key={tab.key} onClick={() => setNotifTab(tab.key)} style={{
                      padding: '6px 14px', border: 'none', background: 'transparent',
                      fontSize: 12, fontWeight: notifTab === tab.key ? 650 : 500, fontFamily: 'inherit',
                      color: notifTab === tab.key ? (darkMode ? '#f5f5f7' : '#1d1d1f') : (darkMode ? '#5e6273' : '#9ca3af'),
                      cursor: 'pointer', borderBottom: `2px solid ${notifTab === tab.key ? COLORS.primary : 'transparent'}`,
                      transition: 'all 0.15s', marginBottom: -1,
                    }}>{tab.label}{tab.key === 'unread' && unreadCount > 0 && (
                      <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#ef4444', color: '#fff' }}>{unreadCount}</span>
                    )}</button>
                  ))}
                </div>
              </div>

              {/* Notification list */}
              <div style={{ padding: '6px 0', overflowY: 'auto', maxHeight: 340 }}>
                {globalNotifs.filter(n => notifTab === 'unread' ? !n.read : n.read).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 16px', color: darkMode ? '#5e6273' : '#9ca3af', fontSize: 12.5 }}>
                    {notifTab === 'unread' ? 'Aucune nouvelle notification' : 'Aucune notification lue'}
                  </div>
                )}
                {globalNotifs.filter(n => notifTab === 'unread' ? !n.read : n.read).map((notif, idx) => {
                  const nConfig = NOTIF_ICONS[notif.type] || NOTIF_ICONS.default;
                  return (
                    <div key={notif.id} onClick={() => {
                      if (!notif.read) markNotifsRead([notif.id]);
                      setNotifIslandOpen(false);
                      setTimeout(() => setIslandOpen(false), 150);
                      // Navigate for invitation notifications → go to notifications tab in tracking sheet
                      if (notif.type === 'sheet_invitation') {
                        navigate('/tracking-sheet?view=notifications');
                      }
                      // Navigate for setter R1/R2 notifications → tracking sheet
                      if (notif.type === 'setter_placed_r1' || notif.type === 'setter_placed_r2') {
                        navigate('/tracking-sheet');
                      }
                    }} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 18px', cursor: 'pointer',
                      background: notif.read ? 'transparent' : (darkMode ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)'),
                      transition: 'background 0.15s',
                      animation: `notifItemSlide 0.3s ease ${idx * 50}ms both`,
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = notif.read ? 'transparent' : (darkMode ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)')}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
                        background: `${nConfig.color}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: nConfig.color,
                      }}>{nConfig.icon}</div>
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5, fontWeight: notif.read ? 500 : 600,
                          color: darkMode ? '#eef0f6' : '#1e2330',
                          lineHeight: 1.4, letterSpacing: '-0.01em',
                        }}>{notif.title || notif.message}</div>
                        <div style={{ fontSize: 11, color: darkMode ? '#5e6273' : '#9ca3af', marginTop: 2 }}>{notif.message !== notif.title ? notif.message : ''}</div>
                        <div style={{ fontSize: 10, color: darkMode ? '#444' : '#c4c4c4', marginTop: 2 }}>{timeAgo(notif.created_at)}</div>
                      </div>
                      {/* Unread dot */}
                      {!notif.read && (
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%', background: COLORS.primary,
                          flexShrink: 0, marginTop: 6,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
