// src/pages/Dialer/OperatorConsole.jsx
//
// The calling console (operator = finance_team, e.g. Aurélie ; admin also).
// State machine :
//
//   loading ──> ready ──(Appeler)──> calling ──(call ends)──> ended
//      │          ▲                     │                       │
//      │          └──── advance ────────┘                       │
//      └──> done (list finished)                                │
//                ▲                                              │
//                └──────────── cooldown → chain ────────────────┘
//
// "Call ends" is detected two ways :
//   (1) real mode : poll /stats — when en_cours returns to 0 after having
//       been ≥1, the Twilio dial-result webhook has fired. Outcome inferred
//       from the counter that incremented.
//   (2) manual : "Raccrocher & suivant" → really terminates the live Twilio
//       call (backend /hangup) then advances. (Also the path in DRY_RUN.)
//
// Operator handset (F3) : each operator registers HER own phone, tied to her
// CRM account. Twilio rings that handset first ; the displayed number stays
// the verified CALLER_ID. "Appeler" is disabled until a handset is set.
//
// Recursion note — startCall / endCall / chainNext call each other ; we keep
// their latest versions in `fns` and read live values via refs to avoid stale
// closures. A `mounted` ref guards every async state update.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Pause, Play, CheckCircle2, AlertTriangle, XCircle,
  PartyPopper, Smartphone, Check, Pencil, Headphones,
} from 'lucide-react';
import dialerClient from '../../services/dialerClient.js';
import { initials, prettyPhone, OUTCOME_META } from './theme.js';

const COOLDOWN_SECONDS = 5;
const POLL_MS = 3000;
const POLL_FAIL_LIMIT = 6;          // ~18s of failed polls → give up gracefully
const SPRING = { type: 'spring', stiffness: 300, damping: 28 };
const EASE_OUT = [0.22, 1, 0.36, 1];

function inferOutcome(before, after) {
  const b = before || { done: 0, no_answer: 0, failed: 0 };
  if (!after) return 'done';
  for (const k of ['done', 'no_answer', 'failed']) {
    if ((after[k] || 0) > (b[k] || 0)) return k;
  }
  return 'done';
}

