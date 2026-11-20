import { useEffect, useId, useRef, useState } from 'react';
import { CircleAlert, Info, RefreshCw } from 'lucide-react';

import { DASH, ago, donutSegments, num, ringDash } from './format.js';

// Briques communes de la page « Séquences email » (famille `seq-`, sequences.css).

// ── Bulle d'information ─────────────────────────────────────────────────────────────────────
// Le détail d'un chiffre vit dans une bulle (clic, Entrée ou survol clavier), jamais en phrase sous le chiffre.
// Une seule bulle à la fois ; Échap, un clic ailleurs ou un second clic la ferment.
const HINT_EVENT = 'seq-hint-open';

export function Hint({ label, title, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 12, top: 0 });
  const btn = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') { close(); btn.current?.focus(); } };
    const onDown = (e) => { if (!btn.current?.contains(e.target) && !document.getElementById(id)?.contains(e.target)) close(); };
    const onOther = (e) => { if (e.detail !== id) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener(HINT_EVENT, onOther);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener(HINT_EVENT, onOther);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, id]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btn.current.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, r.left + r.width / 2 - width / 2));
    setPos({ left, top: r.bottom + 8 });
    window.dispatchEvent(new CustomEvent(HINT_EVENT, { detail: id }));
    setOpen(true);
  };

  return (
    <>
      <button ref={btn} type="button" className="seq-hint" aria-label={label || title || 'Détail'} aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle}>
        <Info size={13} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} role="dialog" aria-label={label || title} className="seq-pop" style={{ left: pos.left, top: pos.top }}>
          {title && <span className="seq-pop-title">{title}</span>}
          {children}
        </div>
      )}
    </>
  );
}

// ── Petites pièces ──────────────────────────────────────────────────────────────────────────
// `hue` : une des 5 couleurs du code couleur fixe (blue, green, orange, violet, grey), ou sa variante `-soft` / `-deep`.
export function Tag({ tone = 'grey', hue, children, dot = false }) {
  return <span className="seq-tag" data-tone={tone} data-hue={hue}>{dot && <span className="seq-tag-dot" aria-hidden="true" />}{children}</span>;
}

export function Pill({ tone, hue, children }) {
  return <span className="seq-pill" data-tone={tone} data-hue={hue}>{children}</span>;
}

// Nombre qui monte jusqu'à sa valeur (0,9 s, sortie douce) ; tout de suite avec `prefers-reduced-motion` ; « — » si inconnu.
export function CountUp({ value }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const target = Number(value);
    if (value === null || value === undefined || !Number.isFinite(target)) { setShown(value); from.current = value; return undefined; }
    const start = Number.isFinite(Number(from.current)) ? Number(from.current) : 0;
    if (start === target || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(target); from.current = target; return undefined; }
    let raf; const t0 = performance.now(); const ms = 900;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [value]);
  return <>{num(shown)}</>;
}

