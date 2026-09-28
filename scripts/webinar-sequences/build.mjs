#!/usr/bin/env node
// scripts/webinar-sequences/build.mjs
//
// Régénère `src/data/webinarSequences/` : le contenu réel (objet, HTML, texte, expéditeur,
// pièces jointes…) de chaque e-mail des séquences webinaire, cohorte par cohorte.
//
// Principe : on n'écrit AUCUN texte ici. On compile le vrai `email.ts` de la landing
// (`landing-webinaire`, projet Next.js séparé de ce dépôt), on le branche sur un faux
// client Resend qui capture la charge utile, puis on appelle les vraies fonctions d'envoi
// avec un inscrit « modèle » (`{{prénom}}`, `EVENT_ID`…). Ce qui sort est exactement ce
// que la landing envoie, aux champs personnalisés près.
//
// Usage :
//   node scripts/webinar-sequences/build.mjs --landing <dossier> --eras <dossier> [--out <dossier>]
//
//   --landing  racine d'une copie du projet landing (contient src/lib/webinars.ts,
//              src/lib/services/email.ts et post-ambulance.ts) — version ACTUELLE.
//   --eras     dossier contenant les anciennes versions de email.ts, une par ère de code :
//              may.email.ts, june.email.ts, july.email.ts (cf. ERAS dans definitions.mjs).
//              Elles servent à restituer ce qui a réellement été envoyé aux cohortes passées
//              (les relances post-live ont été réécrites le 08/09).
//   --out      dossier de sortie (défaut : src/data/webinarSequences).
//
// Lecture seule : rien n'est envoyé, aucune base n'est lue.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { COHORTS, ERAS, RULES_COMMON } from './definitions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const STUB = path.join(HERE, 'stubs', 'resend.mjs');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--') || argv[i + 1] === undefined) throw new Error(`Argument invalide : ${key}`);
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.landing || !args.eras) {
  console.error('Usage : node scripts/webinar-sequences/build.mjs --landing <dossier> --eras <dossier> [--out <dossier>]');
  process.exit(1);
}
const LANDING = path.resolve(args.landing);
const ERAS_DIR = path.resolve(args.eras);
const OUT = path.resolve(args.out || path.join(REPO, 'src', 'data', 'webinarSequences'));

/** @brief Copie `from` vers `to` en créant les dossiers. */
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/** @brief Plugin esbuild : alias `@/` vers `src/` de la racine temporaire, et `resend` vers le faux client. */
const aliasPlugin = (root) => ({
  name: 'landing-alias',
  setup(b) {
    b.onResolve({ filter: /^resend$/ }, () => ({ path: STUB }));
    b.onResolve({ filter: /^@\// }, (a) => {
      const base = path.join(root, 'src', a.path.slice(2));
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, 'index.ts')]) {
        if (fs.existsSync(candidate)) return { path: candidate };
      }
      return { errors: [{ text: `Module introuvable : ${a.path}` }] };
    });
  },
});

/** @brief Compile l'`email.ts` d'une ère et renvoie son module. */
async function loadEra(name, spec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `webinar-seq-${name}-`));
  const emailSrc = spec.file ? path.join(ERAS_DIR, spec.file) : path.join(LANDING, 'src', 'lib', 'services', 'email.ts');
  copy(emailSrc, path.join(root, 'src', 'lib', 'services', 'email.ts'));
  copy(path.join(LANDING, 'src', 'lib', 'webinars.ts'), path.join(root, 'src', 'lib', 'webinars.ts'));
  if (spec.postAmbulance) {
    copy(path.join(LANDING, 'src', 'lib', 'services', 'post-ambulance.ts'), path.join(root, 'src', 'lib', 'services', 'post-ambulance.ts'));
  }
  const outfile = path.join(root, 'bundle.mjs');
  await build({
    stdin: { contents: 'export * from "@/lib/services/email";', resolveDir: root, sourcefile: 'entry.ts', loader: 'ts' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    outfile,
    plugins: [aliasPlugin(root)],
    logLevel: 'error',
  });
  return import(pathToFileURL(outfile).href);
}

