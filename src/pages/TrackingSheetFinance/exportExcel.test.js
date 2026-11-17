// exportExcel.test.js : l'export Excel du tableau finance — colonnes d'origine inchangées, et, à la suite,
// l'état, les tags et les trois derniers échanges datés (demande de la finance du 17/11/2026).
//
// Lancement : `npm test` (cité dans le script `test` de package.json). Données inventées.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import { buildExportRows, buildWorkbook } from './exportExcel.js';
import {
  latestExchanges, formatExchange, parisText, excelSerial, promiseLabel, tagsOf, loadExchanges, exchangeKey,
} from './exportExchanges.js';

const zero = { current_overdue: 0, prior_remaining: 0, opening_debt: 0, recovered_prior: 0, not_due: 0, credit: 0 };
const row = (id, numero, name, { current = 0, prior = 0, client = {}, ...rest } = {}) => ({
  id: `p-${id}`,
  client_id: id,
  balance_owner: { ...zero, current_overdue: current, prior_remaining: prior },
  client: { numero_client: numero, company_name: name, phone: '+33 6 00 00 00 00', email: `${id}@example.test`, ...client },
  ...rest,
});

// ── échanges : fusion, tri, nettoyage ───────────────────────────────────────

test('les trois derniers échanges, tous espaces confondus, le plus récent d\'abord', () => {
  const shared = [
    { id: 1, body: 'Cabinet : dossier reçu.', author_name: 'Cabinet Test', created_at: '2026-11-10T09:00:00+00:00' },
    { id: 2, body: 'Cabinet : relance.', author_name: 'Cabinet Test', created_at: '2026-11-16T09:00:00+00:00' },
  ];
  const notes = [
    { id: 'n1', body: 'Ne pas rappeler avant le 20.', author_name: 'Alice Test', created_at: '2026-11-17T10:48:00+00:00' },
    { id: 'n2', body: 'Contrat renvoyé.', author_name: 'Bruno Test', created_at: '2026-11-12T08:00:00+00:00' },
  ];
  const out = latestExchanges(shared, notes);
  assert.deepEqual(out.map((e) => e.body), ['Ne pas rappeler avant le 20.', 'Cabinet : relance.', 'Contrat renvoyé.']);
  assert.deepEqual(out.map((e) => e.internal), [true, false, true]);
  assert.equal(latestExchanges(shared, notes, 1).length, 1);
  assert.equal(latestExchanges(shared, notes, 10).length, 4);
});

test('un échange vide ou sans date lisible est écarté ; une date sans fuseau est lue en UTC', () => {
  const out = latestExchanges(
    [{ id: 1, body: '   ', created_at: '2026-11-10T09:00:00Z' }, { id: 2, body: 'x', created_at: 'n-importe-quoi' }, null],
    [{ id: 'a', body: 'Note', author_email: 'a@example.test', created_at: '2026-11-17T10:00:00' }],
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].at, Date.UTC(2026, 10, 17, 10, 0, 0));
  assert.equal(out[0].author, 'a@example.test');
});

test('retours à la ligne aplatis, texte long tronqué (une cellule = une ligne)', () => {
  const [one] = latestExchanges([{ id: 1, body: 'Ligne 1\n\n  Ligne 2', created_at: '2026-11-10T09:00:00Z' }]);
  assert.equal(one.body, 'Ligne 1 / Ligne 2');
  const [long] = latestExchanges([{ id: 2, body: 'a'.repeat(900), created_at: '2026-11-10T09:00:00Z' }]);
  assert.equal(long.body.length, 500);
  assert.ok(long.body.endsWith('…'));
});

