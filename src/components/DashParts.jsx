// Briques « tableau de bord » partagées par les fenêtres de la fiche (dev 29/10/2026, réf. de dashboard) : chiffre-clé
// avec son illustration au trait sur tuile grise, carte blanche titrée, ligne encadrée, étiquette, carte-dossier.
// Styles dans DashParts.css (classes ofd-*). Utilisées par « Faire l'onboarding » et la fenêtre « Créances ».
import "./DashParts.css";

const STROKE = "#d8d3cb";
const SOFT = "#e3ded6";
const ART = {
  doc: <><rect x="20" y="10" width="30" height="40" rx="5" fill="#fff" stroke={SOFT} strokeWidth="2" /><rect x="12" y="16" width="30" height="40" rx="5" fill="#fff" stroke={STROKE} strokeWidth="2" /><path d="M19 28h16M19 35h16M19 42h10" stroke={SOFT} strokeWidth="2.4" strokeLinecap="round" /></>,
  check: <><rect x="14" y="14" width="34" height="34" rx="9" fill="#fff" stroke={STROKE} strokeWidth="2" /><path className="ofd-art-tick" d="m22 31 6.5 6.5L41 25" stroke="#a8a39b" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
  folder: <><path d="M10 20a5 5 0 0 1 5-5h12l5 5h17a5 5 0 0 1 5 5v19a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5Z" fill="#fff" stroke={STROKE} strokeWidth="2" /><path d="M38 41h9" stroke={STROKE} strokeWidth="2.4" strokeLinecap="round" /></>,
  coins: <><ellipse cx="27" cy="22" rx="14" ry="5.5" fill="#fff" stroke={STROKE} strokeWidth="2" /><path d="M13 22v8c0 3 6.3 5.5 14 5.5s14-2.5 14-5.5v-8" fill="#fff" stroke={STROKE} strokeWidth="2" /><path d="M23 36v8c0 3 6.3 5.5 14 5.5s14-2.5 14-5.5v-8" fill="#fff" stroke={SOFT} strokeWidth="2" /><ellipse cx="37" cy="36" rx="14" ry="5.5" fill="#fff" stroke={SOFT} strokeWidth="2" /></>,
  calendar: <><rect x="12" y="15" width="38" height="34" rx="6" fill="#fff" stroke={STROKE} strokeWidth="2" /><path d="M12 25h38M22 11v8M40 11v8" stroke={STROKE} strokeWidth="2" strokeLinecap="round" /><rect x="20" y="31" width="7" height="6" rx="1.5" fill={SOFT} /><rect x="31" y="31" width="7" height="6" rx="1.5" fill="#ece9e4" /></>,
  envelope: <><rect x="11" y="16" width="40" height="30" rx="6" fill="#fff" stroke={STROKE} strokeWidth="2" /><path d="m12 19 19 13 19-13" stroke={STROKE} strokeWidth="2" fill="none" strokeLinejoin="round" /></>,
  // Badge de personne : le juriste de référence.
  person: <><rect x="9" y="14" width="44" height="34" rx="7" fill="#fff" stroke={STROKE} strokeWidth="2" /><circle cx="23" cy="28" r="5" fill="#fff" stroke={STROKE} strokeWidth="2" /><path d="M15 41c1.5-3.6 4.4-5.5 8-5.5s6.5 1.9 8 5.5" stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M36 26h10M36 32h7" stroke={SOFT} strokeWidth="2.4" strokeLinecap="round" /></>,
  // Pile de rendez-vous : le nombre total.
  stack: <><rect x="16" y="10" width="34" height="12" rx="4" fill="#fff" stroke={SOFT} strokeWidth="2" /><rect x="12" y="25" width="38" height="12" rx="4" fill="#fff" stroke={STROKE} strokeWidth="2" /><rect x="12" y="40" width="38" height="12" rx="4" fill="#fff" stroke={STROKE} strokeWidth="2" /><path d="M18 31h10M18 46h14" stroke={SOFT} strokeWidth="2.4" strokeLinecap="round" /></>,
  // Reçu au bord dentelé et son horloge : ce qui reste dû.
  receipt: <><path d="M15 9h28a3 3 0 0 1 3 3v40l-4.5-3-4.5 3-4.5-3-4.5 3-4.5-3-4.5 3-4.5-3V12a3 3 0 0 1 3-3Z" fill="#fff" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" /><path d="M20 19h18M20 26h18M20 33h10" stroke={SOFT} strokeWidth="2.4" strokeLinecap="round" /><circle cx="44" cy="42" r="9" fill="#fff" stroke="#a8a39b" strokeWidth="2" /><path className="ofd-art-hand" d="M44 37.5V42l3 2" stroke="#a8a39b" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
  // Pièces qui tombent dans une tirelire-coffre : ce qui est payé.
  paid: <><rect x="11" y="24" width="40" height="26" rx="7" fill="#fff" stroke={STROKE} strokeWidth="2" /><path d="M24 24v-3a7 7 0 0 1 14 0v3" stroke={SOFT} strokeWidth="2" fill="none" /><path className="ofd-art-tick" d="m23 37 5 5 11-10" stroke="#a8a39b" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
};
export const Art = ({ name }) => <svg className="ofd-art" viewBox="0 0 62 62" aria-hidden="true">{ART[name]}</svg>;

