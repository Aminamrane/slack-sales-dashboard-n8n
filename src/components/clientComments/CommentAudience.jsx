// À qui s'adresse un message du fil d'un client (dev 17/11/2026, « commentaires facturation ») : le choix Interne /
// Board / Sales du board, les badges des messages, l'étiquette « Commentaire du sales » et le rappel du dernier
// commentaire du sales dans la fiche Finance. Les règles sont dans utils/commentVisibility.js ; le serveur fait foi.
import { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { ArrowUpRight, BriefcaseBusiness, Lock, Users } from 'lucide-react';
import apiClient from '../../services/apiClient.js';
import { VISIBILITY_CHOICES, isSalesAuthored, visibilityBadge } from '../../utils/commentVisibility.js';
import './CommentAudience.css';

const ICONS = { internal: Lock, board: Users, sales: BriefcaseBusiness };
const SPRING = { type: 'spring', stiffness: 520, damping: 40 };

// Trois positions, le curseur glisse. `extra` : attributs de lecture seule (rôles en lecture seule), étalés sur chaque bouton.
export function VisibilityToggle({ value, onChange, id, extra = {} }) {
  return (
    <div className="ca-toggle" role="group" aria-label="Qui lira ce message">
      {VISIBILITY_CHOICES.map(({ key, label, scope }) => {
        const Icon = ICONS[key];
        const on = value === key;
        return (
          <button key={key} type="button" aria-pressed={on} className={`is-${key}${on ? ' is-on' : ''}`} title={scope} onClick={() => onChange(key)} {...extra}>
            {on && <Motion.span layoutId={`${id}-thumb`} className="ca-toggle-thumb" transition={SPRING} />}
            <span><Icon size={12} strokeWidth={2.1} />{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Badge d'un message hors board (« Interne », « Sales ») ; rien pour un message du board.
export function VisibilityBadge({ visibility }) {
  const badge = visibilityBadge(visibility);
  if (!badge) return null;
  const Icon = ICONS[badge.key];
  return <span className={`ca-badge is-${badge.key}`} title={badge.title}><Icon size={11} strokeWidth={2.2} />{badge.label}</span>;
}

// « Commentaire du sales » : le message vient du sales du client (rôle de l'auteur donné par le serveur).
export function SalesAuthorTag({ comment }) {
  if (!isSalesAuthored(comment)) return null;
  return <span className="ca-badge is-author" title="Écrit par le sales depuis sa Tracking Sheet">Commentaire du sales</span>;
}

// Annuaires des mentions hors board : « internal » (Owner, sans le cabinet) et « sales » (Owner et les sales, le sales
// du client en tête). Chargés une fois par client, seulement pour qui peut écrire ces messages.
export function useMentionDirectories(numero, enabled) {
  const [lists, setLists] = useState({ internal: [], sales: [] });
  useEffect(() => {
    if (!enabled || !numero) return undefined;
    let alive = true;
    for (const visibility of ['internal', 'sales']) {
      apiClient.get(`/api/v1/optilex/comments/mentionables?visibility=${visibility}&numero_client=${encodeURIComponent(numero)}`)
        .then((r) => { if (alive) setLists((all) => ({ ...all, [visibility]: r.people || [] })); })
        .catch(() => { /* sans annuaire, le message reste du texte ; le serveur reconnaît « @Nom » */ });
    }
    return () => { alive = false; };
  }, [numero, enabled]);
  return lists;
}

const fmtDay = (iso) => {
  if (!iso) return '';
  const d = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(iso)) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Sous le nom du sales dans la fiche Finance : son dernier commentaire (extrait et date) ; un clic ouvre les Échanges sur lui.
export function LatestSalesComment({ note, onOpen }) {
  if (!note) return null;
  return (
    <button type="button" className="ca-last" onClick={onOpen} title="Ouvrir ce commentaire dans les Échanges">
      <span className="ca-last-top">
        <span>Dernier commentaire du sales{note.count > 1 ? ` (${note.count})` : ''}</span>
        <time dateTime={note.at}>{fmtDay(note.at)}</time>
        <ArrowUpRight size={12} strokeWidth={2.2} />
      </span>
      <span className="ca-last-text">{note.text}</span>
    </button>
  );
}
