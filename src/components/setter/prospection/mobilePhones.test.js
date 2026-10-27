// Filtre « mobiles uniquement » de « Mes listes » : `node --test src/components/setter/prospection/mobilePhones.test.js`

import test from 'node:test';
import assert from 'node:assert/strict';
import { crmMobileSelection, formatCsv, isMobilePhone, keepMobileRows, mobilePage, parseCsv } from './mobilePhones.js';

// CSV écrit par le csv.writer du serveur (prospection_service.export_csv) : BOM, « ; », CRLF, une raison sociale à
// guillemets et point-virgule, une activité sur deux lignes, un fixe, un 09, un mobile en +33 7 et une fiche sans numéro.
const HEADER = 'Entreprise;SIREN;Activité;Code NAF;Ville;Département;Effectif;Création;Téléphone;Site web;Dirigeant;Qualité;Statut;Dans le CRM\r\n';
const DUPONT = 'Plomberie Dupont;123456789;Travaux d\'installation d\'eau et de gaz;43.22A;LYON;69;Entre 10 et 19 salariés;mars 2012;06 12 34 56 78;https://dupont.example;Paul Dupont;Gérant;À contacter;non\r\n';
const MARTIN = '"Martin; Fils ""SARL""";223456789;"Plomberie\nchauffage";43.22A;VILLEURBANNE;69;;juin 2001;04 72 00 11 22;;;;Contactée;non\r\n';
const BERNARD = 'Éts Bernard;323456789;Plomberie;43.22A;BRON;69;Au moins 1 salarié;janv. 2020;+33 7 55 66 77 88;https://bernard.example;Léa Bernard;Présidente, Gérante;A répondu;oui\r\n';
const SANS = 'Sans Téléphone SAS;423456789;Plomberie;43.22A;LYON;69;;;;;;;Écartée;non\r\n';
const BOX = 'Box 09;523456789;Plomberie;43.22A;LYON;69;;;09 51 23 45 67;;;;À contacter;non\r\n';
const SERVER_CSV = `\uFEFF${HEADER}${DUPONT}${MARTIN}${BERNARD}${SANS}${BOX}`;

test('06 et 07, dans toutes les écritures courantes, sont des mobiles', () => {
  for (const phone of [
    '0612345678', '06 12 34 56 78', '06.12.34.56.78', '06-12-34-56-78', '07 55 66 77 88', '0755667788',
    '+33 6 12 34 56 78', '+33612345678', '+33 7 55 66 77 88', '0033 6 12 34 56 78', '0033612345678',
    '+33 (0)6 12 34 56 78', '+33 0 6 12 34 56 78', '33 6 12 34 56 78', '6 12 34 56 78', '612345678', '  06 12 34 56 78  ',
    '06 90 00 00 00', '07 75 00 00 00',
  ]) assert.equal(isMobilePhone(phone), true, phone);
});

test('fixes, 08, 09, numéros étrangers, incomplets ou vides ne sont pas des mobiles', () => {
  for (const phone of [
    '04 72 00 11 22', '01 23 45 67 89', '02 40 00 00 00', '03 20 00 00 00', '05 56 00 00 00', '09 51 23 45 67', '08 05 12 34 56',
    '+33 4 72 00 11 22', '+33 1 23 45 67 89', '0033 4 72 00 11 22', '+33 (0)4 72 00 11 22', '472001122',
    '+32 470 12 34 56', '+44 7911 123456', '+1 415 555 0100',
    '06 12 34 56', '06 12 34 56 78 90', '6123456789', '3306123456789',
    '', '   ', 'n/a', '—', null, undefined, 0, 612345678.5,
  ]) assert.equal(isMobilePhone(phone), false, String(phone));
});

test('un champ à plusieurs numéros est gardé dès qu\'un seul est un mobile', () => {
  for (const phone of [
    '04 72 00 11 22 / 06 12 34 56 78', '0472001122/0612345678', '04 72 00 11 22 - 06 12 34 56 78', '+33 4 72 00 11 22 - +33 6 12 34 56 78',
    '0472001122 ou 0612345678', '04 72 00 11 22 et 07 55 66 77 88', '04 72 00 11 22; +33 7 55 66 77 88', '04 72 00 11 22, 06 12 34 56 78',
    '04 72 00 11 22 | 06 12 34 56 78', '04 72 00 11 22\n06 12 34 56 78', '06 12 34 56 78 / 07 55 66 77 88', '06 12 34 56 78, 04 72 00 11 22',
    '06 - 12 - 34 - 56 - 78',
  ]) assert.equal(isMobilePhone(phone), true, phone);
});

