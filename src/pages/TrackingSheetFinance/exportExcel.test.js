// exportExcel.test.js : l'export Excel du tableau finance — colonnes d'origine inchangées, et, à la suite,
// l'état, les tags et les trois derniers échanges datés (demande de la finance du 17/11/2026).
//
// Lancement : `npm test` (cité dans le script `test` de package.json). Données inventées.

import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx-js-style';
import { strFromU8, unzipSync } from 'fflate';

import { buildExportRows, buildWorkbook, finishSheetXml, HEADER_ROW } from './exportExcel.js';
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
  // Tous les marqueurs du board : départ, no show / recalé, récupéré, attente Opti'Lex, vente non déclarée.
  const full = row('c3', 'n°3', 'Société Pleine', { client: { do_not_call: true, sale_undeclared: true } });
  assert.deepEqual(tagsOf(full, null, {
    pending: true, departure: 'En cours de rétractation', noShow: { label: 'No show', value: 'du 12/11' },
    recovered: { day: '18/11', toRestore: true },
  }), [
    'À ne pas rappeler', "Attente Opti'Lex", 'En cours de rétractation', 'No show du 12/11',
    'Récupéré le 18/11 (facturation à rétablir)', 'Vente non déclarée',
  ]);
  assert.deepEqual(tagsOf(full, null, { noShow: { label: 'Recalé', value: 'au 25/11' } }), ['À ne pas rappeler', 'Recalé au 25/11', 'Vente non déclarée']);
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

test('lecture : un compteur à 0 saute le fil commun (jamais les notes internes) ; compteur inconnu = lu', async () => {
  const rows = [row('c1', 'n°1', 'A'), row('c2', 'n°2', 'B'), row('c3', 'n°3', 'C')];
  const counts = { 'n°1': 0, 'n°2': 3 };                    // n°3 : inconnu
  const calls = [];
  const get = async (url) => { calls.push(url); return url.includes('/finance-periods/') ? [] : { comments: [] }; };
  await loadExchanges(rows, { get, sharedCountOf: (r) => counts[r.client.numero_client], concurrency: 1 });
  assert.ok(!calls.includes(sharedUrl('n°1')));
  assert.ok(calls.includes(sharedUrl('n°2')) && calls.includes(sharedUrl('n°3')));
  for (const id of ['c1', 'c2', 'c3']) assert.ok(calls.includes(notesUrl(id)), `notes de ${id}`);
});

