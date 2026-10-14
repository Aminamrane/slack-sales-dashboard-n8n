// Modèle unique de la Performance Sales v2 (dev 14/10/2026, « cohérence ») : chaque chiffre de la page vient d'ici, avec
// sa définition, son calcul étape par étape et ses répartitions. Les mêmes totaux servent l'en-tête, l'entonnoir, les
// canaux, le panneau de vérification et la liste des dossiers (le backend contrôle que canaux = entonnoir).
import { isPerformanceSalesPerson } from '../../../utils/performanceSales.js';

export const SOURCES = [
  { key: 'affectation', label: 'ADS affectés', color: '#1e3a7b', group: 'origin' },
  { key: 'pool', label: 'ADS repris du pool', color: '#7f9ad9', group: 'origin' },
  { key: 'ccs', label: 'Cold call setter', color: '#4f9a72', group: 'origin' },
  { key: 'cold_call', label: 'Cold call sales', color: '#8b95a7', group: 'origin' },
  { key: 'webinar', label: 'Webinaire', color: '#e6b45a', group: 'origin' },
  { key: 'linkedin', label: 'LinkedIn', color: '#d4834a', group: 'origin' },
  { key: 'referral', label: 'Parrainage', color: '#b85c78', group: 'origin' },
  { key: 'setter_rdv', label: 'Traités par un setter', color: '#2c6448', group: 'setter' },
  { key: 'second_chance', label: 'Seconde chance', color: '#a9d6bb', group: 'setter' },
  { key: 'other', label: 'Lead non retrouvé', color: '#c9cfda', group: 'origin' },
];
export const sourceOf = (key) => SOURCES.find((s) => s.key === key) || SOURCES[SOURCES.length - 1];

// Étape du modèle → étape de la partition (canaux) et champ des lignes du tableau.
export const METRICS = {
  leads: { label: 'Leads reçus', step: 'received', field: 'leads_assigned', stage: 'leads',
    definition: 'Leads attribués à un sales pour la première fois dans la période, une fois par sales et par contact',
    source: 'fiche lead · date de réception, commercial' },
  r1e: { label: 'R1 effectués', step: 'r1_done', field: 'r1r', stage: 'r1e',
    definition: 'R1 dont la date prévue tombe dans la période et qualifiés « effectué » sur la fiche',
    source: 'fiche lead · r1_date, r1_result' },
  r2e: { label: 'R2 effectués', step: 'r2_done', field: 'r2r', stage: 'r2e',
    definition: 'R2 dont la date prévue tombe dans la période et qualifiés « effectué » sur la fiche',
    source: 'fiche lead · r2_date, r2_result' },
  signed: { label: 'Signatures', step: 'signed', field: 'nbr_signed', stage: null,
    definition: 'Contrats Owner signés sur Yousign dans la période, au commercial du contrat',
    source: 'contrats · signed_at, commercial' },
  sales: { label: 'Ventes déclarées', step: 'sales', field: 'nbr_signature', stage: 'sales',
    definition: 'Déclarations de vente de la période : le chiffre de l’objectif du mois, le même que le Suivi des ventes',
    source: 'déclarations de vente · date de déclaration, commercial' },
};
export const FUNNEL = ['leads', 'r1e', 'r2e', 'signed', 'sales'];

