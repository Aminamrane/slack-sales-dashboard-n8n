import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import companyLogo from "../assets/my_image.png";
import firstPlace from "../assets/1st-place.png";
import secondPlace from "../assets/2st-place.png";
import thirdPlace from "../assets/3st-place.png";
import iconGlobal from "../assets/global.png";
import iconFinance from "../assets/finance.png";
import "../index.css";
import RdvHeatmap from "../components/RdvHeatmap.jsx";

const COLORS = { primary: "#6366f1", secondary: "#fb923c", tertiary: "#10b981" };
const MONTHS_FR = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const monthLabelFR = (ym) => { const p = String(ym || '').split('-'); return (MONTHS_FR[(+p[1] || 1) - 1] || '') + ' ' + (p[0] || ''); };

const stripDiacritics = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
const normalizeSalesKey = (name) => {
  if (!name) return "unknown";
  return stripDiacritics(name).toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z\s'-]/g, "");
};

const NAME_VARIANTS_TO_CANONICAL = {
  "kyle dif": "kail", "kail": "kail", "kyle": "kail",
  "yohan": "yohan debowski", "yohan debowski": "yohan debowski", "debowski": "yohan debowski",
  "leo": "leo mafrici", "leo mafrici": "leo mafrici", "mafrici": "leo mafrici",
  "yanis": "yanis zairi", "yanis zairi": "yanis zairi", "zairi": "yanis zairi",
  "youness": "youness el boukhrissi", "youness el boukhrissi": "youness el boukhrissi", "el boukhrissi": "youness el boukhrissi",
  "mourad": "mourad derradji", "mourad derradji": "mourad derradji", "derradji": "mourad derradji",
  "alex": "alex gaudrillet", "alex gaudrillet": "alex gaudrillet", "gaudrillet": "alex gaudrillet",
  "sebastien": "sebastien itema", "sebastien itema": "sebastien itema", "itema": "sebastien itema",
  "quentin": "quentin rattez", "quentin rattez": "quentin rattez", "rattez": "quentin rattez",
  "gwenael": "gwenael", "gwenaelle": "gwenael",
  "david": "david dubois", "david dubois": "david dubois", "dubois": "david dubois",
  "eva": "eva meilhac", "eva meilhac": "eva meilhac", "meilhac": "eva meilhac",
  "gwenael derouet": "gwenael", "derouet": "gwenael",
  "aurelie": "aurelie briquet", "aurelie briquet": "aurelie briquet", "briquet": "aurelie briquet",
  "selim": "selim kouay", "selim kouay": "selim kouay", "kouay": "selim kouay",
  "mehdi": "mehdi bouffessil", "mehdi bouffessil": "mehdi bouffessil", "bouffessil": "mehdi bouffessil",
  "mehdi mestiri": "mehdi mestiri", "mestiri": "mehdi mestiri",
  "sarah": "sarah amroune", "sarah amroune": "sarah amroune", "amroune": "sarah amroune",
  "sara": "sara benabid", "sara benabid": "sara benabid", "benabid": "sara benabid",
  "mohamed": "mohamed bouaksa", "mohamed bouaksa": "mohamed bouaksa", "bouaksa": "mohamed bouaksa",
  "youcef": "youcef amrane", "youcef amran": "youcef amrane", "youcef amrane": "youcef amrane", "amran": "youcef amrane", "amrane": "youcef amrane", "yamraneownertechnologycom": "youcef amrane"
};

const CANONICAL_DISPLAY_NAMES = {
  "yohan debowski": "Yohan Debowski", "leo mafrici": "L\u00e9o Mafrici", "mourad derradji": "Mourad Derradji",
  "youness el boukhrissi": "Youness El Boukhrissi", "yanis zairi": "Yanis Za\u00efri", "alex gaudrillet": "Alex Gaudrillet",
  "sebastien itema": "S\u00e9bastien ITEMA", "selim kouay": "Selim Kouay", "eva meilhac": "Eva Meilhac", "david dubois": "David Dubois",
  "aurelie briquet": "Aur\u00e9lie Briquet", "gwenael": "Gwena\u00ebl Derouet", "quentin rattez": "Quentin Rattez",
  "mehdi bouffessil": "Mehdi BOUFFESSIL", "mehdi mestiri": "Mehdi Mestiri", "sarah amroune": "Sarah Amroune", "sara benabid": "Sara BENABID",
  "mohamed bouaksa": "Mohamed Bouaksa", "kail": "Ka\u00efl", "youcef amrane": "Youcef Amrane"
};

const getCanonicalKey = (rawName) => { const n = normalizeSalesKey(rawName); return NAME_VARIANTS_TO_CANONICAL[n] || n; };
const displaySalesName = (rawName) => { const k = getCanonicalKey(rawName); return CANONICAL_DISPLAY_NAMES[k] || (rawName ? rawName.trim() : "Unknown"); };
const EXCLUDED_KEYS = new Set(["mohamed bouaksa", "sara benabid", "sarah amroune", "youcef amrane"]);
const VENTES_BRACKETS = ['1-2', '3-5', '6-10', '11-19', '20+', 'autre'];
const VENTES_BRACKET_LABEL = { '1-2': '1-2', '3-5': '3-5', '6-10': '6-10', '11-19': '11-19', '20+': '20+', 'autre': 'Autre' };

