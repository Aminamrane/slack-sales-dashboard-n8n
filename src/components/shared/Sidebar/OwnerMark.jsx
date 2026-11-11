// Le sigle Owner, redessiné en tracé (une barre oblique et deux pastilles, d'après src/assets/my_image.png) pour
// vivre sans cadre dans le menu de gauche : il prend la couleur du texte autour de lui, donc l'encre en mode clair
// et le clair en mode sombre, et reste net à toute taille. Dev 11/11/2026 : « ne plus avoir ce cadran, le mettre un
// peu plus en grand et mieux l'intégrer dans ce menu de gauche ».
export default function OwnerMark({ size = 24, className, style }) {
  return (
    <svg className={className} style={{ flexShrink: 0, display: "block", ...style }} width={size} height={size}
      viewBox="50 54 334 334" fill="currentColor" role="img" aria-label="Owner">
      <path d="M57 54h91l220 333h-91z" />
      <circle cx="316.5" cy="116.5" r="62.5" />
      <circle cx="117.5" cy="324.5" r="62.5" />
    </svg>
  );
}