test('plusieurs numéros, aucun mobile : écarté', () => {
  for (const phone of [
    '04 72 00 11 22 / 01 23 45 67 89', '0472001122 ou 0951234567', '+33 4 72 00 11 22 - +33 1 23 45 67 89', '+32 470 12 34 56 / 04 72 00 11 22',
    '04 72 00 11 22 / n/a', '04 72 00 11 22 / 06 12 34 56',
  ]) assert.equal(isMobilePhone(phone), false, phone);
});

// Tableau de référence de la demande : « numéro → résultat attendu » (vides et invalides : plusieurs écritures chacun).
const TABLEAU = [
  ['0612345678', true], ['0712345678', true], ['+33612345678', true], ['+33712345678', true], ['0033612345678', true],
  ['0123456789', false], ['0212345678', false], ['0412345678', false], ['0512345678', false], ['0912345678', false],
  ['', false], ['   ', false], [null, false], [undefined, false],
  ['abc', false], ['0612', false], ['061234567890', false], ['+3361234', false], ['0000000000', false],
  // pièges : « 06 » ou « 07 » au milieu d'un fixe ne font pas un mobile (on vérifie le préfixe, pas une sous-chaîne)
  ['0472060722', false], ['04 72 06 07 22', false], ['0106070809', false], ['+33 4 72 06 07 22', false],
];

test('tableau de référence : 06 / 07 (national, +33, 0033) inclus ; 01, 02, 04, 05, 09, vides et invalides exclus', () => {
  for (const [phone, attendu] of TABLEAU) assert.equal(isMobilePhone(phone), attendu, String(phone));
});

const item = (id, phone, extra = {}) => ({ id, company: { name: `Société ${id}`, phone }, status: 'a_contacter', manual_status: 'a_contacter', crm_lead_id: null, ...extra });
const MIX = [
  item(1, '06 11 11 11 11'), item(2, '04 72 00 00 01'), item(3, '+33 7 22 22 22 22'), item(4, null),
  item(5, '07 33 33 33 33'), item(6, '09 51 00 00 02'), item(7, '06 44 44 44 44'),
];

test('mobilePage : seules les entreprises à mobile, avec la forme de la réponse du serveur', () => {
  const p = mobilePage(MIX, { page: 1, pageSize: 50 });
  assert.deepEqual(p.items.map((i) => i.id), [1, 3, 5, 7]);
  assert.deepEqual({ total: p.total, excluded: p.excluded, page: p.page, pages: p.pages, page_size: p.page_size }, { total: 4, excluded: 3, page: 1, pages: 1, page_size: 50 });
});

test('mobilePage : pagine sur les mobiles seuls et ramène une page hors limites dans la liste', () => {
  const second = mobilePage(MIX, { page: 2, pageSize: 3 });
  assert.deepEqual(second.items.map((i) => i.id), [7]);
  assert.equal(second.pages, 2);
  assert.equal(mobilePage(MIX, { page: 9, pageSize: 3 }).page, 2);
  assert.equal(mobilePage(MIX, { page: -4, pageSize: 3 }).page, 1);
});

test('mobilePage : aucun mobile → une page vide, tout est écarté', () => {
  const p = mobilePage([item(1, '04 72 00 00 01'), item(2, null)], { page: 1, pageSize: 50 });
  assert.deepEqual({ total: p.total, excluded: p.excluded, pages: p.pages, items: p.items }, { total: 0, excluded: 2, pages: 1, items: [] });
  assert.deepEqual(mobilePage([]).items, []);
});

