export function validateIntakeFile(file) {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Choisissez un fichier non vide de 20 Mo maximum.');
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) throw new Error('Formats acceptés : PDF, JPG et PNG.');
  if (!file.name?.trim() || file.name.length > 255) throw new Error('Le nom du fichier est invalide ou trop long.');
}
export function documentStatus(file, remote) {
  if (file.status === 'sent') {
    if (remote?.status === 'completed') return 'Transmis · analysé';
    if (remote?.needsReview) return 'Transmis · classement à vérifier';
    if (remote?.status === 'failed') return 'Transmis · analyse à vérifier';
    if (remote?.status === 'pending_password') return 'Transmis · mot de passe requis';
    if (remote?.status === 'processing') return 'Transmis · analyse en cours';
    return file.analysis === 'started' ? 'Transmis · analyse demandée' : 'Transmis à la plateforme';
  }
  if (file.status === 'sending') return 'Transmission en cours';
  if (file.status === 'rejected') return 'À corriger · conservé dans le CRM';
  return 'Enregistré · en attente de transmission';
}

export function hasRequiredSaleDocuments(files) {
  return Array.isArray(files) && files.some(file => ['waiting', 'sending', 'sent'].includes(file.status));
}

// Société en cours de création ou trop récente : pas encore de pièce. Case à cocher de l'étape
// « Pièces du dossier » ; la vente se déclare sans document et la dispense est tracée côté serveur.
export const DOCUMENT_WAIVERS = [
  ['company_in_creation', 'Société en cours de création'],
  ['company_too_recent', 'Société trop récente, pas encore de documents'],
];

export function canDeclareSale(files, waiver) {
  return hasRequiredSaleDocuments(files) || DOCUMENT_WAIVERS.some(([value]) => value === waiver);
}


// Suivi des pièces dans la fiche du lead (dev 14/10/2026) : ce que le sales a déjà donné.
export const DOCUMENT_LABELS = {
  tax_notice: 'Avis d’imposition', balance_sheet: 'Bilan', payslip: 'Bulletin de paie', dsn: 'DSN',
  employment_contract: 'Contrat de travail', duerp: 'DUERP', other: 'Autre document',
};

export function documentsSummary(files) {
  const list = Array.isArray(files) ? files : [];
  const count = status => list.filter(file => file.status === status).length;
  return { total: list.length, sent: count('sent'), pending: count('waiting') + count('sending'), rejected: count('rejected') };
}

export function shortDocumentStatus(file) {
  return { sent: 'Transmise', sending: 'Envoi en cours', waiting: 'En attente', rejected: 'À corriger' }[file?.status] || 'En attente';
}

export function documentOwner(file, draft) {
  if (file?.director_id) return draft?.directors?.find(d => d.id === file.director_id)?.name || 'Dirigeant';
  return draft?.companies?.find(c => file?.company_siren && c.siren?.replace(/\s/g, '') === file.company_siren)?.name
    || (draft?.companies?.length === 1 ? draft.companies[0].name : 'Dossier client');
}
