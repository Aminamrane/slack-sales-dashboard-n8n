import { CircleHelp, Phone, PhoneForwarded, Target, Video } from "lucide-react";

// Icône du canal d'origine d'une vente, à la couleur du canal (variables.css, --ch-*) : cold call = téléphone,
// cold call setter = téléphone qui transfère (le setter passe le RDV au sales), webinaire = caméra, Ads = cible,
// canal non retrouvé = point d'interrogation. La même icône sert de légende dans les puces de filtre.
const ICONS = { CC: Phone, CCS: PhoneForwarded, WEB: Video, ADS: Target };

export function ChannelIcon({ channel, size = 16 }) {
  const Icon = ICONS[channel] || CircleHelp;
  return <Icon size={size} strokeWidth={2} aria-hidden="true" className={`vr-channel-icon ${String(channel || "unknown").toLowerCase()}`} />;
}
