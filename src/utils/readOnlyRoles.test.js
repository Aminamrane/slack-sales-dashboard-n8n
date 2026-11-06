// readOnlyRoles.test.js — les RH (rôle hr) voient les pages de la direction
// financière, en lecture seule (dev 06/11/2026).
//
// Ce qui est verrouillé ici : le helper (contrôles d'écriture visibles et
// désactivés, rien n'est caché), la barre latérale (la même que celle de
// finance_director, onglets réservés retirés), la page d'arrivée et le retour
// au dashboard, et les garde-fous des écritures du board.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { READ_ONLY_DIRECTION_ROLES, READ_ONLY_MARK, READ_ONLY_PROPS, READ_ONLY_TITLE, isReadOnlyViewer, readOnlyProps } from './readOnlyRoles.js';
import { getVisibleSections } from './sidebarPermissions.js';
import { CEO_TAB_ROUTES, getDashboardRoute } from './dashboardNavigation.js';

// sessionStorage du navigateur (navScope), absent sous Node.
function withNavScope(scope, fn) {
  const store = new Map(scope ? [['navScope', scope]] : []);
  const previous = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try { return fn(); } finally { globalThis.sessionStorage = previous; }
}

test('seul le rôle hr est en lecture seule', () => {
  assert.deepEqual([...READ_ONLY_DIRECTION_ROLES], ['hr']);
  assert.equal(isReadOnlyViewer('hr'), true);
  for (const role of ['finance_director', 'finance_team', 'ceo', 'admin', 'customer_success_manager', 'marketing', 'head_of_acquisition', 'acquisition_director', 'sales', undefined, null, '']) {
    assert.equal(isReadOnlyViewer(role), false, String(role));
  }
});

test('readOnlyProps : contrôle désactivé et « Lecture seule » pour hr, rien pour les autres', () => {
  assert.deepEqual(readOnlyProps('hr'), { disabled: true, title: 'Lecture seule', 'aria-disabled': true, 'data-read-only': 'true' });
  assert.equal(READ_ONLY_TITLE, 'Lecture seule');
  for (const role of ['finance_director', 'finance_team', 'ceo', 'admin', undefined]) {
    assert.deepEqual(readOnlyProps(role), {}, String(role));
  }
  // La marque des zones non formulaires ne porte pas `disabled` (attribut invalide hors formulaire).
  assert.equal('disabled' in READ_ONLY_MARK, false);
  assert.equal(READ_ONLY_MARK['data-read-only'], READ_ONLY_PROPS['data-read-only']);
  assert.ok(Object.isFrozen(READ_ONLY_PROPS) && Object.isFrozen(READ_ONLY_MARK));
});

