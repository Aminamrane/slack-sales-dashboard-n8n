// Transférer un lead à un autre sales, depuis la fiche (dev 11/11/2026). Le sales choisit un collègue dans un menu
// (photo, nom), confirme, et le lead part chez lui : dans ses Nouveaux leads avec la mention « Transféré par… »,
// avec 3 jours pour le traiter s'il n'a aucun rendez-vous à venir ; s'il en a un, aucun délai et le rendez-vous
// passe dans l'agenda du collègue. Les règles sont celles du serveur : la fiche ne fait que les annoncer.
// Tant que le serveur ne sert pas l'annuaire, rien ne s'affiche.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft, CalendarCheck2, Check, Clock3 } from 'lucide-react';
import apiClient from '../../services/apiClient';

const ROOT = '/api/v1/tracking/leads';
let directory = null;                 // l'annuaire ne change pas d'un lead à l'autre
const STAGES = [['r1', 'R1'], ['r2', 'R2'], ['r3', 'R3']];

// Les dates de rendez-vous sont en heure murale de Paris : on les compare à l'heure murale de Paris, sans fuseau.
const wall = (value) => (typeof value === 'string' ? value.slice(0, 16) : '');
const parisNow = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).replace(' ', 'T').slice(0, 16);
// Prochain rendez-vous à venir du lead, pour annoncer ce qui sera transféré (le serveur tranche).
export function upcomingRdv(lead, now = parisNow()) {
  return STAGES.map(([stage, label]) => ({ stage, label, at: wall(lead?.[stage] || lead?.[`${stage}_date`]) }))
    .filter((r) => r.at && r.at > now).sort((a, b) => a.at.localeCompare(b.at))[0] || null;
}
const day = (at) => new Date(`${at}:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const hour = (at) => at.slice(11, 16).replace(':', 'h');
const short = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function Face({ person, size = 26, C }) {
  const letters = String(person?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return person?.avatar_url
    ? <img src={person.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: C.subtle, color: C.secondary, fontSize: Math.round(size * 0.4), fontWeight: 500 }}>{letters}</span>;
}

// La ligne « Transfert » de la partie Infos de la fiche, au même gabarit que les autres (icône, petit titre, valeur) :
// de qui le lead a été reçu et le délai qui court, le geste « Donner ce lead à un sales », et l'historique replié.
export default function LeadTransfer({ lead, C, darkMode, canGive = true, onDone }) {
  const [people, setPeople] = useState(directory);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);   // transfert confirmé : on le dit une seconde, puis la fiche se ferme
  const [past, setPast] = useState(false);  // historique déplié
  const ref = useRef(null);
  const menuRef = useRef(null);
  const [place, setPlace] = useState(null);  // position du menu à l'écran
  useEffect(() => {
    if (directory) return undefined;
    let alive = true;
    apiClient.get('/api/v1/tracking/lead-transfers/targets')
      .then((r) => { directory = Array.isArray(r?.people) ? r.people : []; if (alive) setPeople(directory); })
      .catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { setOpen(false); setPick(null); setError(''); setPast(false); }, [lead?.id]);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (!ref.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); };
  }, [open]);
  // Le menu sort de la fiche (portail, position fixe) : les blocs animés du dessous passaient par-dessus et le bas du
  // volet le coupait. Il s'ouvre sous la ligne, ou au-dessus quand la place manque, et suit le défilement.
  const peopleCount = people?.length || 0;
  useLayoutEffect(() => {
    if (!open) { setPlace(null); return undefined; }
    const measure = () => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      const height = Math.min(264, peopleCount * 46 + 10);
      const below = window.innerHeight - box.bottom - 12;
      const up = below < height && box.top - 12 > below;
      const room = Math.max(120, (up ? box.top : window.innerHeight - box.bottom) - 18);
      setPlace({ left: box.left + 30, width: Math.max(220, box.width - 30), maxHeight: Math.min(264, room),
        ...(up ? { bottom: window.innerHeight - box.top + 6 } : { top: box.bottom + 6 }) });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [open, peopleCount]);
  const giving = canGive && !!people?.length;
  const received = !!lead?.transferred_from_name;
  const count = lead?.transfer_count || 0;
  if (!giving && !received && !count) return null;

  const rdv = upcomingRdv(lead);
  const send = async () => {
    if (!pick || busy) return;
    setBusy(true); setError('');
    try {
      const result = await apiClient.post(`${ROOT}/${lead.id}/transfer`, { to_user_id: pick.id });
      setDone(pick);
      setTimeout(() => onDone?.({ ...result, to: pick }), 1100);
    } catch (e) {
      setError(e?.data?.detail || e?.message || 'Le transfert n’a pas pu se faire. Réessayez.');
    } finally { setBusy(false); }
  };
  const link = { padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'left' };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <ArrowRightLeft size={16} color={C.accent} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Transfert</div>
        {received && (
          <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
            Reçu de {lead.transferred_from_name}
            {lead.transfer_deadline && <span style={{ color: C.muted, fontWeight: 400 }}> · à traiter avant le {short(lead.transfer_deadline)}</span>}
          </div>
        )}
        {!pick && !done && (giving || count > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {giving && <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ ...link, color: C.accent }}>Donner ce lead à un sales</button>}
            {count > 0 && <button type="button" aria-expanded={past} onClick={() => setPast((v) => !v)} style={{ ...link, color: C.muted }}>{past ? 'Masquer l’historique' : `Historique (${count})`}</button>}
          </div>
        )}
        {past && !pick && !done && <TransferHistory leadId={lead.id} count={count} C={C} />}
        {done && (
          <div role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12, fontWeight: 500, color: darkMode ? '#7cc49b' : '#0b7a4b', animation: 'solarFadeIn 0.2s ease both' }}>
            <Check size={14} />Lead transféré à {done.name}
          </div>
        )}
        {pick && !done && (
          <div role="group" aria-label={`Transférer à ${pick.name}`} style={{ marginTop: 6, padding: '12px 14px', borderRadius: 14, background: C.subtle, animation: 'solarFadeIn 0.18s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Face person={pick} size={30} C={C} />
              <span style={{ fontSize: 13.5, color: C.text }}>Donner ce lead à <span style={{ fontWeight: 500 }}>{pick.name}</span> ?</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: C.secondary }}>
              {rdv ? <CalendarCheck2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <Clock3 size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
              <span>{rdv
                ? <>Son {rdv.label} du {day(rdv.at)} à {hour(rdv.at)} passe dans son agenda. Aucun délai.</>
                : <>Il arrive dans ses Nouveaux leads, avec 3 jours pour le traiter.</>}</span>
            </div>
            {error && <div role="alert" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, fontSize: 12.5, background: darkMode ? '#3a2020' : '#fde6e6', color: darkMode ? '#f3a6a3' : '#c5221f' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
              <button type="button" disabled={busy} onClick={() => { setPick(null); setError(''); }}
                style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 'none', background: 'transparent', color: C.muted, fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>Annuler</button>
              <button type="button" disabled={busy} onClick={send}
                style={{ height: 34, padding: '0 14px', borderRadius: 10, border: 'none', background: C.accent, color: C.onAccent, fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Transfert…' : 'Transférer'}</button>
            </div>
          </div>
        )}
      </div>
      {open && !pick && place && createPortal(
        <div ref={menuRef} role="menu" aria-label="Choisir le sales qui reçoit le lead" style={{ position: 'fixed', left: place.left, width: place.width, top: place.top, bottom: place.bottom,
          zIndex: 9000, maxHeight: place.maxHeight, overflowY: 'auto', padding: 5, borderRadius: 14, border: `1px solid ${C.border}`, background: C.bg, boxShadow: C.popShadow,
          animation: 'solarFadeIn 0.16s ease both' }}>
          {people.map((person, index) => (
            <button key={person.id} type="button" role="menuitem" className="lt-person" onClick={() => { setPick(person); setOpen(false); }}
              style={{ '--i': index, display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 9px', border: 'none', borderRadius: 10, background: 'transparent',
                color: C.text, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.subtle; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <Face person={person} C={C} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</span>
                {person.detail && <span style={{ display: 'block', fontSize: 11.5, color: C.muted }}>{person.detail}</span>}
              </span>
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
}

// Mention sur la ligne et dans la fiche d'un lead reçu : qui l'a transféré, et le délai qui court s'il y en a un.
export function TransferTag({ lead, darkMode, compact = false }) {
  if (!lead?.transferred_from_name) return null;
  const tone = darkMode ? ['rgba(59,130,246,.14)', '#8fb8ee', 'rgba(59,130,246,.26)'] : ['#e4f0fd', '#1b6fd0', '#c9e0fa'];
  const first = String(lead.transferred_from_name).split(/\s+/)[0];
  const until = lead.transfer_deadline ? ` · à traiter avant le ${short(lead.transfer_deadline)}` : '';
  return (
    <span title={`Transféré par ${lead.transferred_from_name}${lead.transferred_at ? ` le ${short(lead.transferred_at)}` : ''}${until}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: compact ? '1px 7px' : '2px 8px', borderRadius: 7, fontSize: compact ? 10.5 : 11.5, fontWeight: 500, whiteSpace: 'nowrap',
        background: tone[0], color: tone[1], border: `1px solid ${tone[2]}` }}>
      <ArrowRightLeft size={compact ? 10 : 11} />{compact ? `Transféré par ${first}` : `Transféré par ${lead.transferred_from_name}${until}`}
    </span>
  );
}

