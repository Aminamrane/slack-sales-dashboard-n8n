// Mémoire de la liste des notifications d'une page à l'autre (dev 21/11/2026) : ouvrir une notification change de page
// sans fermer la liste ; elle se rouvre telle quelle (ouverte, notification ouverte en dernier, celles gardées sous les
// yeux). Le menu l'efface quand on referme la liste.
export const panelMemory = { open: false, current: null, kept: {} };
