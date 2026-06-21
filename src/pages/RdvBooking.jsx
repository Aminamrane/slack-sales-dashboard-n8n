import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';

/**
 * Page PUBLIQUE de prise / reprogrammation de RDV par lien (token).
 *
 * Design + réactivité calqués sur /live (audit.ownertechnology.com) : layout
 * 3 colonnes (photo du sales / calendrier / créneaux qui slident), bouton
 * "Confirmer" qui slide à côté du créneau choisi. INDÉPENDANTE de /live.
 * Données : endpoints publics du CRM (/api/v1/rdv-booking/{token}/...). Zéro Google.
 *
 * - lien `general` : nouveau prospect -> select -> formulaire nom/tél -> confirmé.
 * - lien `r1`/`r2` : reprogrammation -> select -> confirmé (pas de formulaire).
 */

const API = apiClient.baseUrl;

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DOW = ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'];
const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// Palette /live (Tailwind gray-*)
const K = {
  ink: '#111827', g700: '#374151', g500: '#6b7280', g400: '#9ca3af', g300: '#d1d5db',
  g200: '#e5e7eb', g100: '#f3f4f6', g50: '#f9fafb', emerald: '#34d399', green: '#10b981',
};
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const initials = (name) => (name || 'OT').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
// "2026-06-24 14:00" -> "mercredi 24 juin 2026 à 14:00"
const prettySlot = (slot) => {
  try {
    const [date, time] = String(slot).split(' ');
    const [y, m, d] = date.split('-').map(Number);
    const dow = DAY_NAMES[new Date(y, m - 1, d).getDay()];
    return `${dow} ${d} ${MONTHS[m - 1]} ${y} à ${time}`;
  } catch { return slot; }
};

const STYLE = `
@keyframes rdvSpin { to { transform: rotate(360deg); } }
@keyframes rdvFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.rdv-shell { min-height: 100vh; background: #F3F4F6; display: flex; align-items: center; justify-content: center; padding: 16px; }
.rdv-card { width: 100%; max-width: 1024px; background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(17,24,39,0.08); overflow: hidden; }
.rdv-row { display: flex; min-height: 520px; }
.rdv-left { width: 320px; flex-shrink: 0; border-right: 1px solid #f3f4f6; padding: 28px 26px; display: flex; flex-direction: column; }
.rdv-center { flex: 1; border-right: 1px solid #f3f4f6; padding: 24px 26px; }
.rdv-right { overflow: hidden; transition: width 0.3s ease, padding 0.3s ease; }
.rdv-slot-row { display: flex; gap: 8px; }
.rdv-confirm { transition: opacity 0.2s ease, max-width 0.25s ease, padding 0.2s ease; white-space: nowrap; }
@media (max-width: 880px) {
  .rdv-row { flex-direction: column; min-height: 0; }
  .rdv-left, .rdv-center { width: auto; border-right: none; border-bottom: 1px solid #f3f4f6; }
  .rdv-right { width: 100% !important; padding: 24px 26px !important; }
}
`;

function Spinner({ size = 30, color = K.ink }) {
  return <span style={{ width: size, height: size, display: 'inline-block', borderRadius: '50%', border: `2.5px solid ${color}22`, borderTopColor: color, animation: 'rdvSpin 0.7s linear infinite' }} />;
}

function Icon({ name, size = 16, color = K.g500 }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'clock') return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'globe') return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" /></svg>;
  if (name === 'back') return <svg {...c}><path d="M15 18l-6-6 6-6" /></svg>;
  if (name === 'chevL') return <svg {...c}><path d="M15 18l-6-6 6-6" /></svg>;
  if (name === 'chevR') return <svg {...c}><path d="M9 18l6-6-6-6" /></svg>;
  return null;
}