// ── Anneaux concentriques (un anneau par taux, tracés à l'entrée) ────────────────────────────
// rings : [{ key, label, hue, pct }] de l'extérieur vers l'intérieur ; `center` = { num, cap } au milieu.
const RING_R = [52, 40, 28];
export function Rings({ rings, center, ariaLabel }) {
  return (
    <div className="seq-rings">
      <svg viewBox="0 0 120 120" role="img" aria-label={ariaLabel}>
        {rings.map((r, i) => {
          const R = RING_R[i] ?? 16; const C = 2 * Math.PI * R;
          return (
            <g key={r.key} data-hue={r.hue}>
              <circle className="seq-ring-track" cx="60" cy="60" r={R} strokeWidth="9" />
              <circle className="seq-ring-arc" cx="60" cy="60" r={R} strokeWidth="9" strokeDasharray={`${ringDash(r.pct, C)} ${C}`} style={{ '--len': C, '--i': i }} />
            </g>
          );
        })}
        {center && <>
          <text className="seq-ring-num" x="60" y="62" textAnchor="middle">{center.num}</text>
          <text className="seq-ring-cap" x="60" y="72" textAnchor="middle">{center.cap}</text>
        </>}
      </svg>
      <div className="seq-ring-legend">
        {rings.map((r) => (
          <div key={r.key} className="seq-ring-item" data-hue={r.hue}>
            <span className="seq-ring-dot" aria-hidden="true" />
            <span>{r.label}</span>
            <span className="seq-ring-pct">{r.pct === null || r.pct === undefined ? DASH : `${r.pct} %`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Donut : répartition en segments colorés, total au centre ────────────────────────────────
export function Donut({ rows, total, cap, ariaLabel }) {
  const R = 44; const C = 2 * Math.PI * R;
  const segs = donutSegments(rows, C, 4);
  return (
    <svg className="seq-donut" viewBox="0 0 120 120" role="img" aria-label={ariaLabel}>
      <circle className="seq-donut-track" cx="60" cy="60" r={R} strokeWidth="15" />
      {segs.map((sg, i) => (
        <g key={sg.key} data-hue={sg.hue}>
          <circle className="seq-donut-seg" cx="60" cy="60" r={R} strokeWidth="15" strokeLinecap="round"
            strokeDasharray={`${sg.dash} ${C}`} strokeDashoffset={-sg.offset} style={{ '--circ': C, '--i': i }} />
        </g>
      ))}
      <text className="seq-donut-num" x="60" y="62" textAnchor="middle">{num(total)}</text>
      <text className="seq-donut-cap" x="60" y="73" textAnchor="middle">{cap}</text>
    </svg>
  );
}

export function Card({ title, hint, hintTitle, right, busy = false, className = '', delay = 0, children, ...rest }) {
  return (
    <section className={`seq-card seq-in ${className}`} data-busy={busy ? 'true' : 'false'} style={{ '--i': delay }} {...rest}>
      <span className="seq-loadbar" aria-hidden="true" />
      {(title || right) && (
        <div className="seq-card-head">
          <h2 className="seq-h2">{title}{hint && <Hint label={`Détail : ${title}`} title={hintTitle}>{hint}</Hint>}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// Une valeur du bandeau de faits : étiquette + bulle, puis le chiffre (« — » tant qu'il est inconnu).
export function Fact({ label, value, hue = 'blue', icon, hint, children }) {
  const unknown = value === null || value === undefined;
  return (
    <div className="seq-fact" data-hue={hue} data-empty={unknown ? 'true' : 'false'}>
      <div className="seq-fact-head">
        <span className="seq-fact-label">{label}{hint && <Hint label={`Détail : ${label}`}>{hint}</Hint>}</span>
        {icon && <span className="seq-fact-icon" aria-hidden="true">{icon}</span>}
      </div>
      <span className="seq-fact-value">{children ?? <CountUp value={value} />}</span>
    </div>
  );
}

// Bascule de vue (segments) : `aria-pressed` sur chaque bouton.
export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="seq-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.key)} type="button" className="seq-seg-btn" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
          {o.count !== undefined && <span className="seq-seg-count">{num(o.count)}</span>}
        </button>
      ))}
    </div>
  );
}

// « il y a 12 s » : son propre minuteur (toutes les 10 s, arrêté onglet caché) pour ne pas redessiner la page.
export function Ago({ at }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) tick((n) => n + 1); }, 10000);
    return () => clearInterval(id);
  }, []);
  return <>{ago(at)}</>;
}

// ── États ───────────────────────────────────────────────────────────────────────────────────
export function Skeletons({ blocks = [150, 120, 280] }) {
  return (
    <div className="seq-skels" role="status" aria-busy="true" aria-label="Chargement">
      {blocks.map((h, i) => <div key={i} className="seq-skel" style={{ height: h, borderRadius: 18 }} />)}
    </div>
  );
}

export function ErrorState({ title = 'Données indisponibles', detail, busy, onRetry }) {
  return (
    <div className="seq-card seq-in" role="alert">
      <div className="seq-state">
        <span className="seq-state-icon" data-tone="low" aria-hidden="true"><CircleAlert size={24} /></span>
        <div className="seq-state-title">{title}</div>
        <div className="seq-state-text">{detail || 'Le serveur n’a pas répondu.'}</div>
        {onRetry && (
          <button type="button" className="seq-btn seq-btn--ghost" onClick={onRetry} disabled={busy}>
            <RefreshCw size={14} className={busy ? 'seq-spin' : undefined} aria-hidden="true" /> {busy ? 'Nouvelle tentative…' : 'Réessayer'}
          </button>
        )}
      </div>
    </div>
  );
}

// Échec d'une actualisation alors que des données sont déjà à l'écran : on les garde et on le dit.
export function StaleBanner({ text, busy, onRetry }) {
  return (
    <div className="seq-banner" data-tone="low" role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      <span>{text}</span>
      <button type="button" className="seq-btn" onClick={onRetry} disabled={busy}>{busy ? 'Actualisation…' : 'Réessayer'}</button>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="seq-empty">{children}</div>;
}

export { DASH };
