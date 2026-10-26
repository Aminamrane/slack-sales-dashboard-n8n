import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLatestRequestTracker, displayEtat, isCurrentProductClient, matchesSignedClient, withConfirmedEtat,
} from './boardClientState.js';
import { matchesUpcomingIntegration } from './boardIntegration.js';

// Lignes dont les champs bruts racontent autre chose que l'état calculé par le
// serveur : si un écran recalculait l'état, il tomberait sur une autre valeur.
const PAUSE_ENDED = {
  numero_client: 'n°1', etat_manuel: 'Pause', etat_date: '2026-09-01', pause_end_date: '2026-10-01',
  owner_status: 'done', optilex_status: null, etat_affiche: 'Signé',
};
const EXIT_PLANNED = {
  numero_client: 'n°2', etat_manuel: 'Résiliation', etat_date: '2099-01-01', owner_status: 'done', etat_affiche: 'En cours de résiliation',
};
const EXIT_ACTED = {
  numero_client: 'n°3', etat_manuel: 'En cours de rétractation', etat_date: '2026-10-01', owner_status: 'done', etat_affiche: 'Rétractation',
};
const SHEET_SAYS_SIGNED = {
  numero_client: 'n°4', etat: 'Signé', owner_status: 'done', etat_affiche: 'Pause',
};

test("l'état affiché est celui du serveur, tel quel", () => {
  assert.equal(displayEtat(PAUSE_ENDED), 'Signé');
  assert.equal(displayEtat(EXIT_PLANNED), 'En cours de résiliation');
  assert.equal(displayEtat(EXIT_ACTED), 'Rétractation');
  assert.equal(displayEtat(SHEET_SAYS_SIGNED), 'Pause');
});

test("sans état calculé par le serveur, aucun état n'est inventé", () => {
  assert.equal(displayEtat({ etat: 'Signé', owner_status: 'done', etat_manuel: 'Pause' }), null);
  assert.equal(displayEtat({ etat_affiche: null, owner_status: 'done' }), null);
});

test('les onglets et les cartes comptent avec l’état du serveur', () => {
  const board = [PAUSE_ENDED, EXIT_PLANNED, EXIT_ACTED, SHEET_SAYS_SIGNED];
  const signed = board.filter((r) => matchesSignedClient(r, displayEtat(r))).map((r) => r.numero_client);
  assert.deepEqual(signed, ['n°1', 'n°2']);
  const byState = {};
  for (const r of board) byState[displayEtat(r)] = (byState[displayEtat(r)] || 0) + 1;
  assert.deepEqual(byState, { 'Signé': 1, 'En cours de résiliation': 1, 'Rétractation': 1, 'Pause': 1 });
  const product = board.filter((r) => isCurrentProductClient(r, displayEtat(r))).map((r) => r.numero_client);
  assert.deepEqual(product, ['n°1', 'n°2', 'n°4']);
  const meeting = { rdv_lancement_date: '2099-01-01', rdv_lancement_done: false };
  assert.equal(matchesUpcomingIntegration({ ...EXIT_ACTED, ...meeting }, displayEtat(EXIT_ACTED)), false);
  assert.equal(matchesUpcomingIntegration({ ...PAUSE_ENDED, ...meeting }, displayEtat(PAUSE_ENDED)), true);
});

test("après un changement d'état, la ligne prend l'état renvoyé par le serveur", () => {
  const row = { ...SHEET_SAYS_SIGNED, meteo_score: 4 };
  const next = withConfirmedEtat(row, { etat: 'Résiliation', etat_date: '2099-01-01', etat_affiche: 'En cours de résiliation' });
  assert.equal(displayEtat(next), 'En cours de résiliation');
  assert.equal(next.etat_manuel, 'Résiliation');
  assert.equal(next.etat_date, '2099-01-01');
  assert.equal(next.meteo_score, 4);
  assert.equal(row.etat_affiche, 'Pause', 'la ligne d’origine reste intacte (rollback possible)');
  const auto = withConfirmedEtat(PAUSE_ENDED, { etat: null, etat_date: null, etat_affiche: 'Signé' });
  assert.equal(auto.etat_manuel, null);
  assert.equal(displayEtat(auto), 'Signé');
});

test("seule la réponse de la dernière pose sur un client fait foi", () => {
  const requests = createLatestRequestTracker();
  const first = requests.start('n°1');
  const other = requests.start('n°2');
  assert.equal(first(), true);
  const second = requests.start('n°1');
  assert.equal(first(), false, 'la réponse arrivée en retard de la 1re pose est écartée');
  assert.equal(second(), true);
  assert.equal(other(), true, 'un autre client n’est pas concerné');
});

// Garde-fou : la règle ne doit pas réapparaître ailleurs (décision dev 26/10/2026).
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return sources(path);
  return /\.(jsx?|mjs)$/.test(name) && !/\.test\.(jsx?|mjs)$/.test(name) ? [path] : [];
});
const OWNER = 'utils/boardClientState.js';
// Les commentaires peuvent citer le champ ; seul le code compte (`://` d'une URL n'est pas un commentaire).
const withoutComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test("l'état affiché n'est défini et lu qu'à un seul endroit", () => {
  const offenders = [];
  for (const path of sources(SRC)) {
    const file = relative(SRC, path);
    if (file === OWNER) continue;
    const code = withoutComments(readFileSync(path, 'utf8'));
    if (/(const|let|var|function)\s+displayEtat\b/.test(code)) offenders.push(`${file} : displayEtat redéfini`);
    if (/\betat_affiche\b/.test(code)) offenders.push(`${file} : etat_affiche lu sans displayEtat`);
  }
  assert.deepEqual(offenders, []);
});
