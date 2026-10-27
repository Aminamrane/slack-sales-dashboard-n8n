import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMotionPrefs } from './motion.js';

// Icône météo animée : chaque élément a son propre tempo, jamais synchrone, pour
// que ça vive sans clignoter (classes dans antique.css).
export function AnimatedMeteoIcon({ score, size = 54, color, strokeWidth = 1.6 }) {
  const stroke = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const svg = (children) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
      <g {...stroke}>{children}</g>
    </svg>
  );
  switch (score) {
    case 5: // grand soleil — les rayons tournent, le disque respire
      return svg(<>
        <g className="an-meteo-spin"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></g>
        <circle className="an-meteo-breathe" cx="12" cy="12" r="4" />
      </>);
    case 4: // éclaircie — rayons qui scintillent, nuage qui dérive
      return svg(<>
        <g className="an-meteo-twinkle"><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41" /></g>
        <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
        <g className="an-meteo-drift"><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" /></g>
      </>);
    case 3: // nuageux — dérive seule
      return svg(<g className="an-meteo-drift"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></g>);
    case 2: // pluie — nuage qui dérive, trois gouttes décalées
      return svg(<>
        <g className="an-meteo-drift"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /></g>
        <path className="an-meteo-rain" style={{ animationDelay: '0ms' }} d="M8 14v5" />
        <path className="an-meteo-rain" style={{ animationDelay: '260ms' }} d="M12 16v5" />
        <path className="an-meteo-rain" style={{ animationDelay: '520ms' }} d="M16 14v5" />
      </>);
    case 1: // orage — nuage lourd, éclair qui claque
      return svg(<>
        <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" />
        <path className="an-meteo-flash" d="m13 12-3 5h4l-3 5" />
      </>);
    default:
      return null;
  }
}

// Défilé météo : au repos les 5 temps s'enchaînent en fondu (grand soleil → orage),
// au survol de la carte on s'arrête sur la note réelle du parc. Boucle sans couture.
const ORDER = [5, 4, 3, 2, 1];
export function MeteoShowcase({ realScore, hovered, size = 54, color = '#dbe3f1', stepMs = 3200 }) {
  const [step, setStep] = useState(0);
  const { reduce } = useMotionPrefs();
  useEffect(() => {
    if (hovered || reduce) return undefined;
    const id = setInterval(() => setStep((s) => (s + 1) % ORDER.length), stepMs);
    return () => clearInterval(id);
  }, [hovered, reduce, stepMs]);
  const score = (hovered || reduce) && realScore != null ? realScore : ORDER[step];
  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={score} initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.86 }} transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }} style={{ display: 'flex' }}>
          <AnimatedMeteoIcon score={score} size={size} color={color} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
