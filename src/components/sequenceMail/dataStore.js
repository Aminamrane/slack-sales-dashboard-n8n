// src/components/sequenceMail/dataStore.js
//
// Données du mini client e-mail. Trois sources, chacune réelle :
//   1. le catalogue + le contenu des séquences (src/data/webinarSequences, généré depuis le
//      code de la landing — l'API du CRM n'expose pas les objets ni les corps d'e-mails) ;
//   2. la liste des cohortes du CRM        GET /api/v1/marketing/webinars ;
//   3. les compteurs d'envoi par cohorte   GET …/webinars/{id}/overview et …/campaigns/post-nurture
//      (les mêmes appels que le dashboard Marketing, mêmes formes de réponse).
// Le contenu est chargé à la demande, cohorte par cohorte ; les compteurs sont mis en cache 60 s.
// Tout est en LECTURE SEULE : aucun appel d'écriture vers le CRM.
//
// À ces trois sources s'ajoute, en mémoire seulement, la couche des brouillons de l'éditeur de
// mail (PROTOTYPE, cf. MailEditor.jsx) : elle se superpose au contenu d'origine sans jamais le
// modifier, et vit dans le même store pour qu'il n'existe qu'une seule source de vérité.

import { useSyncExternalStore } from 'react';
import apiClient from '../../services/apiClient';
import { SEQUENCE_CATALOG, hasCohortSequence, loadCohortSequence } from '../../data/webinarSequences';
import { MINUTE_MS, fmtDayMonth } from './format.js';
import { parisToday } from '../../utils/parisDates.js';
import { parseKey } from './model.js';

/** @brief Durée de vie d'un relevé de compteurs : au-delà, il est redemandé à la prochaine consultation. */
const STATS_TTL_MS = MINUTE_MS;
/** @brief Après un échec, on ne redemande pas avant ce délai (sauf demande explicite) : pas de martelage du CRM. */
const RETRY_AFTER_ERROR_MS = 10_000;
/** @brief Début de la fenêtre des compteurs d'une cohorte sans `date_start` (même repli que Marketing/index.jsx). */
const STATS_FROM_FALLBACK = '2026-04-01';

/** @brief Dictionnaire vide, figé, sans prototype : valeur de repli partagée de `byKind`. */
const NO_KINDS = Object.freeze(Object.create(null));

let data = {
  api: { status: 'idle', cohorts: [], error: null, failedAt: null }, // idle | loading | ready | error
  content: {}, // cohortId -> { status: loading | ready | missing | error, data, error, reload }
  // cohortId -> { status: loading | ready | unavailable | error, fetchedAt, byKind, summary, error, failedAt }
  //   `fetchedAt` = instant du DERNIER relevé réussi (jamais posé sur un échec) ; `byKind`/`summary` gardent les
  //   chiffres de ce relevé pendant un nouveau relevé ou après un échec (le statut dit s'ils sont à jour).
  //   `unavailable` = la cohorte n'existe pas dans le CRM ; `error` = le CRM n'a pas répondu (réessayable).
  stats: {},
  drafts: {}, // cohortId -> { [kind]: brouillon } — mémoire seulement, jamais envoyé ni enregistré
};
const listeners = new Set();
const inflight = new Map();

function patch(next) {
  data = { ...data, ...next };
  listeners.forEach((l) => l());
}

