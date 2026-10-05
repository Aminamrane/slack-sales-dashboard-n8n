// Onglet « Pilotage setting » de la tracking sheet setter (demande dev 01/10/2026, pour Jonathan
// Mangono, manager des setters). Remplace « Équipe setters » : la feuille « PILOTAGE SETTING, SAISIE
// RAPIDE » en ligne. Chaque jour, une ligne par setter avec les chiffres calculés (appels Allo,
// répondus, RDV pris, honorés, no-show, R2 si la période en contient, temps au téléphone) et trois
// cellules jaunes saisies par le manager : discours (1 à 5), blocage principal, action de coaching.
//
// Mode « Jour » : la feuille du jour, cellules jaunes modifiables (manager des setters et admin).
// Mode période (mois en cours, mois dernier, plage de 31 jours) : une ligne par setter, cliquable
// pour le détail jour par jour, saisies en lecture.
//
// Enregistrement automatique quand on quitte la cellule (au choix pour la note). Les envois d'une
// même ligne partent l'un après l'autre, portent la dernière saisie et seulement les champs modifiés ;
// une saisie non enregistrée reste dans la cellule et dans ce navigateur jusqu'à ce qu'elle passe
// (effacée à la déconnexion).
// Logique pure et règles : src/utils/setterPilotage.js (testée).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck, CalendarPlus, CalendarX, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock, LoaderCircle,
  PencilLine, Phone, PhoneCall, RefreshCw, Timer,
} from 'lucide-react';
import apiClient, { USER_DRAFTS_PREFIX } from '../../services/apiClient';
import { Card, ProspectionStyles } from './prospection/ui.jsx';
import { fmtInt } from './prospection/format.js';
import { errorMessage } from './prospection/prospectionApi.js';
import {
  ACTION_MAX, ALLO_LABELS, BLOCAGE_MAX, COLUMN_LABELS, DISCOURS_SCORES, MANUAL_COLUMNS, PERIOD_MODES,
  blocageChoices, columnsFor, effectiveReview, fmtAverage, fmtDayShort, fmtPeriod, fmtScore, fmtTalk,
  mergeSavedReview, newestFirst, notedDays, parisToday, pruneDraft, resolvePeriod, reviewKey, reviewPayload,
  reviewTooltip, sameReview, shiftDay, shouldShowR2, sortSetters, teamTotals, topBlocage,
} from '../../utils/setterPilotage.js';

const API = '/api/v1/tracking/setter-team/pilotage';

// Saisies non enregistrées, gardées dans ce navigateur pour l'utilisateur connecté (rechargement,
// changement d'onglet, session expirée). apiClient.logout() efface tout le préfixe.
// En-têtes des statistiques : une icône, le libellé complet au survol (gain de place, tout sur une ligne).
const METRIC_ICONS = {
  calls: Phone, answered: PhoneCall, r1: CalendarPlus, held: CalendarCheck, no_show: CalendarX, r2: CalendarPlus,
  duration: Clock, average: Timer,
};
const SHORT_LABELS = { discours: 'Discours' };
const METRIC_WIDTH = 66;

const draftsStorageKey = () => {
  const user = apiClient.getUser();
  const id = user?.id || user?.email;
  return id ? `${USER_DRAFTS_PREFIX}pilotageSetting.${id}` : '';
};
const readStoredDrafts = (key) => {
  if (!key) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};
// Rien n'est écrit si l'utilisateur n'est plus celui de l'ouverture (déconnexion pendant un envoi,
// autre compte) : la saisie ne survit pas à la déconnexion et ne passe pas au compte suivant.
const writeStoredDrafts = (key, drafts) => {
  if (!key || draftsStorageKey() !== key) return;
  try {
    if (Object.keys(drafts).length) localStorage.setItem(key, JSON.stringify(drafts));
    else localStorage.removeItem(key);
  } catch { /* stockage indisponible : la saisie reste dans la page */ }
};

const findDay = (data, setterId, day) =>
  data?.setters?.find((s) => s.id === setterId)?.days?.find((d) => d.day === day);
const findReview = (data, setterId, day) => findDay(data, setterId, day)?.review ?? null;

