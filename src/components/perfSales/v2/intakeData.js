// Données du détail « Fiches reçues » (IntakeLeads.jsx) : regroupements du panneau et fiches d'une case du schéma.

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const monthOf = (ym) => `${MONTHS[Number(String(ym).slice(5, 7)) - 1] || ym}${String(ym).slice(0, 4) !== String(new Date().getFullYear()) ? ` ${String(ym).slice(0, 4)}` : ''}`;

// Regroupements proposés dans le panneau.
export const GROUP = {
  engine: { title: 'Affectées par le moteur à', key: (r) => r.engine || (r.fate?.startsWith('not_given') ? 'jamais donnée' : 'avant le moteur') },
  now: { title: 'Aujourd’hui chez', key: (r) => r.now || 'au pool' },
  last: { title: 'Dernier sales avant le pool', key: (r) => r.previous || r.engine || 'inconnu' },
  received: { title: 'Reçus en', key: (r) => (r.received ? monthOf(r.received.slice(0, 7)) : 'date inconnue') },
};

// Ce qu'ouvre une case du schéma (nœud de flowData) : ses fiches, recomptées une par une.
export function nodeLeads(node, month) {
  const match = (r) => {
    if (node.kind === 'root') return true;
    if (node.kind === 'channel') return r.channel === node.group;
    if (node.kind === 'funnel') return r.channel === 'ads' && r.funnel === node.funnel;
    const fate = String(r.fate).startsWith('other_') ? 'other' : r.fate;
    return r.channel === node.group && fate === node.fate;
  };
  const given = node.fate ? !String(node.fate).startsWith('not_given') : true;
  return {
    kicker: node.kind === 'root' ? `Fiches reçues en ${month}` : 'Détail des fiches', title: node.kind === 'root' ? 'Toutes les fiches' : node.label,
    color: node.kind === 'root' ? null : node.color, expected: node.value, file: node.id.replace(/[^a-z0-9]+/gi, '-'),
    pick: (d) => d.leads.filter(match), groups: !given ? [] : node.fate === 'pool_waiting' ? [GROUP.engine, GROUP.last] : [GROUP.engine, GROUP.now],
  };
}
