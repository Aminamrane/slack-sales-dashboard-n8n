import { fr } from './model.js';

// Fiches reçues du mois, de Funnel Leads aux colonnes de l'onglet Canaux (dev 15/10/2026 : « on ne comprend pas trop ce
// qui est lié… voir tous les ADS qu'on reçoit en octobre, comme Funnel Leads avec les numéros traitables, et les autres
// canaux d'acquisition ; là tu mélanges tout »). Chaque fiche est dans UNE case, calculée à l'unité par le serveur
// (`intake.links` : canal d'arrivée × découpage de Funnel Leads × où elle est aujourd'hui). Quatre colonnes :
// Reçues (= « Leads reçus » de Funnel Leads) → Canal → Funnel Leads (les ADS seulement : traitables, téléphone non
// français, 1 à 2 / moins de 100 k€) → Aujourd'hui. Les autres canaux vont directement à « aujourd'hui », chacun à part.
// Dessin : AdsFlow.jsx, agencement : flowLayout.js.

export const CHANNELS = {
  ads: { label: 'ADS', color: '#1e3a7b' },
  webinar: { label: 'Webinaire', color: '#e6b45a' },
  linkedin: { label: 'LinkedIn', color: '#d4834a' },
  referral: { label: 'Parrainage', color: '#b85c78' },
  ccs: { label: 'Cold call setter', color: '#4f9a72' },
  cold_call: { label: 'Cold call sales', color: '#8b95a7' },
  test: { label: 'Tests', color: '#b9c0cc' },
  other: { label: 'Autres', color: '#c9cfda' },
};
const CHANNEL_ORDER = ['ads', 'webinar', 'linkedin', 'referral', 'ccs', 'cold_call', 'other', 'test'];

// D'où vient une fiche webinaire du CRM (dev 16/10/2026 : « les liens webinaires Lamia ? Aurélie ? les webinaires traités
// depuis le CRM setter ? ») : `links[].sub`, calculé par le serveur (perf_intake.webinar_link).
export const WEBINAR_LINKS = {
  lamia: { label: 'Webinaire · lien Lamia', short: 'Lien Lamia', color: '#e6b45a' },
  aurelie: { label: 'Webinaire · lien Aurélie', short: 'Lien Aurélie', color: '#d9a046' },
  setter: { label: 'Webinaire · CRM setter', short: 'CRM setter', color: '#cfae74' },
  live: { label: 'Webinaire · RDV après le live', short: 'Après le live', color: '#efd08f' },
};
const LINK_ORDER = ['lamia', 'aurelie', 'setter', 'live'];

export const FUNNEL = {
  fr: { label: 'Traitables', sub: 'tél. FR, 100 k€ et plus', color: '#2f4f9e' },
  non_fr: { label: 'Tél. non français', color: '#8b95a7' },
  small: { label: '1 à 2 · < 100 k€', color: '#a3abbb' },
};
const FUNNEL_ORDER = ['fr', 'non_fr', 'small'];

