import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowUpToLine, Check, Copy, Plus, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

// Autres téléphones et e-mails d'un lead (dev 11 et 12/11/2026), rangés sous les champs « Téléphone » et « Email » de
// la fiche. Au repos, RIEN ne s'affiche de plus que le champ : un petit « +2 » (ou un « + » s'il n'y en a pas) à côté
// des icônes copier / modifier ; un clic déplie les autres contacts, un autre les replie.
// Règle : le contact PRIORITAIRE est le téléphone / l'e-mail du lead lui-même, celui des relances, des SMS et de
// l'envoi du contrat. « Rendre prioritaire » échange un autre contact avec celui du lead.
// Si le serveur ne connaît pas encore la route, rien ne s'affiche et la fiche reste comme avant.
const FIELD = { phone: 'phone', email: 'email' };
const KINDS = {
  phone: { noun: 'numéro', other: (n) => `${n} autre${n > 1 ? 's' : ''} numéro${n > 1 ? 's' : ''}`, placeholder: '06 12 34 56 78', type: 'tel', add: 'Ajouter un numéro' },
  email: { noun: 'e-mail', other: (n) => `${n} autre${n > 1 ? 's' : ''} e-mail${n > 1 ? 's' : ''}`, placeholder: 'prenom.nom@societe.fr', type: 'email', add: 'Ajouter un e-mail' },
};
const urlOf = (leadId) => `/api/v1/tracking/leads/${leadId}/contacts`;

// Un petit magasin par lead : le compteur du champ et la liste dépliée lisent les mêmes données, chargées une seule
// fois par ouverture de fiche. `open` : le type de contact déplié ('phone', 'email' ou rien).
const stores = new Map();
function storeOf(leadId) {
  let store = stores.get(leadId);
  if (!store) { store = { snapshot: { data: null, open: null }, listeners: new Set(), loadedAt: 0 }; stores.set(leadId, store); }
  return store;
}
function emit(store, patch) { store.snapshot = { ...store.snapshot, ...patch }; store.listeners.forEach((listener) => listener()); }
async function load(leadId) {
  const store = storeOf(leadId);
  store.loadedAt = Date.now();
  try { emit(store, { data: await apiClient.get(urlOf(leadId)) }); } catch { emit(store, { data: null }); }
}
function useContacts(leadId) {
  const store = storeOf(leadId);
  const snapshot = useSyncExternalStore((listener) => { store.listeners.add(listener); return () => store.listeners.delete(listener); }, () => store.snapshot);
  useEffect(() => { if (Date.now() - store.loadedAt > 5000) load(leadId); }, [leadId, store]);
  return [snapshot, (patch) => emit(store, patch)];
}
const countOf = (data, kind) => (data?.contacts || []).filter((contact) => contact.kind === kind).length;

const tagStyle = (darkMode, strong) => {
  const [bg, ink, edge] = strong
    ? (darkMode ? ['rgba(240,163,92,.14)', '#f0a35c', 'rgba(240,163,92,.25)'] : ['#fde9da', '#c2500e', '#f8d4ba'])
    : (darkMode ? ['rgba(255,255,255,.06)', '#c9c9c9', '#3a3a3a'] : ['#f1eee9', '#4a4540', '#e3ded6']);
  return { padding: '0 6px', borderRadius: 6, border: `1px solid ${edge}`, background: bg, color: ink, fontSize: 9.5, fontWeight: 500, letterSpacing: 0, textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0 };
};

// « Prioritaire », à côté du libellé du champ : seulement quand la liste est dépliée, pour dire lequel sert aux relances.
export function PriorityTag({ leadId, kind, darkMode }) {
  const [{ data, open }] = useContacts(leadId);
  if (open !== kind || !countOf(data, kind)) return null;
  return <span title="Utilisé pour les relances, les SMS et l’envoi du contrat" style={{ ...tagStyle(darkMode, true), marginLeft: 6, verticalAlign: 1 }}>Prioritaire</span>;
}

