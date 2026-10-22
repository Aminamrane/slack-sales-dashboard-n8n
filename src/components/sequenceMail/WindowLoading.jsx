// src/components/sequenceMail/WindowLoading.jsx
//
// Contenu provisoire d'une fenêtre de séquence pendant le chargement de son code (premier affichage :
// le client e-mail, le schéma et l'éditeur ne sont chargés qu'à la première ouverture). Annoncé aux lecteurs
// d'écran (`role="status"`).

/** @param colors Palette de la fenêtre (`text`, `muted`). @param label Texte affiché. */
export default function WindowLoading({ colors: C = {}, label = 'Chargement…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted || 'inherit', fontSize: 13 }}
    >
      <span
        aria-hidden
        style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'ceoBotIaSpin 0.7s linear infinite' }}
      />
      {label}
    </div>
  );
}