// Où est la fiche aujourd'hui (case `flow` du serveur). `ads` : libellé d'une fiche ADS ; `other` : d'un autre canal.
const FATES = {
  ads_affectation: { ads: 'Chez le sales affecté', color: '#1e3a7b',
    lines: ['Le sales que le moteur a choisi l’a toujours (ou l’a reçue après un raté des 6 minutes d’un collègue) : colonne « ADS affectés ».'] },
  ads_pool: { ads: 'Repris du pool', color: '#7f9ad9', lines: ['Repartie au pool commun, puis reprise par un sales (parfois celui que le moteur avait choisi) : colonne « ADS repris du pool ».'] },
  other: { other: 'chez un sales', lines: ['Dans la colonne de son canal.'] },
  pool_waiting: { ads: 'Au pool, personne ne l’a repris', other: 'au pool', color: '#c3cde3',
    lines: ['Donnée à un sales, repartie au pool commun, pas encore reprise : elle ne compte pour aucun sales.'] },
  same_contact: { ads: 'Même contact déjà chez ce sales', other: 'même contact déjà chez ce sales', color: '#aeb6c6', lines: ['Comptée une fois par sales et par contact.'] },
  not_given_duplicate: { ads: 'Doublons, jamais données', other: 'doublon, jamais donnée', color: '#8b95a7',
    lines: ['Le moteur d’affectation l’a reconnue comme un contact déjà reçu.'] },
  not_given_small: { ads: 'Écartées par le moteur, moins de 100 k€', other: 'écartée, moins de 100 k€', color: '#a3abbb',
    lines: ['Le moteur d’affectation ne donne pas les moins de 100 k€.'] },
  not_given_webinar: { ads: 'Prises par les setters', other: 'prises par les setters', color: '#d9b25f', lines: ['Inscrits webinaire traités par les setters.'] },
  not_given_unclassifiable: { ads: 'Non classables (tests)', other: 'non classable (test)', color: '#cdd2dc', lines: ['Fiche de test, non classable par le moteur.'] },
  not_given_waiting: { ads: 'Pas encore attribuées', other: 'pas encore attribuée', color: '#dde1e8', lines: ['Pas encore passée dans le moteur d’affectation.'] },
  demo: { ads: 'Comptes de test ou de démo', other: 'compte de démo', color: '#d5dae3', lines: ['Hors statistiques.'] },
};
const FATE_ORDER = ['ads_affectation', 'ads_pool', 'other', 'pool_waiting', 'same_contact', 'not_given_duplicate', 'not_given_small',
  'not_given_webinar', 'not_given_unclassifiable', 'not_given_waiting', 'demo'];
const fateKey = (fate) => (String(fate).startsWith('other_') ? 'other' : fate);
const rank = (order, key) => { const i = order.indexOf(key); return i < 0 ? order.length : i; };

export const COLUMNS = ['Reçues', 'Canal', 'Funnel Leads', 'Aujourd’hui'];