export default function MonitoringPerf() {
  const navigate = useNavigate();
  // Mode embed (CEO/Acquisition Director wrapper) : masque la SharedNavbar
  // interne pour laisser le wrapper rendre la sienne.
  const embedMode = useMemo(
    () => new URLSearchParams(window.location.search).get('embed') === 'true',
    []
  );
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => { localStorage.setItem("darkMode", darkMode); document.body.classList.toggle("dark-mode", darkMode); document.documentElement.classList.toggle("dark-mode", darkMode); }, [darkMode]);

  const C = { bg: darkMode ? '#1e1f28' : '#ffffff', border: darkMode ? '#2a2b36' : '#e2e6ef', surface: darkMode ? '#13141b' : '#f6f7f9', text: darkMode ? '#eef0f6' : '#1e2330', muted: darkMode ? '#5e6273' : '#9ca3af', subtle: darkMode ? '#252636' : '#f4f6fb', secondary: darkMode ? '#8b8fa0' : '#6b7280', accent: darkMode ? '#7c8adb' : '#5b6abf', shadow: darkMode ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' };

  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const check = async () => { try { const token = apiClient.getToken(); const user = apiClient.getUser(); if (!token || !user) { navigate("/login"); return; } setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } }); if (user.role === 'admin' || apiClient.hasAccess('monitoring_perf')) setHasAccess(true); else navigate("/"); } catch { navigate("/login"); } finally { setLoading(false); } }; check(); }, [navigate]);

  // Init viewMode depuis ?view=lead-quality si présent (utilisé par
  // CeoLeadQualityView wrapper pour atterrir direct sur la bonne vue).
  const initialViewMode = useMemo(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    return v === 'lead-quality' || v === 'lead_quality' ? 'lead_quality' : 'perf_sales';
  }, []);
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [perfData, setPerfData] = useState(null);
  const [callsCrm, setCallsCrm] = useState(null); // /tracking/sales-calls-crm (appels/répondu/répondeur hybride, mai+)
  const [dataLoading, setDataLoading] = useState(true);
  const [leadQualityData, setLeadQualityData] = useState(null);
  const [leadQualityLoading, setLeadQualityLoading] = useState(false);
  const [leadQualityRange, setLeadQualityRange] = useState(() => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0'); });
  const [selectedOrigins, setSelectedOrigins] = useState([]);
  const [range, setRange] = useState(() => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0'); });
  const [canal, setCanal] = useState("global");
  const [adsDetailView, setAdsDetailView] = useState(false);
  const [headcountData, setHeadcountData] = useState(null);
  const [headcountLoading, setHeadcountLoading] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [originsOpen, setOriginsOpen] = useState(false);
  const [trackingKpis, setTrackingKpis] = useState(null); // from /tracking/perf-sales-kpis
  const [rdvAnalytics, setRdvAnalytics] = useState(null); // from /tracking/rdv-analytics (délai R1→R2 + heatmap no-show)
  const [salesBreakdown, setSalesBreakdown] = useState(null); // from /tracking/sales-breakdown (vue Ventes)
  const [perfView, setPerfView] = useState('default'); // 'default' (tableau perf) | 'ventes' (ventilation salariés/paiement)
  const [autreModal, setAutreModal] = useState(null); // { name, items: [{societe, headcount}] } — détail des ventes "Autre"
  const [settersPerf, setSettersPerf] = useState(null); // from /tracking/setters-perf (vue Setters)
  const [setterModal, setSetterModal] = useState(null); // détail d'un setter (par sales)

  const openDetail = async (personName) => { if (canal !== "ads" && canal !== "cc") return; setDetailModal({ personName, type: canal, data: null, loading: true }); try { const ep = canal === "ads" ? '/api/v1/monitoring/performance/detail/ads' : '/api/v1/monitoring/performance/detail/cc'; const res = await apiClient.get(ep + '?person_name=' + encodeURIComponent(personName) + '&period=' + range); setDetailModal(prev => prev ? { ...prev, data: res, loading: false } : null); } catch { setDetailModal(prev => prev ? { ...prev, data: null, loading: false } : null); } };

  useEffect(() => { if (!adsDetailView || canal !== "ads") return; let c = false; (async () => { setHeadcountLoading(true); try { const res = await apiClient.get('/api/v1/monitoring/performance/detail/ads/headcount?period=' + range); if (!c) setHeadcountData(res); } catch { if (!c) setHeadcountData(null); } finally { if (!c) setHeadcountLoading(false); } })(); return () => { c = true; }; }, [adsDetailView, range, canal]);

  useEffect(() => { if (hasAccess) { setDataLoading(true); const period = range === "all" ? "all" : range.match(/^\d{4}-\d{2}$/) ? range : "current_month"; apiClient.get('/api/v1/monitoring/performance/v2?period=' + period).then(d => setPerfData(d)).catch(err => { if (err.message && err.message.includes('401')) navigate("/login"); }).finally(() => setTimeout(() => setDataLoading(false), 150)); } }, [hasAccess, range]);
  // Appels/répondu/répondeur hybride CRM — mai+ uniquement (avril et avant = OnOff via v2).
  useEffect(() => { if (hasAccess && range && range.match(/^\d{4}-\d{2}$/) && range >= '2026-05') { setCallsCrm(null); apiClient.get('/api/v1/tracking/sales-calls-crm?month=' + range).then(d => setCallsCrm(d)).catch(() => setCallsCrm(null)); } else { setCallsCrm(null); } }, [hasAccess, range]);

  // Fetch tracking-based R1/R2 KPIs (correct placed/done counts)
  useEffect(() => { if (hasAccess && range && range !== 'all' && range.match(/^\d{4}-\d{2}$/)) { apiClient.get('/api/v1/tracking/perf-sales-kpis?month=' + range).then(d => setTrackingKpis(d)).catch(() => setTrackingKpis(null)); } else { setTrackingKpis(null); } }, [hasAccess, range]);

  // Analytics RDV (délai R1→R2 + heatmap no-show par créneau) — suit le mois sélectionné (range), comme le tableau.
  useEffect(() => { if (hasAccess) { const q = (range && range !== 'all' && range.match(/^\d{4}-\d{2}$/)) ? '?month=' + range : ''; apiClient.get('/api/v1/tracking/rdv-analytics' + q).then(d => setRdvAnalytics(d)).catch(() => setRdvAnalytics(null)); } }, [hasAccess, range]);

  // Vue Ventes (ventilation salariés + paiement par commercial) — lazy, suit le mois sélectionné.
  useEffect(() => { if (hasAccess && perfView === 'ventes' && range && range !== 'all' && range.match(/^\d{4}-\d{2}$/)) { setSalesBreakdown(null); apiClient.get('/api/v1/tracking/sales-breakdown?month=' + range).then(d => setSalesBreakdown(d)).catch(() => setSalesBreakdown(null)); } }, [hasAccess, perfView, range]);

  // Vue Setters (appels/répondu/répondeur/R1-R2 placés par setter) — lazy, mois sélectionné (mai+).
  useEffect(() => { if (hasAccess && perfView === 'setters' && range && range !== 'all' && range.match(/^\d{4}-\d{2}$/)) { setSettersPerf(null); apiClient.get('/api/v1/tracking/setters-perf?month=' + range).then(d => setSettersPerf(d)).catch(() => setSettersPerf(null)); } }, [hasAccess, perfView, range]);

  useEffect(() => { if (hasAccess && viewMode === 'lead_quality') { setLeadQualityLoading(true); let url = '/api/v1/monitoring/lead-quality?period=' + (leadQualityRange || 'current_month'); if (selectedOrigins.length > 0) url += '&' + selectedOrigins.map(o => 'origins=' + encodeURIComponent(o)).join('&'); apiClient.get(url).then(d => setLeadQualityData(d)).catch(err => { if (err.message && err.message.includes('401')) navigate("/login"); }).finally(() => setTimeout(() => setLeadQualityLoading(false), 150)); } }, [hasAccess, viewMode, leadQualityRange, selectedOrigins]);

  // Build lookup from tracking KPIs — by email (primary) + canonical name (fallback)
  const trackingLookup = useMemo(() => {
    if (!trackingKpis || !trackingKpis.by_sales) return { byEmail: {}, byName: {} };
    const byEmail = {};
    const byName = {};
    trackingKpis.by_sales.forEach(s => {
      if (s.email) byEmail[s.email.trim().toLowerCase()] = s;
      const key = getCanonicalKey(s.sales_name);
      byName[key] = s;
    });
    return { byEmail, byName };
  }, [trackingKpis]);

  const performanceData = useMemo(() => {
    if (!perfData) return [];
    const vd = canal === "ads" ? perfData.ads_view : canal === "cc" ? perfData.cc_view : perfData.global_view;
    if (!vd || !vd.by_person) return [];
    const arr = vd.by_person.filter(p => !EXCLUDED_KEYS.has(getCanonicalKey(p.name))).filter(p => (p.leads_assigned||0) > 0 || (p.nbr_signature||0) > 0).map(p => {
      const ct=p.nbr_appel||0, ca=p.nbr_appel_d||0, sig=p.nbr_signature||0, rev=p.total_revenue||0, cash=p.total_cash||0, la=p.leads_assigned||0, lads=p.leads_ads||0, lcc=p.leads_cc||0, ua=p.unique_attempted||0, uan=p.unique_answered||0;
      const key = getCanonicalKey(p.name);
      // Use tracking KPIs for R1/R2 placed/done — match by email (primary) then canonical name (fallback)
      const nameIsEmail = (p.name || '').includes('@');
      const pEmail = (p.email || (nameIsEmail ? p.name : '') || '').trim().toLowerCase();
      const tk = (pEmail && trackingLookup.byEmail[pEmail]) || trackingLookup.byName[key] || null;
      const r1p = tk ? tk.r1_placed : (p.r1p||0);
      const r1d = tk ? tk.r1_done : (p.r1r||0);
      const r2p = tk ? tk.r2_placed : (p.r2p||0);
      const r2d = tk ? tk.r2_done : (p.r2r||0);
      // Use conv_v from tracking KPIs (pre-calculated, avoids >100% issues)
      const convSales = tk && tk.conv_v != null ? tk.conv_v : (r2d>0?(sig/r2d)*100:0);
      const resolvedName = nameIsEmail && tk?.sales_name ? tk.sales_name : displaySalesName(p.name);
      const resolvedKey = nameIsEmail && tk ? getCanonicalKey(tk.sales_name) : key;
      return { salesName: resolvedName, salesKey: resolvedKey, calls_total:ct, calls_answered:ca, r1_placed:r1p, r1_done:r1d, r2_placed:r2p, r2_done:r2d, signatures:sig, revenue:rev, cashCollected:cash, leads_assigned:la, leads_ads:lads, leads_cc:lcc, unique_attempted:ua, unique_answered:uan, conv_global: p.conversion_global||(la>0?(sig/la)*100:0), conv_calls_to_answered: p.conv_calls_to_answered||(ct>0?(ca/ct)*100:0), conv_answered_to_r1p: ca>0?(r1p/ca)*100:0, conv_r1p_to_r1r: r1p>0?(r1d/r1p)*100:0, conv_r2p_to_r2r: r2p>0?(r2d/r2p)*100:0, conv_sales: convSales };
    });
    const seen = new Set(); const deduped = arr.filter(p => { if (seen.has(p.salesKey)) return false; seen.add(p.salesKey); return true; });
    deduped.sort((a,b) => b.signatures !== a.signatures ? b.signatures-a.signatures : b.conv_global !== a.conv_global ? b.conv_global-a.conv_global : b.calls_total-a.calls_total);
    return deduped;
  }, [perfData, canal, trackingLookup]);

  // Régime CRM des appels = mai 2026 et après (avant = OnOff).
  const isCrmMonth = !!(range && /^\d{4}-\d{2}$/.test(range) && range >= '2026-05');
  // Lookup CRM par clé canonique, pour le canal actif (total/ads/cc).
  const callsLookup = useMemo(() => {
    if (!callsCrm?.by_sales) return null;
    const m = {};
    callsCrm.by_sales.forEach(s => {
      const v = canal === 'ads' ? s.ads : canal === 'cc' ? s.cc : s.total;
      const entry = { appels: v.appels || 0, repondu: v.repondu || 0, repondeur: v.repondeur || 0, crm: !!s.crm_appels };
      [getCanonicalKey(s.canonical), getCanonicalKey(s.sales), normalizeSalesKey(s.sales)].forEach(k => { if (k) m[k] = entry; });
    });
    return m;
  }, [callsCrm, canal]);
  // Overlay mai+ : Appels=volume CRM, Décrochés->Répondu (vérité CRM), +Répondeur.
  const perfRows = useMemo(() => {
    if (!isCrmMonth || !callsLookup) return performanceData;
    return performanceData.map(s => {
      const cr = callsLookup[s.salesKey] || callsLookup[normalizeSalesKey(s.salesName)];
      const appels = cr ? cr.appels : 0, repondu = cr ? cr.repondu : 0, repondeur = cr ? cr.repondeur : 0;
      return { ...s, calls_total: appels, calls_answered: repondu, repondeur, crm_appels: cr ? cr.crm : false,
        conv_calls_to_answered: appels > 0 ? (repondu / appels) * 100 : 0,
        conv_answered_to_r1p: repondu > 0 ? (s.r1_placed / repondu) * 100 : 0 };
    });
  }, [performanceData, isCrmMonth, callsLookup]);

  const totals = useMemo(() => {
    if (!perfRows.length) return { calls:0, answered:0, repondeur:0, signatures:0, revenue:0, cashCollected:0, r1_placed:0, r1_done:0, r2_placed:0, r2_done:0, leads_assigned:0, unique_attempted:0, unique_answered:0, conv_global:0, lead_qualifie:0, closing_r1:0, closing_r2:0, closing_audit:0, conv_calls_to_answered:0, conv_answered_to_r1p:0, conv_r1p_to_r1r:0, conv_r2p_to_r2r:0, conv_sales:0 };
    const t = perfRows.reduce((a,s) => ({ calls:a.calls+s.calls_total, answered:a.answered+s.calls_answered, repondeur:a.repondeur+(s.repondeur||0), r1_placed:a.r1_placed+s.r1_placed, r1_done:a.r1_done+s.r1_done, r2_placed:a.r2_placed+s.r2_placed, r2_done:a.r2_done+s.r2_done, signatures:a.signatures+s.signatures, revenue:a.revenue+s.revenue, cashCollected:a.cashCollected+s.cashCollected, leads_assigned:a.leads_assigned+s.leads_assigned, unique_attempted:a.unique_attempted+s.unique_attempted, unique_answered:a.unique_answered+s.unique_answered }), { calls:0, answered:0, repondeur:0, r1_placed:0, r1_done:0, r2_placed:0, r2_done:0, signatures:0, revenue:0, cashCollected:0, leads_assigned:0, unique_attempted:0, unique_answered:0 });
    return { ...t, lead_qualifie:t.leads_assigned>0?(t.unique_answered/t.leads_assigned)*100:0, closing_r1:t.unique_answered>0?(t.r1_done/t.unique_answered)*100:0, closing_r2:t.r1_done>0?(t.r2_done/t.r1_done)*100:0, closing_audit:t.r2_done>0?(t.signatures/t.r2_done)*100:0, conv_global:t.leads_assigned>0?(t.signatures/t.leads_assigned)*100:0, conv_calls_to_answered:t.calls>0?(t.answered/t.calls)*100:0, conv_answered_to_r1p:t.answered>0?(t.r1_placed/t.answered)*100:0, conv_r1p_to_r1r:t.r1_placed>0?(t.r1_done/t.r1_placed)*100:0, conv_r2p_to_r2r:t.r2_placed>0?(t.r2_done/t.r2_placed)*100:0, conv_sales:t.r2_done>0?(t.signatures/t.r2_done)*100:0 };
  }, [perfRows]);

  // Vue Ventes : fusionne les rapporteurs bruts par clé canonique (mêmes
  // exclusions/affichage que le tableau Perf Sales), somme tranches & paiement.
  const ventesData = useMemo(() => {
    const empty = { '1-2': 0, '3-5': 0, '6-10': 0, '11-19': 0, '20+': 0, 'autre': 0 };
    if (!salesBreakdown?.by_rapporteur) return { rows: [], totals: { ventes: 0, cc: 0, ads: 0, hc: { ...empty }, mensuel: 0, annuel: 0 } };
    const byKey = {};
    salesBreakdown.by_rapporteur.forEach(r => {
      const key = getCanonicalKey(r.rapporteur);
      if (EXCLUDED_KEYS.has(key)) return;
      if (!byKey[key]) byKey[key] = { key, name: displaySalesName(r.rapporteur), ventes: 0, cc: 0, ads: 0, hc: { ...empty }, mensuel: 0, annuel: 0, autreDetail: [] };
      const a = byKey[key];
      a.ventes += r.ventes || 0;
      a.cc += r.cc || 0;
      a.ads += r.ads || 0;
      VENTES_BRACKETS.forEach(b => { a.hc[b] += (r.headcount?.[b] || 0); });
      a.mensuel += r.mensuel || 0;
      a.annuel += r.annuel || 0;
      if (r.autre_detail && r.autre_detail.length) a.autreDetail.push(...r.autre_detail);
    });
    const rows = Object.values(byKey).sort((x, y) => y.ventes - x.ventes);
    const totals = rows.reduce((acc, r) => {
      acc.ventes += r.ventes; acc.cc += r.cc; acc.ads += r.ads; acc.mensuel += r.mensuel; acc.annuel += r.annuel;
      VENTES_BRACKETS.forEach(b => { acc.hc[b] += r.hc[b]; });
      return acc;
    }, { ventes: 0, cc: 0, ads: 0, hc: { ...empty }, mensuel: 0, annuel: 0 });
    return { rows, totals };
  }, [salesBreakdown]);

  const gcColor = (tx) => tx>=5?COLORS.tertiary:tx>=2?COLORS.secondary:C.text;
  const dcColor = (tx) => tx>=80?COLORS.tertiary:tx>=50?COLORS.secondary:'#ff453a';
  const rxColor = (tx) => tx>=80?COLORS.tertiary:tx>=50?COLORS.secondary:'#ff453a';
  const cvColor = (tx) => tx>=40?COLORS.tertiary:tx>=20?COLORS.secondary:C.text;
  const r1pColor = (tx) => tx>=30?COLORS.tertiary:tx>=15?COLORS.secondary:C.text;
  const cColor = (r) => r>=10?COLORS.tertiary:r>=5?COLORS.secondary:C.text;
  const lColor = (r) => r<=30?COLORS.tertiary:r<=50?COLORS.secondary:'#ff453a';

  const medal = (i) => i===0?<img src={firstPlace} alt="" style={{width:20,height:20}}/>:i===1?<img src={secondPlace} alt="" style={{width:20,height:20}}/>:i===2?<img src={thirdPlace} alt="" style={{width:20,height:20}}/>:<span style={{fontSize:11,color:C.muted}}>{i+1}</span>;

  const monthOpts = (sy,sm) => { const o=[]; const td=new Date(); const c=new Date(sy,sm-1); const ym=td.getFullYear()*100+td.getMonth(); while(true){ const y=c.getFullYear()*100+c.getMonth(); if(y>ym) break; const v=c.getFullYear()+'-'+String(c.getMonth()+1).padStart(2,'0'); const l=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(c); o.unshift({value:v,label:l.charAt(0).toUpperCase()+l.slice(1)}); c.setMonth(c.getMonth()+1); } return o; };
  const selS = { fontSize:12, fontWeight:500, padding:'6px 10px', borderRadius:8, border:'1px solid '+C.border, background:darkMode?C.subtle:'#fff', color:C.text, cursor:'pointer', outline:'none' };
  const pillS = (a) => ({ fontSize:11.5, fontWeight:a?600:500, padding:'5px 14px', borderRadius:8, border:'1px solid '+(a?C.accent:C.border), background:a?(darkMode?C.accent+'25':C.accent+'12'):'transparent', color:a?C.accent:C.muted, cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' });
  const thS = { whiteSpace:'nowrap', textAlign:'center' };
  const tdS = { textAlign:'center' };

  if (loading) return <div style={{minHeight:'100vh',background:C.surface}} />;
  if (!hasAccess) return null;

  return (
    <>
      {!embedMode && <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />}
      <style>{`@keyframes pageReveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes sidebarReveal{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}@keyframes rowIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}html,body{background:${darkMode?'#13141b':'#ffffff'}}.mp-scroll::-webkit-scrollbar{width:3px;height:3px}.mp-scroll::-webkit-scrollbar-track{background:transparent}.mp-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:4px}`}</style>

      <div style={{animation:'pageReveal 0.5s cubic-bezier(0.4,0,0.2,1) both',fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"}}>
        <div style={{display:'flex',alignItems:'stretch',minHeight:'100vh'}}>

          {/* SIDEBAR \u2014 masqu\u00e9e en mode embed (sidebar du wrapper Ceo*View
              prend le relais et g\u00e8re la navigation perf_sales / lead_quality). */}
          {!embedMode && (
          <div style={{width:220,minWidth:220,borderRight:'1px solid '+C.border,display:'flex',flexDirection:'column',background:darkMode?C.subtle:'#eceef2',animation:'sidebarReveal 0.4s ease both'}}>
            <div style={{padding:'18px 16px 14px',borderBottom:'1px solid '+C.border,marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:10,border:'1px solid '+C.border,background:darkMode?'rgba(255,255,255,0.04)':'#fff'}}>
                <div style={{width:32,height:32,borderRadius:8,background:darkMode?'#fff':'#1e2330',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <img src={companyLogo} alt="" style={{width:20,height:20,objectFit:'contain',filter:darkMode?'none':'brightness(0) invert(1)'}} />
                </div>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>Owner</div>
              </div>
            </div>
            {[{key:'perf_sales',label:'Perf. Sales',icon:iconGlobal},{key:'lead_quality',label:'Qualit\u00e9 Leads',icon:iconFinance}].map(it => {
              const a = viewMode===it.key;
              return (<div key={it.key} onClick={()=>setViewMode(it.key)} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 12px',margin:'1px 12px',cursor:'pointer',borderRadius:10,background:a?(darkMode?'#fff':'#1e2330'):'transparent',color:a?(darkMode?'#1e2330':'#fff'):C.muted,transition:'all 0.2s ease'}} onMouseEnter={e=>{if(!a)e.currentTarget.style.background=darkMode?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)';}} onMouseLeave={e=>{if(!a)e.currentTarget.style.background='transparent';}}>
                <div style={{width:28,height:28,flexShrink:0,backgroundColor:a?(darkMode?'#1e2330':'#fff'):(darkMode?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.3)'),WebkitMaskImage:'url('+it.icon+')',WebkitMaskSize:'contain',WebkitMaskRepeat:'no-repeat',WebkitMaskPosition:'center',maskImage:'url('+it.icon+')',maskSize:'contain',maskRepeat:'no-repeat',maskPosition:'center'}} />
                <span style={{fontSize:13,fontWeight:a?600:500,color:a?(darkMode?'#1e2330':'#fff'):C.muted}}>{it.label}</span>
              </div>);
            })}
            <div style={{flex:1}} />
          </div>
          )}

          {/* RIGHT */}
          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',padding:'8px 8px 8px 0',gap:12}}>

            {/* FILTERS HEADER */}
            <div style={{height:76,background:darkMode?C.bg:'#f6f7f9',borderRadius:8,flexShrink:0,border:'1px solid '+C.border,marginLeft:8,display:'flex',alignItems:'center',padding:'0 20px',gap:10}}>
              {viewMode==='perf_sales' ? (<>
                <select value={range} onChange={e=>setRange(e.target.value)} style={selS}>
                  {monthOpts(2025,9).map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
                  <option value="all">All time</option>
                </select>
                <div style={{width:1,height:28,background:C.border}} />
                {['global','ads','cc'].map(c=>(<button key={c} onClick={()=>{setCanal(c);if(c!=='ads')setAdsDetailView(false);}} style={pillS(canal===c)}>{c==='global'?'Global':c.toUpperCase()}</button>))}
                {canal==='ads' && (<><div style={{width:1,height:28,background:C.border}} /><button onClick={()=>setAdsDetailView(v=>!v)} style={pillS(adsDetailView)}>{adsDetailView?'Funnel':'D\u00e9tail'}</button></>)}
                <div style={{flex:1}} />
                <button onClick={()=>setPerfView(v=>v==='ventes'?'default':'ventes')} style={pillS(perfView==='ventes')}>Ventes</button>
                <button onClick={()=>setPerfView(v=>v==='setters'?'default':'setters')} style={pillS(perfView==='setters')}>Setters</button>
              </>) : (<>
                <select value={leadQualityRange} onChange={e=>setLeadQualityRange(e.target.value)} style={selS}>
                  {monthOpts(2026,1).map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                {leadQualityData && leadQualityData.available_origins && leadQualityData.available_origins.length>0 && (
                  <div style={{position:'relative'}}>
                    <button onClick={()=>setOriginsOpen(v=>!v)} style={{...selS,color:selectedOrigins.length>0?C.accent:C.text}}>
                      {selectedOrigins.length>0?selectedOrigins.length+' origine'+(selectedOrigins.length>1?'s':''):'Toutes origines'} &#9662;
                    </button>
                    {originsOpen && (<div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:darkMode?'#242428':'#fff',border:'1px solid '+C.border,borderRadius:10,boxShadow:C.shadow,padding:'6px 0',zIndex:100,maxHeight:300,overflowY:'auto',minWidth:180}}>
                      {selectedOrigins.length>0 && <div onClick={()=>{setSelectedOrigins([]);setOriginsOpen(false);}} style={{padding:'6px 14px',cursor:'pointer',fontSize:12,fontWeight:600,color:'#ff453a',borderBottom:'1px solid '+C.border}}>R&eacute;initialiser</div>}
                      {leadQualityData.available_origins.map(o=>(<label key={o} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 14px',cursor:'pointer',fontSize:12,fontWeight:selectedOrigins.includes(o)?600:400,color:C.text}}><input type="checkbox" checked={selectedOrigins.includes(o)} onChange={()=>setSelectedOrigins(prev=>prev.includes(o)?prev.filter(x=>x!==o):[...prev,o])} style={{accentColor:C.accent}} />{o}</label>))}
                    </div>)}
                  </div>
                )}
              </>)}
            </div>

            {/* CONTENT */}
            <div style={{flex:1,marginLeft:8}}>
              <div className="mp-scroll" style={{background:darkMode?C.bg:'#f6f7f9',borderRadius:8,border:'1px solid '+C.border,overflow:'auto',minHeight:'calc(100vh - 120px)',maxHeight:'calc(100vh - 120px)'}}>

                {viewMode==='perf_sales' && (<div style={{padding:'20px 20px 28px'}}>
                  <h2 style={{fontSize:20,fontWeight:700,color:C.text,margin:'0 0 4px'}}>Monitoring Perf. Sales</h2>

                  {perfView === 'ventes' ? (
                    <div style={{padding:'4px 0 8px'}}>
                      {range==='all' ? (
                        <div style={{textAlign:'center',padding:48,color:C.muted}}>S&eacute;lectionne un mois pr&eacute;cis pour la vue Ventes.</div>
                      ) : !salesBreakdown ? (
                        <div style={{textAlign:'center',padding:48,color:C.muted}}>Chargement&hellip;</div>
                      ) : ventesData.rows.length===0 ? (
                        <div style={{textAlign:'center',padding:48,color:C.muted}}>Aucune vente sur ce mois.</div>
                      ) : (
                        <div style={{overflowX:'auto'}}>
                          <table className="leaderboard" style={{width:'100%',minWidth:900}}>
                            <thead><tr>{['#','Commercial','Ventes','Cold call','ADS',...VENTES_BRACKETS.map(b=>VENTES_BRACKET_LABEL[b]),'Annuel','Mensuel'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                            <tbody>
                              {ventesData.rows.map((r,i)=>(
                                <tr key={r.key}>
                                  <td style={tdS}>{i+1}</td>
                                  <td style={{...tdS,textAlign:'left',paddingLeft:12,fontWeight:600}}>{r.name}</td>
                                  <td style={{...tdS,fontWeight:800,fontSize:14}}>{r.ventes}</td>
                                  <td style={{...tdS,color:r.cc?C.accent:C.muted,fontWeight:700}}>{r.cc||'—'}</td>
                                  <td style={{...tdS,color:r.ads?C.text:C.muted,fontWeight:600}}>{r.ads||'—'}</td>
                                  {VENTES_BRACKETS.map(b=>{ const clk=b==='autre'&&r.hc[b]>0; return <td key={b} onClick={clk?()=>setAutreModal({name:r.name,items:r.autreDetail||[]}):undefined} style={{...tdS,color:r.hc[b]?C.text:C.muted,...(clk?{cursor:'pointer',textDecoration:'underline dotted',textUnderlineOffset:'3px'}:{})}}>{r.hc[b]||'—'}</td>; })}
                                  <td style={{...tdS,color:COLORS.primary,fontWeight:600}}>{r.annuel||'—'}</td>
                                  <td style={{...tdS,color:COLORS.secondary,fontWeight:600}}>{r.mensuel||'—'}</td>
                                </tr>
                              ))}
                              <tr style={{borderTop:'2px solid '+C.border,fontWeight:700,background:darkMode?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.02)'}}>
                                <td style={tdS}></td>
                                <td style={{...tdS,textAlign:'left',paddingLeft:12}}>Total</td>
                                <td style={tdS}>{ventesData.totals.ventes}</td>
                                <td style={{...tdS,color:C.accent}}>{ventesData.totals.cc}</td>
                                <td style={tdS}>{ventesData.totals.ads}</td>
                                {VENTES_BRACKETS.map(b=><td key={b} style={tdS}>{ventesData.totals.hc[b]}</td>)}
                                <td style={tdS}>{ventesData.totals.annuel}</td>
                                <td style={tdS}>{ventesData.totals.mensuel}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                      {autreModal && (
                        <div onClick={()=>setAutreModal(null)} style={{position:'fixed',inset:0,background:'rgba(15,18,30,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
                          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,borderRadius:14,padding:'18px 20px',minWidth:340,maxWidth:520,maxHeight:'72vh',overflowY:'auto',boxShadow:'0 10px 40px rgba(0,0,0,0.25)',border:'1px solid '+C.border}}>
                            <div style={{fontSize:15,fontWeight:700,color:C.text}}>D&eacute;tail &laquo;&nbsp;Autre&nbsp;&raquo; &mdash; {autreModal.name}</div>
                            <div style={{fontSize:12,color:C.muted,margin:'2px 0 14px'}}>Salari&eacute;s non classables (valeur brute du CRM) &middot; {autreModal.items.length} vente{autreModal.items.length>1?'s':''}</div>
                            <table style={{width:'100%',fontSize:13,borderCollapse:'collapse'}}>
                              <thead><tr><th style={{textAlign:'left',color:C.muted,fontWeight:600,padding:'4px 8px',borderBottom:'1px solid '+C.border}}>Soci&eacute;t&eacute;</th><th style={{textAlign:'left',color:C.muted,fontWeight:600,padding:'4px 8px',borderBottom:'1px solid '+C.border}}>Salari&eacute;s (brut)</th></tr></thead>
                              <tbody>
                                {autreModal.items.map((it,i)=>(<tr key={i}><td style={{padding:'7px 8px',color:C.text,borderBottom:'1px solid '+C.subtle}}>{it.societe}</td><td style={{padding:'7px 8px',color:C.text,borderBottom:'1px solid '+C.subtle,fontStyle:'italic'}}>{it.headcount}</td></tr>))}
                              </tbody>
                            </table>
                            <button onClick={()=>setAutreModal(null)} style={{marginTop:16,padding:'7px 16px',borderRadius:8,border:'1px solid '+C.border,background:C.surface,color:C.text,cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit'}}>Fermer</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : perfView === 'setters' ? (
                    <div style={{padding:'4px 0 8px'}}>
                      {range==='all' ? (
                        <div style={{textAlign:'center',padding:48,color:C.muted}}>Sélectionne un mois précis pour la vue Setters.</div>
                      ) : range < '2026-05' ? (
                        <div style={{textAlign:'center',padding:48,color:C.muted}}>Données setter disponibles à partir de mai 2026.</div>
                      ) : !settersPerf ? (
                        <div style={{textAlign:'center',padding:48,color:C.muted}}>Chargement…</div>
                      ) : (settersPerf.by_setter||[]).length===0 ? (
                        <div style={{textAlign:'center',padding:48,color:C.muted}}>Aucun setter sur ce mois.</div>
                      ) : (
                        <div style={{overflowX:'auto'}}>
                          <table className="leaderboard" style={{width:'100%',minWidth:800}}>
                            <thead><tr>{['#','Setter','Appels','Répondu','Répondeur','R1 placés','R2 placés','Signés'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                            <tbody>
                              {[...settersPerf.by_setter].sort((a,b)=>(b.signes-a.signes)||(b.appels-a.appels)).map((s,i)=>(
                                <tr key={s.setter} onClick={()=>setSetterModal(s)} style={{cursor:'pointer'}}>
                                  <td style={tdS}>{i+1}</td>
                                  <td style={{...tdS,textAlign:'left',paddingLeft:12,fontWeight:600,color:C.accent,textDecoration:'underline dotted',textUnderlineOffset:'3px'}}>{s.setter}</td>
                                  <td style={{...tdS,fontWeight:800,fontSize:14}}>{s.appels}</td>
                                  <td style={{...tdS,color:COLORS.tertiary,fontWeight:700}}>{s.repondu}</td>
                                  <td style={{...tdS,color:C.muted}}>{s.repondeur}</td>
                                  <td style={tdS}>{s.r1_places||'—'}</td>
                                  <td style={tdS}>{s.r2_places||'—'}</td>
                                  <td style={{...tdS,color:COLORS.secondary,fontWeight:800,fontSize:14}}>{s.signes||'—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{fontSize:11.5,color:C.muted,marginTop:10,fontStyle:'italic'}}>Clique un setter pour le détail par commercial.</div>
                        </div>
                      )}
                      {setterModal && (
                        <div onClick={()=>setSetterModal(null)} style={{position:'fixed',inset:0,background:'rgba(15,18,30,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
                          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,borderRadius:14,padding:'18px 20px',minWidth:420,maxWidth:640,maxHeight:'75vh',overflowY:'auto',boxShadow:'0 10px 40px rgba(0,0,0,0.25)',border:'1px solid '+C.border}}>
                            <div style={{fontSize:15,fontWeight:700,color:C.text}}>Détail — {setterModal.setter}</div>
                            <div style={{fontSize:12,color:C.muted,margin:'2px 0 14px'}}>Par commercial · {setterModal.appels} appels · {setterModal.repondu} répondu · {setterModal.r1_places} R1 · {setterModal.r2_places} R2 · {setterModal.signes} signés</div>
                            <table style={{width:'100%',fontSize:13,borderCollapse:'collapse'}}>
                              <thead><tr>{['Commercial','Appels','Répondu','Répondeur','R1 placés','R2 placés'].map((h,i)=><th key={h} style={{textAlign:i===0?'left':'center',color:C.muted,fontWeight:600,padding:'4px 8px',borderBottom:'1px solid '+C.border}}>{h}</th>)}</tr></thead>
                              <tbody>
                                {setterModal.detail.map((d,i)=>(<tr key={i}><td style={{padding:'7px 8px',color:C.text,borderBottom:'1px solid '+C.subtle}}>{displaySalesName(d.sales)}</td><td style={{padding:'7px 8px',textAlign:'center',color:C.text,fontWeight:600,borderBottom:'1px solid '+C.subtle}}>{d.appels}</td><td style={{padding:'7px 8px',textAlign:'center',color:COLORS.tertiary,fontWeight:600,borderBottom:'1px solid '+C.subtle}}>{d.repondu}</td><td style={{padding:'7px 8px',textAlign:'center',color:C.muted,borderBottom:'1px solid '+C.subtle}}>{d.repondeur}</td><td style={{padding:'7px 8px',textAlign:'center',color:C.text,borderBottom:'1px solid '+C.subtle}}>{d.r1_places||'—'}</td><td style={{padding:'7px 8px',textAlign:'center',color:C.text,borderBottom:'1px solid '+C.subtle}}>{d.r2_places||'—'}</td></tr>))}
                              </tbody>
                            </table>
                            <button onClick={()=>setSetterModal(null)} style={{marginTop:16,padding:'7px 16px',borderRadius:8,border:'1px solid '+C.border,background:C.surface,color:C.text,cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit'}}>Fermer</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (<>

                  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
                    {[{l:'Appels',v:totals.calls.toLocaleString('fr-FR')},...(isCrmMonth?[{l:'R\u00e9pondu',v:totals.answered.toLocaleString('fr-FR'),a:COLORS.tertiary},{l:'R\u00e9pondeur',v:totals.repondeur.toLocaleString('fr-FR')}]:[{l:'D\u00e9croch\u00e9s',v:totals.answered.toLocaleString('fr-FR')}]),{l:'R1 plac\u00e9',v:totals.r1_placed.toLocaleString('fr-FR')},{l:'R1 effectu\u00e9',v:totals.r1_done.toLocaleString('fr-FR')},{l:'Leads',v:totals.leads_assigned.toLocaleString('fr-FR')},{l:'Ventes',v:totals.signatures.toLocaleString('fr-FR'),a:COLORS.tertiary},{l:'Revenue',v:totals.revenue>0?Math.round(totals.revenue).toLocaleString('fr-FR')+'\u20ac':'0\u20ac',a:COLORS.secondary},{l:'Cash',v:totals.cashCollected>0?Math.round(totals.cashCollected).toLocaleString('fr-FR')+'\u20ac':'0\u20ac',a:COLORS.tertiary}].map(k=>(<div key={k.l} style={{flex:1,minWidth:100,padding:'10px 14px',borderRadius:10,background:darkMode?C.subtle:'#fff',border:'1px solid '+C.border,textAlign:'center'}}><div style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:'uppercase',marginBottom:4,letterSpacing:'0.04em'}}>{k.l}</div><div style={{fontSize:18,fontWeight:700,color:k.a||C.text}}>{k.v}</div></div>))}
                  </div>

                  <div style={{display:'flex',justifyContent:'center',gap:0,marginBottom:20,borderRadius:10,border:'1px solid '+C.border,overflow:'hidden',background:darkMode?C.subtle:'#fff'}}>
                    {[
                      ...(canal!=='cc' ? [{l:'Lead Qualifi\u00e9',v:totals.lead_qualifie.toFixed(1)+'%'}] : []),
                      {l:'Closing R1',v:totals.closing_r1.toFixed(1)+'%'},
                      {l:'Closing R2',v:totals.closing_r2.toFixed(1)+'%'},
                      {l:'Closing Audit',v:totals.closing_audit.toFixed(1)+'%'},
                      {l:'Conv. Globale',v:totals.conv_global.toFixed(2)+'%'},
                    ].map((k,i,arr)=>(<div key={k.l} style={{flex:1,textAlign:'center',padding:'10px 16px',borderRight:i<arr.length-1?'1px solid '+C.border:'none'}}><div style={{fontSize:12,fontWeight:500,color:C.muted,marginBottom:2}}>{k.l}</div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{k.v}</div></div>))}
                  </div>

                  {dataLoading && <div style={{textAlign:'center',padding:60,color:C.muted}}>Chargement...</div>}

                  {!dataLoading && canal==='ads' && adsDetailView && (headcountLoading ? <div style={{textAlign:'center',padding:60,color:C.muted}}>Chargement...</div> : !headcountData ? <div style={{textAlign:'center',padding:60,color:C.muted}}>Aucune donn&eacute;e</div> : <table className="leaderboard" style={{width:'100%'}}><thead><tr>{['#','Sales','Leads','1-2','3-4','5-6','7-10','11-19','20+','Inconnu'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead><tbody>
                    {[...(headcountData.by_person||[])].sort((a,b)=>(b.leads_assigned||0)-(a.leads_assigned||0)).map((p,i)=>{const hc=p.headcount_breakdown||{};return(<tr key={p.person_name} style={{animation:'rowIn 0.3s cubic-bezier(0.16,1,0.3,1) '+(i*40)+'ms both'}}><td style={tdS}>{medal(i)}</td><td style={{...tdS,textAlign:'left',fontWeight:i<3?700:500,paddingLeft:12}}>{p.person_name}</td><td style={{...tdS,fontWeight:700}}>{(p.leads_assigned||0).toLocaleString('fr-FR')}</td>{['1-2','3-4','5-6','7-10','11-19','20+'].map(b=><td key={b} style={tdS}>{hc[b]||0}</td>)}<td style={{...tdS,color:C.muted}}>{p.unknown||0}</td></tr>);})}
                    {headcountData.totals && <tr style={{borderTop:'2px solid '+C.border,fontWeight:700,background:darkMode?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.02)'}}><td style={tdS}></td><td style={{...tdS,textAlign:'left',paddingLeft:12}}>Total</td><td style={tdS}>{(headcountData.totals.leads_assigned||0).toLocaleString('fr-FR')}</td>{['1-2','3-4','5-6','7-10','11-19','20+'].map(b=><td key={b} style={tdS}>{(headcountData.totals.headcount_breakdown||{})[b]||0}</td>)}<td style={{...tdS,color:C.muted}}>{headcountData.totals.unknown||0}</td></tr>}
                  </tbody></table>)}

                  {!dataLoading && perfRows.length>0 && !(canal==='ads'&&adsDetailView) && (<div style={{overflowX:'auto'}}><table className="leaderboard" style={{width:'100%',minWidth:1100}}><thead><tr>{['#','Sales','Leads','Conv.%','Appels',...(isCrmMonth?['R\u00e9p.','R\u00e9pondeur','Tx R\u00e9p.','R1/R\u00e9p']:['D\u00e9cr.','Tx D\u00e9cr.','R1/D\u00e9cr']),'R1p','R1E','Tx R1','R2p','R2E','Tx R2','Ventes','Conv.V.','Revenue','Cash'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead><tbody>
                    {perfRows.map((s,i)=>(<tr key={canal+'-'+i+'-'+s.salesKey} style={{animation:'rowIn 0.3s cubic-bezier(0.16,1,0.3,1) '+(i*40)+'ms both'}}>
                      <td style={tdS}>{medal(i)}</td>
                      <td style={{...tdS,textAlign:'left',paddingLeft:8}}><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:28,height:28,borderRadius:'50%',background:i===0?COLORS.tertiary:i===1?COLORS.secondary:COLORS.primary,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff',fontWeight:600,flexShrink:0}}>{s.salesName.charAt(0).toUpperCase()}</div><span style={{fontWeight:i<3?700:500,fontSize:12,whiteSpace:'nowrap',...(canal!=='global'?{cursor:'pointer',textDecoration:'underline',textDecorationColor:'rgba(128,128,128,0.3)',textUnderlineOffset:3}:{})}} onClick={()=>canal!=='global'&&openDetail(s.salesName)}>{s.salesName}</span></div></td>
                      <td style={{...tdS,fontWeight:700}}>{canal==='ads'?(s.leads_ads||0):canal==='cc'?(s.leads_cc||0):(s.leads_assigned||0)}</td>
                      <td style={{...tdS,fontWeight:700,color:gcColor(s.conv_global)}}>{s.conv_global.toFixed(2)}%</td>
                      <td style={tdS}>{s.calls_total.toLocaleString('fr-FR')}</td>
                      <td style={isCrmMonth?{...tdS,color:COLORS.tertiary,fontWeight:600}:tdS}>{s.calls_answered.toLocaleString('fr-FR')}</td>
                      {isCrmMonth && <td style={{...tdS,color:C.muted}}>{s.repondeur!=null?s.repondeur.toLocaleString('fr-FR'):'—'}</td>}
                      <td style={{...tdS,fontWeight:600,color:dcColor(s.conv_calls_to_answered)}}>{s.conv_calls_to_answered.toFixed(1)}%</td>
                      <td style={{...tdS,fontWeight:600,color:r1pColor(s.conv_answered_to_r1p)}}>{s.conv_answered_to_r1p.toFixed(1)}%</td>
                      <td style={tdS}>{s.r1_placed}</td><td style={tdS}>{s.r1_done}</td>
                      <td style={{...tdS,fontWeight:600,color:rxColor(s.conv_r1p_to_r1r)}}>{s.conv_r1p_to_r1r.toFixed(0)}%</td>
                      <td style={tdS}>{s.r2_placed}</td><td style={tdS}>{s.r2_done}</td>
                      <td style={{...tdS,fontWeight:600,color:rxColor(s.conv_r2p_to_r2r)}}>{s.conv_r2p_to_r2r.toFixed(0)}%</td>
                      <td style={{...tdS,fontWeight:800,fontSize:13,color:COLORS.tertiary}}>{s.signatures}</td>
                      <td style={{...tdS,fontWeight:600,color:cvColor(s.conv_sales)}}>{s.conv_sales.toFixed(1)}%</td>
                      <td style={{...tdS,color:COLORS.secondary}}>{s.revenue>0?Math.round(s.revenue).toLocaleString('fr-FR')+'\u20ac':'\u2014'}</td>
                      <td style={{...tdS,color:COLORS.tertiary}}>{s.cashCollected>0?Math.round(s.cashCollected).toLocaleString('fr-FR')+'\u20ac':'\u2014'}</td>
                    </tr>))}
                  </tbody></table></div>)}

                  {!dataLoading && !perfRows.length && !adsDetailView && <div style={{textAlign:'center',padding:60,color:C.muted}}>Aucune donn&eacute;e disponible</div>}

                  {rdvAnalytics && (
                    <div style={{padding:'8px 20px 28px',display:'flex',flexDirection:'column',gap:20,borderTop:'1px solid '+C.border,marginTop:8}}>
                      <div>
                        <h2 style={{fontSize:18,fontWeight:700,color:C.text,margin:'8px 0 2px'}}>D&eacute;lai moyen R1 &rarr; R2 (effectu&eacute;s)</h2>
                        <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Temps &eacute;coul&eacute; entre un R1 et un R2 r&eacute;alis&eacute;s (par mois du R1) &mdash; suit le mois s&eacute;lectionn&eacute;.</div>
                        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                          {rdvAnalytics.delay_by_month.length===0 && <div style={{fontSize:13,color:C.muted}}>Pas encore de R1+R2 effectu&eacute;s.</div>}
                          {rdvAnalytics.delay_by_month.map(m=>(
                            <div key={m.month} style={{flex:'1 1 150px',minWidth:150,background:C.bg,border:'1px solid '+C.border,borderRadius:10,padding:'12px 16px',boxShadow:C.shadow}}>
                              <div style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'0.04em'}}>{monthLabelFR(m.month)}</div>
                              <div style={{fontSize:22,fontWeight:700,color:C.text,marginTop:2}}>{m.avg_days.toLocaleString('fr-FR',{maximumFractionDigits:1})}<span style={{fontSize:13,fontWeight:600,color:C.muted}}> j moy.</span></div>
                              <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>m&eacute;diane {m.median_days.toLocaleString('fr-FR',{maximumFractionDigits:1})} j &middot; {m.n} RDV</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(440px, 1fr))',gap:16}}>
                        <RdvHeatmap cells={rdvAnalytics.heatmap_r1} C={C} title="Pr&eacute;sence R1 &mdash; jour/heure" />
                        <RdvHeatmap cells={rdvAnalytics.heatmap_r2} C={C} title="Pr&eacute;sence R2 &mdash; jour/heure" />
                      </div>
                    </div>
                  )}
                  </>)}
                </div>)}

                {viewMode==='lead_quality' && (<div style={{padding:'20px 20px 28px'}}>
                  <h2 style={{fontSize:20,fontWeight:700,color:C.text,margin:'0 0 4px'}}>Qualit&eacute; Leads</h2>
                  <p style={{fontSize:13,color:C.muted,margin:'0 0 20px'}}>Analyse par origine</p>

                  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:24}}>
                    {[{l:'Total Leads',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.total_leads:0).toLocaleString('fr-FR')},{l:'Clients r\u00e9els',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.total_sales:0).toLocaleString('fr-FR'),a:COLORS.tertiary},{l:'Taux Perte',v:leadQualityData&&leadQualityData.summary&&leadQualityData.summary.global_loss_rate!=null?leadQualityData.summary.global_loss_rate.toFixed(1)+'%':'\u2014'},{l:'Non trait\u00e9s',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.total_untreated:0).toLocaleString('fr-FR')},{l:'Tx Conv.',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.global_conversion_rate:0).toFixed(1)+'%',a:COLORS.tertiary},{l:'Tx Conv. R\u00e9el',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.global_real_conversion_rate:0).toFixed(1)+'%',a:COLORS.tertiary},{l:'Cash Total',v:leadQualityData&&leadQualityData.summary&&leadQualityData.summary.total_cash>0?Math.round(leadQualityData.summary.total_cash).toLocaleString('fr-FR')+'\u20ac':'0\u20ac',a:COLORS.tertiary},{l:'ARR Total',v:leadQualityData&&leadQualityData.summary&&leadQualityData.summary.total_arr>0?Math.round(leadQualityData.summary.total_arr).toLocaleString('fr-FR')+'\u20ac':'0\u20ac',a:COLORS.secondary}].map(k=>(<div key={k.l} style={{flex:1,minWidth:100,padding:'10px 14px',borderRadius:10,background:darkMode?C.subtle:'#fff',border:'1px solid '+C.border}}><div style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:'uppercase',marginBottom:4}}>{k.l}</div><div style={{fontSize:18,fontWeight:700,color:k.a||C.text}}>{k.v}</div></div>))}
                  </div>

                  {leadQualityLoading && <div style={{textAlign:'center',padding:60,color:C.muted}}>Chargement...</div>}

                  {!leadQualityLoading && leadQualityData && leadQualityData.by_origin && leadQualityData.by_origin.length>0 && (<table className="leaderboard" style={{width:'100%'}}><thead><tr>{['#','Origine','Leads','Non trait\u00e9s','Tx Perte','Ventes','Conv.%','Conv. R\u00e9el','Appels','D\u00e9cr.','Cash','ARR'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead><tbody>
                    {leadQualityData.by_origin.sort((a,b)=>(b.conversion_rate||0)-(a.conversion_rate||0)).map((o,i)=>(<tr key={o.origin||i} style={{animation:'rowIn 0.3s cubic-bezier(0.16,1,0.3,1) '+(i*40)+'ms both'}}>
                      <td style={tdS}>{medal(i)}</td>
                      <td style={{...tdS,textAlign:'left'}}><span style={{display:'inline-block',padding:'3px 10px',borderRadius:6,fontSize:12,fontWeight:600,background:darkMode?'rgba(99,102,241,0.15)':'rgba(99,102,241,0.1)',color:COLORS.primary}}>{o.origin||'Inconnu'}</span></td>
                      <td style={{...tdS,fontWeight:700}}>{(o.leads_count||0).toLocaleString('fr-FR')}</td>
                      <td style={{...tdS,color:o.untreated_count>0?'#ff9500':C.muted}}>{o.untreated_count>0?o.untreated_count:'0'}</td>
                      <td style={{...tdS,fontWeight:600,color:o.calls_total>0?lColor(o.loss_rate):C.muted}}>{o.calls_total>0?(o.loss_rate||0).toFixed(1)+'%':'\u2014'}</td>
                      <td style={{...tdS,fontWeight:800,fontSize:13,color:COLORS.tertiary}}>{o.sales_count||0}</td>
                      <td style={{...tdS,fontWeight:700,color:cColor(o.conversion_rate)}}>{(o.conversion_rate||0).toFixed(1)}%</td>
                      <td style={{...tdS,fontWeight:700,color:cColor(o.real_conversion_rate)}}>{(o.real_conversion_rate||0).toFixed(1)}%</td>
                      <td style={{...tdS,color:!o.calls_total?C.muted:C.text}}>{o.calls_total>0?o.calls_total.toLocaleString('fr-FR'):'\u2014'}</td>
                      <td style={{...tdS,color:!o.calls_total?C.muted:C.text}}>{o.calls_total>0?(o.calls_answered||0).toLocaleString('fr-FR'):'\u2014'}</td>
                      <td style={{...tdS,color:COLORS.tertiary}}>{o.cash_collected>0?Math.round(o.cash_collected).toLocaleString('fr-FR')+'\u20ac':'\u2014'}</td>
                      <td style={{...tdS,color:COLORS.secondary}}>{o.arr>0?Math.round(o.arr).toLocaleString('fr-FR')+'\u20ac':'\u2014'}</td>
                    </tr>))}
                  </tbody></table>)}

                  {!leadQualityLoading && (!leadQualityData || !leadQualityData.by_origin || !leadQualityData.by_origin.length) && <div style={{textAlign:'center',padding:60,color:C.muted}}>Aucune donn&eacute;e disponible</div>}
                </div>)}

              </div>
            </div>
          </div>
        </div>
      </div>

      {detailModal && (<div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>setDetailModal(null)}>
        <div style={{background:darkMode?'#242428':'#fff',borderRadius:16,padding:24,maxWidth:750,width:'100%',maxHeight:'80vh',overflow:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.3)',border:'1px solid '+C.border}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div><h3 style={{margin:0,fontSize:18,fontWeight:700,color:C.text}}>{detailModal.personName}</h3><span style={{fontSize:13,color:C.muted}}>{detailModal.type==='ads'?'Leads ADS':'Cold Calls'} &middot; {detailModal.data?detailModal.data.period||range:range}</span></div>
            <button onClick={()=>setDetailModal(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:C.muted,borderRadius:8,padding:'4px 8px'}}>&times;</button>
          </div>
          {detailModal.loading && <div style={{textAlign:'center',padding:40,color:C.muted}}>Chargement...</div>}
          {!detailModal.loading && !detailModal.data && <div style={{textAlign:'center',padding:40,color:C.muted}}>Erreur lors du chargement</div>}
          {!detailModal.loading && detailModal.data && detailModal.type==='ads' && (<><p style={{fontSize:13,color:C.muted,marginBottom:10}}>{detailModal.data.total||detailModal.data.leads&&detailModal.data.leads.length||0} leads</p><table className="leaderboard" style={{width:'100%'}}><thead><tr style={{borderBottom:'2px solid '+C.border}}>{['Nom','T\u00e9l\u00e9phone','Origine','Date'].map(h=><th key={h} style={{...thS,textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{(detailModal.data.leads||[]).map((l,idx)=>(<tr key={idx}><td style={{...tdS,textAlign:'left',fontWeight:500}}>{l.full_name}</td><td style={{...tdS,textAlign:'left',fontFamily:'monospace',fontSize:11}}>{l.phone}</td><td style={{...tdS,textAlign:'left'}}>{l.origin}</td><td style={{...tdS,textAlign:'left',whiteSpace:'nowrap'}}>{l.date}</td></tr>))}</tbody></table></>)}
          {!detailModal.loading && detailModal.data && detailModal.type==='cc' && (<><p style={{fontSize:13,color:C.muted,marginBottom:10}}>{detailModal.data.total_entries||detailModal.data.entries&&detailModal.data.entries.length||0} jours &middot; {detailModal.data.total_appels?detailModal.data.total_appels.toLocaleString('fr-FR'):0} appels</p><table className="leaderboard" style={{width:'100%'}}><thead><tr style={{borderBottom:'2px solid '+C.border}}><th style={{...thS,textAlign:'left'}}>Date</th><th style={thS}>Nombre d&apos;appels</th></tr></thead><tbody>{(detailModal.data.entries||[]).map((e,idx)=>(<tr key={idx}><td style={{...tdS,textAlign:'left',fontWeight:500}}>{e.date}</td><td style={{...tdS,fontWeight:600}}>{e.nbr_appel?e.nbr_appel.toLocaleString('fr-FR'):0}</td></tr>))}</tbody></table></>)}
        </div>
      </div>)}
    </>
  );
}
