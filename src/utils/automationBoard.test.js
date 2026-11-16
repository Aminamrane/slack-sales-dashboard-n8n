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

// ── À qui de jouer (13/11/2026) ───────────────────────────────────────────────────────────────────────
const STEPS = [
  { value: 0, label: 'Non commencé' }, { value: 1, label: 'Cahier des charges envoyé' }, { value: 2, label: 'V1 réalisée, non testée' },
  { value: 3, label: 'V1 testée et approuvée' }, { value: 4, label: 'Version maximale optimisée' },
];

test("à qui de jouer : avant toute version, c'est aux développeurs, et leur geste est « version livrée »", async () => {
  const { turnOf } = await import('./automationBoard.js');
  const start = turnOf({ step: 0, awaiting: null }, STEPS);
  assert.equal(start.who, 'build');
  assert.deepEqual(start.actions.map((a) => [a.key, a.label, Boolean(a.primary)]), [['deliver', 'Version livrée, à tester', true], ['step-1', 'Cahier des charges envoyé', false], ['start', 'On y travaille', false]]);
  assert.equal(start.actions[1].step, 1);
  // Cahier des charges déjà envoyé : il ne reste que la livraison.
  assert.deepEqual(turnOf({ step: 1 }, STEPS).actions.map((a) => a.key), ['deliver', 'start']);
});

test('à qui de jouer : une version livrée attend le juriste, qui valide ou demande une modification', async () => {
  const { turnOf } = await import('./automationBoard.js');
  const waiting = turnOf({ step: 2, awaiting: { who: 'lawyer', by: 'Personne Owner', since: '13/11/2026 à 10:12', text: 'Le modèle est en place.' } }, STEPS);
  assert.equal(waiting.who, 'lawyer');
  assert.equal(waiting.tag, 'À tester par le juriste');
  assert.equal(waiting.quote, 'Le modèle est en place.');
  assert.match(waiting.hint, /^Livrée par Personne Owner le 13\/11\/2026\. /);
  assert.deepEqual(waiting.actions.map((a) => [a.action, Boolean(a.primary), Boolean(a.needsNote)]), [['approve', true, false], ['request_change', false, true]]);
});

test('à qui de jouer : une modification demandée attend les développeurs, avec le message du juriste', async () => {
  const { turnOf } = await import('./automationBoard.js');
  const asked = turnOf({ step: 2, awaiting: { who: 'dev', by: 'Juriste Exemple', since: null, text: 'Il manque la période d’essai.' } }, STEPS);
  assert.equal(asked.who, 'dev');
  assert.equal(asked.title, 'Aux développeurs de jouer : une modification est demandée');
  assert.equal(asked.quote, 'Il manque la période d’essai.');
  assert.deepEqual(asked.actions.map((a) => [a.action, a.label]), [['deliver', 'Version corrigée, à retester'], ['request_change', 'Compléter la demande'], ['start', 'On y travaille']]);
});

test("à qui de jouer : une version validée n'attend personne ; on peut demander une évolution ou passer à la version maximale", async () => {
  const { turnOf } = await import('./automationBoard.js');
  const approved = turnOf({ step: 3, awaiting: null }, STEPS);
  assert.equal(approved.who, 'done');
  assert.deepEqual(approved.actions.map((a) => a.key), ['request_change', 'step-4', 'start']);
  assert.equal(approved.actions[1].label, 'Passer à « Version maximale optimisée »');
  // Dernière étape, ou process validé par la direction : plus de changement d'étape proposé.
  assert.deepEqual(turnOf({ step: 4 }, STEPS).actions.map((a) => a.key), ['request_change', 'start']);
  assert.deepEqual(turnOf({ step: 3 }, STEPS, true).actions.map((a) => a.key), ['request_change', 'start']);
  assert.deepEqual(turnOf({ step: 0 }, STEPS, true).actions.map((a) => a.key), ['deliver', 'start']);
  // Une version existe sans être attendue (« non utilisée ») : livrer une nouvelle version ou demander une modification.
  const idle = turnOf({ step: 2, awaiting: null }, STEPS);
  assert.deepEqual([idle.who, ...idle.actions.map((a) => a.action)], ['idle', 'deliver', 'request_change', 'start']);
  // Une valeur inconnue venue d'Opti'Lex ne casse rien : l'étape parle.
  assert.equal(turnOf({ step: 1, awaiting: { who: 'autre' } }, STEPS).who, 'build');
});

