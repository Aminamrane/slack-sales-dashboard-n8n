// src/components/sequenceMail/hooks.js
//
// Hooks du mini client e-mail : mesure d'élément, horloge, et accès aux données dérivées
// (liste d'e-mails d'une cohorte, détail d'un e-mail).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  deriveCohorts,
  ensureApiCohorts,
  ensureContent,
  ensureStats,
  reloadAll,
  useDataStore,
} from './dataStore';
import { normalize } from './format';
import { PHASES, SEQUENCES, emailKey, neighborsOf, parseKey, stepStatus } from './model';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** @brief Dernière valeur d'une variable, lisible depuis un gestionnaire d'événement sans le recréer. */
export function useLatest(value) {
  const ref = useRef(value);
  useIsoLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** @brief Taille (contenu) d'un élément, mise à jour par ResizeObserver, au plus une fois par image. */
export function useElementSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(() => {
      if (!raf) raf = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
  return size;
}

/** @brief Instant courant, rafraîchi périodiquement (les statuts « à venir » changent avec l'heure). */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * @brief Active `smx-dragging` sur <html> pendant un geste (drag, redimensionnement) : les iframes
 * cessent de capter la souris et le curseur reste celui du geste même hors de la poignée.
 * @returns Fonction qui termine le mode.
 */
export function beginDragMode(cursor) {
  const root = document.documentElement;
  root.classList.add('smx-dragging');
  root.style.setProperty('--smx-drag-cursor', cursor);
  const end = () => {
    root.classList.remove('smx-dragging');
    root.style.removeProperty('--smx-drag-cursor');
    window.removeEventListener('blur', end);
  };
  // Filet de sécurité : si la fenêtre du navigateur perd le focus en plein geste (Alt+Tab), le
  // relâchement peut ne jamais arriver ; sans cela le curseur et les iframes resteraient bloqués.
  window.addEventListener('blur', end);
  return end;
}

// ── Dérivation des e-mails ─────────────────────────────────────────────────────

const searchCache = new WeakMap();

/** @brief Texte de recherche d'une étape (objet, aperçu, corps, cohorte…), normalisé une seule fois. */
function searchTextOf(cohort, step) {
  let cached = searchCache.get(step);
  if (!cached) {
    cached = normalize(
      [
        step.subject,
        step.preheader,
        step.text,
        step.kind,
        PHASES[step.phase]?.label,
        SEQUENCES[step.sequence]?.label,
        cohort.label,
        cohort.short,
        cohort.audience,
      ].join(' \n ')
    );
    searchCache.set(step, cached);
  }
  return cached;
}

/**
 * @brief Étapes d'une cohorte sous forme d'objets « e-mail » prêts pour la liste.
 * @note Sans contenu local mais avec des compteurs du CRM, on liste les types d'e-mails connus
 * du CRM (nom technique) plutôt que de cacher des envois réels.
 */
function deriveEmails(cohort, contentEntry, statsEntry, nowMs) {
  if (contentEntry?.status === 'ready' && contentEntry.data) {
    return contentEntry.data.steps.map((step) => ({
      key: emailKey(cohort.id, step.kind),
      cohortId: cohort.id,
      cohortShort: cohort.short,
      kind: step.kind,
      order: step.order,
      sequence: step.sequence,
      sequenceIndex: step.sequenceIndex,
      sequenceCount: step.sequenceCount,
      phase: step.phase,
      segment: step.segment || null,
      subject: step.subject || '',
      snippet: step.snippet || '',
      timing: step.timing,
      hasContent: Boolean(step.html || step.text),
      stats: statsEntry?.byKind?.[step.kind] ?? null,
      status: stepStatus(step, statsEntry, nowMs),
      searchText: searchTextOf(cohort, step),
    }));
  }
  if (statsEntry?.status === 'ready') {
    return Object.keys(statsEntry.byKind || {})
      .sort()
      .map((kind, i) => ({
        key: emailKey(cohort.id, kind),
        cohortId: cohort.id,
        cohortShort: cohort.short,
        kind,
        order: i + 1,
        sequence: 'pre',
        sequenceIndex: i + 1,
        sequenceCount: Object.keys(statsEntry.byKind).length,
        phase: kind.includes('post') ? 'post' : 'nurture',
        segment: null,
        subject: '',
        snippet: '',
        timing: { mode: 'unknown' },
        hasContent: false,
        stats: statsEntry.byKind[kind],
        status: stepStatus({ kind, timing: {} }, statsEntry, nowMs),
        searchText: normalize(`${kind} ${cohort.label}`),
      }));
  }
  return [];
}

/**
 * @brief Cohortes, e-mails de la portée courante et état de chargement.
 * @param cohortId `'all'` ou l'identifiant d'une cohorte.
 * @param openKeys Clés des e-mails ouverts (onglets/fenêtres) : leur cohorte est chargée même hors portée.
 */
export function useSequenceMail({ cohortId, openKeys }) {
  const api = useDataStore((d) => d.api);
  const content = useDataStore((d) => d.content);
  const stats = useDataStore((d) => d.stats);
  const nowMs = useNow(60_000);
  const cohorts = useMemo(() => deriveCohorts(api), [api]);

  useEffect(() => {
    void ensureApiCohorts();
  }, []);

  const openCohortIds = useMemo(() => [...new Set(openKeys.map((k) => parseKey(k).cohortId).filter(Boolean))].sort(), [openKeys]);
  const scopeIds = useMemo(() => (cohortId === 'all' ? cohorts.map((c) => c.id) : [cohortId]), [cohortId, cohorts]);
  const contentIds = useMemo(() => [...new Set([...scopeIds, ...openCohortIds])], [scopeIds, openCohortIds]);
  // Les compteurs ne sont demandés que pour une cohorte précisément consultée : la vue « toutes »
  // ne déclenche pas six appels lourds (overview agrège Plausible et la base de la landing).
  const statsIds = useMemo(() => [...new Set([...(cohortId === 'all' ? [] : [cohortId]), ...openCohortIds])], [cohortId, openCohortIds]);

  const contentKey = contentIds.join('|');
  const statsKey = statsIds.join('|');
  useEffect(() => {
    for (const id of contentKey ? contentKey.split('|') : []) void ensureContent(id);
  }, [contentKey]);
  useEffect(() => {
    for (const id of statsKey ? statsKey.split('|') : []) void ensureStats(id);
  }, [statsKey, api.status]);

  const byCohort = useMemo(() => {
    const map = new Map();
    for (const c of cohorts) map.set(c.id, deriveEmails(c, content[c.id], stats[c.id], nowMs));
    return map;
  }, [cohorts, content, stats, nowMs]);

  const emails = useMemo(() => scopeIds.flatMap((id) => byCohort.get(id) || []), [scopeIds, byCohort]);
  const emailByKey = useMemo(() => {
    const map = new Map();
    for (const list of byCohort.values()) for (const e of list) map.set(e.key, e);
    return map;
  }, [byCohort]);

  const scopeContent = scopeIds.map((id) => content[id]);
  const loadingContent = scopeContent.some((c) => !c || c.status === 'loading');
  const failedContent = scopeContent.filter((c) => c?.status === 'error');
  const refreshing = api.status === 'loading' || Object.values(stats).some((s) => s.status === 'loading');

  const refresh = useCallback(() => reloadAll(), []);

  return {
    cohorts,
    api,
    emails,
    emailByKey,
    stats,
    loadingContent,
    contentError: failedContent[0]?.error ?? null,
    refreshing,
    refresh,
  };
}

/**
 * @brief Détail complet d'un e-mail (corps, en-têtes, voisins, compteurs), chargé à la demande.
 * @returns `state` : `loading` | `ready` | `missing` (cohorte ou étape introuvable) | `error`.
 */
export function useEmailDetail(key) {
  const { cohortId, kind } = parseKey(key);
  const api = useDataStore((d) => d.api);
  const contentEntry = useDataStore((d) => d.content[cohortId]);
  const statsEntry = useDataStore((d) => d.stats[cohortId]);
  const nowMs = useNow(60_000);

  useEffect(() => {
    if (!cohortId) return;
    void ensureContent(cohortId);
    void ensureStats(cohortId);
  }, [cohortId]);

  const cohorts = useMemo(() => deriveCohorts(api), [api]);
  const cohort = useMemo(() => cohorts.find((c) => c.id === cohortId) ?? null, [cohorts, cohortId]);

  return useMemo(() => {
    const base = { key, cohortId, kind, cohort, stats: statsEntry ?? null };
    if (!cohort && api.status !== 'ready' && !contentEntry) return { ...base, state: 'loading' };
    if (!contentEntry || contentEntry.status === 'loading') return { ...base, state: 'loading' };
    if (contentEntry.status === 'error') return { ...base, state: 'error', error: contentEntry.error };
    if (contentEntry.status === 'missing' || !contentEntry.data) {
      const kindStats = statsEntry?.byKind?.[kind] ?? null;
      return {
        ...base,
        state: kindStats ? 'ready' : 'missing',
        noContent: true,
        step: kindStats ? { kind, subject: '', timing: { mode: 'unknown' }, conditions: [], tags: [], headers: [], attachments: [], links: [], text: '', order: 0, sequence: 'pre', phase: 'nurture' } : null,
        steps: [],
        sequences: {},
        kindStats,
        status: stepStatus({ kind, timing: {} }, statsEntry, nowMs),
      };
    }
    const { steps, sequences, rules } = contentEntry.data;
    const index = steps.findIndex((s) => s.kind === kind);
    if (index < 0) return { ...base, state: 'missing' };
    const step = steps[index];
    const seqNb = neighborsOf(steps, step);
    return {
      ...base,
      state: 'ready',
      step,
      steps,
      index,
      total: steps.length,
      sequences,
      rules: rules || [],
      sequenceMeta: sequences?.[step.sequence] ?? null,
      prev: index > 0 ? steps[index - 1] : null,
      next: index < steps.length - 1 ? steps[index + 1] : null,
      seqPrev: seqNb.prev,
      seqNext: seqNb.next,
      kindStats: statsEntry?.byKind?.[kind] ?? null,
      status: stepStatus(step, statsEntry, nowMs),
      meta: contentEntry.data.cohort,
      generatedAt: contentEntry.data.generatedAt,
    };
  }, [key, cohortId, kind, cohort, statsEntry, contentEntry, api.status, nowMs]);
}