// Saisies restées en suspens d'une visite précédente : signalées comme non enregistrées.
const initialStatus = (drafts) => Object.fromEntries(Object.entries(drafts)
  .map(([key, draft]) => [key, { state: 'error', field: Object.keys(draft || {})[0] || 'action', seq: 0 }]));

const saveErrorMessage = (err) => {
  const detail = err?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (err?.status === 403) return 'modification réservée au manager des setters';
  if (err?.status === 422) return 'valeur refusée';
  return err?.status ? 'erreur du serveur' : 'connexion impossible';
};

const loadErrorMessage = (err) => {
  if (err?.status === 403) return 'Accès réservé au manager des setters.';
  if (err?.status === 422) return errorMessage(err, 'Période refusée.');
  return 'Impossible de charger le pilotage. Réessayez.';
};

function AutoGrowTextarea({ value, style, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} style={{ ...style, resize: 'none', overflow: 'hidden' }} {...rest} />;
}

export default function PilotageSetting({ C, darkMode, onToast }) {
  const today = parisToday();
  const [period, setPeriod] = useState(() => ({ mode: 'day', day: today, from: '', to: '' }));
  const { start, end, error: periodError } = useMemo(() => resolvePeriod(period, today), [period, today]);
  const dayMode = period.mode === 'day';

  const [data, setData] = useState(null);
  const dataRef = useRef(null);
  const [loadedMode, setLoadedMode] = useState(null);  // mode de la période réellement affichée
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(null);

  const [storageKey] = useState(draftsStorageKey);    // utilisateur à l'ouverture de l'onglet
  const [drafts, setDrafts] = useState(() => readStoredDrafts(storageKey));
  const draftsRef = useRef(drafts);
  const [status, setStatus] = useState(() => initialStatus(drafts));   // clé ligne → { state, field, seq }
  const queues = useRef(new Map());                    // clé ligne → dernier envoi en cours
  const pending = useRef(new Map());                   // clé ligne → nombre d'envois pas encore terminés
  const seqs = useRef(new Map());
  const savedLog = useRef(new Map());                  // clé ligne → { saved, at }
  const focused = useRef('');                          // « clé ligne|champ » de la cellule active

  const commitData = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(dataRef.current) : updater;
    dataRef.current = next;
    setData(next);
  }, []);

  const setDraft = useCallback((key, draft) => {
    const next = { ...draftsRef.current };
    if (draft) next[key] = draft;
    else delete next[key];
    draftsRef.current = next;
    setDrafts(next);
    writeStoredDrafts(storageKey, next);
  }, [storageKey]);

  // Une saisie identique à ce qui est enregistré n'a plus rien à envoyer : elle disparaît.
  const dropSettledDrafts = useCallback((next) => {
    const settled = Object.entries(draftsRef.current).filter(([key, draft]) => {
      const [setterId, day] = key.split('|');
      const row = findDay(next, setterId, day);
      return row && sameReview(effectiveReview(row.review, draft), row.review);
    }).map(([key]) => key);
    if (!settled.length) return;
    const remaining = { ...draftsRef.current };
    settled.forEach((key) => delete remaining[key]);
    draftsRef.current = remaining;
    setDrafts(remaining);
    writeStoredDrafts(storageKey, remaining);
    setStatus((s) => {
      const rest = { ...s };
      settled.forEach((key) => { if (rest[key]?.state === 'error') delete rest[key]; });
      return rest;
    });
  }, [storageKey]);

  useEffect(() => {
    if (periodError) return undefined;
    let alive = true;
    const startedAt = Date.now();
    const mode = period.mode;
    setLoading(true);
    setLoadError('');
    apiClient.get(`${API}?start=${start}&end=${end}`)
      .then((d) => {
        if (!alive) return;
        // Un enregistrement terminé pendant la lecture n'y figure peut-être pas : on le réapplique.
        let next = d;
        for (const entry of savedLog.current.values()) if (entry.at >= startedAt) next = mergeSavedReview(next, entry.saved);
        commitData(next);
        setLoadedMode(mode);
        dropSettledDrafts(next);
        setLoading(false);
      })
      .catch((err) => { if (alive) { setLoadError(loadErrorMessage(err)); setLoading(false); } });
    return () => { alive = false; };
  }, [start, end, period.mode, periodError, refresh, commitData, dropSettledDrafts]);

  const setRowStatus = useCallback((key, seq, value) => {
    if (seqs.current.get(key) !== seq) return;       // un envoi plus récent de la ligne a la main
    setStatus((s) => {
      const next = { ...s };
      if (value) next[key] = { ...value, seq };
      else delete next[key];
      return next;
    });
  }, []);

  const saveRow = useCallback((setterId, day, field) => {
    const key = reviewKey(setterId, day);
    const seq = (seqs.current.get(key) || 0) + 1;
    seqs.current.set(key, seq);
    setRowStatus(key, seq, { state: 'saving', field });
    pending.current.set(key, (pending.current.get(key) || 0) + 1);
    const snapshot = findDay(dataRef.current, setterId, day);   // si la période change avant l'envoi
    const previous = queues.current.get(key) || Promise.resolve();
    const run = previous.then(async () => {
      const server = (findDay(dataRef.current, setterId, day) || snapshot)?.review ?? null;
      const current = effectiveReview(server, draftsRef.current[key]);
      const focusedField = () => (focused.current.startsWith(`${key}|`) ? focused.current.slice(key.length + 1) : null);
      try {
        if (!sameReview(current, server)) {
          // Seuls les champs modifiés partent : ceux qu'un autre a saisis entre-temps restent intacts.
          const saved = await apiClient.put(`${API}/review`, reviewPayload(setterId, day, current, server));
          savedLog.current.set(key, { saved, at: Date.now() });
          commitData((d) => mergeSavedReview(d, saved));
          setDraft(key, pruneDraft(draftsRef.current[key], saved, focusedField()));
        } else {
          setDraft(key, pruneDraft(draftsRef.current[key], server, focusedField()));
        }
        setRowStatus(key, seq, { state: 'saved', field });
        setTimeout(() => setRowStatus(key, seq, null), 2500);
      } catch (err) {
        setRowStatus(key, seq, { state: 'error', field });
        if (seqs.current.get(key) === seq) {
          onToast?.(`Saisie non enregistrée (${saveErrorMessage(err)}). Le texte reste dans la cellule.`, 'err');
        }
      } finally {
        const left = (pending.current.get(key) || 1) - 1;
        if (left) pending.current.set(key, left);
        else pending.current.delete(key);
      }
    });
    queues.current.set(key, run);
  }, [commitData, onToast, setDraft, setRowStatus]);

  const editField = (setterId, day, field, value) => {
    const key = reviewKey(setterId, day);
    setDraft(key, { ...(draftsRef.current[key] || {}), [field]: value });
  };

  const onFocusField = (setterId, day, field) => { focused.current = `${reviewKey(setterId, day)}|${field}`; };

  const saveIfDirty = (setterId, day, field) => {
    focused.current = '';
    const key = reviewKey(setterId, day);
    if (!draftsRef.current[key]) return;
    // Un envoi de la ligne est en cours : la valeur connue va changer, la comparaison se fait après
    // lui, dans la file (sinon remettre la cellule à sa valeur d'avant serait perdu).
    if (pending.current.get(key)) {
      saveRow(setterId, day, field);
      return;
    }
    const server = findReview(dataRef.current, setterId, day);
    if (sameReview(effectiveReview(server, draftsRef.current[key]), server)) {
      setDraft(key, pruneDraft(draftsRef.current[key], server));
      return;
    }
    saveRow(setterId, day, field);
  };

  const showR2 = shouldShowR2(data);
  const columns = columnsFor(showR2);
  const canEdit = Boolean(data?.can_edit);
  // Le tableau suit la période chargée ; pendant un chargement, les cellules jaunes sont figées.
  const stale = Boolean(data) && (data.start !== start || data.end !== end);
  const shownDayMode = loadedMode === 'day';
  const editable = shownDayMode && canEdit;
  const locked = stale || loading;
  // Comptes désactivés : jamais dans le tableau ni dans les totaux (dev 05/10).
  const rows = useMemo(() => sortSetters((data?.setters || []).filter((s) => s.active !== false)), [data]);
  const team = useMemo(() => teamTotals(rows), [rows]);
  const blocage = blocageChoices(data?.blocage_suggestions);
  const multiDay = !shownDayMode;
  // Saisies en échec encore différentes de ce qui est enregistré (inconnu si le jour n'est pas affiché).
  const pendingKeys = data ? Object.entries(status).filter(([key, st]) => {
    if (st.state !== 'error' || !drafts[key]) return false;
    const [setterId, day] = key.split('|');
    const row = findDay(data, setterId, day);
    return !row || !sameReview(effectiveReview(row.review, drafts[key]), row.review);
  }).map(([key]) => key) : [];
  const pendingDays = [...new Set(pendingKeys.map((key) => key.split('|')[1]))]
    .filter((day) => !(dayMode && day === start)).sort().slice(0, 3);

  const changeMode = (mode) => {
    setOpen(null);
    setPeriod((p) => {
      if (mode !== 'custom' || (p.from && p.to)) return { ...p, mode };
      const from = start && end && start !== end ? start : shiftDay(today, -6);
      const to = start && end && start !== end ? end : today;
      return { ...p, mode, from, to };
    });
  };
  const goToDay = (day) => { setOpen(null); setPeriod((p) => ({ ...p, mode: 'day', day })); };

  /* ── Styles ── */
  const yellow = darkMode ? 'rgba(250, 204, 21, 0.08)' : '#fdf6d8';
  const fieldBorder = darkMode ? 'rgba(250, 204, 21, 0.24)' : '#eadfae';
  const ok = darkMode ? '#4ade80' : '#15803d';
  const bad = darkMode ? '#f87171' : '#b42318';
  const cell = { padding: '10px 8px', fontSize: 13.5, color: C.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'center' };
  const head = {
    ...cell, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '10px 12px', whiteSpace: 'normal', verticalAlign: 'bottom', lineHeight: 1.3,
  };
  const sticky = { position: 'sticky', left: 0, zIndex: 1, background: 'inherit' };
  const manualCell = { ...cell, textAlign: 'left', whiteSpace: 'normal', verticalAlign: 'top', padding: '8px 10px' };
  // Propriétés détaillées seulement (borderColor, backgroundColor…) : React ne réapplique que les clés
  // modifiées, un raccourci « border » ou « background » à côté effacerait la couleur ou la flèche.
  const field = {
    width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8,
    borderWidth: 1, borderStyle: 'solid', borderColor: fieldBorder,
    backgroundColor: darkMode ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.7)', color: C.text, fontSize: 13, fontFamily: 'inherit',
    outline: 'none', lineHeight: 1.4,
  };
  const selectField = {
    ...field, appearance: 'none', cursor: 'pointer', padding: '7px 22px 7px 9px',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='${darkMode ? '%235e6273' : '%239ca3af'}' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  };
  const pill = (active) => ({
    padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 600, transition: 'background 0.15s, color 0.15s',
    background: active ? C.bg : 'transparent', color: active ? C.text : C.secondary,
    boxShadow: active ? (darkMode ? 'none' : '0 1px 2px rgba(16,24,40,0.08)') : 'none',
  });
  const dateInput = {
    padding: '7px 10px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', colorScheme: darkMode ? 'dark' : 'light',
  };
  const iconBtn = (disabled) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10,
    border: `1px solid ${C.border}`, background: C.bg, color: disabled ? C.muted : C.secondary,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, padding: 0,
  });
  const sub = { fontSize: 11, fontWeight: 500, color: C.muted, marginTop: 2 };

  /* ── Cellules ── */
  const metricCells = (m, s) => {
    const linked = s.allo === 'linked';
    const out = [];
    for (const col of columns) {
      if (col === 'calls') {
        out.push(linked
          ? <td key={col} style={{ ...cell, fontWeight: 600 }}>{fmtInt(m.calls)}</td>
          : <td key={col} style={{ ...cell, color: C.muted }} title={ALLO_LABELS[s.allo] || ALLO_LABELS.error}>–</td>);
      } else if (col === 'answered') {
        out.push(linked
          ? <td key={col} style={cell}>{fmtInt(m.answered)}</td>
          : <td key={col} style={{ ...cell, color: C.muted }} title={ALLO_LABELS[s.allo] || ALLO_LABELS.error}>–</td>);
      } else if (col === 'r1') {
        out.push(<td key={col} style={{ ...cell, fontWeight: 600, color: m.r1 ? '#3b82f6' : C.muted }}>{fmtInt(m.r1)}</td>);
      } else if (col === 'held') {
        out.push(
          <td key={col} style={{ ...cell, fontWeight: 600, color: m.held ? ok : C.muted }}>
            {fmtInt(m.held)}
            {m.to_qualify > 0 && <div style={sub}>{fmtInt(m.to_qualify)} à qualifier</div>}
          </td>,
        );
      } else if (col === 'no_show') {
        out.push(
          <td key={col} title={m.to_qualify > 0 ? `${fmtInt(m.to_qualify)} RDV passés restent à qualifier` : undefined}
            style={{ ...cell, fontWeight: 600, color: m.no_show ? bad : C.muted }}>{fmtInt(m.no_show)}</td>,
        );
      } else if (col === 'r2') {
        out.push(<td key={col} style={{ ...cell, fontWeight: 600, color: m.r2 ? '#fb923c' : C.muted }}>{fmtInt(m.r2)}</td>);
      } else if (col === 'duration') {
        out.push(<td key={col} style={{ ...cell, color: linked ? C.text : C.muted }}>{linked ? fmtTalk(m.duration) : '–'}</td>);
      } else if (col === 'average') {
        out.push(<td key={col} style={{ ...cell, color: linked ? C.text : C.muted }}>{linked ? fmtAverage(m.duration, m.calls) : '–'}</td>);
      }
    }
    return out;
  };

  const statusIcon = (setterId, day, col, isDirty) => {
    const key = reviewKey(setterId, day);
    const st = status[key];
    if (!st || st.field !== col) return null;
    const box = { position: 'absolute', top: 4, right: 4, display: 'inline-flex', pointerEvents: 'none' };
    if (st.state === 'saving') {
      return <span style={box} title="Enregistrement…"><LoaderCircle size={12} color={C.muted} style={{ animation: 'prospSpin 1s linear infinite' }} /></span>;
    }
    if (st.state === 'saved') return <span style={box} title="Enregistré"><Check size={13} color={ok} /></span>;
    if (st.state === 'error' && isDirty) {
      return (
        <button type="button" onClick={() => saveRow(setterId, day, col)} title="Non enregistré. Cliquez pour réessayer."
          aria-label="Réessayer l'enregistrement"
          style={{ ...box, pointerEvents: 'auto', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
          <CircleAlert size={14} color={bad} />
        </button>
      );
    }
    return null;
  };

  const editableCells = (s, day) => {
    const key = reviewKey(s.id, day.day);
    const server = day.review;
    const value = effectiveReview(server, drafts[key]);
    const dirty = Boolean(drafts[key]) && !sameReview(value, server);
    const failed = status[key]?.state === 'error' && dirty;
    const tip = reviewTooltip(server) || undefined;
    const border = (col) => (failed && status[key]?.field === col ? { borderColor: bad } : null);
    const td = { ...manualCell, background: yellow, position: 'relative' };
    const blocageValue = value.blocage ?? '';
    const blocageOptions = blocage.mode === 'fixed' && blocageValue && !blocage.options.includes(blocageValue)
      ? [blocageValue, ...blocage.options] : blocage.options;
    return [
      <td key="discours" style={{ ...td, minWidth: 72 }} title={tip}>
        <select aria-label={`Discours de ${s.name}`} className="pilotage-field" value={value.discours ?? ''} disabled={locked}
          onChange={(e) => {
            editField(s.id, day.day, 'discours', e.target.value === '' ? null : Number(e.target.value));
            saveRow(s.id, day.day, 'discours');
          }}
          style={{ ...selectField, width: 60, ...border('discours') }}>
          <option value="" />
          {DISCOURS_SCORES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {statusIcon(s.id, day.day, 'discours', dirty)}
      </td>,
      <td key="blocage" style={{ ...td, minWidth: 260 }} title={tip}>
        {blocage.mode === 'fixed' ? (
          <select aria-label={`Blocage principal de ${s.name}`} className="pilotage-field" value={blocageValue} disabled={locked}
            onChange={(e) => { editField(s.id, day.day, 'blocage', e.target.value); saveRow(s.id, day.day, 'blocage'); }}
            style={{ ...selectField, ...border('blocage') }}>
            <option value="" />
            {blocageOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <AutoGrowTextarea aria-label={`Blocage principal de ${s.name}`} className="pilotage-field" disabled={locked} rows={2}
            maxLength={BLOCAGE_MAX} value={blocageValue}
            onChange={(e) => editField(s.id, day.day, 'blocage', e.target.value)}
            onFocus={() => onFocusField(s.id, day.day, 'blocage')}
            onBlur={() => saveIfDirty(s.id, day.day, 'blocage')}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur(); }}
            style={{ ...field, minHeight: 52, ...border('blocage') }} />
        )}
        {statusIcon(s.id, day.day, 'blocage', dirty)}
      </td>,
      <td key="action" style={{ ...td, minWidth: 300 }} title={tip}>
        <AutoGrowTextarea aria-label={`Action ou coaching pour ${s.name}`} className="pilotage-field" disabled={locked} rows={2}
          maxLength={ACTION_MAX} value={value.action ?? ''}
          onChange={(e) => editField(s.id, day.day, 'action', e.target.value)}
          onFocus={() => onFocusField(s.id, day.day, 'action')}
          onBlur={() => saveIfDirty(s.id, day.day, 'action')}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur(); }}
          style={{ ...field, minHeight: 52, ...border('action') }} />
        {statusIcon(s.id, day.day, 'action', dirty)}
      </td>,
    ];
  };

  const readOnlyCells = (review) => {
    const tip = reviewTooltip(review) || undefined;
    const roCell = { ...manualCell, verticalAlign: 'middle' };
    return [
      <td key="discours" style={{ ...roCell, fontWeight: 600, color: review?.discours ? C.text : C.muted }} title={tip}>
        {review?.discours ?? '–'}
      </td>,
      <td key="blocage" style={{ ...roCell, color: review?.blocage ? C.text : C.muted, maxWidth: 320, whiteSpace: 'pre-wrap' }} title={tip}>
        {review?.blocage || '–'}
      </td>,
      <td key="action" style={{ ...roCell, color: review?.action ? C.text : C.muted, maxWidth: 360, whiteSpace: 'pre-wrap' }} title={tip}>
        {review?.action || '–'}
      </td>,
    ];
  };

  const summaryCells = (s) => {
    const top = topBlocage(s.days);
    const noted = notedDays(s.days);
    return [
      <td key="discours" style={{ ...cell, textAlign: 'left', fontWeight: 600, color: s.totals?.discours_avg != null ? C.text : C.muted }}
        title={s.totals?.discours_avg != null ? 'Moyenne des notes de la période' : undefined}>
        {fmtScore(s.totals?.discours_avg)}
        {s.totals?.discours_avg != null && <div style={sub}>moyenne</div>}
      </td>,
      <td key="blocage" title={top?.label} style={{ ...manualCell, verticalAlign: 'middle', color: top ? C.text : C.muted, maxWidth: 280,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {top ? <>{top.label}{top.count > 1 && <span style={{ color: C.muted, fontWeight: 500 }}>{` (${top.count} jours)`}</span>}</> : '–'}
      </td>,
      <td key="action" style={{ ...manualCell, verticalAlign: 'middle', color: C.muted }}>
        {noted ? `${noted} jour${noted > 1 ? 's' : ''} noté${noted > 1 ? 's' : ''}` : '–'}
      </td>,
    ];
  };

  const avatar = (s) => (s.avatar_url
    ? <img src={s.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer"
        style={{ width: 30, height: 30, borderRadius: 999, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.border}` }} />
    : <span style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: darkMode ? '#2a2b36' : '#e8ebf5', color: C.accent, fontSize: 11.5, fontWeight: 700 }}>
        {String(s.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')}
      </span>);

  const nameCell = (s, { chevron, expanded } = {}) => (
    <td style={{ ...cell, ...sticky, textAlign: 'left', fontWeight: 600 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {chevron && (expanded ? <ChevronDown size={15} color={C.muted} /> : <ChevronRight size={15} color={C.muted} />)}
        {avatar(s)}
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {s.name}
            {s.role === 'setter_manager' && <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>manager</span>}
            {s.active === false && <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>inactif</span>}
          </span>
          {s.allo !== 'linked' && <span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>{ALLO_LABELS[s.allo] || ALLO_LABELS.error}</span>}
        </span>
      </span>
    </td>
  );

  const renderDayModeRow = (s) => {
    const found = s.days?.find((d) => d.day === data.start);
    const day = found || { day: data.start, ...s.totals, review: null };
    return (
      <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
        {nameCell(s)}
        {metricCells(day, s)}
        {editable && found ? editableCells(s, day) : readOnlyCells(day.review)}
      </tr>
    );
  };

  const renderRangeRows = (s) => {
    const expanded = open === s.id;
    return [
      <tr key={s.id} onClick={() => setOpen(expanded ? null : s.id)}
        style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: expanded ? C.subtle : C.bg }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = C.subtle; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = C.bg; }}>
        {nameCell(s, { chevron: true, expanded })}
        {metricCells(s.totals || {}, s)}
        {summaryCells(s)}
      </tr>,
      ...(expanded ? newestFirst(s.days).map((d) => (
        <tr key={`${s.id}-${d.day}`} style={{ borderBottom: `1px solid ${C.border}`, background: C.subtle }}>
          <td style={{ ...cell, ...sticky, textAlign: 'left', padding: '10px 12px 10px 38px', color: C.secondary }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {fmtDayShort(d.day)}
              {canEdit && (
                <button type="button" onClick={() => goToDay(d.day)} title="Ouvrir ce jour pour saisir"
                  aria-label={`Saisir le ${fmtDayShort(d.day)}`}
                  style={{ display: 'inline-flex', border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', color: C.accent }}>
                  <PencilLine size={13} />
                </button>
              )}
            </span>
          </td>
          {metricCells(d, s)}
          {readOnlyCells(d.review)}
        </tr>
      )) : []),
    ];
  };

  // Les cartes ne montrent que les chiffres de la période affichée : rien d'une période précédente
  // après un échec de chargement, pendant le chargement d'une autre période ou si la plage est invalide.
  const fresh = Boolean(data) && !stale && !loadError && !periodError;
  const kpis = [
    {
      label: "Appels de l'équipe",
      value: data?.allo === 'error' ? 'Allo indisponible' : team.calls == null ? '–' : fmtInt(team.calls),
      note: team.answered != null && data?.allo !== 'error' ? `dont ${fmtInt(team.answered)} répondus` : '',
    },
    { label: 'Temps au téléphone', value: data?.allo === 'error' ? '–' : fmtTalk(team.duration), note: '' },
    { label: 'RDV pris', value: fmtInt(team.r1), color: '#3b82f6', note: showR2 ? `et ${fmtInt(team.r2)} R2 posés` : '' },
    {
      label: 'RDV honorés', value: fmtInt(team.held), color: ok,
      note: `${fmtInt(team.no_show)} no-show${team.to_qualify ? `, ${fmtInt(team.to_qualify)} à qualifier` : ''}`,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1500 }}>
      <ProspectionStyles />
      <style>{`.pilotage-field:focus { border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${darkMode ? 'rgba(124,138,219,0.22)' : 'rgba(91,106,191,0.16)'}; }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: C.subtle, border: `1px solid ${C.border}` }}>
          {PERIOD_MODES.map((p) => (
            <button key={p.key} type="button" aria-pressed={period.mode === p.key} onClick={() => changeMode(p.key)} style={pill(period.mode === p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {dayMode && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={() => goToDay(shiftDay(start, -1))} title="Jour précédent" aria-label="Jour précédent" style={iconBtn(false)}>
              <ChevronLeft size={16} />
            </button>
            <input type="date" aria-label="Jour affiché" value={period.day} max={today}
              onChange={(e) => { if (e.target.value) goToDay(e.target.value); }} style={dateInput} />
            <button type="button" onClick={() => goToDay(shiftDay(start, 1))} disabled={start >= today}
              title="Jour suivant" aria-label="Jour suivant" style={iconBtn(start >= today)}>
              <ChevronRight size={16} />
            </button>
            {start !== today && (
              <button type="button" onClick={() => goToDay(today)} style={{ ...pill(false), padding: '7px 10px', color: C.accent }}>
                Aujourd'hui
              </button>
            )}
          </div>
        )}

        {period.mode === 'custom' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.secondary }}>
            <span>Du</span>
            <input type="date" aria-label="Début de la période" value={period.from} max={today}
              onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} style={dateInput} />
            <span>au</span>
            <input type="date" aria-label="Fin de la période" value={period.to} max={today}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} style={dateInput} />
          </div>
        )}

        <button type="button" onClick={() => setRefresh((n) => n + 1)} disabled={loading || Boolean(periodError)} title="Actualiser" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
          border: `1px solid ${C.border}`, background: C.bg, color: C.secondary, cursor: loading ? 'default' : 'pointer',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
        }}>
          <RefreshCw size={14} style={{ animation: loading ? 'prospSpin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginTop: -6 }}>
        {periodError ? (
          <span role="alert" style={{ fontSize: 13, color: bad, fontWeight: 600 }}>{periodError}</span>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {fmtPeriod(start, end)}{dayMode && start === today ? " (aujourd'hui)" : ''}
          </span>
        )}
        {pendingKeys.length > 0 && (
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: bad, fontWeight: 600, flexWrap: 'wrap' }}>
            <CircleAlert size={14} />
            {pendingKeys.length > 1 ? `${pendingKeys.length} saisies non enregistrées` : '1 saisie non enregistrée'} : le texte est conservé, cliquez sur l'icône rouge pour réessayer.
            {pendingDays.map((day) => (
              <button key={day} type="button" onClick={() => goToDay(day)} style={{
                border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: C.accent,
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, textDecoration: 'underline',
              }}>Ouvrir le {fmtDayShort(day)}</button>
            ))}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <Card key={k.label} C={C} darkMode={darkMode} style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color || C.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', opacity: loading ? 0.45 : 1, transition: 'opacity 0.2s' }}>
              {fresh ? k.value : '–'}
            </div>
            {fresh && k.note && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{k.note}</div>}
          </Card>
        ))}
      </div>

      <Card C={C} darkMode={darkMode} style={{ overflow: 'hidden' }}>
        {periodError ? (
          <div style={{ padding: 24, fontSize: 14, color: C.muted }}>Choisissez une période valide.</div>
        ) : loadError ? (
          <div role="alert" style={{ padding: 24, fontSize: 14, color: bad }}>{loadError}</div>
        ) : !data ? (
          <div style={{ padding: 24, fontSize: 14, color: C.muted }}>Lecture des appels Allo et des RDV…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24, fontSize: 14, color: C.muted }}>Aucun setter sur la période.</div>
        ) : (
          <div style={{ overflowX: 'auto', opacity: loading || stale ? 0.55 : 1, transition: 'opacity 0.2s' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                  <th style={{ ...head, ...sticky, textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Setter</th>
                  {columns.map((c) => {
                    const Icon = METRIC_ICONS[c];
                    const manual = MANUAL_COLUMNS.includes(c);
                    return (
                      <th key={c} title={COLUMN_LABELS[c]} aria-label={COLUMN_LABELS[c]} style={{
                        ...head, verticalAlign: 'middle', whiteSpace: 'nowrap', height: 46,
                        ...(manual ? { textAlign: 'left' } : { textAlign: 'center', width: METRIC_WIDTH, minWidth: METRIC_WIDTH, padding: '10px 8px' }),
                        ...(manual && editable ? { background: yellow } : null),
                      }}>
                        {Icon ? (
                          <span style={{ display: 'inline-flex', alignItems: 'flex-start', justifyContent: 'center', color: C.secondary }}>
                            <Icon size={18} strokeWidth={1.9} />
                            {c === 'r2' && <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 1, lineHeight: 1 }}>2</span>}
                          </span>
                        ) : (SHORT_LABELS[c] || COLUMN_LABELS[c])}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (multiDay ? renderRangeRows(s) : renderDayModeRow(s)))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