// À côté des icônes copier / modifier du champ : « +2 » s'il y a d'autres contacts (clic = les voir), sinon un « + »
// discret pour en ajouter un.
export function ContactsToggle({ leadId, kind, C, darkMode, readOnly = false }) {
  const [{ data, open }, set] = useContacts(leadId);
  if (!data?.categories) return null;
  const count = countOf(data, kind);
  if (!count && readOnly) return null;
  const on = open === kind;
  const toggle = (event) => { event.stopPropagation(); set({ open: on ? null : kind }); };
  const title = count ? (on ? 'Replier' : `Voir ${KINDS[kind].other(count)}`) : KINDS[kind].add;
  if (count) {
    return (
      <span role="button" tabIndex={0} title={title} aria-label={title} aria-expanded={on} onClick={toggle} onKeyDown={(event) => { if (event.key === 'Enter') toggle(event); }}
        style={{ flexShrink: 0, padding: '0 6px', borderRadius: 7, border: `1px solid ${on ? (darkMode ? '#ededed' : '#2b2927') : (darkMode ? '#3a3a3a' : '#e3ded6')}`,
          background: on ? (darkMode ? '#ededed' : '#2b2927') : (darkMode ? 'rgba(255,255,255,.06)' : '#f1eee9'), color: on ? (darkMode ? '#141414' : '#ffffff') : C.secondary,
          fontSize: 10.5, fontWeight: 500, lineHeight: '16px', fontVariantNumeric: 'tabular-nums', cursor: 'pointer', transition: 'background 0.18s ease, color 0.18s ease, border-color 0.18s ease' }}>
        +{count}
      </span>
    );
  }
  return (
    <span role="button" tabIndex={0} title={title} aria-label={title} aria-expanded={on} onClick={toggle} onKeyDown={(event) => { if (event.key === 'Enter') toggle(event); }}
      style={{ display: 'inline-flex', flexShrink: 0, cursor: 'pointer', opacity: on ? 0.85 : 0.35, transition: 'opacity 0.15s, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)', transform: on ? 'rotate(45deg)' : 'none' }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.8; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = on ? 0.85 : 0.35; }}>
      <Plus size={14} color={C.muted} strokeWidth={2} />
    </span>
  );
}

