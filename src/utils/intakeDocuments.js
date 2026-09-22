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
