// Keep technical responses in the API error/logs; expose corrective instructions to the sales user.
const help = {
  phone: 'Saisissez un numéro valide, par exemple 06 12 34 56 78 ou +33 6 12 34 56 78.',
  email: 'Saisissez une adresse email complète, par exemple prenom.nom@entreprise.fr, sans espace.',
  first_name: 'Renseignez le prénom du signataire. Retirez les virgules et les espaces en trop, par exemple « Jean Pierre ».',
  last_name: 'Renseignez le nom de famille du signataire. Retirez les virgules et les espaces en trop, par exemple « Dupont ».',
  representative_name: 'Vérifiez le prénom et le nom du signataire dans le NDA. Les deux doivent être renseignés.',
  employee_range: 'Sélectionnez le nombre de salariés avant de continuer.',
  contract_display_date: 'Choisissez une date valide dans le calendrier du contrat.',
  siren: 'Saisissez les 9 chiffres du SIREN de la société.',
};
const labels = { phone: 'Téléphone du signataire', email: 'Email du signataire', first_name: 'Prénom du signataire', last_name: 'Nom du signataire', representative_name: 'Identité du signataire', employee_range: 'Nombre de salariés', contract_display_date: 'Date du contrat', siren: 'SIREN' };
const aliases = { phone_number: 'phone', signer_phone: 'phone', signer_email: 'email', signer_first_name: 'first_name', signer_last_name: 'last_name' };
function fieldName(value) {
  const last = String(value || '').split(/[.\[\]]/).filter(Boolean).at(-1);
  return Object.hasOwn(help, last) ? last : aliases[last];
}
function fieldResult(fields, options) {
  const keys = Object.keys(fields);
  const inPreparation = options.preparation || options.pilot;
  const location = inPreparation ? 'la première étape du contrat' : 'le NDA';
  const editableHere = keys.every(k => ['phone', 'email', 'employee_range'].includes(k));
  const action = keys.some(k => ['first_name', 'last_name', 'representative_name', 'siren'].includes(k)) ? 'nda'
    : editableHere ? (inPreparation ? 'preparation' : 'nda') : null;
  return { title: keys.length === 1 ? `${labels[keys[0]]} à corriger` : 'Informations à corriger',
    message: keys.map(k => `${labels[k]} : ${fields[k]}`).join('\n\n') + (action && !options.preparation ? `\n\nÀ corriger dans ${action === 'nda' ? 'le NDA' : location}.` : ''),
    fields, action, isNdaMissing: false };
}
export function validateContractPreparation(values) {
  const fields = {};
  if (!values.employee_range) fields.employee_range = help.employee_range;
  const email = String(values.email || '').trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = help.email;
  if (!String(values.phone || '').trim()) fields.phone = 'Le téléphone du signataire est obligatoire.';
  else if (/[^0-9+().\s-]/.test(values.phone || '')) fields.phone = help.phone;
  return fields;
}
export function presentContractError(error, options = {}) {
  const detail = error?.data?.detail ?? error?.response?.data?.detail ?? error?.detail ?? error?.message ?? error;
  const raw = typeof detail === 'string' ? detail : '';
  let payload;
  try { payload = JSON.parse(raw.slice(raw.indexOf('{'))); } catch { /* Legacy errors may only contain text. */ }
  const problems = Array.isArray(detail) ? detail : (detail?.invalid_params || payload?.invalid_params || []);
  const fields = {};
  for (const problem of problems) {
    const field = fieldName(problem.loc?.at(-1) || problem.name);
    if (field) fields[field] = help[field];
  }
  for (const name of ['phone_number', 'email', 'first_name', 'last_name']) {
    if (raw.includes(`info[${name}]`)) fields[fieldName(name)] = help[fieldName(name)];
  }
  if (/téléphone du signataire.*(?:invalide|obligatoire)/i.test(raw)) fields.phone = help.phone;
  if (/prénom.*nom.*signataire|identité du signataire.*incompl/i.test(raw)) fields.representative_name = help.representative_name;
  if (Object.keys(fields).length) return fieldResult(fields, options);
  const result = (title, message, extra = {}) => ({ title, message, fields: {}, action: null, isNdaMissing: false, ...extra });
  if (/client data missing|nda.*pas.*généré|générez.*nda/i.test(raw))
    return result('NDA à compléter', 'Générez le NDA de ce dossier, puis reprenez la préparation du contrat.', { isNdaMissing: true, action: 'nda' });
  if (/validez la fiche|fiche d’intégration.*complétée/i.test(raw))
    return result('Fiche d’intégration à compléter', 'Complétez les sociétés, les dirigeants et la première météo client, puis validez la fiche avant de poursuivre.', { action: 'preparation' });
  if (/coordonnées ont changé|rouvrez|révision|fingerprint/i.test(raw) || problems.some(p => ['fingerprint','revision','source_fingerprint'].includes(p.loc?.at(-1))))
    return result('Informations mises à jour', 'Fermez puis rouvrez la fiche pour récupérer les dernières informations avant de continuer.');
  // Un envoi en cours n'est pas un contrat signé (retour dev 25/09 : dossier SERR affiché « déjà signé »).
  if (/annulation n.a pas abouti chez Yousign/i.test(raw))
    return result('Annulation non aboutie', 'Yousign n’a pas confirmé l’annulation : le contrat reste en signature et le client peut encore le signer. Réessayez dans un instant.');
  if (/déjà en signature|contrat en signature/i.test(raw))
    return result('Contrat en signature', 'Un contrat est déjà en cours de signature pour ce dossier. Consultez-le depuis le dossier ; attendez la signature ou annulez-le avant d’en préparer un autre.');
  if (/cannot resend a signed|déjà.*signé|already signed/i.test(raw))
    return result('Contrat déjà signé', 'Ce contrat est déjà signé. Consultez-le depuis le dossier ; il ne peut pas être renvoyé.');
  if (/en signature.*modifiées/i.test(raw))
    return result('Contrat en signature', 'Les coordonnées ne peuvent plus être modifiées pendant la signature. Consultez le contrat en cours depuis le dossier.');
  const status = error?.status || error?.response?.status;
  if (status === 401) return result('Session expirée', 'Reconnectez-vous, puis rouvrez le dossier pour continuer.');
  if (status === 403) return result('Accès non autorisé', 'Votre compte ne peut pas effectuer cette action sur ce dossier. Contactez votre administrateur.');
  if (status === 404) return result('Dossier introuvable', 'Actualisez votre tracking sheet et rouvrez le dossier.');
  if (problems.length || /parameters_not_valid|invalid params/i.test(raw))
    return result('Informations du contrat à vérifier', 'Le service de signature a refusé certaines informations. Vérifiez le NDA et les coordonnées du signataire. Si le blocage persiste, contactez le support.');
  if (!options.preparation && (status >= 500 || status === 429 || /failed \((429|50[0-9])\)|indisponible|maintenance|timeout|timed out|<html/i.test(raw)))
    return result('Service momentanément indisponible', 'Le service ne peut pas confirmer cette action pour le moment. Vérifiez le statut du contrat avant de réessayer dans quelques minutes.');
  if (options.preparation) return result('Vérification indisponible', 'Impossible de vérifier les informations pour le moment. Vérifiez votre connexion, puis réessayez.');
  const operation = options.operation === 'cancel' ? 'L’annulation' : 'L’envoi';
  return result('Action non confirmée', `${operation} n’a pas pu être confirmé${options.operation === 'cancel' ? 'e' : ''}. Vérifiez le statut du contrat dans le dossier avant de réessayer. Si le blocage persiste, contactez le support.`);
}