test('lecture : une lecture en panne est retentée une fois, puis la concurrence baisse', async () => {
  const rows = Array.from({ length: 8 }, (_, i) => row(`c${i}`, `n°${i}`, `Société ${i}`));
  let flaky = true; let inFlight = 0; let peakAfter = 0; let slowed = false;
  const get = async (url) => {
    inFlight += 1; if (slowed) peakAfter = Math.max(peakAfter, inFlight);
    await new Promise((r) => setTimeout(r, 2));
    inFlight -= 1;
    if (flaky && url === sharedUrl('n°0')) { flaky = false; slowed = true; const e = new Error('503'); e.status = 503; throw e; }
    return { comments: [] };
  };
  const out = await loadExchanges(rows, { get, concurrency: 8, retryDelay: 0 });
  assert.equal(out.get('c0').failed, false);                // la relecture a réussi
  assert.ok(peakAfter <= 8);
  assert.equal(out.size, 8);
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
// Les données commencent après le titre, le contexte, le bandeau des familles et les en-têtes.
const grid = (sheet, opts = {}) => XLSX.utils.sheet_to_json(sheet, { header: 1, range: HEADER_ROW, ...opts });

test('sans échanges lus : les sept colonnes d\'origine, puis État, Météo et Tags, rien d\'autre', () => {
  const rows = [row('c1', 'n°1', 'Petite Société', { current: 100 }), row('c2', 'n°2', 'Grosse Société', { current: 500, prior: 200 })];
  const { book, name, count } = buildWorkbook({ rows, scope: 'owner', period: '2026-11-01' });
  assert.equal(name, 'retards-owner-2026-11.xlsx');
  assert.equal(count, 2);
  const table = grid(book.Sheets[book.SheetNames[0]]);
  assert.deepEqual(table[0], [...HEAD_BASE, 'État', 'Météo', 'Tags']);
  assert.deepEqual(table[1].slice(0, 5), ['n°2', 'Grosse Société', 200, 500, 700]);   // trié par total décroissant
  assert.deepEqual(table[2].slice(0, 5), ['n°1', 'Petite Société', 0, 100, 100]);
  // total des lignes affichées : une formule qui suit les filtres, avec sa valeur
  const total = table[3];
  assert.equal(total[0], 'Total des lignes affichées');
  assert.deepEqual(total.slice(2, 5), [200, 600, 800]);
  const sheet = book.Sheets[book.SheetNames[0]];
  assert.equal(sheet.E8.f, 'SUBTOTAL(109,E6:E7)');
});

test('mise en page : titre, familles de colonnes, filtres sur les en-têtes, un fond par ligne', () => {
  const rows = [row('c1', 'n°1', 'Société A', { current: 100 })];
  const { book } = buildWorkbook({ rows, scope: 'optilex', period: '2026-11-01', now: Date.UTC(2026, 10, 19, 9, 0) });
  const sheet = book.Sheets[book.SheetNames[0]];
  assert.equal(sheet.A1.v, "Suivi des retards — Opti'lex");
  assert.equal(sheet.A2.v, 'Période : novembre 2026   ·   1 client   ·   Exporté le 19/11/2026');
  assert.equal(sheet.A4.v, 'CLIENT');
  assert.equal(sheet.C4.v, 'CRÉANCES');
  assert.equal(sheet.A5.v, 'N° client');
  assert.equal(sheet['!autofilter'].ref, 'A5:J6');
  assert.ok(sheet['!merges'].some((m) => m.s.r === 3 && m.s.c === 2 && m.e.c === 4));
  assert.ok(sheet.A6.s.fill.fgColor.rgb);
});

test('couleurs : l\'état et la météo prennent celles du board ; les tags, une teinte selon leur gravité', () => {
  const rows = [
    row('c1', 'n°1', 'Société A', { current: 300 }),
    row('c2', 'n°2', 'Société B', { current: 200 }),
    row('c3', 'n°3', 'Société C', { current: 100 }),
  ];
  const boards = {
    c1: { departure: 'Rétractation', noShow: { label: 'No show', value: 'du 12/11' } },
    c2: { pending: true },
    c3: { recovered: { day: '18/11' } },
  };
  const { book } = buildWorkbook({
    rows, scope: 'owner', period: '2026-11-01',
    etatOf: () => 'Signé', etatToneOf: () => ({ bg: '#e2f6ea', fg: '#0b7a4b' }),
    meteoOf: (r) => (r.client_id === 'c1' ? { label: 'Insatisfait', score: 2, bg: '#fde6e6', fg: '#c5221f' } : null),
    boardOf: (r) => boards[r.client_id],
  });
  const sheet = book.Sheets[book.SheetNames[0]];
  assert.equal(sheet.H6.s.fill.fgColor.rgb, 'E2F6EA');     // état (colonne H)
  assert.equal(sheet.I6.v, 'Insatisfait (2/5)');           // météo (colonne I), colorée comme sur le board
  assert.equal(sheet.I6.s.fill.fgColor.rgb, 'FDE6E6');
  assert.equal(sheet.J6.v, 'Rétractation\nNo show du 12/11');   // un tag par ligne
  assert.equal(sheet.J6.s.fill.fgColor.rgb, 'FDE6E6');     // départ / no show : rouge
  assert.equal(sheet.J7.s.fill.fgColor.rgb, 'FBF1C2');     // attente Opti'Lex : ambre
  assert.equal(sheet.J8.s.fill.fgColor.rgb, 'E2F6EA');     // récupéré seul : vert
});

test('fichier final : en-têtes figés, quadrillage masqué, et le classeur se relit', () => {
  const { book } = buildWorkbook({ rows: [row('c1', 'n°1', 'Société A', { current: 100 })], scope: 'owner', period: '2026-11-01' });
  const bytes = finishSheetXml(new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array' })), HEADER_ROW + 1);
  const back = XLSX.read(bytes);
  assert.equal(back.Sheets[back.SheetNames[0]].A6.v, 'n°1');
  const xml = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
  assert.match(xml, /<pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"\/>/);
  assert.match(xml, /showGridLines="0"/);
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
  const table = grid(sheet);
  assert.deepEqual(table[0], [
    ...HEAD_BASE, 'État', 'Météo', 'Tags', 'Date du dernier échange', 'Dernier échange', '2e échange', '3e échange',
  ]);
  const [a, b, c] = table.slice(1);
  assert.equal(a[1], 'Société A');
  assert.equal(a[7], 'Onboarding');
  assert.equal(a[8], 'Satisfait (4/5)');
  assert.equal(a[9], 'À ne pas rappeler');
  assert.equal(a[10], excelSerial(Date.UTC(2026, 10, 17, 10, 48)));
  assert.equal(a[11], '17/11/2026 11:48 · Alice Test · Interne : En cours de reprogrammation');
  assert.equal(a[12], '12/11/2026 09:00 · Bruno Test · Interne : Contrat renvoyé');
  assert.equal(a[13], '05/11/2026 10:00 · Cabinet Test : Dossier reçu');           // « Trop ancien » : 4e, non gardé
  // lecture en échec : dit dans la cellule, pas de date ; client absent de la table : cellules vides
  assert.equal(b[1], 'Société B');
  assert.equal(b[11], 'Échanges non lus (erreur de lecture)');
  assert.equal(b[10], '');
  assert.equal(c[1], 'Société C');
  assert.equal(c[10], '');
  assert.equal(c[11], '');
  // formats : montants en €, date-heure sur la colonne de date (vue telle qu'Excel l'affiche)
  assert.equal(sheet.E6.z, '# ##0.00\\ "€"');
  assert.equal(sheet.K6.t, 'n');
  assert.equal(sheet.K6.z, 'dd/mm/yyyy\\ hh:mm');
  const shown = grid(sheet, { raw: false });
  assert.equal(shown[1][10], '17/11/2026 11:48');
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