export const fr = (n, d = 0) => (n == null || Number.isNaN(n) ? '–' : Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const euro = (n) => `${fr(Math.round(n || 0))} €`;
export const signedNum = (n) => (n == null ? '' : n > 0 ? `+${fr(n)}` : n < 0 ? `−${fr(-n)}` : '0');
export const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
export const initials = (name) => String(name || '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

export function buildModel(data, front = {}) {
  if (!data?.global_view) return null;
  const rows = (data.global_view.by_person || []).filter((r) => isPerformanceSalesPerson(r.name));
  const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const t = Object.fromEntries(['leads_assigned', 'leads_ads', 'leads_cc', 'r1p', 'r1r', 'r1_due', 'r1_done_due', 'r1_open', 'r1_noshow', 'r2p', 'r2r',
    'r2_due', 'r2_done_due', 'r2_open', 'r2_noshow', 'nbr_signed', 'nbr_signature', 'total_revenue', 'total_cash', 'r1_phone'].map((k) => [k, sum(k)]));
  const pilot = data.pilotage || null;
  const views = data.partition?.views || null;
  const stageOf = (key) => pilot?.stages?.find((s) => s.key === key) || null;
  const today = pilot?.days?.today;
  const period = data.period || {};
  const periodText = `du ${dm(period.start)} au ${dm(today || period.end)}`;

  const value = { leads: t.leads_assigned, r1e: t.r1r, r2e: t.r2r, signed: t.nbr_signed, sales: t.nbr_signature };
  const metric = (key) => {
    const m = METRICS[key];
    const st = m.stage ? stageOf(m.stage) : null;
    const byChannel = views?.global?.[m.step] || {};
    const bySales = rows.map((r) => ({ name: r.name, value: Number(r[m.field]) || 0 })).filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    return { key, ...m, value: value[key], expected: st?.expected ?? null, gap: st?.gap ?? null, target: st?.target ?? null,
      byChannel, bySales, trail: trail(key), period: `${periodText}, ${key === 'leads' ? 'date de réception' : key === 'signed' ? 'date de signature' : key === 'sales' ? 'date de déclaration' : 'date du rendez-vous'}, heure de Paris`,
      expectedText: expectedText(key, st) };
  };

  function expectedText(key, st) {
    if (!st || st.expected == null || !pilot) return null;
    const days = pilot.days;
    const r = pilot.ratios || {};
    const chain = { sales: '', r2e: ` × ${fr(r.r2e_per_sale, 2)} R2E par vente`, r1e: ` × ${fr(r.r2e_per_sale, 2)} × ${fr(r.r1e_per_r2e, 2)}`,
      leads: ` × ${fr(r.r2e_per_sale, 2)} × ${fr(r.r1e_per_r2e, 2)} × ${fr(r.leads_per_r1e, 2)}` }[key];
    return `${fr(pilot.objective)} ventes${chain} × ${days.elapsed} jours sur ${days.total} = ${fr(st.expected)}${key !== 'sales' ? ' (taux du mois précédent)' : ''}`;
  }

  function trail(key) {
    if (key === 'leads') {
      // Pont avec les « leads reçus » de Funnel Leads (dev 14/10/2026 : « qui ment sur les leads ads ? ») : les fiches
      // entrantes du mois, celles jamais données à un sales (motif du moteur d'affectation), puis les leads de la page.
      const it = pilot?.intake;
      const nd = it?.not_given || {};
      return [
        ...(it ? [
          { text: `[${fr(it.created)} fiches entrantes créées (ADS, simulateur, webinaire, LinkedIn…), comme Funnel Leads]`, tone: 'strong' },
          ...[['small', 'moins de 100 k€, écartés par le moteur'], ['duplicate', 'doublons d’un contact déjà reçu'], ['webinar', 'inscrits webinaire pris par les setters'],
            ['unclassifiable', 'fiches non classables (tests)'], ['waiting', 'pas encore attribuées']]
            .filter(([k]) => nd[k]).map(([k, l]) => ({ text: `→ ${fr(nd[k])} ${l}`, indent: 1 })),
          { text: `= ${fr(it.given)} données à un sales, ${fr(it.page_ads)} leads ADS ici (une fois par sales et par contact)`, tone: 'total' },
        ] : []),
        { text: `[${fr(t.leads_assigned)} leads reçus par les sales]`, tone: 'strong' },
        { text: `→ ${fr(t.leads_ads)} ADS`, indent: 1 },
        { text: `→ ${fr(t.leads_cc)} cold call et setters`, indent: 1 },
      ];
    }
    if (key === 'r1e' || key === 'r2e') {
      const s = key === 'r1e' ? 'r1' : 'r2';
      const placed = t[`${s}p`], due = t[`${s}_due`], done = t[`${s}_done_due`], open = t[`${s}_open`];
      const early = t[`${s}r`] - done;
      return [
        { text: `[${fr(placed)} ${s.toUpperCase()} posés dans la période]`, tone: 'strong' },
        { text: `→ ${fr(placed - due)} à venir`, indent: 1 },
        { text: `→ ${fr(due)} passés`, indent: 1 },
        { text: `→ ${fr(done)} effectués`, indent: 2, tone: 'good' },
        { text: `→ ${fr(due - done - open)} absents ou annulés`, indent: 2 },
        { text: `→ ${fr(open)} pas encore qualifiés`, indent: 2 },
        ...(early > 0 ? [{ text: `[+ ${fr(early)} qualifiés « effectués » avant leur date]  ! à corriger`, tone: 'warn' }] : []),
        { text: `= ${fr(t[`${s}r`])} ${s.toUpperCase()} effectués`, tone: 'total' },
      ];
    }
    if (key === 'signed') return [
      { text: `[${fr(t.nbr_signed)} contrats signés sur Yousign]`, tone: 'strong' },
      { text: `→ ${fr(t.nbr_signature)} ventes déclarées dans la période`, indent: 1 },
      { text: `→ écart de ${fr(Math.abs(t.nbr_signed - t.nbr_signature))} : signées pas encore déclarées, ou déclarées sur un autre mois`, indent: 1 },
    ];
    return [
      { text: `[${fr(t.nbr_signature)} déclarations de vente]`, tone: 'strong' },
      { text: `→ CA déclaré ${euro(t.total_revenue)}`, indent: 1 },
      { text: `→ cash déclaré ${euro(t.total_cash)}`, indent: 1 },
    ];
  }

  const metrics = Object.fromEntries(Object.keys(METRICS).map((k) => [k, metric(k)]));
  const conversions = FUNNEL.slice(1).map((k, i) => pct(value[k], value[FUNNEL[i]]));

  const podium = [...rows].filter((r) => (r.nbr_signature || 0) > 0)
    .sort((a, b) => (b.nbr_signature - a.nbr_signature) || (b.total_revenue - a.total_revenue)).slice(0, 3);

  const checks = [...(pilot?.checks || [])];
  if (front.callsMissing?.length) checks.push({ key: 'allo', ok: null, label: `Appels non relevés pour ${front.callsMissing.join(', ')} (hors Allo)` });

  const journeys = data.partition?.journeys || null;
  return { rows, totals: t, pilot, views, journeys, metrics, value, conversions, podium, checks, periodText, period,
    cohort: pilot?.cohort || null, calls: front.calls || null, avatarFor: front.avatarFor || null,
    byPerson: data.partition?.by_person || null };
}
