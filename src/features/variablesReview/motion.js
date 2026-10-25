// Mouvement de la page Variables (framer-motion, déjà utilisé dans le CRM).
// Règles : jamais d'opacité pendant un déplacement ; entrée en ressort avec léger
// dépassement ; sortie sèche en ease-in ; décalages courts ; rien qui ralentisse l'usage.

// Chiffre à lire : amortissement ~0,75, dépassement à peine perceptible.
export const SPRING_READ = { type: "spring", stiffness: 300, damping: 26, mass: 1 };
// Éléments d'interface (pastilles, lignes, fenêtres) : un peu plus vif.
export const SPRING_UI = { type: "spring", stiffness: 420, damping: 32, mass: 1 };
// Sortie : sèche, sans rebond.
export const EXIT = { duration: 0.15, ease: [0.4, 0, 1, 1] };
// Cascade entre éléments qui entrent séparément, plafonnée pour ne jamais faire attendre.
export const STAGGER = 0.07;
export const STAGGER_MAX = 8;
// Changement de personne ou de mois : liste, puis carte, puis tableau.
export const STEP = 0.14;
