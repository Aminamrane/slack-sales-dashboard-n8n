import React from 'react';
import { Check } from 'lucide-react';

// Boutons de choix des fenêtres de qualification de la sheet (absent : relancer ou non ; reporté : date ou à reporter).
export default function ChoiceButtons({ items, value, onPick, disabled }) {
  return (
    <div className="sj-options">
      {items.map(([key, title, desc, icon]) => {
        const Icon = icon;
        return (
          <button key={key} type="button" disabled={disabled} aria-pressed={value === key} className={value === key ? 'is-selected' : ''} onClick={() => onPick(key)}>
            <Icon size={21} /><span><strong>{title}</strong><small>{desc}</small></span>{value === key && <Check size={16} />}
          </button>
        );
      })}
    </div>
  );
}