// Historique des transferts d'un lead, en frise discrète (du plus récent au plus ancien), dépliée depuis la ligne.
function TransferHistory({ leadId, count = 0, C }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (!leadId || !count) { setItems(null); return undefined; }
    let alive = true;
    apiClient.get(`${ROOT}/${leadId}/transfers`).then((r) => { if (alive) setItems(Array.isArray(r?.transfers) ? r.transfers : []); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [leadId, count]);
  if (!items) return null;
  if (!items.length) return <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>Aucun transfert enregistré.</div>;
  return (
    <div style={{ marginTop: 6, animation: 'solarFadeIn 0.18s ease both' }}>
      {items.map((t, index) => (
        <div key={t.id || index} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 6, background: index === 0 ? C.text : C.border }} />
            {index < items.length - 1 && <span style={{ flex: 1, width: 1, background: C.border, marginTop: 3 }} />}
          </span>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: C.secondary, paddingBottom: 6 }}>
            <span style={{ color: C.text, fontWeight: 500 }}>{t.from_name}</span> → <span style={{ color: C.text, fontWeight: 500 }}>{t.to_name}</span>
            <span style={{ color: C.muted }}> · {short(t.created_at)}{t.had_rdv ? ' · rendez-vous transféré' : t.deadline ? ` · à traiter avant le ${short(t.deadline)}` : ''}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
