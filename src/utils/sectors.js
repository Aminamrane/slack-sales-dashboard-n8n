// Secteurs canoniques des leads de prospection et des préférences sales. Les clés sont celles de
// l'API (app/services/sectors.py) ; la liste qui fait foi pour l'édition vient de
// GET /api/v1/sales-preferences/sectors, celle-ci ne sert qu'à l'affichage (libellé, teinte).
export const SECTORS = [
  { key: 'micro_creche', label: 'Micro-crèche', color: '#c08497' },
  { key: 'ambulance', label: 'Ambulance', color: '#5b8fb4' },
  { key: 'pharmacie', label: 'Pharmacie', color: '#5fa085' },
  { key: 'btp', label: 'BTP', color: '#bf945f' },
  { key: 'restauration', label: 'Restauration', color: '#c47a6a' },
  { key: 'transport', label: 'Transport', color: '#7385b4' },
  { key: 'service_personne', label: 'Service à la personne', color: '#9a7fb8' },
  { key: 'esn', label: 'ESN / informatique', color: '#5b7fc4' },
  { key: 'immobilier', label: 'Immobilier', color: '#8b7d6b' },
  { key: 'marchand_biens', label: 'Marchand de biens', color: '#a3895f' },
  { key: 'commerce_artisanat', label: 'Commerçants et artisans', color: '#6f9a8d' },
];

const BY_KEY = Object.fromEntries(SECTORS.map((s) => [s.key, s]));

export const sectorMeta = (key) => BY_KEY[key] || null;

// Origine affichée d'un lead. En base l'origine reste « setter » ou « cc » : le pool commun,
// l'auto-affectation des ads et les commissions s'appuient sur ces deux valeurs exactes. Le
// secteur de la liste de prospection (cc_sector) s'ajoute seulement à l'écran.
export function originDisplay(origin, ccSector) {
  const raw = (origin || '').trim();
  const sector = sectorMeta(ccSector)?.label;
  const low = raw.toLowerCase();
  if (low === 'setter') return sector ? `CCS · ${sector}` : 'CCS';
  if (low === 'cc') return sector ? `CC · ${sector}` : 'CC';
  return raw;
}
