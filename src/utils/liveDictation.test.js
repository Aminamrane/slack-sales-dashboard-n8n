import test from "node:test";
import assert from "node:assert/strict";
import { createLiveListener } from "./liveDictation.js";

// Reconnaissance vocale simulée : le test décide de ce qui est entendu, des coupures et des erreurs.
function fakeRecognition() {
  const made = [];
  class Recognition {
    constructor() { this.started = false; this.stopped = false; made.push(this); }
    start() { this.started = true; }
    stop() { this.stopped = true; if (this.endsOnStop !== false) queueMicrotask(() => this.onend?.()); }
    hear(...phrases) { this.onresult?.({ results: phrases.map((transcript) => [{ transcript }]) }); }
  }
  return { Recognition, made };
}

test("le texte entendu part dès l'arrêt, sans attendre le serveur", async () => {
  const { Recognition, made } = fakeRecognition();
  const seen = [];
  const listener = createLiveListener({ Recognition, onText: (t) => seen.push(t) });
  listener.start();
  assert.equal(made.length, 1);
  assert.deepEqual([made[0].lang, made[0].continuous, made[0].interimResults], ["fr-FR", true, true]);
  made[0].hear("Restauration traditionnelle, ", "cogérance avec son conjoint.");
  const heard = await listener.finish();
  assert.deepEqual(heard, { text: "Restauration traditionnelle, cogérance avec son conjoint.", trusted: true });
  assert.equal(seen.at(-1), heard.text);
  assert.equal(made[0].stopped, true);
  assert.equal(made.length, 1, "l'arrêt demandé ne relance pas l'écoute");
});

test("le navigateur coupe l'écoute en pleine dictée : elle repart et le texte se suit", async () => {
  const { Recognition, made } = fakeRecognition();
  const listener = createLiveListener({ Recognition });
  listener.start();
  made[0].hear("Première phrase.");
  made[0].onerror({ error: "no-speech" });
  made[0].onend();
  assert.equal(made.length, 2, "l'écoute est relancée");
  made[1].hear("Deuxième phrase.");
  assert.deepEqual(await listener.finish(), { text: "Première phrase. Deuxième phrase.", trusted: true });
});

test("une vraie erreur d'écoute : le texte n'est plus sûr, le serveur transcrira l'enregistrement", async () => {
  const { Recognition, made } = fakeRecognition();
  const listener = createLiveListener({ Recognition });
  listener.start();
  made[0].hear("Début seulement");
  made[0].onerror({ error: "network" });
  made[0].onend();
  assert.equal(made.length, 1, "pas de relance après une erreur");
  assert.deepEqual(await listener.finish(), { text: "Début seulement", trusted: false });
});

test("sans reconnaissance vocale, ou si rien n'a été entendu, le texte n'est pas sûr", async () => {
  assert.deepEqual(await createLiveListener({ Recognition: undefined }).finish(), { text: "", trusted: false });
  const { Recognition } = fakeRecognition();
  const silent = createLiveListener({ Recognition });
  silent.start();
  assert.deepEqual(await silent.finish(), { text: "", trusted: false });
});

test("un navigateur qui ne confirme pas l'arrêt ne bloque pas : le texte part après le délai", async () => {
  const { Recognition, made } = fakeRecognition();
  const listener = createLiveListener({ Recognition, wait: 20 });
  listener.start();
  made[0].endsOnStop = false;
  made[0].hear("Texte entendu");
  const before = Date.now();
  assert.deepEqual(await listener.finish(), { text: "Texte entendu", trusted: true });
  assert.ok(Date.now() - before < 500);
});

test("annuler arrête l'écoute et oublie le texte", async () => {
  const { Recognition, made } = fakeRecognition();
  const listener = createLiveListener({ Recognition });
  listener.start();
  made[0].hear("À oublier");
  listener.cancel();
  assert.equal(made[0].stopped, true);
  assert.deepEqual(await listener.finish(), { text: "", trusted: false });
});
