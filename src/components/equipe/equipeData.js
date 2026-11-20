// src/components/equipe/equipeData.js
//
// Données de la page Équipe (/ceo/sales-team et onglet « Équipe Sales » du /ceo) : fonctions pures, sans React ni réseau
// (testées dans equipeData.test.js). Aucune donnée inventée : tout vient des routes existantes ; une valeur inconnue reste null
// (la page affiche « — », jamais 0).
//   · groupSales    : les commerciaux regroupés par équipe (capitaine en tête), « Sans équipe » en dernier ;
//   · withSales     : y ajoute les ventes du mois (leaderboard/stats) par personne et par équipe ;
//   · listSetters   : les setters, UNE fois chacun, à plat (plus d'équipes côté setters) : sales suivis, mode d'arrivée des leads,
//                     RDV posés / qualifiés / ventes du mois (leaderboard/setters).

import { getCanonicalKey } from '../../utils/salesNames.js';

const NEUTRAL = '#64748b';
const INK = '#121b35';

// Initiales d'un nom (deux lettres) ; « ? » sans nom.
export const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Comptes à ne jamais afficher : désactivés (les routes ne renvoient que des comptes actifs ; garde-fou si un champ d'activité apparaît), admin / test côté sales,
// test côté setters (règles d'origine de la page).
export const isInactive = (u) => u?.is_active === false || u?.active === false;
export const isTestOrAdmin = (u) =>
  u?.role === 'admin' || /@test\.com$/i.test(u?.email || '') || /\btest\b/i.test(u?.full_name || '');
export const isTestSetter = (s) => /@test\.com$/i.test(s?.email || '') || /\btest\b/i.test(s?.full_name || '');

// ── Couleurs d'équipe (#rgb / #rrggbb) : lisibilité du texte. Une couleur inconnue (nom CSS, rgb()…) n'est jamais modifiée. ──
const parseHex = (color) => {
  const c = String(color || '').trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return null;
  const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const INK_RGB = parseHex(INK);

// Couleur d'équipe utilisée COMME texte sur fond blanc : elle-même si le contraste atteint 5,4:1 (marge pour les étiquettes teintées, qui assombrissent le fond), sinon
// assombrie vers l'encre jusqu'à l'atteindre. null si la couleur n'est pas un code hexadécimal (le CSS garde alors la couleur telle quelle).
export const legibleOnWhite = (color) => {
  const rgb = parseHex(color);
  if (!rgb) return null;
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const mixed = rgb.map((v, i) => v + (INK_RGB[i] - v) * t);
    if (contrast(1, luminance(mixed)) >= 5.4) return t === 0 ? String(color).trim().toLowerCase() : toHex(mixed);
  }
  return INK;
};

// ── Libellés ────────────────────────────────────────────────────────────────────────────────────────────────
// Le rôle de base (« sales ») n'est pas étiqueté : seuls les rôles qui se distinguent le sont (le capitaine l'est par l'équipe).
export const ROLE_LABELS = { head_of_sales: 'Head of sales', head_of_sales_manager: 'Head of sales manager' };

// Jour « 2026-11-24 » → « 24/11 » ; autre chose → ''.
export const fmtDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}` : '';
};

const arr = (v) => (Array.isArray(v) ? v : []);
const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
const nameOf = (u) => u.full_name || u.name || u.email || '—';
const keyOf = (u) => String(u?.id ?? u?.email ?? '');

// ── Sales ───────────────────────────────────────────────────────────────────────────────────────────────────
// users : /api/v1/users/assignable ; teams : /api/v1/teams (capitaine + membres, couleur).
// Une personne n'apparaît qu'une fois ; le capitaine l'emporte sur une place de membre ailleurs.
export function groupSales(users, teams) {
  const people = [];
  const seen = new Set();
  for (const u of arr(users)) {
    const key = keyOf(u);
    if (!u || !key || seen.has(key) || isInactive(u) || isTestOrAdmin(u)) continue;
    seen.add(key);
    people.push(u);
  }

  const groups = [];
  const teamOf = new Map();                       // id de la personne → { group, isCaptain }
  arr(teams).forEach((t, i) => {
    const group = { key: String(t.id ?? `${t.label}-${i}`), label: t.label || '—', color: t.color || NEUTRAL, neutral: false, members: [] };
    groups.push(group);
    const place = (m, isCaptain) => {
      const id = String(m?.id ?? '');
      if (id && !teamOf.has(id)) teamOf.set(id, { group, isCaptain });
    };
    if (t.captain) place(t.captain, true);
    arr(t.members).forEach((m) => place(m, false));
  });

  const orphans = { key: 'none', label: 'Sans équipe', color: NEUTRAL, neutral: true, members: [] };
  for (const u of people) {
    const info = teamOf.get(String(u.id ?? ''));
    const name = nameOf(u);
    const row = {
      key: keyOf(u), name, email: u.email || '', avatar: u.avatar_url || null, isCaptain: !!info?.isCaptain,
      roleLabel: ROLE_LABELS[u.role] || null, until: u.unavailable_until || null, canon: getCanonicalKey(name), sales: null,
    };
    (info ? info.group : orphans).members.push(row);
  }

  const sorter = (a, b) => (Number(b.isCaptain) - Number(a.isCaptain)) || byName(a, b);
  const out = groups.filter((g) => g.members.length > 0);
  if (orphans.members.length > 0) out.push(orphans);
  out.forEach((g) => { g.members.sort(sorter); g.sales = null; });
  return out;
}

export const countPeople = (groups) => groups.reduce((n, g) => n + g.members.length, 0);
export const absentees = (groups) => groups.flatMap((g) => g.members).filter((m) => m.until);

// stats : /api/v1/leaderboard/stats?period=current_month → index par nom canonique (les variantes de saisie d'un même nom se rejoignent).
// null si la réponse n'est pas exploitable : les ventes restent alors inconnues (« — »).
export function sellerIndex(stats) {
  if (!Array.isArray(stats?.all_sellers)) return null;
  const map = new Map();
  for (const s of stats.all_sellers) {
    const key = getCanonicalKey(s?.name);
    if (!key || key === 'unknown') continue;
    const prev = map.get(key) || { sales: 0, revenue: 0 };
    map.set(key, { sales: prev.sales + (Number(s.sales) || 0), revenue: prev.revenue + (Number(s.revenue) || 0) });
  }
  const t = stats.totals;
  return { map, totals: t && Number.isFinite(Number(t.sales)) ? { sales: Number(t.sales), revenue: Number(t.revenue) || 0 } : null };
}

// Ajoute les ventes du mois à chaque personne (null = pas dans le classement du mois) et le total de chaque équipe (null = aucun membre relevé).
// Ne modifie pas ses arguments. `max` = le meilleur total individuel, pour dimensionner les jauges.
export function withSales(groups, index) {
  let max = 0;
  const out = groups.map((g) => {
    let total = null;
    const members = g.members.map((m) => {
      const hit = index ? index.map.get(m.canon) : null;
      if (!hit) return m;
      total = (total || 0) + hit.sales;
      max = Math.max(max, hit.sales);
      return { ...m, sales: hit.sales };
    });
    return { ...g, members, sales: total };
  });
  return { groups: out, max };
}

// ── Setters ─────────────────────────────────────────────────────────────────────────────────────────────────
export const MODE_LABELS = { imm: 'Immédiat', man: 'Manuel', rep: 'Répondeurs', std: 'Sous 24 h' };
export const MODE_ORDER = ['imm', 'man', 'rep', 'std'];
export const modeKey = (a) => (a?.repondeur_only ? 'rep' : a?.immediate_new_leads ? 'imm' : a?.manual_only ? 'man' : 'std');

// report : /api/v1/leaderboard/setters (période courante) → par id de setter : RDV posés, RDV qualifiés (honorés), ventes ; totaux. null si inexploitable.
export function setterPerfIndex(report) {
  if (!Array.isArray(report?.setters)) return null;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const byId = new Map();
  for (const s of report.setters) if (s?.id != null) byId.set(String(s.id), { rdv: num(s.rdv), qualified: num(s.qualified), sales: num(s.sales) });
  const t = report.totals;
  return { byId, totals: t ? { rdv: num(t.rdv), qualified: num(t.qualified), sales: num(t.sales) } : null };
}

// list : /api/v1/users/setters-overview. Chaque setter une seule fois, trié par nom, sans équipe. « Sales suivis » = les sales dont il traite les
// leads : un rattachement à une personne la désigne, un rattachement à une équipe est développé en ses membres (la notion d'équipe ne sort pas
// de la donnée). `people` = les sales connus (groupSales) pour leur photo ; `teams` = /api/v1/teams ; `perf` = setterPerfIndex.
export function listSetters(list, { people = [], teams = [], perf = null } = {}) {
  const peopleByCanon = new Map(arr(people).map((p) => [p.canon, p]));
  const teamNames = new Map(arr(teams).map((t) => [t.label, [t.captain, ...arr(t.members)].filter(Boolean).map((m) => m.name || m.full_name).filter(Boolean)]));
  const out = [];
  const seen = new Set();
  for (const s of arr(list)) {
    const key = keyOf(s);
    if (!s || !key || seen.has(key) || isInactive(s) || isTestSetter(s)) continue;
    seen.add(key);

    const served = new Map();
    const add = (rawName) => {
      const canon = getCanonicalKey(rawName);
      if (!canon || canon === 'unknown' || served.has(canon)) return;
      const p = peopleByCanon.get(canon);
      served.set(canon, p ? { key: p.key, name: p.name, avatar: p.avatar } : { key: canon, name: String(rawName), avatar: null });
    };
    const modes = new Set();
    for (const a of arr(s.assignments)) {
      modes.add(modeKey(a));
      if (a.target_type === 'team') arr(teamNames.get(a.team_label || a.target_label)).forEach(add);
      else if (a.target_label) add(a.target_label);
    }

    const hit = perf ? perf.byId.get(key) : null;
    out.push({
      key, name: nameOf(s), email: s.email || '', avatar: s.avatar_url || null,
      served: [...served.values()].sort(byName),
      modes: MODE_ORDER.filter((m) => modes.has(m)),
      rdv: hit ? hit.rdv : null, qualified: hit ? hit.qualified : null, sales: hit ? hit.sales : null,
    });
  }
  return out.sort(byName);
}

// Chemins d'ouverture d'un compte en lecture seule (mode « ghost ») : mêmes routes qu'avant.
export const salesSheetPath = (email) => `/ceo/sheet/${encodeURIComponent(email)}?ghost=true`;
export const setterSheetPath = (email) => `/ceo/setter-sheet/${encodeURIComponent(email)}?ghost=true`;
