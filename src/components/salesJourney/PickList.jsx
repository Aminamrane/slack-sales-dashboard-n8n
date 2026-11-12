import React, { useState } from 'react';
import { Check } from 'lucide-react';

// Liste de choix épurée des fenêtres de qualification (11/11/2026, d'après la référence « Timeline » du dev : des lignes
// sans cadre, la ligne choisie légèrement teintée). Au repos on ne lit que l'icône et l'intitulé ; l'explication
// apparaît au survol et reste sur la ligne choisie. Une fois le choix fait, les autres lignes se replient : la fenêtre
// ne montre plus que la réponse et la question suivante. Un clic sur la réponse rouvre la liste pour en changer.
// `fold` : par défaut dès trois choix ; les listes à deux choix restent ouvertes.
// Les lignes entrent en cascade (`--i` : leur rang), l'icône de la ligne choisie rebondit : le mouvement dit que
// le choix a été pris. Coupé si l'utilisateur réduit les animations (salesJourney.css).
export default function PickList({ items, value, onPick, disabled, fold = items.length > 2 }) {
  const [open, setOpen] = useState(true);
  const folded = fold && !open && items.some(([key]) => key === value);
  return (
    <div className={`sj-options sj-pick${folded ? ' is-folded' : ''}`}>
      {items.map(([key, title, desc, icon], index) => {
        const Icon = icon;
        const on = value === key;
        const away = folded && !on;
        return (
          <button key={key} type="button" disabled={disabled || away} aria-hidden={away || undefined} aria-pressed={on}
            className={`${on ? 'is-selected' : ''}${away ? ' is-away' : ''}`} title={folded ? 'Changer de réponse' : undefined} style={{ '--i': index }}
            onClick={() => {
              if (folded) { setOpen(true); return; }
              if (!on) onPick(key);
              if (fold) setOpen(false);
            }}>
            <Icon size={17} /><span><strong>{title}</strong><small>{desc}</small></span>
            {on && (folded ? <em>Modifier</em> : <Check size={15} />)}
          </button>
        );
      })}
    </div>
  );
}
