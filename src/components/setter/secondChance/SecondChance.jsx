// « Seconde chance » (dev 06/10/2026) : les leads que les commerciaux n'ont pas concrétisés (R1 annulé, R2
// annulé ou « pas intéressé »). Le setter lit tout le parcours (notes, appels, RDV, e-mails), reprend le lead
// (réservé 3 jours, numéro visible ensuite) et repose un rendez-vous : R1 par l'agenda unique, R2 avec son
// commercial. Les données viennent de /tracking/setter/second-chance.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban, CalendarCheck2, CalendarPlus, CalendarX2, CheckCircle2, Clock3, Mail, MessageSquare, Phone, PhoneCall,
  RotateCcw, Search, Sparkles, StickyNote, Undo2, UserCheck, UserRoundX,
} from 'lucide-react';
import SetterJourneyDialog from '../SetterJourneyDialog';
import { SalesNotesView } from '../../salesJourney/SalesNotes';
import { originDisplay } from '../../../utils/sectors';
import { STAGE_TONE, countItems, filterItems, itemState, outcomeLabel, untilLabel, wallLabel } from '../../../utils/secondChance';
import { errorMessage, secondChanceApi } from './secondChanceApi';

const REFRESH_MS = 60000;
const EVENT_ICON = {
  lead_created: Sparkles, assigned: UserCheck, calls: PhoneCall, rdv_placed: CalendarPlus, rdv: CalendarCheck2,
  no_show: UserRoundX, emails: Mail, second_chance: RotateCcw, notes_updated: StickyNote,
};

function tint(hex, a) {
  const n = parseInt((hex || '#8b94a6').replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function Badge({ color, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 650,
      background: tint(color, 0.13), color: 'inherit', border: `1px solid ${tint(color, 0.35)}`, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />{children}
    </span>
  );
}

function Button({ C, darkMode, kind = 'secondary', icon: Icon, children, ...props }) {
  const styles = {
    primary: { background: darkMode ? '#eef0f6' : '#1e2330', color: darkMode ? '#1e2330' : '#fff', border: 'none' },
    secondary: { background: C.bg, color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: 'transparent', color: C.secondary, border: '1px solid transparent' },
    danger: { background: 'transparent', color: '#c25555', border: '1px solid transparent' },
  }[kind];
  return (
    <button type="button" {...props}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, fontSize: 13, fontWeight: 600,
        fontFamily: 'inherit', cursor: props.disabled ? 'default' : 'pointer', opacity: props.disabled ? 0.55 : 1, ...styles, ...props.style }}>
      {Icon && <Icon size={15} strokeWidth={2.1} />}{children}
    </button>
  );
}

function Section({ C, title, icon: Icon, children, aside }) {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, padding: '16px 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: C.text }}>
          {Icon && <Icon size={15} strokeWidth={2} color={C.secondary} />}{title}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ListItem({ C, darkMode, item, selected, onSelect }) {
  const state = itemState(item);
  const tone = STAGE_TONE[item.stage] || '#8b94a6';
  return (
    <button type="button" onClick={onSelect} data-lead-id={item.lead_id}
      style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 11,
        border: `1px solid ${selected ? tint(tone, 0.55) : C.border}`, background: selected ? (darkMode ? 'rgba(255,255,255,0.04)' : tint(tone, 0.06)) : C.bg,
        boxShadow: selected ? `inset 3px 0 0 ${tone}` : 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: state === 'taken' ? 0.62 : 1,
        transition: 'border-color .15s ease, background .15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.company || item.contact_first_name || `Lead ${item.lead_id}`}
        </span>
        <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{wallLabel(item.rdv_at, { time: false })}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, color: C.secondary, fontSize: 12 }}>
        <Badge color={tone}>{outcomeLabel(item.stage, item.result)}</Badge>
        {item.sales_name && <span>chez {item.sales_name.split(' ')[0]}</span>}
        {item.contact_first_name && item.company && <span style={{ color: C.muted }}>· {item.contact_first_name}</span>}
      </div>
      {state === 'mine' && <span style={{ fontSize: 11.5, color: '#3e7d5a', fontWeight: 650 }}>À vous jusqu'au {untilLabel(item.claim.expires_at)}{item.claim.calls ? ` · ${item.claim.calls} appel${item.claim.calls > 1 ? 's' : ''}` : ''}</span>}
      {state === 'taken' && <span style={{ fontSize: 11.5, color: C.muted }}>Repris par {item.claim.setter_name || 'un setter'}</span>}
    </button>
  );
}