/** @brief Inscrit « modèle » : les champs personnalisés restent visibles sous forme de jetons. */
const sampleLead = (webinarId) => ({
  id: 'LEAD_ID',
  eventId: 'EVENT_ID',
  prenom: '{{prénom}}',
  nom: '{{nom}}',
  email: '{{email}}',
  telephone: '',
  societe: '',
  webinarId,
  source: 'landing',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  unsubscribedAt: null,
});

const kindOf = (payload) => payload.tags?.find((t) => t.name === 'kind')?.value;

/** @brief Appelle chaque fonction d'envoi de l'ère pour une cohorte et indexe les charges utiles par kind. */
async function captureCohort(mod, cohortId, warnings) {
  const byKind = new Map();
  const lead = sampleLead(cohortId);
  for (const [name, fn] of Object.entries(mod)) {
    if (!/^send.+Email$/.test(name) || name === 'sendBroadInviteEmail') continue;
    globalThis.__seqCapture = [];
    try {
      await fn(lead, 'preview');
    } catch (err) {
      warnings.push(`${cohortId} · ${name} : ${err.message}`);
      continue;
    }
    for (const payload of globalThis.__seqCapture) {
      const kind = kindOf(payload);
      if (kind) byKind.set(kind, payload);
    }
  }
  if (typeof mod.sendBroadInviteEmail === 'function') {
    globalThis.__seqCapture = [];
    await mod.sendBroadInviteEmail({ toEmail: '{{email}}', prenom: '{{prénom}}', outboxId: 'preview' });
    for (const payload of globalThis.__seqCapture) byKind.set(kindOf(payload), payload);
  }
  return byKind;
}

// ── Extraction des champs dérivés ───────────────────────────────────────────────

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&rsquo;': '’', '&lsquo;': '‘', '&zwnj;': '' };
const decode = (s) => s.replace(/&(?:nbsp|amp|lt|gt|quot|#39|rsquo|lsquo|zwnj);/g, (m) => ENTITIES[m] ?? m);
const stripTags = (s) => decode(s.replace(/<[^>]+>/g, ''));

/** @brief Version texte générée depuis le HTML (même règle que `htmlToPlainText` de la landing). */
function htmlToPlainText(html) {
  return (
    decode(
      html
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<div style="(?:overflow:hidden;max-height:0|display:none;max-height:0)[\s\S]*?<\/div>/gi, '')
        .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
          const l = String(label).replace(/<[^>]+>/g, '').trim();
          return href && !String(href).startsWith('mailto:') ? `${l} : ${href}` : l;
        })
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|ul|ol|table|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
    )
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}

/** @brief Texte de pré-en-tête (celui que la boîte de réception affiche après l'objet). */
function preheaderOf(html) {
  if (!html) return '';
  const m = html.match(/<div[^>]*style="[^"]*(?:max-height:0|display:none)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  return m ? stripTags(m[1]).replace(/\s+/g, ' ').trim() : '';
}

/** @brief Extrait une ligne d'aperçu : le début du texte, sans la formule d'appel. */
function snippetOf(text) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  while (lines.length > 1 && lines[0].length < 60 && /^(bonjour|salut|on est en live)/i.test(lines[0])) lines.shift();
  return lines.join(' ').replace(/\s+/g, ' ').slice(0, 220);
}

