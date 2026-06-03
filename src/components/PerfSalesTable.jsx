// PerfSalesTable.jsx
// Composant embarque du tableau Perf Sales pour l'onglet KPIs & Stats du
// TrackingSheet (visible head_of_sales / head_of_sales_manager / admin uniquement).
// Reprend la logique du tableau de MonitoringPerf.jsx (memes calculs, meme rendu).
// Pas de Lead Quality ni de detail Funnel ADS dans cette version compacte.

import { useEffect, useMemo, useState } from "react";
import apiClient from "../services/apiClient";

const COLORS = { primary: "#6366f1", secondary: "#fb923c", tertiary: "#10b981" };

const stripDiacritics = (str) => str ? str.normalize("NFD").replace(/[̀-ͯ]/g, "") : "";
const normalizeSalesKey = (name) => {
  if (!name) return "unknown";
  return stripDiacritics(name).toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z\s'-]/g, "");
};

const NAME_VARIANTS_TO_CANONICAL = {
  "kyle dif": "kail", "kail": "kail", "kyle": "kail",
  "yohan": "yohan debowski", "yohan debowski": "yohan debowski", "debowski": "yohan debowski",
  "leo": "leo mafrici", "leo mafrici": "leo mafrici", "mafrici": "leo mafrici",
  "yanis": "yanis zairi", "yanis zairi": "yanis zairi", "zairi": "yanis zairi",
  "alex": "alex gaudrillet", "alex gaudrillet": "alex gaudrillet", "gaudrillet": "alex gaudrillet",
  "alexandre voratovic": "alexandre voratovic", "voratovic": "alexandre voratovic",
  "sebastien": "sebastien itema", "sebastien itema": "sebastien itema", "itema": "sebastien itema",
  "gwenael": "gwenael", "gwenael derouet": "gwenael", "derouet": "gwenael",
  "david": "david dubois", "david dubois": "david dubois", "dubois": "david dubois",
  "mehdi": "mehdi bouffessil", "mehdi bouffessil": "mehdi bouffessil", "bouffessil": "mehdi bouffessil",
  "mehdi mestiri": "mehdi mestiri", "mestiri": "mehdi mestiri",
  "jeanchristophe limbourg": "jeanchristophe limbourg", "limbourg": "jeanchristophe limbourg",
  "gary meynier": "gary meynier", "gary": "gary meynier", "meynier": "gary meynier",
  "michael streicher": "michael streicher", "streicher": "michael streicher",
  "youcef amrane": "youcef amrane", "amrane": "youcef amrane",
};

const CANONICAL_DISPLAY_NAMES = {
  "yohan debowski": "Yohan Debowski", "leo mafrici": "Léo Mafrici",
  "yanis zairi": "Yanis Zaïri", "alex gaudrillet": "Alex Gaudrillet",
  "alexandre voratovic": "Alexandre VORATOVIC",
  "sebastien itema": "Sébastien ITEMA", "david dubois": "David Dubois",
  "gwenael": "Gwenaël Derouet", "jeanchristophe limbourg": "Jean-Christophe Limbourg",
  "mehdi mestiri": "Mehdi Mestiri", "mehdi bouffessil": "Mehdi BOUFFESSIL",
  "gary meynier": "Gary Meynier", "michael streicher": "Michael STREICHER",
  "kail": "Kaïl", "youcef amrane": "Youcef Amrane",
};

const getCanonicalKey = (rawName) => { const n = normalizeSalesKey(rawName); return NAME_VARIANTS_TO_CANONICAL[n] || n; };
const displaySalesName = (rawName) => { const k = getCanonicalKey(rawName); return CANONICAL_DISPLAY_NAMES[k] || (rawName ? rawName.trim() : "Unknown"); };
const EXCLUDED_KEYS = new Set(["mohamed bouaksa", "sara benabid", "sarah amroune"]);