test('la liste se filtre sur « à qui de jouer », en gardant le process au-dessus de sa mission', () => {
  const rows = [
    { id: 1, name: 'Process REM', parentId: null, awaiting: null },
    { id: 2, name: 'Note de rémunération', parentId: 1, awaiting: { who: 'lawyer' } },
    { id: 3, name: 'Promesse d’embauche', parentId: null, awaiting: { who: 'dev' } },
    { id: 4, name: 'Question juridique', parentId: null, awaiting: null },
  ];
  assert.deepEqual(ids(visibleRows(rows, { awaiting: 'lawyer' })), [1, 2]);
  assert.deepEqual(ids(visibleRows(rows, { awaiting: 'dev' })), [3]);
  assert.deepEqual(ids(visibleRows(rows, {})), [1, 2, 3, 4]);
});

test("le parcours : un geste du suivi date l'étape qu'il fait atteindre", async () => {
  const { journey } = await import('./automationBoard.js');
  const history = [{ day: '2026-11-13', items: [
    { time: '10:40', filter: 'decisions', kind: 'approved', what: 'a validé la version', who: 'Juriste Exemple', detail: 'V1 réalisée, non testée → V1 testée et approuvée', step: 3, target: null },
    { time: '10:20', filter: 'decisions', kind: 'change-request', what: 'a demandé une modification', who: 'Juriste Exemple', text: 'Il manque la période d’essai.', step: null, target: null },
    { time: '10:05', filter: 'decisions', kind: 'delivery', what: 'a livré une version à tester', who: 'Personne Owner', detail: 'Non commencé → V1 réalisée, non testée', step: 2, target: null },
  ] }];
  const milestones = journey({ step: 3 }, STEPS, history, []);
  const byStep = Object.fromEntries(milestones.filter((m) => m.kind === 'step').map((m) => [m.step, m]));
  assert.deepEqual([byStep[2].state, byStep[2].event.kind, byStep[2].event.who], ['done', 'delivery', 'Personne Owner']);
  assert.deepEqual([byStep[3].state, byStep[3].event.kind], ['now', 'approved']);
  // La demande de modification ne date aucune étape : elle se range sous celle qui était en cours.
  assert.deepEqual(byStep[2].items.map((item) => item.kind), ['change-request']);
});

test("une erreur du serveur se lit, même quand il renvoie une liste", async () => {
  const { errorText } = await import('./automationBoard.js');
  assert.equal(errorText({ message: 'Ce process est validé par la direction.' }, 'x'), 'Ce process est validé par la direction.');
  assert.equal(errorText({ message: '[object Object]', data: { detail: [{ msg: 'Input should be less than or equal to 4' }] } }, 'x'), 'Input should be less than or equal to 4');
  assert.equal(errorText({ message: '[object Object]', data: { detail: [] } }, 'Le geste n’a pas été enregistré.'), 'Le geste n’a pas été enregistré.');
  assert.equal(errorText(null, 'Indisponible.'), 'Indisponible.');
});

