// setterPilotage.test.js : les règles de l'onglet « Pilotage setting ».
//
// Demande dev 01/10/2026 : périodes Jour / Mois en cours / Mois dernier / plage de 31 jours au plus
// en heure de Paris, colonne R2 masquée si vide, saisie du manager (discours, blocage, action)
// fusionnée sans recharger la page et sans perdre un texte tapé pendant l'envoi.
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parisToday, isIsoDay, shiftDay, daysInclusive, lastMonthRange, customRangeError, resolvePeriod,
  fmtDayShort, fmtDayLong, fmtPeriod, fmtTalk, fmtAverage, fmtScore, fmtSavedAt, reviewTooltip,
  columnsFor, shouldShowR2, sortSetters, newestFirst, teamTotals, topBlocage, notedDays, discoursAverage,
  normalizeReview, effectiveReview, sameReview, reviewPayload, pruneDraft, mergeSuggestions,
  mergeSavedReview, blocageChoices, MAX_RANGE_DAYS,
} from './setterPilotage.js';

/* ── Périodes ── */

test("aujourd'hui à Paris : 23 h 30 UTC le 30/09 est déjà le 01/10", () => {
  assert.equal(parisToday(new Date('2026-09-30T22:30:00Z')), '2026-10-01');
  assert.equal(parisToday(new Date('2026-09-30T21:59:00Z')), '2026-09-30');
  // Hiver (UTC+1)
  assert.equal(parisToday(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
});

test('jours : validité, décalage, nombre de jours bornes comprises', () => {
  assert.equal(isIsoDay('2026-02-29'), false);
  assert.equal(isIsoDay('2028-02-29'), true);
  assert.equal(isIsoDay('2026-10-1'), false);
  assert.equal(shiftDay('2026-10-01', -1), '2026-09-30');
  assert.equal(shiftDay('2026-03-28', 1), '2026-03-29');
  assert.equal(shiftDay('2026-03-29', 1), '2026-03-30'); // passage à l'heure d'été sans effet
  assert.equal(daysInclusive('2026-10-01', '2026-10-01'), 1);
  assert.equal(daysInclusive('2026-10-01', '2026-10-31'), 31);
});

test('mois dernier : bornes exactes, y compris février et janvier', () => {
  assert.deepEqual(lastMonthRange('2026-10-01'), { start: '2026-09-01', end: '2026-09-30' });
  assert.deepEqual(lastMonthRange('2026-03-15'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(lastMonthRange('2028-03-31'), { start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(lastMonthRange('2027-01-05'), { start: '2026-12-01', end: '2026-12-31' });
});

test('mois dernier tient toujours dans la limite de 31 jours', () => {
  for (const t of ['2026-02-10', '2026-08-01', '2027-01-01']) {
    const r = lastMonthRange(t);
    assert.ok(daysInclusive(r.start, r.end) <= MAX_RANGE_DAYS);
  }
});

test('resolvePeriod : jour, mois en cours, mois dernier, plage', () => {
  const today = '2026-10-15';
  assert.deepEqual(resolvePeriod({ mode: 'day', day: '2026-10-03' }, today), { start: '2026-10-03', end: '2026-10-03', error: '' });
  // Jour futur ou vide : ramené à aujourd'hui.
  assert.deepEqual(resolvePeriod({ mode: 'day', day: '2026-10-20' }, today), { start: today, end: today, error: '' });
  assert.deepEqual(resolvePeriod({ mode: 'day', day: '' }, today), { start: today, end: today, error: '' });
  assert.deepEqual(resolvePeriod({ mode: 'month' }, today), { start: '2026-10-01', end: today, error: '' });
  assert.deepEqual(resolvePeriod({ mode: 'last_month' }, today), { start: '2026-09-01', end: '2026-09-30', error: '' });
  assert.deepEqual(resolvePeriod({ mode: 'custom', from: '2026-09-20', to: '2026-10-05' }, today),
    { start: '2026-09-20', end: '2026-10-05', error: '' });
});

test('plage personnalisée : 31 jours passent, 32 sont refusés (comme l API)', () => {
  const today = '2026-12-31';
  assert.equal(customRangeError('2026-10-01', '2026-10-31', today), '');
  assert.equal(customRangeError('2026-10-01', '2026-11-01', today), 'Période limitée à 31 jours.');
  assert.equal(customRangeError('2026-10-05', '2026-10-01', today), 'La date de début doit précéder la date de fin.');
  assert.equal(customRangeError('', '2026-10-01', today), 'Choisissez une date de début et une date de fin.');
  assert.equal(customRangeError('2026-12-30', '2027-01-02', today), "La période ne peut pas dépasser aujourd'hui.");
  assert.equal(customRangeError('2026-02-30', '2026-03-02', today), 'Date invalide.');
});

/* ── Formats ── */

test('libellés de jour lus sur la chaîne, sans fuseau', () => {
  assert.equal(fmtDayShort('2026-09-28'), 'Lun. 28 sept.');
  assert.equal(fmtDayShort('2026-10-04'), 'Dim. 4 oct.');
  assert.equal(fmtDayLong('2026-10-01'), 'Jeudi 1 octobre 2026');
  assert.equal(fmtPeriod('2026-10-01', '2026-10-01'), 'Jeudi 1 octobre 2026');
  assert.equal(fmtPeriod('2026-09-01', '2026-09-30'), 'Du 1 sept. au 30 sept. 2026');
  assert.equal(fmtPeriod('2026-12-20', '2027-01-05'), 'Du 20 déc. 2026 au 5 janv. 2027');
});

test('durées : temps au téléphone et durée moyenne', () => {
  assert.equal(fmtTalk(null), '–');
  assert.equal(fmtTalk(0), '0 min');
  assert.equal(fmtTalk(36732), '10 h 12');
  assert.equal(fmtTalk(1500), '25 min');
  // Minute arrondie avant de compter les heures : jamais « 60 min » ni « 1 h 60 ».
  assert.equal(fmtTalk(3599), '1 h 00');
  assert.equal(fmtTalk(7199), '2 h 00');
  assert.equal(fmtTalk(3569), '59 min');
  assert.equal(fmtAverage(null, 3), '–');
  assert.equal(fmtAverage(120, 0), '–');
  assert.equal(fmtAverage(90, 2), '45 s');
  assert.equal(fmtAverage(36732, 605), '1 min 01');
});

test('note de discours : moyenne à une décimale, virgule française', () => {
  assert.equal(fmtScore(null), '–');
  assert.equal(fmtScore(3.5), '3,5');
  assert.equal(fmtScore(4), '4');
  assert.equal(fmtScore(10 / 3), '3,3');
});

test("date d'enregistrement : instant serveur affiché à l'heure de Paris", () => {
  assert.equal(fmtSavedAt('2026-10-01T12:05:00+00:00'), '1 oct. 2026 à 14 h 05');
  assert.equal(fmtSavedAt('2026-12-01T23:30:00Z'), '2 déc. 2026 à 00 h 30');
  assert.equal(fmtSavedAt(null), '');
  assert.equal(reviewTooltip({ updated_at: '2026-10-01T12:05:00Z', updated_by_name: 'Jonathan Mangono' }),
    'Saisi par Jonathan Mangono, le 1 oct. 2026 à 14 h 05');
  assert.equal(reviewTooltip(null), '');
});

/* ── Tableau ── */

test("ordre des colonnes de la feuille, R2 seulement s'il y en a", () => {
  assert.deepEqual(columnsFor(false), ['calls', 'answered', 'r1', 'held', 'no_show', 'duration', 'average', 'discours', 'blocage', 'action']);
  assert.deepEqual(columnsFor(true), ['calls', 'answered', 'r1', 'held', 'no_show', 'r2', 'duration', 'average', 'discours', 'blocage', 'action']);
});

test("show_r2 : la valeur de l'API fait foi, recalcul si elle manque", () => {
  assert.equal(shouldShowR2({ show_r2: false, setters: [{ totals: { r2: 3 } }] }), false);
  assert.equal(shouldShowR2({ show_r2: true, setters: [] }), true);
  assert.equal(shouldShowR2({ setters: [{ totals: { r2: 0 }, days: [{ r2: 0 }] }] }), false);
  assert.equal(shouldShowR2({ setters: [{ totals: { r2: 0 }, days: [{ r2: 1 }] }] }), true);
  assert.equal(shouldShowR2(null), false);
});

test("setters : actifs d'abord, ordre de l'API conservé ; jours du plus récent au plus ancien", () => {
  const list = [{ name: 'Alain', active: false }, { name: 'Aurélie', active: true }, { name: 'Jonathan', active: true }];
  assert.deepEqual(sortSetters(list).map((s) => s.name), ['Aurélie', 'Jonathan', 'Alain']);
  assert.deepEqual(newestFirst([{ day: '2026-09-01' }, { day: '2026-09-03' }, { day: '2026-09-02' }]).map((d) => d.day),
    ['2026-09-03', '2026-09-02', '2026-09-01']);
});

test("totaux d'équipe : les appels ne comptent que les setters reliés à Allo", () => {
  const t = teamTotals([
    { allo: 'linked', totals: { calls: 10, answered: 4, duration: 600, r1: 2, r2: 1, held: 1, no_show: 1, to_qualify: 0 } },
    { allo: 'missing', totals: { calls: null, answered: null, duration: null, r1: 1, r2: 0, held: 0, no_show: 0, to_qualify: 1 } },
  ]);
  assert.deepEqual(t, { calls: 10, answered: 4, duration: 600, r1: 3, r2: 1, held: 1, no_show: 1, to_qualify: 1 });
  assert.equal(teamTotals([{ allo: 'error', totals: { r1: 1 } }]).calls, null);
});

test('blocage principal de la période : le plus cité, à égalité le plus récent', () => {
  const days = [
    { day: '2026-09-01', review: { blocage: 'Objection prix' } },
    { day: '2026-09-02', review: { blocage: 'objection prix ' } },
    { day: '2026-09-03', review: { blocage: 'Pas de décisionnaire' } },
    { day: '2026-09-04', review: null },
  ];
  assert.deepEqual(topBlocage(days), { label: 'objection prix', count: 2 });
  assert.deepEqual(topBlocage(days.slice(2)), { label: 'Pas de décisionnaire', count: 1 });
  assert.equal(topBlocage([]), null);
  assert.equal(notedDays(days), 3);
  assert.equal(notedDays([{ review: { discours: null, blocage: null, action: null } }]), 0);
});

test('moyenne du discours : seules les notes saisies comptent', () => {
  assert.equal(discoursAverage([{ review: { discours: 3 } }, { review: { discours: 4 } }, { review: null }, { review: { discours: null } }]), 3.5);
  assert.equal(discoursAverage([{ review: null }]), null);
});

/* ── Saisie ── */

test('normalisation : vide = null, texte rogné, note entière de 1 à 5', () => {
  assert.deepEqual(normalizeReview({ discours: '4', blocage: '  Prix ', action: '' }), { discours: 4, blocage: 'Prix', action: null });
  assert.deepEqual(normalizeReview({ discours: '', blocage: '   ', action: null }), { discours: null, blocage: null, action: null });
  assert.deepEqual(normalizeReview({ discours: 7 }), { discours: null, blocage: null, action: null });
  assert.deepEqual(reviewPayload('u1', '2026-10-01', { discours: 2, blocage: 'x', action: ' y ' }),
    { setter_id: 'u1', day: '2026-10-01', discours: 2, blocage: 'x', action: 'y' });
});

test("envoi : seuls les champs modifiés partent, la saisie d'un autre éditeur n'est pas écrasée", () => {
  const known = { discours: null, blocage: 'Prix', action: null };
  // Seule la note change : l'action (peut-être saisie ailleurs depuis) ne part pas.
  assert.deepEqual(reviewPayload('u1', '2026-10-01', effectiveReview(known, { discours: '4' }), known),
    { setter_id: 'u1', day: '2026-10-01', discours: 4 });
  // Effacer une cellule envoie null pour ce seul champ.
  assert.deepEqual(reviewPayload('u1', '2026-10-01', effectiveReview(known, { blocage: '  ' }), known),
    { setter_id: 'u1', day: '2026-10-01', blocage: null });
  // Pas de ligne enregistrée : seuls les champs renseignés partent.
  assert.deepEqual(reviewPayload('u1', '2026-10-01', effectiveReview(null, { action: ' Écoute ' }), null),
    { setter_id: 'u1', day: '2026-10-01', action: 'Écoute' });
});

test('la saisie en cours prime sur la valeur enregistrée ; comparaison sur les valeurs normalisées', () => {
  const server = { discours: 3, blocage: 'Prix', action: null };
  assert.deepEqual(effectiveReview(server, { action: 'Écoute' }), { discours: 3, blocage: 'Prix', action: 'Écoute' });
  assert.deepEqual(effectiveReview(null, null), { discours: null, blocage: '', action: '' });
  assert.equal(sameReview(server, { discours: '3', blocage: 'Prix ', action: '' }), true);
  assert.equal(sameReview(server, { discours: 3, blocage: 'Prix', action: 'x' }), false);
});

test("après l'enregistrement : la saisie identique disparaît, le texte tapé pendant l'envoi reste", () => {
  const saved = { discours: 4, blocage: 'Prix', action: null };
  assert.equal(pruneDraft({ discours: '4', blocage: 'Prix', action: '' }, saved), null);
  assert.deepEqual(pruneDraft({ blocage: 'Prix, puis', discours: 4 }, saved), { blocage: 'Prix, puis' });
  // Espace final hors du champ actif : la saisie rognée est celle enregistrée, elle disparaît.
  assert.equal(pruneDraft({ blocage: 'Prix ' }, saved), null);
  // Champ où le curseur se trouve : gardé tel quel pour ne pas déplacer le curseur, rien à renvoyer.
  assert.deepEqual(pruneDraft({ blocage: 'Prix ' }, saved, 'blocage'), { blocage: 'Prix ' });
  assert.equal(sameReview(effectiveReview(saved, { blocage: 'Prix ' }), saved), true);
  assert.equal(pruneDraft(null, saved), null);
});

test('suggestions de blocage : la nouvelle valeur en tête, sans doublon, 30 au plus', () => {
  assert.deepEqual(mergeSuggestions(['A', 'Prix', 'B'], ' prix '), ['prix', 'A', 'B']);
  assert.deepEqual(mergeSuggestions(['A'], null), ['A']);
  const many = Array.from({ length: 30 }, (_, i) => `S${i}`);
  const merged = mergeSuggestions(many, 'Nouveau');
  assert.equal(merged.length, 30);
  assert.equal(merged[0], 'Nouveau');
});

test('fusion du PUT : seul le jour du setter change, moyenne et suggestions suivent', () => {
  const data = {
    start: '2026-09-01', end: '2026-09-02', blocage_suggestions: ['A'],
    setters: [
      { id: 's1', totals: { r1: 1, discours_avg: 2 }, days: [
        { day: '2026-09-01', r1: 1, review: { discours: 2, blocage: null, action: null } },
        { day: '2026-09-02', r1: 0, review: null },
      ] },
      { id: 's2', totals: { r1: 0, discours_avg: null }, days: [{ day: '2026-09-01', review: null }, { day: '2026-09-02', review: null }] },
    ],
  };
  const saved = { setter_id: 's1', day: '2026-09-02', discours: 5, blocage: 'Prix', action: 'Jeu de rôle', updated_at: '2026-10-01T10:00:00Z', updated_by_name: 'Jonathan Mangono' };
  const next = mergeSavedReview(data, saved);
  assert.notEqual(next, data);
  assert.deepEqual(next.setters[0].days[1].review, { discours: 5, blocage: 'Prix', action: 'Jeu de rôle', updated_at: '2026-10-01T10:00:00Z', updated_by_name: 'Jonathan Mangono' });
  assert.equal(next.setters[0].days[1].r1, 0);
  assert.equal(next.setters[0].totals.discours_avg, 3.5);
  assert.equal(next.setters[0].totals.r1, 1);
  assert.equal(next.setters[1], data.setters[1]);
  assert.deepEqual(next.blocage_suggestions, ['Prix', 'A']);
  // L'état d'origine n'est pas modifié.
  assert.equal(data.setters[0].days[1].review, null);
  // Jour hors période ou setter inconnu : rien ne change.
  assert.equal(mergeSavedReview(data, { ...saved, day: '2026-09-10' }), data);
  assert.equal(mergeSavedReview(data, { ...saved, setter_id: 'zz' }), data);
});

test('blocage : texte libre avec suggestions, liste fermée si la constante est renseignée', () => {
  assert.deepEqual(blocageChoices(['A', 'B']), { mode: 'free', options: ['A', 'B'] });
  assert.deepEqual(blocageChoices(['A'], ['Prix', 'Timing']), { mode: 'fixed', options: ['Prix', 'Timing'] });
});