export default function OperatorConsole({ campaignId, operatorKey, stats, refreshStats, theme }) {
  const T = theme;

  const [phase, setPhase] = useState('loading'); // loading|ready|calling|ended|done|error
  const [current, setCurrent] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [autoChain, setAutoChain] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState(null);
  const [launching, setLaunching] = useState(false);  // double-click guard
  const [hangingUp, setHangingUp] = useState(false);
  const [dryRun, setDryRun] = useState(false);        // captured from /call response

  // continuous line (V2 — persistent conference)
  const [session, setSession] = useState(null);       // null=loading | false=none | obj=active
  const [sessionBusy, setSessionBusy] = useState(false);
  const [joinAck, setJoinAck] = useState(false);      // manual "j'ai décroché" fallback

  // operator handset (F3)
  const [operatorPhone, setOperatorPhone] = useState(null); // null = not loaded yet
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const pollRef = useRef(null);
  const cooldownRef = useRef(null);
  const sawInProgress = useRef(false);
  const beforeDetail = useRef(null);
  const pollFails = useRef(0);
  const mounted = useRef(true);
  const launchingRef = useRef(false);   // double-click / re-entrancy guard

  const autoChainRef = useRef(autoChain); autoChainRef.current = autoChain;
  const statsRef = useRef(stats); statsRef.current = stats;
  const operatorPhoneRef = useRef(operatorPhone); operatorPhoneRef.current = operatorPhone;
  const sessionRef = useRef(session); sessionRef.current = session;
  const joinAckRef = useRef(joinAck); joinAckRef.current = joinAck;
  const sessionActiveRef = useRef(false);
  const fns = useRef({});

  // ── timers ────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  const stopCooldown = useCallback(() => {
    if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
    if (mounted.current) setCooldown(0);
  }, []);
  const armCooldown = useCallback(() => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldown(COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      if (!mounted.current) return;
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current); cooldownRef.current = null;
          fns.current.chainNext?.();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  // ── load operator handset on mount / key change (F3) ──────────────────
  useEffect(() => {
    let alive = true;
    if (!operatorKey) { setOperatorPhone(''); return; }
    dialerClient.getOperator(operatorKey)
      .then((r) => { if (alive) setOperatorPhone(r.agent_phone || ''); })
      .catch(() => { if (alive) setOperatorPhone(''); });
    return () => { alive = false; };
  }, [operatorKey]);

  const saveOperatorPhone = async () => {
    const raw = phoneInput.trim();
    if (!raw) return;
    setSavingPhone(true);
    try {
      const r = await dialerClient.saveOperator(operatorKey, raw);
      if (!mounted.current) return;
      setOperatorPhone(r.agent_phone || raw);
      setEditingPhone(false);
    } catch (e) {
      if (mounted.current) setError(e?.message || 'Enregistrement impossible');
    } finally {
      if (mounted.current) setSavingPhone(false);
    }
  };

  // ── continuous-line session : load + poll (learn when she joins / it ends)
  useEffect(() => {
    if (!operatorKey) { setSession(false); return; }
    let alive = true;
    const sync = async () => {
      try {
        const r = await dialerClient.activeSession(operatorKey);
        if (!alive || !mounted.current) return;
        const now = !!(r && r.active);
        if (sessionActiveRef.current && !now) {
          // continuous line closed mid-use → stop auto-chain, warn
          setAutoChain(false); autoChainRef.current = false;
          setJoinAck(false);
          setError('La ligne continue s’est fermée. Relancez-la si besoin.');
        }
        sessionActiveRef.current = now;
        setSession(now ? r : false);
      } catch { /* keep last */ }
    };
    sync();
    const id = setInterval(sync, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [operatorKey]);

  const startSession = async () => {
    if (!operatorPhone || sessionBusy) return;
    setSessionBusy(true); setError(null); setJoinAck(false);
    try {
      const s = await dialerClient.startSession(operatorKey, operatorPhone);
      if (mounted.current) { setSession(s); sessionActiveRef.current = true; }
    } catch (e) {
      if (mounted.current) setError(e?.data?.detail || e?.message || 'Démarrage de la ligne impossible');
    } finally {
      if (mounted.current) setSessionBusy(false);
    }
  };

  const endSession = async () => {
    if (sessionBusy) return;
    setSessionBusy(true);
    try { await dialerClient.endSession(operatorKey); } catch { /* ignore */ }
    if (mounted.current) {
      setSession(false); sessionActiveRef.current = false; setJoinAck(false); setSessionBusy(false);
    }
  };

  // ── load next pending fiche ───────────────────────────────────────────
  const loadNext = useCallback(async () => {
    setError(null);
    try {
      const r = await dialerClient.next(campaignId);
      if (!mounted.current) return null;
      if (r.done || !r.item) { setCurrent(null); setPhase('done'); return null; }
      setCurrent(r.item); setPhase('ready'); return r.item;
    } catch (e) {
      if (mounted.current) { setError(e?.message || 'Erreur de chargement'); setPhase('error'); }
      return null;
    }
  }, [campaignId]);

  // ── launch a call ─────────────────────────────────────────────────────
  const startCall = useCallback(async (item) => {
    if (!item || launchingRef.current) return;
    const agent = operatorPhoneRef.current;
    if (!agent) { setError('Renseignez votre numéro d’opérateur pour appeler.'); return; }
    // Conference mode : don't dial a prospect until the operator is on the line.
    const sess = sessionRef.current;
    if (sess && sess.active && !(sess.operator_joined || joinAckRef.current)) {
      setError('Décrochez votre combiné (il sonne) avant d’appeler un prospect.');
      stopCooldown();
      return;
    }
    launchingRef.current = true;
    setLaunching(true);
    sawInProgress.current = false;
    pollFails.current = 0;
    beforeDetail.current = statsRef.current?.detail || null;
    setOutcome(null);
    setPhase('calling');
    try {
      const confName = sessionRef.current?.conf_name || '';
      const resp = await dialerClient.call(campaignId, item.id, agent, confName);
      if (!mounted.current) return;
      if (typeof resp?.dry_run === 'boolean') setDryRun(resp.dry_run);
      refreshStats?.();
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const s = await dialerClient.stats(campaignId);
          pollFails.current = 0;
          if (!mounted.current) return;
          if ((s.en_cours || 0) >= 1) sawInProgress.current = true;
          if (sawInProgress.current && (s.en_cours || 0) === 0) {
            fns.current.endCall?.(inferOutcome(beforeDetail.current, s.detail));
          }
        } catch {
          pollFails.current += 1;
          if (pollFails.current >= POLL_FAIL_LIMIT) fns.current.endCall?.('done');
        }
      }, POLL_MS);
    } catch (e) {
      if (mounted.current) {
        setError(e?.data?.detail || e?.message || 'Échec du lancement de l’appel');
        setPhase('error');
      }
    } finally {
      launchingRef.current = false;
      if (mounted.current) setLaunching(false);
    }
  }, [campaignId, refreshStats, stopPolling]);

  // ── end of a call → outcome, then chain or wait ───────────────────────
  const endCall = useCallback((out) => {
    stopPolling();
    if (!mounted.current) return;
    setOutcome(out);
    setPhase('ended');
    refreshStats?.();
    if (autoChainRef.current) armCooldown();
  }, [refreshStats, stopPolling, armCooldown]);

  // ── advance + (auto) dial the next fiche ──────────────────────────────
  const chainNext = useCallback(async () => {
    stopCooldown();
    const item = await loadNext();
    if (item && autoChainRef.current && operatorPhoneRef.current) fns.current.startCall?.(item);
  }, [loadNext, stopCooldown]);

  fns.current.startCall = startCall;
  fns.current.endCall = endCall;
  fns.current.chainNext = chainNext;

  // reset on campaign change / mount
  useEffect(() => {
    mounted.current = true;
    setPhase('loading'); setOutcome(null);
    stopPolling(); stopCooldown();
    loadNext();
    return () => { mounted.current = false; stopPolling(); stopCooldown(); };
  }, [campaignId, loadNext, stopPolling, stopCooldown]);

  // ── auto-pick newly added fiches when the list was finished ───────────
  const restants = stats?.restants ?? 0;
  useEffect(() => {
    if (phase === 'done' && restants > 0) loadNext();
  }, [phase, restants, loadNext]);

  // ── manual hangup : really terminate the live call, then advance (F1) ─
  const onHangup = async () => {
    if (hangingUp) return;
    setHangingUp(true);
    try { await dialerClient.hangup(campaignId, current?.id); } catch { /* ignore */ }
    if (!mounted.current) return;
    setHangingUp(false);
    endCall(null);
  };

  // ── controls ──────────────────────────────────────────────────────────
  const onAppeler = () => current && startCall(current);
  const onNext    = () => { stopCooldown(); chainNext(); };
  const togglePause = () => {
    setAutoChain((prev) => {
      const nv = !prev;
      autoChainRef.current = nv;
      if (!nv) stopCooldown();
      else if (phase === 'ended') armCooldown();
      return nv;
    });
  };

  // ── progress numbers ──────────────────────────────────────────────────
  const total = stats?.total || 0;
  const traites = stats?.appels_passes || 0;
  const restantsN = stats?.restants ?? (total - traites);
  const pct = total ? Math.round((traites / total) * 100) : 0;

  const stage = {
    maxWidth: 560, margin: '0 auto', background: T.surface,
    border: `1px solid ${T.border}`, borderRadius: 24, boxShadow: T.shadow,
    padding: '28px 28px 32px', position: 'relative', overflow: 'hidden',
  };
  const phoneSet = !!operatorPhone;
  const confActive = !!(session && session.active);
  const confReady = confActive && (session.operator_joined || joinAck);
  const confPending = confActive && !confReady;   // line up but operator hasn't picked up
  const canCall = phoneSet && !confPending;

  return (
    <div>
      {/* ── operator handset bar (F3) ── */}
      <OperatorPhoneBar
        T={T} loaded={operatorPhone !== null} phone={operatorPhone}
        editing={editingPhone || (operatorPhone === '')}
        input={phoneInput} setInput={setPhoneInput}
        onEdit={() => { setPhoneInput(operatorPhone || ''); setEditingPhone(true); }}
        onSave={saveOperatorPhone} onCancel={() => setEditingPhone(false)}
        saving={savingPhone} canCancel={!!operatorPhone}
      />

      {/* ── continuous line bar (V2) ── */}
      <SessionBar T={T} phoneSet={!!operatorPhone} session={session} busy={sessionBusy}
        joinAck={joinAck} onAck={() => setJoinAck(true)}
        onStart={startSession} onEnd={endSession} />

      {/* ── visible error / notice banner (session, pre-flight, …) ── */}
      {error && phase !== 'error' && phase !== 'loading' && (
        <div style={{
          maxWidth: 560, margin: '0 auto 14px', padding: '10px 14px', borderRadius: 12,
          background: T.redBg, border: `1px solid ${T.red}33`, color: T.red, fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)}
            style={{ border: 'none', background: 'transparent', color: T.red, cursor: 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}

      {/* header strip : progress + auto-chain toggle */}
      <div style={{ maxWidth: 560, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textFaint }}>
            Progression
          </div>
          <div style={{ fontSize: 15, fontWeight: 650, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
            {traites} / {total} traités · <span style={{ color: T.textMuted }}>{restantsN} restants</span>
          </div>
        </div>
        <button onClick={togglePause}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12,
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            border: `1px solid ${autoChain ? T.accent : T.border}`,
            background: autoChain ? T.accentBg : 'transparent',
            color: autoChain ? T.accent : T.textMuted, transition: 'all 0.2s',
          }}>
          {autoChain ? <Pause size={15} /> : <Play size={15} />}
          {autoChain ? 'Enchaînement auto' : 'En pause'}
        </button>
      </div>

      {/* progress bar */}
      <div style={{ maxWidth: 560, margin: '0 auto 18px', height: 6, borderRadius: 99, background: T.borderSoft, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: EASE_OUT }}
          style={{ height: '100%', borderRadius: 99, background: T.accent }} />
      </div>

      {/* the stage */}
      <div style={stage}>
        {dryRun && (
          <div style={{
            position: 'absolute', top: 14, right: 14, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: T.amber,
            background: T.amberBg, padding: '4px 8px', borderRadius: 8,
          }}>
            mode test
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase === 'done' && (
            <motion.div key="done"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={SPRING}
              style={{ textAlign: 'center', padding: '36px 8px' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 99, margin: '0 auto 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.greenBg, color: T.green,
              }}>
                <PartyPopper size={34} />
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, color: T.text }}>Liste terminée 🎉</div>
              <div style={{ marginTop: 6, fontSize: 14, color: T.textMuted }}>
                Tous les appels de cette campagne ont été traités.
              </div>
            </motion.div>
          )}

          {phase === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ textAlign: 'center', padding: '36px 8px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 99, margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.redBg, color: T.red,
              }}>
                <XCircle size={30} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{error || 'Une erreur est survenue'}</div>
              <button onClick={loadNext} style={secondaryBtn(T)}>Réessayer</button>
            </motion.div>
          )}

          {phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ textAlign: 'center', padding: '48px 8px', color: T.textMuted, fontSize: 14 }}>
              Chargement…
            </motion.div>
          )}

          {(phase === 'ready' || phase === 'calling' || phase === 'ended') && current && (
            <motion.div key={current.id}
              initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.98 }} transition={SPRING}>
              {/* avatar + identity */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ position: 'relative', marginBottom: 18 }} role="img"
                  aria-label={`Prospect ${(current.first_name || '') + ' ' + (current.last_name || '')}`}>
                  {phase === 'calling' && (
                    <motion.span aria-hidden
                      animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
                      transition={{ duration: 1.4, ease: 'easeOut', repeat: Infinity }}
                      style={{ position: 'absolute', inset: 0, borderRadius: 99, background: T.accent }} />
                  )}
                  <div style={{
                    position: 'relative', width: 84, height: 84, borderRadius: 99,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 30, fontWeight: 700, color: '#fff',
                    background: `linear-gradient(135deg, ${T.accent}, ${T.accent}cc)`,
                    boxShadow: `0 8px 22px ${T.accent}44`,
                  }}>
                    {initials(current.first_name, current.last_name)}
                  </div>
                </div>

                <div style={{
                  maxWidth: '100%', fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.01em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {(current.first_name || '') + ' ' + (current.last_name || '')}
                </div>
                <a href={`tel:${current.phone}`} aria-label={`Numéro ${current.phone}`} style={{
                  marginTop: 6, fontSize: 16, fontWeight: 600, color: T.accent,
                  fontVariantNumeric: 'tabular-nums', textDecoration: 'none',
                }}>
                  {prettyPhone(current.phone)}
                </a>
                {current.attempts > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: T.textFaint }}>
                    {current.attempts} tentative{current.attempts > 1 ? 's' : ''} précédente{current.attempts > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* action zone */}
              <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                {phase === 'ready' && (
                  <>
                    <motion.button onClick={onAppeler} disabled={!canCall || launching}
                      whileHover={canCall ? { y: -1 } : {}} whileTap={canCall ? { y: 0, scale: 0.98 } : {}}
                      title={!phoneSet ? 'Renseignez votre numéro d’opérateur' : confPending ? 'Décrochez votre combiné d’abord' : 'Appeler'}
                      style={{ ...primaryBtn(T), opacity: (!canCall || launching) ? 0.5 : 1, cursor: (!canCall || launching) ? 'not-allowed' : 'pointer' }}>
                      <Phone size={20} /> {launching ? 'Connexion…' : 'Appeler'}
                    </motion.button>
                    {!phoneSet && (
                      <div style={{ fontSize: 12.5, color: T.textFaint }}>Renseignez votre numéro pour démarrer ☝️</div>
                    )}
                    {confPending && (
                      <div style={{ fontSize: 12.5, color: T.amber }}>📞 Votre combiné sonne — décrochez pour vous mettre en ligne</div>
                    )}
                  </>
                )}

                {phase === 'calling' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: T.accent }}>
                      <motion.span animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity }}
                        style={{ width: 9, height: 9, borderRadius: 99, background: T.accent, display: 'inline-block' }} />
                      Appel en cours…
                    </div>
                    <button onClick={onHangup} disabled={hangingUp} style={{ ...dangerBtn(T), opacity: hangingUp ? 0.6 : 1 }}>
                      <PhoneOff size={18} /> {hangingUp ? 'Raccrochage…' : (confActive ? 'Raccrocher le prospect & suivant' : 'Raccrocher & suivant')}
                    </button>
                  </>
                )}

                {phase === 'ended' && (
                  <>
                    {outcome && OUTCOME_META[outcome] && <OutcomeChip T={T} outcome={outcome} />}
                    {autoChain ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <CountdownRing T={T} value={cooldown} max={COOLDOWN_SECONDS} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Appel suivant…</div>
                          <button onClick={onNext} style={{ ...linkBtn(T), padding: 0, marginTop: 2 }}>Appeler maintenant →</button>
                        </div>
                      </div>
                    ) : (
                      <motion.button onClick={onNext} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} style={primaryBtn(T)}>
                        <Phone size={18} /> Fiche suivante
                      </motion.button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── operator handset bar (F3) ───────────────────────────────────────────────
function OperatorPhoneBar({ T, loaded, phone, editing, input, setInput, onEdit, onSave, onCancel, saving, canCancel }) {
  if (!loaded) return null;
  const wrap = {
    maxWidth: 560, margin: '0 auto 16px', display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 14, border: `1px solid ${T.border}`,
    background: T.surfaceAlt,
  };
  if (editing) {
    return (
      <div style={wrap}>
        <Smartphone size={16} style={{ color: T.accent, flexShrink: 0 }} />
        <input
          autoFocus value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
          placeholder="Votre numéro (ex. 06 12 34 56 78)"
          style={{
            flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 10, fontSize: 14,
            color: T.text, background: T.surface, border: `1px solid ${T.accent}`, outline: 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <button onClick={onSave} disabled={saving} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
          border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', background: T.accent,
        }}>
          <Check size={15} /> {saving ? '…' : 'Enregistrer'}
        </button>
        {canCancel && (
          <button onClick={onCancel} style={{ border: 'none', background: 'transparent', color: T.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Annuler
          </button>
        )}
      </div>
    );
  }
  return (
    <div style={wrap}>
      <Smartphone size={16} style={{ color: T.accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: T.textFaint }}>Votre combiné opérateur : </span>
        <span style={{ fontSize: 14, fontWeight: 650, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{prettyPhone(phone)}</span>
      </div>
      <button onClick={onEdit} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent',
        color: T.accent, cursor: 'pointer', fontSize: 13, fontWeight: 600,
      }}>
        <Pencil size={13} /> Modifier
      </button>
    </div>
  );
}

// ── continuous-line bar (V2) ────────────────────────────────────────────────
function SessionBar({ T, phoneSet, session, busy, joinAck, onAck, onStart, onEnd }) {
  if (!phoneSet || session === null) return null;
  const active = !!(session && session.active);
  const joined = active && (session.operator_joined || joinAck);
  const pending = active && !joined;
  const tone = joined ? T.green : pending ? T.amber : null;
  const wrap = {
    maxWidth: 560, margin: '0 auto 16px', display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 14,
    border: `1px solid ${tone || T.border}`,
    background: joined ? T.greenBg : pending ? T.amberBg : T.surfaceAlt,
  };

  if (joined) {
    return (
      <div style={wrap}>
        <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: 9, height: 9, borderRadius: 99, background: T.green, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 650, color: T.green }}>En ligne · ligne continue active</span>
          <span style={{ fontSize: 12.5, color: T.textMuted, marginLeft: 8 }}>— les prospects arrivent sans redécrocher</span>
        </div>
        <button onClick={onEnd} disabled={busy}
          style={{ border: 'none', background: 'transparent', color: T.red, cursor: busy ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}>
          {busy ? '…' : 'Terminer la ligne'}
        </button>
      </div>
    );
  }

  if (pending) {
    return (
      <div style={wrap}>
        <motion.span animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: 9, height: 9, borderRadius: 99, background: T.amber, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 650, color: T.amber }}>📞 Votre combiné sonne</span>
          <span style={{ fontSize: 12.5, color: T.textMuted, marginLeft: 8 }}>— décrochez et restez en ligne</span>
        </div>
        <button onClick={onAck}
          style={{ border: 'none', background: 'transparent', color: T.accent, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          J’ai décroché
        </button>
        <button onClick={onEnd} disabled={busy}
          style={{ border: 'none', background: 'transparent', color: T.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <Headphones size={16} style={{ color: T.accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 650, color: T.text }}>Ligne continue</span>
        <span style={{ fontSize: 12.5, color: T.textFaint, marginLeft: 8 }}>— décrochez une fois, enchaînez sans redécrocher</span>
      </div>
      <button onClick={onStart} disabled={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
          border: 'none', cursor: busy ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
          background: T.accent, opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto',
        }}>
        {busy ? 'Appel…' : 'Démarrer'}
      </button>
    </div>
  );
}

const OutcomeChip = React.memo(function OutcomeChip({ T, outcome }) {
  const meta = OUTCOME_META[outcome];
  const tone = { green: [T.green, T.greenBg], amber: [T.amber, T.amberBg], red: [T.red, T.redBg] }[meta.tone];
  const Glyph = outcome === 'done' ? CheckCircle2 : outcome === 'no_answer' ? AlertTriangle : XCircle;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99,
        fontSize: 13, fontWeight: 650, color: tone[0], background: tone[1],
      }}>
      <Glyph size={16} /> {meta.label}
    </motion.div>
  );
});

function CountdownRing({ T, value, max }) {
  const R = 18, C = 2 * Math.PI * R;
  const frac = max ? value / max : 0;
  return (
    <div style={{ position: 'relative', width: 44, height: 44 }}>
      <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="22" cy="22" r={R} fill="none" stroke={T.borderSoft} strokeWidth="4" />
        <circle cx="22" cy="22" r={R} fill="none" stroke={T.accent} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
    </div>
  );
}

function primaryBtn(T) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 30px', borderRadius: 14,
    border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 650, color: '#fff',
    background: T.accent, boxShadow: `0 8px 22px ${T.accent}3a`, transition: 'box-shadow 0.2s, opacity 0.2s',
  };
}
function dangerBtn(T) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12,
    cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.red, background: T.redBg,
    border: `1px solid ${T.red}33`, transition: 'all 0.15s',
  };
}
function secondaryBtn(T) {
  return {
    marginTop: 16, padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontSize: 13,
    fontWeight: 600, color: T.text, background: T.surfaceAlt, border: `1px solid ${T.border}`,
  };
}
function linkBtn(T) {
  return { border: 'none', background: 'transparent', color: T.accent, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
}
