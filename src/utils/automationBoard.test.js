import test from 'node:test';
import assert from 'node:assert/strict';
import { classificationOf, countLabel, filterHistory, fold, periodLabel, sizeLabel, stepOf, visibleRows } from './automationBoard.js';

const ROWS = [
  { id: 1, name: 'Process REM', parentId: null, classification: 'pending_validation', pole: { group: 'both' }, toConfirm: false },
  { id: 2, name: 'Note de rémunération annuelle', parentId: 1, classification: 'pending_validation', pole: { group: 'both' }, toConfirm: true },
  { id: 3, name: 'Licence de marque', parentId: 1, classification: 'automated', pole: { group: 'fiscal' }, toConfirm: false },
  { id: 4, name: 'Question juridique', parentId: null, classification: 'automated', pole: { group: 'social' }, toConfirm: true },
];
const ids = (list) => list.map((item) => item.row.id);

test('visibleRows : un process porte ses missions sous lui, et se replie', () => {
  const all = visibleRows(ROWS);
  assert.deepEqual(ids(all), [1, 2, 3, 4]);
  assert.deepEqual(all.map((item) => item.depth), [0, 1, 1, 0]);
  assert.equal(all[0].children, 2);
  assert.deepEqual(ids(visibleRows(ROWS, { closed: new Set([1]) })), [1, 4]);
});

test('visibleRows : une mission trouvée garde son process au-dessus, même replié', () => {
  const found = visibleRows(ROWS, { query: 'REMUNERATION', closed: new Set([1]) });
  assert.deepEqual(ids(found), [1, 2]);
  assert.equal(found[0].dimmed, true);
  assert.deepEqual(ids(visibleRows(ROWS, { query: 'process rem' })), [1, 2, 3]);
  assert.deepEqual(ids(visibleRows(ROWS, { classification: 'automated' })), [1, 3, 4]);
  assert.deepEqual(ids(visibleRows(ROWS, { pole: 'social' })), [4]);
  assert.deepEqual(ids(visibleRows(ROWS, { toConfirm: true })), [1, 2, 4]);
  assert.deepEqual(visibleRows(ROWS, { query: 'introuvable' }), []);
  assert.deepEqual(visibleRows(null), []);
});

test('visibleRows : une mission dont le process est absent reste une ligne à part', () => {
  assert.deepEqual(ids(visibleRows([{ id: 9, name: 'Seule', parentId: 77, classification: 'automated' }])), [9]);
});

test('libellés : période, étape, classement, comptes, tailles', () => {
  assert.equal(periodLabel(null), 'Depuis la mise en place');
  assert.equal(periodLabel(7), '7 derniers jours');
  assert.equal(fold('  Rémunération '), 'remuneration');
  const steps = [{ value: 0, label: 'Non commencé', percent: 0 }, { value: 1, label: 'Cahier des charges envoyé', percent: 25 }, { value: 2, label: 'V1', percent: 50 }];
  assert.deepEqual(stepOf(steps, 1), { value: 1, label: 'Cahier des charges envoyé', percent: 25, last: 2 });
  assert.deepEqual(stepOf(null, 3), { value: 3, label: '', percent: 0, last: 0 });
  assert.equal(classificationOf([{ value: 'automated', label: 'Automatisée' }], 'automated').label, 'Automatisée');
  assert.equal(classificationOf([], 'inconnu').shortLabel, 'Non classée');
  assert.equal(countLabel(1, 'mission', 'missions'), '1 mission');
  assert.equal(countLabel(0, 'mission', 'missions'), '0 mission');
  assert.equal(sizeLabel(900), '900 o');
  assert.equal(sizeLabel(20480), '20 Ko');
  assert.equal(sizeLabel(3 * 1024 * 1024 + 300000), '3,3 Mo');
});

test('filterHistory : un seul type, sans jour vide', () => {
  const history = [
    { day: '2026-11-10', items: [{ filter: 'comments' }, { filter: 'decisions' }] },
    { day: '2026-11-09', items: [{ filter: 'decisions' }] },
  ];
  assert.equal(filterHistory(history, '').length, 2);
  assert.deepEqual(filterHistory(history, 'comments'), [{ day: '2026-11-10', items: [{ filter: 'comments' }] }]);
  assert.deepEqual(filterHistory(undefined, 'comments'), []);
});

