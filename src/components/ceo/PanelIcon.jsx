import { useEffect, useRef, useState } from 'react';
import wallet from '../../assets/ceo-icons/wallet.webp';
import notes from '../../assets/ceo-icons/notes.webp';
import temple from '../../assets/ceo-icons/temple.webp';
import door from '../../assets/ceo-icons/door.webp';
import stopwatch from '../../assets/ceo-icons/stopwatch.webp';
import laurel from '../../assets/ceo-icons/laurel.webp';

// Badges des cartes : six objets 3D d'une même planche (rendu doux, palette Owner),
// générés pour cette page et détourés. Au survol de l'ICÔNE (pas de la carte), l'objet
// se soulève et s'incline en trois dimensions vers le curseur (±14°), son ombre se
// déplace avec lui, et il se repose en douceur quand le curseur sort. Sans pointeur
// fin ou avec « réduire les animations », il reste immobile.
const ICONS = { wallet, notes, temple, door, stopwatch, laurel };
const TILT = 14;

export default function PanelIcon({ name, size = 48, className = '' }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const img = el?.querySelector('img');
    if (!el || !img) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    let raf = 0;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));   // -0.5 … 0.5
      const y = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        img.style.transition = 'transform .16s ease-out, filter .16s ease-out';
        img.style.transform = `translateY(-3px) scale(1.08) rotateX(${(-y * TILT * 2).toFixed(2)}deg) rotateY(${(x * TILT * 2).toFixed(2)}deg)`;
        img.style.filter = `drop-shadow(${(-x * 12).toFixed(1)}px ${(10 - y * 6).toFixed(1)}px 14px rgba(18, 27, 53, .22))`;
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      img.style.transition = 'transform .7s cubic-bezier(.2, .9, .25, 1.08), filter .5s ease';
      img.style.transform = '';
      img.style.filter = '';
    };
    el.addEventListener('pointerenter', move);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('pointerenter', move); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, []);
  const src = ICONS[name];
  if (!src) return null;
  return (
    <span ref={ref} className={`an-panel-icon an-panel-icon--3d ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <img src={src} alt="" width={size} height={size} decoding="async" className={ready ? 'is-ready' : ''} onLoad={() => setReady(true)} />
    </span>
  );
}
