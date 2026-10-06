import { useRef, useState } from 'react';
import FrenchDateInput from './salesJourney/FrenchDateInput';
import { frenchDate } from '../utils/parisDates';

// Save only when leaving the whole control, never while entering a partial year
// or moving between the input and the French calendar.
export default function BoardStateDateInput({ value, onChange, label, style }) {
  const [draft, setDraft] = useState(value || '');
  const draftRef = useRef(value || '');
  const commit = () => {
    const next = draftRef.current || null;
    if (next !== (value || null)) onChange(next);
  };
  return <span className="board-state-date">
    <FrenchDateInput floating onCommit={commit} aria-label={label} value={draft} style={style}
      onChange={next => { draftRef.current = next; setDraft(next); }}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') {
          draftRef.current = value || '';
          setDraft(value || '');
          event.currentTarget.value = frenchDate(value);
          event.currentTarget.setCustomValidity('');
          event.currentTarget.blur();
        }
      }} />
  </span>;
}