test("le suivi d'Owner se mêle à l'historique d'Opti'Lex, et chaque entrée garde une clé stable", async () => {
  const { eventKey, mergeHistory, missionComments, repliesTo } = await import("./automationBoard.js");
  const history = [
    { day: "2026-11-10", label: "mardi 10 novembre", items: [
      { time: "16:42", what: "Note", who: "Direction", text: "Calcul validé.", filter: "comments" },
      { time: "11:05", what: "Étape passée à « Tests »", who: "Direction", note: "Recette le 16.", filter: "decisions" }] },
    { day: "2026-11-06", label: "vendredi 6 novembre", items: [{ time: "09:30", what: "Document ajouté", who: "Direction", file: { name: "cdc.pdf", size: 10 }, filter: "files" }] },
  ];
  const key = eventKey("2026-11-10", history[0].items[1]);
  assert.match(key, /^x:[0-9a-f]{16}$/);
  assert.equal(key, eventKey("2026-11-10", { ...history[0].items[1], note: "autre texte" }));
  assert.notEqual(key, eventKey("2026-11-11", history[0].items[1]));
  const entries = [
    { id: 5, key: "o:5", kind: "comment", target_key: key, body: "Vu.", author_name: "Alice", created_at: "2026-11-11T08:00:00+00:00", mine: true, files: [] },
    { id: 4, key: "o:4", kind: "comment", target_key: null, body: "Prioritaire.", author_name: "Alice", created_at: "2026-11-11T07:00:00+00:00", mine: true, files: [] },
    { id: 3, key: "o:3", kind: "document", target_key: null, body: "", author_name: "Bruno", created_at: "2026-11-09T10:00:00+00:00", mine: false, files: [{ id: "f", file_name: "v4.pdf" }] },
    { id: 2, key: "o:2", kind: "update", target_key: null, body: "Recette faite.", author_name: "Bruno", created_at: "2026-11-12T09:15:00+00:00", mine: false, files: [] },
  ];
  const merged = mergeHistory(history, entries);
  assert.deepEqual(merged.days.map((day) => day.day), ["2026-11-12", "2026-11-10", "2026-11-09", "2026-11-06"]);
  assert.deepEqual(merged.days[0].items.map((item) => [item.key, item.what, item.time]), [["o:2", "Point d’avancement", "10:15"]]);
  assert.deepEqual(merged.counts, { steps: 2, files: 2 });
  assert.deepEqual(mergeHistory(history, entries, "files").days.map((day) => day.items[0].what), ["Document déposé", "Document ajouté"]);
  assert.deepEqual(missionComments(history, entries).map((item) => [item.shared, item.text]), [[false, "Prioritaire."], [true, "Calcul validé."]]);
  assert.deepEqual(repliesTo(entries, key).map((item) => item.text), ["Vu."]);
  assert.deepEqual(repliesTo(entries, "o:2"), []);
});