// ── Suivi des développeurs (13/11/2026) ──
test("le tableau de suivi range chaque mission dans une seule colonne, « en cours » l'emporte", async () => {
  const { devBoard } = await import("./automationBoard.js");
  const rows = [
    { id: 1, name: "Promesses d'embauche", pole: { label: "Social" }, awaiting: null, working: { since: "12/11/2026 à 09:10", by: "Dev Un", text: "Reste la période d'essai.", updatedAt: "13/11/2026 à 10:00", updatedBy: "Dev Deux" } },
    { id: 2, name: "PV d'assemblée", awaiting: { who: "dev", since: "11/11/2026 à 15:00", by: "Juriste", text: "Le quorum manque." }, working: null },
    { id: 3, name: "TVA", awaiting: { who: "lawyer", since: "10/11/2026 à 08:00", by: "Dev Un", text: "À tester." }, working: null },
    { id: 4, name: "Bulletins", awaiting: { who: "dev", since: "09/11/2026 à 08:00", by: "Juriste", text: "Net à payer faux." }, working: { since: "13/11/2026 à 08:00", by: "Dev Un", text: null, updatedAt: "13/11/2026 à 08:00", updatedBy: "Dev Un" } },
    { id: 5, name: "Courrier", awaiting: null, working: null },
  ];
  const [working, lawyer, dev] = devBoard(rows);
  assert.deepEqual([working.items.map((item) => item.id), lawyer.items.map((item) => item.id), dev.items.map((item) => item.id)], [[1, 4], [3], [2]]);
  assert.equal(working.items[0].meta, "Depuis le 12/11/2026 · Dev Un · dernier point le 13/11/2026");
  assert.equal(working.items[0].text, "Reste la période d'essai.");
  assert.deepEqual(working.items[0].actions.map((gesture) => gesture.action), ["deliver", "progress", "pause"]);
  assert.equal(working.items[0].actions[0].label, "Version livrée, à tester");
  // Une modification demandée que les développeurs ont reprise : la livraison s'appelle « corrigée ».
  assert.equal(working.items[1].actions[0].label, "Version corrigée, à retester");
  assert.equal(working.items[1].meta, "Depuis le 13/11/2026 · Dev Un · modification demandée");
  assert.equal(working.items[1].text, "Net à payer faux.", "le mot du juriste reste tant que les développeurs n'ont pas donné de nouvelles");
  assert.deepEqual(dev.items[0].actions.map((gesture) => gesture.action), ["start", "deliver"]);
  assert.deepEqual(lawyer.items[0].actions, [], "pendant le test du juriste, rien à faire côté développeurs");
  assert.deepEqual(devBoard(null).map((group) => group.items.length), [0, 0, 0]);
});

test("on ajoute une mission en cours en tapant son nom ; celles déjà en cours ou validées ne sont pas proposées", async () => {
  const { startable } = await import("./automationBoard.js");
  const rows = [{ id: 1, name: "Rémunération du dirigeant", working: null }, { id: 2, name: "Rémunération variable", working: { since: "x" } },
    { id: 3, name: "Remuneration des apprentis", working: null, validated: { at: "x" } }, { id: 4, name: "TVA", working: null }];
  assert.deepEqual(startable(rows, "remun").map((row) => row.id), [1]);
  assert.deepEqual(startable(rows, "  "), []);
  assert.deepEqual(startable(rows, "tva").map((row) => row.id), [4]);
});

test("la fiche d'une mission propose « On y travaille », puis le point d'avancement et la mise de côté", async () => {
  const { turnOf } = await import("./automationBoard.js");
  const steps = [0, 1, 2, 3, 4].map((value) => ({ value, label: `Étape ${value}` }));
  const idle = turnOf({ step: 0, awaiting: null, working: null }, steps);
  assert.equal(idle.working, null);
  assert.ok(idle.actions.some((gesture) => gesture.action === "start"));
  const busy = turnOf({ step: 0, awaiting: null, working: { since: "13/11/2026", by: "Dev", text: "En route.", updatedAt: "13/11/2026", updatedBy: "Dev" } }, steps);
  assert.deepEqual(busy.actions.filter((gesture) => ["start", "progress", "pause"].includes(gesture.action)).map((gesture) => gesture.action), ["progress", "pause"]);
  assert.ok(busy.actions.find((gesture) => gesture.action === "progress").needsNote);
  assert.match(busy.placeholder, /point d’avancement/);
  // Pendant que le juriste teste, il n'y a rien à commencer.
  const tested = turnOf({ step: 2, awaiting: { who: "lawyer" }, working: null }, steps);
  assert.ok(!tested.actions.some((gesture) => gesture.action === "start"));
});
