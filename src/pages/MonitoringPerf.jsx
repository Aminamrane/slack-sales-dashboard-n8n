import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion as Motion } from "framer-motion";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import companyLogo from "../assets/my_image.png";
import firstPlace from "../assets/1st-place.png";
import secondPlace from "../assets/2st-place.png";
import thirdPlace from "../assets/3st-place.png";
import iconGlobal from "../assets/global.png";
import iconFinance from "../assets/finance.png";
import "../index.css";
import { performanceRows, performanceTotals, ratio, isPerformanceSalesPerson, visibleHeadcount } from "../utils/performanceSales.js";
import PerfSalesV2 from "../components/perfSales/v2/PerfSalesV2.jsx";
import PresenceGrid from "../components/perfSales/v2/PresenceGrid.jsx";
import Reactivity, { PeriodBar } from "../components/perfSales/v2/Reactivity.jsx";
import { Reveal, RevealBlock } from "../components/perfSales/motion.jsx";
import "../components/perfSales/perfSales.css";

const percent = (value, digits=1) => value == null ? '—' : value.toLocaleString('fr-FR', {minimumFractionDigits:digits, maximumFractionDigits:digits}) + '%';
const parisMonth = () => new Intl.DateTimeFormat('fr-CA',{year:'numeric',month:'2-digit',timeZone:'Europe/Paris'}).format(new Date()).slice(0,7);

// Lecture de /tracking/rdv-analytics sur une période au choix (dev 14/10/2026 : Réactivité et présence par jour et heure) :
// « mois affiché » réutilise la réponse du mois (rien n'est lu) ; sinon 7 ou 30 derniers jours, mois précédent, dates libres.
function usePeriodAnalytics(enabled, period, range, refreshKey) {
  const [state, setState] = useState({ data: null, loading: false, error: false });
  useEffect(() => {
    if (!enabled || period.key === 'month') return undefined;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    const back = (n) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
    const base = /^\d{4}-\d{2}$/.test(range) ? range : parisMonth();
    const prev = (() => { const [y, m] = base.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; })();
    const query = period.key === '7d' ? `start=${back(6)}&end=${today}` : period.key === '30d' ? `start=${back(29)}&end=${today}`
      : period.key === 'prev' ? `month=${prev}` : period.start && period.end && period.start <= period.end ? `start=${period.start}&end=${period.end}` : null;
    if (!query) return undefined;
    let cancelled = false;
    setState(d => ({ ...d, loading: true, error: false }));
    apiClient.get('/api/v1/tracking/rdv-analytics?' + query)
      .then(data => { if (!cancelled) setState({ data, loading: false, error: false }); })
      .catch(() => { if (!cancelled) setState({ data: null, loading: false, error: true }); });
    return () => { cancelled = true; };
  }, [enabled, period, range, refreshKey]);
  return state;
}
// Période de l'onglet Sales (dev 15/10/2026 : « dans Sales, on ne peut pas sélectionner une période ») : le mois affiché, le
// mois précédent, ou une période libre « AAAA-MM-JJ..AAAA-MM-JJ » (7 ou 30 derniers jours, dates choisies).
function salesPeriodRange(period, range) {
  if (period.key === 'month') return range;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const back = (n) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const base = /^\d{4}-\d{2}$/.test(range) ? range : parisMonth();
  if (period.key === '7d') return `${back(6)}..${today}`;
  if (period.key === '30d') return `${back(29)}..${today}`;
  if (period.key === 'prev') { const [y, m] = base.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; }
  return period.start && period.end && period.start <= period.end ? `${period.start}..${period.end}` : null;
}
// Chiffres de la page (et, pour l'onglet Sales, les appels) relus pour une période autre que le mois affiché.
function usePerfPeriod(enabled, periodRange, range, withCalls, refreshKey) {
  const own = periodRange !== range;
  const [state, setState] = useState({ perf: null, calls: null, loading: false, error: false });
  useEffect(() => {
    if (!enabled || !own) { setState({ perf: null, calls: null, loading: false, error: false }); return undefined; }
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: false }));
    const [d0, d1] = periodRange.split('..');
    const calls = withCalls && periodRange >= '2026-05'
      ? apiClient.get('/api/v1/tracking/sales-calls-crm?' + (d1 ? `start=${d0}&end=${d1}` : `month=${periodRange}`)).catch(() => ({ by_sales: [], calls_error: 'Appels indisponibles' }))
      : Promise.resolve(null);
    Promise.all([apiClient.get('/api/v1/monitoring/performance/v2?period=' + encodeURIComponent(periodRange)), calls])
      .then(([perf, crm]) => { if (!cancelled) setState({ perf, calls: crm, loading: false, error: false }); })
      .catch(() => { if (!cancelled) setState(s => ({ ...s, loading: false, error: true })); });
    return () => { cancelled = true; };
  }, [enabled, own, periodRange, withCalls, refreshKey]);
  return { ...state, own };
}
const nextDay = (iso) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const rangeLabelFR = (r) => (String(r).includes('..') ? r.split('..').map(d => d.split('-').reverse().slice(0, 2).join('/')).join(' → ') : monthLabelFR(r));

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


const getCanonicalKey = (rawName) => { const n = normalizeSalesKey(rawName); return NAME_VARIANTS_TO_CANONICAL[n] || n; };

