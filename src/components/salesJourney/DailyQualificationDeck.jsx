// Pop-up « RDV à qualifier » (dev 06/10/2026) : à l'ouverture de sa sheet, le commercial qualifie en
// quelques clics les rendez-vous passés restés sans résultat, un par slide. Mêmes résultats et même
// enregistrement que la qualification de la sheet : `onSave(lead, stage, payload)` passe par
// qualificationPatch puis le PATCH du lead, côté TrackingSheet.
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CalendarCheck2, CalendarClock, CalendarPlus, Check, CircleX, Clock3, UserRoundCheck, UserRoundX, X } from 'lucide-react';
import { ParisDateTimeInput } from './FrenchDateInput';
import { RESULTS, useDialogFocus } from './QualificationDialog';
import { rdvLabel } from '../../utils/dailyQualification';
import './salesJourney.css';

const ATTENDANCE = {
  r1: [
    ['done', 'Présent', 'Le rendez-vous a eu lieu', UserRoundCheck],
    ['no_show', 'Absent', 'Le client ne s’est pas présenté', UserRoundX],
    ['rescheduled', 'Reporté', 'Choisir la nouvelle date', CalendarClock],
    ['cancelled', 'Annulé', 'Le rendez-vous n’aura pas lieu', CircleX],
  ],
  later: [
    ['present', 'Présent', 'Le rendez-vous a eu lieu', UserRoundCheck],
    ['no_show', 'Absent', 'Le client ne s’est pas présenté', UserRoundX],
    ['reporte', 'Reporté', 'Choisir la nouvelle date', CalendarClock],
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
    <div className="sj-options">
      {items.map(([key, title, desc, Icon]) => (
        <button key={key} type="button" disabled={disabled} aria-pressed={value === key} className={value === key ? 'is-selected' : ''} onClick={() => onPick(key)}>
          <Icon size={21} /><span><strong>{title}</strong><small>{desc}</small></span>{value === key && <Check size={16} />}
        </button>
      ))}
    </div>
  );
}

// Payload attendu par qualificationPatch, ou null tant que la saisie est incomplète.
export function deckPayload(stage, { choice, next, result, date }) {
  if (!choice) return null;
  if (stage === 'r1') {
    if (choice === 'done') {
      if (!next) return null;
      if (next === 'r2_set' && !date) return null;
      return { result: 'done', attended: true, date: next === 'r2_set' ? date : '', followUp: next };
    }
    if (choice === 'rescheduled' && !date) return null;
    return { result: choice, attended: false, date: choice === 'rescheduled' ? date : '' };
  }
  if (choice === 'present') return result ? { result, attended: true, date: '' } : null;
  if (choice === 'reporte' && !date) return null;
  return { result: choice, attended: false, date: choice === 'reporte' ? date : '' };
}

