import test from 'node:test';
import assert from 'node:assert/strict';

import { canReadCalls, changeWords, headcountText, revenueText, compareWord, comparisonFor, dayLabel, delta, groupChannels, heights, presetRange, signed, signedEur, spanDays } from './model.js';

const TODAY = '2026-11-18'; // un mercredi

test('les présélections et leur période de comparaison', () => {
  assert.deepEqual(presetRange('today', TODAY), { from: TODAY, to: TODAY });
  assert.deepEqual(comparisonFor('today', presetRange('today', TODAY)), { from: '2026-11-17', to: '2026-11-17' });
  assert.deepEqual(presetRange('yesterday', TODAY), { from: '2026-11-17', to: '2026-11-17' });
  const week = presetRange('this-week', TODAY);
  assert.deepEqual(week, { from: '2026-11-16', to: TODAY });
  assert.deepEqual(comparisonFor('this-week', week), { from: '2026-11-09', to: '2026-11-11' });
  const month = presetRange('this-month', TODAY);
  assert.deepEqual(comparisonFor('this-month', month), { from: '2026-10-01', to: '2026-10-18' });
  assert.deepEqual(comparisonFor('this-month', { from: '2026-03-01', to: '2026-03-31' }), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(comparisonFor('custom', { from: '2026-11-10', to: '2026-11-14' }), { from: '2026-11-05', to: '2026-11-09' });
  assert.equal(spanDays({ from: '2026-10-30', to: '2026-11-02' }), 4);
});

test('écarts, signes et hauteurs', () => {
  assert.deepEqual(delta(12, 8), { diff: 4, rate: 0.5, tone: 'up' });
  assert.deepEqual(delta(3, 0), { diff: 3, rate: null, tone: 'up' });
  assert.equal(delta(5, null), null);
  assert.equal(delta(2, 2).tone, 'flat');
  assert.equal(signed(4), '+4');
  assert.equal(signed(-3), '−3');
  assert.deepEqual(heights([0, 5, 10]), [0, 0.5, 1]);
  assert.deepEqual(heights([0, 0]), [0, 0]);
});

test('canaux par famille et limite des appels', () => {
  const groups = groupChannels(
    [{ key: 'meta_ads', group: 'ads', total: 4 }, { key: 'google_ads', group: 'ads', total: 1 }, { key: 'ccs', group: 'prospection', total: 2 }],
    [{ key: 'ads', label: 'Publicité' }, { key: 'webinar', label: 'Webinaire' }, { key: 'prospection', label: 'Prospection' }],
  );
  assert.deepEqual(groups.map((g) => [g.key, g.total, g.channels.length]), [['ads', 5, 2], ['webinar', 0, 0], ['prospection', 2, 1]]);
  assert.equal(groups[0].channels[0].share, 4 / 7);
  assert.equal(groups[0].channels[0].color, '#8fbdf3');
  assert.equal(canReadCalls({ from: '2026-10-19', to: TODAY }), true);
  assert.equal(canReadCalls({ from: '2026-10-01', to: TODAY }), false);
});

test('comparaison en mots, étiquettes des jours, écarts en euros', () => {
  assert.equal(compareWord('custom', { from: TODAY, to: TODAY }), 'la veille');
  assert.equal(compareWord('custom', { from: '2026-11-10', to: TODAY }), 'la période précédente');
  assert.equal(compareWord('today', { from: TODAY, to: TODAY }), 'hier');
  assert.equal(dayLabel(TODAY, 0, 14), 'mer. 18');
  assert.equal(dayLabel(TODAY, 0, 14, true), '18');
  assert.equal(dayLabel(TODAY, 1, 31), '');
  assert.equal(delta(52.94, 43.08).diff, 9.86);
  assert.equal(signedEur(9.86), '+9,86 €');
  assert.equal(signedEur(-5.4), '−5,40 €');
});

test('les écarts se disent en mots', () => {
  assert.equal(changeWords(7, 'hier'), "7 de plus qu'hier");
  assert.equal(changeWords(-1, 'hier'), "1 de moins qu'hier");
  assert.equal(changeWords(-50, 'la semaine précédente'), '50 de moins que la semaine précédente');
  assert.equal(changeWords(-23.33, 'hier', true), "23,33 € de moins qu'hier");
  assert.equal(changeWords(0, 'la veille'), 'autant que la veille');
});

test('effectif et CA des formulaires, en français', () => {
  assert.equal(headcountText('1_-_2'), '1 à 2 salariés');
  assert.equal(headcountText('11_-_19'), '11 à 19 salariés');
  assert.equal(headcountText('3'), '3 salariés');
  assert.equal(headcountText('1'), '1 salarié');
  assert.equal(headcountText(''), null);
  assert.equal(revenueText('entre_100_000_et_500_000€'), 'CA entre 100 000 et 500 000 €');
  assert.equal(revenueText('moins_de_100_000_€'), 'CA moins de 100 000 €');
  assert.equal(revenueText('856556'), 'CA 856\u202f556 €');
  assert.equal(revenueText(null), null);
});
