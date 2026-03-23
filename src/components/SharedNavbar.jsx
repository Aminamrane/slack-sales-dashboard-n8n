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
  `;
  document.head.appendChild(style);
}

export default function SharedNavbar({ session, darkMode, setDarkMode, notification }) {
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

  useEffect(() => {
    return () => {
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
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
        onMouseEnter={() => !isNotifActive && setIslandOpen(true)}
        onMouseLeave={() => !isNotifActive && setIslandOpen(false)}
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? '0px' : '12px',
          padding: collapsed ? '8px 10px' : '10px 16px',
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
          maxWidth: collapsed ? '56px' : (notifPhase?.type === 'lead_moved' || notifPhase?.type === 'calendar_created' ? '480px' : isNotifActive ? '360px' : '700px'),
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

                {apiClient.getUser()?.role === 'admin' && (
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
                    Perf.Closing
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
              opacity: collapsed ? 0 : 1,
              transition: 'width 0.35s ease, opacity 0.25s ease',
              pointerEvents: collapsed ? 'none' : 'auto',
              flexShrink: 0,
            }}>
              <img
                src={darkMode ? darkIcon : lightIcon}
                alt={darkMode ? "Dark mode" : "Light mode"}
                onClick={() => setDarkMode(!darkMode)}
                title={darkMode ? "Mode clair" : "Mode sombre"}
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
    </div>
  );
}
