// Raccourcis clavier globaux : jamais pendant une saisie. Un champ, une zone de texte ou l'éditeur de
// commentaire enrichi (contenteditable) : Maj+S y avalait le « S » et les flèches changeaient d'onglet
// (remontée d'un sales, 29/09/2026).
export function isTypingTarget(el) {
  return !!el && (['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable === true);
}
