import test from 'node:test';
import assert from 'node:assert/strict';
import { presentContractError, validateContractPreparation } from './contractErrors.js';

test('provider field errors become explicit corrective instructions without raw data', () => {
  const raw = 'Step 4 - Add signer failed (400): '+JSON.stringify({type:'parameters_not_valid',detail:'secret diagnostic',invalid_params:[{name:'info[phone_number]',reason:'This value is not valid'},{name:'info[email]',reason:'fixture-private@example.com'}]});
  const error = presentContractError(raw,{pilot:true});
  assert.equal(error.action,'preparation');
  assert.equal(error.title,'Informations à corriger');
  assert.match(error.fields.phone,/06 12 34 56 78/);
  assert.match(error.fields.email,/sans espace/);
  assert.doesNotMatch(error.message,/parameters_not_valid|Step 4|secret|fixture-private|info\[/);
});
test('FastAPI validation arrays are handled through apiClient.data and focusable fields', () => {
  const error = Object.assign(new Error('[object Object]'),{status:422,data:{detail:[{loc:['body','email'],msg:'value is not a valid email'},{loc:['body','employee_range'],type:'missing'}]}});
  assert.deepEqual(Object.keys(presentContractError(error,{preparation:true}).fields),['email','employee_range']);
  assert.doesNotMatch(presentContractError(error).message,/object Object/);
});
test('missing signer names are not misreported as a missing NDA', () => {
  const error=presentContractError(new Error('Renseignez le prénom et le nom du signataire dans le NDA avant l’envoi.'));
  assert.equal(error.isNdaMissing,false);
  assert.equal(error.action,'nda');
  assert.equal(error.title,'Identité du signataire à corriger');
});
test('a truly missing NDA has its own corrective action', () => {
  const error=presentContractError('Client data missing. Fill the NDA form first.');
  assert.equal(error.isNdaMissing,true);
  assert.equal(error.action,'nda');
});
test('legacy phones direct to NDA and pilot phones to preparation', () => {
  assert.equal(presentContractError('info[phone_number]').action,'nda');
  assert.equal(presentContractError('info[phone_number]',{pilot:true}).action,'preparation');
});
test('unknown server details and timeouts never leak raw traces or promise a failed send', () => {
  const error=presentContractError(Object.assign(new Error('<html>secret traceback</html>'),{status:502}));
  assert.equal(error.action,null);
  assert.match(error.message,/statut du contrat/);
  assert.doesNotMatch(error.message,/secret|traceback|rien n.est perdu|html/);
  const unknown=presentContractError('RuntimeError internal secret TOKEN');
  assert.doesNotMatch(unknown.message,/RuntimeError|TOKEN|secret/);
});
test('permission failures cannot offer a corrective write action', () => {
  const error=presentContractError(Object.assign(new Error('Forbidden'),{status:403}));
  assert.equal(error.action,null);
  assert.match(error.message,/administrateur/);
});
test('stale preparation tells users to reopen without replacing their edits', () => {
  const error=presentContractError('Les coordonnées ont changé. Rouvrez la préparation du contrat.');
  assert.equal(error.title,'Informations mises à jour');
  assert.equal(error.action,null);
});
test('local preparation requires the signer phone and accepts local formatting', () => {
  assert.deepEqual(Object.keys(validateContractPreparation({})),['employee_range','email','phone']);
  assert.deepEqual(Object.keys(validateContractPreparation({employee_range:'3-5',email:'valid@example.com',phone:''})),['phone']);
  for (const phone of ['06 12 34 56 78', '07 66 55 69 19', '+33 7 66 55 69 19']) assert.deepEqual(validateContractPreparation({employee_range:'3-5',email:'valid@example.com',phone}),{});
  assert.deepEqual(Object.keys(validateContractPreparation({employee_range:'3-5',email:'invalid email',phone:'appel moi'})),['email','phone']);
});

test('un contrat en cours de signature n’est pas présenté comme déjà signé', () => {
  const inSignature = presentContractError(new Error("Un contrat est déjà en signature pour ce dossier. Ses coordonnées ne peuvent plus être modifiées ici : consultez-le depuis le dossier, attendez la signature ou annulez-le avant d'en préparer un autre."), {preparation:true});
  assert.equal(inSignature.title, 'Contrat en signature');
  assert.match(inSignature.message, /en cours de signature/);
  const legacy = presentContractError(new Error('Un contrat est déjà en signature ou signé. Ses coordonnées ne peuvent plus être modifiées ici.'), {preparation:true});
  assert.equal(legacy.title, 'Contrat en signature');
  const signed = presentContractError(new Error('Ce dossier est déjà signé. Consultez le contrat depuis le dossier ; il ne peut pas être renvoyé.'));
  assert.equal(signed.title, 'Contrat déjà signé');
  assert.equal(presentContractError('Cannot resend a signed contract').title, 'Contrat déjà signé');
});
