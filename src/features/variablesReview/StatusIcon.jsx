import { CalendarClock, CircleCheck, CircleDashed, CircleHelp, CircleX, TriangleAlert } from "lucide-react";

// Statut d'une vente, même icône et même couleur partout (pastilles, en-têtes de groupe, puces, carte) :
// paid = dans la paie du mois, later = paie suivante, waiting = pas encore payée, upcoming = onboarding ou
// échéance à venir, lost = client perdu, unknown = non déclarée ou à rapprocher.
const ICONS = { paid: CircleCheck, later: CalendarClock, waiting: TriangleAlert, upcoming: CircleDashed, lost: CircleX, unknown: CircleHelp };

export function StatusIcon({ tone, size = 14 }) {
  const Icon = ICONS[tone] || CircleHelp;
  return <Icon size={size} strokeWidth={2.2} aria-hidden="true" className={`vr-status-icon ${tone}`} />;
}

// Pastille de statut (référence du dev, 27/10) : fond teinté doux, icône et texte de la même couleur.
export function StatusPill({ status }) {
  return (
    <span className={`vr-badge ${status.tone}`} title={status.title}>
      <StatusIcon tone={status.tone} size={13} />
      {status.label}
    </span>
  );
}
