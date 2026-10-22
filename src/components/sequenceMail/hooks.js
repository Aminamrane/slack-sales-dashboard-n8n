// src/components/sequenceMail/hooks.js
//
// Hooks du mini client e-mail : mesure d'élément, horloge partagée, geste de glisser, et accès aux
// données dérivées (liste d'e-mails d'une cohorte, détail d'un e-mail).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  deriveCohorts,
  ensureApiCohorts,
  ensureContent,
  ensureStats,
  reloadAll,
  useDataStore,
} from './dataStore.js';
import { MINUTE_MS, normalize } from './format.js';
import { draftedSteps } from './mailDraft';
import { PHASES, SEQUENCES, emailKey, fallbackStep, neighborsOf, parseKey, reuseStable, stepStatus } from './model.js';

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

// ── Horloge partagée ───────────────────────────────────────────────────────────
// Les statuts « à venir » changent avec l'heure : un tic par minute. UNE seule horloge pour toute l'interface
// (et non un `setInterval` par lecteur ou par fenêtre flottante), mise en pause quand la page est masquée.

let clockNow = Date.now();
const clockListeners = new Set();
let clockTimer = null;

function clockTick() {
  clockNow = Date.now();
  clockListeners.forEach((l) => l());
}
function clockStart() {
  if (clockTimer === null && !document.hidden) clockTimer = setInterval(clockTick, MINUTE_MS);
}
function clockStop() {
  if (clockTimer !== null) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}
function onClockVisibility() {
  if (document.hidden) {
    clockStop();
  } else {
    clockTick(); // l'heure a pu avancer pendant la pause
    clockStart();
  }
}
function subscribeClock(listener) {
  clockListeners.add(listener);
  if (clockListeners.size === 1) {
    document.addEventListener('visibilitychange', onClockVisibility);
    if (Date.now() - clockNow >= MINUTE_MS) clockTick();
    clockStart();
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      document.removeEventListener('visibilitychange', onClockVisibility);
      clockStop();
    }
  };
}

/** @brief Instant courant (ms), rafraîchi une fois par minute tant que la page est visible. */
function useNow() {
  return useSyncExternalStore(subscribeClock, () => clockNow, () => clockNow);
}

// ── Gestes ─────────────────────────────────────────────────────────────────────

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

/**
 * @brief Geste de glisser au pointeur (déplacer une fenêtre, tirer un séparateur, redimensionner) avec un
 * nettoyage GARANTI : relâchement, annulation, perte de la capture du pointeur (élément retiré, fenêtre qui
 * perd le focus) ou démontage du composant en plein geste terminent tous le geste. Le mode `smx-dragging`
 * (curseur forcé, iframes insensibles) n'est donc jamais laissé en place.
 * @returns `start(event, { cursor, onMove, onEnd })` à appeler dans un `onPointerDown` :
 *  - `onMove(ev)` à chaque déplacement du pointeur ;
 *  - `onEnd(ev, completed)` une seule fois : `completed` vaut `false` quand le composant a été démonté en
 *    plein geste (`ev` vaut alors `null`) — il n'y a plus rien à valider.
 */