function Timeline({ C, events }) {
  if (!events?.length) return <div style={{ fontSize: 12.5, color: C.muted }}>Aucun événement enregistré.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {events.map((ev, i) => {
        const Icon = EVENT_ICON[ev.kind] || (ev.kind === 'rdv' ? CalendarX2 : Clock3);
        return (
          <div key={`${ev.at}-${i}`} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, position: 'relative', paddingBottom: i < events.length - 1 ? 12 : 0 }}>
            {i < events.length - 1 && <span style={{ position: 'absolute', left: 13, top: 26, bottom: 0, width: 1, background: C.border }} />}
            <span style={{ width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center', background: C.subtle, border: `1px solid ${C.border}`, zIndex: 1 }}>
              <Icon size={14} strokeWidth={2} color={C.secondary} />
            </span>
            <div style={{ minWidth: 0, paddingTop: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 650, color: C.text }}>{ev.title}</span>
                <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{wallLabel(ev.at, { year: false })}</span>
              </div>
              {(ev.detail || ev.actor) && (
                <div style={{ fontSize: 12.5, color: C.secondary, marginTop: 2, lineHeight: 1.45 }}>
                  {ev.detail}{ev.detail && ev.actor ? ' · ' : ''}{ev.actor && <span style={{ color: C.muted }}>{ev.actor}</span>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SecondChance({ C, darkMode = false, teamSales = [], asSetter = null, onToast }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('free');
  const [stage, setStage] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState({});
  const [historyError, setHistoryError] = useState('');
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState(null);              // { kind: 'called' | 'release' | 'discard', text }
  const [rebook, setRebook] = useState(null);
  const readOnly = Boolean(asSetter);

  const load = useCallback(async () => {
    try {
      const data = await secondChanceApi.pool(asSetter);
      setItems(Array.isArray(data) ? data : (data?.items || []));
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Impossible de charger les leads de Seconde chance.'));
    }
  }, [asSetter]);
  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const loadHistory = useCallback(async (leadId) => {
    setHistoryError('');
    try {
      const h = await secondChanceApi.history(leadId, asSetter);
      setHistory((prev) => ({ ...prev, [leadId]: h }));
    } catch (err) {
      setHistoryError(errorMessage(err, 'Impossible de charger le parcours de ce lead.'));
    }
  }, [asSetter]);
  useEffect(() => { if (selectedId) loadHistory(selectedId); }, [selectedId, loadHistory]);

  const counts = useMemo(() => countItems(items), [items]);
  const visible = useMemo(() => filterItems(items, { tab, stage, query }), [items, tab, stage, query]);
  const selected = (items || []).find((i) => i.lead_id === selectedId) || null;
  const detail = selectedId ? history[selectedId] : null;
  const state = selected ? itemState(selected) : null;

  const act = async (kind, fn, success) => {
    setBusy(kind);
    try {
      await fn();
      onToast?.(success);
      setForm(null);
      await load();
      if (selectedId) await loadHistory(selectedId);
    } catch (err) {
      onToast?.(errorMessage(err), 'err');
    } finally {
      setBusy('');
    }
  };

  const lead = detail?.lead;
  const rebookKind = lead?.rebook_kind;
  const tabButton = (key, label, n) => (
    <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setSelectedId(null); }}
      style={{ padding: '7px 13px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
        background: tab === key ? (darkMode ? '#2a2b36' : '#fff') : 'transparent', color: tab === key ? C.text : C.muted,
        boxShadow: tab === key && !darkMode ? '0 1px 2px rgba(16,24,40,0.08)' : 'none' }}>
      {label}<span style={{ marginLeft: 6, fontSize: 11.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
    </button>
  );

  if (error) return <div style={{ fontSize: 13, color: '#c25555', fontWeight: 600 }}>{error}</div>;
  if (!items) return <div style={{ fontSize: 13, color: C.muted }}>Chargement…</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 0 }}>
        <div role="tablist" style={{ display: 'inline-flex', padding: 3, gap: 3, borderRadius: 10, background: darkMode ? 'rgba(255,255,255,0.05)' : '#eceef2', alignSelf: 'flex-start' }}>
          {tabButton('free', 'À reprendre', counts.free + counts.taken)}
          {tabButton('mine', 'Mes reprises', counts.mine)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '0 10px', border: `1px solid ${C.border}`, borderRadius: 9, background: C.bg }}>
            <Search size={14} color={C.muted} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Entreprise, contact, commercial"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.text, fontSize: 13, fontFamily: 'inherit', padding: '8px 0' }} />
          </div>
          <select value={stage} onChange={(e) => setStage(e.target.value)}
            style={{ border: `1px solid ${C.border}`, borderRadius: 9, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', padding: '0 8px' }}>
            <option value="all">R1 et R2</option>
            <option value="r1">R1</option>
            <option value="r2">R2</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', paddingRight: 2 }}>
          {visible.length === 0 && (
            <div style={{ fontSize: 13, color: C.muted, padding: '28px 6px', textAlign: 'center', lineHeight: 1.5 }}>
              {tab === 'mine' ? 'Aucun lead repris pour l’instant. Ouvrez un lead dans « À reprendre » pour lire son parcours et le reprendre.' : 'Aucun lead ne correspond à ces filtres.'}
            </div>
          )}
          {visible.map((item) => (
            <ListItem key={item.lead_id} C={C} darkMode={darkMode} item={item} selected={item.lead_id === selectedId}
              onSelect={() => { setSelectedId(item.lead_id); setForm(null); }} />
          ))}
        </div>
      </div>

      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow, padding: '20px 22px', minHeight: 360 }}>
        {!selected && (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 300, textAlign: 'center', color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
            <div>
              <RotateCcw size={28} color={C.muted} strokeWidth={1.6} />
              <div style={{ marginTop: 10, maxWidth: 420 }}>Choisissez un lead pour lire tout son parcours : notes du commercial, appels, rendez-vous, e-mails, et pourquoi ça n’a pas abouti.</div>
            </div>
          </div>
        )}
        {selected && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>{selected.company || lead?.full_name || `Lead ${selected.lead_id}`}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 7, color: C.secondary, fontSize: 12.5 }}>
                  <Badge color={STAGE_TONE[selected.stage]}>{outcomeLabel(selected.stage, selected.result)}</Badge>
                  <span>{wallLabel(selected.rdv_at)}</span>
                  {selected.sales_name && <span>· chez {selected.sales_name}{selected.sales_active === false ? ' (parti)' : ''}</span>}
                  {selected.origin && <span>· {originDisplay(selected.origin, selected.cc_sector)}</span>}
                </div>
                {lead?.full_name && selected.company && <div style={{ fontSize: 13, color: C.text, marginTop: 8 }}>{lead.full_name}</div>}
              </div>
            </div>

            {/* Actions */}
            <div style={{ margin: '16px 0', padding: '12px 14px', borderRadius: 12, background: C.subtle, border: `1px solid ${C.border}` }}>
              {state === 'free' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: C.secondary, lineHeight: 1.45 }}>Reprenez-le pour l’appeler : il vous est réservé 3 jours et son numéro s’affiche.</span>
                  <Button C={C} darkMode={darkMode} kind="primary" icon={RotateCcw} disabled={readOnly || busy === 'claim'}
                    onClick={() => act('claim', () => secondChanceApi.claim(selected.lead_id), 'Lead repris : il est à vous pour 3 jours.')}>
                    {busy === 'claim' ? 'Reprise…' : 'Je le reprends'}
                  </Button>
                </div>
              )}
              {state === 'taken' && (
                <span style={{ fontSize: 12.5, color: C.secondary }}>Repris par {selected.claim.setter_name || 'un setter'} jusqu’au {untilLabel(selected.claim.expires_at)}. Il reviendra ici s’il n’est pas reprogrammé.</span>
              )}
              {state === 'mine' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                    {lead?.phone && <a href={`tel:${lead.phone.replace(/\s+/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.text, fontWeight: 700, textDecoration: 'none' }}><Phone size={15} />{lead.phone}</a>}
                    {lead?.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.secondary }}><Mail size={14} />{lead.email}</span>}
                    <span style={{ color: '#3e7d5a', fontWeight: 650, fontSize: 12 }}>À vous jusqu’au {untilLabel(selected.claim.expires_at)}{selected.claim.calls ? ` · ${selected.claim.calls} appel${selected.claim.calls > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Button C={C} darkMode={darkMode} kind="primary" icon={CalendarPlus} disabled={readOnly || !rebookKind}
                      title={rebookKind ? '' : lead?.rebook_note || ''}
                      onClick={() => setRebook({ id: selected.lead_id, full_name: lead?.full_name, email: lead?.email || '', assigned_to: lead?.sales_email, assigned_to_name: lead?.sales_name, kind: rebookKind })}>
                      Reprogrammer le {String(rebookKind || selected.stage).toUpperCase()}
                    </Button>
                    <Button C={C} darkMode={darkMode} icon={PhoneCall} disabled={readOnly} onClick={() => setForm({ kind: 'called', text: '' })}>J’ai appelé</Button>
                    <Button C={C} darkMode={darkMode} kind="ghost" icon={Undo2} disabled={readOnly} onClick={() => setForm({ kind: 'release', text: '' })}>Rendre</Button>
                    <Button C={C} darkMode={darkMode} kind="danger" icon={Ban} disabled={readOnly} onClick={() => setForm({ kind: 'discard', text: '' })}>Écarter</Button>
                  </div>
                  {!rebookKind && lead?.rebook_note && <div style={{ fontSize: 12, color: C.muted }}>{lead.rebook_note}</div>}
                  {form && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea rows={2} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} autoFocus
                        placeholder={form.kind === 'discard' ? 'Pourquoi écarter ce lead ? (obligatoire)' : form.kind === 'release' ? 'Un mot pour le prochain setter (facultatif)' : 'Ce qui s’est dit pendant l’appel (facultatif)'}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button C={C} darkMode={darkMode} kind={form.kind === 'discard' ? 'secondary' : 'primary'} icon={CheckCircle2}
                          disabled={Boolean(busy) || (form.kind === 'discard' && form.text.trim().length < 3)}
                          style={form.kind === 'discard' ? { color: '#c25555', borderColor: tint('#c25555', 0.4) } : undefined}
                          onClick={() => {
                            const text = form.text.trim();
                            if (form.kind === 'called') act('called', () => secondChanceApi.called(selected.lead_id, text), 'Appel enregistré.');
                            if (form.kind === 'release') act('release', () => secondChanceApi.release(selected.lead_id, text), 'Lead rendu : il retourne dans « À reprendre ».');
                            if (form.kind === 'discard') act('discard', () => secondChanceApi.discard(selected.lead_id, text), 'Lead écarté de Seconde chance.');
                          }}>
                          {form.kind === 'called' ? 'Enregistrer l’appel' : form.kind === 'release' ? 'Rendre le lead' : 'Écarter définitivement'}
                        </Button>
                        <Button C={C} darkMode={darkMode} kind="ghost" onClick={() => setForm(null)}>Annuler</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {historyError && <div style={{ fontSize: 13, color: '#c25555', fontWeight: 600 }}>{historyError}</div>}
            {!detail && !historyError && <div style={{ fontSize: 13, color: C.muted }}>Chargement du parcours…</div>}
            {detail && (
              <>
                <Section C={C} title="Notes du dossier" icon={StickyNote}>
                  {detail.notes ? (
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55, maxHeight: 260, overflowY: 'auto' }}><SalesNotesView value={detail.notes} /></div>
                  ) : <div style={{ fontSize: 12.5, color: C.muted }}>Aucune note laissée sur ce lead.</div>}
                </Section>
                <Section C={C} title="Parcours" icon={Clock3} aside={<span style={{ fontSize: 11.5, color: C.muted }}>du plus ancien au plus récent</span>}>
                  <Timeline C={C} events={detail.events} />
                </Section>
                {detail.comments?.length > 0 && (
                  <Section C={C} title="Commentaires" icon={MessageSquare}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detail.comments.map((c, i) => (
                        <div key={i} style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 650 }}>{c.author}</span>
                          <span style={{ color: C.muted, fontSize: 11.5 }}> · {wallLabel(c.at)}</span>
                          <div style={{ color: C.secondary }}>{c.body}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </div>

      {rebook && (
        <SetterJourneyDialog key={`${rebook.id}-${rebook.kind}`} lead={rebook} teamSales={teamSales} dark={darkMode} initialOutcome={rebook.kind}
          lockSales={rebook.kind === 'r2' ? rebook.assigned_to : null}
          onClose={() => setRebook(null)}
          onSaved={async (message) => { onToast?.(message); setRebook(null); setSelectedId(null); await load(); }} />
      )}
    </div>
  );
}