test("le parcours d'une mission : des jalons datés, l'étape en cours, la suite, et le reste rangé dessous", async () => {
  const { journey, eventSentence, eventKey } = await import("./automationBoard.js");
  const steps = [{ value: 0, label: "Non commencé" }, { value: 1, label: "Cahier des charges envoyé" }, { value: 2, label: "V1 réalisée, non testée" }, { value: 3, label: "V1 testée et approuvée" }];
  const history = [
    { day: "2026-11-10", items: [{ time: "11:05", kind: "decision", filter: "decisions", what: "a changé l'étape", who: "Direction", detail: "Cahier des charges envoyé → V1 réalisée, non testée" },
      { time: "09:00", kind: "comment", filter: "comments", what: "a commenté", who: "Direction", text: "Vu." }] },
    { day: "2026-11-06", items: [{ time: "09:30", kind: "file", filter: "files", what: "a déposé un fichier", who: "Direction", file: { name: "cdc.pdf", size: "471 Ko" } }] },
    { day: "2026-10-02", items: [{ time: null, kind: "decision", filter: "decisions", what: "a changé l'étape", who: "Direction", detail: "Non commencé → Cahier des charges envoyé" }] },
    { day: "2026-09-14", items: [{ time: "08:00", kind: "first", filter: "decisions", what: "Opti'Lex", who: null, detail: "Pas encore automatisée" }] },
  ];
  const entries = [{ id: 2, key: "o:2", kind: "update", target_key: null, body: "Recette faite.", author_name: "Alice", created_at: "2026-11-12T09:15:00+00:00", mine: true, files: [] },
    { id: 3, key: "o:3", kind: "comment", target_key: "s:3", body: "On vise fin novembre.", author_name: "Alice", created_at: "2026-11-12T09:20:00+00:00", mine: true, files: [] }];
  const path = journey({ step: 2, validated: null }, steps, history, entries);
  assert.deepEqual(path.map((m) => [m.kind, m.state, m.label]), [
    ["created", "done", "Entrée dans le suivi"], ["step", "done", "Cahier des charges envoyé"], ["step", "now", "V1 réalisée, non testée"],
    ["step", "next", "V1 testée et approuvée"], ["validated", "next", "Validation par la direction du cabinet"]]);
  assert.deepEqual(path.map((m) => m.event?.day || null), ["2026-09-14", "2026-10-02", "2026-11-10", null, null]);
  assert.equal(path[2].key, eventKey("2026-11-10", history[0].items[0]));
  assert.deepEqual([path[3].key, path[4].key], ["s:3", "s:9"]);
  assert.deepEqual(path[1].items.map((item) => item.what), ["a déposé un fichier"]);            // déposé pendant l'étape « cahier des charges »
  assert.deepEqual(path[2].items.map((item) => [item.key, item.source]), [["o:2", "owner"]]);   // le point d'Owner, sous l'étape en cours
  assert.equal(eventSentence(path[2].event), "Direction a changé l'étape");
  const fresh = journey({ step: 0, validated: null }, steps, [], []);
  assert.deepEqual(fresh.map((m) => [m.state, m.key]), [["now", "s:0"], ["next", "s:1"], ["next", "s:2"], ["next", "s:3"], ["next", "s:9"]]);
  const done = journey({ step: 3, validated: { by: "Direction", at: "12/11/2026 à 10:00" } }, steps, [{ day: "2026-11-12", items: [{ time: "10:00", kind: "validated", filter: "decisions", what: "a validé le process", who: "Direction" }] }], []);
  assert.deepEqual([done.at(-1).state, done.at(-1).by, done[3].state, done[1].event], ["done", "Direction", "now", null]);
});

test("ce que le cabinet pose dans Opti'Lex : l'étape atteinte vient du logiciel, le commentaire dit l'étape qu'il vise", async () => {
  const { journey, missionComments } = await import("./automationBoard.js");
  const steps = [{ value: 0, label: "Non commencé" }, { value: 1, label: "Cahier des charges envoyé" }, { value: 2, label: "V1 réalisée, non testée" }];
  const history = [{ day: "2026-11-10", items: [
    { time: "16:00", filter: "comments", kind: "comment", what: "a commenté", who: "Direction", text: "À revoir avant la V1.", target: 1, step: null },
    // Le libellé de l'étape a changé depuis : sans `step`, « avant → après » ne dirait plus rien.
    { time: "11:05", filter: "decisions", kind: "decision", what: "a changé l'étape", who: "Direction", detail: "Ancien nom → Autre ancien nom", step: 2 },
    { time: "09:00", filter: "files", kind: "file", what: "a déposé un fichier", who: "Direction", file: { name: "Cahier.pdf", size: "471 Ko", removed: false, id: "a".repeat(32) } },
  ] }];
  const path = journey({ step: 2 }, steps, history, []);
  assert.equal(path[2].state, "now");
  assert.equal(path[2].event?.who, "Direction");
  assert.equal(path.flatMap((milestone) => milestone.items).find((item) => item.file)?.file.id, "a".repeat(32));
  assert.deepEqual(missionComments(history, []).map((item) => [item.text, item.target]), [["À revoir avant la V1.", 1]]);
});