export default function DailyQualificationDeck({ items, onSave, onClose, onOpenLead, dark = false }) {
  const [index, setIndex] = useState(0);                 // 0 = intro, 1..n = RDV, n + 1 = fin
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState({});
  const [done, setDone] = useState({});                  // clé du RDV → libellé du résultat
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const ref = useRef(null);
  useDialogFocus(ref, onClose, busy);

  const total = items.length;
  const current = index >= 1 && index <= total ? items[index - 1] : null;
  const payload = current ? deckPayload(current.stage, form) : null;
  const doneCount = Object.keys(done).length;

  const go = (to) => { setDir(to > index ? 1 : -1); setIndex(to); setForm({}); setError(''); };
  const nextOpen = (from) => {
    for (let i = from; i <= total; i += 1) if (!done[items[i - 1].key]) return i;
    return total + 1;
  };

  async function save() {
    if (!current || !payload || busy) return;
    setBusy(true); setError('');
    try {
      await onSave(current.lead, current.stage, payload);
      const label = current.stage === 'r1'
        ? ATTENDANCE.r1.find(([k]) => k === payload.result)?.[1]
        : (payload.attended ? RESULTS.find(([k]) => k === payload.result)?.[1] : ATTENDANCE.later.find(([k]) => k === payload.result)?.[1]);
      setDone((prev) => ({ ...prev, [current.key]: label || 'Qualifié' }));
      go(nextOpen(index + 1));
    } catch (e) {
      setError(e.message || 'La qualification n’a pas été enregistrée. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  const stageName = current ? current.stage.toUpperCase() : '';
  const needsDate = current && ((current.stage === 'r1' && (form.choice === 'rescheduled' || (form.choice === 'done' && form.next === 'r2_set')))
    || (current.stage !== 'r1' && form.choice === 'reporte'));

  return createPortal(
    <div className={`sj-overlay ${dark ? 'sj-dark' : ''}`} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section ref={ref} tabIndex={-1} className="sj-dialog" role="dialog" aria-modal="true" aria-labelledby="dq-title" style={{ overflowX: 'hidden' }}>
        <header className="sj-head">
          <span className="sj-icon"><CalendarCheck2 size={24} /></span>
          <div>
            <small>{current ? `RENDEZ-VOUS ${index} SUR ${total}` : 'QUALIFICATION DES RENDEZ-VOUS'}</small>
            <h2 id="dq-title">{current ? `${stageName} · ${who(current.lead)}` : 'Vos rendez-vous à qualifier'}</h2>
            <p>{current ? rdvLabel(current.at) : `${total} rendez-vous passé${total > 1 ? 's' : ''} sans résultat`}</p>
          </div>
          <button className="sj-close" disabled={busy} onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </header>
        <div style={{ height: 3, background: 'var(--sj-soft)' }}>
          <motion.div initial={false} animate={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} transition={{ duration: 0.45, ease: EASE }}
            style={{ height: 3, background: '#3e7d5a' }} />
        </div>
        <div className="sj-body" style={{ position: 'relative', minHeight: 260 }}>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={index} custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
              {index === 0 && (
                <>
                  <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.55 }}>
                    Indiquez pour chacun si le client s’est présenté. Un absent sur un R1 posé par un setter le prévient tout de suite, pour qu’il relance le client.
                  </p>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {items.map((it) => (
                      <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--sj-soft)', fontSize: 13 }}>
                        <strong style={{ minWidth: 26 }}>{it.stage.toUpperCase()}</strong>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who(it.lead)}</span>
                        <span style={{ color: 'var(--sj-muted)', whiteSpace: 'nowrap' }}>{rdvLabel(it.at)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {current && (
                <>
                  {current.lead.full_name && who(current.lead) !== current.lead.full_name && (
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--sj-muted)' }}>{current.lead.full_name}{current.lead.phone ? ` · ${current.lead.phone}` : ''}</p>
                  )}
                  <h3 style={{ marginTop: 0 }}>Le client s’est-il présenté ?</h3>
                  <Options items={current.stage === 'r1' ? ATTENDANCE.r1 : ATTENDANCE.later} value={form.choice} disabled={busy}
                    onPick={(choice) => { setForm({ choice }); setError(''); }} />
                  {current.stage === 'r1' && form.choice === 'done' && (
                    <>
                      <h3>Quelle est la prochaine étape ?</h3>
                      <Options items={R1_NEXT} value={form.next} disabled={busy} onPick={(next) => { setForm((f) => ({ ...f, next, date: '' })); setError(''); }} />
                    </>
                  )}
                  {current.stage !== 'r1' && form.choice === 'present' && (
                    <>
                      <h3>Où en est le client ?</h3>
                      <Options items={RESULTS} value={form.result} disabled={busy} onPick={(result) => { setForm((f) => ({ ...f, result })); setError(''); }} />
                    </>
                  )}
                  {needsDate && (
                    <ParisDateTimeInput key={`${form.choice}-${form.next || ''}`} disabled={busy} value={form.date || ''}
                      label={form.next === 'r2_set' ? 'Date et heure du R2' : `Nouvelle date du ${stageName}`}
                      onChange={(date) => { setForm((f) => ({ ...f, date })); setError(''); }} />
                  )}
                  {onOpenLead && (
                    <button type="button" className="sj-contract-alternative" disabled={busy} onClick={() => onOpenLead(current.lead.id)} style={{ marginTop: 16 }}>
                      <span>Le client est prêt à signer, ou il faut plus de détails<strong>Ouvrir la fiche</strong></span><ArrowRight size={17} />
                    </button>
                  )}
                </>
              )}
              {index === total + 1 && (
                <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    style={{ width: 56, height: 56, borderRadius: 999, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'rgba(62,125,90,0.14)', color: '#3e7d5a' }}>
                    <Check size={28} strokeWidth={2.6} />
                  </motion.div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>{doneCount === total ? 'Tout est qualifié, merci.' : `${doneCount} sur ${total} qualifiés.`}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--sj-muted)' }}>
                    {doneCount === total ? 'Vos setters et vos chiffres sont à jour.' : 'Les autres restent dans vos conteneurs « En attente ».'}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          {error && <p className="sj-error" role="alert">{error}</p>}
        </div>
        <footer className="sj-footer">
          {index === 0 && <>
            <button type="button" onClick={onClose}>Plus tard</button>
            <button type="button" className="sj-primary" onClick={() => go(1)}>Commencer<ArrowRight size={17} /></button>
          </>}
          {current && <>
            <button type="button" disabled={busy} onClick={() => go(Math.min(index + 1, total + 1))}>Passer</button>
            <button type="button" className="sj-primary" disabled={busy || !payload} onClick={save}>
              {busy ? 'Enregistrement…' : index === total ? 'Enregistrer' : 'Enregistrer et continuer'}<ArrowRight size={17} />
            </button>
          </>}
          {index === total + 1 && <button type="button" className="sj-primary" onClick={onClose}>Fermer</button>}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