export default function RdvBooking() {
  const { token } = useParams();
  const [load, setLoad] = useState({ loading: true, error: null });
  const [data, setData] = useState(null);
  const [selDate, setSelDate] = useState(null);
  const [view, setView] = useState(null);
  const [selSlot, setSelSlot] = useState(null);
  const [step, setStep] = useState('select');
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [bookErr, setBookErr] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/v1/rdv-booking/${token}/slots`)
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e))))
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoad({ loading: false, error: null });
        const days = d?.availability?.days || [];
        if (days.length) {
          setSelDate(days[0].date);
          const [y, m] = days[0].date.split('-').map(Number);
          setView({ y, m: m - 1 });
        } else {
          const n = new Date();
          setView({ y: n.getFullYear(), m: n.getMonth() });
        }
      })
      .catch((e) => { if (!cancelled) setLoad({ loading: false, error: e?.detail || 'Ce lien est invalide ou expiré.' }); });
    return () => { cancelled = true; };
  }, [token]);

  const availMap = useMemo(() => {
    const map = {};
    (data?.availability?.days || []).forEach((d) => { map[d.date] = d.slots; });
    return map;
  }, [data]);

  const monthBounds = useMemo(() => {
    const ds = Object.keys(availMap).sort();
    if (!ds.length) return null;
    const f = ds[0].split('-').map(Number); const l = ds[ds.length - 1].split('-').map(Number);
    return { min: f[0] * 12 + (f[1] - 1), max: l[0] * 12 + (l[1] - 1) };
  }, [availMap]);

  const isGeneral = data?.link_type === 'general';
  const isNew = data?.is_new !== false; // nouvelle prise (général ou RDV pas encore posé) vs reprogrammation
  const duration = data?.availability?.duration;
  const slots = (selDate && availMap[selDate]) || [];
  const avatarSrc = data?.sales_avatar ? (data.sales_avatar.startsWith('http') ? data.sales_avatar : API + data.sales_avatar) : null;
  const canSubmit = selDate && selSlot && (!isGeneral || (form.full_name.trim() && form.phone.trim()));

  const grid = useMemo(() => {
    if (!view) return [];
    const first = new Date(view.y, view.m, 1).getDay();
    const n = new Date(view.y, view.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i += 1) cells.push(null);
    for (let d = 1; d <= n; d += 1) cells.push(d);
    return cells;
  }, [view]);

  const book = async () => {
    setSubmitting(true); setBookErr('');
    try {
      const body = { slot_date: selDate, slot_time: selSlot };
      if (isGeneral) Object.assign(body, { full_name: form.full_name.trim(), phone: form.phone.trim(), email: form.email.trim() });
      const r = await fetch(`${API}/api/v1/rdv-booking/${token}/book`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw j;
      setDone({ slot: j.slot }); setStep('confirmed');
    } catch (e) {
      setBookErr(e?.detail || 'La réservation a échoué, réessayez.');
    } finally { setSubmitting(false); }
  };

  const onConfirmSlot = () => { if (isGeneral) setStep('form'); else book(); };

  const shell = (children) => (
    <div className="rdv-shell" style={{ fontFamily: FONT, color: K.ink }}>
      <style>{STYLE}</style>
      {children}
    </div>
  );

  if (load.loading) return shell(<Spinner />);
  if (load.error) {
    return shell(
      <div style={{ background: '#fff', borderRadius: 16, padding: '44px 48px', textAlign: 'center', maxWidth: 420, boxShadow: '0 10px 40px rgba(17,24,39,0.08)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Lien indisponible</h1>
        <p style={{ fontSize: 14, color: K.g500, margin: 0, lineHeight: 1.6 }}>{load.error}</p>
      </div>,
    );
  }
  if (step === 'confirmed' && done) {
    return shell(
      <div style={{ background: '#fff', borderRadius: 16, padding: '48px 52px', textAlign: 'center', maxWidth: 460, boxShadow: '0 10px 40px rgba(17,24,39,0.08)', animation: 'rdvFade 0.4s ease both' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', color: K.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 style={{ fontSize: 23, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>C'est confirmé</h1>
        <p style={{ fontSize: 15, color: K.g500, margin: 0, lineHeight: 1.6 }}>
          Votre rendez-vous est fixé au<br /><b style={{ color: K.ink }}>{prettySlot(done.slot)}</b> (heure de Paris).
        </p>
      </div>,
    );
  }

  // ── Panneau gauche (photo sales + infos) ──
  const leftPanel = (
    <div className="rdv-left">
      {avatarSrc
        ? <img src={avatarSrc} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', marginBottom: 16 }} />
        : <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#374151,#111827)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, marginBottom: 16 }}>{initials(data?.sales_name)}</div>}
      <p style={{ fontSize: 14, color: K.g400, fontWeight: 500, margin: 0 }}>Owner Technology</p>
      <h1 style={{ fontSize: 21, fontWeight: 700, color: K.ink, margin: '4px 0 0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {isNew ? 'Réservez votre audit' : 'Reprogrammez votre rendez-vous'}
      </h1>
      {isNew ? (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12.5, color: K.g500, lineHeight: 1.6, margin: '0 0 8px' }}>Découvrez combien votre entreprise peut économiser chaque année.</p>
          <p style={{ fontSize: 12.5, color: K.g500, lineHeight: 1.6, margin: 0 }}>Nos experts analysent votre situation fiscale et sociale pour identifier les leviers d'optimisation adaptés à votre structure.</p>
        </div>
      ) : (
        data?.sales_name && <p style={{ fontSize: 13, color: K.g500, lineHeight: 1.6, margin: '14px 0 0' }}>Avec <b style={{ color: K.g700 }}>{data.sales_name}</b>. Choisissez un nouveau créneau qui vous convient.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 22 }}>
        {duration ? <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: K.g500 }}><Icon name="clock" color={K.g400} />{duration} min</div> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: K.g500 }}><Icon name="globe" color={K.g400} />Europe/Paris</div>
      </div>
    </div>
  );

  // ── Étape formulaire (lien général) ──
  if (step === 'form') {
    const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 12, border: `1px solid ${K.g300}`, fontFamily: FONT, fontSize: 14, color: K.ink, outline: 'none' };
    return shell(
      <div className="rdv-card">
        <div className="rdv-row">
          {leftPanel}
          <div style={{ flex: 1, padding: '28px 30px' }}>
            <button type="button" onClick={() => setStep('select')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: K.g500, fontSize: 13, fontFamily: FONT, padding: 0, marginBottom: 14 }}>
              <Icon name="back" size={15} color={K.g500} /> Retour aux créneaux
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: K.ink, margin: '0 0 2px' }}>Vos coordonnées</h2>
            <p style={{ fontSize: 14, color: K.g500, margin: '0 0 18px' }}>
              {selDate && `${DAY_NAMES[new Date(`${selDate}T00:00:00`).getDay()]} ${new Date(`${selDate}T00:00:00`).getDate()} ${MONTHS[new Date(`${selDate}T00:00:00`).getMonth()]}`} · {selSlot}
            </p>
            {bookErr && <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>{bookErr}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: K.g700, marginBottom: 5 }}>Nom complet <span style={{ color: '#f87171' }}>*</span></label>
                <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Jean Dupont" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: K.g700, marginBottom: 5 }}>Téléphone <span style={{ color: '#f87171' }}>*</span></label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+33 6 12 34 56 78" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: K.g700, marginBottom: 5 }}>Email</label>
                <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jean@exemple.com" style={inputStyle} />
              </div>
              <button type="button" disabled={!canSubmit || submitting} onClick={book}
                style={{ marginTop: 4, width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: '#fff', background: canSubmit && !submitting ? K.ink : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {submitting ? <Spinner size={16} color="#fff" /> : 'Confirmer le rendez-vous'}
              </button>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  // ── Étape select (calendrier + créneaux) ──
  const noSlots = data?.availability?.enabled === false || (data?.availability?.days || []).length === 0;
  const curMonthVal = view ? view.y * 12 + view.m : 0;
  const prevDisabled = !monthBounds || curMonthVal <= monthBounds.min;
  const nextDisabled = !monthBounds || curMonthVal >= monthBounds.max;

  return shell(
    <div className="rdv-card">
      <div className="rdv-row">
        {leftPanel}

        {/* Calendrier */}
        <div className="rdv-center">
          {noSlots ? (
            <div style={{ height: '100%', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: K.g500, fontSize: 14 }}>
              Aucun créneau disponible pour le moment.
            </div>
          ) : (
            <div style={{ userSelect: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginBottom: 22 }}>
                <span style={{ fontSize: 18 }}><b style={{ color: K.ink, fontWeight: 600 }}>{MONTHS[view.m]}</b> <span style={{ color: K.g400 }}>{view.y}</span></span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" disabled={prevDisabled} onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'none', cursor: prevDisabled ? 'default' : 'pointer' }}><Icon name="chevL" size={20} color={prevDisabled ? K.g300 : K.g700} /></button>
                  <button type="button" disabled={nextDisabled} onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'none', cursor: nextDisabled ? 'default' : 'pointer' }}><Icon name="chevR" size={20} color={nextDisabled ? K.g300 : K.g700} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
                {DOW.map((d) => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: K.g400, padding: '8px 0' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {grid.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} style={{ aspectRatio: '1' }} />;
                  const ds = ymd(view.y, view.m, d);
                  const avail = !!availMap[ds];
                  const sel = ds === selDate;
                  return (
                    <div key={ds} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
                      <button type="button" disabled={!avail} onClick={() => { setSelDate(ds); setSelSlot(null); }}
                        style={{ width: '100%', aspectRatio: '1', borderRadius: 6, border: 'none', fontSize: 14, fontWeight: 600, fontFamily: FONT,
                          cursor: avail ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s',
                          background: sel ? K.ink : avail ? K.g100 : 'transparent', color: sel ? '#fff' : avail ? K.ink : K.g300 }}
                        onMouseEnter={(e) => { if (avail && !sel) e.currentTarget.style.background = K.g200; }}
                        onMouseLeave={(e) => { if (avail && !sel) e.currentTarget.style.background = K.g100; }}>
                        {d}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Créneaux (slide-in) */}
        <div className="rdv-right" style={{ width: selDate && !noSlots ? 264 : 0, padding: selDate && !noSlots ? '24px 22px' : 0 }}>
          {selDate && !noSlots && (
            <div key={selDate} style={{ animation: 'rdvFade 0.3s ease both' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: K.ink, margin: '0 0 14px' }}>
                {`${DOW[new Date(`${selDate}T00:00:00`).getDay()].toLowerCase().replace('.', '.')} ${pad(new Date(`${selDate}T00:00:00`).getDate())}`}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                {slots.map((s) => {
                  const sel = s === selSlot;
                  return (
                    <div key={s} className="rdv-slot-row">
                      <button type="button" onClick={() => setSelSlot(sel ? null : s)}
                        style={{ flex: 1, padding: '12px 14px', borderRadius: 8, fontFamily: FONT, fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center',
                          border: `1px solid ${sel ? K.ink : K.g200}`, background: sel ? K.ink : '#fff', color: sel ? '#fff' : K.g700, transition: 'border-color 0.15s, background 0.15s' }}
                        onMouseEnter={(e) => { if (!sel) e.currentTarget.style.borderColor = K.g400; }}
                        onMouseLeave={(e) => { if (!sel) e.currentTarget.style.borderColor = K.g200; }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          {!sel && <span style={{ width: 7, height: 7, borderRadius: '50%', background: K.emerald }} />}
                          {s}
                        </span>
                      </button>
                      <button type="button" className="rdv-confirm" onClick={onConfirmSlot} disabled={submitting}
                        style={{ padding: sel ? '12px 16px' : 0, borderRadius: 8, border: 'none', background: K.ink, color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                          opacity: sel ? 1 : 0, maxWidth: sel ? 130 : 0, overflow: 'hidden' }}>
                        {submitting && sel ? '…' : 'Confirmer'}
                      </button>
                    </div>
                  );
                })}
              </div>
              {bookErr && <div style={{ marginTop: 12, fontSize: 12.5, color: '#b91c1c' }}>{bookErr}</div>}
            </div>
          )}
        </div>
      </div>
    </div>,
  );
}
