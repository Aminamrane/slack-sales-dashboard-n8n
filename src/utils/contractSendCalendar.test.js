import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the actual page handlers, with all network operations recorded. This
// reproduces the post-intake R1 regression, rather than testing a duplicate flow.
const source = readFileSync(new URL('../pages/TrackingSheet.jsx', import.meta.url), 'utf8');
function harness({ready = true, fail = false} = {}) {
  const calls = [], errors = [];
  let confirm;
  const context = {
    apiClient: {
      post: async (...args) => { calls.push(['post', ...args]); if (fail) throw Error('send failed'); },
      patch: async (...args) => calls.push(['patch', ...args]),
    },
    checkIntakeBeforeSend: async () => ready,
    contractDates: {42: '2026-10-01'},
    fetchLeadContracts: async id => calls.push(['refresh', id]),
    setSendingContract() {}, setNavNotif() {}, setR1ShortcutContract() {},
    setResendingContract() {}, setConfirmModal: value => {confirm = value;},
    reportContractError: error => errors.push(error.message),
    setLeads: () => calls.push(['changeLead']),
    parisToday: () => '2026-09-22', setTimeout() {}, console: {error() {}},
  };
  const start = source.indexOf('  const handleSendContract =');
  const end = source.indexOf('  const handleCancelContract =', start);
  assert.ok(start > 0 && end > start);
  vm.runInNewContext(`${source.slice(start, end)}\nthis.send = handleSendContract; this.resend = handleResendContract;`, context);
  return {context, calls, errors, confirm: () => confirm};
}
for (const status of ['r1', 'r2', 'r3']) {
  for (const intakeConfirmed of [false, true]) {
    test(`sending from ${status}, intake confirmed ${intakeConfirmed}, preserves appointments and qualification`, async () => {
      const h = harness();
      const lead = {id: 42, status, employee_range: '1 à 2 salariés', r1_date: '2026-09-20T14:30:00Z', r2_date: null};
      const before = structuredClone(lead);
      await h.context.send(lead, intakeConfirmed);
      assert.deepEqual(lead, before);
      assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [
        ['post', '/api/v1/contracts/send', {lead_id: 42, employee_range: '1 à 2 salariés', contract_display_date: '2026-10-01'}],
        ['refresh', 42],
      ]);
      assert.deepEqual(h.errors, []);
    });
  }
}
test('intake not ready sends no contract and creates no appointment', async () => {
  const h = harness({ready: false});
  await h.context.send({id:42, status:'r1', employee_range:'1 à 2 salariés'});
  assert.deepEqual(h.calls, []);
});
test('failed contract send cannot create appointments or move the lead', async () => {
  const h = harness({fail: true});
  await h.context.send({id:42, status:'r1', employee_range:'1 à 2 salariés'}, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'post');
  assert.deepEqual(h.errors, ['send failed']);
});
test('resending changes only the contract, after confirmation', async () => {
  const h = harness();
  await h.context.resend('contract-1', 42, true);
  assert.deepEqual(h.calls, []);
  await h.confirm().onConfirm();
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [
    ['post', '/api/v1/contracts/contract-1/resend', {contract_display_date:'2026-10-01'}], ['refresh',42],
  ]);
});
test('legacy R1 shortcut delegates to the same tested handler', () => {
  const shortcut = source.slice(source.indexOf('{/* ── Shortcut: Envoyer le contrat'), source.indexOf('/* ── Step 1: R1 qualification pills'));
  assert.ok(shortcut.includes('if (!isSending && hasRange) handleSendContract(lead)'));
  assert.ok(!shortcut.includes('apiClient.post') && !shortcut.includes('apiClient.patch'));
});

test('admin contract shortcut on the setter page also preserves appointments', async () => {
  const setterSource = readFileSync(new URL('../pages/TrackingSheetSetter.jsx', import.meta.url), 'utf8');
  const calls = [];
  const context = {
    apiClient: {post: async (...args) => calls.push(['post', ...args]), patch: async (...args) => calls.push(['patch', ...args])},
    fetchLeadContracts: async id => calls.push(['refresh', id]),
    setSendingContract() {}, setNavNotif() {}, setR1ShortcutContract() {}, setTimeout() {},
  };
  vm.runInNewContext(`${setterSource.slice(setterSource.indexOf('  const handleSendContract ='), setterSource.indexOf('  const handleResendContract ='))}\nthis.send = handleSendContract;`, context);
  await context.send({id:42, status:'r1', employee_range:'1 à 2 salariés'});
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['post','/api/v1/contracts/send',{lead_id:42,employee_range:'1 à 2 salariés'}],['refresh',42]]);
  const shortcut = setterSource.slice(setterSource.indexOf('{/* ── Shortcut: Envoyer le contrat'), setterSource.indexOf('/* ── Step 1: R1 qualification pills'));
  assert.ok(shortcut.includes('if (!isSending && hasRange) handleSendContract(lead)'));
  assert.ok(!shortcut.includes('apiClient.post(') && !shortcut.includes('apiClient.patch('));
});

for (const page of ['TrackingSheet', 'TrackingSheetSetter']) {
  test(`${page}: an R1 contract is fetched again after reloading the sheet`, async () => {
    const pageSource = readFileSync(new URL(`../pages/${page}.jsx`, import.meta.url), 'utf8');
    const start = pageSource.indexOf('  const r1CatIndex =');
    const end = pageSource.indexOf('  // ── SUPABASE REALTIME: contract', start);
    const calls = [], effects = [];
    const lead = {id:42,status:'r1'};
    const context = {
      isSetter:false,CATEGORIES:[{key:'r1'},{key:'r2'},{key:'r3'}],activeTab:0,leads:[lead,{id:43,status:'r2'}],
      useEffect: callback => effects.push(callback), setLoadingContracts() {},
      fetchLeadContracts: async id => {calls.push(['fetch',id]);return [{yousign_status:'ongoing'}];},
      apiClient:{patch:async (...args) => calls.push(['patch',...args])},
      setLeads() {},
    };
    assert.ok(start > 0 && end > start);
    vm.runInNewContext(pageSource.slice(start,end),context);
    effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls,[['fetch',42]]);
    assert.equal(lead.status,'r1');
  });
}
