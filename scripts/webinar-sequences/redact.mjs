#!/usr/bin/env node
// scripts/webinar-sequences/redact.mjs
//
// Masque ce qui ne doit pas se retrouver dans un dépôt PUBLIC avant d'écrire les instantanés de `src/data/webinarSequences/` :
//   - les codes d'invitation des groupes WhatsApp (`chat.whatsapp.com/<code>` → `chat.whatsapp.com/CODE_MASQUE`) : quiconque
//     les lit peut rejoindre le groupe des inscrits ;
//   - l'adresse personnelle d'un expéditeur (`prenom@ownertechnology.com` → `expediteur@ownertechnology.com`) ; les adresses
//     génériques `info@` et `contact@` sont gardées.
// Conséquence assumée : dans l'éditeur, le bouton WhatsApp d'un e-mail pointe vers un lien masqué (l'e-mail réel, lui, est envoyé
// par la landing avec le vrai lien).
//
// `build.mjs` l'applique à chaque génération ; pour des fichiers déjà générés :
//   node scripts/webinar-sequences/redact.mjs src/data/webinarSequences/cohorts/*.json

import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const WHATSAPP_CODE = /(chat\.whatsapp\.com\/)[A-Za-z0-9]{10,}/g;
const OWNER_ADDRESS = /\b([A-Za-z0-9._%+-]+)@ownertechnology\.com\b/gi;
const GENERIC_LOCAL_PARTS = new Set(['info', 'contact']);

/** @brief Texte (JSON sérialisé) sans code d'invitation WhatsApp ni adresse personnelle d'Owner. */
export function redactPublic(text) {
  return text
    .replace(WHATSAPP_CODE, '$1CODE_MASQUE')
    .replace(OWNER_ADDRESS, (match, local) => (GENERIC_LOCAL_PARTS.has(local.toLowerCase()) ? match : 'expediteur@ownertechnology.com'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const file of process.argv.slice(2)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = redactPublic(before);
    if (after !== before) fs.writeFileSync(file, after);
    JSON.parse(after); // un fichier masqué doit rester un JSON valide
    console.log(`${file} : ${after === before ? 'déjà masqué' : 'masqué'}`);
  }
}
