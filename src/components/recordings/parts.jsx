import { useEffect, useState } from 'react';
import { initialsOf } from './recordingsData';
import './recordings.css';

// Briques communes de la page « Enregistrements sales » : cadre, avatar, états. Le cadre porte les jetons de couleur (clair / sombre) ;
// `embed` = posé dans la tracking sheet, qui a déjà son fond et ses marges.
const FONT_ID = 'rc-font-geist';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap';

export function Frame({ darkMode = false, embed = false, children }) {
  // Geist (comme la Performance Sales) : demandée à l'ouverture de la page seulement, une fois ; sans elle, Inter prend le relais.
  useEffect(() => {
    if (document.getElementById(FONT_ID)) return;
    const l = document.createElement('link');
    l.id = FONT_ID; l.rel = 'stylesheet'; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);
  return (
    <div className={`rc-page${embed ? ' is-inline' : ''}`}>
      <div className={`rc-root${darkMode ? ' is-dark' : ''}`}>{children}</div>
    </div>
  );
}

// Photo, ou initiales si l'image manque ou ne charge pas.
export function Avatar({ src, name, large = false, flat = false }) {
  const [failed, setFailed] = useState(false);
  const cls = `rc-ava${large ? ' is-lg' : ''}${flat ? ' is-flat' : ''}`;
  if (src && !failed) {
    const px = large ? 64 : 48;
    return <img className={cls} src={src} alt="" width={px} height={px} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
  }
  return <span className={cls} aria-hidden="true">{initialsOf(name)}</span>;
}

export function Skeleton({ kind = 'cards' }) {
  if (kind === 'rows') {
    return <div role="status" aria-label="Chargement">{Array.from({ length: 5 }, (_, i) => <i className="rc-skel rc-skel-row" key={i} />)}</div>;
  }
  if (kind === 'block') return <i className="rc-skel rc-skel-block" role="status" aria-label="Chargement" />;
  return (
    <div className="rc-teams" role="status" aria-label="Chargement">
      {[0, 1].map((p) => (
        <div className="rc-card" key={p}>
          <i className="rc-skel rc-skel-title" />
          <div className="rc-people">{Array.from({ length: 3 }, (_, i) => <i className="rc-skel rc-skel-person" key={i} />)}</div>
        </div>
      ))}
    </div>
  );
}

export const Empty = ({ children }) => <div className="rc-state">{children}</div>;

export function Failed({ children, onRetry, retryLabel = 'Réessayer' }) {
  return (
    <div className="rc-state" role="alert">
      <span>{children}</span>
      {onRetry ? <button type="button" className="rc-retry" onClick={onRetry}>{retryLabel}</button> : null}
    </div>
  );
}
