import React, { useId } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { EASE, EASE_CSS, ITEM, useCountUp, useDrawn, useRevealed } from '../../../components/perfSales/motion.jsx';
import { count, initials } from './model.js';

// Briques des Statistiques Finance : chacune répond au geste (pression, survol, changement de valeur).
const SPRING = { type: 'spring', stiffness: 520, damping: 40 };

// Choix exclusif : le fond blanc glisse d'une option à l'autre.
export function Segmented({ options, value, onChange, small = false, label }) {
  const id = useId();
  return (
    <div className={`fst-seg${small ? ' is-small' : ''}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.key} type="button" className="fst-seg-btn" aria-pressed={option.key === value} title={option.title}
          onClick={() => option.key !== value && onChange(option.key)}>
          {option.key === value && <Motion.span layoutId={`fst-seg-${id}`} className="fst-seg-thumb" transition={SPRING} />}
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Chiffre qui défile de l'ancienne valeur à la nouvelle, une fois sa section à l'écran.
export function Num({ value, format = count, className = '', duration = 900 }) {
  const revealed = useRevealed();
  const known = value != null && Number.isFinite(Number(value));
  const shown = useCountUp(revealed && known ? Number(value) : 0, { duration });
  return <span className={`fst-num ${className}`}>{known ? format(shown) : '–'}</span>;
}

export const Pill = ({ tone = 'grey', plain = false, children, title }) => (
  <span className={`fst-pill${plain ? ' is-plain' : ''}`} data-tone={tone} title={title}>
    {!plain && tone === 'green' && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}{children}
  </span>
);

export const Avatar = ({ name }) => <span className="fst-avatar" aria-hidden="true">{initials(name)}</span>;

// Barre horizontale : part de zéro à la première apparition, puis glisse d'une valeur à l'autre.
export function Fill({ value, tone, color }) {
  const drawn = useDrawn();
  const width = Math.max(0, Math.min(1, Number(value) || 0)) * 100;
  return (
    <div className="fst-track">
      <div className="fst-fill" data-tone={tone} style={{ width: `${drawn ? width : 0}%`, background: color }} />
    </div>
  );
}

// Anneau d'avancement, tracé depuis midi.
export function ProgressRing({ value, size = 132, stroke = 11, color = 'var(--charcoal)', children, label }) {
  const drawn = useDrawn();
  const share = Math.max(0, Math.min(1, Number(value) || 0)) * 100;
  const radius = (size - stroke) / 2;
  return (
    <div className="fst-ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          pathLength="100" strokeDasharray="100 100" strokeDashoffset={drawn ? 100 - share : 100}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: `stroke-dashoffset 1200ms ${EASE_CSS}, stroke 300ms` }} />
      </svg>
      <div className="fst-ring-center">{children}</div>
    </div>
  );
}

// Contenu qui se déplie en hauteur.
export function Collapse({ open, children }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <Motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.36, ease: EASE }} style={{ overflow: 'hidden' }}>
          {children}
        </Motion.div>
      )}
    </AnimatePresence>
  );
}

const Skeleton = ({ height = 220 }) => (
  <div aria-hidden="true" style={{ display: 'grid', gap: 12 }}>
    <div className="fst-skel" style={{ height: 34, width: '38%' }} />
    <div className="fst-skel" style={{ height: 14, width: '62%' }} />
    <div className="fst-skel" style={{ height: Math.max(60, height - 72) }} />
  </div>
);

// Carte d'une lecture : squelette au premier chargement, chiffres précédents estompés pendant un changement de
// période, message et bouton en cas d'échec.
export function Card({ title, Icon, hint, actions, state, skeleton, className = '', children, ...rest }) {
  const first = Boolean(state) && !state.data && state.loading;
  const stale = Boolean(state?.data) && state.loading;
  return (
    <Motion.section variants={ITEM} className={`fst-card ${className}`} data-stale={stale || undefined} data-loading={first || undefined}
      aria-busy={first || stale} {...rest}>
      <span className="fst-load" aria-hidden="true" />
      <header className="fst-card-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="fst-card-title">{Icon && <Icon size={15} strokeWidth={2.1} />}{title}</h3>
          {hint && <p className="fst-card-hint">{hint}</p>}
        </div>
        {actions}
      </header>
      {state?.error && (
        <div className="fst-error" role="alert" style={{ marginBottom: state.data ? 14 : 0 }}>
          {state.error}<button type="button" onClick={state.retry}>Réessayer</button>
        </div>
      )}
      {first ? <Skeleton height={skeleton} /> : (!state || state.data) && <div className="fst-body">{children}</div>}
    </Motion.section>
  );
}
