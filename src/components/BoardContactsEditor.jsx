// Emails et téléphones du client, depuis la fiche du board (Client Success).
// Même table que la page Finance (client_contact) : ce qui est saisi ici est
// visible côté finance, et inversement. Un contact retiré est archivé, jamais
// effacé.
import { useState } from 'react';
import apiClient from '../services/apiClient';

const TEXT = '#1e2330';
const MUTED = '#6b7280';
const BORDER = '#e9ebf0';
const NAVY = '#1e2330';
const RED = '#b42318';

const KINDS = [
  { kind: 'email', title: 'Emails', placeholder: 'adresse@exemple.fr', type: 'email' },
  { kind: 'phone', title: 'Téléphones', placeholder: '06 12 34 56 78', type: 'tel' },
];

const input = { flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12.5, fontFamily: 'inherit', color: TEXT, background: '#fff' };
const small = (primary) => ({
  padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  border: primary ? 'none' : `1px solid ${BORDER}`, background: primary ? NAVY : 'transparent', color: primary ? '#fff' : MUTED,
});
const link = { border: 'none', background: 'transparent', padding: '0 2px', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', color: MUTED };

function ContactRow({ contact, busy, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(contact.value);
  const [confirm, setConfirm] = useState(false);
  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '5px 0' }}>
        <input style={input} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(draft).then((ok) => ok && setEditing(false)); if (e.key === 'Escape') setEditing(false); }} />
        <button type="button" style={small(false)} onClick={() => setEditing(false)}>Annuler</button>
        <button type="button" style={small(true)} disabled={busy || !draft.trim()} onClick={() => onSave(draft).then((ok) => ok && setEditing(false))}>{busy ? '…' : 'Enregistrer'}</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, overflowWrap: 'anywhere' }}>{contact.value}</span>
      {contact.is_primary && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#15794a' }}>principal</span>}
      {contact.label && <span style={{ fontSize: 11, color: MUTED }}>{contact.label}</span>}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
        {confirm ? (
          <>
            <span style={{ fontSize: 11.5, color: TEXT }}>Retirer ?</span>
            <button type="button" style={link} onClick={() => setConfirm(false)}>Non</button>
            <button type="button" style={{ ...link, color: RED, fontWeight: 700 }} disabled={busy} onClick={onRemove}>Retirer</button>
          </>
        ) : (
          <>
            <button type="button" style={link} onClick={() => { setDraft(contact.value); setEditing(true); }}>Modifier</button>
            <button type="button" style={link} onClick={() => setConfirm(true)}>Retirer</button>
          </>
        )}
      </span>
    </div>
  );
}

export default function BoardContactsEditor({ numero, contacts, onChanged }) {
  const [drafts, setDrafts] = useState({ email: '', phone: '' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const run = async (key, call) => {
    setBusy(key); setError('');
    try { await call(); onChanged?.(); return true; }
    catch (e) { setError(e?.message || 'La modification n’a pas pu être enregistrée.'); return false; }
    finally { setBusy(null); }
  };
  const add = (kind) => run(`add-${kind}`, async () => {
    await apiClient.post('/api/v1/optilex/contacts', { numero_client: numero, kind, value: drafts[kind] });
    setDrafts((d) => ({ ...d, [kind]: '' }));
  });

  return (
    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {KINDS.map(({ kind, title, placeholder, type }) => {
        const list = contacts?.[kind === 'email' ? 'emails' : 'phones'] || [];
        return (
          <div key={kind} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{title} (partagés avec la finance)</div>
            {list.map((c) => (
              <ContactRow key={c.id} contact={c} busy={busy === c.id}
                onSave={(value) => run(c.id, () => apiClient.patch(`/api/v1/optilex/contacts/${c.id}`, { value }))}
                onRemove={() => run(c.id, () => apiClient.delete(`/api/v1/optilex/contacts/${c.id}`))} />
            ))}
            {!list.length && <div style={{ fontSize: 12, color: MUTED, padding: '4px 0' }}>Aucun pour l’instant.</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input style={input} type={type} placeholder={placeholder} value={drafts[kind]}
                onChange={(e) => setDrafts((d) => ({ ...d, [kind]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && drafts[kind].trim()) { e.preventDefault(); add(kind); } }} />
              <button type="button" style={small(true)} disabled={!drafts[kind].trim() || busy === `add-${kind}`} onClick={() => add(kind)}>
                {busy === `add-${kind}` ? '…' : 'Ajouter'}
              </button>
            </div>
          </div>
        );
      })}
      {error && <p role="alert" style={{ gridColumn: '1 / -1', margin: 0, fontSize: 12, color: RED }}>{error}</p>}
    </div>
  );
}
