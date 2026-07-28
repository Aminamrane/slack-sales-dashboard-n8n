import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { setNavScope } from "../utils/sidebarPermissions";
import Sidebar from "../components/shared/Sidebar";
import ceo5 from "../assets/ceo5.svg";
import medal1 from "../assets/1st-place.png";
import medal2 from "../assets/2st-place.png";
import medal3 from "../assets/3st-place.png";
import ceo6 from "../assets/ceo6.svg";
import {
  displayEtat, isOnboardingUpcoming, isIntegrationUpcoming, isIntegrationOverdue,
  meteoBandOf, METEO_BANDS,
} from "./OptilexBoard.jsx";
import SharedNavbar from "../components/SharedNavbar.jsx";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import testLottie from "../assets/test.lottie?url";
import {
  ChevronDown, Home, MessageSquare, Mail, Search, PanelLeft, Sparkles,
  // Glyphes des cartes d'états : un pictogramme qui PORTE le sens du KPI,
  // à la place des anciennes pastilles de couleur.
  Users, CircleCheck, Cloud, CalendarClock, Rocket, UserRoundX, RotateCcw, Ellipsis,
} from "lucide-react";
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
  { key: 'conges', label: 'Absence', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  )},
  { key: 'variables', label: 'Variables Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
  )},
  { section: 'ACQUISITION' },
  { key: 'perf_sales', label: 'Perf Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  )},
  { key: 'lead_quality', label: 'Qualité Leads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
  )},
  { key: 'leaderboard', label: 'Leaderboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  )},
  { key: 'sales_team', label: 'Équipe Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  { key: 'webinar', label: 'Webinaire', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
  )},
  { key: 'funnel_leads', label: 'Funnel Leads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
  )},
  { key: 'autoassign', label: 'Auto-affectation', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  )},
  { key: 'sequences', label: 'Séquences email', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
  )},
  { section: 'FINANCE' },
  { key: 'perf_closing', label: 'Perf.Closing', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  )},
  { key: 'coordonnees', label: 'Coordonnées', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  { key: 'dispatch', label: 'Dispatch', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  )},
  { key: 'campaigns', label: 'Campagnes', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
  )},
  { section: 'PRODUIT' },
  { key: 'optilex_board', label: "Board Owner/Opti'Lex", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
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

const MONTH_LABELS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ── ÉTATS : périmètre temporel ────────────────────────────────────────────
// Dernier jour du mois d'une clé 'YYYY-MM', en ISO court : les dates du board
// sont comparées en chaînes (YYYY-MM-DD), indépendamment du fuseau du client.
const periodEndISO = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const dateOnly = (v) => (v ? String(v).slice(0, 10) : null);
// États de SORTIE : c'est leur `etat_date` qui date le mouvement, et c'est ce
// qui permet de savoir qu'un client aujourd'hui parti était actif avant.
const BOARD_TERMINAL_ETATS = new Set(['Résiliation', 'Rétractation', 'Self-Résiliation', 'Liquidation']);
// Dégradé du chiffre, par bande du board. Deux tons de la même teinte : le
// chiffre reste lisible, le dégradé ne fait que lui donner du relief.
const METEO_VALUE_GRADIENT = {
  rouge:  ['#dc2626', '#f2614f'],
  orange: ['#d97706', '#f0a53a'],
  vert:   ['#15a34a', '#3fce85'],
};
// Formulation de la moyenne. On n'affirme ("Clients satisfaits") que loin des
// frontières de bande ; près d'une frontière on nuance ("Plutôt satisfaits"),
// parce qu'un dixième de point ferait alors basculer le verdict.
const meteoWording = (avg) => {
  if (avg >= 4.3) return 'Clients satisfaits';
  if (avg >= 3.6) return 'Plutôt satisfaits';
  if (avg >= 2.6) return 'Clients mécontents';
  if (avg >= 2.0) return 'Plutôt critiques';
  return 'Situation critique';
};


// € arrondi à l'entier, séparateur de milliers garanti (format FR).
// Déterministe : on n'utilise pas Intl currency (le séparateur de milliers ICU
// est parfois absent selon le runtime -> "201946 €"). On groupe les milliers à
// la main, puis on suffixe le symbole euro. Espaces insecables ecrits en \u00A0
// pour une source propre (pas d'"irregular whitespace").
const fmtEuro0 = (n) => {
  const v = Math.round(Number(n) || 0);
  const grouped = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${v < 0 ? '-' : ''}${grouped}\u00A0€`;
};
// Pourcentage FR. Le `pct` du snapshot est TOUJOURS un ratio 0-1 (confirmé :
// 0.7182 = 71,8 %). Conversion déterministe *100, 1 décimale max.
const fmtPct = (v) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  const pct = Number(v) * 100;
  return `${pct.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}\u00A0%`;
};


// Sélectionne le mois "cash" à afficher : le mois courant (YYYY-MM) s'il existe
// dans le tableau et porte des valeurs, sinon le mois le plus récent non vide.
function pickCashMonth(months, currentKey) {
  if (!Array.isArray(months) || months.length === 0) return null;
  const hasValue = (m) => (m?.montant_attendu?.total || 0) > 0
    || (m?.montant_recupere?.total || 0) > 0
    || (m?.retard?.total || 0) > 0;
  const current = months.find((m) => m?.month === currentKey);
  if (current && hasValue(current)) return current;
  // Le plus récent non vide (months supposé chronologique ; on reparcourt en fin).
  const sorted = [...months].sort((a, z) => (z?.month || '').localeCompare(a?.month || ''));
  return sorted.find(hasValue) || sorted[0] || current || null;
}

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
  // Survol suivi séparément de `isOpen` : celui-ci ne s'ouvre que s'il y a un
  // tooltip, alors que l'illustration réagit au survol dans tous les cas.
  const [hovered, setHovered] = useState(false);
  const Icon = kpi.Icon;
  const Artwork = kpi.Artwork;
  // Lectures alternées (ex. résiliés : total puis mois courant). Au survol on
  // revient sur la première, celle qui porte le titre de la carte.
  const readings = Array.isArray(kpi.readings) && kpi.readings.length > 1 ? kpi.readings : null;
  const [reading, setReading] = useState(0);
  useEffect(() => {
    if (!readings || hovered) return undefined;
    const id = setInterval(() => setReading((r) => (r + 1) % readings.length), 6000);
    return () => clearInterval(id);
  }, [readings, hovered]);
  const shownIndex = readings ? (hovered ? 0 : reading % readings.length) : 0;
  const shown = readings ? readings[shownIndex] : { value: kpi.value, sub: kpi.sub };
  const isLoading = kpi.loading ?? dataLoading;
  // Le chiffre est ce qu'on vient chercher sur ces cartes : il domine.
  const valueSize = kpi.valueSize ?? 36;
  const readingWindowH = Math.round(valueSize * 1.08) + 34;

  const renderReading = (r) => (
    <>
      <div style={{
        fontSize: valueSize, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08,
        ...(kpi.valueGradient && !isLoading ? {
          width: 'fit-content',
          background: `linear-gradient(135deg, ${kpi.valueGradient[0]} 0%, ${kpi.valueGradient[1]} 100%)`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          WebkitTextFillColor: 'transparent', color: 'transparent',
        } : { color: '#212121' }),
      }}>
        {isLoading ? <span style={{ animation: 'ceoPulse 1.2s ease infinite' }}>—</span> : r.value}
      </div>
      {/* En pastille quand la carte porte une courbe : posé à plat sur le
          dégradé, ce texte se perdait. Avec son propre fond, il se lit
          toujours et il redevient une information, pas une légende. */}
      {kpi.subChip ? (
        <div style={{
          // marginLeft négatif = le TEXTE de la pastille s'aligne sur le chiffre,
          // pas son fond. Sinon la pastille paraît décalée d'un cran vers la droite.
          marginTop: 8, marginLeft: -9, maxWidth: '100%',
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 9px', borderRadius: 999,
          // Neutre ardoise plutôt que la teinte de la carte : sur une courbe
          // rouge, une pastille rouge se fond dans son propre fond.
          background: '#EBEEF3', color: '#3C4457',
          fontSize: 11.5, fontWeight: 700, letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }} title={r.sub}>{r.sub}</div>
      ) : (
        <div style={{
          marginTop: 6, fontSize: 12, fontWeight: 500, color: C.muted,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }} title={r.sub}>{r.sub}</div>
      )}
    </>
  );

  const open = () => hasTooltip && setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <div
      ref={anchorRef}
      className={`ceo-card${kpi.cardClass ? ` ${kpi.cardClass}` : ''}${hasTooltip ? ' ceo-kpi-has-tooltip' : ''}`}
      style={{
        // Compact : ces cartes portent un libellé, un nombre et une ligne de
        // contexte — elles n'ont pas à occuper le tiers de la largeur. Avec une
        // courbe, on rend du talon au texte pour qu'il ne tombe pas dans le pic.
        padding: kpi.spark ? '16px 18px 30px' : '16px 18px 14px',
        animation: `ceoCardPop 0.4s ease ${index * 80}ms both`,
        position: 'relative',
        minWidth: 0,
      }}
      tabIndex={hasTooltip ? 0 : undefined}
      aria-describedby={isOpen ? tooltipId : undefined}
      onMouseEnter={() => { setHovered(true); open(); }}
      onMouseLeave={() => { setHovered(false); close(); }}
      onFocus={() => { setHovered(true); open(); }}
      onBlur={() => { setHovered(false); close(); }}
    >
      {/* Illustration en grand à droite : réservée à la météo, dont le dessin
          EST la valeur (façon widget météo). Les autres cartes gardent leur
          glyphe discret dans le libellé. */}
      {kpi.spark && <CardSparkline values={kpi.spark.values} color={kpi.color} />}
      {Artwork && (
        <div aria-hidden="true" style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', pointerEvents: 'none',
        }}>
          <Artwork hovered={hovered} />
        </div>
      )}
      {/* Quand il y a une illustration, le texte réserve sa place et s'ellipse
          avant de passer dessous. */}
      <div style={{ paddingRight: Artwork ? 70 : 0, minWidth: 0, position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, minWidth: 0,
        }}>
          {Icon && !Artwork && (
            <Icon size={14} strokeWidth={2.2} color={kpi.color} style={{ flexShrink: 0 }} aria-hidden="true" />
          )}
          <span style={{
            fontSize: 12, color: C.muted, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{kpi.label}</span>
        </div>
        {/* `kpi.loading` : chargement PROPRE à la carte (source distincte du
            bloc principal, ex. le board Owner/Opti'Lex). Défaut = dataLoading.
            `kpi.valueGradient` : chiffre en dégradé (météo) — désactivé pendant
            le chargement, un tiret en remplissage transparent serait invisible. */}
        {readings ? (
          // Les deux lectures coexistent le temps du passage : l'ancienne monte
          // et sort du cadre pendant que la nouvelle arrive par le bas. Le cadre
          // est masqué, donc on voit un mouvement continu et non une apparition.
          // La fenêtre masque le débordement vertical, mais `overflow: hidden`
          // rogne aussi les côtés : la pastille, décalée de 9 px à gauche pour
          // aligner son texte, s'y faisait couper. On élargit donc la fenêtre de
          // READING_GUTTER en marge négative — la découpe s'écarte d'autant.
          // Les lectures sont en position absolue, donc calées sur la boîte de
          // PADDING : elles doivent reprendre cette même valeur en `left`/`right`
          // pour retomber exactement où elles étaient. Sans ça, tout le contenu
          // glisse vers la gauche et la pastille sort de la carte.
          <div style={{
            position: 'relative', height: readingWindowH, overflow: 'hidden',
            marginLeft: -READING_GUTTER, marginRight: -READING_GUTTER,
          }}>
            <AnimatePresence initial={false}>
              <motion.div
                key={shownIndex}
                variants={READING_SLIDE}
                initial="initial"
                animate="enter"
                exit="exit"
                style={{ position: 'absolute', left: READING_GUTTER, right: READING_GUTTER, top: 0 }}
              >
                {renderReading(shown)}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : renderReading(shown)}
      </div>

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
// CASH CARD ICONS — un badge SVG par carte du bandeau Cash. L'icône hérite la
// couleur d'accent de sa carte via `currentColor` (badge `color: <accent>`),
// donc lisible en dark mode comme en light (l'accent reste vif sur fond sombre).
// ══════════════════════════════════════════════════════════════════════════
const CASH_CARD_ICONS = {
  // 1 — Taux de récupération (vert)
  recovery: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20.8 4.8l-.2 3.3-3.3-.2" />
      <path d="M14 9.7a3.2 3.2 0 1 0 0 4.6" />
      <path d="M8.7 11.3h4.3M8.7 12.9h3.7" />
    </svg>
  ),
  // 2 — Récupéré / Attendu (ardoise)
  collected: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v0" />
      <rect x="3" y="8" width="18" height="12" rx="2.5" />
      <path d="M21 12.6h-3.4a1.7 1.7 0 0 0 0 3.4H21" />
      <circle cx="17.4" cy="14.3" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  ),
  // 3 — Cash en retard (orange)
  late: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="13.5" r="6.7" />
      <path d="M13 11a3 3 0 1 0 0 5" />
      <path d="M8 12.7h3.4M8 14.2h3" />
      <circle cx="18.2" cy="6.8" r="3.6" />
      <path d="M18.2 5.2V6.8l1.2 0.9" />
    </svg>
  ),
  // 4 — Créances antérieures (rouge)
  receivables: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 10.5V8l-5-5H7a2 2 0 0 0-2 2v6" />
      <path d="M14 3v5h5" />
      <path d="M8.5 7.5h2.5" />
      <path d="M16.5 21a4.2 4.2 0 1 0-3.7-6.2" />
      <path d="M12.3 12.4v2.6h2.6" />
    </svg>
  ),
};

// Badge icône carré arrondi (≈34px), fond = accent à ~10%, icône 22px en accent.
// Positionné en haut-droite de la carte (.ceo-card est position: relative).
// NB : .ceo-card a un fond clair FIXE (gradient ::after, indépendant du dark
// mode), donc l'accent reste lisible en light comme en dark — pas de variante
// de fond nécessaire ici.
function CashCardIcon({ icon, accent }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', top: 16, right: 16,
        width: 34, height: 34, borderRadius: 11,
        background: `${accent}1a`, // accent à ~10% d'opacité (hex alpha 0x1a)
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, flexShrink: 0, pointerEvents: 'none',
      }}
    >
      <span style={{ width: 22, height: 22, display: 'flex' }}>
        {React.cloneElement(icon, { width: 22, height: 22 })}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CEO CASH BANNER — bandeau "cash du mois courant" au-dessus des cartes états.
// Vue fiscaliste-CEO : le cash d'abord, le risque (retard / créances) en avant.
// 4 blocs : taux de récup • récupéré/attendu • cash en retard • créances
// antérieures. Chaque montant € porte son split Owner / Optilex.
// `month` = un élément de snapshot.months (ou null → état "—" propre, no crash).
// ══════════════════════════════════════════════════════════════════════════
// `months` = snapshot.months complet, `defaultMonthKey` = mois à afficher au
// montage (mois courant si présent+non vide, sinon plus récent non vide). Le
// sélecteur de mois ne pilote QUE ce bandeau ; les cartes d'états (instantané
// "maintenant") ne sont jamais affectées.
function CeoCashBanner({ months, defaultMonthKey, dataLoading, darkMode, C }) {
  const list = Array.isArray(months) ? months : [];
  // Mois sélectionné (state local au bandeau). Resync si le défaut change
  // (ex : snapshot arrive après le 1er render avec months=[]).
  const [selectedKey, setSelectedKey] = useState(defaultMonthKey);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => { setSelectedKey(defaultMonthKey); }, [defaultMonthKey]);
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const onClick = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [pickerOpen]);

  const month = list.find((m) => m?.month === selectedKey) || null;
  const empty = !month;

  const recPct = month?.montant_recupere?.pct;
  const recTotal = month?.montant_recupere?.total ?? 0;
  const attTotal = month?.montant_attendu?.total ?? 0;
  const recOwner = month?.montant_recupere?.owner ?? 0;
  const recOptilex = month?.montant_recupere?.optilex ?? 0;
  const retardTotal = month?.retard?.total ?? 0;
  const retardOwner = month?.retard?.owner ?? 0;
  const retardOptilex = month?.retard?.optilex ?? 0;
  const prec = month?.retard_prec?.total ?? 0;
  const recupCreancesPct = month?.recup_creances?.pct;
  const recupCreancesTotal = month?.recup_creances?.total ?? 0;

  // Décomposition exacte du retard.total (formule sheet par client) :
  //   retard.total = monthGap + oldDebt
  //   monthGap = montant_attendu.total − montant_recupere.total  (impayé du mois)
  //   oldDebt  = retard_prec.total      − recup_creances.total   (reste antérieur)
  const monthGap = attTotal - recTotal;
  const oldDebt = prec - recupCreancesTotal;

  // Mini-ligne split Owner / Optilex sous un montant principal.
  const Split = ({ owner, optilex }) => (
    <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, fontWeight: 600 }}>
      <span style={{ color: C.muted }}>
        Owner <span style={{ color: '#1e2330', fontVariantNumeric: 'tabular-nums' }}>{empty ? '—' : fmtEuro0(owner)}</span>
      </span>
      <span style={{ color: C.muted }}>
        Optilex <span style={{ color: '#1e2330', fontVariantNumeric: 'tabular-nums' }}>{empty ? '—' : fmtEuro0(optilex)}</span>
      </span>
    </div>
  );

  const monthLabel = month?.label || (empty ? 'Aucune donnée' : (month?.month ?? '—'));

  return (
    <div style={{ marginBottom: 28 }}>
      {/* En-tête : titre + mois PROÉMINENT + sélecteur de mois (pilote ce bandeau) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingLeft: 2 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
          Cash
        </h2>
        <div ref={pickerRef} style={{ position: 'relative' }}>
          <button
            type="button"
            disabled={list.length === 0}
            onClick={() => setPickerOpen((o) => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px 7px 14px', borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: pickerOpen ? (darkMode ? '#2a2b36' : '#f4f6fb') : C.bg,
              cursor: list.length === 0 ? 'default' : 'pointer',
              color: C.text, fontFamily: 'inherit',
              fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
              boxShadow: darkMode ? '0 1px 2px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
          >
            <span style={{ textTransform: 'capitalize' }}>{monthLabel}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {pickerOpen && list.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 3000,
              minWidth: 180, maxHeight: 300, overflowY: 'auto',
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 6,
              boxShadow: darkMode ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(15,23,42,0.12)',
              animation: 'ceoFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
            }}
            className="ceo-scroll"
            >
              {list.map((m) => {
                const active = m.month === selectedKey;
                return (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => { setSelectedKey(m.month); setPickerOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none',
                      background: active ? (darkMode ? 'rgba(124,138,219,0.18)' : 'rgba(91,106,191,0.10)') : 'transparent',
                      color: active ? C.accent : C.text,
                      fontFamily: 'inherit', fontSize: 13.5, fontWeight: active ? 700 : 500,
                      cursor: 'pointer', textAlign: 'left', textTransform: 'capitalize',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f4'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span>{m.label || m.month}</span>
                    {active && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {/* 1 — Taux de récupération (la mesure clé du cash rentré) */}
        <div className="ceo-card" style={{ padding: '20px 22px 18px', animation: 'ceoCardPop 0.4s ease 0ms both' }}>
          <CashCardIcon icon={CASH_CARD_ICONS.recovery} accent="#10b981" />
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8 }}>Taux de récupération</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#10b981', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {dataLoading ? <span style={{ animation: 'ceoPulse 1.2s ease infinite' }}>—</span> : (empty ? '—' : fmtPct(recPct))}
          </div>
          {/* Barre de progression du taux (pct = ratio 0-1 → *100) */}
          <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: darkMode ? 'rgba(255,255,255,0.06)' : '#eef0f4', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3, background: '#10b981',
              width: empty ? '0%' : `${Math.min(100, Math.max(0, (Number(recPct) || 0) * 100))}%`,
              transition: 'width 0.8s ease',
            }} />
          </div>
        </div>

        {/* 2 — Récupéré / Attendu en € + split */}
        <div className="ceo-card" style={{ padding: '20px 22px 18px', animation: 'ceoCardPop 0.4s ease 80ms both' }}>
          <CashCardIcon icon={CASH_CARD_ICONS.collected} accent="#475569" />
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8 }}>Récupéré / Attendu</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#212121', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {dataLoading ? <span style={{ animation: 'ceoPulse 1.2s ease infinite' }}>—</span> : (empty ? '—' : fmtEuro0(recTotal))}
            <span style={{ fontSize: 14, fontWeight: 600, color: C.muted }}> / {empty ? '—' : fmtEuro0(attTotal)}</span>
          </div>
          <Split owner={recOwner} optilex={recOptilex} />
        </div>

        {/* 3 — Cash en retard : GLOBAL = total dû à ce jour (mois précédents inclus). */}
        <div className="ceo-card" style={{ padding: '20px 22px 18px', animation: 'ceoCardPop 0.4s ease 160ms both' }}>
          <CashCardIcon icon={CASH_CARD_ICONS.late} accent="#f59e0b" />
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 2 }}>Cash en retard</div>
          <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 500, marginBottom: 8, opacity: 0.85 }}>Total dû à ce jour (global)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f97316', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {dataLoading ? <span style={{ animation: 'ceoPulse 1.2s ease infinite' }}>—</span> : (empty ? '—' : fmtEuro0(retardTotal))}
          </div>
          {/* Décomposition : impayé du mois + reste antérieur (== total au rounding) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 11, fontWeight: 600 }}>
            <span style={{ color: C.muted }}>
              Mois courant <span style={{ color: '#1e2330', fontVariantNumeric: 'tabular-nums' }}>{empty ? '—' : fmtEuro0(monthGap)}</span>
            </span>
            <span style={{ color: C.muted }}>
              Antérieur <span style={{ color: '#1e2330', fontVariantNumeric: 'tabular-nums' }}>{empty ? '—' : fmtEuro0(oldDebt)}</span>
            </span>
          </div>
          <Split owner={retardOwner} optilex={retardOptilex} />
        </div>

        {/* 4 — Créances antérieures + taux de récup créances */}
        <div className="ceo-card" style={{ padding: '20px 22px 18px', animation: 'ceoCardPop 0.4s ease 240ms both' }}>
          <CashCardIcon icon={CASH_CARD_ICONS.receivables} accent="#ef4444" />
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8 }}>Créances antérieures</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {dataLoading ? <span style={{ animation: 'ceoPulse 1.2s ease infinite' }}>—</span> : (empty ? '—' : fmtEuro0(prec))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: C.muted }}>
            Récup. créances{' '}
            <span style={{ color: '#10b981' }}>{empty ? '—' : fmtPct(recupCreancesPct)}</span>
            {' · '}
            <span style={{ color: '#1e2330', fontVariantNumeric: 'tabular-nums' }}>{empty ? '—' : fmtEuro0(recupCreancesTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MÉTÉO ANIMÉE — même dessin que `MeteoIcon` du board (orage → grand soleil),
// mais découpé en groupes pour que chaque élément vive : les rayons tournent,
// les nuages dérivent, la pluie tombe, l'éclair claque. Le board garde sa
// version statique 16 px ; ici on est en 54 px, à l'échelle d'un widget météo.
// Les keyframes `ceoMeteo*` sont injectées avec le reste du CSS de la page et
// coupées sous `prefers-reduced-motion`.
// ══════════════════════════════════════════════════════════════════════════
function AnimatedMeteoIcon({ score, size = 54, color, strokeWidth = 1.6 }) {
  const stroke = {
    fill: 'none', stroke: color, strokeWidth,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  const svg = (children) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
      <g {...stroke}>{children}</g>
    </svg>
  );

  switch (score) {
    case 5: // grand soleil — les rayons tournent, le disque respire
      return svg(<>
        <g className="ceo-meteo-spin">
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </g>
        <circle className="ceo-meteo-breathe" cx="12" cy="12" r="4" />
      </>);
    case 4: // éclaircie — rayons qui scintillent, nuage qui dérive
      return svg(<>
        <g className="ceo-meteo-twinkle">
          <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41" />
        </g>
        <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
        <g className="ceo-meteo-drift">
          <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
        </g>
      </>);
    case 3: // nuageux — dérive seule
      return svg(
        <g className="ceo-meteo-drift">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </g>,
      );
    case 2: // pluie — nuage qui dérive, trois gouttes décalées
      return svg(<>
        <g className="ceo-meteo-drift">
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
        </g>
        <path className="ceo-meteo-rain" style={{ animationDelay: '0ms' }} d="M8 14v5" />
        <path className="ceo-meteo-rain" style={{ animationDelay: '260ms' }} d="M12 16v5" />
        <path className="ceo-meteo-rain" style={{ animationDelay: '520ms' }} d="M16 14v5" />
      </>);
    case 1: // orage — nuage lourd, éclair qui claque
      return svg(<>
        <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" />
        <path className="ceo-meteo-flash" d="m13 12-3 5h4l-3 5" />
      </>);
    default:
      return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MOTION DES LECTURES ALTERNÉES — le chiffre ne se contente pas d'apparaître :
// il arrive par le bas, dépasse légèrement sa position puis se pose (ressort
// sous-amorti), et le sous-titre le suit 70 ms plus tard. Les sorties, elles,
// sont sèches et rapides : on ne fait pas rebondir ce qui s'en va, et une
// sortie lente donne l'impression d'une interface qui traîne.
// ══════════════════════════════════════════════════════════════════════════
// Défilement dans une fenêtre masquée, à PLEINE OPACITÉ : la lecture qui part
// sort par le haut, celle qui arrive entre par le bas. C'est le mouvement qui
// raconte le changement. Un fondu, lui, fait disparaître l'élément au milieu de
// sa course — il « sort de nulle part » et on ne lit plus rien.
// Ressort volontairement peu bondissant (amortissement 26) : sur un chiffre
// qu'on doit lire, le dépassement se sent, il ne se voit pas.
// Débord latéral toléré par la fenêtre des lectures : la pastille recule de
// 9 px pour aligner son texte sur le chiffre, il faut de la marge au-delà.
const READING_GUTTER = 14;
const READING_SLIDE = {
  initial: { y: '112%' },
  enter: { y: '0%', transition: { type: 'spring', stiffness: 300, damping: 26, mass: 0.9 } },
  exit: { y: '-112%', transition: { type: 'spring', stiffness: 300, damping: 30, mass: 0.9 } },
};

// ══════════════════════════════════════════════════════════════════════════
// SPARKLINE — courbe d'aire calée en bas de carte, derrière le texte. Elle
// donne la tendance, jamais un chiffre : pas d'axe, pas de valeur lisible.
// Lissage Catmull-Rom → Bézier : sur 12 points mensuels, une ligne brisée
// ferait graphique de secours, une courbe lissée fait signal.
// ══════════════════════════════════════════════════════════════════════════
const SPARK_W = 320;
const SPARK_H = 100;
// Hauteur réelle de la courbe dans la carte, partagée avec le calque du repère.
const SPARK_BOX = 112;

function sparkPaths(values) {
  if (!Array.isArray(values) || values.length < 2) return { line: '', area: '' };
  const max = Math.max(...values, 1);
  const pad = 8;
  // Épaulements plats aux deux bords : sans eux, le dernier mois tombe pile sur
  // l'arrondi de la carte et la courbe se fait trancher en pleine pente — on
  // croit à un accident de découpe. Là, elle se pose avant de sortir du cadre.
  const tail = SPARK_W * 0.055;
  const step = (SPARK_W - tail * 2) / Math.max(values.length - 1, 1);
  const y = (v) => SPARK_H - pad - (v / max) * (SPARK_H - pad * 2);
  const pts = values.map((v, i) => [tail + i * step, y(v)]);
  let line = `M 0 ${pts[0][1].toFixed(1)} L ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    line += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  line += ` L ${SPARK_W} ${pts[pts.length - 1][1].toFixed(1)}`;
  return { line, area: `${line} L ${SPARK_W} ${SPARK_H} L 0 ${SPARK_H} Z` };
}

function CardSparkline({ values, color, height = SPARK_BOX }) {
  const { line, area } = useMemo(() => sparkPaths(values), [values]);
  if (!values || values.length < 2) return null;
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height,
      borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
      overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
    }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
        {/* Aplat, pas de dégradé : une aire qui se dissout vers le bas donne une
            tache, pas une surface. Ici l'aire tient jusqu'au bas de la carte. */}
        <path d={area} fill={color} fillOpacity="0.13" />
        {/* vectorEffect : l'étirement horizontal du viewBox ne doit pas
            écraser l'épaisseur du trait. */}
        <path
          className="ceo-spark-line"
          d={line}
          fill="none"
          stroke={color}
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// Défilé météo : au repos les 5 temps s'enchaînent en fondu (grand soleil →
// orage), au survol de la carte on s'arrête sur la note réelle du parc. Le bleu
// est fixe : `.ceo-card` a un fond clair indépendant du thème, une seule teinte
// suffit. On ne colore PAS par bande ici — la couleur dirait le temps affiché,
// pas la note, et induirait en erreur pendant le défilé.
const METEO_BLUE = '#3b82f6';
const METEO_SHOWCASE_ORDER = [5, 4, 3, 2, 1];
const METEO_SHOWCASE_MS = 3200;

function MeteoShowcase({ realScore, hovered, size = 54 }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (hovered) return undefined;   // survol = on fige, le défilé reprend après
    const id = setInterval(
      () => setStep((s) => (s + 1) % METEO_SHOWCASE_ORDER.length),
      METEO_SHOWCASE_MS,
    );
    return () => clearInterval(id);
  }, [hovered]);

  const score = hovered && realScore != null ? realScore : METEO_SHOWCASE_ORDER[step];
  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={score}
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.86 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex' }}
        >
          <AnimatedMeteoIcon score={score} size={size} color={METEO_BLUE} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FILTRE DE PÉRIODE DES ÉTATS — sélecteur au-dessus de la grille de cartes.