test('format lisible : date et heure de Paris, auteur, mention « Interne » seulement pour les notes internes', () => {
  const [note] = latestExchanges([], [{ id: 'n', body: 'En cours de reprogrammation', author_name: 'Alice Test', created_at: '2026-11-17T10:48:00Z' }]);
  assert.equal(formatExchange(note), '17/11/2026 11:48 · Alice Test · Interne : En cours de reprogrammation');
  const [msg] = latestExchanges([{ id: 1, body: 'Dossier reçu', author_name: 'Cabinet Test', created_at: '2026-07-01T10:00:00Z' }]);
  assert.equal(formatExchange(msg), '01/07/2026 12:00 · Cabinet Test : Dossier reçu');
});

// ── dates ───────────────────────────────────────────────────────────────────

test('heure de Paris : hiver UTC+1, été UTC+2, minuit sans « 24 h »', () => {
  assert.equal(parisText(Date.UTC(2026, 10, 17, 10, 48)), '17/11/2026 11:48');
  assert.equal(parisText(Date.UTC(2026, 6, 1, 10, 0)), '01/07/2026 12:00');
  assert.equal(parisText(Date.UTC(2026, 10, 16, 23, 5)), '17/11/2026 00:05');
});

test('numéro de série Excel : la cellule affiche l\'heure murale de Paris, quel que soit le poste', () => {
  // 01/01/2026 = jour 46 023 d'Excel ; le 17/11 est le 321e jour de l'année. 11 h 48 = 708 minutes.
  const serial = excelSerial(Date.UTC(2026, 10, 17, 10, 48));
  assert.equal(Math.floor(serial), 46023 + 320);
  assert.equal(Math.round((serial % 1) * 1440), 708);
  // Été : 01/07 = 182e jour ; 10 h UTC = 12 h à Paris.
  const summer = excelSerial(Date.UTC(2026, 6, 1, 10, 0));
  assert.equal(Math.floor(summer), 46023 + 181);
  assert.equal(Math.round((summer % 1) * 1440), 720);
});

// ── tags ────────────────────────────────────────────────────────────────────

test('tags : « à ne pas rappeler », promesse de règlement (objet ou texte), perte actée, météo', () => {
  assert.equal(promiseLabel({ promised_for: '2026-10-30', note: 'Virement annoncé' }), 'Promesse de règlement (30/10/2026 — Virement annoncé)');
  assert.equal(promiseLabel({ promised_for: '2026-10-30' }), 'Promesse de règlement (30/10/2026)');
  assert.equal(promiseLabel('Oui'), 'Promesse de règlement');
  assert.equal(promiseLabel('Paiera fin octobre'), 'Promesse de règlement (Paiera fin octobre)');
  assert.equal(promiseLabel(true), 'Promesse de règlement');
  const r = row('c1', 'n°1', 'Société Test', { client: { do_not_call: true, payment_promise: { promised_for: '2026-10-30', note: '' }, is_loss: true } });
  assert.deepEqual(tagsOf(r, { label: 'Satisfait', score: 4 }), [
    'À ne pas rappeler', 'Promesse de règlement (30/10/2026)', 'Perte actée', 'Météo Satisfait (4/5)',
  ]);
  assert.deepEqual(tagsOf(row('c2', 'n°2', 'Autre Test')), []);
  assert.deepEqual(tagsOf(null), []);
});

// ── lecture ─────────────────────────────────────────────────────────────────

const sharedUrl = (n) => `/api/v1/optilex/comments?numero_client=${encodeURIComponent(n)}`;
const notesUrl = (id) => `/api/v1/finance-periods/client/${id}/comments`;

test('lecture : les deux sources par client, une seule fois même si la liste répète le client, avancement rapporté', async () => {
  const rows = [row('c1', 'n°1', 'A'), row('c2', 'n°2', 'B'), row('c1', 'n°1', 'A')];
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    if (url === sharedUrl('n°1')) return { comments: [{ id: 1, body: 'Message commun', created_at: '2026-11-10T09:00:00Z', author_name: 'Cabinet Test' }] };
    if (url === notesUrl('c1')) return [{ id: 'n1', body: 'Note interne', created_at: '2026-11-11T09:00:00Z', author_name: 'Alice Test' }];
    return { comments: [] };
  };
  const progress = [];
  const out = await loadExchanges(rows, { get, onProgress: (d, t) => progress.push([d, t]) });
  assert.equal(calls.length, 4);                       // 2 clients × 2 sources
  assert.deepEqual(out.get('c1').items.map((e) => e.body), ['Note interne', 'Message commun']);
  assert.deepEqual(out.get('c2').items, []);
  assert.equal(out.get('c1').failed, false);
  assert.deepEqual(progress.at(-1), [2, 2]);
});

