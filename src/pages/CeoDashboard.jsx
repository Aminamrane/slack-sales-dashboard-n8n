import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import companyLogo from "../assets/my_image.png";
import ceo1 from "../assets/ceo1.svg";
import ceo2 from "../assets/ceo2.svg";
import ceo3 from "../assets/ceo3.svg";
import ceo4 from "../assets/ceo4.svg";
import ceo5 from "../assets/ceo5.svg";
import medal1 from "../assets/1st-place.png";
import medal2 from "../assets/2st-place.png";
import medal3 from "../assets/3st-place.png";
import ceo6 from "../assets/ceo6.svg";
import SharedNavbar from "../components/SharedNavbar.jsx";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import testLottie from "../assets/test.lottie?url";
import { ChevronDown, Home, MessageSquare, Mail, Search, PanelLeft, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "../index.css";

// ── DESIGN SYSTEM (same C object as all pages) ────────────────────────────
// Exporté pour réutilisation par CeoSheetView (mêmes palettes dark/light).
export const getColors = (dark) => ({
  bg: dark ? '#1e1f28' : '#ffffff',
  surface: dark ? '#13141b' : '#f6f7f9',
  border: dark ? '#2a2b36' : '#d5dae5',
  text: dark ? '#eef0f6' : '#1e2330',
  muted: dark ? '#5e6273' : '#9ca3af',
  subtle: dark ? '#252636' : '#f4f6fb',
  secondary: dark ? '#8b8fa0' : '#6b7280',
  accent: dark ? '#7c8adb' : '#5b6abf',
  shadow: dark ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
});

// ── SIDEBAR TABS ──────────────────────────────────────────────────────────
const SIDEBAR_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
  )},
  { section: 'HUMAN' },
  { key: 'eod', label: 'EOD Report', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  )},
  { key: 'eod_dashboard', label: 'Dashboard EOD', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
  )},
  { section: 'ACQUISITION' },
  { key: 'perf_sales', label: 'Perf Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  )},
  { key: 'leaderboard', label: 'Leaderboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/><path d="M6 22V10h4"/><path d="M14 22V10h4"/></svg>
  )},
  { key: 'sales_team', label: 'Équipe Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  { section: 'MARKETING' },
  { key: 'campaigns', label: 'Campagnes', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
  )},
  { section: 'FINANCE' },
  { key: 'perf_closing', label: 'Perf.Closing', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  )},
  { key: 'coordonnees', label: 'Coordonnées', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
];

// ── Mapping SIDEBAR_TABS → sections (format Notion-style Sidebar) ─────────
// SIDEBAR_TABS est un flat array avec separators `{ section: 'NAME' }`. Le
// composant Sidebar attend `[{ key, label, items: [{ id, label, icon }] }]`.
// Les items avant le premier separator sont regroupés dans une section
// "Récentes" (équivalent du pattern TSF). Chaque `{ section }` ouvre une
// nouvelle section dont le label devient le suivant.
export const SIDEBAR_SECTIONS = (() => {
  const sections = [];
  let current = { key: 'recent', label: 'Récentes', items: [] };
  SIDEBAR_TABS.forEach((entry) => {
    if (entry.section) {
      if (current.items.length) sections.push(current);
      current = { key: entry.section.toLowerCase(), label: entry.section, items: [] };
    } else {
      current.items.push({ id: entry.key, label: entry.label, icon: entry.icon });
    }
  });
  if (current.items.length) sections.push(current);
  return sections;
})();

// ── MOCK DATA ─────────────────────────────────────────────────────────────
// KPI icons (static, used in dashboard)
const KPI_ICONS = {
  revenue: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  leads: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  sales: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  closing: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  total: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5b6abf" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  enCours: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  resilie: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  autres: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};
const formatEuro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const MOCK_TEAM = [
  { name: 'Youcef Amrane', role: 'CEO', location: 'Paris, France', tz: 'Europe/Paris', flag: '🇫🇷', lat: 48.8566, lng: 2.3522 },
  { name: 'Léo Mafrici', role: 'Head of Sales', location: 'Lisbonne, Portugal', tz: 'Europe/Lisbon', flag: '🇵🇹', lat: 38.7223, lng: -9.1393 },
  { name: 'David Dubois', role: 'Commercial', location: 'Paris, France', tz: 'Europe/Paris', flag: '🇫🇷', lat: 48.87, lng: 2.38 },
  { name: 'Sébastien Itema', role: 'Commercial', location: 'Dubaï, Émirats', tz: 'Asia/Dubai', flag: '🇦🇪', lat: 25.2048, lng: 55.2708 },
  { name: 'Gwenaël Derouet', role: 'Commercial', location: 'Paris, France', tz: 'Europe/Paris', flag: '🇫🇷', lat: 48.85, lng: 2.30 },
  { name: 'Yanis Zairi', role: 'Head of Sales Manager', location: 'Paris, France', tz: 'Europe/Paris', flag: '🇫🇷', lat: 48.88, lng: 2.34 },
  { name: 'Yohan Debowski', role: 'Commercial', location: 'Paris, France', tz: 'Europe/Paris', flag: '🇫🇷', lat: 48.84, lng: 2.36 },
];

const MOCK_RECENT_ACTIVITY = [
  { type: 'sale', text: 'Léo Mafrici a déclaré une vente — SAS Dupont', time: 'Il y a 2h' },
  { type: 'lead', text: '23 nouveaux leads assignés aujourd\'hui', time: 'Il y a 3h' },
  { type: 'eod', text: '8/10 EODs soumis hier', time: 'Hier 22h' },
  { type: 'contract', text: 'Contrat signé — Restaurant Le Gourmet', time: 'Hier 17h' },
  { type: 'alert', text: 'David Dubois — 3 EODs manqués cette semaine', time: 'Il y a 1j' },
];

const MOCK_PIPELINE = [
  { id: 1, name: 'Restaurant Le Gourmet', contact: 'Pierre Martin', status: 'r2', assignee: 'Léo Mafrici', date: '12/04/2026', value: '3 800 €' },
  { id: 2, name: 'SAS Dupont BTP', contact: 'Jean Dupont', status: 'r1', assignee: 'David Dubois', date: '11/04/2026', value: '5 200 €' },
  { id: 3, name: 'Pharmacie Centrale', contact: 'Marie Leroy', status: 'r2', assignee: 'Gwenaël Derouet', date: '10/04/2026', value: '4 100 €' },
  { id: 4, name: 'Auto-école Permis+', contact: 'Karim Bennani', status: 'signed', assignee: 'Sébastien Itema', date: '09/04/2026', value: '2 900 €' },
  { id: 5, name: 'Crèche Les Petits Pas', contact: 'Sophie Durand', status: 'r1', assignee: 'Yanis Zairi', date: '08/04/2026', value: '3 400 €' },
  { id: 6, name: 'Salon Beauté Zen', contact: 'Nadia Farid', status: 'new', assignee: 'Yohan Debowski', date: '08/04/2026', value: '1 800 €' },
  { id: 7, name: 'Boulangerie Artisan', contact: 'François Petit', status: 'r2', assignee: 'Léo Mafrici', date: '07/04/2026', value: '3 200 €' },
];

const STATUS_CONFIG = {
  new: { label: 'Nouveau', color: '#6366f1', bg: '#eef2ff' },
  r1: { label: 'R1 Placé', color: '#3b82f6', bg: '#eff6ff' },
  r2: { label: 'R2 Placé', color: '#fb923c', bg: '#fff7ed' },
  signed: { label: 'Signé', color: '#10b981', bg: '#ecfdf5' },
};

const MOCK_CRM = [
  { id: 1, name: 'Léo Mafrici', email: 'l.mafrici@ownertechnology.com', role: 'head_of_sales', status: 'active', joined: '15/01/2025' },
  { id: 2, name: 'David Dubois', email: 'd.dubois@ownertechnology.com', role: 'sales', status: 'active', joined: '03/03/2025' },
  { id: 3, name: 'Sébastien Itema', email: 's.itema@ownertechnology.com', role: 'sales', status: 'active', joined: '22/06/2025' },
  { id: 4, name: 'Gwenaël Derouet', email: 'g.derouet@ownertechnology.com', role: 'sales', status: 'active', joined: '10/09/2025' },
  { id: 5, name: 'Yanis Zairi', email: 'y.zairi@ownertechnology.com', role: 'head_of_sales_manager', status: 'active', joined: '05/02/2025' },
  { id: 6, name: 'Yohan Debowski', email: 'y.debowski@ownertechnology.com', role: 'sales', status: 'active', joined: '17/11/2025' },
];

const ROLE_LABELS = { admin: 'Admin', ceo: 'CEO', head_of_sales: 'Head of Sales', head_of_sales_manager: 'HoS Manager', sales: 'Commercial' };
const ROLE_COLORS = { admin: '#94a3b8', ceo: '#5b6abf', head_of_sales: '#ef4444', head_of_sales_manager: '#3b82f6', sales: '#10b981' };

// ── HELPERS ──────────────────────────────────────────────────────────────
const getTimeInTz = (tz) => {
  try {
    return new Date().toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  } catch { return '--:--'; }
};

const getTimePeriod = (tz) => {
  try {
    const h = parseInt(new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }));
    if (h >= 22 || h < 6) return { label: 'Sleeping', color: '#6366f1', bg: '#eef2ff' };
    if (h >= 6 && h < 12) return { label: 'Morning', color: '#f59e0b', bg: '#fffbeb' };
    if (h >= 12 && h < 17) return { label: 'Midday', color: '#10b981', bg: '#ecfdf5' };
    return { label: 'Evening', color: '#fb923c', bg: '#fff7ed' };
  } catch { return { label: '—', color: '#9ca3af', bg: '#f3f4f6' }; }
};