export default function PerfSalesTable({ darkMode, C }) {
  const [range, setRange] = useState(() => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); });
  const [canal, setCanal] = useState("global");
  const [perfData, setPerfData] = useState(null);
  const [trackingKpis, setTrackingKpis] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    setDataLoading(true);
    const period = range === "all" ? "all" : range.match(/^\d{4}-\d{2}$/) ? range : "current_month";
    apiClient.get('/api/v1/monitoring/performance/v2?period=' + period)
      .then(d => setPerfData(d))
      .catch(() => setPerfData(null))
      .finally(() => setTimeout(() => setDataLoading(false), 150));
  }, [range]);

  useEffect(() => {
    if (range && range !== 'all' && range.match(/^\d{4}-\d{2}$/)) {
      apiClient.get('/api/v1/tracking/perf-sales-kpis?month=' + range)
        .then(d => setTrackingKpis(d))
        .catch(() => setTrackingKpis(null));
    } else {
      setTrackingKpis(null);
    }
  }, [range]);

  const trackingLookup = useMemo(() => {
    if (!trackingKpis || !trackingKpis.by_sales) return { byEmail: {}, byName: {} };
    const byEmail = {}; const byName = {};
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
    const arr = vd.by_person.filter(p => !EXCLUDED_KEYS.has(getCanonicalKey(p.name))).filter(p => (p.leads_assigned || 0) > 0 || (p.nbr_signature || 0) > 0).map(p => {
      const ct = p.nbr_appel || 0, ca = p.nbr_appel_d || 0, sig = p.nbr_signature || 0, rev = p.total_revenue || 0, cash = p.total_cash || 0, la = p.leads_assigned || 0, lads = p.leads_ads || 0, lcc = p.leads_cc || 0, ua = p.unique_attempted || 0, uan = p.unique_answered || 0;
      const key = getCanonicalKey(p.name);
      const nameIsEmail = (p.name || '').includes('@');
      const pEmail = (p.email || (nameIsEmail ? p.name : '') || '').trim().toLowerCase();
      const tk = (pEmail && trackingLookup.byEmail[pEmail]) || trackingLookup.byName[key] || null;
      const r1p = tk ? tk.r1_placed : (p.r1p || 0);
      const r1d = tk ? tk.r1_done : (p.r1r || 0);
      const r2p = tk ? tk.r2_placed : (p.r2p || 0);
      const r2d = tk ? tk.r2_done : (p.r2r || 0);
      const convSales = tk && tk.conv_v != null ? tk.conv_v : (r2d > 0 ? (sig / r2d) * 100 : 0);
      const resolvedName = nameIsEmail && tk?.sales_name ? tk.sales_name : displaySalesName(p.name);
      const resolvedKey = nameIsEmail && tk ? getCanonicalKey(tk.sales_name) : key;
      return { salesName: resolvedName, salesKey: resolvedKey, calls_total: ct, calls_answered: ca, r1_placed: r1p, r1_done: r1d, r2_placed: r2p, r2_done: r2d, signatures: sig, revenue: rev, cashCollected: cash, leads_assigned: la, leads_ads: lads, leads_cc: lcc, unique_attempted: ua, unique_answered: uan, conv_global: p.conversion_global || (la > 0 ? (sig / la) * 100 : 0), conv_calls_to_answered: p.conv_calls_to_answered || (ct > 0 ? (ca / ct) * 100 : 0), conv_answered_to_r1p: ca > 0 ? (r1p / ca) * 100 : 0, conv_r1p_to_r1r: r1p > 0 ? (r1d / r1p) * 100 : 0, conv_r2p_to_r2r: r2p > 0 ? (r2d / r2p) * 100 : 0, conv_sales: convSales };
    });
    const seen = new Set(); const deduped = arr.filter(p => { if (seen.has(p.salesKey)) return false; seen.add(p.salesKey); return true; });
    deduped.sort((a, b) => b.signatures !== a.signatures ? b.signatures - a.signatures : b.conv_global !== a.conv_global ? b.conv_global - a.conv_global : b.calls_total - a.calls_total);
    return deduped;
  }, [perfData, canal, trackingLookup]);

  const totals = useMemo(() => {
    if (!performanceData.length) return { calls: 0, answered: 0, signatures: 0, revenue: 0, cashCollected: 0, r1_placed: 0, r1_done: 0, r2_placed: 0, r2_done: 0, leads_assigned: 0, unique_attempted: 0, unique_answered: 0, conv_global: 0, lead_qualifie: 0, closing_r1: 0, closing_r2: 0, closing_audit: 0 };
    const t = performanceData.reduce((a, s) => ({ calls: a.calls + s.calls_total, answered: a.answered + s.calls_answered, r1_placed: a.r1_placed + s.r1_placed, r1_done: a.r1_done + s.r1_done, r2_placed: a.r2_placed + s.r2_placed, r2_done: a.r2_done + s.r2_done, signatures: a.signatures + s.signatures, revenue: a.revenue + s.revenue, cashCollected: a.cashCollected + s.cashCollected, leads_assigned: a.leads_assigned + s.leads_assigned, unique_attempted: a.unique_attempted + s.unique_attempted, unique_answered: a.unique_answered + s.unique_answered }), { calls: 0, answered: 0, r1_placed: 0, r1_done: 0, r2_placed: 0, r2_done: 0, signatures: 0, revenue: 0, cashCollected: 0, leads_assigned: 0, unique_attempted: 0, unique_answered: 0 });
    return { ...t, lead_qualifie: t.leads_assigned > 0 ? (t.unique_answered / t.leads_assigned) * 100 : 0, closing_r1: t.unique_answered > 0 ? (t.r1_done / t.unique_answered) * 100 : 0, closing_r2: t.r1_done > 0 ? (t.r2_done / t.r1_done) * 100 : 0, closing_audit: t.r2_done > 0 ? (t.signatures / t.r2_done) * 100 : 0, conv_global: t.leads_assigned > 0 ? (t.signatures / t.leads_assigned) * 100 : 0 };
  }, [performanceData]);

  const gcColor = (tx) => tx >= 5 ? COLORS.tertiary : tx >= 2 ? COLORS.secondary : C.text;
  const dcColor = (tx) => tx >= 80 ? COLORS.tertiary : tx >= 50 ? COLORS.secondary : '#ff453a';
  const rxColor = (tx) => tx >= 80 ? COLORS.tertiary : tx >= 50 ? COLORS.secondary : '#ff453a';
  const cvColor = (tx) => tx >= 40 ? COLORS.tertiary : tx >= 20 ? COLORS.secondary : C.text;
  const r1pColor = (tx) => tx >= 30 ? COLORS.tertiary : tx >= 15 ? COLORS.secondary : C.text;

  const monthOpts = (sy, sm) => { const o = []; const td = new Date(); const c = new Date(sy, sm - 1); const ym = td.getFullYear() * 100 + td.getMonth(); while (true) { const y = c.getFullYear() * 100 + c.getMonth(); if (y > ym) break; const v = c.getFullYear() + '-' + String(c.getMonth() + 1).padStart(2, '0'); const l = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(c); o.unshift({ value: v, label: l.charAt(0).toUpperCase() + l.slice(1) }); c.setMonth(c.getMonth() + 1); } return o; };
  const selS = { fontSize: 12, fontWeight: 500, padding: '6px 10px', borderRadius: 8, border: '1px solid ' + C.border, background: darkMode ? C.subtle : '#fff', color: C.text, cursor: 'pointer', outline: 'none' };
  const pillS = (a) => ({ fontSize: 11.5, fontWeight: a ? 600 : 500, padding: '5px 14px', borderRadius: 8, border: '1px solid ' + (a ? C.accent : C.border), background: a ? (darkMode ? C.accent + '25' : C.accent + '12') : 'transparent', color: a ? C.accent : C.muted, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' });
  const thS = { whiteSpace: 'nowrap', textAlign: 'center' };
  const tdS = { textAlign: 'center' };

  return (
    <div style={{ padding: '0 28px 24px', overflowY: 'auto', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', borderBottom: '1px solid ' + C.border, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Perf. Sales</h2>
        <div style={{ flex: 1 }} />
        <select value={range} onChange={e => setRange(e.target.value)} style={selS}>
          {monthOpts(2025, 9).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          <option value="all">All time</option>
        </select>
        <div style={{ width: 1, height: 28, background: C.border }} />
        {['global', 'ads', 'cc'].map(c => (
          <button key={c} onClick={() => setCanal(c)} style={pillS(canal === c)}>
            {c === 'global' ? 'Global' : c.toUpperCase()}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { l: 'Appels', v: totals.calls.toLocaleString('fr-FR') },
          { l: 'Décrochés', v: totals.answered.toLocaleString('fr-FR') },
          { l: 'R1 effectué', v: totals.r1_done.toLocaleString('fr-FR') },
          { l: 'Leads', v: totals.leads_assigned.toLocaleString('fr-FR') },
          { l: 'Ventes', v: totals.signatures.toLocaleString('fr-FR'), a: COLORS.tertiary },
          { l: 'Revenue', v: totals.revenue > 0 ? Math.round(totals.revenue).toLocaleString('fr-FR') + '€' : '0€', a: COLORS.secondary },
          { l: 'Cash', v: totals.cashCollected > 0 ? Math.round(totals.cashCollected).toLocaleString('fr-FR') + '€' : '0€', a: COLORS.tertiary },
        ].map(k => (
          <div key={k.l} style={{ flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 10, background: darkMode ? C.subtle : '#fff', border: '1px solid ' + C.border, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: C.muted, textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>{k.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.a || C.text }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Conversion ratios bar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 20, borderRadius: 10, border: '1px solid ' + C.border, overflow: 'hidden', background: darkMode ? C.subtle : '#fff' }}>
        {[
          ...(canal !== 'cc' ? [{ l: 'Lead Qualifié', v: totals.lead_qualifie.toFixed(1) + '%' }] : []),
          { l: 'Closing R1', v: totals.closing_r1.toFixed(1) + '%' },
          { l: 'Closing R2', v: totals.closing_r2.toFixed(1) + '%' },
          { l: 'Closing Audit', v: totals.closing_audit.toFixed(1) + '%' },
          { l: 'Conv. Globale', v: totals.conv_global.toFixed(2) + '%' },
        ].map((k, i, arr) => (
          <div key={k.l} style={{ flex: 1, textAlign: 'center', padding: '10px 16px', borderRight: i < arr.length - 1 ? '1px solid ' + C.border : 'none' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginBottom: 2 }}>{k.l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {dataLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Chargement...</div>
      ) : performanceData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Aucune donn&eacute;e pour cette p&eacute;riode</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="leaderboard" style={{ width: '100%', minWidth: 1100 }}>
            <thead>
              <tr>
                {['#', 'Sales', 'Leads', 'Conv.%', 'Appels', 'Décr.', 'Tx Décr.', 'R1/Décr', 'R1p', 'R1E', 'Tx R1', 'R2p', 'R2E', 'Tx R2', 'Ventes', 'Conv.V.', 'Revenue', 'Cash'].map(h => <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {performanceData.map((s, i) => (
                <tr key={canal + '-' + i + '-' + s.salesKey}>
                  <td style={tdS}>{i + 1}</td>
                  <td style={{ ...tdS, textAlign: 'left', paddingLeft: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? COLORS.tertiary : i === 1 ? COLORS.secondary : COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 600, flexShrink: 0 }}>{s.salesName.charAt(0).toUpperCase()}</div>
                      <span style={{ fontWeight: i < 3 ? 700 : 500, fontSize: 12, whiteSpace: 'nowrap' }}>{s.salesName}</span>
                    </div>
                  </td>
                  <td style={{ ...tdS, fontWeight: 700 }}>{canal === 'ads' ? (s.leads_ads || 0) : canal === 'cc' ? (s.leads_cc || 0) : (s.leads_assigned || 0)}</td>
                  <td style={{ ...tdS, fontWeight: 700, color: gcColor(s.conv_global) }}>{s.conv_global.toFixed(2)}%</td>
                  <td style={tdS}>{s.calls_total.toLocaleString('fr-FR')}</td>
                  <td style={tdS}>{s.calls_answered.toLocaleString('fr-FR')}</td>
                  <td style={{ ...tdS, fontWeight: 600, color: dcColor(s.conv_calls_to_answered) }}>{s.conv_calls_to_answered.toFixed(1)}%</td>
                  <td style={{ ...tdS, fontWeight: 600, color: r1pColor(s.conv_answered_to_r1p) }}>{s.conv_answered_to_r1p.toFixed(1)}%</td>
                  <td style={tdS}>{s.r1_placed}</td>
                  <td style={tdS}>{s.r1_done}</td>
                  <td style={{ ...tdS, fontWeight: 600, color: rxColor(s.conv_r1p_to_r1r) }}>{s.conv_r1p_to_r1r.toFixed(0)}%</td>
                  <td style={tdS}>{s.r2_placed}</td>
                  <td style={tdS}>{s.r2_done}</td>
                  <td style={{ ...tdS, fontWeight: 600, color: rxColor(s.conv_r2p_to_r2r) }}>{s.conv_r2p_to_r2r.toFixed(0)}%</td>
                  <td style={{ ...tdS, fontWeight: 800, fontSize: 13, color: COLORS.tertiary }}>{s.signatures}</td>
                  <td style={{ ...tdS, fontWeight: 600, color: cvColor(s.conv_sales) }}>{s.conv_sales.toFixed(1)}%</td>
                  <td style={{ ...tdS, color: COLORS.secondary }}>{s.revenue > 0 ? Math.round(s.revenue).toLocaleString('fr-FR') + '€' : '—'}</td>
                  <td style={{ ...tdS, color: COLORS.tertiary }}>{s.cashCollected > 0 ? Math.round(s.cashCollected).toLocaleString('fr-FR') + '€' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
