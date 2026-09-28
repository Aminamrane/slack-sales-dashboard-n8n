// src/components/sequenceMail/dataStore.js
//
// Données du mini client e-mail. Trois sources, chacune réelle :
//   1. le catalogue + le contenu des séquences (src/data/webinarSequences, généré depuis le
//      code de la landing — l'API du CRM n'expose pas les objets ni les corps d'e-mails) ;
//   2. la liste des cohortes du CRM        GET /api/v1/marketing/webinars ;
//   3. les compteurs d'envoi par cohorte   GET …/webinars/{id}/overview et …/campaigns/post-nurture
//      (les mêmes appels que le dashboard Marketing, mêmes formes de réponse).
// Le contenu est chargé à la demande, cohorte par cohorte ; les compteurs sont mis en cache 60 s.

import { useSyncExternalStore } from 'react';
import apiClient from '../../services/apiClient';
import { SEQUENCE_CATALOG, hasCohortSequence, loadCohortSequence } from '../../data/webinarSequences';

const STATS_TTL_MS = 60_000;

let data = {
  api: { status: 'idle', cohorts: [], error: null }, // idle | loading | ready | error
  content: {}, // cohortId -> { status: loading | ready | missing | error, data, error }
  stats: {}, // cohortId -> { status: loading | ready | unavailable | error, fetchedAt, byKind, summary, error }
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

/** @brief Exécute `fn` une seule fois à la fois pour une même clé (déduplication des appels en vol). */
function once(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.resolve()
    .then(fn)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ── Cohortes du CRM ────────────────────────────────────────────────────────────

export function ensureApiCohorts(force = false) {
  if (!force && (data.api.status === 'ready' || data.api.status === 'loading')) return inflight.get('api') ?? Promise.resolve();
  return once('api', async () => {
    patch({ api: { ...data.api, status: 'loading', error: null } });
    try {
      const json = await apiClient.get('/api/v1/marketing/webinars');
      const list = Array.isArray(json?.webinars) ? json.webinars : Array.isArray(json) ? json : [];
      patch({ api: { status: 'ready', cohorts: list.filter((w) => w && typeof w.id === 'string'), error: null } });
    } catch (e) {
      patch({ api: { status: 'error', cohorts: data.api.cohorts, error: e?.message || 'Cohortes du CRM indisponibles' } });
    }
  });
}

// ── Contenu des séquences ──────────────────────────────────────────────────────

export function ensureContent(cohortId, force = false) {
  const cur = data.content[cohortId];
  if (!force && cur && cur.status !== 'error') return inflight.get(`content:${cohortId}`) ?? Promise.resolve();
  return once(`content:${cohortId}`, async () => {
    if (!hasCohortSequence(cohortId)) {
      patch({ content: { ...data.content, [cohortId]: { status: 'missing', data: null, error: null } } });
      return;
    }
    patch({ content: { ...data.content, [cohortId]: { status: 'loading', data: null, error: null } } });
    try {
      const loaded = await loadCohortSequence(cohortId);
      patch({ content: { ...data.content, [cohortId]: { status: 'ready', data: loaded, error: null } } });
    } catch (e) {
      patch({ content: { ...data.content, [cohortId]: { status: 'error', data: null, error: e?.message || 'Contenu indisponible' } } });
    }
  });
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
 */
function parseStats(overview, nurture) {
  const byKind = {};
  const at = (kind) => (byKind[kind] ||= emptyKind());
  const stats = overview?.stats;
  const grouped = stats?.outbox?.byKindStatus;
  if (Array.isArray(grouped)) {
    for (const r of grouped) {
      if (!r?.kind) continue;
      const e = at(r.kind);
      if (r.status === 'sent' || r.status === 'pending' || r.status === 'failed') e[r.status] += n(r.count);
    }
  }
  const engagement = stats?.emailEngagement;
  if (Array.isArray(engagement)) {
    for (const r of engagement) {
      if (!r?.kind) continue;
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
      if (!r?.kind) continue;
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

const todayIso = () => new Date().toISOString().slice(0, 10);

export function ensureStats(cohortId, force = false) {
  return once(`stats:${cohortId}`, async () => {
    await ensureApiCohorts();
    const cur = data.stats[cohortId];
    const fresh = cur?.status === 'ready' && Date.now() - cur.fetchedAt < STATS_TTL_MS;
    if (!force && (fresh || cur?.status === 'unavailable')) return;

    const cohort = data.api.cohorts.find((c) => c.id === cohortId);
    if (!cohort) {
      const reason = data.api.status === 'error' ? 'CRM injoignable' : 'Cohorte absente du CRM';
      patch({ stats: { ...data.stats, [cohortId]: { status: 'unavailable', fetchedAt: Date.now(), byKind: {}, summary: null, error: reason } } });
      return;
    }
    patch({ stats: { ...data.stats, [cohortId]: { ...(cur || {}), status: 'loading', byKind: cur?.byKind || {}, error: null } } });

    // Même fenêtre que la vue « Webinaire complet » du dashboard Marketing.
    const from = cohort.date_start || '2026-04-01';
    const today = todayIso();
    const to = cohort.date_end && cohort.date_end < today ? cohort.date_end : today;
    const id = encodeURIComponent(cohortId);
    const [ov, nu] = await Promise.allSettled([
      apiClient.get(`/api/v1/marketing/webinars/${id}/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      apiClient.get(`/api/v1/marketing/webinars/${id}/campaigns/post-nurture`),
    ]);
    if (ov.status === 'rejected' && nu.status === 'rejected') {
      const msg = ov.reason?.message || nu.reason?.message || 'Statistiques indisponibles';
      patch({ stats: { ...data.stats, [cohortId]: { status: 'error', fetchedAt: Date.now(), byKind: cur?.byKind || {}, summary: cur?.summary || null, error: msg } } });
      return;
    }
    const parsed = parseStats(ov.status === 'fulfilled' ? ov.value : null, nu.status === 'fulfilled' ? nu.value : null);
    patch({ stats: { ...data.stats, [cohortId]: { status: 'ready', fetchedAt: Date.now(), ...parsed, error: null } } });
  });
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

// ── Dérivations (fonctions pures) ──────────────────────────────────────────────

const liveFromId = (id) => {
  const m = /(\d{4})-(\d{2})-(\d{2})$/.exec(id);
  return m ? `${m[1]}-${m[2]}-${m[3]}T20:00:00+02:00` : null;
};
const shortFromId = (id) => {
  const m = /(\d{4})-(\d{2})-(\d{2})$/.exec(id);
  return m ? `${m[3]}/${m[2]}` : id;
};

/**
 * @brief Cohortes affichées : celles du catalogue (contenu disponible) ∪ celles du CRM.
 * @note Une cohorte du CRM sans contenu local reste visible : ses compteurs, eux, existent.
 */
export function deriveCohorts(api) {
  const map = new Map();
  for (const c of SEQUENCE_CATALOG) {
    map.set(c.id, { ...c, inCatalog: true, inApi: false, apiTitle: null, dateStart: null, dateEnd: null });
  }
  for (const w of api.cohorts) {
    const cur = map.get(w.id);
    if (cur) {
      map.set(w.id, { ...cur, inApi: true, apiTitle: w.title || null, dateStart: w.date_start || null, dateEnd: w.date_end || null });
    } else {
      map.set(w.id, {
        id: w.id,
        label: w.title || w.id,
        short: shortFromId(w.id),
        audience: null,
        liveAt: liveFromId(w.id),
        speakers: [],
        pages: [],
        notes: [],
        codeEra: null,
        stepCount: null,
        inCatalog: false,
        inApi: true,
        apiTitle: w.title || null,
        dateStart: w.date_start || null,
        dateEnd: w.date_end || null,
      });
    }
  }
  return [...map.values()].sort((a, b) => String(b.liveAt || b.id).localeCompare(String(a.liveAt || a.id)));
}