const getInitials = (name) => {
  const parts = (name || '').split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (name || '?').slice(0, 2).toUpperCase();
};

// ══════════════════════════════════════════════════════════════════════════
// KPI TOOLTIP PORTAL — pour échapper aux stacking contexts / overflow:hidden
// des cartes voisines de la grille KPI. Position calculée depuis le bounding
// rect de la carte ancre, repositionné au scroll/resize tant qu'ouvert.
// Flip vers le haut si débordement vertical en bas du viewport.
// ══════════════════════════════════════════════════════════════════════════
function KpiTooltipPortal({ anchorRef, isOpen, tooltipId, breakdown, darkMode, C }) {
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'bottom' });
  const tooltipRef = useRef(null);

  const recompute = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const tooltipH = tooltipRef.current?.offsetHeight ?? 110;
    const gap = 10;
    const wouldOverflowBottom = r.bottom + gap + tooltipH > window.innerHeight - 8;
    const placement = wouldOverflowBottom ? 'top' : 'bottom';
    const top = placement === 'bottom' ? r.bottom + gap : r.top - gap - tooltipH;
    const left = r.left + r.width / 2;
    setPos({ top, left, placement });
  }, [anchorRef]);

  useEffect(() => {
    if (!isOpen) return undefined;
    recompute();
    // Second pass après mount du tooltip pour avoir la vraie hauteur mesurée.
    const raf = requestAnimationFrame(recompute);
    const onScroll = () => recompute();
    const onResize = () => recompute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen, recompute]);

  if (!isOpen) return null;

  const caretCommon = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%) rotate(45deg)',
    width: 8, height: 8,
    background: darkMode ? '#1e1f28' : '#ffffff',
  };
  const caret = pos.placement === 'bottom'
    ? { ...caretCommon, top: -5, borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }
    : { ...caretCommon, bottom: -5, borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` };

  return createPortal(
    <div
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        minWidth: 200,
        padding: '12px 14px',
        borderRadius: 10,
        background: darkMode ? '#1e1f28' : '#ffffff',
        border: `1px solid ${C.border}`,
        boxShadow: darkMode
          ? '0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.30)'
          : '0 8px 24px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06)',
        fontSize: 12,
        color: C.text,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
        animation: 'ceoTooltipPortalIn 0.18s ease both',
      }}
    >
      <div style={caret} />
      {breakdown.map((row) => (
        <div key={row.label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 18,
        }}>
          <span style={{ color: C.muted, fontWeight: 500 }}>{row.label}</span>
          <span style={{ color: C.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CEO KPI CARD — carte KPI individuelle de la grille Clients (kpiRow2).
// Héberge le ref ancre + state hover/focus + montage du KpiTooltipPortal
// uniquement quand la carte a un `breakdown` (= Résiliés aujourd'hui).
// ══════════════════════════════════════════════════════════════════════════
function CeoKpiCard({ kpi, index, dataLoading, darkMode, C }) {
  const hasTooltip = Array.isArray(kpi.breakdown) && kpi.breakdown.length > 0;
  const tooltipId = hasTooltip ? `ceo-kpi-tooltip-${index}` : undefined;
  const anchorRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = () => hasTooltip && setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <div
      ref={anchorRef}
      className={`ceo-card${hasTooltip ? ' ceo-kpi-has-tooltip' : ''}`}
      style={{
        padding: '22px 22px 18px',
        animation: `ceoCardPop 0.4s ease ${index * 80}ms both`,
        position: 'relative',
      }}
      tabIndex={hasTooltip ? 0 : undefined}
      aria-describedby={isOpen ? tooltipId : undefined}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      <img src={kpi.iconSrc} alt="" style={{
        position: 'absolute', top: -12, right: -10, width: 58, height: 55,
        objectFit: 'contain', pointerEvents: 'none', zIndex: 10,
      }} />
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8 }}>{kpi.label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#212121', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {dataLoading ? <span style={{ animation: 'ceoPulse 1.2s ease infinite' }}>—</span> : kpi.value}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 500, color: C.muted }}>{kpi.sub}</div>

      {hasTooltip && (
        <KpiTooltipPortal
          anchorRef={anchorRef}
          isOpen={isOpen}
          tooltipId={tooltipId}
          breakdown={kpi.breakdown}
          darkMode={darkMode}
          C={C}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function CeoDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [genieExtended, setGenieExtended] = useState(true);
  const [genieMenuOpen, setGenieMenuOpen] = useState(false);
  const [genieSubMenuOpen, setGenieSubMenuOpen] = useState(false);
  const [selectedModels, setSelectedModels] = useState(['genie-1.1']);
  const [chatInput, setChatInput] = useState('');
  const [globeMenuOpen, setGlobeMenuOpen] = useState(false);
  const [globeSubMenuOpen, setGlobeSubMenuOpen] = useState(false);
  const [selectedCabinet, setSelectedCabinet] = useState(null);
  const globeMenuRef = React.useRef(null);
  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  useEffect(() => {
    if (!globeMenuOpen) return;
    const onClick = (e) => {
      if (globeMenuRef.current && !globeMenuRef.current.contains(e.target)) {
        setGlobeMenuOpen(false);
        setGlobeSubMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [globeMenuOpen]);
  useEffect(() => {
    if (selectedCabinet !== 'optilex' || !mapContainerRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled) return;
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [2.3485, 48.8595],
        zoom: 11,
        pitch: 0,
        bearing: 10,
        antialias: true,
        attributionControl: false,
        logoPosition: 'bottom-left',
      });
      mapInstanceRef.current = map;
      map.on('load', () => {
        map.setLight({
          anchor: 'viewport',
          color: '#ffffff',
          intensity: 0.4,
          position: [1.5, 210, 30],
        });
        map.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': [
              'interpolate', ['linear'], ['get', 'height'],
              0, '#e8ebf4',
              30, '#d5dae8',
              80, '#b8bfd3',
              150, '#9aa3bf',
            ],
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
            'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
            'fill-extrusion-opacity': 0.94,
            'fill-extrusion-vertical-gradient': true,
          },
        });
        map.once('idle', () => {
          map.flyTo({
            center: [2.3485, 48.8595],
            zoom: 16.2,
            pitch: 52,
            bearing: -22,
            duration: 3200,
            curve: 1.4,
            easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
            essential: true,
          });
          map.once('moveend', () => {
            if (cancelled) return;
            const labelEl = document.createElement('div');
            labelEl.style.cssText = `
              display: flex; flex-direction: column; align-items: center; pointer-events: none;
            `;
            labelEl.innerHTML = `
              <div style="background:#5b6abf;color:#fff;font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:600;letter-spacing:-0.01em;padding:4px 9px;border-radius:10px;box-shadow:0 4px 12px rgba(91,106,191,0.4);white-space:nowrap;margin-bottom:2px;opacity:0;animation:ceoFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;">Opti'Lex</div>
              <div style="width:10px;height:10px;background:#5b6abf;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>
            `;
            new mapboxgl.Marker({ element: labelEl, anchor: 'bottom' })
              .setLngLat([2.3485, 48.8595])
              .addTo(map);
          });
        });
      });
    })();
    return () => { cancelled = true; if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [selectedCabinet]);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [webSearchOn, setWebSearchOn] = useState(true);
  const plusMenuRef = React.useRef(null);
  useEffect(() => {
    if (!plusMenuOpen) return;
    const onClick = (e) => { if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) setPlusMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [plusMenuOpen]);
  const genieMenuRef = React.useRef(null);
  useEffect(() => {
    if (!genieMenuOpen) return;
    const onClick = (e) => {
      if (genieMenuRef.current && !genieMenuRef.current.contains(e.target)) {
        setGenieMenuOpen(false);
        setGenieSubMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [genieMenuOpen]);
  const GENIE_MODELS = [
    { id: 'genie-1.1',  name: 'Génie 1.1',   desc: 'Le plus performant pour le pôle Human' },
    { id: 'mini-is-1.0', name: 'Mini-IS 1.0', desc: 'Spécialisé pour le pôle Finance' },
    { id: 'radar-1.0',  name: 'Radar 1.0',   desc: 'Spécialisé pour le pôle Acquisition' },
    { id: 'muse-1.0',   name: 'Muse 1.0',    desc: 'Spécialisé pour le pôle Marketing' },
    { id: 'genie-1.0',  name: 'Génie 1.0',   desc: 'Version précédente', legacy: true },
  ];
  const toggleModel = (id) => {
    setSelectedModels(prev => {
      if (prev.includes(id)) {
        return prev.length === 1 ? prev : prev.filter(m => m !== id);
      }
      return [...prev, id];
    });
  };
  const primaryModel = GENIE_MODELS.find(m => m.id === selectedModels[0]) || GENIE_MODELS[0];
  const modelPillLabel = selectedModels
    .map(id => GENIE_MODELS.find(m => m.id === id)?.name)
    .filter(Boolean)
    .join(' + ');
  // Initial tab — honour `ceoActiveTab` in localStorage (set by CeoSheetView
  // when returning from an embedded TrackingSheet view). Consume + clear so
  // a hard reload of /ceo always lands on Dashboard.
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const hint = localStorage.getItem('ceoActiveTab');
      if (hint) {
        localStorage.removeItem('ceoActiveTab');
        return hint;
      }
    } catch { /* noop */ }
    return 'dashboard';
  });
  // Sidebar collapse state (persisted). Pattern miroir TSF :
  // localStorage 'ceoSideCollapsed', défaut = expanded (false) car CEO
  // navigation est la pierre angulaire de la page.
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem('ceoSideCollapsed');
    return stored === null ? false : stored === 'true';
  });
  useEffect(() => {
    localStorage.setItem('ceoSideCollapsed', String(sideCollapsed));
  }, [sideCollapsed]);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  // Real data states
  const [leaderboardData, setLeaderboardData] = useState(null); // { totals, all_sellers }
  const [perfClosingData, setPerfClosingData] = useState(null); // { counters, delays }
  const [perfClients, setPerfClients] = useState([]); // perf-closing clients list
  const [dataLoading, setDataLoading] = useState(true);
  const [avatarMap, setAvatarMap] = useState({});
  const [woTab, setWoTab] = useState('active'); // Work Orders tab: active | draft | all
  // Sales team tab (CEO → opens individual sales' TrackingSheet in ghost mode).
  const [salesTeamUsers, setSalesTeamUsers] = useState([]);
  const [salesTeamLoading, setSalesTeamLoading] = useState(false);

  const C = useMemo(() => getColors(darkMode), [darkMode]);

  // ── AUTH CHECK ──────────────────────────────────────────────────────
  useEffect(() => {
    const u = apiClient.getUser();
    if (!u || (u.role !== 'admin' && u.role !== 'ceo')) {
      navigate('/login');
      return;
    }
    setUser(u);
  }, [navigate]);

  // ── FETCH REAL DATA ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setDataLoading(true);
      try {
        const [lb, pc] = await Promise.all([
          apiClient.getLeaderboardStats('current_month').catch(() => null),
          apiClient.get('/api/v1/perf-closing/dashboard').catch(() => null),
        ]);
        if (lb) {
          setLeaderboardData(lb);
          const sellers = lb.all_sellers || [];
          const map = {};
          const names = ['paul','ismahane','timothy','mohamed','yohan','léo','leo'];
          sellers.forEach(s => {
            if (!s.name || !s.avatar_url) return;
            const lower = s.name.toLowerCase();
            names.forEach(n => { if (lower.includes(n)) map[n.replace('é','e')] = s.avatar_url; });
          });
          setAvatarMap(map);
        }
        if (pc) setPerfClosingData(pc);
      } catch (e) { console.warn('CEO dashboard data fetch failed:', e); }
      setDataLoading(false);
    })();
  }, [user]);

  // ── DERIVED KPIs ──────────────────────────────────────────────────
  const kpiRow1 = useMemo(() => {
    const t = leaderboardData?.totals || {};
    const sellers = leaderboardData?.all_sellers || [];
    const totalLeads = sellers.reduce((s, p) => s + (p.leads_assigned || 0), 0);
    const totalVentes = t.sales || 0;
    const convGlobal = totalLeads > 0 ? ((totalVentes / totalLeads) * 100).toFixed(1) : '0.0';
    return [
      { label: "Chiffre d'affaires", value: formatEuro(t.revenue || 0), color: '#10b981', icon: KPI_ICONS.revenue, sub: 'Ce mois' },
      { label: "Nouveaux leads", value: String(totalLeads), color: '#3b82f6', icon: KPI_ICONS.leads, sub: 'Ce mois' },
      { label: "Ventes du mois", value: String(totalVentes), color: '#f59e0b', icon: KPI_ICONS.sales, sub: `${sellers.length} commerciaux` },
      { label: "Closing global", value: `${convGlobal}%`, color: '#8b5cf6', icon: KPI_ICONS.closing, sub: 'Ventes / Leads' },
    ];
  }, [leaderboardData]);

  const kpiRow2 = useMemo(() => {
    const c = perfClosingData?.counters || {};
    const resilies = (c.resilie || 0) + (c.self_resiliation || 0) + (c.retractation || 0);
    const autres = (c.pause || 0) + (c.sans_suite || 0) + (c.liquidation || 0);
    return [
      { label: 'Total Clients', value: String(c.total || 0), color: '#5b6abf', iconSrc: ceo1, sub: 'Tous états confondus' },
      { label: 'En Cours', value: String(c.en_cours || 0), color: '#10b981', iconSrc: ceo2, sub: 'Clients actifs' },
      {
        label: 'Résiliés', value: String(resilies), color: '#ef4444', iconSrc: ceo3, sub: 'Résiliation + Self + Rétractation',
        breakdown: [
          { label: 'Résiliation', value: c.resilie || 0 },
          { label: 'Self', value: c.self_resiliation || 0 },
          { label: 'Rétractation', value: c.retractation || 0 },
        ],
      },
      { label: 'Autres', value: String(autres), color: '#f59e0b', iconSrc: ceo4, sub: 'Pause, sans suite, etc.' },
    ];
  }, [perfClosingData]);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    document.body.style.background = C.surface;
    return () => { document.body.style.background = ''; };
  }, [darkMode, C]);

  // ── LAZY FETCH: Sales team (loaded on first tab visit) ─────────────
  useEffect(() => {
    if (activeTab !== 'sales_team' || salesTeamUsers.length > 0 || salesTeamLoading) return;
    setSalesTeamLoading(true);
    apiClient.getAssignableUsers()
      .then((resp) => {
        const list = Array.isArray(resp) ? resp : (resp?.users || resp?.data || []);
        setSalesTeamUsers(list);
      })
      .catch((e) => { console.warn('[CeoDashboard] getAssignableUsers failed:', e); })
      .finally(() => setSalesTeamLoading(false));
  }, [activeTab, salesTeamUsers.length, salesTeamLoading]);

  // ── CURRENT TIME (for team pulse) ──────────────────────────────────
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="ceo-page" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.surface, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' }}>
      <style>{`
        @keyframes ceoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes ceoCardPop { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes ceoRowIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
        @keyframes ceoPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes ceoTooltipPortalIn { from { opacity: 0; transform: translateX(-50%) translateY(-2px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        /* KPI tooltip — portal-rendered, voir KpiTooltipPortal. Le DOM tooltip
           n'est plus enfant de la carte (échappe stacking contexts), seul le
           ring focus + cursor restent côté carte. */
        .ceo-kpi-has-tooltip { cursor: help; outline: none; }
        .ceo-kpi-has-tooltip:focus-visible {
          box-shadow: 0 0 0 2px ${C.accent}66;
          border-radius: 16px;
        }
        .ceo-optilex-map .mapboxgl-ctrl-bottom-left,
        .ceo-optilex-map .mapboxgl-ctrl-bottom-right { display: none !important; }
        .ceo-scroll::-webkit-scrollbar { width: 3px; }
        .ceo-scroll::-webkit-scrollbar-track { background: transparent; }
        .ceo-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }
        /* Sidebar Notion-style (miroir TSF, palette dynamique via inline style). */
        .ceo-side { transition: width 0.22s cubic-bezier(0.4,0,0.2,1); }
        .ceo-side-item { transition: background 0.12s ease; }
        .ceo-side-item:hover { background: ${darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f4'}; }
        .ceo-icon-btn { transition: background 0.12s, color 0.12s; }
        .ceo-icon-btn:hover { background: ${darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f4'}; }
        .ceo-side-scroll::-webkit-scrollbar { width: 10px; }
        .ceo-side-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
        .ceo-side-scroll:hover::-webkit-scrollbar-thumb { background: ${darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(55,53,47,0.16)'}; background-clip: padding-box; }
        .ceo-side-scroll::-webkit-scrollbar-track { background: transparent; }
        .ceo-page *, .ceo-page *::before, .ceo-page *::after { box-sizing: border-box; }
        .ceo-card {
          position: relative;
          border-radius: 16px;
          background: transparent;
          border: none;
          overflow: visible;
          isolation: isolate;
        }
        .ceo-card::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 18px;
          background: linear-gradient(180deg, #EDEDEE 0%, #DCDCDD 100%);
          z-index: -2;
          pointer-events: none;
        }
        .ceo-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 16px;
          background: linear-gradient(180deg, #FCFCFD 0%, #F8F8F8 40%, #F8F8F8 60%, #F3F3F4 100%);
          box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.85);
          pointer-events: none;
          z-index: -1;
        }
      `}</style>

      {/* ═══ LEFT SIDEBAR (Notion-style — mirror TSF) ═══════════════════ */}
      <CeoSidebar
        width={sideCollapsed ? 56 : 260}
        collapsed={sideCollapsed}
        onToggle={() => setSideCollapsed((v) => !v)}
        sections={SIDEBAR_SECTIONS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        C={C}
        darkMode={darkMode}
      />

      {/* ═══ MAIN AREA ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ── SHARED NAVBAR ── */}
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

        {/* ── CONTENT AREA ── */}
        <div className="ceo-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 32px 28px' }}>

          {/* ═══ DASHBOARD TAB ═══ */}
          {activeTab === 'dashboard' && (
            <div style={{ animation: 'ceoFadeIn 0.35s ease both', marginTop: -68 }}>
              <div style={{ position: 'relative', width: 520, height: 220, overflow: 'hidden' }}>
                <iframe
                  src="https://lottie.host/embed/47485bf9-4f15-49f9-9baa-076809dc1f82/hJCupH69nO.lottie"
                  style={{ position: 'absolute', top: -120, left: -820, width: 1920, height: 480, border: 'none', background: 'transparent', pointerEvents: 'none' }}
                  title="Bonjour animation"
                />
              </div>
              <div style={{ marginTop: -64, marginBottom: 24, position: 'relative', zIndex: 2500 }}>
                <div style={{
                  maxWidth: 640,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 22,
                  padding: '14px 18px 10px',
                  boxShadow: darkMode
                    ? '0 1px 3px rgba(0,0,0,0.25), 0 4px 14px rgba(0,0,0,0.18)'
                    : '0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <input
                    type="text"
                    placeholder="Répondre..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 15,
                      color: C.text,
                      fontFamily: 'inherit',
                      padding: '6px 2px',
                      width: '100%',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div ref={plusMenuRef} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        aria-label="Ajouter"
                        onClick={() => setPlusMenuOpen(o => !o)}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          border: 'none',
                          background: plusMenuOpen ? (darkMode ? '#2a2b36' : '#eceef4') : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: C.text,
                          transition: 'background 0.15s',
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                      {plusMenuOpen && (
                        <div style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          left: 0,
                          minWidth: 300,
                          background: C.bg,
                          border: `1px solid ${C.border}`,
                          borderRadius: 18,
                          padding: 6,
                          boxShadow: darkMode ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(0,0,0,0.10)',
                          zIndex: 2000,
                          animation: 'ceoFadeIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
                        }}>
                          {[
                            { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>), label: 'Ajouter des fichiers ou des ph...' },
                            { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>), label: "Prendre une capture d'écran" },
                            { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4v13h16V7z" /><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3" /></svg>), label: 'Ajouter au projet', chevron: true },
                            { icon: (<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M17 6 6 26l6 10 11-20z"/><path fill="#1E88E5" d="M24 16h19L32 36H13z"/><path fill="#4CAF50" d="M36 26 25 6h-8l11 20z"/><path fill="#E53935" d="m12 36 6-10h22l-6 10z"/></svg>), label: 'Ajouter depuis Google Drive', chevron: true },
                            { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.1c-3.2.69-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.67.8.55C20.22 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/></svg>), label: 'Ajouter depuis GitHub' },
                            { divider: true },
                            { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h12l4 4v12H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>), label: 'Compétences', chevron: true },
                            { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>), label: 'Connecteurs', chevron: true },
                            { divider: true },
                            { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>), label: 'Recherche' },
                            { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" /></svg>), label: 'Recherche Web', active: webSearchOn, onClick: () => setWebSearchOn(v => !v), highlight: '#2563eb' },
                            { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 4 9 15l-3-3" /><path d="M4 20c3-4 6-5 9-5" /></svg>), label: 'Utiliser le style', chevron: true },
                          ].map((item, i) => item.divider ? (
                            <div key={`div-${i}`} style={{ height: 1, background: C.border, margin: '6px 8px' }} />
                          ) : (
                            <div
                              key={item.label}
                              onClick={item.onClick}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 10,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 12,
                                transition: 'background 0.15s',
                                color: item.highlight && item.active ? item.highlight : C.text,
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = C.subtle}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</span>
                              <span style={{ fontSize: 14, fontWeight: 400, flex: 1 }}>{item.label}</span>
                              {item.chevron && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              )}
                              {item.active && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={item.highlight || C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div ref={genieMenuRef} style={{ position: 'relative' }}>
                        <div
                          onClick={() => { setGenieMenuOpen(o => !o); setGenieSubMenuOpen(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.text, cursor: 'pointer', userSelect: 'none' }}
                        >
                          <span style={{ fontWeight: 500 }}>{modelPillLabel}</span>
                          {genieExtended && <span style={{ color: C.muted }}>Étendue</span>}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                        {genieMenuOpen && (
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            minWidth: 340,
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            borderRadius: 18,
                            padding: '6px',
                            boxShadow: darkMode ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(0,0,0,0.10)',
                            zIndex: 2000,
                            animation: 'ceoFadeIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
                          }}>
                            {/* Primary model row */}
                            <div
                              onClick={() => toggleModel('genie-1.1')}
                              style={{
                                padding: '10px 14px',
                                borderRadius: 12,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 12,
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = C.subtle}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Génie 1.1</span>
                                <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.35 }}>Le plus performant pour le pôle Human</span>
                              </div>
                              {selectedModels.includes('genie-1.1') && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>

                            <div style={{ height: 1, background: C.border, margin: '4px 8px' }} />

                            {/* Réflexion étendue toggle */}
                            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Réflexion étendue</span>
                                <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.35 }}>Réfléchir plus longtemps pour les tâches complexes.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setGenieExtended(v => !v)}
                                aria-label="Toggle étendue"
                                style={{
                                  width: 38, height: 22, borderRadius: 11,
                                  border: 'none',
                                  background: genieExtended ? C.accent : (darkMode ? '#3a3b48' : '#d5dae5'),
                                  position: 'relative', cursor: 'pointer', padding: 0, flexShrink: 0, marginTop: 2,
                                  transition: 'background 0.2s cubic-bezier(0.16,1,0.3,1)',
                                }}
                              >
                                <span style={{
                                  position: 'absolute', top: 2, left: genieExtended ? 18 : 2,
                                  width: 18, height: 18, borderRadius: '50%',
                                  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                  transition: 'left 0.2s cubic-bezier(0.16,1,0.3,1)',
                                }} />
                              </button>
                            </div>

                            <div style={{ height: 1, background: C.border, margin: '4px 8px' }} />

                            {/* Plus de modèles row with submenu */}
                            <div style={{ position: 'relative' }}>
                              <div
                                onClick={() => setGenieSubMenuOpen(o => !o)}
                                style={{
                                  padding: '10px 14px',
                                  borderRadius: 12,
                                  cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                                  background: genieSubMenuOpen ? C.subtle : 'transparent',
                                  transition: 'background 0.15s',
                                }}
                              >
                                <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Plus de modèles</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </div>
                              {genieSubMenuOpen && (
                                <div style={{
                                  position: 'absolute',
                                  left: 'calc(100% + 2px)',
                                  top: -150,
                                  minWidth: 180,
                                  background: C.bg,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 18,
                                  padding: '6px',
                                  boxShadow: darkMode ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(0,0,0,0.10)',
                                  animation: 'ceoFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
                                }}>
                                  <div style={{ padding: '8px 14px 4px', fontSize: 12, color: C.muted }}>Démarrer une nouvelle conversation</div>
                                  {GENIE_MODELS.filter(m => m.id !== 'genie-1.1' && !m.legacy).map(m => (
                                    <div
                                      key={m.id}
                                      onClick={() => toggleModel(m.id)}
                                      style={{
                                        padding: '8px 14px',
                                        borderRadius: 10,
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                        transition: 'background 0.15s',
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = C.subtle}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <span style={{ fontSize: 14, color: C.text }}>{m.name}</span>
                                      {selectedModels.includes(m.id) && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </div>
                                  ))}
                                  <div style={{ height: 1, background: C.border, margin: '4px 8px' }} />
                                  {GENIE_MODELS.filter(m => m.legacy).map(m => (
                                    <div
                                      key={m.id}
                                      onClick={() => toggleModel(m.id)}
                                      style={{
                                        padding: '8px 14px',
                                        borderRadius: 10,
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                        transition: 'background 0.15s',
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = C.subtle}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <span style={{ fontSize: 14, color: C.text }}>{m.name}</span>
                                      {selectedModels.includes(m.id) && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {chatInput.trim() ? (
                        <button type="button" aria-label="Envoyer" style={{
                          width: 32, height: 32, borderRadius: 10,
                          border: 'none',
                          background: darkMode ? '#3a3b48' : '#b4b9c3',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#fff',
                          transition: 'background 0.15s',
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="19" x2="12" y2="5" />
                            <polyline points="5 12 12 5 19 12" />
                          </svg>
                        </button>
                      ) : (
                        <button type="button" aria-label="Voix" style={{
                          width: 32, height: 32, borderRadius: 16,
                          border: 'none', background: 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: C.text,
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="6" y1="10" x2="6" y2="14" />
                            <line x1="10" y1="6" x2="10" y2="18" />
                            <line x1="14" y1="9" x2="14" y2="15" />
                            <line x1="18" y1="11" x2="18" y2="13" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Cards — Clients (PerfClosing) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                {kpiRow2.map((kpi, i) => (
                  <CeoKpiCard
                    key={kpi.label}
                    kpi={kpi}
                    index={i}
                    dataLoading={dataLoading}
                    darkMode={darkMode}
                    C={C}
                  />
                ))}
              </div>


              {/* ── DÉLAIS MOYENS + GLOBE ── */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 28, alignItems: 'stretch' }}>
              <div className="ceo-card" style={{
                animation: 'ceoCardPop 0.4s ease 320ms both', flex: 1, minWidth: 0,
              }}>
                <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Délais Moyens</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Temps moyen entre les étapes clés</div>
                </div>
                <div style={{ padding: '2px 0' }}>
                  {[
                    { label: 'Délai Signature / RDV Lancement', count: 485, days: 14.4, color: '#10b981' },
                    { label: 'Délai 1er Contact / Signature', count: 441, days: 26.9, color: '#f59e0b' },
                    { label: 'Délai 1er contact / Audit R2', count: 490, days: 23, color: '#f59e0b' },
                    { label: 'Délai Arrivée lead / Premier contact', count: 202, days: 1, color: '#94a3b8' },
                  ].map((d, i, arr) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', padding: '10px 22px', gap: 12,
                      borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                      animation: `ceoRowIn 0.3s ease ${i * 50}ms both`,
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: darkMode ? 'rgba(91,106,191,0.12)' : 'rgba(91,106,191,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{d.label}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{d.count} clients</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums', minWidth: 50, textAlign: 'right' }}>
                          {d.days % 1 === 0 ? d.days.toFixed(0) : d.days.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 500, color: C.muted, marginLeft: 2 }}>j</span>
                        </div>
                        <div style={{ width: 44, height: 6, borderRadius: 3, background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9', overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${Math.min(100, (d.days / 60) * 100)}%`,
                            background: d.color,
                            transition: 'width 0.8s ease',
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Globe */}
              <div className="ceo-card" style={{
                animation: 'ceoCardPop 0.4s ease 400ms both',
                width: 340, flexShrink: 0, aspectRatio: '1 / 1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 8, position: 'relative',
                zIndex: globeMenuOpen ? 100 : 'auto',
              }}>
                <div ref={globeMenuRef} style={{ position: 'absolute', top: -12, right: -10, zIndex: 20 }}>
                  <img
                    src={ceo5}
                    alt=""
                    onClick={() => { setGlobeMenuOpen(o => !o); setGlobeSubMenuOpen(false); }}
                    style={{
                      width: 58, height: 55, objectFit: 'contain',
                      cursor: 'pointer',
                      transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                      transformOrigin: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  />
                  {globeMenuOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      minWidth: 220,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 18,
                      padding: 6,
                      boxShadow: darkMode ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(0,0,0,0.10)',
                      zIndex: 2000,
                      animation: 'ceoFadeIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
                    }}>
                      <div style={{ position: 'relative' }}>
                        <div
                          onClick={() => setGlobeSubMenuOpen(o => !o)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                            background: globeSubMenuOpen ? C.subtle : 'transparent',
                            transition: 'background 0.15s',
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Cabinet partenaire</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                        {globeSubMenuOpen && (
                          <div style={{
                            position: 'absolute',
                            left: 'calc(100% + 2px)',
                            top: 0,
                            minWidth: 180,
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            borderRadius: 18,
                            padding: 6,
                            boxShadow: darkMode ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(0,0,0,0.10)',
                            animation: 'ceoFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
                          }}>
                            <div
                              onClick={() => {
                                setSelectedCabinet(selectedCabinet === 'optilex' ? null : 'optilex');
                                setGlobeMenuOpen(false);
                                setGlobeSubMenuOpen(false);
                              }}
                              style={{
                                padding: '8px 14px',
                                borderRadius: 10,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = C.subtle}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{ fontSize: 14, color: C.text }}>Opti'Lex</span>
                              {selectedCabinet === 'optilex' && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <iframe
                  src="/globe.html"
                  ref={el => {
                    if (el && Object.keys(avatarMap).length > 0) {
                      el.onload = () => el.contentWindow.postMessage({ type: 'avatars', data: avatarMap }, '*');
                    }
                  }}
                  title="Globe"
                  style={{
                    width: '100%', height: '100%', border: 'none',
                    borderRadius: 12, background: 'transparent',
                    opacity: selectedCabinet === 'optilex' ? 0 : 1,
                    pointerEvents: selectedCabinet === 'optilex' ? 'none' : 'auto',
                    transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
                {selectedCabinet === 'optilex' && (
                  <div
                    ref={mapContainerRef}
                    className="ceo-optilex-map"
                    style={{
                      position: 'absolute',
                      top: 8, left: 8, right: 8, bottom: 8,
                      borderRadius: 12,
                      overflow: 'hidden',
                      animation: 'ceoFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
                    }}
                  />
                )}
              </div>

              {/* Classement Top 4 */}
              <div className="ceo-card" style={{
                animation: 'ceoCardPop 0.4s ease 480ms both',
                width: 280, flexShrink: 0, position: 'relative',
              }}>
                <img src={ceo6} alt="" style={{
                  position: 'absolute', top: -12, right: -10, width: 58, height: 55,
                  objectFit: 'contain', pointerEvents: 'none', zIndex: 10,
                }} />
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Classement</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Top commerciaux du mois</div>
                </div>
                <div style={{ padding: '6px 0' }}>
                  {(leaderboardData?.all_sellers || []).slice(0, 4).map((seller, i) => {
                    const medalSrcs = [medal1, medal2, medal3];
                    return (
                      <div key={seller.name || i} style={{
                        display: 'flex', alignItems: 'center', padding: '10px 18px', gap: 10,
                        borderBottom: i < 3 ? `1px solid ${C.border}` : 'none',
                        animation: `ceoRowIn 0.3s ease ${i * 60}ms both`,
                      }}>
                        <div style={{
                          width: 24, minWidth: 24, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {i < 3 ? (
                            <img src={medalSrcs[i]} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>4</span>
                          )}
                        </div>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          overflow: 'hidden', background: C.accent,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {seller.avatar_url ? (
                            <img src={seller.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{getInitials(seller.name)}</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {seller.name}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>
                            {seller.sales || 0} vente{(seller.sales || 0) > 1 ? 's' : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                          {seller.sales || 0}
                        </div>
                      </div>
                    );
                  })}
                  {(!leaderboardData?.all_sellers || leaderboardData.all_sellers.length === 0) && (
                    <div style={{ padding: '20px 18px', textAlign: 'center', color: C.muted, fontSize: 12 }}>
                      {dataLoading ? 'Chargement...' : 'Aucune donnée'}
                    </div>
                  )}
                </div>
              </div>
              </div>

              {/* ── MISSIONS TABLE (Work Orders — pixel-perfect) ── */}
              <div className="ceo-card" style={{
                animation: 'ceoCardPop 0.4s ease 350ms both',
              }}>
                {/* Top bar: title + tabs + filter row */}
                <div style={{ padding: '18px 22px 0' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Missions en cours</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2, marginBottom: 16 }}>Suivi des projets internes par pôle</div>
                  {/* Tab bar */}
                  <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 0 }}>
                    {[{ label: 'Active SO', count: 8 }, { label: 'Draft', count: 2 }, { label: 'All Filters', count: null }].map((tab, i) => (
                      <button key={tab.label} style={{
                        padding: '10px 18px', fontSize: 13, fontWeight: i === 0 ? 600 : 500,
                        color: i === 0 ? '#ef4444' : C.muted,
                        borderBottom: i === 0 ? '2px solid #ef4444' : '2px solid transparent',
                        background: 'transparent', border: 'none', borderBottomStyle: 'solid',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {tab.label}
                        {tab.count !== null && (
                          <span style={{
                            padding: '1px 7px', borderRadius: 50, fontSize: 10, fontWeight: 700,
                            background: i === 0 ? 'rgba(239,68,68,0.08)' : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                            color: i === 0 ? '#ef4444' : C.muted,
                          }}>{tab.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter row (dropdowns) */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 22px',
                  borderBottom: `1px solid ${C.border}`, background: darkMode ? C.subtle : '#fafbfc',
                  flexWrap: 'wrap',
                }}>
                  {['Pôle', 'Assigné à', 'Priorité', 'Date début', 'Deadline'].map(f => (
                    <button key={f} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                      borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg,
                      fontSize: 12, fontWeight: 500, color: C.secondary, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {f}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                      <tr>
                        {/* Checkbox col */}
                        <th style={{ padding: '11px 0 11px 18px', width: 36, background: darkMode ? C.subtle : '#f8f9fb', borderBottom: `1px solid ${C.border}` }}>
                          <input type="checkbox" disabled style={{ width: 14, height: 14, accentColor: C.accent, cursor: 'default' }} />
                        </th>
                        {[
                          { label: 'ID', w: 80 }, { label: 'Status' , w: 50 }, { label: 'Mission', w: null },
                          { label: 'Pôle', w: 140 }, { label: 'Assigned To', w: 180 },
                          { label: 'Priority', w: 90 }, { label: 'Deadline', w: 120 }, { label: '', w: 50 },
                        ].map(col => (
                          <th key={col.label} style={{
                            padding: '11px 14px', fontSize: 10, fontWeight: 700, color: C.muted,
                            textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left',
                            background: darkMode ? C.subtle : '#f8f9fb', borderBottom: `1px solid ${C.border}`,
                            width: col.w || 'auto', whiteSpace: 'nowrap',
                          }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                              {col.label}
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.4 }}><path d="m7 10 5-5 5 5"/><path d="m7 14 5 5 5-5"/></svg>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 'MO-1025', client: 'Refonte Dashboard CEO', sub: 'Frontend React, intégration API, design...', service: 'Tech', assignee: 'Youcef Amrane', assignee2: 'Amine Amrane', priority: 'high', status: '#ef4444', date: 'Apr 15, 2026', value: '—' },
                        { id: 'MO-1024', client: 'Campagne Ads Q2', sub: 'Créa visuels, ciblage audiences, A/B test', service: 'Marketing', assignee: 'Sarah Khelifi', assignee2: null, priority: 'medium', status: '#3b82f6', date: 'Apr 18, 2026', value: '—' },
                        { id: 'MO-1023', client: 'Migration API v2', sub: 'Endpoints auth, leads, tracking, contracts', service: 'Tech', assignee: 'Amine Amrane', assignee2: 'Youcef Amrane', priority: 'high', status: '#f59e0b', date: 'Mar 17, 2026', value: '—' },
                        { id: 'MO-1022', client: 'Recrutement Commercial', sub: null, service: 'RH', assignee: 'Lina Mansouri', assignee2: null, priority: 'low', status: '#10b981', date: 'Mar 15, 2026', value: '—' },
                        { id: 'MO-1021', client: 'Formation Closing R2', sub: null, service: 'Commercial', assignee: 'Léo Mafrici', assignee2: 'Yanis Zairi', priority: 'medium', status: '#3b82f6', date: 'Mar 19, 2026', value: '—' },
                        { id: 'MO-1020', client: 'Bilan Trimestriel Q1', sub: null, service: 'Finance', assignee: 'Julie Renaud', assignee2: null, priority: 'low', status: '#94a3b8', date: 'Mar 18, 2026', value: '—' },
                        { id: 'MO-1019', client: 'Process Onboarding Client', sub: null, service: 'Commercial', assignee: 'Yanis Zairi', assignee2: null, priority: 'medium', status: '#3b82f6', date: 'Mar 18, 2026', value: '—' },
                        { id: 'MO-1018', client: 'Optimisation Pipeline Leads', sub: null, service: 'Tech', assignee: 'Amine Amrane', assignee2: null, priority: 'high', status: '#ef4444', date: 'Mar 20, 2026', value: '—' },
                        { id: 'MO-1017', client: 'Stratégie Contenu LinkedIn', sub: null, service: 'Marketing', assignee: 'Sarah Khelifi', assignee2: null, priority: 'low', status: '#10b981', date: 'Mar 19, 2026', value: '—' },
                      ].map((row, i) => {
                        const PRIO = { high: { label: 'High', dot: '#ef4444' }, medium: { label: 'Med', dot: '#f59e0b' }, low: { label: 'Low', dot: '#10b981' } };
                        const pr = PRIO[row.priority] || PRIO.medium;
                        return (
                          <tr key={row.id + i} style={{
                            cursor: 'pointer', transition: 'background 0.12s',
                            animation: `ceoRowIn 0.25s ease ${i * 30}ms both`,
                            background: i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.008)'),
                          }}
                            onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.025)' : '#fafafb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.008)')}
                          >
                            {/* Checkbox */}
                            <td style={{ padding: '11px 0 11px 18px', borderBottom: `1px solid ${C.border}`, width: 36 }}>
                              <input type="checkbox" disabled style={{ width: 14, height: 14, accentColor: C.accent, cursor: 'default' }} />
                            </td>
                            {/* ID */}
                            <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: '#3b82f6', whiteSpace: 'nowrap' }}>{row.id}</td>
                            {/* Status dot */}
                            <td style={{ padding: '11px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: row.status }} />
                            </td>
                            {/* Client + sub */}
                            <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{row.client}</div>
                              {row.sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{row.sub}</div>}
                            </td>
                            {/* Service Tasks */}
                            <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12.5, color: C.secondary, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{row.service}</td>
                            {/* Assigned */}
                            <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ display: 'flex' }}>
                                  <div style={{
                                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                    background: darkMode ? '#3a3b46' : '#e5e7eb',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: darkMode ? '#ccc' : '#6b7280', fontSize: 9, fontWeight: 700,
                                    border: `1.5px solid ${C.bg}`, zIndex: 2,
                                  }}>{getInitials(row.assignee)}</div>
                                  {row.assignee2 && (
                                    <div style={{
                                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                      background: darkMode ? '#4a4b56' : '#d1d5db',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: darkMode ? '#bbb' : '#6b7280', fontSize: 9, fontWeight: 700,
                                      border: `1.5px solid ${C.bg}`, marginLeft: -8, zIndex: 1,
                                    }}>{getInitials(row.assignee2)}</div>
                                  )}
                                </div>
                                <span style={{ fontSize: 12, color: C.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {row.assignee.split(' ')[0]}{row.assignee2 ? `, ${row.assignee2.split(' ')[0]}` : ''}
                                </span>
                              </div>
                            </td>
                            {/* Priority */}
                            <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}` }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: C.secondary }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: pr.dot }} />
                              </span>
                            </td>
                            {/* Date */}
                            <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>{row.date}</td>
                            {/* Value */}
                            <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12.5, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>{row.value}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 22px', background: darkMode ? C.subtle : '#f8f9fb',
                  borderTop: `1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Showing 9 of 9 results</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>Items Per Page :</span>
                    <select style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: 'inherit' }}>
                      <option>10</option><option>25</option><option>50</option>
                    </select>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
                      </button>
                      <button style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: C.text, color: C.bg, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>1</button>
                      <button style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TEAM PULSE TAB ═══ */}
          {activeTab === 'team' && (
            <div style={{ animation: 'ceoFadeIn 0.35s ease both', marginTop: -68 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Team Pulse</h1>
              <p style={{ fontSize: 14, color: C.muted, margin: '0 0 28px' }}>Votre équipe à travers les fuseaux horaires</p>

              {/* Time period legend */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Sleeping', color: '#6366f1', emoji: '🌙' },
                  { label: 'Morning', color: '#f59e0b', emoji: '🌅' },
                  { label: 'Midday', color: '#10b981', emoji: '☀️' },
                  { label: 'Evening', color: '#fb923c', emoji: '🌆' },
                ].map(p => (
                  <span key={p.label} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 50, fontSize: 12, fontWeight: 600,
                    background: `${p.color}10`, color: p.color, border: `1px solid ${p.color}25`,
                  }}>{p.emoji} {p.label}</span>
                ))}
              </div>

              {/* Team members grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {MOCK_TEAM.map((member, i) => {
                  const period = getTimePeriod(member.tz);
                  const time = getTimeInTz(member.tz);
                  return (
                    <div key={member.name} className="ceo-card" style={{
                      padding: '18px 20px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `ceoCardPop 0.4s ease ${i * 60}ms both`,
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                        background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 14, fontWeight: 700,
                      }}>{getInitials(member.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 650, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{member.flag} {member.location}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{time}</div>
                        <span style={{
                          display: 'inline-block', marginTop: 4,
                          padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 700,
                          background: period.bg, color: period.color,
                        }}>{period.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ PIPELINE TAB ═══ */}
          {activeTab === 'pipeline' && (
            <div style={{ animation: 'ceoFadeIn 0.35s ease both', marginTop: -68 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Pipeline</h1>
              <p style={{ fontSize: 14, color: C.muted, margin: '0 0 28px' }}>Vue d'ensemble des leads en cours</p>

              <div className="ceo-card" style={{ animation: 'ceoCardPop 0.4s ease both' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Société', 'Contact', 'Status', 'Commercial', 'Date', 'Valeur'].map(h => (
                        <th key={h} style={{
                          padding: '14px 18px', fontSize: 10.5, fontWeight: 700, color: C.muted,
                          textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left',
                          background: darkMode ? C.subtle : '#f8f9fb', borderBottom: `1px solid ${C.border}`,
                          position: 'sticky', top: 0,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_PIPELINE.map((row, i) => {
                      const sc = STATUS_CONFIG[row.status] || STATUS_CONFIG.new;
                      return (
                        <tr key={row.id} style={{ animation: `ceoRowIn 0.3s ease ${i * 40}ms both` }}
                          onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.02)' : '#fafafb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text }}>{row.name}</td>
                          <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.secondary }}>{row.contact}</td>
                          <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                            <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color }}>{sc.label}</span>
                          </td>
                          <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text, fontWeight: 500 }}>{row.assignee}</td>
                          <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{row.date}</td>
                          <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: '#10b981' }}>{row.value}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ CLIENTS TAB ═══ */}
          {activeTab === 'clients' && (
            <div style={{ animation: 'ceoFadeIn 0.35s ease both', marginTop: -68 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Clients</h1>
              <p style={{ fontSize: 14, color: C.muted, margin: '0 0 28px' }}>Suivi post-signature</p>

              <div className="ceo-card" style={{
                padding: '40px',
                textAlign: 'center', color: C.muted, animation: 'ceoCardPop 0.4s ease both',
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <p style={{ fontSize: 14, margin: 0 }}>Vue Clients — à connecter avec PerfClosing</p>
              </div>
            </div>
          )}

          {/* ═══ CRM TAB ═══ */}
          {activeTab === 'crm' && (
            <div style={{ animation: 'ceoFadeIn 0.35s ease both', marginTop: -68 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>CRM</h1>
                  <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>{MOCK_CRM.length} Utilisateur{MOCK_CRM.length > 1 ? 's' : ''}</p>
                </div>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                  borderRadius: 10, border: 'none', background: C.text, color: C.bg,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}>
                  Ajouter un utilisateur
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>

              {/* Filter tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 500, marginRight: 4 }}>Afficher :</span>
                {['Tous', 'Commerciaux', 'Managers', 'Admins'].map((f, i) => (
                  <button key={f} style={{
                    padding: '7px 16px', borderRadius: 8, border: `1px solid ${i === 0 ? C.accent : C.border}`,
                    background: i === 0 ? `${C.accent}10` : 'transparent',
                    color: i === 0 ? C.accent : C.secondary,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}>{f}</button>
                ))}
              </div>

              {/* Table */}
              <div className="ceo-card" style={{
                animation: 'ceoCardPop 0.4s ease both',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Nom Prénom', 'Email', 'Rôle', 'Statut', 'Inscription'].map(h => (
                        <th key={h} style={{
                          padding: '14px 18px', fontSize: 10.5, fontWeight: 700, color: C.muted,
                          textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left',
                          background: darkMode ? C.subtle : '#f8f9fb', borderBottom: `1px solid ${C.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_CRM.map((u, i) => (
                      <tr key={u.id} style={{ animation: `ceoRowIn 0.3s ease ${i * 40}ms both` }}
                        onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.02)' : '#fafafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: ROLE_COLORS[u.role] + '18', color: ROLE_COLORS[u.role],
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>{getInitials(u.name)}</div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{u.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.secondary }}>{u.email}</td>
                        <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: (ROLE_COLORS[u.role] || '#9ca3af') + '12', color: ROLE_COLORS[u.role] || '#9ca3af' }}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: '#10b981' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                            Activé
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{u.joined}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ SALES TEAM TAB (CEO → Tracking Sheets individuels) ═══════════ */}
          {activeTab === 'sales_team' && (
            <div style={{ animation: 'ceoFadeIn 0.35s ease both', paddingTop: 96 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Équipe Sales</h1>
              <p style={{ fontSize: 14, color: C.muted, margin: '0 0 28px' }}>
                Accédez aux Tracking Sheets individuels — mode ghost (lecture transparente, pas de notification).
              </p>

              {salesTeamLoading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} className="ceo-card" style={{ padding: '18px 20px', height: 96, animation: `ceoCardPop 0.4s ease ${i * 60}ms both` }}>
                      <div style={{ width: '100%', height: '100%', background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 8, animation: 'ceoPulse 1.4s ease-in-out infinite' }} />
                    </div>
                  ))}
                </div>
              )}

              {!salesTeamLoading && salesTeamUsers.length === 0 && (
                <div className="ceo-card" style={{ padding: 40, textAlign: 'center', color: C.muted, animation: 'ceoCardPop 0.4s ease both' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  <p style={{ fontSize: 14, margin: 0 }}>Aucun commercial trouvé.</p>
                </div>
              )}

              {!salesTeamLoading && salesTeamUsers.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {salesTeamUsers.map((u, i) => {
                    const name = u.full_name || u.name || u.email;
                    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#fb923c'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={u.email || u.id} className="ceo-card" style={{
                        padding: '18px 20px',
                        display: 'flex', flexDirection: 'column', gap: 14,
                        animation: `ceoCardPop 0.4s ease ${i * 60}ms both`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                            background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 14, fontWeight: 700,
                          }}>{getInitials(name)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 650, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                            <div style={{ fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/ceo/sheet/${encodeURIComponent(u.email)}?ghost=true`)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '9px 14px', borderRadius: 10,
                            border: `1px solid ${C.border}`,
                            background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                            color: C.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = C.accent; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'; e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.border; }}
                        >
                          Voir tracking sheet
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SIDEBAR (Notion-style — pattern miroir TrackingSheetFinance/index.jsx l.583).
// Dupliqué localement (Option B) plutôt qu'extrait en shared : TSF utilise
// palette fixe Notion + classes CSS scopées + assets locaux ; un refactor
// aurait été risqué (sacred-ish zone "modifiable avec prudence"). Si un 3e
// usage apparaît, extraire en `src/components/shared/Sidebar/`.
// Différence avec TSF : palette dynamique via `C = getColors(darkMode)` pour
// suivre le dark mode du CEO Dashboard (TSF est blanc fixe).
// ════════════════════════════════════════════════════════════════════════════
export function CeoSidebar({ width, collapsed, onToggle, sections, activeTab, setActiveTab, C, darkMode }) {
  return (
    <motion.aside
      className="ceo-side"
      animate={{ width }}
      initial={false}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={{
        flexShrink: 0,
        background: C.bg,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <CeoWorkspaceHeader collapsed={collapsed} C={C} />
        <CeoIconRow collapsed={collapsed} C={C} />
      </div>

      <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0' }} className="ceo-side-scroll">
        {sections.map((sec) => (
          <CeoSidebarSection
            key={sec.key}
            section={sec}
            collapsed={collapsed}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            C={C}
            darkMode={darkMode}
          />
        ))}
      </nav>

      <div style={{ flexShrink: 0 }}>
        <CeoSidebarFooter collapsed={collapsed} onToggle={onToggle} C={C} />
      </div>
    </motion.aside>
  );
}

function CeoWorkspaceHeader({ collapsed, C }) {
  return (
    <div style={{
      padding: collapsed ? '10px 8px' : '10px 8px 6px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 6,
    }}>
      <button
        className="ceo-icon-btn"
        style={{
          flex: 1,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 6px',
          borderRadius: 4,
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
          minWidth: 0,
        }}
      >
        <span style={{
          width: 22, height: 22, flexShrink: 0,
          borderRadius: 4,
          background: '#fff',
          border: `1px solid ${C.border}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img src={companyLogo} alt="Owner" style={{ width: 18, height: 18, objectFit: 'contain' }} />
        </span>
        {!collapsed && (
          <>
            <span style={{
              fontSize: 14, fontWeight: 600, color: C.text,
              letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Owner Technology
            </span>
            <ChevronDown size={14} style={{ color: C.muted, flexShrink: 0, marginLeft: 'auto' }} />
          </>
        )}
      </button>
    </div>
  );
}

function CeoIconRow({ collapsed, C }) {
  const items = [
    { key: 'home',   icon: <Home size={16} />,          label: 'Accueil' },
    { key: 'inbox',  icon: <MessageSquare size={16} />, label: 'Discussions' },
    { key: 'mail',   icon: <Mail size={16} />,          label: 'Boîte de réception' },
    { key: 'search', icon: <Search size={16} />,        label: 'Recherche' },
  ];
  return (
    <div style={{
      display: collapsed ? 'flex' : 'grid',
      flexDirection: collapsed ? 'column' : undefined,
      gridTemplateColumns: collapsed ? undefined : 'repeat(4, 1fr)',
      gap: 2,
      padding: collapsed ? '4px 8px 8px' : '0 8px 6px',
    }}>
      {items.map((it) => (
        <button
          key={it.key}
          className="ceo-icon-btn"
          title={it.label}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 8,
            padding: '6px 0',
            borderRadius: 4,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: C.muted, fontFamily: 'inherit',
          }}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}

function CeoSidebarSection({ section, collapsed, activeTab, setActiveTab, C, darkMode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ padding: collapsed ? '4px 6px' : '4px 8px' }}>
      {!collapsed && (
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 6px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'inherit',
            color: C.muted,
            fontSize: 12, fontWeight: 600,
            letterSpacing: '0.01em',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f4'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <ChevronDown
            size={12}
            style={{
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s ease',
              color: C.muted,
            }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {section.label}
          </span>
        </button>
      )}

      <AnimatePresence initial={false}>
        {(open || collapsed) && (
          <motion.div
            key="items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
              {section.items.map((item) => (
                <CeoSidebarItem
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  active={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                  C={C}
                  darkMode={darkMode}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CeoSidebarItem({ item, collapsed, active, onClick, C, darkMode }) {
  return (
    <button
      className="ceo-side-item"
      title={collapsed ? item.label : undefined}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: collapsed ? '6px 0' : '4px 6px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        border: 'none',
        background: active ? (darkMode ? 'rgba(255,255,255,0.08)' : '#eeeeec') : 'transparent',
        cursor: 'pointer',
        borderRadius: 4,
        fontFamily: 'inherit',
        color: C.text,
        fontSize: 14,
        textAlign: 'left',
        width: '100%',
        minWidth: 0,
      }}
    >
      <span style={{
        width: 20, height: 20, flexShrink: 0, borderRadius: 4,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: active ? C.text : C.muted,
      }}>
        {item.icon}
      </span>
      {!collapsed && (
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: active ? 500 : 400,
          color: C.text,
          flex: 1,
        }}>
          {item.label}
        </span>
      )}
    </button>
  );
}

function CeoSidebarFooter({ collapsed, onToggle, C }) {
  return (
    <div style={{
      borderTop: `1px solid ${C.border}`,
      padding: collapsed ? '6px 6px' : '6px 8px',
      display: 'flex',
      flexDirection: collapsed ? 'column' : 'row',
      alignItems: 'center',
      gap: 6,
    }}>
      {!collapsed && (
        <button
          className="ceo-side-item"
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            borderRadius: 4,
            fontFamily: 'inherit',
            color: C.text,
            fontSize: 13,
            textAlign: 'left',
            minWidth: 0,
          }}
        >
          <Sparkles size={14} style={{ color: C.muted }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Nouvelle discussion
          </span>
          <span style={{
            fontSize: 11, color: C.muted,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 3,
            padding: '0 4px',
            fontFamily: 'inherit',
          }}>
            ⌘O
          </span>
        </button>
      )}

      <button
        onClick={onToggle}
        title={collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
        className="ceo-icon-btn"
        style={{
          width: 28, height: 28,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'pointer',
          borderRadius: 4,
          color: C.muted,
        }}
      >
        <PanelLeft size={15} />
      </button>
    </div>
  );
}
