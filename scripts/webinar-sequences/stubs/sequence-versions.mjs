// Faux module « sequence-versions » de la landing (le crochet de « Confirmer les modifications », Sub-Tickets, appelé par `sendTracked`
// juste avant l'envoi). Le générateur restitue les e-mails D'ORIGINE : le crochet est neutralisé, aucune version publiée n'est jamais appliquée.
export async function applyPublishedVersion() {}
