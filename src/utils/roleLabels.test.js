import test from "node:test";
import assert from "node:assert/strict";
import { roleLabel, userTitle } from "./roleLabels.js";

test("le poste renseigné remplace le libellé du rôle sous le nom", () => {
  assert.equal(userTitle({ role: "ceo", job_title: "Juriste fiscaliste" }), "Juriste fiscaliste");
});

test("sans poste, le libellé du rôle reste affiché", () => {
  assert.equal(userTitle({ role: "ceo" }), "CEO");
  assert.equal(userTitle({ role: "ceo", job_title: "   " }), "CEO");
  assert.equal(userTitle({ role: "finance_team", job_title: null }), roleLabel("finance_team"));
  assert.equal(userTitle(null), "Membre");
});
