import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { generateSavedNda } from './ndaGeneration.js';
import handler from '../../api/contract-preview.mjs';

const company = () => ({
  legalName: 'Société Démo', legalForm: 'SAS', siren: '', rcsCity: '', isInRegistration: true,
  headOffice: { line1: '10 rue Exemple', postalCode: '75001', city: 'Paris', country: 'France' },
  representatives: [{ fullName: 'Alex Exemple', firstName: 'Alex', lastName: 'Exemple', role: 'Président' }],
  email: 'alex@example.com', phone: '06 12 34 56 78',
});
function harness(save = async () => ({ success: true })) {
  const calls = [];
  const blob = new Blob(['%PDF-test'], { type: 'application/pdf' });
  return {
    calls, blob,
    apiClient: { post: async (url, body) => { calls.push({ kind: 'save', url, body }); return save(); } },
    fetchPdf: async (url, options) => { calls.push({ kind: 'pdf', url, body: JSON.parse(options.body) }); return { ok: true, blob: async () => blob }; },
  };
}

test('a company in formation is saved without SIREN or RCS before its NDA can be downloaded', async () => {
  const h = harness();
  const input = company();
  const original = structuredClone(input);
  assert.equal(await generateSavedNda({ company: input, leadId: 123, meta: { typeEntreprise: 'Général' }, ...h }), h.blob);
  assert.deepEqual(h.calls.map(c => c.kind), ['save', 'pdf']);
  const saved = h.calls[0].body;
  assert.equal(h.calls[0].url, '/api/v1/contracts/client-data');
  assert.equal(saved.lead_id, 123);
  assert.equal(saved.company.isInRegistration, true);
  assert.equal(saved.company.siren, '');
  assert.equal(saved.company.rcsCity, '');
  assert.equal(saved.company.email, input.email);
  assert.equal(saved.company.representatives[0].firstName, 'Alex');
  assert.match(saved.client_info_text, /en cours d'immatriculation/);
  assert.doesNotMatch(saved.client_info_text, /SIREN|RCS|undefined|Lille/);
  assert.deepEqual(h.calls[1].body.company, saved.company);
  assert.deepEqual(input, original);
});

for (const failure of ['network', 'unconfirmed']) {
  test(`${failure} save never generates a PDF and remains retryable`, async () => {
    let attempts = 0;
    const h = harness(async () => {
      if (++attempts === 1) {
        if (failure === 'network') throw new Error('Network unavailable');
        return { success: false };
      }
      return { success: true };
    });
    const input = company();
    const original = structuredClone(input);
    await assert.rejects(generateSavedNda({ company: input, leadId: 123, ...h }), /n’a pas pu être enregistré/);
    assert.deepEqual(h.calls.map(c => c.kind), ['save']);
    assert.deepEqual(input, original);
    assert.equal(await generateSavedNda({ company: input, leadId: 123, ...h }), h.blob);
    assert.deepEqual(h.calls.map(c => c.kind), ['save', 'save', 'pdf']);
  });
}

test('PDF failure reports saved data and lets the user retry', async () => {
  const h = harness();
  await assert.rejects(generateSavedNda({ company: company(), leadId: 123, ...h,
    fetchPdf: async () => ({ ok: false }),
  }), /informations sont enregistrées/);
  assert.equal(h.calls.length, 1);
});

test('registered company keeps its normalized SIREN and registry clause', async () => {
  const h = harness();
  await generateSavedNda({ company: { ...company(), isInRegistration: false, siren: '123 456 789', rcsCity: 'Paris' }, leadId: '123', ...h });
  assert.equal(h.calls[0].body.company.siren, '123456789');
  assert.match(h.calls[0].body.client_info_text, /SIREN n° 123 456 789 au RCS de Paris/);
  assert.doesNotMatch(h.calls[0].body.client_info_text, /en cours/);
});

test('EI can omit its RCS and the saved clause matches the PDF label', async () => {
  const h = harness();
  await generateSavedNda({ company: { ...company(), legalForm: 'Autre', isInRegistration: false, siren: '123456789' }, ...h });
  assert.match(h.calls[0].body.client_info_text, /\(EI\)/);
  assert.doesNotMatch(h.calls[0].body.client_info_text, /RCS|Lille/);
});

for (const [name, changes, leadId] of [
  ['missing registry on an established SAS', { isInRegistration: false, siren: '123456789' }, 123],
  ['invalid SIREN', { isInRegistration: false, siren: '123', rcsCity: 'Paris' }, 123],
  ['missing representative', { representatives: [] }, 123],
  ['invalid lead identifier', {}, 'invalid'],
]) {
  test(`${name} is rejected before any save or PDF`, async () => {
    const h = harness();
    await assert.rejects(generateSavedNda({ company: { ...company(), ...changes }, leadId, ...h }));
    assert.equal(h.calls.length, 0);
  });
}

test('the real NDA endpoint renders a PDF for a company in formation with no SIREN/RCS', async () => {
  // Never call the production webhook when exercising the actual PDF handler.
  const previousUrl = process.env.N8N_WEBHOOK_URL;
  const previousFetch = globalThis.fetch;
  delete process.env.N8N_WEBHOOK_URL;
  globalThis.fetch = async () => { throw new Error('Unexpected external request'); };
  try {
    const h = harness();
    const fetchPdf = async (_url, options) => {
      const req = Readable.from([options.body]);
      req.method = 'POST';
      const headers = {};
      const result = await new Promise((resolve, reject) => {
        const res = {
          statusCode: 200, setHeader(key, val) { headers[key] = val; },
          status(code) { this.statusCode = code; return this; },
          send(body) { resolve({ code: this.statusCode, body }); },
          json(body) { resolve({ code: this.statusCode, body }); },
        };
        handler(req, res).catch(reject);
      });
      assert.equal(result.code, 200, JSON.stringify(result.body));
      assert.equal(headers['Content-Type'], 'application/pdf');
      assert.equal(result.body.subarray(0, 5).toString(), '%PDF-');
      assert.ok(result.body.length > 1000);
      return { ok: true, blob: async () => new Blob([result.body], { type: 'application/pdf' }) };
    };
    const pdf = await generateSavedNda({ company: company(), leadId: 123, ...h, fetchPdf });
    assert.equal(pdf.type, 'application/pdf');
    assert.equal(h.calls[0].body.company.isInRegistration, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.N8N_WEBHOOK_URL;
    else process.env.N8N_WEBHOOK_URL = previousUrl;
  }
});