// Chiffre-clé : libellé, valeur, précision ; à droite la tuile grise et son illustration.
export function Stat({ label, value, sub, tone, art, i = 0, alert = false }) {
  return (
    <div className={`ofd-stat${alert ? " is-alert" : ""}`} style={{ "--ofd-i": i }}>
      <div className="ofd-stat-tx">
        <span>{label}</span>
        <strong style={tone ? { color: tone } : undefined}>{value}</strong>
        {sub && <small>{sub}</small>}
      </div>
      <div className="ofd-stat-art"><Art name={art} /></div>
    </div>
  );
}
export function Panel({ title, aside, children, className = "" }) {
  return (
    <section className={`ofd-panel ${className}`}>
      {(title || aside) && <header className="ofd-panel-head">{title && <h4>{title}</h4>}{aside}</header>}
      {children}
    </section>
  );
}
// Pictogrammes des lignes (même famille que les propriétés de la fiche : trait 1,7, arrondis).
const LIST_ICONS = {
  societe: <><path d="M3 21h18" /><rect x="5" y="3" width="10" height="18" rx="1.5" /><path d="M15 9h3.5a.5.5 0 0 1 .5.5V21M8.5 7h1M11 7h1M8.5 11h1M11 11h1M8.5 15h1M11 15h1" /></>,
  contact: <><rect x="5" y="3" width="15" height="18" rx="2.5" /><circle cx="12.5" cy="10" r="2.6" /><path d="M8.5 17c.6-1.8 2.2-3 4-3s3.4 1.2 4 3M3 7.5h2M3 12h2M3 16.5h2" /></>,
  email: <><circle cx="12" cy="12" r="3.8" /><path d="M15.8 12v1.4a2.6 2.6 0 0 0 5.2 0V12a9 9 0 1 0-3.6 7.2" /></>,
  phone: <path d="M8.3 3.6 6.1 3a2 2 0 0 0-2.2 1A12 12 0 0 0 20 20.1a2 2 0 0 0 1-2.2l-.6-2.2a1.5 1.5 0 0 0-1.6-1.1l-2.5.3a1.5 1.5 0 0 0-1.1.8l-.6 1.2a10 10 0 0 1-5.5-5.5l1.2-.6a1.5 1.5 0 0 0 .8-1.1l.3-2.5a1.5 1.5 0 0 0-1.1-1.6Z" />,
  date: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>,
  video: <><rect x="2.5" y="6" width="13.5" height="12" rx="2.5" /><path d="m16 10.5 5.5-3v9L16 13.5" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7.1l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7.1l1.7-1.7" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9a3 3 0 0 0-2.5-1c-1.7 0-2.8 1-2.8 2 0 2.6 5.6 1.4 5.6 4 0 1-1.1 2-2.8 2a3 3 0 0 1-2.5-1M12 6.5v1.5M12 16v1.5" /></>,
  promise: <><path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" /><path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8" /></>,
};
// Ligne encadrée : icône, libellé, valeur à droite (réf. « Recent contracts »).
export function ListRow({ icon, label, children }) {
  return (
    <div className="ofd-li">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{LIST_ICONS[icon]}</svg>
      <span className="ofd-li-k">{label}</span>
      <span className="ofd-li-v">{children}</span>
    </div>
  );
}
export const Tag = ({ tone = "#8b867e", children }) => <span className="ofd-tag" style={{ color: tone, background: `${tone}14` }}>{children}</span>;
// Carte-dossier (réf. « Your Contacts ») : le dossier au trait, l'état en haut à droite, le titre, une phrase.
export function FolderCard({ title, status, tone, children, i = 0 }) {
  return (
    <div className="ofd-folder" style={{ "--ofd-i": i }}>
      <div className="ofd-folder-top">
        <svg className="ofd-folder-art" viewBox="0 0 92 64" aria-hidden="true"><path d="M3 10a6 6 0 0 1 6-6h20l7 7h47a6 6 0 0 1 6 6v37a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6Z" fill="#fff" stroke="#e3ded6" strokeWidth="1.6" /><path d="M64 48h14" stroke={STROKE} strokeWidth="2.4" strokeLinecap="round" /></svg>
        {status && <Tag tone={tone}>{status}</Tag>}
      </div>
      <strong>{title}</strong>
      {children && <small>{children}</small>}
    </div>
  );
}
