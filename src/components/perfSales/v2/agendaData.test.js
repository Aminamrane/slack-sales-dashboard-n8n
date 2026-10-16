import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaPeople, agendaRows } from './agendaData.js';

const r1 = [{ lead_id: 1, sales: 'Léo', date: '2026-10-01T10:00:00', status: 'Effectué', source: 'affectation' }];
const r2 = [{ lead_id: 1, sales: 'Léo', date: '2026-10-05T10:00:00', status: 'À venir', source: 'affectation' },
  { lead_id: 2, sales: 'Léo', date: '2026-10-02T14:00:00', status: 'Absent', source: 'pool' },
  { lead_id: 3, sales: 'Yanis', date: '2026-10-03T09:30:00', status: 'Effectué', source: 'affectation' }];
const phone = [{ lead_id: 2, sales: 'Léo', date: '2026-10-02T14:00:00' }, { lead_id: 3, sales: 'Yanis', date: '2026-10-03T09:30:00' }];

test('un R2 sans R1 est un R2 direct, les autres sont des R2 après un R1', () => {
  const rows = agendaRows(r1, r2, phone);
  assert.deepEqual(rows.map((r) => [r.lead_id, r.kind]), [[1, 'r1'], [2, 'direct'], [3, 'direct'], [1, 'r2']]);
  assert.deepEqual(agendaRows(r1, r2, phone, 'pool').map((r) => r.lead_id), [2]);
});

test('par sales, les R1 comptés incluent les R1 au téléphone et la somme retombe sur les listes', () => {
  const people = agendaPeople(agendaRows(r1, r2, phone));
  assert.deepEqual(people.map((p) => [p.name, p.r1 + p.direct, p.r2 + p.direct, p.direct, p.done, p.noshow]),
    [['Léo', 2, 2, 1, 1, 1], ['Yanis', 1, 1, 1, 1, 0]]);
  const sum = people.reduce((a, p) => ({ r1: a.r1 + p.r1, r2: a.r2 + p.r2 + p.direct, tel: a.tel + p.direct }), { r1: 0, r2: 0, tel: 0 });
  assert.deepEqual(sum, { r1: r1.length, r2: r2.length, tel: phone.length });
});