test('lecture : jamais plus de lectures simultanées que la limite', async () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(`c${i}`, `n°${i}`, `Société ${i}`));
  let inFlight = 0; let peak = 0;
  const get = async () => {
    inFlight += 1; peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return { comments: [] };
  };
  await loadExchanges(rows, { get, concurrency: 3 });
  // 3 clients en parallèle, 2 lectures chacun
  assert.ok(peak <= 6, `pic de ${peak} lectures simultanées`);
});

test('lecture : un refus du serveur (403) sur les notes internes les écarte, sans erreur, et ne réinterroge plus la source', async () => {
  const rows = [row('c1', 'n°1', 'A'), row('c2', 'n°2', 'B'), row('c3', 'n°3', 'C')];
  const notesCalls = [];
  const get = async (url) => {
    if (url.includes('/finance-periods/')) { notesCalls.push(url); const e = new Error('Interdit'); e.status = 403; throw e; }
    return { comments: [{ id: 1, body: 'Message commun', created_at: '2026-11-10T09:00:00Z' }] };
  };
  const out = await loadExchanges(rows, { get, concurrency: 1 });
  assert.equal(notesCalls.length, 1);
  for (const key of ['c1', 'c2', 'c3']) {
    assert.equal(out.get(key).failed, false);
    assert.deepEqual(out.get(key).items.map((e) => e.internal), [false]);
  }
});

test('lecture : une panne réseau / serveur est signalée (failed), le reste du client est gardé', async () => {
  const get = async (url) => {
    if (url.startsWith('/api/v1/optilex/')) { const e = new Error('Erreur serveur'); e.status = 500; throw e; }
    return [{ id: 'n1', body: 'Note interne', created_at: '2026-11-11T09:00:00Z' }];
  };
  const out = await loadExchanges([row('c1', 'n°1', 'A')], { get });
  assert.equal(out.get('c1').failed, true);
  assert.equal(out.get('c1').items.length, 1);
});

test('un client sans numéro (contrat en attente) n\'appelle aucune source', async () => {
  const pending = { id: 'pending-1', pending: true, client: { company_name: 'En attente' } };
  let called = 0;
  const out = await loadExchanges([pending], { get: async () => { called += 1; return {}; } });
  assert.equal(called, 0);
  assert.deepEqual(out.get(exchangeKey(pending)), { items: [], failed: false });
});

// ── classeur ────────────────────────────────────────────────────────────────

const HEAD_BASE = ['N° client', 'Client', 'Créances antérieures', 'Créance du mois en cours', 'Total en retard', 'Téléphone', 'Email'];

test('sans échanges lus : les sept colonnes d\'origine, puis État et Tags, rien d\'autre', () => {
  const rows = [row('c1', 'n°1', 'Petite Société', { current: 100 }), row('c2', 'n°2', 'Grosse Société', { current: 500, prior: 200 })];
  const { book, name, count } = buildWorkbook({ rows, scope: 'owner', period: '2026-11-01' });
  assert.equal(name, 'retards-owner-2026-11.xlsx');
  assert.equal(count, 2);
  const table = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 });
  assert.deepEqual(table[0], [...HEAD_BASE, 'État', 'Tags']);
  assert.deepEqual(table[1].slice(0, 5), ['n°2', 'Grosse Société', 200, 500, 700]);   // trié par total décroissant
  assert.deepEqual(table[2].slice(0, 5), ['n°1', 'Petite Société', 0, 100, 100]);
});