function subscribeData(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useDataStore(selector) {
  return useSyncExternalStore(subscribeData, () => selector(data), () => selector(data));
}

/**
 * @brief Exécute `fn` une seule fois à la fois pour une même clé (déduplication des appels en vol).
 * @param force Appel explicite (bouton « Actualiser ») : il ne se fond PAS dans l'appel en vol — qui peut avoir
 * démarré avant la demande et ne tient pas compte de `force` — mais repart juste après lui.
 */
function once(key, fn, force = false) {
  const current = inflight.get(key);
  if (current && !force) return current;
  const run = () => Promise.resolve().then(fn);
  const p = (current ? current.catch(() => {}).then(run) : run()).finally(() => {
    if (inflight.get(key) === p) inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

/** @brief Message court et lisible pour une erreur d'appel au CRM (jamais « [object Object] »). */
function describeError(e, fallback) {
  const message = typeof e?.message === 'string' ? e.message.trim() : '';
  if (!message || message === '[object Object]') return fallback;
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return 'connexion impossible';
  return Number.isInteger(e?.status) ? `${message} (${e.status})` : message;
}

// ── Cohortes du CRM ────────────────────────────────────────────────────────────

/** @brief Après un échec de la liste des cohortes, on ne la redemande pas avant ce délai (sauf demande explicite). */
const API_RETRY_MS = 8_000;

export function ensureApiCohorts(force = false) {
  const { status, failedAt } = data.api;
  if (!force) {
    if (status === 'ready') return Promise.resolve();
    if (status === 'loading') return inflight.get('api') ?? Promise.resolve();
    if (status === 'error' && failedAt && Date.now() - failedAt < API_RETRY_MS) return Promise.resolve();
  }
  return once('api', async () => {
    patch({ api: { ...data.api, status: 'loading', error: null } });
    try {
      const json = await apiClient.get('/api/v1/marketing/webinars');
      const list = Array.isArray(json?.webinars) ? json.webinars : Array.isArray(json) ? json : [];
      patch({ api: { status: 'ready', cohorts: list.filter((w) => w && typeof w.id === 'string'), error: null, failedAt: null } });
    } catch (e) {
      patch({ api: { status: 'error', cohorts: data.api.cohorts, error: describeError(e, 'Cohortes du CRM indisponibles'), failedAt: Date.now() } });
    }
  }, force);
}

// ── Contenu des séquences ──────────────────────────────────────────────────────

export function ensureContent(cohortId, force = false) {
  const cur = data.content[cohortId];
  if (!force && cur) {
    // Un échec dû à une mise à jour du site (`reload`) ne se rattrape pas en réessayant : on ne boucle pas dessus.
    if (cur.status !== 'error' || cur.reload) return inflight.get(`content:${cohortId}`) ?? Promise.resolve();
  }
  return once(`content:${cohortId}`, async () => {
    if (!hasCohortSequence(cohortId)) {
      patch({ content: { ...data.content, [cohortId]: { status: 'missing', data: null, error: null, reload: false } } });
      return;
    }
    patch({ content: { ...data.content, [cohortId]: { status: 'loading', data: null, error: null, reload: false } } });
    try {
      const loaded = await loadCohortSequence(cohortId);
      patch({ content: { ...data.content, [cohortId]: { status: 'ready', data: loaded, error: null, reload: false } } });
    } catch (e) {
      const error = e?.name === 'SequenceLoadError' && e.message ? e.message : 'Le contenu des e-mails de cette cohorte est indisponible. Réessayez.';
      patch({ content: { ...data.content, [cohortId]: { status: 'error', data: null, error, reload: Boolean(e?.needsReload) } } });
    }
  }, force);
}

// ── Brouillons de l'éditeur de mail (prototype : en mémoire, rien n'est enregistré) ───────────

const DRAFT_CONTENT_FIELDS = ['subject', 'html', 'text'];

/**
 * @brief Fusionne `fields` dans le brouillon de l'e-mail `key` (créé au besoin).
 * @param fields `{ subject?, html?, text?, snippet?, links? }` ; une valeur `null`/`undefined` retire le champ.
 * Un brouillon qui ne porte plus aucun contenu disparaît : l'e-mail redevient celui d'origine.
 * @note Aucun appel réseau, aucun stockage : les brouillons ne survivent pas à un rechargement de la page.
 */
export function setMailDraft(key, fields) {
  const { cohortId, kind } = parseKey(key);
  if (!cohortId || !kind) return;
  const slice = data.drafts[cohortId] ?? {};
  const merged = { ...(slice[kind] ?? {}) };
  for (const [name, value] of Object.entries(fields)) {
    if (value === null || value === undefined) delete merged[name];
    else merged[name] = value;
  }
  const nextSlice = { ...slice };
  if (DRAFT_CONTENT_FIELDS.some((name) => merged[name] !== undefined)) {
    merged.editedAt = Date.now();
    nextSlice[kind] = merged;
  } else {
    delete nextSlice[kind];
  }
  const drafts = { ...data.drafts };
  if (Object.keys(nextSlice).length) drafts[cohortId] = nextSlice;
  else delete drafts[cohortId];
  patch({ drafts });
}

/** @brief Abandonne le brouillon de `key` : l'e-mail redevient celui d'origine. */
export function resetMailDraft(key) {
  const { cohortId, kind } = parseKey(key);
  const slice = data.drafts[cohortId];
  if (!slice || !slice[kind]) return;
  const nextSlice = { ...slice };
  delete nextSlice[kind];
  const drafts = { ...data.drafts };
  if (Object.keys(nextSlice).length) drafts[cohortId] = nextSlice;
  else delete drafts[cohortId];
  patch({ drafts });
}

/**
 * @brief Marque le brouillon de `key` comme « confirmé » — SIMULATION : seul un horodatage local change.
 * La moindre modification suivante le repasse en « modifications en cours ».
 */
export function confirmMailDraft(key) {
  const { cohortId, kind } = parseKey(key);
  const draft = data.drafts[cohortId]?.[kind];
  if (!draft) return;
  patch({ drafts: { ...data.drafts, [cohortId]: { ...data.drafts[cohortId], [kind]: { ...draft, confirmedAt: Date.now() } } } });
}

// ── Compteurs d'envoi ──────────────────────────────────────────────────────────

const emptyKind = () => ({ sent: 0, pending: 0, failed: 0 });
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

/**
 * @brief Fusionne les réponses `overview` et `post-nurture` en compteurs par type d'e-mail.
 * @note Formes lues (identiques à celles de Marketing/index.jsx et NurtureTable.jsx) :
 *   overview.stats.outbox.byKindStatus  [{ kind, status, count }]
 *   overview.stats.emailEngagement      [{ kind, sent, delivered, opened, clicked, bounced, complained }]
 *   overview.stats.summary              { leadsDb, leadsBySource, unsubscribed }
 *   post-nurture.rows                   [{ kind, sent, pending, failed, opened, clicked, first_pending, last_pending, last_sent }]
 * `byKind` est un dictionnaire SANS prototype : un `kind` venu du serveur ne peut pas écrire dans
 * `Object.prototype` (`__proto__`, `constructor`…).
 */
export function parseStats(overview, nurture) {
  const byKind = Object.create(null);
  const at = (kind) => (byKind[kind] ||= emptyKind());
  const stats = overview?.stats;
  const grouped = stats?.outbox?.byKindStatus;
  if (Array.isArray(grouped)) {
    for (const r of grouped) {
      if (typeof r?.kind !== 'string' || !r.kind) continue;
      const e = at(r.kind);
      if (r.status === 'sent' || r.status === 'pending' || r.status === 'failed') e[r.status] += n(r.count);
    }
  }
  const engagement = stats?.emailEngagement;
  if (Array.isArray(engagement)) {
    for (const r of engagement) {
      if (typeof r?.kind !== 'string' || !r.kind) continue;
      const e = at(r.kind);
      e.delivered = n(r.delivered);
      e.opened = n(r.opened);
      e.clicked = n(r.clicked);
      e.bounced = n(r.bounced);
      e.complained = n(r.complained);
      e.engagementSent = n(r.sent);
    }
  }
  const rows = nurture?.rows;
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (typeof r?.kind !== 'string' || !r.kind) continue;
      Object.assign(at(r.kind), {
        sent: n(r.sent),
        pending: n(r.pending),
        failed: n(r.failed),
        opened: n(r.opened),
        clicked: n(r.clicked),
        firstPending: r.first_pending ?? null,
        lastPending: r.last_pending ?? null,
        lastSent: r.last_sent ?? null,
      });
    }
  }
  const s = stats?.summary;
  const summary = s
    ? {
        leadsDb: typeof s.leadsDb === 'number' ? s.leadsDb : null,
        leadsBySource: s.leadsBySource && typeof s.leadsBySource === 'object' ? s.leadsBySource : null,
        unsubscribed: typeof s.unsubscribed === 'number' ? s.unsubscribed : null,
      }
    : null;
  return { byKind, summary };
}

/**
 * @brief Date du jour à Paris (AAAA-MM-JJ) : la borne haute de la fenêtre des compteurs. En UTC, entre 00 h et 02 h
 * heure de Paris elle tombait sur la VEILLE (le jour qui commence n'était pas inclus).
 */
const todayIso = () => parisToday();

/**
 * @brief Demande (au besoin) les compteurs d'envoi d'une cohorte au CRM.
 * @param force Appel explicite : redemande même si le relevé est frais, après une erreur ou pour une cohorte
 * jusque-là absente du CRM, et ne se fond pas dans un appel en vol.
 * @note Sans `force`, ne fait rien quand : le relevé a moins de 60 s ; la cohorte est absente du CRM et la liste
 * des cohortes n'a pas changé ; un échec date de moins de 10 s. « CRM injoignable » (état `error`) se redemande
 * donc tout seul à la consultation suivante ; « cohorte absente du CRM » (état `unavailable`) ne se confond pas avec lui.
 */
export function ensureStats(cohortId, force = false) {
  return once(`stats:${cohortId}`, async () => {
    await ensureApiCohorts();
    const cur = data.stats[cohortId];
    const cohort = data.api.cohorts.find((c) => c.id === cohortId);
    if (!force && cur) {
      if (cur.status === 'ready' && Date.now() - cur.fetchedAt < STATS_TTL_MS) return;
      if (cur.status === 'unavailable' && !cohort) return;
      if (cur.status === 'error' && Date.now() - (cur.failedAt ?? 0) < RETRY_AFTER_ERROR_MS) return;
    }

    // Du relevé précédent on garde les chiffres et l'instant de SON succès : un échec ne les écrase jamais.
    const kept = { fetchedAt: cur?.fetchedAt ?? null, byKind: cur?.byKind ?? NO_KINDS, summary: cur?.summary ?? null };
    const fail = (error) => patch({ stats: { ...data.stats, [cohortId]: { ...kept, status: 'error', error, failedAt: Date.now() } } });

    if (!cohort) {
      if (data.api.status === 'error') fail('CRM injoignable');
      else patch({ stats: { ...data.stats, [cohortId]: { status: 'unavailable', fetchedAt: null, byKind: NO_KINDS, summary: null, error: 'Cohorte absente du CRM', failedAt: null } } });
      return;
    }
    patch({ stats: { ...data.stats, [cohortId]: { ...kept, status: 'loading', error: null, failedAt: null } } });

    try {
      // Même fenêtre que la vue « Webinaire complet » du dashboard Marketing.
      const from = cohort.date_start || STATS_FROM_FALLBACK;
      const today = todayIso();
      const to = cohort.date_end && cohort.date_end < today ? cohort.date_end : today;
      const id = encodeURIComponent(cohortId);
      const [ov, nu] = await Promise.allSettled([
        apiClient.get(`/api/v1/marketing/webinars/${id}/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        apiClient.get(`/api/v1/marketing/webinars/${id}/campaigns/post-nurture`),
      ]);
      if (ov.status === 'rejected' && nu.status === 'rejected') {
        fail(describeError(ov.reason, describeError(nu.reason, 'Statistiques indisponibles')));
        return;
      }
      const parsed = parseStats(ov.status === 'fulfilled' ? ov.value : null, nu.status === 'fulfilled' ? nu.value : null);
      patch({ stats: { ...data.stats, [cohortId]: { status: 'ready', fetchedAt: Date.now(), ...parsed, error: null, failedAt: null } } });
    } catch {
      // Réponse du CRM d'une forme inattendue : le relevé ne reste jamais « en cours » pour toujours.
      fail('Réponse du CRM illisible');
    }
  }, force);
}

/** @brief Recharge tout ce qui est déjà chargé (cohortes du CRM, compteurs, contenus en erreur). */
export async function reloadAll() {
  await ensureApiCohorts(true);
  const ids = Object.keys(data.stats);
  await Promise.all([
    ...ids.map((id) => ensureStats(id, true)),
    ...Object.entries(data.content)
      .filter(([, c]) => c.status === 'error')
      .map(([id]) => ensureContent(id, true)),
  ]);
}

/**
 * @brief « Réessayer » d'un e-mail ouvert (onglet ou fenêtre) : redemande le contenu en échec, la liste des
 * cohortes si elle est en échec, et les compteurs de sa cohorte.
 */
export async function retryCohort(cohortId) {
  if (data.api.status === 'error') await ensureApiCohorts(true);
  await Promise.all([
    data.content[cohortId]?.status === 'error' ? ensureContent(cohortId, true) : null,
    ensureStats(cohortId, true),
  ]);
}

// ── Dérivations (fonctions pures) ──────────────────────────────────────────────

const ID_DATE_RE = /(\d{4})-(\d{2})-(\d{2})$/;
/** @brief `AAAA-MM-JJ` lu à la fin de l'identifiant d'une cohorte (`webinar-2026-11-10`), ou `null`. */
const dateFromId = (id) => {
  const m = ID_DATE_RE.exec(id);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
/** @brief Libellé court d'une cohorte du CRM seul, dans le même style que le catalogue (« 10 nov. »). */
const shortFromId = (id) => {
  const day = dateFromId(id);
  return (day && fmtDayMonth(`${day}T12:00:00Z`)) || id;
};
/** @brief Jour (`AAAA-MM-JJ`) qui sert à ranger les cohortes de la plus récente à la plus ancienne. */
const sortDay = (c) => (c.liveAt ? String(c.liveAt).slice(0, 10) : dateFromId(c.id) || String(c.dateEnd || c.dateStart || '').slice(0, 10));

/** @brief Résultat de `deriveCohorts` par objet `api` : tous les appelants d'un même état reçoivent le MÊME tableau. */
const cohortsCache = new WeakMap();

/**
 * @brief Cohortes affichées : celles du catalogue (contenu disponible) ∪ celles du CRM.
 * @note Une cohorte du CRM sans contenu local reste visible : ses compteurs, eux, existent. Sa date de live n'est
 * PAS connue (le CRM ne l'expose pas) : `liveAt` vaut `null` — rien n'est deviné (ni l'heure, ni le décalage horaire).
 * @returns Un tableau PARTAGÉ (mémoïsé par état `api`) : ne pas le modifier.
 */
export function deriveCohorts(api) {
  let cohorts = cohortsCache.get(api);
  if (!cohorts) {
    cohorts = buildCohorts(api);
    cohortsCache.set(api, cohorts);
  }
  return cohorts;
}

function buildCohorts(api) {
  const map = new Map();
  for (const c of SEQUENCE_CATALOG) {
    map.set(c.id, { ...c, inCatalog: true, inApi: false, apiTitle: null, dateStart: null, dateEnd: null });
  }
  for (const w of api.cohorts) {
    const cur = map.get(w.id);
    const apiTitle = typeof w.title === 'string' && w.title ? w.title : null;
    if (cur) {
      map.set(w.id, { ...cur, inApi: true, apiTitle, dateStart: w.date_start || null, dateEnd: w.date_end || null });
    } else {
      map.set(w.id, {
        id: w.id,
        label: apiTitle || w.id,
        short: shortFromId(w.id),
        audience: null,
        liveAt: null,
        speakers: [],
        pages: [],
        notes: [],
        codeEra: null,
        stepCount: null,
        inCatalog: false,
        inApi: true,
        apiTitle,
        dateStart: w.date_start || null,
        dateEnd: w.date_end || null,
      });
    }
  }
  return [...map.values()].sort((a, b) => sortDay(b).localeCompare(sortDay(a)) || b.id.localeCompare(a.id));
}
