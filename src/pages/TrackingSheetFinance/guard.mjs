// guard.mjs — empêche une règle de calcul finance d'être réécrite ailleurs.
//
// Demande dev 2026-08-29, après l'incident n°454 : « faut que ce soit réparé
// automatiquement, que ça n'arrive plus, que ça fasse partie du code ».
//
// Le bug n'était pas une faute de calcul : c'était la MÊME notion (le
// trop-perçu) calculée à trois endroits, qui a fini par diverger. Corriger un
// endroit ne corrige pas les autres, et personne ne s'en aperçoit avant que
// la finance ne le signale.
//
// Ce garde-fou impose une règle simple : les champs bruts de retard et de
// crédit ne se lisent QUE dans `constants.js`, où vivent les helpers. Partout
// ailleurs, on passe par `scopedOverdueCurrent`, `scopedOverdueCum`,
// `scopedOverdueToDate`, `scopedCredit` ou `entityCredit`.
//
// Deux exceptions assumées, déclarées explicitement plus bas — pas de
// dérogation silencieuse.
//
// Lancement : `npm run guard` (aucune dépendance).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Champs bruts que le backend sert par entité. Les lire directement, c'est
// s'apprêter à refaire un calcul qui existe déjà.
const RAW = [
  'overdue_owner_current_month',
  'overdue_optilex_current_month',
  'overdue_owner_cumulative',
  'overdue_optilex_cumulative',
  'credit_owner',
  'credit_optilex_ttc',
];

// Détecte aussi l'accès DYNAMIQUE (`overdue_${entity}_cumulative`), qui échappe
// à une recherche naïve — c'est exactement la forme qu'avait ma duplication.
const DYNAMIC = /overdue_\$\{[^}]+\}_(current_month|cumulative)/;

// Seul endroit autorisé à toucher aux champs bruts : la définition des helpers.
const HOME = 'constants.js';

// Exception : un marqueur EXPLICITE sur la ligne, ou juste au-dessus.
//
//     // guard-ok: restitution brute des 4 champs, sans calcul dérivé
//
// Première version de ce garde-fou : j'exemptais tout ce qui se trouvait à
// moins de 40 lignes d'un nom de fonction autorisé. Testé avec une vraie
// infraction, il l'a LAISSÉE PASSER — la fenêtre couvrait du code sans
// rapport. Un marqueur ligne à ligne ne peut pas déborder, et il oblige à
// écrire la raison au moment où on déroge.
const MARKER = 'guard-ok:';

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (/\.(jsx?|mjs)$/.test(p) && !p.endsWith('guard.mjs') && !p.endsWith('.test.js')) {
      files.push(p);
    }
  }
})(ROOT);

const problems = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  if (rel === HOME) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('//')) return;          // commentaire
    const hit = RAW.find((f) => line.includes(f)) || (DYNAMIC.test(line) ? 'accès dynamique' : null);
    if (!hit) return;
    // Dérogation : le marqueur couvre son BLOC contigu — on remonte tant que
    // les lignes ne sont pas vides. Une ligne blanche ferme la dérogation,
    // donc elle ne peut pas déborder sur du code sans rapport.
    let exempt = line.includes(MARKER);
    for (let k = i - 1; k >= 0 && !exempt; k -= 1) {
      if (lines[k].trim() === '') break;
      if (lines[k].includes(MARKER)) exempt = true;
    }
    if (exempt) return;
    problems.push({ rel, line: i + 1, hit, code: line.trim().slice(0, 96) });
  });
}

if (problems.length === 0) {
  console.log('✓ garde-fou finance : aucune règle de calcul dupliquée');
  process.exit(0);
}

console.error('\n✗ garde-fou finance : champ brut lu hors de constants.js\n');
for (const p of problems) {
  console.error(`  ${p.rel}:${p.line}  « ${p.hit} »`);
  console.error(`    ${p.code}`);
}
console.error(`
  Ces champs ne se lisent que dans ${HOME}. Ailleurs, passer par un helper :
    scopedOverdueCurrent(row, scope)   retard du mois affiché
    scopedOverdueCum(row, scope)       créances antérieures
    scopedOverdueToDate(row, scope)    les deux — négatif = trop-perçu
    scopedCredit(row, scope)           trop-perçu (0 si le client doit)
    entityCredit(row, 'owner')         idem, sur une seule entité

  Recalculer la règle sur place la fera diverger : c'est l'incident n°454.
  Si la lecture brute est réellement justifiée, écrire sur la ligne (ou
  juste au-dessus) :  // guard-ok: <la raison>
  Une dérogation assumée et expliquée, jamais silencieuse.
`);
process.exit(1);
