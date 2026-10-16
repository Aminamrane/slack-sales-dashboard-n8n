// Médailles d'argent et de bronze du classement individuel (demande du 15/10/2026) : le 2e et le 3e de chaque mois
// complet depuis septembre 2025 reçoivent une icône, comptée comme le trophée du 1er (« ×N » dès deux mois).
// Même règle que /api/v1/leaderboard/trophies : le plus de ventes du mois, égalité départagée par l'ordre
// alphabétique du nom ; le mois en cours n'entre pas (il n'est pas terminé, le trophée non plus).
// L'API ne sert que les gagnants : le 2e et le 3e se lisent dans le classement de chaque mois (/leaderboard/stats).
export const FIRST_MONTH = '2025-09';
const CACHE_PREFIX = 'lb_podium_v1:';
const CACHE_TTL = 6 * 3600 * 1000;   // un mois terminé ne bouge presque plus : on ne le relit pas à chaque ouverture
const CONCURRENCY = 3;

// Clé d'un nom : sans accents ni casse, pour que « Léo » et « Leo » comptent pour la même personne.
export function nameKey(name) {
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Mois « AAAA-MM » terminés, de septembre 2025 au mois précédant `now`.
export function completedMonths(now = new Date(), first = FIRST_MONTH) {
  const [fy, fm] = first.split('-').map(Number);
  const current = now.getFullYear() * 12 + now.getMonth();
  const out = [];
  for (let idx = fy * 12 + (fm - 1); idx < current; idx += 1) {
    out.push(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`);
  }
  return out;
}

// Podium d'un mois : [{ name, sales }] → noms du 1er, du 2e et du 3e (seuls ceux qui ont vendu comptent).
export function monthPodium(sellers) {
  const ranked = (Array.isArray(sellers) ? sellers : [])
    .filter((s) => s && s.name && Number(s.sales) > 0)
    .map((s) => ({ name: s.name, sales: Number(s.sales), key: nameKey(s.name) }))
    .sort((a, b) => (b.sales - a.sales) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { first: ranked[0]?.name ?? null, second: ranked[1]?.name ?? null, third: ranked[2]?.name ?? null };
}

// Cumul sur tous les mois : { first, second, third } → { [nameKey]: nombre de mois }.
export function tallyMedals(months) {
  const tally = { first: {}, second: {}, third: {} };
  for (const sellers of months) {
    const podium = monthPodium(sellers);
    for (const rank of ['first', 'second', 'third']) {
      const k = podium[rank] && nameKey(podium[rank]);
      if (k) tally[rank][k] = (tally[rank][k] || 0) + 1;
    }
  }
  return tally;
}

function readCache(month, at) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_PREFIX + month));
    if (raw && Array.isArray(raw.s) && at - raw.t < CACHE_TTL) return raw.s;
  } catch { /* stockage indisponible ou illisible : on recharge le mois */ }
  return null;
}

function writeCache(month, sellers, at) {
  try { localStorage.setItem(CACHE_PREFIX + month, JSON.stringify({ t: at, s: sellers })); } catch { /* sans cache */ }
}

// Charge les classements mensuels (3 à la fois, avec cache) et renvoie le cumul des 1ers, 2es et 3es.
// Un mois illisible ne compte pas : il n'empêche ni les autres médailles ni les trophées.
export async function loadPodiumMedals(client, { now = new Date() } = {}) {
  const months = completedMonths(now);
  const at = now.getTime();
  const byMonth = new Map();
  const todo = [];
  for (const m of months) {
    const cached = readCache(m, at);
    if (cached) byMonth.set(m, cached); else todo.push(m);
  }
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const m = todo[next]; next += 1;
      try {
        const data = await client.getLeaderboardStats(m);
        const sellers = (data?.all_sellers || []).map((s) => ({ name: s.name, sales: s.sales }));
        byMonth.set(m, sellers);
        writeCache(m, sellers, at);
      } catch { /* mois non lu : ignoré */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
  return tallyMedals(months.map((m) => byMonth.get(m) || []));
}

// Médailles empilées (demande du 16/10/2026) : ordre or → argent → bronze. Le chiffre affiché est celui de la médaille
// survolée ; par défaut celui de l'or, à défaut de l'argent, à défaut du bronze ; rien s'il n'y en a aucune.
export const MEDAL_ORDER = ['gold', 'silver', 'bronze'];

export function ownedMedals(counts) {
  return MEDAL_ORDER.filter((kind) => Number(counts?.[kind]) > 0);
}

export function activeMedal(counts, hovered = null) {
  const owned = ownedMedals(counts);
  return hovered && owned.includes(hovered) ? hovered : (owned[0] ?? null);
}