test('le style grisé vise l\'attribut posé par readOnlyProps et est chargé par l\'application', () => {
  const css = readFileSync(new URL('../styles/readOnly.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-read-only="true"\]/);
  assert.match(css, /cursor: not-allowed/);
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(app, /import "\.\/styles\/readOnly\.css";/);
});

// Mêmes sections et mêmes identifiants que SIDEBAR_SECTIONS (CeoDashboard.jsx, non importable sous Node).
const SECTIONS = [
  { key: 'recent', items: ['dashboard', 'my_tracking_sheet'] },
  { key: 'human', items: ['conges', 'variables', 'work_hours'] },
  { key: 'acquisition', items: ['perf_sales', 'lead_quality', 'leaderboard', 'sales_team', 'setters_stats', 'acquisition_agenda', 'sales_recordings', 'webinar', 'meta_ads', 'funnel_leads', 'leads_management', 'small_leads', 'autoassign', 'sequences', 'bot_ia'] },
  { key: 'finance', items: ['dispatch', 'campaigns'] },
  { key: 'produit', items: ['optilex_board'] },
].map((s) => ({ key: s.key, label: s.key, items: s.items.map((id) => ({ id })) }));
const visible = (role) => withNavScope(null, () => getVisibleSections(SECTIONS, role))
  .map((s) => ({ key: s.key, items: s.items.map((it) => it.id) }));

test('hr a la barre latérale de finance_director, plus les onglets de la direction', () => {
  const hr = visible('hr').flatMap((s) => s.items);
  for (const id of visible('finance_director').flatMap((s) => s.items)) assert.ok(hr.includes(id), id);
});

test('hr gagne la Finance, les Campagnes, le Board et garde Heures de travail', () => {
  const ids = visible('hr').flatMap((s) => s.items);
  for (const id of ['dashboard', 'dispatch', 'campaigns', 'optilex_board', 'webinar', 'autoassign', 'sequences', 'work_hours', 'conges', 'variables', 'meta_ads', 'bot_ia']) {
    assert.ok(ids.includes(id), id);
  }
});

test('hr voit aussi les onglets de la direction (Perf Setters, agenda, enregistrements, leads), pas Ma Tracking Sheet', () => {
  const ids = visible('hr').flatMap((s) => s.items);
  for (const id of ['sales_recordings', 'leads_management', 'small_leads', 'setters_stats', 'acquisition_agenda']) {
    assert.ok(ids.includes(id), id);
  }
  assert.equal(ids.includes('my_tracking_sheet'), false);
});

test('le contexte RH (navScope hr) suit la même barre, y compris pour un admin', () => {
  const scoped = withNavScope('hr', () => getVisibleSections(SECTIONS, 'admin'))
    .map((s) => ({ key: s.key, items: s.items.map((it) => it.id) }));
  assert.deepEqual(scoped, visible('hr'));
});

test('les autres barres latérales ne bougent pas', () => {
  assert.deepEqual(visible('head_of_acquisition').map((s) => s.key), ['recent', 'acquisition', 'finance']);
  assert.deepEqual(visible('head_of_acquisition').find((s) => s.key === 'finance').items, ['campaigns']);
  assert.deepEqual(visible('acquisition_director').map((s) => s.key), ['recent', 'acquisition']);
  assert.deepEqual(visible('customer_success_manager').map((s) => s.key), ['acquisition', 'produit']);
  const all = SECTIONS.flatMap((s) => s.items.map((it) => it.id));
  assert.deepEqual(visible('ceo').flatMap((s) => s.items), all);
});

test('retour au dashboard : hr revient sur /ceo, le contexte RH sur /rh-dashboard', () => {
  withNavScope(null, () => {
    assert.equal(getDashboardRoute('hr'), '/ceo');
    assert.equal(getDashboardRoute('finance_director'), '/ceo');
    assert.equal(getDashboardRoute('ceo'), '/ceo');
    assert.equal(getDashboardRoute('acquisition_director'), '/acquisition-director');
    assert.equal(getDashboardRoute('head_of_acquisition'), '/acquisition-director');
  });
  withNavScope('hr', () => {
    assert.equal(getDashboardRoute('hr'), '/rh-dashboard');
    assert.equal(getDashboardRoute('admin'), '/rh-dashboard');
  });
  withNavScope('acquisition_director', () => {
    assert.equal(getDashboardRoute('admin'), '/acquisition-director');
  });
});

test('les onglets-route sans gestion propre dans une vue ne retombent plus sur un /ceo vide', () => {
  assert.equal(CEO_TAB_ROUTES.work_hours, '/ceo/work-hours');
  assert.equal(CEO_TAB_ROUTES.sequences, '/ceo/sequences');
  assert.equal(CEO_TAB_ROUTES.optilex_board, '/ceo/optilex-board');
});

test('Login envoie hr sur /ceo, comme finance_director', () => {
  const login = readFileSync(new URL('../pages/Login.jsx', import.meta.url), 'utf8');
  assert.match(login, /\bhr: '\/ceo'/);
  assert.match(login, /finance_director: '\/ceo'/);
});

// Board : les trois écritures centrales (jalons, état, météo) et l'historique
// d'emails posé à l'ouverture d'une fiche s'arrêtent pour un rôle en lecture
// seule AVANT tout appel au serveur. Garde-fou si un contrôle venait à réapparaître.
test('board : aucune écriture centrale ne part pour un rôle en lecture seule', () => {
  const board = readFileSync(new URL('../pages/OptilexBoard.jsx', import.meta.url), 'utf8');
  assert.match(board, /const isBoardReadOnly = \(\) => \{ try \{ return isReadOnlyViewer\(/);
  for (const start of [
    'const patch = useCallback(async (numero, changes) => {',
    'const changeEtat = useCallback(async (numero, payload) => {',
    'const recordMeteo = useCallback(async (numero, payload) => {',
  ]) {
    const at = board.indexOf(start);
    assert.ok(at > 0, start);
    const beforeWrite = board.slice(at, board.indexOf('apiClient.', at + start.length));
    assert.match(beforeWrite, /if \(isBoardReadOnly\(\)\) return/, start);
  }
  const history = board.indexOf('apiClient.post("/api/v1/optilex/email-history", { numero_client: num, emails })');
  assert.ok(history > 0);
  assert.match(board.slice(history - 400, history), /if \(!num \|\| readOnly\) return;/);
});
