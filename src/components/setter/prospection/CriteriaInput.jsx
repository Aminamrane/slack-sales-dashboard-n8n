// Saisie assistée des critères de l'API Leads : on tape un métier, un code NAF, un département ou une
// ville, et seuls un code NAF ou un département réels peuvent être choisis (jamais du texte libre).
import { useEffect, useRef, useState } from 'react';
import { Search, Briefcase, MapPin } from 'lucide-react';
import { prospectionApi } from './prospectionApi';
import { MONO } from './format';

const SECTIONS = { activities: 'Activité (code NAF)', departements: 'Département' };

export default function CriteriaInput({ C, kinds = ['activities', 'departements'], placeholder, onPick, autoFocus, compact }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState({ activities: [], departements: [] });
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    const needle = q.trim();
    if (!needle) { setFound({ activities: [], departements: [] }); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      prospectionApi.suggest(needle)
        .then((r) => { if (alive) { setFound(r || { activities: [], departements: [] }); setHighlight(0); } })
        .catch(() => { if (alive) setFound({ activities: [], departements: [] }); });
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const options = kinds.flatMap((kind) => (found[kind] || []).map((item) => ({ kind, item })));
  const pick = (option) => {
    onPick(option.kind === 'activities' ? { type: 'activity', code: option.item.code, label: option.item.label }
      : { type: 'departement', code: option.item.code, name: option.item.name });
    setQ(''); setOpen(false);
  };
  const onKeyDown = (e) => {
    if (!options.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight((h) => (h + 1) % options.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h - 1 + options.length) % options.length); }
    if (e.key === 'Enter') { e.preventDefault(); pick(options[highlight] || options[0]); }
    if (e.key === 'Escape') setOpen(false);
  };

  const row = (option, index) => {
    const active = index === highlight;
    const { kind, item } = option;
    return (
      <button key={`${kind}-${item.code}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(option)}
        onMouseEnter={() => setHighlight(index)} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none',
          background: active ? C.surface : 'transparent', color: C.text, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
        }}>
        {kind === 'activities' ? <Briefcase size={15} color={C.muted} /> : <MapPin size={15} color={C.muted} />}
        {kind === 'activities' ? (
          <span><span style={{ fontFamily: MONO, fontSize: 13 }}>{item.code}</span> · {item.label}</span>
        ) : (
          <span>{item.name} <span style={{ fontFamily: MONO, fontSize: 13 }}>({item.code})</span>
            {item.via && <span style={{ color: C.muted }}> · contient {item.via}</span>}</span>
        )}
      </button>
    );
  };

  let index = -1;
  return (
    <div ref={boxRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Search size={compact ? 17 : 22} color={C.accent} style={{ flexShrink: 0 }} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} autoComplete="off"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.text, fontSize: compact ? 14 : 17,
            fontFamily: 'inherit', minWidth: 0, padding: compact ? '4px 0' : 0 }} />
      </div>
      {open && q.trim() && (
        <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 10px)', left: 0, right: 0, background: C.bg,
          border: `1px solid ${C.border}`, borderRadius: 12, zIndex: 30, maxHeight: 340, overflowY: 'auto',
          boxShadow: '0 16px 36px rgba(16,24,40,0.14)', padding: '6px 0' }}>
          {options.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 13, color: C.muted }}>
              Aucun code correspondant. Essayez un métier (« plombier »), un code NAF (« 43.22A »), un département ou une ville.
            </div>
          )}
          {kinds.map((kind) => (found[kind] || []).length > 0 && (
            <div key={kind}>
              <div style={{ padding: '8px 14px 4px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {SECTIONS[kind]}
              </div>
              {found[kind].map((item) => { index += 1; return row({ kind, item }, index); })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