function CalcTip({ text, rect, darkMode }) {
  const [typed, setTyped] = useState('');
  const contentRef = useRef(null);
  const [contentH, setContentH] = useState(0);
  useEffect(() => {
    let i = 0; setTyped('');
    const id = setInterval(() => { i++; if (i <= text.length) setTyped(text.slice(0, i)); else clearInterval(id); }, 22);
    return () => clearInterval(id);
  }, [text]);
  useEffect(() => { if (contentRef.current) setContentH(contentRef.current.scrollHeight); }, [typed]);
  const GLASS_BG = darkMode ? 'rgba(30,31,40,0.82)' : 'rgba(255,255,255,0.82)';
  const GLASS_BORDER = darkMode ? 'rgba(53,54,71,0.6)' : 'rgba(223,226,235,0.8)';
  const W = (typeof window !== 'undefined') ? window.innerWidth : 1200;
  const left = Math.min(Math.max(rect.left + rect.width / 2, 175), W - 175);
  return createPortal(
    <div style={{ position:'fixed', left, top: rect.bottom + 10, transform:'translateX(-50%)', zIndex:99999, pointerEvents:'none' }}>
      <Motion.div initial={{ opacity:0, scale:0.85, y:-6 }} animate={{ opacity:1, scale:1, y:0 }} transition={{ type:'spring', stiffness:420, damping:28 }} style={{ transformOrigin:'top center' }}>
        <div style={{ position:'relative', background:GLASS_BG, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:`1px solid ${GLASS_BORDER}`, borderRadius:11, padding:'0 14px', boxShadow: darkMode ? '0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,138,219,0.10)' : '0 8px 28px rgba(0,0,0,0.08), 0 0 0 1px rgba(91,106,191,0.05)', minWidth:180, maxWidth:300, overflow:'hidden' }}>
          <Motion.div animate={{ height: contentH || 'auto' }} transition={{ duration:0.25, ease:[0.22,0.68,0.35,1.05] }} style={{ overflow:'hidden' }}>
            <div ref={contentRef} style={{ padding:'8px 0' }}>
              <span style={{ fontSize:'12px', fontWeight:500, fontFamily:"'Inter', system-ui, sans-serif", color: darkMode ? '#c8cbda' : '#3a3f54', lineHeight:1.45, letterSpacing:'-0.01em', whiteSpace:'pre-wrap', textAlign:'center', display:'block' }}>
                {typed}
                <Motion.span animate={{ opacity:[1,0] }} transition={{ duration:0.5, repeat:Infinity, repeatType:'reverse' }} style={{ color: darkMode ? '#7c8adb' : '#5b6abf', fontWeight:300 }}>|</Motion.span>
              </span>
            </div>
          </Motion.div>
          <div style={{ position:'absolute', top:-5, left:'50%', marginLeft:-5, width:10, height:10, background:GLASS_BG, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:`1px solid ${GLASS_BORDER}`, borderBottom:'none', borderRight:'none', transform:'rotate(45deg)', borderRadius:'2px 0 0 0' }} />
        </div>
      </Motion.div>
    </div>,
    document.body
  );
}

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
  const [callsLoading, setCallsLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [sectionErrors, setSectionErrors] = useState({});
  const [leadQualityData, setLeadQualityData] = useState(null);
  const [leadQualityLoading, setLeadQualityLoading] = useState(false);
  const [leadQualityRange, setLeadQualityRange] = useState(parisMonth);
  const [selectedOrigins, setSelectedOrigins] = useState([]);
  const [range, setRange] = useState(parisMonth);
  const [canal, setCanal] = useState("global");
  // Période de l'onglet Sales (voir salesPeriodRange) : lue par le tableau, ses détails et ses KPI.
  const [salesPeriod, setSalesPeriod] = useState({ key: 'month' });
  const salesRange = useMemo(() => salesPeriodRange(salesPeriod, range) || range, [salesPeriod, range]);
  const salesOwn = salesRange !== range;
  const [adsDetailView, setAdsDetailView] = useState(false);
  const [headcountData, setHeadcountData] = useState(null);
  const [headcountLoading, setHeadcountLoading] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [originsOpen, setOriginsOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState(()=>{ try { return new Set(JSON.parse(localStorage.getItem('perfHiddenCols')||'[]')); } catch { return new Set(); } });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [tip, setTip] = useState(null); // tooltip calcul custom
  useEffect(()=>{ try { localStorage.setItem('perfHiddenCols', JSON.stringify([...hiddenCols])); } catch { /* noop */ } }, [hiddenCols]);
  const [avatarMap, setAvatarMap] = useState({});
  useEffect(()=>{ if(!hasAccess) return; let cancelled=false; apiClient.get('/api/v1/users/assignable').then(d=>{ if(cancelled) return; const m={}; (d?.users||[]).forEach(u=>{ const url=u.avatar_url?(/^https?:\/\//i.test(u.avatar_url)?u.avatar_url:apiClient.baseUrl+u.avatar_url):null; m[getCanonicalKey(u.full_name)]={av:url,role:u.role}; }); setAvatarMap(m); }).catch(()=>{}); return ()=>{cancelled=true;}; }, [hasAccess]);
  // Appointment figures are supplied by the selected performance channel.
  const [rdvAnalytics, setRdvAnalytics] = useState(null); // from /tracking/rdv-analytics (délai R1→R2 + heatmap no-show)
  const [salesBreakdown, setSalesBreakdown] = useState(null); // from /tracking/sales-breakdown (vue Ventes)
  // Onglet de la Performance Sales v2 ; « Ventes » et « Setters » sont deux de ses onglets (dev 14/10/2026).
  const [v2Tab, setV2Tab] = useState('overview');
  const perfView = ['ventes', 'setters'].includes(v2Tab) ? v2Tab : 'default';
  const [heatmapSales, setHeatmapSales] = useState('global'); // taux de présence : global | nom d'un sales

  const [appointmentDetail, setAppointmentDetail] = useState(null);
  const appointmentRequest = useRef(0);
  const openAppointments = async (person, stage) => {
    const request = ++appointmentRequest.current;
    setAppointmentDetail({person,stage,loading:true});
    try {
      const data = await apiClient.get(`/api/v1/monitoring/performance/appointments?person_name=${encodeURIComponent(person)}&period=${encodeURIComponent(salesRange)}&channel=${canal}&stage=${stage}`);
      if(request===appointmentRequest.current)setAppointmentDetail({person,stage,data});
    } catch {if(request===appointmentRequest.current)setAppointmentDetail({person,stage,error:true});}
  };
  useEffect(()=>{++appointmentRequest.current;setAppointmentDetail(null);},[salesRange,canal]);
  const detailRequest = useRef(0);
  const openDetail = async (personName) => {
    if (!['ads', 'cc'].includes(canal)) return;
    const request = ++detailRequest.current;
    setDetailModal({personName, type: canal, data: null, loading: true});
    try {
      const res = await apiClient.get(`/api/v1/monitoring/performance/detail/${canal}?person_name=${encodeURIComponent(personName)}&period=${encodeURIComponent(salesRange)}`);
      if (request === detailRequest.current) setDetailModal(prev => prev ? {...prev, data: res, loading: false} : null);
    } catch {
      if (request === detailRequest.current) setDetailModal(prev => prev ? {...prev, loading: false} : null);
    }
  };
  useEffect(() => { ++detailRequest.current; setDetailModal(null); setHeatmapSales('global'); }, [salesRange, canal]);

  useEffect(() => { if (!adsDetailView || canal !== "ads") return; let c = false; (async () => { setHeadcountLoading(true); try { const res = await apiClient.get('/api/v1/monitoring/performance/detail/ads/headcount?period=' + encodeURIComponent(salesRange)); if (!c) setHeadcountData(visibleHeadcount(res)); } catch { if (!c) setHeadcountData(null); } finally { if (!c) setHeadcountLoading(false); } })(); return () => { c = true; }; }, [adsDetailView, salesRange, canal, refreshKey]);

  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    setDataLoading(true); setDataError(''); setPerfData(null); setCallsCrm(null);
    const crm = /^\d{4}-\d{2}$/.test(range) && range >= '2026-05';
    // Les appels viennent d'Allo (lecture plus lente) : la page s'affiche sans les attendre.
    setCallsLoading(crm);
    if (crm) apiClient.get('/api/v1/tracking/sales-calls-crm?month=' + range)
      .then(calls => { if (!cancelled) setCallsCrm(calls); })
      .catch(() => { if (!cancelled) setCallsCrm({by_sales:[], calls_error:'Appels indisponibles'}); })
      .finally(() => { if (!cancelled) setCallsLoading(false); });
    apiClient.get('/api/v1/monitoring/performance/v2?period=' + range)
      .then(performance => { if (!cancelled) setPerfData(performance); })
      .catch(() => { if (!cancelled) setDataError('Les performances n’ont pas pu être chargées. Réessayez.'); })
      .finally(() => { if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, [hasAccess, range, refreshKey]);

  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    setRdvAnalytics(null); setSectionErrors(e => ({...e, rdv: false}));
    apiClient.get('/api/v1/tracking/rdv-analytics' + (range === 'all' ? '' : '?month=' + range))
      .then(d => { if (!cancelled) setRdvAnalytics(d); })
      .catch(() => { if (!cancelled) setSectionErrors(e => ({...e, rdv: true})); });
    return () => { cancelled = true; };
  }, [hasAccess, range, refreshKey]);

  // Réactivité et présence par jour et heure, chacune sur sa période (dev 14/10/2026).
  const [reactPeriod, setReactPeriod] = useState({ key: 'month' });
  const reactData = usePeriodAnalytics(hasAccess, reactPeriod, range, refreshKey);
  const [presencePeriod, setPresencePeriod] = useState({ key: 'month' });
  const presenceData = usePeriodAnalytics(hasAccess, presencePeriod, range, refreshKey);
  // Onglet Sales sur sa propre période : chiffres de la page et appels relus pour cette période ; le mois affiché réutilise
  // les réponses déjà chargées.
  const salesSide = usePerfPeriod(hasAccess, salesRange, range, true, refreshKey);
  // Onglet Rendez-vous : UNE période pour tout l'onglet (dev 15/10/2026 : « on ne peut pas sélectionner de période » ;
  // cohérence) : cartes R1/R2, shows par canal et présence par jour et heure.
  const rdvRange = useMemo(() => salesPeriodRange(presencePeriod, range) || range, [presencePeriod, range]);
  const rdvSide = usePerfPeriod(hasAccess, rdvRange, range, false, refreshKey);
  const rdvPerf = rdvSide.own ? rdvSide.perf : perfData;

  useEffect(() => {
    let cancelled = false;
    // Onglet Ventes : la ventilation des ventes déclarées (l'onglet Setters lit ses propres données).
    setSalesBreakdown(null); setSectionErrors(e => ({...e, extra: false}));
    if (!hasAccess || range === 'all' || perfView !== 'ventes') return;
    apiClient.get('/api/v1/tracking/sales-breakdown?month=' + range)
      .then(d => { if (!cancelled) setSalesBreakdown(d); })
      .catch(() => { if (!cancelled) setSectionErrors(e => ({...e, extra: true})); });
    return () => { cancelled = true; };
  }, [hasAccess, perfView, range, refreshKey]);

  useEffect(() => { if (hasAccess && viewMode === 'lead_quality') { setLeadQualityLoading(true); let url = '/api/v1/monitoring/lead-quality?period=' + (leadQualityRange || 'current_month'); if (selectedOrigins.length > 0) url += '&' + selectedOrigins.map(o => 'origins=' + encodeURIComponent(o)).join('&'); apiClient.get(url).then(d => setLeadQualityData(d)).catch(err => { if (err.message && err.message.includes('401')) navigate("/login"); }).finally(() => setTimeout(() => setLeadQualityLoading(false), 150)); } }, [hasAccess, viewMode, leadQualityRange, selectedOrigins]);

  const isCrmMonth = !!(range && /^\d{4}-\d{2}$/.test(range) && range >= '2026-05');
  const perfRows = useMemo(() => performanceRows(perfData, callsCrm, canal, getCanonicalKey), [perfData, callsCrm, canal]);

  const totals = useMemo(() => {const t=performanceTotals(perfRows); return {...t,lead_qualifie:isCrmMonth?t.lead_qualifie:ratio(t.unique_answered,t.leads_assigned)};}, [perfRows,isCrmMonth]);
  const salesPerf = salesOwn ? salesSide.perf : perfData;
  const sCrm = !!(salesRange && salesRange !== 'all' && salesRange >= '2026-05');
  const sLoading = salesOwn ? salesSide.loading && !salesSide.perf : dataLoading;
  const sCallsLoading = salesOwn ? salesSide.loading : callsLoading;
  const sRows = useMemo(() => performanceRows(salesPerf, salesOwn ? salesSide.calls : callsCrm, canal, getCanonicalKey), [salesPerf, salesOwn, salesSide.calls, callsCrm, canal]);
  const sTotals = useMemo(() => {const t=performanceTotals(sRows); return {...t,lead_qualifie:sCrm?t.lead_qualifie:ratio(t.unique_answered,t.leads_assigned)};}, [sRows,sCrm]);
  // Performance Sales v2 (dev 14/10/2026) : onglets ; le canal ADS/CC ne sert plus qu'au tableau de l'onglet Sales.
  const changeV2Tab = (t) => { setV2Tab(t); if (t !== 'sales') { setCanal('global'); setAdsDetailView(false); } };
  const v2Front = useMemo(() => ({
    calls: { measured: totals.calls_measured, total: totals.calls, rate: totals.calls ? (totals.calls_human / totals.calls) * 100 : null,
      missing: totals.calls_missing || [], loading: callsLoading },
    callsMissing: callsLoading ? [] : (totals.calls_missing || []),
    avatarFor: (name) => avatarMap[getCanonicalKey(name)]?.av || null,
    me: session?.user?.user_metadata?.name || null,
  }), [totals, callsLoading, avatarMap, session]);


  const gcColor = (tx) => tx>=5?COLORS.tertiary:tx>=2?COLORS.secondary:C.text;
  const rxColor = (tx) => tx>=80?COLORS.tertiary:tx>=50?COLORS.secondary:'#ff453a';
  const arColor = (tx) => tx>=50?COLORS.tertiary:tx>=35?COLORS.secondary:'#ff453a';   // taux de réponse d'appels
  const cvColor = (tx) => tx>=40?COLORS.tertiary:tx>=20?COLORS.secondary:C.text;
  const r1pColor = (tx) => tx>=30?COLORS.tertiary:tx>=15?COLORS.secondary:C.text;
  const cColor = (r) => r>=10?COLORS.tertiary:r>=5?COLORS.secondary:C.text;
  const lColor = (r) => r<=30?COLORS.tertiary:r<=50?COLORS.secondary:'#ff453a';

  const medal = (i) => i===0?<img src={firstPlace} alt="" style={{width:25,height:25}}/>:i===1?<img src={secondPlace} alt="" style={{width:25,height:25}}/>:i===2?<img src={thirdPlace} alt="" style={{width:25,height:25}}/>:<span style={{fontSize:16,fontWeight:800,color:C.secondary,fontVariantNumeric:"tabular-nums"}}>{i+1}</span>;

  const monthOpts = (sy,sm) => { const o=[]; const td=new Date(parisMonth()+'-15T12:00:00'); const c=new Date(sy,sm-1); const ym=td.getFullYear()*100+td.getMonth(); while(true){ const y=c.getFullYear()*100+c.getMonth(); if(y>ym) break; const v=c.getFullYear()+'-'+String(c.getMonth()+1).padStart(2,'0'); const l=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(c); o.unshift({value:v,label:l.charAt(0).toUpperCase()+l.slice(1)}); c.setMonth(c.getMonth()+1); } return o; };
  const selS = { fontSize:12, fontWeight:500, padding:'6px 10px', borderRadius:8, border:'1px solid '+C.border, background:darkMode?C.subtle:'#fff', color:C.text, cursor:'pointer', outline:'none' };
  const thS = { whiteSpace:'nowrap', textAlign:'center' };
  const tdS = { textAlign:'center', fontVariantNumeric:'tabular-nums' };
  // Un taux absent (« — ») reste neutre : ni rouge ni vert.
  const pctPill = (txt,color)=>{const c=txt==='—'?C.muted:color;return <span style={{display:'inline-block',padding:'3px 11px',borderRadius:8,fontSize:12.5,fontWeight:600,color:c,background:txt==='—'?'transparent':c+'22',fontVariantNumeric:'tabular-nums'}}>{txt}</span>;};

  const metricButton = {border:0,background:'none',color:C.accent,font:'inherit',cursor:'pointer',padding:'4px 6px',textDecoration:'underline',textUnderlineOffset:3};
  const perfColumns = [
    { key:'rank', label:'#', tip:'Classement par ventes', always:true, cell:(s,i,k)=><td key={k} style={tdS}>{medal(i)}</td> },
    { key:'sales', label:'Sales', tip:'Commercial', always:true, cell:(s,i,k)=>{const meta=avatarMap[s.salesKey]||{};const av=meta.av;const rl={sales:'Sales',head_of_sales:'Head of Sales',head_of_sales_manager:'Manager',admin:'Admin'}[meta.role]||'';return <td key={k} style={{...tdS,textAlign:'left',paddingLeft:8}}><div style={{display:'flex',alignItems:'center',gap:11}}>{av?<img src={av} alt="" style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:'1px solid '+C.border}} />:<div style={{width:36,height:36,borderRadius:'50%',background:i===0?COLORS.tertiary:i===1?COLORS.secondary:COLORS.primary,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#fff',fontWeight:600,flexShrink:0}}>{s.salesName.charAt(0).toUpperCase()}</div>}<div style={{minWidth:0}}><div style={{fontWeight:650,fontSize:13.5,color:C.text,whiteSpace:'nowrap',letterSpacing:'-0.01em',...(canal!=='global'?{cursor:'pointer'}:{})}} onClick={()=>canal!=='global'&&openDetail(s.salesName)}>{s.salesName}</div>{rl&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{rl}</div>}</div></div></td>;} },
    { key:'leads', label:'Leads', tip:'Leads reçus (créés) dans le mois', cell:(s,i,k)=><td key={k} style={{...tdS,fontWeight:700}}>{canal==='ads'?(s.leads_ads||0):canal==='cc'?(s.leads_cc||0):(s.leads_assigned||0)}</td> },
    { key:'conv', label:'Conv.%', tip:'Ventes déclarées dans la période ÷ leads reçus dans la période. Ce ratio d’activité ne suit pas une même cohorte de clients.', cell:(s,i,k)=><td key={k} style={tdS}>{pctPill(percent(s.conv_global,2),gcColor(s.conv_global))}</td> },
    { key:'appels', label:'Appels', tip:'Appels sortants passés depuis Allo dans la période. « Non relevé » : le sales n’appelle pas depuis Allo, ses appels ne sont pas comptés.', cell:(s,i,k)=><td key={k} style={tdS}>{sCallsLoading&&i>=0?<span style={{color:C.muted}}>…</span>:s.calls_available?s.calls_total.toLocaleString('fr-FR'):<span style={{fontSize:11.5,color:C.muted}}>non relevé</span>}</td> },
    { key:'rep', label:sCrm?'Rép.':'Décr.', tip:sCrm?'Leads répondu (atteints), vérité CRM':'Décrochés (OnOff)', cell:(s,i,k)=><td key={k} style={sCrm?{...tdS,color:COLORS.tertiary,fontWeight:600}:tdS}>{s.calls_answered.toLocaleString('fr-FR')}</td> },
    { key:'repondeur', label:'Répondeur', tip:'Tombés sur répondeur / messagerie', crmOnly:true, cell:(s,i,k)=><td key={k} style={{...tdS,color:C.muted}}>{s.repondeur!=null?s.repondeur.toLocaleString('fr-FR'):'—'}</td> },
    { key:'txrep', label:sCrm?'Tx Rép.':'Tx Décr.', tip:sCrm?'Taux de réponse Allo : appels répondus par une personne ÷ appels sortants (répondeurs détectés exclus)':'Décrochés ÷ Appels', cell:(s,i,k)=><td key={k} style={tdS}>{(s.calls_measured ?? s.calls_available)&&!sCallsLoading?pctPill(percent(s.conv_calls_to_answered,1),arColor(s.conv_calls_to_answered)):'—'}</td> },
    { key:'r1rep', label:sCrm?'R1/Rép':'R1/Décr', tip:sCrm?'Parmi les contacts atteints dans la période : part ayant un R1 planifié dans cette même période':'R1 placés ÷ Décrochés', cell:(s,i,k)=><td key={k} style={tdS}>{pctPill(percent(s.conv_answered_to_r1p,1),r1pColor(s.conv_answered_to_r1p))}</td> },
    { key:'r1p', label:'R1 placés', tip:'Tous les R1 planifiés dans la période, sales et setters inclus. Cliquer pour voir les dossiers.', cell:(s,i,k)=><td key={k} style={tdS}><button onClick={()=>openAppointments(s.salesName,'r1')} style={metricButton}>{s.r1_placed}</button></td> },
    { key:'r1tel', label:'R1 tél.', tip:'R1 faits au téléphone : un R2 posé sans R1 dans le CRM, compté au mois du R2. À part des R1 placés. Cliquer pour voir les dossiers.', crmOnly:true, cell:(s,i,k)=><td key={k} style={tdS}>{s.r1_phone?<button onClick={()=>openAppointments(s.salesName,'r1_phone')} style={metricButton}>{s.r1_phone}</button>:<span style={{color:C.muted}}>0</span>}</td> },
    { key:'r1s', label:'Dont setter', tip:'R1 placés par le setter', crmOnly:true, cell:(s,i,k)=><td key={k} style={{...tdS,color:COLORS.primary,fontWeight:600}}>{s.r1p_s}</td> },
    { key:'r1e', label:'R1 effectués', tip:'R1 planifiés dans la période et qualifiés comme effectués', cell:(s,i,k)=><td key={k} style={tdS}>{s.r1_done}</td> },
    { key:'r1se', label:'Dont setter effectués', tip:'R1 placés par un setter et réellement effectués ; sous-ensemble des R1 effectués', crmOnly:true, cell:(s,i,k)=><td key={k} style={tdS}>{s.r1r_s}</td> },
    { key:'txr1', label:'Tx R1', tip:'Présence R1 : R1 effectués ÷ R1 passés (date prévue dépassée). Les R1 à venir du mois ne comptent pas.', cell:(s,i,k)=><td key={k} style={tdS}>{pctPill(percent(s.conv_r1p_to_r1r,0),rxColor(s.conv_r1p_to_r1r))}</td> },
    { key:'r2p', label:'R2 placés', tip:'Tous les R2 planifiés dans la période, sales et setters inclus. Cliquer pour voir les dossiers.', cell:(s,i,k)=><td key={k} style={tdS}><button onClick={()=>openAppointments(s.salesName,'r2')} style={metricButton}>{s.r2_placed}</button></td> },
    { key:'r2s', label:'Dont setter', tip:'R2 placés par le setter', crmOnly:true, cell:(s,i,k)=><td key={k} style={{...tdS,color:COLORS.primary,fontWeight:600}}>{s.r2p_s}</td> },
    { key:'r2e', label:'R2 effectués', tip:'R2 planifiés dans la période et qualifiés comme effectués, y compris réflexion ou refus après rendez-vous', cell:(s,i,k)=><td key={k} style={tdS}>{s.r2_done}</td> },
    { key:'r2se', label:'Dont setter effectués', tip:'R2 placés par un setter et réellement effectués ; sous-ensemble des R2 effectués', crmOnly:true, cell:(s,i,k)=><td key={k} style={tdS}>{s.r2r_s}</td> },
    { key:'txr2', label:'Tx R2', tip:'Présence R2 : R2 effectués ÷ R2 passés (date prévue dépassée). Les R2 à venir du mois ne comptent pas.', cell:(s,i,k)=><td key={k} style={tdS}>{pctPill(percent(s.conv_r2p_to_r2r,0),rxColor(s.conv_r2p_to_r2r))}</td> },
    ...((canal!=='ads'&&sCrm)?[{key:'ccs1',label:'CC setter R1 effectués',tip:'R1 effectués du canal CC, issus du setter ; inclus dans R1 effectués',cell:(s,i,k)=><td key={k} style={tdS}>{s.r1_cc_setter_done}</td>},{key:'ccs2',label:'CC setter R2 effectués',tip:'R2 effectués issus du CC setter, même si le sales a placé le R2 ; inclus dans R2 effectués',cell:(s,i,k)=><td key={k} style={tdS}>{s.r2_cc_setter_done}</td>}]:[]),
    { key:'signes', label:'Signatures', tip:'Contrats Owner signés sur Yousign dans la période, au commercial du contrat ; un contrat signé peut ne pas être encore déclaré.', cell:(s,i,k)=><td key={k} style={{...tdS,fontWeight:750,color:'#f59e0b'}}>{s.signed}</td> },
    { key:'ventes', label:'Ventes', tip:'Ventes déclarées dans la période (déclaration de vente)', cell:(s,i,k)=><td key={k} style={{...tdS,fontWeight:800,fontSize:15,color:COLORS.tertiary}}>{s.signatures}</td> },
    { key:'convv', label:'Conv.V.', tip:'Conversion ventes : Ventes ÷ R2 effectués', cell:(s,i,k)=><td key={k} style={tdS}>{pctPill(percent(s.conv_sales,1),cvColor(s.conv_sales))}</td> },
    { key:'revenue', label:'Revenu', tip:'Revenu enregistré dans les déclarations de vente', cell:(s,i,k)=><td key={k} style={{...tdS,color:COLORS.secondary}}>{s.revenue.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</td> },
    { key:'cash', label:'Cash déclaré', tip:'Cash déclaré à la vente ; ce montant ne constitue pas un encaissement bancaire', cell:(s,i,k)=><td key={k} style={{...tdS,color:COLORS.tertiary}}>{s.cashCollected.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</td> },
  ];

  // Ligne d'en-tête des groupes : chaque colonne visible appartient à un thème, les colonnes voisines du même thème
  // sont fusionnées (le tableau reste lisible quand des colonnes sont masquées).
  const COLUMN_GROUP = { leads:'activity', conv:'activity', appels:'activity', rep:'activity', repondeur:'activity', txrep:'activity', r1rep:'activity',
    r1p:'r1', r1tel:'r1', r1s:'r1', r1e:'r1', r1se:'r1', txr1:'r1', r2p:'r2', r2s:'r2', r2e:'r2', r2se:'r2', txr2:'r2', ccs1:'r1', ccs2:'r2',
    signes:'result', ventes:'result', convv:'result', revenue:'result', cash:'result' };
  const GROUP_LABEL = { activity:['Activité','#64748b'], r1:['Premier rendez-vous','#6366f1'], r2:['Second rendez-vous','#0284c7'], result:['Résultat','#10b981'] };
  const columnGroups = (cols) => cols.reduce((acc, c) => {
    const key = COLUMN_GROUP[c.key] || null, last = acc[acc.length - 1];
    if (last && last.key === key) last.span += 1;
    else acc.push({ key, span: 1, label: key ? GROUP_LABEL[key][0] : '', color: key ? GROUP_LABEL[key][1] : undefined });
    return acc;
  }, []);

  const appointmentDialog = appointmentDetail && createPortal(
    <div onClick={()=>{++appointmentRequest.current;setAppointmentDetail(null);}} style={{position:'fixed',inset:0,zIndex:12000,background:'rgba(20,25,35,.35)',backdropFilter:'blur(5px)',display:'grid',placeItems:'center',padding:20}}>
      <Motion.section role="dialog" aria-modal="true" aria-label="Détail des rendez-vous" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} onClick={e=>e.stopPropagation()} style={{background:C.bg,color:C.text,borderRadius:20,width:'min(900px,100%)',maxHeight:'85dvh',overflow:'auto',padding:24,boxShadow:'0 20px 60px #0002'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:20}}><div><h2 style={{margin:0,fontSize:20}}>{appointmentDetail.stage==='r1_phone'?'R1 au téléphone':appointmentDetail.stage.toUpperCase()} · {appointmentDetail.person}</h2><p style={{color:C.secondary}}>{rangeLabelFR(salesRange)} · {canal.toUpperCase()} · heure de Paris</p></div><button aria-label="Fermer" onClick={()=>{++appointmentRequest.current;setAppointmentDetail(null);}} style={metricButton}>Fermer</button></div>
        {appointmentDetail.loading?<p>Chargement des rendez-vous…</p>:appointmentDetail.error?<p>Le détail n’a pas pu être chargé.</p>:<>
          <p><strong>{appointmentDetail.stage==='r1_phone'?`${appointmentDetail.data.total} R1 faits au téléphone (R2 posé sans R1) · ${appointmentDetail.data.setter} R2 posés par un setter`:`${appointmentDetail.data.total} placés · ${appointmentDetail.data.done} effectués · ${appointmentDetail.data.setter} placés par un setter`}</strong></p>
          {appointmentDetail.data.historical_partial&&<p>Le détail des rendez-vous est disponible depuis avril 2026 ; les agrégats antérieurs ne contiennent pas de dossiers individuels.</p>}
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{['Dossier','Date prévue','Origine','Placement','Résultat'].map(t=><th key={t} style={{textAlign:'left',padding:10,borderBottom:'1px solid '+C.border}}>{t}</th>)}</tr></thead><tbody>{appointmentDetail.data.appointments.map(r=><tr key={r.lead_id}><td style={{padding:10}}>{r.name||'Dossier'} <small>#{r.lead_id}</small></td><td style={{padding:10,whiteSpace:'nowrap'}}>{r.scheduled_at.slice(0,10).split('-').reverse().join('/')} à {r.scheduled_at.slice(11,16)}</td><td style={{padding:10}}>{r.origin||'—'}</td><td style={{padding:10}}>{r.setter?'Setter':'Sales'}</td><td style={{padding:10}}>{r.result==='phone'?'Au téléphone':r.done?'Effectué':!r.due?'À venir':({no_show:'Absent',rescheduled:'Reporté',cancelled:'Annulé',annule:'Annulé',reporte:'Reporté'}[r.result]||'Non qualifié')}</td></tr>)}</tbody></table>
          {!appointmentDetail.data.total&&<p>Aucun rendez-vous dans cette sélection.</p>}
        </>}
      </Motion.section>
    </div>,document.body);

  if (loading) return <div style={{minHeight:'100vh',background:C.surface}} />;
  if (!hasAccess) return null;

  return (
    <>
      {appointmentDialog}
      {!embedMode && <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />}
      {tip && <CalcTip text={tip.t} rect={tip.r} darkMode={darkMode} />}
      <style>{`@keyframes pageReveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes sidebarReveal{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}@keyframes rowIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}html,body{background:${darkMode?'#13141b':'#ffffff'}}.perfv2{border-collapse:separate;border-spacing:0;background:${C.bg};border-radius:14px}.perfv2 th{padding:14px 12px;font-size:12px;font-weight:600;color:${C.secondary};border-bottom:1px solid ${C.border}}.perfv2 .perfv2-groups th{padding:10px 12px 6px;font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;border-bottom:1px solid transparent}.perfv2 .perfv2-groups th.is-group{border-bottom:2px solid}.perfv2 td{padding:13px 12px;font-size:13px;border-bottom:1px solid ${C.border};white-space:nowrap}.perfv2 tbody tr:hover{background:${C.subtle}}.mp-scroll::-webkit-scrollbar{width:3px;height:3px}.mp-scroll::-webkit-scrollbar-track{background:transparent}.mp-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:4px}`}</style>

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

            {/* FILTERS HEADER : la Performance Sales porte son mois et l'actualisation dans son en-tête (dev 14/10/2026) */}
            {viewMode!=='perf_sales' && <div style={{minHeight:76,flexWrap:'wrap',background:darkMode?C.bg:'#f6f7f9',borderRadius:8,flexShrink:0,border:'1px solid '+C.border,marginLeft:8,display:'flex',alignItems:'center',padding:'12px 20px',gap:10}}>
              <>
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
              </>
            </div>}

            {/* CONTENT */}
            <div style={{flex:1,marginLeft:8}}>
              <div className="mp-scroll" style={{background:darkMode?C.bg:'#f6f7f9',borderRadius:8,border:'1px solid '+C.border,overflow:'auto',minHeight:viewMode==='perf_sales'?'calc(100vh - 16px)':'calc(100vh - 120px)',maxHeight:viewMode==='perf_sales'?'calc(100vh - 16px)':'calc(100vh - 120px)'}}>

                {viewMode==='perf_sales' && (<div className={'ps' + (darkMode ? ' ps-dark' : '')} style={{padding:'20px 20px 28px'}}>
                  {dataError && <div role="alert" style={{padding:16,color:C.text,border:`1px solid ${C.border}`,borderRadius:12}}>{dataError} <button onClick={()=>setRefreshKey(k=>k+1)} style={selS}>Réessayer</button></div>}
                  {sectionErrors.extra && <p role="alert" style={{color:C.secondary}}>Cette vue n’a pas pu être chargée. Utilisez « Actualiser » pour réessayer.</p>}

                  <>

                  {sectionErrors.rdv && <p role="alert" style={{fontSize:13,color:C.secondary}}>Les statistiques de rendez-vous n’ont pas pu être chargées.</p>}
                  {(
                    <PerfSalesV2 data={perfData} loading={dataLoading} dark={darkMode} period={range} tab={v2Tab} onTab={changeV2Tab} front={v2Front}
                      rdvDelay={rdvAnalytics?.delay_by_month || null}
                      controls={{ value: range, options: [...monthOpts(2025,9), { value: 'all', label: 'Toutes les périodes' }], onChange: setRange,
                        onRefresh: () => setRefreshKey(k => k + 1), loading: dataLoading }}
                      ventesData={salesBreakdown}
                      salesData={salesPerf} salesRange={salesRange} salesLoading={salesOwn && salesSide.loading}
                      rdvData={rdvPerf} rdvRange={rdvRange} rdvLoading={rdvSide.own && (rdvSide.loading || presenceData.loading)}
                      rdvPeriodBar={<PeriodBar period={presencePeriod} onPeriod={setPresencePeriod}
                        loading={rdvSide.own && (rdvSide.loading || presenceData.loading)} warning={rdvSide.error || presenceData.error ? 'Période non chargée' : null}
                        analytics={rdvPerf?.period ? { period: { start: rdvPerf.period.start, end: nextDay(rdvPerf.period.end) } } : null} />}
                      salesPeriodBar={<PeriodBar period={salesPeriod} onPeriod={setSalesPeriod} loading={salesSide.loading}
                        warning={salesSide.error ? 'Période non chargée' : null}
                        analytics={salesPerf?.period ? { period: { start: salesPerf.period.start, end: nextDay(salesPerf.period.end) } } : null} />}
                      salesNode={<div style={{display:'flex',flexDirection:'column',gap:12}}>
                        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                          {/* Les canaux du tableau se choisissent au-dessus (vue par canal) ; ici, la répartition des leads ADS par effectif. */}
                          <div className="ps2-segment"><button type="button" aria-pressed={adsDetailView} onClick={()=>{const on=!adsDetailView;setAdsDetailView(on);setCanal(on?'ads':'global');}}>{adsDetailView?'Retour au tableau':'Leads ADS par effectif'}</button></div>
                        </div>
                  {!sLoading && canal==='ads' && adsDetailView && (headcountLoading ? <div style={{textAlign:'center',padding:60,color:C.muted}}>Chargement...</div> : !headcountData ? <div style={{textAlign:'center',padding:60,color:C.muted}}>Le détail des effectifs n’a pas pu être chargé. Utilisez Actualiser pour réessayer.</div> : <table className="leaderboard" style={{width:'100%'}}><thead><tr>{['#','Sales','Leads','1-2','3-4','5-6','7-10','11-19','20+','Inconnu'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead><tbody>
                    {[...(headcountData.by_person||[])].sort((a,b)=>(b.leads_assigned||0)-(a.leads_assigned||0)).map((p,i)=>{const hc=p.headcount_breakdown||{};return(<tr key={p.person_name} style={{animation:'rowIn 0.3s cubic-bezier(0.16,1,0.3,1) '+(i*40)+'ms both'}}><td style={tdS}>{medal(i)}</td><td style={{...tdS,textAlign:'left',fontWeight:i<3?700:500,paddingLeft:12}}>{p.person_name}</td><td style={{...tdS,fontWeight:700}}>{(p.leads_assigned||0).toLocaleString('fr-FR')}</td>{['1-2','3-4','5-6','7-10','11-19','20+'].map(b=><td key={b} style={tdS}>{hc[b]||0}</td>)}<td style={{...tdS,color:C.muted}}>{p.unknown||0}</td></tr>);})}
                    {headcountData.totals && <tr style={{borderTop:'2px solid '+C.border,fontWeight:700,background:darkMode?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.02)'}}><td style={tdS}></td><td style={{...tdS,textAlign:'left',paddingLeft:12}}>Total</td><td style={tdS}>{(headcountData.totals.leads_assigned||0).toLocaleString('fr-FR')}</td>{['1-2','3-4','5-6','7-10','11-19','20+'].map(b=><td key={b} style={tdS}>{(headcountData.totals.headcount_breakdown||{})[b]||0}</td>)}<td style={{...tdS,color:C.muted}}>{headcountData.totals.unknown||0}</td></tr>}
                  </tbody></table>)}

                  {!sLoading && sRows.length>0 && !(canal==='ads'&&adsDetailView) && (()=>{
                    const visCols = perfColumns.filter(c=>(!c.crmOnly||sCrm)).filter(c=>c.always||!hiddenCols.has(c.key));
                    const toggleable = perfColumns.filter(c=>!c.always && (!c.crmOnly||sCrm));
                    return (<>
                    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10,position:'relative'}}>
                      <button onClick={()=>setColMenuOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:9,border:'1px solid '+C.border,background:darkMode?'#16171e':'#fff',color:C.text,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                        Colonnes{hiddenCols.size>0?` (${toggleable.filter(c=>!hiddenCols.has(c.key)).length}/${toggleable.length})`:''}
                      </button>
                      {colMenuOpen && (<>
                        <div onClick={()=>setColMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:40}} />
                        <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,zIndex:41,background:C.bg,border:'1px solid '+C.border,borderRadius:10,boxShadow:C.shadow,padding:8,minWidth:200,maxHeight:340,overflowY:'auto'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'2px 6px 8px',borderBottom:'1px solid '+C.border,marginBottom:4}}>
                            <span style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.04em'}}>Colonnes</span>
                            <button onClick={()=>setHiddenCols(new Set())} style={{border:'none',background:'transparent',color:COLORS.primary,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Tout afficher</button>
                          </div>
                          {toggleable.map(c=>{const on=!hiddenCols.has(c.key);return (<div key={c.key} onClick={()=>setHiddenCols(prev=>{const n=new Set(prev);n.has(c.key)?n.delete(c.key):n.add(c.key);return n;})} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 8px',borderRadius:7,cursor:'pointer',fontSize:13,fontWeight:500,color:on?C.text:C.muted,userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background=darkMode?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <span style={{width:16,height:16,borderRadius:5,border:'1.5px solid '+(on?COLORS.primary:C.border),background:on?COLORS.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>{on&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}</span>
                            {c.label}
                          </div>);})}
                        </div>
                      </>)}
                    </div>
                    <RevealBlock className="ps-rows" style={{overflowX:'auto'}}><table className="perfv2" style={{width:'100%',minWidth:Math.max(700,visCols.length*82)}}><thead>
                    <tr className="perfv2-groups">{columnGroups(visCols).map((g,i)=><th key={i} colSpan={g.span} className={g.label?'is-group':''} style={g.label?{color:g.color,borderBottomColor:g.color}:undefined}>{g.label}</th>)}</tr>
                    <tr>{visCols.map(c=><th key={c.key} style={{...thS,cursor:'help'}} onMouseEnter={e=>setTip({t:c.tip,r:e.currentTarget.getBoundingClientRect()})} onMouseLeave={()=>setTip(null)}>{c.label}</th>)}</tr></thead><tbody>
                    {sRows.map((s,i)=>(<tr key={canal+'-'+i+'-'+s.salesKey} style={{'--i':i}}>{visCols.map(c=>c.cell(s,i,c.key))}</tr>))}
                    <tr style={{'--i':sRows.length+1,fontWeight:750,background:C.subtle,borderTop:'2px solid '+C.border}}>{visCols.map(c=>c.key==='rank'?<td key={c.key} style={tdS}>Σ</td>:c.key==='sales'?<td key={c.key} style={{...tdS,textAlign:'left'}}>Total · {sRows.length} lignes</td>:['r1p','r2p','r1tel'].includes(c.key)?<td key={c.key} style={tdS}>{sTotals[{r1p:'r1_placed',r2p:'r2_placed',r1tel:'r1_phone'}[c.key]]}</td>:c.key==='appels'?<td key={c.key} style={tdS}>{sCallsLoading?'…':sTotals.calls_measured?sTotals.calls.toLocaleString('fr-FR'):'—'}</td>:c.cell(sTotals,-1,c.key))}</tr>
                    </tbody></table></RevealBlock>
                    </>);
                  })()}

                  {!sLoading && !dataError && !sRows.length && !adsDetailView && <div style={{textAlign:'center',padding:60,color:C.muted}}>Aucune donn&eacute;e disponible</div>}
                      </div>}
                      rdvNode={rdvAnalytics ? (()=>{
                        // Présence par jour et heure : toute l'équipe, une équipe ou un sales, sur la période choisie.
                        const src=presencePeriod.key==='month'?rdvAnalytics:presenceData.data;
                        const hbs=((src||rdvAnalytics).heatmap_by_sales||[]).filter(s=>isPerformanceSalesPerson(s.sales));
                        const teamsList=perfData?.pilotage?.teams||[];
                        const merge=(list,stage)=>{const m=new Map();for(const s of list)for(const c of (s[stage]||[])){const k=c.dow+'-'+c.hour;const v=m.get(k)||{dow:c.dow,hour:c.hour,showed:0,noshow:0};v.showed+=c.showed||0;v.noshow+=c.noshow||0;m.set(k,v);}return [...m.values()];};
                        const team=heatmapSales.startsWith('team:')?teamsList.find(t=>t.team===heatmapSales.slice(5)):null;
                        const picked=team?hbs.filter(s=>team.members?.includes(s.sales)):heatmapSales==='global'?null:hbs.filter(s=>s.sales===heatmapSales);
                        const cellsR1=picked?merge(picked,'r1'):src?.heatmap_r1||[];
                        const cellsR2=picked?merge(picked,'r2'):src?.heatmap_r2||[];
                        // RDV sans heure : hors grille, comptés dans la présence (mêmes RDV que les cartes R1/R2).
                        const untimedOf=(stage)=>picked?picked.reduce((a,s)=>({showed:a.showed+(s[stage+'_untimed']?.showed||0),noshow:a.noshow+(s[stage+'_untimed']?.noshow||0)}),{showed:0,noshow:0}):src?.heatmap_untimed?.[stage]||null;
                        const who=heatmapSales==='global'?'Toute l’équipe':team?team.team:heatmapSales;
                        return (
                          <div className="ps2-grid">
                            <Reveal as="section" key={heatmapSales+presencePeriod.key} className="ps2-card ps2-span-12" aria-labelledby="ps2-heat-title">
                              <div className="ps2-card-head"><h2 id="ps2-heat-title">Présence par jour et heure</h2>
                                <label className="ps2-month is-small"><span>{who}</span>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                                  <select aria-label="Équipe ou sales" value={heatmapSales} onChange={e=>setHeatmapSales(e.target.value)}>
                                    <option value="global">Toute l’équipe</option>
                                    {teamsList.length>0 && <optgroup label="Équipes">{teamsList.map(t=><option key={t.team} value={'team:'+t.team}>{t.team}</option>)}</optgroup>}
                                    <optgroup label="Sales">{hbs.map(s=><option key={s.sales} value={s.sales}>{s.sales}</option>)}</optgroup>
                                  </select></label></div>
                              {presencePeriod.key!=='month'&&presenceData.error ? <div className="ps2-empty" role="alert">Période non chargée</div> : (
                                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',gap:16,marginTop:14}}>
                                  <PresenceGrid cells={cellsR1} title="R1" untimed={untimedOf('r1')} />
                                  <PresenceGrid cells={cellsR2} title="R2" untimed={untimedOf('r2')} />
                                </div>
                              )}
                            </Reveal>
                          </div>
                        );
                      })() : null}
                      reactivityNode={<Reactivity analytics={reactPeriod.key==='month'?rdvAnalytics:reactData.data} period={reactPeriod} onPeriod={setReactPeriod}
                        loading={reactPeriod.key==='month'?!rdvAnalytics&&!sectionErrors.rdv:reactData.loading} error={reactPeriod.key==='month'?sectionErrors.rdv:reactData.error}
                        warning={reactPeriod.key==='month' && /^\d{4}-\d{2}$/.test(range) && range < '2026-04' ? 'Délais fiables à partir d’avril 2026' : null}
                        dark={darkMode} salesFilter={isPerformanceSalesPerson} />} />
                  )}
                  </>
                </div>)}

                {viewMode==='lead_quality' && (<div style={{padding:'20px 20px 28px'}}>
                  <h2 style={{fontSize:20,fontWeight:700,color:C.text,margin:'0 0 4px'}}>Qualit&eacute; Leads</h2>
                  <p style={{fontSize:13,color:C.muted,margin:'0 0 20px'}}>Analyse par origine</p>

                  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:24}}>
                    {[{l:'Total Leads',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.total_leads:0).toLocaleString('fr-FR')},{l:'Clients r\u00e9els',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.total_sales:0).toLocaleString('fr-FR'),a:COLORS.tertiary},{l:'Taux Perte',v:leadQualityData&&leadQualityData.summary&&leadQualityData.summary.global_loss_rate!=null?leadQualityData.summary.global_loss_rate.toFixed(1)+'%':'\u2014'},{l:'Non trait\u00e9s',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.total_untreated:0).toLocaleString('fr-FR')},{l:'Tx Conv.',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.global_conversion_rate:0).toFixed(1)+'%',a:COLORS.tertiary},{l:'Tx Conv. R\u00e9el',v:(leadQualityData&&leadQualityData.summary?leadQualityData.summary.global_real_conversion_rate:0).toFixed(1)+'%',a:COLORS.tertiary},{l:'Cash Total',v:leadQualityData&&leadQualityData.summary&&leadQualityData.summary.total_cash>0?Math.round(leadQualityData.summary.total_cash).toLocaleString('fr-FR')+'\u20ac':'0\u20ac',a:COLORS.tertiary},{l:'ARR Total',v:leadQualityData&&leadQualityData.summary&&leadQualityData.summary.total_arr>0?Math.round(leadQualityData.summary.total_arr).toLocaleString('fr-FR')+'\u20ac':'0\u20ac',a:COLORS.secondary}].map(k=>(<div key={k.l} style={{flex:1,minWidth:100,padding:'10px 14px',borderRadius:10,background:darkMode?C.subtle:'#fff',border:'1px solid '+C.border}}><div style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:'uppercase',marginBottom:4}}>{k.l}</div><div style={{fontSize:18,fontWeight:700,color:k.a||C.text}}>{leadQualityLoading ? '—' : k.v}</div></div>))}
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
          {!detailModal.loading && detailModal.data && (detailModal.type==='ads' || detailModal.data.leads?.length > 0) && (<><p style={{fontSize:13,color:C.muted,marginBottom:10}}>{detailModal.data.total||detailModal.data.leads&&detailModal.data.leads.length||0} leads</p><table className="leaderboard" style={{width:'100%'}}><thead><tr style={{borderBottom:'2px solid '+C.border}}>{['Nom','T\u00e9l\u00e9phone','Origine','Date'].map(h=><th key={h} style={{...thS,textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{(detailModal.data.leads||[]).map((l,idx)=>(<tr key={idx}><td style={{...tdS,textAlign:'left',fontWeight:500}}>{l.full_name}</td><td style={{...tdS,textAlign:'left',fontFamily:'monospace',fontSize:11}}>{l.phone}</td><td style={{...tdS,textAlign:'left'}}>{l.origin}</td><td style={{...tdS,textAlign:'left',whiteSpace:'nowrap'}}>{l.date}</td></tr>))}</tbody></table></>)}
          {!detailModal.loading && detailModal.data && detailModal.type==='cc' && detailModal.data.entries?.length > 0 && (<><p style={{fontSize:13,color:C.muted,marginBottom:10}}>{detailModal.data.total_entries||detailModal.data.entries&&detailModal.data.entries.length||0} jours historiques &middot; {detailModal.data.total_appels?detailModal.data.total_appels.toLocaleString('fr-FR'):0} appels</p><table className="leaderboard" style={{width:'100%'}}><thead><tr style={{borderBottom:'2px solid '+C.border}}><th style={{...thS,textAlign:'left'}}>Date</th><th style={thS}>Nombre d&apos;appels</th></tr></thead><tbody>{(detailModal.data.entries||[]).map((e,idx)=>(<tr key={idx}><td style={{...tdS,textAlign:'left',fontWeight:500}}>{e.date}</td><td style={{...tdS,fontWeight:600}}>{e.nbr_appel?e.nbr_appel.toLocaleString('fr-FR'):0}</td></tr>))}</tbody></table></>)}
        </div>
      </div>)}
    </>
  );
}
