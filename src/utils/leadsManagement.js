// Gestion des leads (dev 22/10/2026 : « il faut corriger ça », « même les doublons faut que je les voie, et un détail de
// leur historique, où ils en sont en ce moment »). La page charge les 400 leads les plus récents ET tous ceux qui ont
// un RDV à venir, quel que soit leur âge : un RDV webinaire pris par le lien d'une setteuse une semaine plus tôt ne doit
// plus disparaître de la liste avant d'être affecté. Les doublons restent visibles et sont signalés.

// Les deux chargements réunis, sans répéter un lead, du plus récent au plus ancien.
export function mergeLeads(...lists) {
  const byId = new Map();
  lists.flat().forEach((lead) => { if (lead?.id != null && !byId.has(lead.id)) byId.set(lead.id, lead); });
  return [...byId.values()].sort((a, b) => b.id - a.id);
}

const emailKey = (lead) => (lead.email || '').trim().toLowerCase();
// Le numéro sans indicatif ni séparateurs : « +33 6 46 22 67 05 », « 0646226705 » et « 33646226705 » se rejoignent.
const phoneKey = (lead) => {
  const digits = (lead.phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
};

// Les clés d'une fiche : son e-mail et son téléphone, quand ils sont renseignés.
const keysOf = (lead) => [emailKey(lead) && `e:${emailKey(lead)}`, phoneKey(lead) && `p:${phoneKey(lead)}`].filter(Boolean);

// Pour chaque lead, les autres fiches de la même personne (même e-mail ou même téléphone), les plus récentes d'abord.
export function duplicatesById(leads) {
  const groups = new Map();
  leads.forEach((lead) => keysOf(lead).forEach((key) => {
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(lead);
  }));
  const out = new Map();
  leads.forEach((lead) => {
    const others = new Set();
    keysOf(lead).forEach((key) => {
      groups.get(key).forEach((other) => { if (other.id !== lead.id) others.add(other); });
    });
    if (others.size) out.set(lead.id, [...others].sort((a, b) => b.id - a.id));
  });
  return out;
}

// Les dates de RDV sont des heures murales de Paris étiquetées UTC : on lit la date et l'heure telles quelles.
const wall = (value) => (typeof value === 'string' && value.length >= 16 ? value.slice(0, 16) : null);

// Le prochain RDV du lead (R1, R2 ou R3) à partir d'aujourd'hui, ou null.
export function nextRdv(lead, today) {
  return [['R1', lead.r1_date], ['R2', lead.r2_date], ['R3', lead.r3_date]]
    .map(([kind, value]) => ({ kind, at: wall(value) }))
    .filter((rdv) => rdv.at && rdv.at.slice(0, 10) >= today)
    .sort((a, b) => a.at.localeCompare(b.at))[0] || null;
}

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

// « R2 sam. 24/10 à 10 h » (format uniforme des RDV).
export function rdvLabel(rdv) {
  if (!rdv) return '';
  const [y, m, d] = rdv.at.slice(0, 10).split('-').map(Number);
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const [h, min] = rdv.at.slice(11, 16).split(':');
  return `${rdv.kind} ${day} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} à ${Number(h)} h${min === '00' ? '' : ` ${min}`}`;
}

// La date du jour à Paris (« 2026-10-22 »).
export function parisToday(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

// Corriger la fiche avant affectation (dev 23/10/2026 : « changer les infos comme email et tout avant affectation si
// c'est faux »). Nom, téléphone et e-mail passent par la route du Tracking Sheet (PATCH /tracking/leads/{id}) : elle
// refuse un doublon, met à jour l'invitation d'un RDV à venir et journalise l'auteur. Réservé aux admins (seuls
// autorisés par cette route sur un lead sans sales), et jamais sur un lead déjà client : la route recopie le nom dans
// la fiche client.
export const CONTACT_FIELDS = [['full_name', 'Nom'], ['phone', 'Téléphone'], ['email', 'E-mail']];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canEditContact(lead, { isAdmin, clientEmails }) {
  return Boolean(isAdmin && lead && !lead.assigned_to && !clientEmails.has(emailKey(lead)));
}

// Les champs changés, prêts à envoyer, ou le problème à corriger d'abord.
export function contactPatch(lead, draft) {
  const patch = {};
  for (const [key, label] of CONTACT_FIELDS) {
    const before = (lead[key] || '').trim();
    const after = (draft[key] ?? '').trim();
    if (after === before) continue;
    if (!after) return { problem: `${label} ne peut pas être vidé.` };
    if (key === 'email' && !EMAIL.test(after)) return { problem: 'E-mail invalide.' };
    patch[key] = key === 'email' ? after.toLowerCase() : after;
  }
  return { patch };
}

// Le message à montrer quand la route refuse (l'erreur d'apiClient porte `status` et le corps dans `data`).
export function contactSaveError(err) {
  const detail = err?.data?.detail;
  if (detail?.code === 'duplicate_lead') return `Le lead #${detail.lead_id} porte déjà cet e-mail ou ce téléphone.`;
  if (err?.status === 403) return 'Modification réservée aux admins.';
  if (err?.status === 422) return 'E-mail invalide.';
  if (typeof detail === 'string' && err?.status === 502) return detail;
  return 'Modification non enregistrée. Réessayez.';
}
