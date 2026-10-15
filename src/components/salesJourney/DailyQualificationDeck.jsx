// Pop-up « RDV à qualifier » (dev 06/10/2026) : à l'ouverture de sa sheet, le commercial qualifie en
// quelques clics les rendez-vous passés restés sans résultat, un par slide. Mêmes résultats et même
// enregistrement que la qualification de la sheet : `onSave(lead, stage, payload)` passe par
// qualificationPatch puis le PATCH du lead, côté TrackingSheet.
// Obligatoire (dev 14/10/2026 : « s'ils ne qualifient pas tous leurs rendez-vous, ils ne pourront pas accéder à
// leur tracking sheet » ; « il n'y a pas de "je passe" ») : ni croix, ni Échap, ni clic à côté, ni « Passer » ; chaque
// RDV est qualifié dans l'ordre et seule la fin, tout qualifié, ouvre la sheet. L'accueil ne liste plus les RDV : deux clients qui attendent (animations du dev,
// After Effects).
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { ArrowRight, CalendarCheck2, CalendarClock, CalendarPlus, Check, CircleX, Clock3, UserRoundCheck, UserRoundX } from 'lucide-react';
import { ParisDateTimeInput } from './FrenchDateInput';
import { RESULTS, useDialogFocus } from './QualificationDialog';
import { ActionButton, Celebration, CountUp, PickCheck, ProgressSegments, Stamp } from './DailyQualificationMotion';
import { rdvLabel } from '../../utils/dailyQualification';
import { TO_RESCHEDULE, deckPayload, isReported, needsDeckDate } from '../../utils/deckPayload';
import { RELANCE_CHOICES, REPORT_CHOICES } from './missedChoices';
import './salesJourney.css';

const ATTENDANCE = {
  r1: [
    ['done', 'Présent', 'Le rendez-vous a eu lieu', UserRoundCheck],
    ['no_show', 'Absent', 'Le client ne s’est pas présenté', UserRoundX],
    ['rescheduled', 'Reporté', 'Avec ou sans nouvelle date', CalendarClock],
    ['cancelled', 'Annulé', 'Le rendez-vous n’aura pas lieu', CircleX],
  ],
  later: [
    ['present', 'Présent', 'Le rendez-vous a eu lieu', UserRoundCheck],
    ['no_show', 'Absent', 'Le client ne s’est pas présenté', UserRoundX],
    ['reporte', 'Reporté', 'Avec ou sans nouvelle date', CalendarClock],
    ['annule', 'Annulé', 'Le rendez-vous n’aura pas lieu', CircleX],
  ],
};
const R1_NEXT = [
  ['r2_set', 'Placer le R2', 'Planifier le rendez-vous d’audit', CalendarPlus],
  ['later', 'Décider plus tard', 'Enregistrer le R1 effectué', Clock3],
];
const EASE = [0.22, 1, 0.36, 1];
const slide = {
  enter: (dir) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.32, ease: EASE } },
  exit: (dir) => ({ x: dir > 0 ? -48 : 48, opacity: 0, transition: { duration: 0.2, ease: EASE } }),
};

const who = (lead) => lead.company_name || lead.company || lead.full_name || `Lead ${lead.id}`;

function Options({ items, value, onPick, disabled }) {
  return (
    <Motion.div className="sj-options" initial="hidden" animate="shown" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.05 } } }}>
      {items.map(([key, title, desc, icon]) => {
        const Icon = icon;
        const on = value === key;
        return (
          <Motion.button key={key} type="button" disabled={disabled} aria-pressed={on} className={`dq-option${on ? ' is-selected' : ''}`} onClick={() => onPick(key)}
            variants={{
              hidden: { opacity: 0, y: 10 },
              shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: EASE } },
              picked: { opacity: 1, y: 0, scale: [1, 1.025, 1], transition: { duration: 0.3, ease: EASE } },
            }}
            animate={on ? 'picked' : 'shown'} whileHover={disabled ? undefined : { y: -2 }} whileTap={disabled ? undefined : { scale: 0.97 }}>
            <Motion.span className="dq-option-icon" animate={{ scale: on ? 1.08 : 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}><Icon size={21} /></Motion.span>
            <span><strong>{title}</strong><small>{desc}</small></span>
            <PickCheck on={on} />
          </Motion.button>
        );
      })}
    </Motion.div>
  );
}

// Question suivante qui se déplie sous la précédente. Le débord n'est masqué que pendant l'animation : ensuite, le
// calendrier de la date (fenêtre flottante) doit pouvoir passer par-dessus les cartes.
function Reveal({ children }) {
  const [settled, setSettled] = useState(false);
  return (
    <Motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.32, ease: EASE }} style={{ overflow: settled ? 'visible' : 'hidden' }}
      onAnimationStart={() => setSettled(false)} onAnimationComplete={() => setSettled(true)}>
      {children}
    </Motion.div>
  );
}