// Graphe du schéma : nœuds rangés par colonne (dans l'ordre d'affichage), liens à l'unité.
export function flowGraph(intake) {
  const rows = intake?.links;
  if (!Array.isArray(rows) || !rows.length || !intake.created) return null;
  const sum = (list) => list.reduce((a, r) => a + r.n, 0);
  const channels = [...new Set(rows.map((r) => r.channel))].sort((a, b) => rank(CHANNEL_ORDER, a) - rank(CHANNEL_ORDER, b));
  const nodes = [{ id: 'root', col: 0, label: 'fiches reçues', value: intake.created, color: 'var(--flow-src)', kind: 'root' }];
  const links = [];
  const leafOf = new Map();
  const addLeaf = (channel, fate, value, source) => {
    const key = fateKey(fate);
    const id = channel === 'ads' ? `ads:${key}` : `${channel}:${key}`;
    let leaf = leafOf.get(id);
    if (!leaf) {
      const f = FATES[key] || { ads: fate, other: fate };
      const label = channel === 'ads' ? f.ads : `${CHANNELS[channel]?.label || channel} · ${f.other || f.ads}`;
      leaf = { id, col: 3, label, value: 0, color: channel === 'ads' || key !== 'other' ? f.color || '#c9cfda' : CHANNELS[channel]?.color,
        group: channel, fate: key, lines: f.lines || [], order: rank(CHANNEL_ORDER, channel) * 100 + rank(FATE_ORDER, key) };
      leafOf.set(id, leaf);
    }
    leaf.value += value;
    const link = links.find((l) => l.source === source && l.target === id);
    if (link) link.value += value; else links.push({ source, target: id, value });
  };
  for (const channel of channels) {
    const own = rows.filter((r) => r.channel === channel);
    const c = CHANNELS[channel] || { label: channel, color: '#c9cfda' };
    // Webinaire : un bloc par lien d'origine, tous vers les mêmes cases d'aujourd'hui.
    if (channel === 'webinar' && own.some((r) => r.sub)) {
      const subs = [...new Set(own.map((r) => r.sub || 'live'))].sort((a, b) => rank(LINK_ORDER, a) - rank(LINK_ORDER, b));
      for (const sub of subs) {
        const part = own.filter((r) => (r.sub || 'live') === sub);
        const w = WEBINAR_LINKS[sub] || { label: `Webinaire · ${sub}`, color: c.color };
        const sid = `ch:webinar:${sub}`;
        nodes.push({ id: sid, col: 1, label: w.label, short: w.short, value: sum(part), color: w.color, group: 'webinar', link: sub, kind: 'channel' });
        links.push({ source: 'root', target: sid, value: sum(part) });
        part.forEach((r) => addLeaf('webinar', r.fate, r.n, sid));
      }
      continue;
    }
    const id = `ch:${channel}`;
    nodes.push({ id, col: 1, label: c.label, value: sum(own), color: c.color, group: channel, kind: 'channel' });
    links.push({ source: 'root', target: id, value: sum(own) });
    if (channel === 'ads') {
      for (const funnel of FUNNEL_ORDER) {
        const part = own.filter((r) => r.funnel === funnel);
        if (!sum(part)) continue;
        const fid = `fun:${funnel}`;
        nodes.push({ id: fid, col: 2, label: FUNNEL[funnel].label, sub: FUNNEL[funnel].sub, value: sum(part), color: FUNNEL[funnel].color, group: 'ads', kind: 'funnel', funnel });
        links.push({ source: id, target: fid, value: sum(part) });
        part.forEach((r) => addLeaf('ads', r.fate, r.n, fid));
      }
    } else {
      own.forEach((r) => addLeaf(channel, r.fate, r.n, id));
    }
  }
  // Colonnes ADS du tableau : + les fiches reçues par la date du formulaire mais créées avant le mois (hors Funnel Leads).
  const flow = intake.flow || {};
  for (const [fate, outside, column] of [['ads_affectation', flow.outside_affectation, 'ADS affectés'], ['ads_pool', flow.outside_pool, 'ADS repris du pool']]) {
    const leaf = leafOf.get(`ads:${fate}`);
    if (leaf && outside) leaf.lines = [...leaf.lines, `Colonne « ${column} » du tableau : ${fr(leaf.value + outside)}, dont ${fr(outside)} reçue${outside > 1 ? 's' : ''} par la date du formulaire, fiche créée avant le mois.`];
  }
  nodes.push(...[...leafOf.values()].sort((a, b) => a.order - b.order));
  // Équivalence avec Funnel Leads (bulles) : mêmes filtres, mêmes bornes, pour tous les canaux.
  const funnelAll = (key) => sum(rows.filter((r) => r.funnel === key));
  const funnelAds = (key) => sum(rows.filter((r) => r.funnel === key && r.channel === 'ads'));
  return { total: intake.created, nodes, links,
    funnel: { received: intake.created, small: funnelAll('small'), without: intake.created - funnelAll('small'), clean: funnelAll('fr'), cleanAds: funnelAds('fr') } };
}

export const nodeText = (n) => (n.sub ? `${n.label} (${n.sub})` : n.label);

// Détail d'un nœud pour sa bulle : d'où viennent ses fiches, où elles vont.
export function nodeDetail(graph, id) {
  const node = graph.nodes.find((n) => n.id === id);
  const name = (nid) => { const n = graph.nodes.find((x) => x.id === nid); return n ? nodeText(n) : nid; };
  const into = graph.links.filter((l) => l.target === id).sort((a, b) => b.value - a.value);
  const out = graph.links.filter((l) => l.source === id).sort((a, b) => b.value - a.value);
  const share = `${fr((node.value / graph.total) * 100, node.value / graph.total < 0.1 ? 1 : 0)} %`;
  return {
    node,
    rows: [...(id === 'root' ? [] : [['Part des fiches reçues', share]]),
      ...(node.col > 1 && into.length > 1 ? into.map((l) => [`← ${name(l.source)}`, fr(l.value)]) : []),
      ...out.map((l) => [`→ ${name(l.target)}`, fr(l.value)])],
  };
}
