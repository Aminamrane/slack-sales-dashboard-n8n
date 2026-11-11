import React from 'react';
import { MotionConfig, motion as Motion } from 'framer-motion';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { ITEM, Reveal } from '../../../components/perfSales/motion.jsx';
import { Avatar, Num } from '../statistics/parts.jsx';
import '../statistics/statistics.css';

// Briques communes aux onglets de la page Finance (dev 10/11/2026) : le langage des Statistiques (toile grège,
// cartes blanches, tableaux à en-têtes illustrés, étiquettes pastel, personnes en pastille) appliqué partout.
// Chaque onglet est une page : un titre, une phrase, ses réglages à droite, puis ses cartes.
export { Avatar, Card, Collapse, Num, Pill, Segmented } from '../statistics/parts.jsx';
export { Reveal };

export function Page({ title, sub, actions, children }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="fst-root">
        <div className="fst-wrap">
          <header className="fst-head">
            <div style={{ minWidth: 0 }}>
              <h2 className="fst-title">{title}</h2>
              {sub && <p className="fst-sub">{sub}</p>}
            </div>
            {actions && <div className="fst-period">{actions}</div>}
          </header>
          {children}
        </div>
      </div>
    </MotionConfig>
  );
}

// Rangée de chiffres clés : chaque tuile arrive en cascade et son chiffre défile jusqu'à sa valeur.
export const Stats = ({ children, style }) => <Reveal className="fst-stats" style={style}>{children}</Reveal>;

export function Stat({ label, value, format, text, note, tone, Icon, onClick, pressed, title }) {
  const Tag = onClick ? Motion.button : Motion.div;
  return (
    <Tag variants={ITEM} className="fst-stat" data-tone={tone} title={title}
      {...(onClick ? { type: 'button', onClick, 'aria-pressed': pressed } : null)}>
      <span className="fst-stat-label">{Icon && <Icon size={14} strokeWidth={1.9} />}{label}</span>
      <span className="fst-stat-value">{text != null ? <span className="fst-num">{text}</span> : <Num value={value} format={format} />}</span>
      {note && <span className="fst-stat-note">{note}</span>}
    </Tag>
  );
}

// En-tête de colonne : une icône discrète devant le libellé, comme dans le détail des ventes.
export const Th = ({ Icon, num, title, children, style }) => (
  <th className={num ? 'is-num' : undefined} title={title} style={style}>
    <span className="fst-th">{Icon && <Icon size={14} strokeWidth={1.8} />}{children}</span>
  </th>
);

// Une personne : pastille blanche, initiales sur fond sombre.
export const Who = ({ name, title }) => (name
  ? <span className="fst-who" title={title}><Avatar name={name} />{name}</span>
  : <span className="fst-cell-muted">–</span>);

// Étiquette pastel à liseré : green, red, yellow, peach, blue, lilac, cyan, lime (sans ton : beige).
export const Tag = ({ tone, title, children, style }) => <span className="fst-tag" data-tone={tone} title={title} style={style}>{children}</span>;

// Flèche qui apparaît au survol d'une ligne ouvrable.
export const OpenCue = () => <span className="fst-open" aria-hidden="true"><ArrowUpRight size={14} /></span>;

export const RefreshButton = ({ onClick, busy = false, label = 'Actualiser' }) => (
  <button type="button" className="fst-btn" onClick={onClick} disabled={busy} data-busy={busy || undefined}>
    <RefreshCw size={14} className="is-turn" />{label}
  </button>
);

export const Empty = ({ children, boxed = false }) => <div className={`fst-empty${boxed ? ' is-box' : ''}`}>{children}</div>;

// Cadre arrondi d'un tableau ; `free` retire la largeur minimale du détail des ventes.
export function TableBox({ children, free = true, minWidth, after }) {
  return (
    <div className="fst-table-box">
      <div className="fst-table-scroll">
        <table className={`fst-table${free ? ' is-free' : ''}`} style={minWidth ? { minWidth } : undefined}>{children}</table>
      </div>
      {after}
    </div>
  );
}
