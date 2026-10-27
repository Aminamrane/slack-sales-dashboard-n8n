// Photos de profil chargées et décodées dès réception des données : au changement de
// personne, la photo est prête dans l'image même (jamais de cercle vide pendant le glissement).
const kept = new Map(); // URL → image décodée, gardée pour que le navigateur ne l'évince pas

export function preloadAvatars(source, timeoutMs = 1500) {
  const urls = [...new Set(Object.values(source?.profiles || {}).map((p) => p?.avatar).filter(Boolean))];
  const loads = urls.map((url) => {
    if (kept.has(url)) return kept.get(url).ready;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    const ready = (img.decode ? img.decode() : Promise.resolve()).catch(() => undefined);
    kept.set(url, { img, ready });
    return ready;
  });
  // Une photo lente ne retient jamais la page : au-delà du délai, on affiche quand même.
  return Promise.race([Promise.allSettled(loads), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}
