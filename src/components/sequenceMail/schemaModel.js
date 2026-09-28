// src/components/sequenceMail/schemaModel.js
//
// Modèle pur du schéma de séquence : regroupe les e-mails d'une cohorte en chaînes
// chronologiques — une par séquence × segment, le même découpage que `neighborsOf` (model.js),
// qui sert déjà à afficher « Précédent »/« Suivant » dans le lecteur — et calcule le délai entre
// étapes consécutives via `delayBetween`. Aucun accès réseau ni React ici.
//
// Les envois ponctuels (« oneshot ») ne sont jamais reliés entre eux : ce sont des diffusions
// indépendantes, pas les étapes d'un même parcours (ex. 05-26 : le report de date et l'invitation
// à froid n'ont ni le même public ni de succession réelle).

import { SEGMENTS, SEQUENCES, delayBetween } from './model';

const SEGMENT_ORDER = { missed: 0, attended: 1, all: 2 };
const segmentRank = (segment) => (segment ? SEGMENT_ORDER[segment] ?? 3 : -1);
const byOrder = (a, b) => a.order - b.order;

/**
 * @param emails E-mails de la cohorte sélectionnée (forme de `deriveEmails`, cf. hooks.js).
 * @returns Chaînes triées (pré-webinaire, puis post-webinaire par segment, puis envois ponctuels),
 *   chacune `{ id, sequence, segment, label, connected, steps, gaps }` :
 *   - `connected` : faux pour les envois ponctuels (pas de flèche entre eux) ;
 *   - `gaps[i]` : délai entre `steps[i]` et `steps[i + 1]` (texte lisible, ou `null` si les deux
 *     étapes ne sont pas planifiées sur une base comparable — délai réellement variable, jamais
 *     inventé).
 */
export function buildSchemaChains(emails) {
  const groups = new Map();
  for (const email of emails) {
    const key = `${email.sequence}::${email.segment || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(email);
  }

  const chains = [];
  for (const [key, list] of groups) {
    const steps = [...list].sort(byOrder);
    const sequence = steps[0].sequence;
    const segment = steps[0].segment || null;
    const connected = sequence !== 'oneshot';
    const label = [SEQUENCES[sequence]?.label ?? sequence, segment ? SEGMENTS[segment] : null]
      .filter(Boolean)
      .join(' · ');
    const gaps = connected ? steps.slice(1).map((step, i) => delayBetween(steps[i], step)) : [];
    chains.push({ id: key, sequence, segment, label, connected, steps, gaps });
  }

  return chains.sort((a, b) => {
    const bySeq = (SEQUENCES[a.sequence]?.order ?? 99) - (SEQUENCES[b.sequence]?.order ?? 99);
    return bySeq !== 0 ? bySeq : segmentRank(a.segment) - segmentRank(b.segment);
  });
}