/** @brief Liens de l'e-mail (boutons, liens personnels, désinscription). */
function linksOf(html) {
  if (!html) return [];
  const seen = new Set();
  const links = [];
  for (const m of html.matchAll(/<a\s([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = `${m[1]} ${m[3]}`;
    const href = decode(m[2]);
    const label = stripTags(m[4]).replace(/\s+/g, ' ').trim();
    if (!label && !href) continue;
    const key = `${label}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      label,
      href,
      personal: href.includes('EVENT_ID'),
      unsubscribe: /\/u\/EVENT_ID/.test(href),
      button: /display:\s*inline-block/.test(attrs),
    });
  }
  return links.slice(0, 24);
}

function attachmentsOf(payload) {
  return (payload.attachments || []).map((a) => {
    const raw = Buffer.from(a.content, 'base64');
    const isText = /^text\//.test(a.contentType || '');
    return {
      filename: a.filename,
      contentType: a.contentType || 'application/octet-stream',
      bytes: raw.length,
      ...(isText ? { text: raw.toString('utf8') } : {}),
    };
  });
}

function composeStep(def, payload, order, seqIndex, seqCount) {
  const html = payload.html || '';
  const derived = !payload.text && html !== '';
  const text = payload.text || (html ? htmlToPlainText(html) : '');
  const headers = Object.entries(payload.headers || {})
    .filter(([name]) => name !== 'X-Entity-Ref-ID')
    .map(([name, value]) => ({ name, value: String(value) }));
  return {
    kind: def.kind,
    order,
    sequence: def.sequence,
    sequenceIndex: seqIndex,
    sequenceCount: seqCount,
    phase: def.phase,
    ...(def.segment ? { segment: def.segment } : {}),
    timing: { ...def.timing, ...(def.atLabel ? { label: def.atLabel } : {}) },
    conditions: def.conditions || [],
    ...(def.recipientsLabel ? { recipientsLabel: def.recipientsLabel } : {}),
    subject: payload.subject || '',
    preheader: preheaderOf(html),
    snippet: snippetOf(text),
    from: payload.from || '',
    replyTo: payload.replyTo || '',
    tags: payload.tags || [],
    headers,
    attachments: attachmentsOf(payload),
    links: linksOf(html),
    ...(html ? { html } : {}),
    text,
    ...(derived ? { textDerived: true } : {}),
  };
}

// ── Exécution ───────────────────────────────────────────────────────────────────

process.env.RESEND_API_KEY = 'preview-only';
delete process.env.RESEND_FROM;
delete process.env.RESEND_REPLY_TO;

const warnings = [];
const catalog = [];
fs.mkdirSync(path.join(OUT, 'cohorts'), { recursive: true });

const eraModules = new Map();
for (const cohort of COHORTS) {
  if (!eraModules.has(cohort.era)) eraModules.set(cohort.era, await loadEra(cohort.era, ERAS[cohort.era]));
  const mod = eraModules.get(cohort.era);
  const captured = await captureCohort(mod, cohort.id, warnings);

  const missing = cohort.steps.filter((s) => !captured.has(s.kind)).map((s) => s.kind);
  if (missing.length) throw new Error(`${cohort.id} : kinds sans rendu dans l'ère « ${cohort.era} » : ${missing.join(', ')}`);

  const countBySeq = {};
  for (const s of cohort.steps) countBySeq[s.sequence] = (countBySeq[s.sequence] || 0) + 1;
  const seen = {};
  const steps = cohort.steps.map((def, i) => {
    seen[def.sequence] = (seen[def.sequence] || 0) + 1;
    return composeStep(def, captured.get(def.kind), i + 1, seen[def.sequence], countBySeq[def.sequence]);
  });

  const meta = {
    id: cohort.id,
    label: cohort.label,
    short: cohort.short,
    audience: cohort.audience,
    liveAt: cohort.liveAt,
    speakers: cohort.speakers,
    pages: cohort.pages,
    notes: cohort.notes,
    codeEra: cohort.era,
    stepCount: steps.length,
  };
  const sequences = Object.fromEntries(
    Object.entries(cohort.sequences).map(([key, seq]) => [key, { ...seq, count: countBySeq[key] || 0 }])
  );
  const file = { schema: 1, generatedAt: new Date().toISOString().slice(0, 10), cohort: meta, sequences, rules: RULES_COMMON, steps };
  fs.writeFileSync(path.join(OUT, 'cohorts', `${cohort.id}.json`), JSON.stringify(file, null, 1) + '\n');
  catalog.push(meta);
  const kb = Math.round(fs.statSync(path.join(OUT, 'cohorts', `${cohort.id}.json`)).size / 1024);
  console.log(`${cohort.id} · ${steps.length} e-mails · ${kb} Ko`);
}

fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
if (warnings.length) {
  console.warn('\nAvertissements (fonctions d\'envoi non exécutables, ignorées) :');
  for (const w of warnings) console.warn('  - ' + w);
}
console.log(`\nÉcrit dans ${path.relative(REPO, OUT) || OUT}`);
