// Données du détail « Fiches reçues » (IntakeLeads.jsx) : regroupements du panneau et fiches d'une case du schéma.

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const monthOf = (ym) => `${MONTHS[Number(String(ym).slice(5, 7)) - 1] || ym}${String(ym).slice(0, 4) !== String(new Date().getFullYear()) ? ` ${String(ym).slice(0, 4)}` : ''}`;

// Pourquoi un lead a quitté le sales choisi par le moteur (serveur : perf_intake.departure), dans l'ordre des règles.
export const REASONS = {
  kept: { label: 'Gardé par le sales affecté', short: 'Gardés', color: '#1e3a7b', icon: 'check' },
  sla_given: { label: '6 min ratées → redonné à un autre sales', short: '6 min · redonnés', color: '#3a5598', icon: 'clock' },
  sla_pool: { label: '6 min ratées → pool réactivité', short: '6 min · pool', color: '#5f78b5', icon: 'clock' },
  barrier: { label: '3 jours sans RDV → barrage', short: '3 jours', color: '#7f9ad9', icon: 'calendar' },
  manual: { label: 'Réaffecté à la main', short: 'À la main', color: '#a9b4c9', icon: 'hand' },
  other: { label: 'Autre', short: 'Autre', color: '#c9cfda', icon: 'dot' },
};
export const REASON_ORDER = ['kept', 'sla_given', 'sla_pool', 'barrier', 'manual', 'other'];

// Pourquoi le lead est parti, en clair : la raison (règle), puis ce qui la précise (répondeur, statut, sortie du pool).
export function reasonOf(r) {
  const reason = REASONS[r.departure] || REASONS.other;
  const notes = [];
  if (r.departure === 'barrier') {
    if (r.answering) notes.push('Répondeur');
    else if (!r.now && r.status && !r.opt_out) notes.push(r.status);
  }
  if (r.opt_out) notes.push(`retiré du pool : ne souhaite pas être rappelé${r.opt_out_at ? ` · ${r.opt_out_at.slice(8, 10)}/${r.opt_out_at.slice(5, 7)}` : ''}`);
  return { ...reason, notes };
}

// Regroupements proposés dans le panneau.
export const GROUP = {
  engine: { title: 'Affectées par le moteur à', key: (r) => r.engine || (r.fate?.startsWith('not_given') ? 'jamais donnée' : 'avant le moteur') },
  now: { title: 'Aujourd’hui chez', key: (r) => r.now || 'au pool' },
  last: { title: 'Dernier sales avant le pool', key: (r) => r.previous || r.engine || 'inconnu' },
  received: { title: 'Reçus en', key: (r) => (r.received ? monthOf(r.received.slice(0, 7)) : 'date inconnue') },
  reason: { title: 'Pourquoi parti', key: (r) => REASONS[r.departure]?.label || null, color: (k) => Object.values(REASONS).find((x) => x.label === k)?.color },
};

// Ce qu'ouvre une case du schéma (nœud de flowData) : ses fiches, recomptées une par une.
export function nodeLeads(node, month) {
  const match = (r) => {
    if (node.kind === 'root') return true;
    if (node.kind === 'channel') return r.channel === node.group && (!node.link || (r.sub || 'live') === node.link);
    if (node.kind === 'funnel') return r.channel === 'ads' && r.funnel === node.funnel;
    const fate = String(r.fate).startsWith('other_') ? 'other' : r.fate;
    return r.channel === node.group && fate === node.fate;
  };
  const given = node.fate ? !String(node.fate).startsWith('not_given') : true;
  return {
    kicker: node.kind === 'root' ? `Fiches reçues en ${month}` : 'Détail des fiches', title: node.kind === 'root' ? 'Toutes les fiches' : node.label,
    color: node.kind === 'root' ? null : node.color, expected: node.value, file: node.id.replace(/[^a-z0-9]+/gi, '-'),
    pick: (d) => d.leads.filter(match),
    groups: !given ? [] : node.fate === 'pool_waiting' ? [GROUP.reason, GROUP.engine, GROUP.last] : [GROUP.reason, GROUP.engine, GROUP.now],
  };
}

// Ce qu'ouvre la carte « Affectés » : les fiches ADS du mois données en première intention (trois cases du schéma),
// éventuellement pour une raison et un sales choisi par le moteur.
export const AFFECTED_FATES = ['ads_affectation', 'ads_pool', 'pool_waiting'];
export function affectedLeads(month, { reason = null, sales = null, expected = null } = {}) {
  const title = [reason ? REASONS[reason].label : 'Tous les leads affectés', sales].filter(Boolean).join(' · ');
  return {
    kicker: `Affectés en ${month}`, title, color: reason ? REASONS[reason].color : '#1e3a7b', expected,
    file: `affectes${reason ? `-${reason}` : ''}${sales ? `-${sales}` : ''}`,
    pick: (d) => d.leads.filter((r) => r.channel === 'ads' && AFFECTED_FATES.includes(r.fate)
      && (!reason || r.departure === reason) && (!sales || (r.engine || 'sans moteur') === sales)),
    groups: [reason ? null : GROUP.reason, sales ? null : GROUP.engine, GROUP.now].filter(Boolean),
  };
}
