// Zone de saisie des commentaires de l'espace commun avec mentions « @ » :
// taper « @ » propose les personnes du board (Owner, Opti'Lex, finance), flèches + Entrée/Tab pour choisir,
// Échap pour fermer. Le texte reste du texte : « @Nom Complet » est ce que le serveur reconnaît.
import { useEffect, useMemo, useRef, useState } from 'react';
import { filterPeople, groupLabel, insertMention, mentionQuery, splitMentions } from '../utils/mentions.js';

const NAVY = '#121b35', MUTED = '#6b7280', BORDER = '#e5e7eb', SOFT = '#e9eef6', GREEN = '#3e7d5a';

function Initials({ name, src }) {
  const letters = String(name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return src
    ? <img src={src} alt="" width={26} height={26} style={{ width: 26, height: 26, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
    : <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 8, background: SOFT, color: NAVY, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{letters}</span>;
}

export function MentionedText({ text, mentions }) {
  const parts = useMemo(() => splitMentions(text, mentions), [text, mentions]);
  return parts.map((part, index) => part.mention
    ? <span key={index} style={{ background: SOFT, color: NAVY, borderRadius: 6, padding: '0 4px', fontWeight: 600 }}>{part.text}</span>
    : <span key={index}>{part.text}</span>);
}

export default function MentionTextarea({ value, onChange, people = [], onKeyDown, style, ...rest }) {
  const ref = useRef(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState(null);
  const query = useMemo(() => mentionQuery(value, caret), [value, caret]);
  const options = useMemo(() => (query && dismissedAt !== query.start ? filterPeople(people, query.query) : []), [query, people, dismissedAt]);
  const open = options.length > 0;
  const queryText = query ? query.query : null;
  useEffect(() => { setActive(0); }, [queryText]);

  const syncCaret = (event) => setCaret(event.target.selectionStart ?? String(event.target.value || '').length);
  const pick = (person) => {
    if (!query || !person) return;
    const next = insertMention(value, query.start, caret, person);
    onChange(next.text);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
      setCaret(next.caret);
    });
  };
  const handleKeyDown = (event) => {
    if (open) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive(a => (a + 1) % options.length); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActive(a => (a - 1 + options.length) % options.length); return; }
      if ((event.key === 'Enter' && !(event.metaKey || event.ctrlKey)) || event.key === 'Tab') { event.preventDefault(); pick(options[active]); return; }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDismissedAt(query.start); return; }
    }
    onKeyDown?.(event);
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea ref={ref} value={value} style={style} aria-autocomplete="list" aria-expanded={open}
        onChange={(event) => { onChange(event.target.value); syncCaret(event); }}
        onKeyDown={handleKeyDown} onKeyUp={syncCaret} onClick={syncCaret} onSelect={syncCaret} {...rest} />
      {open && (
        <div role="listbox" aria-label="Mentionner une personne"
          style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 30, marginTop: 4, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(18,27,53,0.14)', overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', fontSize: 11, color: MUTED, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: GREEN, display: 'inline-block' }} />
            Mentionner : la personne sera prévenue par e-mail et dans le CRM
          </div>
          {options.map((person, index) => (
            <button type="button" key={person.id} role="option" aria-selected={index === active}
              onMouseDown={(event) => { event.preventDefault(); pick(person); }} onMouseEnter={() => setActive(index)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', border: 'none', background: index === active ? SOFT : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <Initials name={person.name} src={person.avatar_url} />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</span>
                <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{groupLabel(person.role)} · {person.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