const ASSETS = '/qualification/';
const RISE = { hidden: { opacity: 0, y: 12 }, shown: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } } };
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Les deux clients qui attendent : chacun joue son entrée (1re vidéo, une fois), puis sa boucle (2e vidéo, qui se
// referme sur elle-même sans saut). Les quatre vidéos partagent le même cadrage : superposées, elles retrouvent la
// composition d'After Effects. La fille passe DEVANT l'ambulancier : un petit canvas WebGL compose les deux couches et
// rend transparent le fond blanc de la fille (ce qui est en couleur la masque). Sans WebGL : les vidéos fondues
// (multiply), la fille en dernier.
const VERTEX = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
const FRAGMENT = 'precision mediump float;varying vec2 v;uniform sampler2D back;uniform sampler2D front;'
  + 'void main(){vec3 b=texture2D(back,v).rgb;vec3 f=texture2D(front,v).rgb;'
  + 'float a=1.-smoothstep(.9,.985,min(min(f.r,f.g),f.b));gl_FragColor=vec4(mix(b,f,a),1.);}';

function compositor(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const shader = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const textures = ['back', 'front'].map((name, unit) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
    return tex;
  });
  return (back, front) => {
    [back, front].forEach((video, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, textures[unit]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    });
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}

function WaitingClients() {
  const canvas = useRef(null);
  const videos = useRef({});
  const [mode, setMode] = useState('canvas');           // canvas | fallback
  const [looping, setLooping] = useState(() => (reduceMotion() ? { ambulancier: true, fille: true } : {}));
  const phase = useRef(looping);
  phase.current = looping;
  const toLoop = (who) => {
    const v = videos.current[`${who}-boucle`];
    setLooping((s) => ({ ...s, [who]: true }));
    v?.play().catch(() => {});
  };
  useEffect(() => {
    const draw = canvas.current && compositor(canvas.current);
    if (!draw) { setMode('fallback'); return undefined; }
    let raf = 0;
    const tick = () => {
      const pick = (who) => videos.current[`${who}-${phase.current[who] ? 'boucle' : 'intro'}`];
      const back = pick('ambulancier'), front = pick('fille');
      if (back?.readyState >= 2 && front?.readyState >= 2) draw(back, front);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const layer = (who, kind) => {
    const on = (kind === 'boucle') === !!looping[who];
    return (
      <video key={`${who}-${kind}`} ref={(el) => { videos.current[`${who}-${kind}`] = el; }}
        className={`dq-layer${mode === 'fallback' && on ? ' is-on' : ''}`} src={`${ASSETS}${who}-${kind}.mp4`} muted playsInline preload="auto"
        autoPlay={kind === 'intro' && !reduceMotion()} loop={kind === 'boucle'} onEnded={kind === 'intro' ? () => toLoop(who) : undefined} />
    );
  };
  return (
    <div className="dq-stage" aria-hidden="true">
      {['ambulancier', 'fille'].flatMap((who) => (reduceMotion() ? [layer(who, 'boucle')] : [layer(who, 'intro'), layer(who, 'boucle')]))}
      {mode === 'canvas' && <canvas ref={canvas} width={384} height={552} className="dq-canvas" />}
    </div>
  );
}

export default function DailyQualificationDeck({ items, onSave, onClose, dark = false }) {
  const [index, setIndex] = useState(0);                 // 0 = accueil, 1..n = RDV, n + 1 = fin
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState({});
  const [done, setDone] = useState({});                  // clé du RDV → libellé du résultat
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [stamp, setStamp] = useState(null);             // résultat affiché un instant après l'enregistrement
  const ref = useRef(null);
  const total = items.length;
  const doneCount = Object.keys(done).length;
  const finished = total > 0 && doneCount === total;
  // Obligatoire : la fenêtre ne se ferme qu'une fois tout qualifié.
  const requestClose = () => { if (finished && !busy) onClose(); };
  useDialogFocus(ref, requestClose, busy);
  useEffect(() => { if (!total) onClose(); }, [total, onClose]);

  const current = index >= 1 && index <= total ? items[index - 1] : null;
  const payload = current ? deckPayload(current.stage, form) : null;

  const go = (to) => { setDir(to > index ? 1 : -1); setIndex(to); setForm({}); setError(''); };

  async function save() {
    if (!current || !payload || busy) return;
    setBusy(true); setError('');
    try {
      await onSave(current.lead, current.stage, payload);
      const label = payload.result === TO_RESCHEDULE[current.stage] ? 'À reporter'
        : current.stage === 'r1'
          ? ATTENDANCE.r1.find(([k]) => k === payload.result)?.[1]
          : (payload.attended ? RESULTS.find(([k]) => k === payload.result)?.[1] : ATTENDANCE.later.find(([k]) => k === payload.result)?.[1]);
      setDone((prev) => ({ ...prev, [current.key]: label || 'Qualifié' }));
      setStamp(label || 'Qualifié');
      await new Promise((r) => setTimeout(r, reduceMotion() ? 0 : 620));
      setStamp(null);
      go(index + 1);                                    // pas de « Passer » : chaque RDV est qualifié dans l'ordre
    } catch (e) {
      setError(e.message || 'La qualification n’a pas été enregistrée. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  const stageName = current ? current.stage.toUpperCase() : '';
  const needsDate = current && needsDeckDate(current.stage, form);

  return createPortal(
    <div className={`sj-overlay ${dark ? 'sj-dark' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <section ref={ref} tabIndex={-1} className={`sj-dialog${index === 0 || index === total + 1 ? ' dq-welcome' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dq-title" style={{ overflowX: 'hidden' }}>
        {current && (
          <header className="sj-head">
            <span className="sj-icon"><CalendarCheck2 size={24} /></span>
            <div>
              <small>{`RENDEZ-VOUS ${index} SUR ${total}`}</small>
              <h2 id="dq-title">{`${stageName} · ${who(current.lead)}`}</h2>
              <p>{rdvLabel(current.at)}</p>
            </div>
          </header>
        )}
        {current && <ProgressSegments total={total} current={index} done={doneCount} />}
        <div className={current ? 'sj-body' : 'dq-welcome-body'} style={{ position: 'relative', minHeight: current ? 260 : 0 }}>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <Motion.div key={index} custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
              {index === 0 && (
                <Motion.div className="dq-intro" initial="hidden" animate="shown" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }}>
                  <Motion.div variants={{ hidden: { opacity: 0, scale: 0.94, y: 8 }, shown: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}>
                    <WaitingClients />
                  </Motion.div>
                  <Motion.h2 id="dq-title" variants={RISE}><CountUp value={total} /> rendez-vous vous attendent</Motion.h2>
                  <Motion.p variants={RISE}>Qualifiez-les pour ouvrir votre Tracking Sheet.</Motion.p>
                  <Motion.div variants={RISE}><ActionButton className="is-big" launch onClick={() => go(1)}>Commencer</ActionButton></Motion.div>
                </Motion.div>
              )}
              {current && (
                <>
                  {current.lead.full_name && who(current.lead) !== current.lead.full_name && (
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--sj-muted)' }}>{current.lead.full_name}{current.lead.phone ? ` · ${current.lead.phone}` : ''}</p>
                  )}
                  <h3 style={{ marginTop: 0 }}>Le client s’est-il présenté ?</h3>
                  <Options items={current.stage === 'r1' ? ATTENDANCE.r1 : ATTENDANCE.later} value={form.choice} disabled={busy}
                    onPick={(choice) => { setForm({ choice }); setError(''); }} />
                  <AnimatePresence initial={false}>
                    {current.stage === 'r1' && form.choice === 'done' && (
                      <Reveal key="next">
                        <h3>Quelle est la prochaine étape ?</h3>
                        <Options items={R1_NEXT} value={form.next} disabled={busy} onPick={(next) => { setForm((f) => ({ ...f, next, date: '' })); setError(''); }} />
                      </Reveal>
                    )}
                    {form.choice === 'no_show' && (
                      <Reveal key="relance">
                        <h3>Relancer le client ?</h3>
                        <Options items={RELANCE_CHOICES} value={form.relance} disabled={busy} onPick={(relance) => { setForm((f) => ({ ...f, relance })); setError(''); }} />
                      </Reveal>
                    )}
                    {isReported(form.choice) && (
                      <Reveal key="when">
                        <h3>La nouvelle date ?</h3>
                        <Options items={REPORT_CHOICES} value={form.when} disabled={busy} onPick={(when) => { setForm((f) => ({ ...f, when, date: '' })); setError(''); }} />
                      </Reveal>
                    )}
                    {current.stage !== 'r1' && form.choice === 'present' && (
                      <Reveal key="result">
                        <h3>Où en est le client ?</h3>
                        <Options items={RESULTS} value={form.result} disabled={busy} onPick={(result) => { setForm((f) => ({ ...f, result })); setError(''); }} />
                      </Reveal>
                    )}
                    {needsDate && (
                      <Reveal key={`date-${form.choice}-${form.next || form.when || ''}`}>
                        <ParisDateTimeInput disabled={busy} value={form.date || ''}
                          label={form.next === 'r2_set' ? 'Date et heure du R2' : `Nouvelle date du ${stageName}`}
                          onChange={(date) => { setForm((f) => ({ ...f, date })); setError(''); }} />
                      </Reveal>
                    )}
                  </AnimatePresence>
                </>
              )}
              {index === total + 1 && (
                <Celebration total={total}><ActionButton className="is-big" launch onClick={requestClose}>Ouvrir ma Tracking Sheet</ActionButton></Celebration>
              )}
            </Motion.div>
          </AnimatePresence>
          {error && <p className="sj-error" role="alert">{error}</p>}
          <Stamp label={stamp} />
        </div>
        {current && (
          <footer className="sj-footer">
            <ActionButton disabled={!payload} busy={busy && !stamp} onClick={save}>{index < total ? 'Enregistrer et continuer' : 'Enregistrer'}</ActionButton>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