test('crmMobileSelection : les mobiles pas encore au CRM ni écartés, et combien de fixes restent', () => {
  const all = [
    item(1, '06 11 11 11 11'), item(2, '04 72 00 00 01'), item(3, '06 22 22 22 22', { crm_lead_id: 40 }),
    item(4, '07 33 33 33 33', { manual_status: 'ecarte', status: 'ecarte' }), item(5, null), item(6, '07 55 55 55 55'),
  ];
  assert.deepEqual(crmMobileSelection(all), { ids: [1, 6], left: 2 });
});

test('crmMobileSelection : sans mobile à exporter, la liste d\'ids est vide (l\'appelant ne doit alors rien envoyer au serveur)', () => {
  assert.deepEqual(crmMobileSelection([item(1, '04 72 00 00 01'), item(2, '06 11 11 11 11', { crm_lead_id: 3 })]), { ids: [], left: 1 });
});

test('parseCsv puis formatCsv redonnent exactement le CSV du serveur (guillemets, « ; » et saut de ligne dans un champ)', () => {
  const body = SERVER_CSV.slice(1);
  assert.equal(formatCsv(parseCsv(body)), body);
  const rows = parseCsv(body);
  assert.equal(rows.length, 6);
  assert.equal(rows[2][0], 'Martin; Fils "SARL"');
  assert.equal(rows[2][2], 'Plomberie\nchauffage');
  assert.ok(rows.every((r) => r.length === 14));
});

test('keepMobileRows : en-tête gardé, lignes intactes, fixes / 09 / sans numéro écartés', () => {
  const r = keepMobileRows(SERVER_CSV);
  assert.equal(r.csv, `${HEADER}${DUPONT}${BERNARD}`);
  assert.deepEqual({ kept: r.kept, dropped: r.dropped }, { kept: 2, dropped: 3 });
});

test('keepMobileRows : le même résultat avec fins de ligne simples ou sans BOM, et avec un en-tête en capitales accentuées', () => {
  const lf = SERVER_CSV.replace(/\r\n/g, '\n');
  assert.equal(keepMobileRows(lf).kept, 2);
  assert.equal(keepMobileRows(SERVER_CSV.slice(1)).csv, `${HEADER}${DUPONT}${BERNARD}`);
  const caps = SERVER_CSV.replace('Téléphone', 'TÉLÉPHONE');
  assert.equal(keepMobileRows(caps).kept, 2);
});

test('keepMobileRows : aucun mobile → l\'en-tête seul, et le compte le dit', () => {
  const r = keepMobileRows(`${HEADER}${MARTIN}${SANS}${BOX}`);
  assert.deepEqual({ csv: r.csv, kept: r.kept, dropped: r.dropped }, { csv: HEADER, kept: 0, dropped: 3 });
});

test('keepMobileRows : une ligne trop courte est écartée, une colonne « Téléphone » absente interrompt tout', () => {
  assert.equal(keepMobileRows(`${HEADER}Court;1;2\r\n${DUPONT}`).kept, 1);
  assert.throws(() => keepMobileRows('Entreprise;SIREN\r\nA;1\r\n'), /Téléphone/);
  assert.throws(() => keepMobileRows(''), /Téléphone/);
});

test('tableau de référence : la liste, le CSV et l\'export CRM retiennent exactement les mêmes entreprises', () => {
  const lignes = TABLEAU.map(([phone], i) => item(i + 1, phone));
  const gardees = TABLEAU.flatMap(([, attendu], i) => (attendu ? [i + 1] : []));
  assert.deepEqual(mobilePage(lignes, { page: 1, pageSize: 100 }).items.map((i) => i.id), gardees);
  assert.deepEqual(crmMobileSelection(lignes), { ids: gardees, left: TABLEAU.length - gardees.length });
  const csv = HEADER + TABLEAU.map(([phone], i) => `Société ${i + 1};;;;;;;;${phone ?? ''};;;;;\r\n`).join('');
  const fichier = keepMobileRows(csv);
  assert.deepEqual({ kept: fichier.kept, dropped: fichier.dropped }, { kept: gardees.length, dropped: TABLEAU.length - gardees.length });
  assert.deepEqual(fichier.csv.split('\r\n').filter(Boolean).slice(1).map((ligne) => ligne.split(';')[8]), TABLEAU.filter(([, attendu]) => attendu).map(([phone]) => phone));
});
