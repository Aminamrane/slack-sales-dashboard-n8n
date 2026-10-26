// Mouvement de la page Variables (framer-motion, déjà utilisé dans le CRM).
// Une page de paie ne montre jamais deux états à la fois : quand les données changent,
// tout le texte change dans la même image ; seul le déplacement d'entrée diffère.
// Jamais d'opacité pendant un déplacement, jamais de sortie qui laisse un trou.

// Grand total (et total d'équipe) : roule dans sa fenêtre, ancien et nouveau verrouillés
// sur le même ressort, donc toujours bord à bord. Amortissement ~0,73 (dépassement ~3 %, < 2 px),
// posé en ~240 ms. Le ressort démarre 30 ms à l'intérieur de sa courbe (délai négatif, même
// réglage pour l'ancien et le nouveau) : on saute le départ hésitant d'un ressort à l'arrêt,
// qui laissait l'ancien total presque immobile à côté de la nouvelle personne.
export const ROLL = { type: "spring", stiffness: 600, damping: 36, mass: 1, delay: -0.03 };
// Glissement secondaire (identité, fixe, commissions, primes, en attente, libellé du mois).
export const GLIDE = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };
export const GLIDE_STEP = 0.03;
// Lignes du tableau : court déplacement, ressort rapide, cascade plafonnée.
export const ROW = { type: "spring", stiffness: 3600, damping: 120, mass: 1 };
export const ROW_STEP = 0.03;
// Cascade plafonnée à 7 lignes (les suivantes partent avec la 7e) : avec le départ à +60 ms
// et 30 ms par ligne, c'est ce qui laisse tout posé avant 350 ms après le clic.
export const ROW_MAX = 7;
// +60 ms après le clic : framer démarre une image après le clic, d'où 40 ms de délai interne.
export const TABLE_DELAY = 0.04;
// Liste : les personnes présentes dans les deux mois glissent vers leur nouveau rang (FLIP).
export const FLIP = { type: "spring", stiffness: 600, damping: 45, mass: 1 };
// Hauteur du tableau : amortissement critique, sans dépassement (il montrerait du vide).
export const HEIGHT = { type: "spring", stiffness: 1100, damping: 66, mass: 1 };
// Indicateurs qui glissent d'un élément à l'autre (personne sélectionnée, puce active).
export const INDICATOR = FLIP;
// Pastilles, onglets, fenêtres : interface.
export const SPRING_UI = { type: "spring", stiffness: 420, damping: 32, mass: 1 };
// Sortie des fenêtres et du toast : sèche, sans rebond.
export const EXIT = { duration: 0.15, ease: [0.4, 0, 1, 1] };

// Déplacement d'entrée selon la cause : changement de mois = horizontal (→ entre par la
// droite, ← par la gauche), le reste = vertical, dans le sens de la navigation.
export const entryOffset = ({ axis, direction }, distance) =>
  axis === "x" ? { x: direction * 16, y: 0 } : { x: 0, y: direction * distance };