export function useDragGesture() {
  const stopRef = useRef(null);
  // Démontage en plein geste : on termine proprement, sans valider.
  useEffect(() => () => stopRef.current?.(false), []);
  return useCallback((e, { cursor, onMove, onEnd }) => {
    stopRef.current?.(false);
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    el.setPointerCapture?.(pointerId);
    const endMode = beginDragMode(cursor);
    let done = false;
    const move = (ev) => onMove(ev);
    const finish = (ev, completed) => {
      if (done) return;
      done = true;
      stopRef.current = null;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('lostpointercapture', up);
      try {
        el.releasePointerCapture?.(pointerId);
      } catch {
        /* capture déjà relâchée */
      }
      endMode();
      onEnd?.(ev, completed);
    };
    function up(ev) {
      finish(ev, true);
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    stopRef.current = (completed = false) => finish(null, completed);
  }, []);
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

/** @brief Compteurs « en cours de demande » : une cohorte dont les compteurs vont être demandés n'est pas « non relevée ». */
const NO_KINDS = Object.freeze(Object.create(null));
const PENDING_STATS = Object.freeze({ status: 'loading', fetchedAt: null, byKind: NO_KINDS, summary: null, error: null });
const NO_EMAILS = Object.freeze([]);

/**
 * @brief Étapes d'une cohorte sous forme d'objets « e-mail » prêts pour la liste.
 * @note Sans contenu local mais avec des compteurs du CRM, on liste les types d'e-mails connus
 * du CRM (nom technique) plutôt que de cacher des envois réels : ces e-mails sont marqués `fallback: true`.
 */
function deriveEmails(cohort, contentEntry, statsEntry, nowMs, cohortDrafts) {
  if (contentEntry?.status === 'ready' && contentEntry.data) {
    // Brouillons de l'éditeur de mail superposés au contenu d'origine (cf. mailDraft.js) : liste,
    // onglets et schéma lisent ainsi la version en cours d'édition, sans autre source de vérité.
    return draftedSteps(contentEntry.data.steps, cohortDrafts).map((step) => ({
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
      draftStatus: step.draftStatus ?? null,
      stats: statsEntry?.byKind?.[step.kind] ?? null,
      status: stepStatus(step, statsEntry, nowMs),
      searchText: searchTextOf(cohort, step),
    }));
  }
  // Les derniers chiffres connus suffisent à lister les types d'e-mails, même pendant un nouveau relevé.
  if (statsEntry && Number.isFinite(statsEntry.fetchedAt)) {
    const kinds = Object.keys(statsEntry.byKind).sort();
    return kinds.map((kind, i) => {
      const step = fallbackStep(kind, i, kinds.length);
      return {
        key: emailKey(cohort.id, kind),
        cohortId: cohort.id,
        cohortShort: cohort.short,
        kind,
        order: step.order,
        sequence: step.sequence,
        sequenceIndex: step.sequenceIndex,
        sequenceCount: step.sequenceCount,
        phase: step.phase,
        segment: step.segment,
        subject: step.subject,
        snippet: step.snippet,
        timing: step.timing,
        hasContent: false,
        fallback: true,
        stats: statsEntry.byKind[kind],
        status: stepStatus(step, statsEntry, nowMs),
        searchText: normalize(`${kind} ${cohort.label}`),
      };
    });
  }
  return NO_EMAILS;
}

/**
 * @brief Les e-mails d'UNE cohorte, mémoïsés par cohorte : tant que son contenu, ses compteurs, ses brouillons
 * et sa fiche n'ont pas changé, le MÊME tableau revient ; quand l'un d'eux change (tic d'horloge compris), les
 * e-mails qui n'ont en fait pas bougé gardent leur identité (lignes `memo` de la liste intactes).
 */
const derivedCache = new Map();
function emailsOfCohort(cohort, contentEntry, statsEntry, cohortDrafts, nowMs) {
  const hit = derivedCache.get(cohort.id);
  if (
    hit && hit.cohort === cohort && hit.content === contentEntry && hit.stats === statsEntry
    && hit.drafts === cohortDrafts && hit.nowMs === nowMs
  ) {
    return hit.value;
  }
  const value = reuseStable(hit?.value, deriveEmails(cohort, contentEntry, statsEntry, nowMs, cohortDrafts));
  derivedCache.set(cohort.id, { cohort, content: contentEntry, stats: statsEntry, drafts: cohortDrafts, nowMs, value });
  return value;
}

/** @brief Même contenu (élément par élément) que l'appel précédent : renvoie la valeur déjà calculée. */
function useStableBy(items, compute) {
  const ref = useRef(null);
  const prev = ref.current;
  if (!prev || prev.items.length !== items.length || items.some((item, i) => item !== prev.items[i])) {
    ref.current = { items, value: compute(items) };
  }
  return ref.current.value;
}

/**
 * @brief Cohortes, e-mails de la portée courante et état de chargement.
 * @param cohortId `'all'` ou l'identifiant d'une cohorte.
 * @param openKeys Clés des e-mails ouverts (onglets/fenêtres) : leur cohorte est chargée même hors portée.
 * @returns `{ cohorts, api, emails, emailByKey, loadingContent, contentError, contentNeedsReload, refreshing, refresh }`.
 */
export function useSequenceMail({ cohortId, openKeys }) {
  const api = useDataStore((d) => d.api);
  const content = useDataStore((d) => d.content);
  const stats = useDataStore((d) => d.stats);
  const drafts = useDataStore((d) => d.drafts);
  const nowMs = useNow();
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
  // `ensureStats` attend lui-même la liste des cohortes du CRM et ne redemande rien de frais : pas besoin de
  // réagir aux changements de `api.status`.
  useEffect(() => {
    for (const id of statsKey ? statsKey.split('|') : []) void ensureStats(id);
  }, [statsKey]);

  // Une cohorte dont les compteurs vont être demandés est « en cours de relevé », pas « non relevée ».
  const wantedStats = useMemo(() => new Set(statsKey ? statsKey.split('|') : []), [statsKey]);

  // Seules les cohortes de la portée ou ouvertes sont dérivées ; chacune est mémoïsée à part.
  const byCohort = useMemo(() => {
    const map = new Map();
    for (const c of cohorts) {
      if (!contentIds.includes(c.id)) continue;
      const entry = stats[c.id] ?? (wantedStats.has(c.id) ? PENDING_STATS : undefined);
      map.set(c.id, emailsOfCohort(c, content[c.id], entry, drafts[c.id], nowMs));
    }
    return map;
  }, [cohorts, contentIds, content, stats, drafts, nowMs, wantedStats]);

  const emails = useStableBy(
    scopeIds.map((id) => byCohort.get(id) ?? NO_EMAILS),
    (lists) => lists.flat()
  );
  const emailByKey = useStableBy([...byCohort.values()], (lists) => {
    const map = new Map();
    for (const list of lists) for (const e of list) map.set(e.key, e);
    return map;
  });

  const scopeContent = scopeIds.map((id) => content[id]);
  const loadingContent = scopeContent.some((c) => !c || c.status === 'loading');
  const failedContent = scopeContent.find((c) => c?.status === 'error');
  const refreshing = api.status === 'loading' || Object.values(stats).some((s) => s.status === 'loading');

  const refresh = useCallback(() => reloadAll(), []);

  return {
    cohorts,
    api,
    emails,
    emailByKey,
    loadingContent,
    contentError: failedContent?.error ?? null,
    contentNeedsReload: Boolean(failedContent?.reload),
    refreshing,
    refresh,
  };
}

/**
 * @brief Détail complet d'un e-mail (corps, en-têtes, voisins, compteurs), chargé à la demande.
 * @returns `state` : `loading` | `ready` | `missing` (cohorte ou étape introuvable) | `error` (avec `needsReload`
 * quand seul un rechargement de la page peut aider). `noContent` + `step.fallback` : e-mail connu du seul CRM.
 */
export function useEmailDetail(key) {
  const { cohortId, kind } = parseKey(key);
  const api = useDataStore((d) => d.api);
  const contentEntry = useDataStore((d) => d.content[cohortId]);
  const statsEntry = useDataStore((d) => d.stats[cohortId]);
  // Brouillons de la seule cohorte de cet e-mail : modifier un autre e-mail ne re-rend pas celui-ci.
  const cohortDrafts = useDataStore((d) => d.drafts[cohortId]);
  const nowMs = useNow();

  useEffect(() => {
    if (!cohortId) return;
    void ensureContent(cohortId);
    // Sans effet quand le relevé a moins d'une minute : changer d'onglet ne relance pas le CRM.
    void ensureStats(cohortId);
  }, [cohortId]);

  const cohorts = useMemo(() => deriveCohorts(api), [api]);
  const cohort = useMemo(() => cohorts.find((c) => c.id === cohortId) ?? null, [cohorts, cohortId]);

  return useMemo(() => {
    const base = { key, cohortId, kind, cohort, stats: statsEntry ?? null };
    if (!contentEntry || contentEntry.status === 'loading') return { ...base, state: 'loading' };
    if (contentEntry.status === 'error') {
      return { ...base, state: 'error', error: contentEntry.error, needsReload: Boolean(contentEntry.reload) };
    }
    // Les compteurs de cette cohorte ont été demandés à l'ouverture de l'e-mail : tant qu'ils n'ont pas répondu.
    const stats = statsEntry ?? PENDING_STATS;
    if (contentEntry.status === 'missing' || !contentEntry.data) {
      // Cohorte du CRM seul : l'e-mail n'existe que par ses compteurs. « Introuvable » n'est dit qu'une fois le
      // CRM interrogé — jamais pendant que la réponse est en route.
      const hasData = Number.isFinite(stats.fetchedAt);
      if (stats.status === 'loading' && !hasData) return { ...base, state: 'loading' };
      if (stats.status === 'error' && !hasData) {
        return { ...base, state: 'error', error: `Compteurs du CRM indisponibles (${stats.error}) : impossible de retrouver cet e-mail.`, needsReload: false };
      }
      const kinds = Object.keys(stats.byKind ?? NO_KINDS).sort();
      const index = kinds.indexOf(kind);
      if (index < 0) return { ...base, state: 'missing', noContent: true };
      const step = fallbackStep(kind, index, kinds.length);
      return {
        ...base,
        state: 'ready',
        noContent: true,
        step,
        steps: [],
        sequences: {},
        kindStats: stats.byKind[kind],
        status: stepStatus(step, stats, nowMs),
      };
    }
    const { sequences, rules } = contentEntry.data;
    // Les voisins (« Précédent »/« Suivant ») portent aussi leurs brouillons : leurs objets changent avec eux.
    const steps = draftedSteps(contentEntry.data.steps, cohortDrafts);
    const index = steps.findIndex((s) => s.kind === kind);
    if (index < 0) return { ...base, state: 'missing' };
    const step = steps[index];
    const seqNb = neighborsOf(steps, step);
    return {
      ...base,
      state: 'ready',
      step,
      // Pour l'éditeur : l'étape d'origine (sans brouillon) et le brouillon lui-même.
      originalStep: contentEntry.data.steps[index],
      draft: cohortDrafts?.[kind] ?? null,
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
      status: stepStatus(step, stats, nowMs),
      meta: contentEntry.data.cohort,
      generatedAt: contentEntry.data.generatedAt,
    };
  }, [key, cohortId, kind, cohort, statsEntry, contentEntry, cohortDrafts, nowMs]);
}
