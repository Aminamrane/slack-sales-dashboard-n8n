import { useState } from 'react';
import { activeMedal, ownedMedals } from '../utils/podiumMedals.js';

// Médailles du classement individuel (demande du 16/10/2026) : or, argent et bronze EMPILÉS, décalées les unes derrière les
// autres (l'or devant). Le chiffre « ×N » reste tout à droite et suit la médaille survolée ; par défaut l'or, à défaut
// l'argent, à défaut le bronze. Chaque icône garde l'animation et l'effet de survol du trophée (classes `trophy-*`).
const LABEL = { gold: 'Trophy', silver: "Médaille d'argent", bronze: 'Médaille de bronze' };

export default function MedalStack({ counts, icons }) {
  const [hovered, setHovered] = useState(null);
  const owned = ownedMedals(counts);
  if (!owned.length) return null;
  const active = activeMedal(counts, hovered);
  const count = Number(counts[active]);
  return (
    <div className="medal-stack" onMouseLeave={() => setHovered(null)}>
      <div className="medal-stack-icons">
        {owned.map((kind) => (
          <div
            key={kind}
            className={`trophy-container medal-${kind}${hovered === kind ? ' is-hovered' : ''}`}
            onMouseEnter={() => setHovered(kind)}
          >
            <img src={icons[kind]} alt={LABEL[kind]} className="trophy-icon" />
          </div>
        ))}
      </div>
      {count > 1 && <span className={`trophy-count medal-count-${active}`}>×{count}</span>}
    </div>
  );
}
