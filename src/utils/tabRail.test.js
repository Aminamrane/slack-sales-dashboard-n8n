import test from "node:test";
import assert from "node:assert/strict";
import { revealInRail } from "./tabRail.js";

const rail = (scrollLeft) => ({ scrollLeft, clientWidth: 300 });

test("un onglet déjà visible ne déplace rien", () => {
  const r = rail(100);
  revealInRail(r, { offsetLeft: 150, offsetWidth: 80 });
  assert.equal(r.scrollLeft, 100);
});

test("un onglet caché à droite ou à gauche est ramené dans la rangée, avec sa marge", () => {
  const right = rail(0);
  revealInRail(right, { offsetLeft: 360, offsetWidth: 90 });
  assert.equal(right.scrollLeft, 360 + 90 + 8 - 300);
  const left = rail(200);
  revealInRail(left, { offsetLeft: 40, offsetWidth: 90 });
  assert.equal(left.scrollLeft, 32);
  const first = rail(200);
  revealInRail(first, { offsetLeft: 3, offsetWidth: 90 });
  assert.equal(first.scrollLeft, 0);
});

test("sans rangée ou sans onglet, rien ne se passe ; la page n'est jamais déplacée", () => {
  assert.doesNotThrow(() => { revealInRail(null, { offsetLeft: 0, offsetWidth: 10 }); revealInRail(rail(0), null); });
  // L'onglet n'a aucune méthode de défilement à appeler : seul `scrollLeft` de la rangée change.
  const tab = { offsetLeft: 900, offsetWidth: 60, scrollIntoView() { throw new Error("la page ne doit pas défiler"); } };
  const r = rail(0);
  revealInRail(r, tab);
  assert.equal(r.scrollLeft, 900 + 60 + 8 - 300);
});
