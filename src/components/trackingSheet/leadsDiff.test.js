import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepUnchangedLeads, sameLead } from './leadsDiff.js';

const lead = (id, extra = {}) => ({ id, full_name: `Lead ${id}`, status: 'new', notes: null, tags: ['a'], ...extra });

test('une liste identique : nouvelle liste, mêmes objets de fiche', () => {
  const previous = [lead(1), lead(2)];
  const next = keepUnchangedLeads(previous, [lead(1), lead(2)]);
  assert.notEqual(next, previous);          // les effets de la sheet comptent sur une nouvelle liste à chaque rafraîchissement
  assert.equal(next[0], previous[0]);
  assert.equal(next[1], previous[1]);
});

test('seule la fiche modifiée change d’objet', () => {
  const previous = [lead(1), lead(2), lead(3)];
  const next = keepUnchangedLeads(previous, [lead(1), lead(2, { status: 'r1' }), lead(3)]);
  assert.notEqual(next, previous);
  assert.equal(next[0], previous[0]);
  assert.notEqual(next[1], previous[1]);
  assert.equal(next[1].status, 'r1');
  assert.equal(next[2], previous[2]);
});

test('le contenu rendu est toujours celui du serveur', () => {
  const previous = [lead(1, { notes: 'saisie locale' }), lead(2), lead(4)];
  const server = [lead(3), lead(1), lead(2, { tags: ['a', 'b'] })];
  assert.deepEqual(keepUnchangedLeads(previous, server), server);
});

test('une fiche ajoutée, retirée ou déplacée donne une nouvelle liste', () => {
  const previous = [lead(1), lead(2)];
  assert.notEqual(keepUnchangedLeads(previous, [lead(1), lead(2), lead(3)]), previous);
  assert.notEqual(keepUnchangedLeads(previous, [lead(1)]), previous);
  const swapped = keepUnchangedLeads(previous, [lead(2), lead(1)]);
  assert.notEqual(swapped, previous);
  assert.equal(swapped[0], previous[1]);
});

test('première charge : la liste du serveur', () => {
  const server = [lead(1)];
  assert.equal(keepUnchangedLeads([], server), server);
  assert.equal(keepUnchangedLeads(undefined, server), server);
});

test('sameLead : champ en plus, en moins, valeur objet', () => {
  assert.equal(sameLead(lead(1), lead(1)), true);
  assert.equal(sameLead(lead(1), lead(1, { siren: null })), false);
  assert.equal(sameLead({ id: 1, a: undefined }, { id: 1, b: undefined }), false);
  assert.equal(sameLead(lead(1, { transfer: { by: 'x', until: '2026-11-15' } }), lead(1, { transfer: { by: 'x', until: '2026-11-15' } })), true);
  assert.equal(sameLead(lead(1, { transfer: { by: 'x' } }), lead(1, { transfer: null })), false);
});
