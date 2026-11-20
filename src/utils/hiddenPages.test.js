import test from "node:test";
import assert from "node:assert/strict";
import { isHiddenTab, withoutHiddenTabs, HIDDEN_FOR_ALL, VISIBLE_ONLY_TO } from "./hiddenPages.js";
import { getVisibleSections } from "./sidebarPermissions.js";

const ROLES = [
  "admin", "ceo", "head_of_acquisition", "acquisition_director", "finance_director", "hr", "customer_success_manager",
  "head_of_sales_manager", "head_of_sales", "sales", "setter", "marketing", null, undefined,
];

// Le menu du CEO, réduit à ce qui compte ici : les cinq pages concernées au milieu d'onglets qui doivent rester.
const SECTIONS = [
  { key: "recent", label: "Récentes", items: [{ id: "dashboard" }] },
  { key: "acquisition", label: "ACQUISITION", items: [
    { id: "perf_sales" }, { id: "lead_quality" }, { id: "leaderboard" }, { id: "funnel_leads" }, { id: "leads_management" },
    { id: "small_leads" }, { id: "autoassign" }, { id: "sequences" }, { id: "bot_ia" },
  ] },
  { key: "finance", label: "FINANCE", items: [{ id: "dispatch" }] },
];
const ids = (sections) => sections.flatMap((s) => (s.items || []).map((i) => i.id));

test("Qualité Leads, Funnel Leads, Auto-affectation et Leads < 100 k€ sont masquées pour tout le monde", () => {
  assert.deepEqual([...HIDDEN_FOR_ALL].sort(), ["autoassign", "funnel_leads", "lead_quality", "small_leads"]);
  for (const tab of HIDDEN_FOR_ALL) for (const role of ROLES) assert.equal(isHiddenTab(tab, role), true, `${tab} / ${role}`);
});

test("Gestion des leads reste visible pour le rôle admin seulement", () => {
  assert.deepEqual([...VISIBLE_ONLY_TO.keys()], ["leads_management"]);
  assert.equal(isHiddenTab("leads_management", "admin"), false);
  for (const role of ROLES.filter((r) => r !== "admin")) assert.equal(isHiddenTab("leads_management", role), true, String(role));
});

test("aucun autre onglet n'est masqué, y compris un id inconnu ou un nom d'objet", () => {
  const others = ["dashboard", "perf_sales", "leaderboard", "sales_team", "setters_stats", "acquisition_agenda", "sales_recordings",
    "webinar", "meta_ads", "campaigns", "sequences", "bot_ia", "dispatch", "financial_analysis", "optilex_board", "inconnu",
    "constructor", "__proto__", "toString", ""];
  for (const tab of others) for (const role of ROLES) assert.equal(isHiddenTab(tab, role), false, `${tab} / ${role}`);
});

test("withoutHiddenTabs retire les onglets masqués, garde l'ordre et les sections, ne modifie pas l'entrée", () => {
  const before = JSON.stringify(SECTIONS);
  const forAdmin = withoutHiddenTabs(SECTIONS, "admin");
  assert.deepEqual(ids(forAdmin), ["dashboard", "perf_sales", "leaderboard", "leads_management", "sequences", "bot_ia", "dispatch"]);
  assert.deepEqual(forAdmin.map((s) => s.key), ["recent", "acquisition", "finance"]);
  assert.deepEqual(ids(withoutHiddenTabs(SECTIONS, "ceo")), ["dashboard", "perf_sales", "leaderboard", "sequences", "bot_ia", "dispatch"]);
  assert.equal(JSON.stringify(SECTIONS), before);
  // un séparateur sans `items` passe tel quel
  assert.deepEqual(withoutHiddenTabs([{ section: "ACQUISITION" }], "admin"), [{ section: "ACQUISITION" }]);
});

test("le menu construit par getVisibleSections n'a plus les pages retirées, pour chaque rôle", () => {
  const HIDDEN = ["lead_quality", "funnel_leads", "small_leads", "autoassign"];
  for (const role of ROLES) {
    const shown = ids(getVisibleSections(SECTIONS, role));
    for (const tab of HIDDEN) assert.equal(shown.includes(tab), false, `${tab} visible pour ${role}`);
    assert.equal(shown.includes("leads_management"), role === "admin", `Gestion des leads : visibilité inattendue pour ${role}`);
  }
  // admin : tout le reste, et Gestion des leads
  assert.deepEqual(ids(getVisibleSections(SECTIONS, "admin")), ["dashboard", "perf_sales", "leaderboard", "leads_management", "sequences", "bot_ia", "dispatch"]);
});

// sessionStorage du navigateur (navScope), absent sous Node.
function withNavScope(scope, fn) {
  const store = new Map(scope ? [["navScope", scope]] : []);
  const previous = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try { return fn(); } finally { globalThis.sessionStorage = previous; }
}

test("un admin dans le contexte d'un dashboard de rôle y voit la barre de ce rôle ; hors contexte, Gestion des leads reste là", () => {
  assert.ok(withNavScope(null, () => ids(getVisibleSections(SECTIONS, "admin"))).includes("leads_management"));
  for (const scope of ["hr", "acquisition_director", "head_of_acquisition"]) {
    const scoped = withNavScope(scope, () => ids(getVisibleSections(SECTIONS, "admin")));
    assert.equal(scoped.includes("leads_management"), false, scope);
    for (const tab of ["lead_quality", "funnel_leads", "small_leads", "autoassign"]) assert.equal(scoped.includes(tab), false, `${tab} / ${scope}`);
  }
});

test("les rôles à menu réduit gardent leurs autres onglets (CSM : Leaderboard et Sub Tickets)", () => {
  assert.deepEqual(ids(getVisibleSections(SECTIONS, "customer_success_manager")), ["leaderboard", "bot_ia"]);
  assert.ok(ids(getVisibleSections(SECTIONS, "head_of_acquisition")).includes("perf_sales"));
  assert.ok(ids(getVisibleSections(SECTIONS, "acquisition_director")).includes("sequences"));
});
