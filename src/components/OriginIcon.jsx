// Icone + couleur selon l'ORIGINE du lead (resto, BTP, general, webinaire, simulateur...).
// Couleurs sobres, coherentes avec la charte. Sert au flux des affectations.
export function originMeta(origin) {
  const o = (origin || "").toLowerCase();
  if (o.includes("crèche") || o.includes("creche") || o.includes("crech")) return { key: "microcreche", label: "Micro-crèche", color: "#c08497" };
  if (o.includes("resto") || o.includes("restau")) return { key: "resto", label: "Resto", color: "#c47a6a" };
  if (o.includes("btp")) return { key: "btp", label: "BTP", color: "#bf945f" };
  if (o.includes("webinaire") || o.includes("webinar")) return { key: "webinar", label: "Webinaire", color: "#5b7fc4" };
  if (o.includes("simu")) return { key: "simu", label: "Simulateur", color: "#7385b4" };
  if (o.includes("konket")) return { key: "konket", label: "Konket", color: "#5fa085" };
  if (o.includes("general") || o.includes("généra")) return { key: "general", label: "Général", color: "#7385b4" };
  if (o === "cc" || o.includes(" cc") || o.includes("cc ")) return { key: "cc", label: "CC", color: "#8b94a6" };
  return { key: "default", label: origin || "Lead", color: "#8b94a6" };
}

export default function OriginIcon({ origin, size = 17, color }) {
  const m = originMeta(origin);
  const c = color || m.color;
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.85, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (m.key) {
    case "resto": // couverts
      return <svg {...common}><path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></svg>;
    case "btp": // casque de chantier
      return <svg {...common}><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z" /><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" /><path d="M4 15v-3a6 6 0 0 1 6-6" /><path d="M14 6a6 6 0 0 1 6 6v3" /></svg>;
    case "webinar": // presentation / ecran
      return <svg {...common}><path d="M2 3h20" /><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" /><path d="m7 21 5-5 5 5" /></svg>;
    case "simu": // calculatrice
      return <svg {...common}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="18" /><line x1="8" y1="18" x2="12" y2="18" /></svg>;
    case "general": // immeuble
      return <svg {...common}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /></svg>;
    case "microcreche": // bebe (creche / micro-creche)
      return <svg {...common}><path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5S15.1 8 14 8c-.8 0-1.5-.4-1.5-1" /></svg>;
    default: // generique
      return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
  }
}
