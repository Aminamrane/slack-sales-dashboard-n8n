export function validateIntakeFile(file) {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Choisissez un fichier non vide de 20 Mo maximum.');
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) throw new Error('Formats acceptés : PDF, JPG et PNG.');
  if (!file.name?.trim() || file.name.length > 255) throw new Error('Le nom du fichier est invalide ou trop long.');
}
export function documentStatus(file) {
  if (file.status === 'sent') return file.analysis === 'started' ? 'Transmis · analyse en cours' : 'Transmis à la plateforme';
  if (file.status === 'sending') return 'Transmission en cours';
  if (file.status === 'rejected') return 'À corriger · conservé dans le CRM';
  return 'Enregistré · en attente de transmission';
}