// La liste dépliée sous le champ : les autres contacts du type, puis l'ajout.
// `onPromote(champ, valeur)` enregistre le nouveau contact prioritaire sur le lead (route habituelle de la fiche) et
// rend vrai si c'est fait.
export default function LeadContactRows({ leadId, kind, mainValue, onPromote, C, darkMode, readOnly = false }) {
  const [{ data, open }, set] = useContacts(leadId);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ value: '', category: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const shown = open === kind;
  const categories = data?.categories?.[kind];
  const rows = (data?.contacts || []).filter((contact) => contact.kind === kind);
  const empty = rows.length === 0;
  // Sans autre contact, déplier revient à vouloir en ajouter un : la saisie est là tout de suite.
  useEffect(() => {
    if (!shown) { setAdding(false); setConfirm(null); setError(''); return; }
    if (categories) setForm({ value: '', category: Object.keys(categories)[0] });
    if (empty) setAdding(true);
  }, [shown, categories, empty]);

  if (!categories || !shown) return null;
  const base = urlOf(leadId);

  const run = async (action) => {
    if (busy) return false;
    setBusy(true); setError('');
    try { await action(); await load(leadId); return true; }
    catch (e) { setError(e?.data?.detail?.message || (typeof e?.data?.detail === 'string' ? e.data.detail : '') || e?.message || 'L’enregistrement a échoué. Réessayez.'); return false; }
    finally { setBusy(false); }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!form.value.trim()) return;
    if (await run(() => apiClient.post(base, { kind, category: form.category, value: form.value }))) { setAdding(false); setForm({ ...form, value: '' }); }
  };
  // Rendre prioritaire : le lead prend ce contact, l'ancien prioritaire prend sa place ici, en « Secondaire ».
  const promote = (contact) => run(async () => {
    const former = (mainValue || '').trim();
    if (!(await onPromote(FIELD[kind], contact.value))) throw new Error(`Ce ${KINDS[kind].noun} n’a pas pu devenir prioritaire.`);
    if (former) await apiClient.patch(`${base}/${contact.id}`, { value: former, category: 'secondaire' });
    else await apiClient.delete(`${base}/${contact.id}`);
    setConfirm(null);
  });
  const copy = (contact) => navigator.clipboard?.writeText(contact.value).then(() => { setCopied(contact.id); setTimeout(() => setCopied(null), 1400); }).catch(() => {});

  const action = { display: 'inline-flex', flexShrink: 0, cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.15s' };
  const hover = { onMouseEnter: (e) => { e.currentTarget.style.opacity = 0.85; }, onMouseLeave: (e) => { e.currentTarget.style.opacity = 0.4; } };
  const field = { padding: '6px 9px', borderRadius: 9, border: `1px solid ${darkMode ? C.border : '#e3ded6'}`, background: darkMode ? '#181818' : '#ffffff', color: C.text, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', minWidth: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginLeft: 30, padding: '9px 10px', borderRadius: 12, background: darkMode ? '#181818' : '#f7f5f2', animation: 'contentReveal 0.22s cubic-bezier(0.4,0,0.2,1) both' }}>
      {rows.map((contact) => (
        <div key={contact.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span title={contact.value} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: kind === 'phone' ? C.text : C.secondary,
              fontFamily: kind === 'phone' ? "'SF Mono', 'Fira Code', monospace" : 'inherit', fontWeight: kind === 'phone' ? 500 : 400 }}>{contact.value}</span>
            <span style={tagStyle(darkMode, contact.category === 'a_contacter' || contact.category === 'personne_a_contacter')}>{contact.label}</span>
            <span style={{ flex: 1 }} />
            {copied === contact.id
              ? <Check size={13} color="#0b7a4b" style={{ flexShrink: 0 }} />
              : <span role="button" title="Copier" style={action} {...hover} onClick={() => copy(contact)}><Copy size={13} color={C.muted} /></span>}
            {!readOnly && <span role="button" title="Rendre prioritaire : utilisé pour les relances et le contrat" style={action} {...hover} onClick={() => setConfirm(confirm === contact.id ? null : contact.id)}><ArrowUpToLine size={13} color={C.muted} /></span>}
            {!readOnly && <span role="button" title="Retirer" style={action} {...hover} onClick={() => run(() => apiClient.delete(`${base}/${contact.id}`))}><X size={13} color={C.muted} /></span>}
          </div>
          {confirm === contact.id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, animation: 'contentReveal 0.2s cubic-bezier(0.4,0,0.2,1) both' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.4, color: C.secondary }}>Utiliser ce {KINDS[kind].noun} pour les relances et le contrat ?</span>
              <button type="button" onClick={() => setConfirm(null)} style={{ padding: '4px 9px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.secondary, fontSize: 11.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>Non</button>
              <button type="button" disabled={busy} onClick={() => promote(contact)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: darkMode ? '#ededed' : '#2b2927', color: darkMode ? '#141414' : '#ffffff', fontSize: 11.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>{busy ? '…' : 'Oui'}</button>
            </div>
          )}
        </div>
      ))}
      {!readOnly && !adding && (
        <button type="button" onClick={() => setAdding(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start', padding: 0, border: 'none', background: 'transparent', color: C.muted, fontSize: 11.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
          <Plus size={12} />{KINDS[kind].add}
        </button>
      )}
      {!readOnly && adding && (
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 6, alignItems: 'center' }}>
          <input autoFocus type={KINDS[kind].type} value={form.value} placeholder={KINDS[kind].placeholder} aria-label={KINDS[kind].add}
            onChange={(e) => setForm({ ...form, value: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') { if (empty) set({ open: null }); else setAdding(false); } }} style={field} />
          <select value={form.category} aria-label="Catégorie" onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ ...field, cursor: 'pointer', maxWidth: 124 }}>
            {Object.entries(categories).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
          </select>
          <button type="submit" disabled={busy || !form.value.trim()} aria-label="Ajouter" title="Ajouter" style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 9, border: 'none',
            background: darkMode ? '#ededed' : '#2b2927', color: darkMode ? '#141414' : '#ffffff', cursor: 'pointer', opacity: busy || !form.value.trim() ? 0.4 : 1, transition: 'opacity 0.2s' }}><Check size={14} /></button>
        </form>
      )}
      {error && <p role="alert" style={{ margin: 0, fontSize: 11.5, color: darkMode ? '#f87171' : '#c5221f' }}>{error}</p>}
    </div>
  );
}