// Distinct du sélecteur du bandeau Cash : celui-ci pilote la PHOTO DU PARC
// (combien d'actifs à telle date, combien de résiliés tel mois), l'autre pilote
// les montants du mois. Les deux ne se parlent pas.
// ══════════════════════════════════════════════════════════════════════════
function EtatPeriodPicker({ value, options, onChange, darkMode, C }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  const current = options.find((o) => o.key === value) || options[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px 6px 13px', borderRadius: 11,
          border: `1px solid ${C.border}`,
          background: open ? (darkMode ? '#2a2b36' : '#f4f6fb') : C.bg,
          cursor: 'pointer', color: C.text, fontFamily: 'inherit',
          fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
          boxShadow: darkMode ? '0 1px 2px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.04)',
          transition: 'background 0.15s, box-shadow 0.15s',
        }}
      >
        <span style={{ textTransform: 'capitalize' }}>{current.label}</span>
        <ChevronDown size={14} strokeWidth={2.4} color={C.muted}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="ceo-scroll"
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
              minWidth: 190, maxHeight: 288, overflowY: 'auto',
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12,
              boxShadow: '0 8px 28px rgba(0,0,0,0.12)', padding: 4,
            }}
          >
            {options.map((o) => {
              const on = o.key === value;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => { onChange(o.key); setOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 11px', borderRadius: 8, border: 'none',
                    background: on ? (darkMode ? 'rgba(255,255,255,0.06)' : '#f1f2f6') : 'transparent',
                    color: on ? C.text : C.secondary, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500,
                    textTransform: 'capitalize',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TRANSACTIONS RÉCENTES — derniers encaissements réellement enregistrés.
// Source : GET /api/v1/finance-periods/recent-payments. Les deux jambes d'une
// ligne mensuelle (Owner / Opti'Lex) arrivent comme deux transactions
// distinctes, d'où le filtre par jambe. RIEN n'est reconstitué ici : une
// période sans saisie finance affiche l'état vide, jamais une ligne inventée.
// ══════════════════════════════════════════════════════════════════════════
const TX_FILTERS = [
  { key: 'all', label: 'Tout' },
  { key: 'owner', label: 'Owner' },
  { key: 'optilex', label: "Opti'Lex" },
];

// Vert = encaissement (convention argent qui rentre, cohérente avec le CA).
// La jambe ne change que la teinte du badge, pas celle du montant.
const TX_LEG_ACCENT = { owner: '#10b981', optilex: '#5b6abf' };
const TX_LEG_LABEL = { owner: 'Owner', optilex: "Opti'Lex" };

// La saisie PSP du sheet finance n'est pas normalisée ("ok Learnypay", "timou").
// On n'affiche que ce qu'on sait reconnaître — le reste est tu plutôt que
// restitué sale.
const TX_KNOWN_PSPS = { learnypay: 'Learnypay', quonto: 'Qonto', ifx: 'IFX', stripe: 'Stripe', gocardless: 'GoCardless' };
const prettyPsp = (raw) => {
  if (!raw) return null;
  const hay = String(raw).toLowerCase();
  const hit = Object.keys(TX_KNOWN_PSPS).find((k) => hay.includes(k));
  return hit ? TX_KNOWN_PSPS[hit] : null;
};

const txAmount = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

// "2026-05-12" -> "12 mai" (+ année si ce n'est pas l'année courante).
const txDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
};

// Badge carré arrondi : flèche entrante = argent qui rentre. Teinte = jambe.
function TxIcon({ leg }) {
  const accent = TX_LEG_ACCENT[leg] || '#5b6abf';
  return (
    <div style={{
      width: 34, height: 34, flexShrink: 0, borderRadius: 11,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${accent}14`, color: accent,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v13" /><path d="m18 12-6 6-6-6" />
      </svg>
    </div>
  );
}

function CeoRecentTransactions({ payments, loading, darkMode, C }) {
  const [filter, setFilter] = useState('all');
  const list = Array.isArray(payments) ? payments : [];
  const rows = useMemo(
    () => (filter === 'all' ? list : list.filter((p) => p.leg === filter)),
    [list, filter],
  );

  return (
    <div className="ceo-card" style={{ marginBottom: 28, animation: 'ceoCardPop 0.4s ease 260ms both' }}>
      {/* En-tête : titre + segmented control (pilote uniquement cette carte) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, padding: '14px 18px 14px 22px', borderBottom: `1px solid ${C.border}`,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Transactions récentes</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Derniers encaissements enregistrés</div>
        </div>
        <div style={{
          display: 'flex', gap: 2, padding: 3, borderRadius: 999,
          background: darkMode ? 'rgba(255,255,255,0.05)' : '#f1f2f6',
        }}>
          {TX_FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={{
                  position: 'relative', border: 'none', background: 'transparent',
                  padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  color: on ? C.text : C.muted,
                  transition: 'color 0.18s ease',
                }}
              >
                {on && (
                  <motion.span
                    layoutId="ceo-tx-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: 999, zIndex: -1,
                      background: darkMode ? '#2a2b36' : '#ffffff',
                      boxShadow: darkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
                    }}
                  />
                )}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste — scroll interne au-delà de ~6 lignes, la carte garde sa hauteur */}
      <div className="ceo-scroll" style={{ maxHeight: 322, overflowY: 'auto', padding: '4px 0' }}>
        {loading && (
          [0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 11, background: C.subtle, animation: 'ceoPulse 1.2s ease infinite' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ width: 180, height: 11, borderRadius: 4, background: C.subtle, animation: 'ceoPulse 1.2s ease infinite' }} />
                <div style={{ width: 96, height: 9, borderRadius: 4, background: C.subtle, marginTop: 7, animation: 'ceoPulse 1.2s ease infinite' }} />
              </div>
              <div style={{ width: 72, height: 12, borderRadius: 4, background: C.subtle, animation: 'ceoPulse 1.2s ease infinite' }} />
            </div>
          ))
        )}

        {!loading && rows.length === 0 && (
          <div style={{ padding: '38px 22px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.secondary }}>
              {list.length === 0 ? 'Aucun encaissement enregistré' : 'Aucun encaissement sur cette jambe'}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>
              Les paiements saisis côté finance apparaissent ici.
            </div>
          </div>
        )}

        {!loading && rows.map((p, i) => {
          const psp = prettyPsp(p.psp);
          return (
            <motion.div
              key={`${p.row_id}-${p.leg}`}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1], delay: Math.min(i, 8) * 0.025 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 22px',
                borderTop: i === 0 ? 'none' : `1px dashed ${C.border}`,
              }}
            >
              <TxIcon leg={p.leg} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }} title={p.societe || ''}>
                  {p.societe || `Client ${p.client_id}`}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {TX_LEG_LABEL[p.leg] || p.leg}{psp ? ` · ${psp}` : ''} · {txDate(p.paid_on)}
                </div>
              </div>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#10b981',
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}>
                +{txAmount(p.amount)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function CeoDashboard() {
  const navigate = useNavigate();
  // Vue CEO/admin "tout" -> on réinitialise le scope de navigation (les sous-vues
  // /ceo/* repassent en vue complète, contrairement au contexte RH).
  setNavScope(null);
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
  // localStorage 'ceoSideCollapsed_v2', défaut = REPLIÉ (true) : survol pour déplier (cohérent tous navigateurs), clé v2
  // navigation est la pierre angulaire de la page.
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem('ceoSideCollapsed_v2');
    return stored === null ? true : stored === 'true';
  });
  useEffect(() => {
    localStorage.setItem('ceoSideCollapsed_v2', String(sideCollapsed));
  }, [sideCollapsed]);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  // Real data states
  const [leaderboardData, setLeaderboardData] = useState(null); // { totals, all_sellers }
  // perf-closing/dashboard : conservé (fetch toujours actif). N'alimente plus
  // les cartes états (migrées vers ceoSheet), mais l'endpoint reste branché —
  // données disponibles ici pour un futur usage (délais, autres KPI).
  const [perfClosingData, setPerfClosingData] = useState(null); // eslint-disable-line no-unused-vars
  const [ceoSheet, setCeoSheet] = useState(null); // snapshot Suivi Clients (GET /ceo-sheet/current)
  // Encaissements réels (carte "Transactions récentes") et lignes du board
  // Owner/Opti'Lex (carte "RDV intégration à venir"). Chargés SÉPARÉMENT du
  // bloc principal : ni l'un ni l'autre ne doit retarder l'affichage du haut
  // de page, et l'échec de l'un n'emporte pas l'autre.
  // Période des cartes d'états : 'all' = photo actuelle du parc (défaut),
  // 'YYYY-MM' = on se replace à ce mois-là. Strictement indépendant du
  // sélecteur du bandeau Cash, qui ne pilote que les montants.
  const [etatPeriod, setEtatPeriod] = useState('all');
  const [recentPayments, setRecentPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [boardRows, setBoardRows] = useState(null); // null = pas encore chargé
  const [perfClients, setPerfClients] = useState([]); // perf-closing clients list
  const [dataLoading, setDataLoading] = useState(true);
  const [avatarMap, setAvatarMap] = useState({});
  // Sales team tab (CEO → opens individual sales' TrackingSheet in ghost mode).
  const [salesTeamUsers, setSalesTeamUsers] = useState([]);
  const [salesTeamLoading, setSalesTeamLoading] = useState(false);

  // ── MONTHLY OBJECTIVES — CEO/admin editable modal ───────────────────
  // map { 'YYYY-MM': target } sourced from /api/v1/monthly-objectives.
  const [monthlyObjectives, setMonthlyObjectives] = useState({});
  const [objectivesModalOpen, setObjectivesModalOpen] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(null); // period currently being PUT
  const [objectiveError, setObjectiveError] = useState(null); // { period, message }

  const C = useMemo(() => getColors(darkMode), [darkMode]);

  // ── AUTH CHECK ──────────────────────────────────────────────────────
  useEffect(() => {
    const u = apiClient.getUser();
    if (!u || (u.role !== 'admin' && u.role !== 'ceo' && u.role !== 'finance_director')) {
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
        const [lb, pc, cs] = await Promise.all([
          apiClient.getLeaderboardStats('current_month').catch(() => null),
          apiClient.get('/api/v1/perf-closing/dashboard').catch(() => null),
          apiClient.get('/api/v1/ceo-sheet/current').catch(() => null),
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
        // snapshot peut être { snapshot: {...} } ou { snapshot: null } → on
        // stocke le snapshot (null géré gracieusement par les useMemo dérivés).
        if (cs) setCeoSheet(cs.snapshot ?? null);
      } catch (e) { console.warn('CEO dashboard data fetch failed:', e); }
      setDataLoading(false);
    })();
  }, [user]);

  // ── TRANSACTIONS RÉCENTES + BOARD OWNER/OPTI'LEX ───────────────────
  // Deux fetchs indépendants du bloc principal. Échec = état vide côté carte
  // (aucune donnée de repli n'est fabriquée), jamais une page cassée.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get('/api/v1/finance-periods/recent-payments?limit=12');
        if (!cancelled) setRecentPayments(data?.payments || []);
      } catch {
        if (!cancelled) setRecentPayments([]);
      } finally {
        if (!cancelled) setPaymentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get('/api/v1/optilex/board');
        if (!cancelled) setBoardRows(data?.clients || []);
      } catch (e) {
        // On laisse `boardRows` à null : la carte reste sur "—". Un board
        // indisponible ne doit pas se lire comme "0 RDV à venir".
        console.warn('[CeoDashboard] board Owner/Opti\'Lex indisponible:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── MONTHLY OBJECTIVES — load on mount, refetch when modal opens ───
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get('/api/v1/monthly-objectives');
        if (cancelled || !data?.objectives) return;
        const map = Object.fromEntries(data.objectives.map(o => [o.period, o.target]));
        setMonthlyObjectives(map);
      } catch {
        // Silent: empty map → card shows "Objectif : —".
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Authorization gate: CEO, admin et finance_director (accès CEO complet) peuvent éditer les objectifs.
  const canEditObjectives = user?.role === 'ceo' || user?.role === 'admin' || user?.role === 'finance_director';
  // Current month key (YYYY-MM, locale-independent).
  const currentMonthKey = useMemo(() => new Date().toISOString().slice(0, 7), []);
  // Rolling 6 months (current + 5 next) for the editable modal.
  const rollingMonths = useMemo(() => {
    const MONTH_LABELS_FR = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ];
    const now = new Date();
    const list = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({ period, label: `${MONTH_LABELS_FR[d.getMonth()]} ${d.getFullYear()}` });
    }
    return list;
  }, []);

  // PUT a single objective. Optimistic UI with rollback on failure.
  const saveObjective = useCallback(async (period, rawValue) => {
    if (!canEditObjectives) return;
    const target = parseInt(rawValue, 10);
    if (!Number.isFinite(target) || target < 0) {
      setObjectiveError({ period, message: 'Valeur invalide' });
      return;
    }
    const previous = monthlyObjectives[period];
    setMonthlyObjectives(prev => ({ ...prev, [period]: target }));
    setSavingPeriod(period);
    setObjectiveError(null);
    try {
      await apiClient.put(`/api/v1/monthly-objectives/${period}`, { target });
    } catch (e) {
      // Rollback
      setMonthlyObjectives(prev => {
        const next = { ...prev };
        if (previous === undefined) delete next[period];
        else next[period] = previous;
        return next;
      });
      setObjectiveError({ period, message: e?.message || 'Erreur sauvegarde' });
    } finally {
      setSavingPeriod(null);
    }
  }, [canEditObjectives, monthlyObjectives]);

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

  // Options du sélecteur : "Tout" + les 24 derniers mois (antériorité couvrant
  // largement les états datés du board, dont les plus anciens remontent à 2025).
  const etatPeriodOptions = useMemo(() => {
    const now = new Date();
    const list = [{ key: 'all', label: 'Tout' }];
    for (let i = 0; i < 24; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${MONTH_LABELS_FR[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return list;
  }, []);

  // ── ÉTATS CLIENTS : le board Owner/Opti'Lex fait autorité ─────────────
  // Le snapshot du Sheet ne connaît que la colonne "État" brute ; le board, lui,
  // applique la vraie règle : override manuel du cabinet > état du Sheet > état
  // déduit des contrats. D'où des chiffres qui divergeaient (42 vs 45 résiliés).
  // On compte donc ICI avec `displayEtat` et les prédicats du board eux-mêmes
  // (importés, jamais recopiés) : chaque carte = un onglet du board, vérifiable
  // en un clic. null tant que le board n'est pas chargé → les cartes montrent
  // "—" plutôt qu'un chiffre faux.
  const BOARD_ACTIF = 'Signé';
  const BOARD_RESILIE = 'Résiliation';
  const BOARD_RETRACTE = 'Rétractation';
  const boardStats = useMemo(() => {
    if (!Array.isArray(boardRows)) return null;
    // Périmètre = lignes ÉTABLIES, comme le "X clients" affiché en tête du board :
    // un contrat encore en vol n'est pas un client tant que la vente n'est pas
    // déclarée. Sans ce filtre, le total ne retomberait pas sur ses pattes.
    const established = boardRows.filter((r) => !r.is_pending_contract);
    const allTime = etatPeriod === 'all';
    const end = allTime ? null : periodEndISO(etatPeriod);
    const inPeriod = (v) => { const d = dateOnly(v); return !!d && d.slice(0, 7) === etatPeriod; };
    // Signé au plus tard à la fin de la période. Les 27 clients sans date de
    // signature ne sont comptés qu'en "Tout" : on ne les place pas d'office
    // dans un mois qu'on ne connaît pas.
    const signedBy = (r) => {
      if (allTime) return true;
      const d = dateOnly(r.owner_signed_at);
      return !!d && d <= end;
    };

    // ── STOCKS : la photo du parc à la fin de la période ──
    const total = established.filter(signedBy).length;
    // Un client aujourd'hui sorti était ACTIF avant sa sortie : `etat_date` le
    // dit (rempli sur 45/45 résiliations et 41/44 rétractations). Les états
    // intermédiaires (pause, en cours de…) ne sont PAS historisés : ils comptent
    // à leur valeur actuelle. Approximation assumée, signalée sous le titre.
    const actifs = established.filter((r) => {
      if (!signedBy(r)) return false;
      const e = displayEtat(r);
      if (e === BOARD_ACTIF) return true;
      if (allTime || !BOARD_TERMINAL_ETATS.has(e)) return false;
      const d = dateOnly(r.etat_date);
      return !!d && d > end;   // sorti après la fin de période → encore actif à cette date
    }).length;

    // ── FLUX : les entrées dans l'état pendant la période ──
    const countEtat = (name) => established
      .filter((r) => displayEtat(r) === name && (allTime || inPeriod(r.etat_date))).length;
    const autresRows = established.filter((r) => {
      const e = displayEtat(r);
      if (!e || e === BOARD_ACTIF || e === BOARD_RESILIE || e === BOARD_RETRACTE) return false;
      return allTime || inPeriod(r.etat_date);
    });
    const autresMap = {};
    autresRows.forEach((r) => { const e = displayEtat(r); autresMap[e] = (autresMap[e] || 0) + 1; });

    // ── HISTORIQUE DES SORTIES : hors filtre ──
    // 12 derniers mois + mois courant, par état. Ils nourrissent les courbes et
    // l'alternance des cartes, qui racontent la trajectoire quelle que soit la
    // période sélectionnée. Une sortie sans `etat_date` n'entre dans aucun mois :
    // on ne la place pas au hasard (0 sur 45 résiliations, 3 sur 44 rétractations).
    const now = new Date();
    const currentMonthKeyLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyExits = (etatName) => {
      const byMonth = {};
      established.forEach((r) => {
        if (displayEtat(r) !== etatName) return;
        const k = (dateOnly(r.etat_date) || '').slice(0, 7);
        if (k) byMonth[k] = (byMonth[k] || 0) + 1;
      });
      const series = [];
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        series.push(byMonth[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] || 0);
      }
      return { series, thisMonth: byMonth[currentMonthKeyLocal] || 0 };
    };
    const resiliesExits = monthlyExits(BOARD_RESILIE);
    const retractesExits = monthlyExits(BOARD_RETRACTE);

    // ── À DATE : insensibles à la période ──
    // Un RDV "à venir" est par nature dans le futur, et la météo est un relevé
    // courant (l'historique par client vit dans /optilex/meteo-history, pas ici).
    const scores = established
      .map((r) => r.meteo_score)
      .filter((s) => typeof s === 'number');
    const meteoBands = { rouge: 0, orange: 0, vert: 0 };
    scores.forEach((s) => { const b = meteoBandOf(s); if (b) meteoBands[b] += 1; });

    return {
      total,
      actifs,
      resilies: countEtat(BOARD_RESILIE),
      retractes: countEtat(BOARD_RETRACTE),
      autres: autresRows.length,
      autresBreakdown: Object.entries(autresMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, z) => z.value - a.value),
      resiliesSeries: resiliesExits.series,
      resiliesThisMonth: resiliesExits.thisMonth,
      retractesSeries: retractesExits.series,
      retractesThisMonth: retractesExits.thisMonth,
      currentMonthLabel: `${MONTH_LABELS_FR[now.getMonth()].toLowerCase()} ${now.getFullYear()}`,
      onboarding: established.filter(isOnboardingUpcoming).length,
      integration: established.filter(isIntegrationUpcoming).length,
      integrationOverdue: established.filter(isIntegrationOverdue).length,
      meteoAvg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      meteoRated: scores.length,
      meteoBands,
    };
  }, [boardRows, etatPeriod]);

  // États clients — 8 cartes, TOUTES alignées sur le board Owner/Opti'Lex, sauf
  // "En retard de paiement" : la notion de retard n'existe pas dans le board
  // (elle est orthogonale à l'état : un client "Signé" peut être en retard),
  // elle reste donc servie par le snapshot Suivi Clients.
  const kpiRow2 = useMemo(() => {
    const n = (v) => (boardStats ? String(v) : '—');
    const boardLoading = boardStats === null;
    const periodLabel = etatPeriod === 'all'
      ? null
      : `${MONTH_LABELS_FR[Number(etatPeriod.slice(5, 7)) - 1]} ${etatPeriod.slice(0, 4)}`.toLowerCase();
    // Météo moyenne : la note arrondie donne l'icône et la couleur (mêmes bandes
    // que le board), la moyenne exacte reste la valeur affichée.
    const meteoRounded = boardStats?.meteoAvg != null ? Math.round(boardStats.meteoAvg) : null;
    const meteoBand = meteoRounded != null ? meteoBandOf(meteoRounded) : null;
    const meteoBands = boardStats?.meteoBands;
    return [
      {
        label: 'Total Clients', Icon: Users, value: n(boardStats?.total), color: '#5b6abf',
        loading: boardLoading,
        sub: periodLabel ? `Signés au plus tard en ${periodLabel}` : 'Clients établis du board',
      },
      {
        label: 'Actifs', Icon: CircleCheck, value: n(boardStats?.actifs), color: '#10b981',
        loading: boardLoading,
        sub: periodLabel ? `Encore actifs fin ${periodLabel}` : 'Onglet Signé du board',
      },
      {
        label: 'Météo client',
        // Seule carte à porter une illustration : au repos les 5 temps
        // défilent, au survol on voit la météo réelle du parc.
        Artwork: meteoRounded != null
          ? (props) => <MeteoShowcase {...props} realScore={meteoRounded} size={54} />
          : null,
        Icon: Cloud,
        value: boardStats?.meteoAvg != null ? `${boardStats.meteoAvg.toFixed(1).replace('.', ',')}/5` : '—',
        color: meteoBand ? METEO_BANDS[meteoBand].color : '#94a3b8',
        cardClass: 'ceo-card--meteo',
        valueGradient: meteoBand ? METEO_VALUE_GRADIENT[meteoBand] : null,
        loading: boardLoading,
        sub: meteoBand
          ? `${meteoWording(boardStats.meteoAvg)} · ${boardStats.meteoRated} notés`
          : 'Aucune note posée',
        breakdown: meteoBands ? [
          { label: 'Satisfaits (4-5)', value: meteoBands.vert },
          { label: 'Mécontents (3)', value: meteoBands.orange },
          { label: 'Critiques (1-2)', value: meteoBands.rouge },
        ].filter((b) => b.value > 0) : [],
      },
      {
        label: 'Onboarding Owner à venir', Icon: CalendarClock, value: n(boardStats?.onboarding), color: '#eab308',
        loading: boardLoading, sub: 'RDV onboarding non effectués',
      },
      {
        label: 'RDV intégration à venir', Icon: Rocket, value: n(boardStats?.integration),
        color: '#3b82f6', loading: boardLoading,
        sub: boardStats?.integrationOverdue
          ? `dont ${boardStats.integrationOverdue} en retard`
          : 'RDV de lancement non effectués',
      },
      {
        label: 'Résiliés', Icon: UserRoundX, value: n(boardStats?.resilies), color: '#ef4444',
        loading: boardLoading,
        sub: periodLabel ? `Résiliations actées en ${periodLabel}` : 'Résiliations actées',
        // Sans filtre, la carte alterne le cumul et le mois en cours : le total
        // dit le poids, le mois dit le rythme. Avec un filtre, un seul chiffre
        // a du sens — celui de la période demandée.
        readings: (!periodLabel && boardStats) ? [
          { value: String(boardStats.resilies), sub: 'Résiliations actées' },
          { value: String(boardStats.resiliesThisMonth), sub: `En ${boardStats.currentMonthLabel}` },
        ] : null,
        subChip: true,
        spark: boardStats ? { values: boardStats.resiliesSeries } : null,
      },
      {
        label: 'Rétractés', Icon: RotateCcw, value: n(boardStats?.retractes), color: '#f97316',
        loading: boardLoading,
        sub: periodLabel ? `Rétractations actées en ${periodLabel}` : 'Rétractations actées',
        subChip: true,
        readings: (!periodLabel && boardStats) ? [
          { value: String(boardStats.retractes), sub: 'Rétractations actées' },
          { value: String(boardStats.retractesThisMonth), sub: `En ${boardStats.currentMonthLabel}` },
        ] : null,
        spark: boardStats ? { values: boardStats.retractesSeries } : null,
      },
      {
        label: 'Autres', Icon: Ellipsis, value: n(boardStats?.autres), color: '#94a3b8',
        loading: boardLoading,
        sub: boardStats?.autresBreakdown?.length
          ? boardStats.autresBreakdown.map((r) => r.label).slice(0, 3).join(', ')
          : 'En cours de résiliation, pause…',
        breakdown: boardStats?.autresBreakdown || [],
      },
    ];
  }, [boardStats, etatPeriod]);

  // ── CASH : mois par défaut du bandeau (snapshot.months) ───────────────
  // Clé du mois affiché au montage : mois courant si présent + non vide,
  // sinon le mois le plus récent non vide. Le sélecteur du bandeau peut
  // ensuite changer le mois localement (cf. CeoCashBanner).
  const defaultCashMonthKey = useMemo(
    () => pickCashMonth(ceoSheet?.months, currentMonthKey)?.month,
    [ceoSheet, currentMonthKey],
  );

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
        @keyframes ceoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        /* Météo animée (carte Météo client) — chaque élément a son propre
           tempo, jamais synchrone, pour que ça vive sans clignoter. Origine des
           transformations en coordonnées du viewBox (12 12 = centre du soleil). */
        .ceo-meteo-spin, .ceo-meteo-breathe, .ceo-meteo-twinkle,
        .ceo-meteo-drift, .ceo-meteo-rain, .ceo-meteo-flash {
          transform-box: view-box; transform-origin: 12px 12px;
        }
        .ceo-meteo-spin { animation: ceoMeteoSpin 12s linear infinite; }
        .ceo-meteo-breathe { animation: ceoMeteoBreathe 4.5s ease-in-out infinite; }
        .ceo-meteo-twinkle { animation: ceoMeteoTwinkle 3.2s ease-in-out infinite; }
        .ceo-meteo-drift { animation: ceoMeteoDrift 6s ease-in-out infinite; }
        .ceo-meteo-rain { animation: ceoMeteoRain 1.6s ease-in infinite; }
        .ceo-meteo-flash { animation: ceoMeteoFlash 3.4s steps(1, end) infinite; }
        @keyframes ceoMeteoSpin { to { transform: rotate(360deg); } }
        @keyframes ceoMeteoBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
        @keyframes ceoMeteoTwinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes ceoMeteoDrift { 0%, 100% { transform: translateX(-0.5px); } 50% { transform: translateX(0.5px); } }
        @keyframes ceoMeteoRain {
          0% { opacity: 0; transform: translateY(-2.5px); }
          25% { opacity: 1; }
          70% { opacity: 1; transform: translateY(1.5px); }
          100% { opacity: 0; transform: translateY(3px); }
        }
        @keyframes ceoMeteoFlash {
          0%, 55%, 100% { opacity: 0.3; }
          58%, 63% { opacity: 1; }
          60% { opacity: 0.35; }
        }
        /* La courbe se trace à l'arrivée, de gauche à droite, sur une sortie
           d'ease franche : elle raconte une trajectoire, elle doit se dessiner
           comme telle plutôt que d'apparaître d'un bloc. */
        .ceo-spark-line {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: ceoSparkDraw 1.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s forwards;
        }
        @keyframes ceoSparkDraw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .ceo-meteo-spin, .ceo-meteo-breathe, .ceo-meteo-twinkle,
          .ceo-meteo-drift, .ceo-meteo-rain, .ceo-meteo-flash { animation: none; opacity: 1; }
          .ceo-spark-line { animation: none; stroke-dashoffset: 0; }
        }
        /* Objectifs mensuels modal — input number Notion-style (pas de
           spinners natifs, plus discret et cohérent avec le pattern de la page). */
        .ceo-objective-input { -moz-appearance: textfield; appearance: textfield; }
        .ceo-objective-input::-webkit-inner-spin-button,
        .ceo-objective-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
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
        /* Variante météo : un lavis bleu, en diagonale comme un ciel, pour que
           la carte se distingue des sept autres sans rompre la famille. */
        .ceo-card--meteo::before {
          background: linear-gradient(180deg, #DDE7F8 0%, #C9D9F1 100%);
        }
        .ceo-card--meteo::after {
          background: linear-gradient(150deg, #FFFFFF 0%, #F4F8FF 42%, #E9F1FF 78%, #DFEAFD 100%);
          box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.9);
        }
      `}</style>

      {/* ═══ LEFT SIDEBAR (Notion-style — mirror TSF) ═══════════════════ */}
      <Sidebar
        width={sideCollapsed ? 56 : 260}
        collapsed={sideCollapsed}
        onToggle={() => setSideCollapsed((v) => !v)}
        sections={SIDEBAR_SECTIONS}
        activeTab={activeTab}
        setActiveTab={(tabId) => {
          // "dispatch" et "leaderboard" sont des wrappers de route
          // (CeoDispatchView / CeoLeaderboardView) → on navigate au lieu
          // d'un rendu inline. "webinar" route vers CeoWebinarView qui
          // embed la page Marketing dans le shell Ceo (pas d'onglet
          // interne ici car la page est lourde et autonome).
          if (tabId === 'dispatch') { navigate('/ceo/dispatch'); return; }
          if (tabId === 'leaderboard') { navigate('/ceo/leaderboard'); return; }
          if (tabId === 'perf_sales') { navigate('/ceo/perf-sales'); return; }
          if (tabId === 'lead_quality') { navigate('/ceo/lead-quality'); return; }
          if (tabId === 'webinar') { navigate('/ceo/webinar'); return; }
          if (tabId === 'funnel_leads') { navigate('/ceo/funnel-leads'); return; }
          if (tabId === 'autoassign') { navigate('/ceo/auto-affectation'); return; }
          if (tabId === 'sequences') { navigate('/ceo/sequences'); return; }
          if (tabId === 'variables') { navigate('/ceo/variables'); return; }
          if (tabId === 'conges') { navigate('/ceo/conges'); return; }
          if (tabId === 'campaigns') { navigate('/ceo/campaigns'); return; }
          if (tabId === 'optilex_board') { navigate('/ceo/optilex-board'); return; }
          setActiveTab(tabId);
        }}
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
            <div style={{ animation: 'ceoFadeIn 0.35s ease both', marginTop: (apiClient.getUser()?.email === 'contact@ownertechnology.com') ? -68 : 0 }}>
              {(apiClient.getUser()?.email === 'contact@ownertechnology.com') && (
              <div style={{ position: 'relative', width: 520, height: 220, overflow: 'hidden' }}>
                <iframe
                  src="https://lottie.host/embed/47485bf9-4f15-49f9-9baa-076809dc1f82/hJCupH69nO.lottie"
                  style={{ position: 'absolute', top: -120, left: -820, width: 1920, height: 480, border: 'none', background: 'transparent', pointerEvents: 'none' }}
                  title="Bonjour animation"
                />
              </div>
              )}
              <div style={{ marginTop: (apiClient.getUser()?.email === 'contact@ownertechnology.com') ? -64 : 48, marginBottom: 24, position: 'relative', zIndex: 2500 }}>
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

              {/* KPI Cards — États Clients (Suivi Clients snapshot) */}
              {/* ── ÉTATS CLIENTS : titre + sélecteur de période ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingLeft: 2 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
                  États clients
                </h2>
                <EtatPeriodPicker
                  value={etatPeriod}
                  options={etatPeriodOptions}
                  onChange={setEtatPeriod}
                  darkMode={darkMode}
                  C={C}
                />
                {etatPeriod !== 'all' && (
                  <span style={{ fontSize: 11, color: C.muted }}>
                    Onboarding, RDV intégration et météo restent à date
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 28 }}>
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

              {/* ── BANDEAU CASH — Suivi Clients snapshot (sélecteur de mois) ── */}
              {/* Les états clients d'abord (façon board Owner) ; le cash / finance ensuite. */}
              <CeoCashBanner
                months={ceoSheet?.months}
                defaultMonthKey={defaultCashMonthKey}
                dataLoading={dataLoading}
                darkMode={darkMode}
                C={C}
              />

              {/* ── TRANSACTIONS RÉCENTES — encaissements réels, sous le cash ── */}
              <CeoRecentTransactions
                payments={recentPayments}
                loading={paymentsLoading}
                darkMode={darkMode}
                C={C}
              />

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
                <img
                  src={ceo6}
                  alt={canEditObjectives ? 'Éditer les objectifs mensuels' : ''}
                  onClick={canEditObjectives ? () => setObjectivesModalOpen(true) : undefined}
                  style={{
                    position: 'absolute', top: -12, right: -10, width: 58, height: 55,
                    objectFit: 'contain',
                    pointerEvents: canEditObjectives ? 'auto' : 'none',
                    cursor: canEditObjectives ? 'pointer' : 'default',
                    zIndex: 10,
                    transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                    transformOrigin: 'center',
                  }}
                  onMouseEnter={canEditObjectives ? (e) => e.currentTarget.style.transform = 'scale(1.08)' : undefined}
                  onMouseLeave={canEditObjectives ? (e) => e.currentTarget.style.transform = 'scale(1)' : undefined}
                />
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Classement</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Top commerciaux du mois</div>
                  {canEditObjectives && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                      Objectif : <span style={{ color: C.text, fontWeight: 600 }}>
                        {monthlyObjectives[currentMonthKey] ?? '—'}
                      </span>
                    </div>
                  )}
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
      {/* ── MONTHLY OBJECTIVES MODAL (CEO/admin only, portal) ───────── */}
      {objectivesModalOpen && canEditObjectives && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setObjectivesModalOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: darkMode ? 'rgba(0,0,0,0.55)' : 'rgba(15,18,30,0.35)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'ceoFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
            padding: 20,
          }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18,
            boxShadow: darkMode ? '0 24px 64px rgba(0,0,0,0.5)' : '0 24px 64px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            animation: 'ceoCardPop 0.28s cubic-bezier(0.16,1,0.3,1) both',
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Objectifs mensuels</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Ventes cibles par mois</div>
              </div>
              <button
                onClick={() => setObjectivesModalOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.border}`,
                  background: 'transparent', color: C.muted, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', padding: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.subtle; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; }}
                aria-label="Fermer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* Rows */}
            <div style={{ padding: '10px 14px 16px' }}>
              {rollingMonths.map(({ period, label }) => (
                <ObjectiveRow
                  key={period}
                  period={period}
                  label={label}
                  currentValue={monthlyObjectives[period]}
                  saving={savingPeriod === period}
                  errorMessage={objectiveError?.period === period ? objectiveError.message : null}
                  onSave={(val) => saveObjective(period, val)}
                  C={C}
                  darkMode={darkMode}
                  isCurrent={period === currentMonthKey}
                />
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Single editable row inside the objectives modal ─────────────────────────
function ObjectiveRow({ label, currentValue, saving, errorMessage, onSave, C, darkMode, isCurrent }) {
  const [draft, setDraft] = useState(currentValue !== undefined ? String(currentValue) : '');
  // Sync local draft when external value changes (e.g. successful save or refetch).
  useEffect(() => {
    setDraft(currentValue !== undefined ? String(currentValue) : '');
  }, [currentValue]);

  const dirty = draft !== (currentValue !== undefined ? String(currentValue) : '');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && dirty && !saving) onSave(draft);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderRadius: 12,
      background: isCurrent ? (darkMode ? 'rgba(124,138,219,0.08)' : 'rgba(91,106,191,0.06)') : 'transparent',
      transition: 'background 0.15s',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 650, color: C.text, letterSpacing: '-0.01em' }}>
          {label}{isCurrent && <span style={{ marginLeft: 8, fontSize: 10, color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>actuel</span>}
        </div>
        {errorMessage && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errorMessage}</div>
        )}
      </div>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="45"
        disabled={saving}
        className="ceo-objective-input"
        style={{
          width: 84, padding: '8px 12px',
          border: `1px solid ${errorMessage ? '#ef4444' : C.border}`,
          borderRadius: 10, background: C.subtle, color: C.text,
          fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
          textAlign: 'right', outline: 'none', fontFamily: 'inherit',
          transition: 'border-color 0.15s, background 0.15s, opacity 0.15s',
          opacity: saving ? 0.6 : 1,
        }}
        onFocus={(e) => { if (!errorMessage) e.target.style.borderColor = C.accent; }}
        onBlur={(e) => { if (!errorMessage) e.target.style.borderColor = C.border; }}
      />
      <button
        onClick={() => onSave(draft)}
        disabled={!dirty || saving}
        style={{
          width: 32, height: 32, borderRadius: 9,
          border: `1px solid ${dirty && !saving ? C.accent : C.border}`,
          background: dirty && !saving ? C.accent : 'transparent',
          color: dirty && !saving ? '#fff' : C.muted,
          cursor: dirty && !saving ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', padding: 0,
          opacity: dirty && !saving ? 1 : 0.5,
        }}
        aria-label="Sauvegarder"
      >
        {saving ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'ceoSpin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
    </div>
  );
}

