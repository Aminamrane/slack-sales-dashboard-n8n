// Amener un message sous les yeux et l'y garder (dev 21/11/2026 : depuis une notification, « ça ne me met pas
// exactement au message où on m'a tagué »). Le défilé partait une fois, trop tôt : les blocs de la fiche qui se
// chargent au-dessus du fil le repoussaient ensuite hors de vue. Ici : on attend que le message existe, on le place au
// centre de sa zone de défilement, puis on le recale tant que la fiche bouge encore, et on lâche dès que la personne
// fait défiler elle-même (molette, toucher, clavier, clic).

const scrollParent = (el) => {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return document.scrollingElement || document.documentElement;
};

// Écart entre le centre du message et le centre de sa zone (négatif : le message est trop haut).
export function centerOffset(elRect, boxTop, boxHeight) {
  return (elRect.top + elRect.height / 2) - (boxTop + boxHeight / 2);
}

export function pinIntoView(find, { wait = 6000, hold = 2400, tolerance = 24 } = {}) {
  let stopped = false;
  const started = Date.now();
  let placedAt = 0;
  let lastMove = 0;
  const stop = () => {
    stopped = true;
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((type) => window.removeEventListener(type, stop, true));
  };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((type) => window.addEventListener(type, stop, { capture: true, passive: true }));
  const tick = () => {
    if (stopped) return;
    const now = Date.now();
    const el = find();
    if (!el) {
      if (now - started > wait) { stop(); return; }
      setTimeout(tick, 100);
      return;
    }
    const box = scrollParent(el);
    const isPage = box === document.scrollingElement || box === document.documentElement;
    const boxRect = isPage ? { top: 0, height: window.innerHeight } : box.getBoundingClientRect();
    const delta = centerOffset(el.getBoundingClientRect(), boxRect.top, boxRect.height);
    if (Math.abs(delta) > tolerance) {
      box.scrollTop += delta;
      lastMove = now;
      if (!placedAt) placedAt = now;
    } else if (!placedAt) placedAt = now;
    // On garde la main tant que la fiche bouge encore, au plus `hold` après le dernier recalage.
    if (now - Math.max(placedAt, lastMove) > hold) { stop(); return; }
    setTimeout(tick, 120);
  };
  setTimeout(tick, 0);
  return stop;
}
