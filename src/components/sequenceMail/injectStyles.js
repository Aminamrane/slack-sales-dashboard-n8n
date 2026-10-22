// src/components/sequenceMail/injectStyles.js
//
// Injection unique d'une feuille de style dans <head>. Les fenêtres de séquence montaient chacune leur
// propre <style> (≈ 35 Ko de CSS en double dès qu'on ouvrait l'éditeur à côté de la gestion) : on la
// pose une seule fois, identifiée par son `id`, et on la met à jour si son contenu change (rechargement à
// chaud). Rien n'est retiré au démontage : la feuille est partagée par toutes les fenêtres.

/**
 * @brief Pose (ou met à jour) la feuille `id` dans <head>.
 * @param id Identifiant stable de la feuille (un par source de CSS).
 * @param css Contenu CSS complet.
 */
export function ensureStyles(id, css) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}
