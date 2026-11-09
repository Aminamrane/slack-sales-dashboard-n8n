// Menu de gauche des Tracking Sheets (dev 09/11/2026 : « tout le monde aura un menu comme le CEO à gauche, mais
// seulement les pages auxquelles il a accès ; la navbar des sales saute, ses onglets passent dans ce menu »).
// Le même menu que le CEO (notifications en haut, profil en bas), avec deux sections :
// - la sheet elle-même : ses vues (Mes leads, Barrage répondeur, Calendrier…), telles que la page les définit ;
// - « Mes pages » : les autres pages de la personne (src/navigation/myPages.js, règles de l'ancienne navbar).
// La page garde la main sur ses vues : ce composant ne fait que les afficher et prévenir au clic.
import { createElement, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellRing, CalendarDays, ChartColumn, ChartNoAxesCombined, Funnel, ListChecks, Megaphone, PhoneOff, RotateCcw, Send, Sheet,
  Shuffle, SlidersHorizontal, Sparkles, UserSearch, UsersRound, Video,
} from "lucide-react";
import Sidebar from "./Sidebar.jsx";
import { myPages } from "../../../navigation/myPages.js";

// Un seul jeu d'icônes, au trait et à la taille du menu partagé (16 px, trait 1,9) : les images de l'ancien menu
// des sales avaient chacune leurs marges et sortaient à des tailles inégales dans le rail replié (dev 09/11/2026).
const VIEW_ICONS = {
  leads: UsersRound, common_pool: PhoneOff, calendar: CalendarDays, prospect_search: UserSearch, prospect_lists: ListChecks,
  notifications: BellRing, email: Send, ai_bilan: Sparkles, kpis: ChartColumn, sales_prefs: SlidersHorizontal,
  my_prefs: SlidersHorizontal, funnel_leads: Funnel, perf_sales: ChartNoAxesCombined, recordings: Video,
  leads_management: Shuffle, sheets: Sheet,
  // Tracking Setter
  agenda: CalendarDays, second_chance: RotateCcw, webinar_rdv: Video, campaigns: Megaphone, team_perf: UsersRound,
};

// Icône d'une vue : celle du jeu commun ; à défaut (vue ajoutée plus tard), le dessin fourni par la page.
function ViewIcon({ view }) {
  const icon = VIEW_ICONS[view.key];
  if (icon) return createElement(icon, { size: 16, strokeWidth: 1.9 });
  if (view.iconNode) return <span style={{ display: "inline-flex", transform: "scale(.86)" }}>{view.iconNode(false)}</span>;
  if (view.iconSrc && view.keepColor) return <img src={view.iconSrc} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />;
  if (view.iconSrc) {
    const mask = { WebkitMaskImage: `url(${view.iconSrc})`, maskImage: `url(${view.iconSrc})`, WebkitMaskSize: "contain", maskSize: "contain",
      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" };
    return <span style={{ width: 18, height: 18, backgroundColor: "currentColor", ...mask }} />;
  }
  return <span>{view.icon}</span>;
}

export default function SheetSidebar({ title = "Ma Tracking Sheet", views, activeView, onView, headerExtra, C, darkMode, setDarkMode }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { const v = localStorage.getItem("ceoSideCollapsed_v2"); return v === null ? true : v === "true"; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem("ceoSideCollapsed_v2", String(collapsed)); } catch { /* stockage indisponible */ } }, [collapsed]);

  const viewKey = views.map((v) => `${v.key}:${v.badge?.value ?? ""}`).join("|");
  const sections = useMemo(() => {
    const out = [{
      key: "sheet", label: title,
      items: views.map((v) => ({ id: `view:${v.key}`, label: v.label, icon: <ViewIcon view={v} />, badge: v.badge })),
    }];
    const pages = myPages();
    if (pages.length) out.push({ key: "pages", label: "Mes pages", items: pages.map((p) => ({ id: p.id, label: p.label, icon: p.icon })) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- les vues sont recréées à chaque rendu de la page : on suit leur contenu
  }, [title, viewKey]);

  const onTab = (id) => {
    if (id.startsWith("view:")) { onView(id.slice(5)); return; }
    const page = myPages().find((p) => p.id === id);
    if (page) navigate(page.path);
  };

  return (
    <Sidebar width={collapsed ? 56 : 260} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)}
      sections={sections} activeTab={`view:${activeView}`} setActiveTab={onTab}
      C={C} darkMode={darkMode} setDarkMode={setDarkMode} headerExtra={headerExtra} />
  );
}