test('avec échanges : colonnes État, Tags, date du dernier échange (vraie date Excel) et trois échanges', () => {
  const rows = [
    row('c1', 'n°1', 'Société A', { current: 300, client: { do_not_call: true } }),
    row('c2', 'n°2', 'Société B', { current: 100 }),
    row('c3', 'n°3', 'Société C', { current: 50 }),
  ];
  const exchanges = new Map([
    ['c1', { failed: false, items: latestExchanges(
      [{ id: 1, body: 'Dossier reçu', author_name: 'Cabinet Test', created_at: '2026-11-05T09:00:00Z' }],
      [{ id: 'n1', body: 'En cours de reprogrammation', author_name: 'Alice Test', created_at: '2026-11-17T10:48:00Z' },
        { id: 'n2', body: 'Contrat renvoyé', author_name: 'Bruno Test', created_at: '2026-11-12T08:00:00Z' },
        { id: 'n3', body: 'Trop ancien', author_name: 'Bruno Test', created_at: '2026-10-01T08:00:00Z' }],
    ) }],
    ['c2', { failed: true, items: [] }],
  ]);
  const { book } = buildWorkbook({
    rows, scope: 'owner', period: '2026-11-01', exchanges,
    etatOf: (r) => (r.client_id === 'c1' ? 'Onboarding' : null),
    meteoOf: (r) => (r.client_id === 'c1' ? { label: 'Satisfait', score: 4 } : null),
  });
  const sheet = book.Sheets[book.SheetNames[0]];
  const table = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  assert.deepEqual(table[0], [
    ...HEAD_BASE, 'État', 'Tags', 'Date du dernier échange', 'Dernier échange', '2e échange', '3e échange',
  ]);
  const [a, b, c] = table.slice(1);
  assert.equal(a[1], 'Société A');
  assert.equal(a[7], 'Onboarding');
  assert.equal(a[8], 'À ne pas rappeler · Météo Satisfait (4/5)');
  assert.equal(a[9], excelSerial(Date.UTC(2026, 10, 17, 10, 48)));
  assert.equal(a[10], '17/11/2026 11:48 · Alice Test · Interne : En cours de reprogrammation');
  assert.equal(a[11], '12/11/2026 09:00 · Bruno Test · Interne : Contrat renvoyé');
  assert.equal(a[12], '05/11/2026 10:00 · Cabinet Test : Dossier reçu');           // « Trop ancien » : 4e, non gardé
  // lecture en échec : dit dans la cellule, pas de date ; client absent de la table : cellules vides
  assert.equal(b[1], 'Société B');
  assert.equal(b[10], 'Échanges non lus (erreur de lecture)');
  assert.equal(b[9], '');
  assert.equal(c[1], 'Société C');
  assert.equal(c[9], '');
  assert.equal(c[10], '');
  // formats : montants en €, date-heure sur la colonne de date (vue telle qu'Excel l'affiche)
  assert.equal(sheet.E2.z, '# ##0.00\\ "€"');
  assert.equal(sheet.J2.t, 'n');
  assert.equal(sheet.J2.z, 'dd/mm/yyyy\\ hh:mm');
  const shown = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  assert.equal(shown[1][9], '17/11/2026 11:48');
});

test('les colonnes et valeurs d\'origine sont strictement les mêmes avec ou sans échanges', () => {
  const rows = [row('c1', 'n°1', 'Société A', { current: 300 }), row('c2', 'n°2', 'Société B', { current: 100, prior: 50 })];
  const without = buildExportRows(rows, 'owner');
  const withEx = buildExportRows(rows, 'owner', { exchanges: new Map() });
  for (let i = 0; i < without.length; i += 1) {
    for (const k of ['numero', 'client', 'anterieures', 'moisCourant', 'total', 'telephone', 'email']) {
      assert.equal(withEx[i][k], without[i][k], `${k} ligne ${i}`);
    }
  }
});
