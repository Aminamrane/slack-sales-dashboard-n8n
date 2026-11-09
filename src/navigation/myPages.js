// « Mes pages » : les pages qu'une personne peut ouvrir, telles que l'ancienne navbar les listait (dev 09/11/2026 :
// la navbar disparaît, ses liens passent dans le menu de gauche, chacun ne voit que ce à quoi il a accès).
// Une seule liste, mêmes règles que la navbar : permission du back (`apiClient.hasAccess`, lue dans
// role_permissions) ou rôle. Le back reste la garde qui fait foi sur chaque page.
// Écart corrigé : la navbar montrait « Meta Ads » à tout le monde (une virgule rendait sa condition toujours
// vraie) ; ici la règle est celle de la page et de l'API (META_ADS_ALLOWED_ROLES).
import { createElement } from "react";
import {
  BarChart3, Building2, Calculator, Clock3, Crown, Eye, Filter, Gauge, HeartHandshake, LayoutDashboard, LineChart,
  Megaphone, MonitorDot, NotebookPen, PhoneCall, Sheet, Shuffle, Target, Trophy, UsersRound, Wallet,
} from "lucide-react";
import apiClient from "../services/apiClient";

const I = (icon) => createElement(icon, { size: 16, strokeWidth: 1.9 });
const roleIn = (...roles) => (u) => roles.includes(u?.role);
const access = (key) => () => apiClient.hasAccess(key);

export const MY_PAGES = [
  { id: "page:ceo-leaderboard", tab: "leaderboard", label: "Dashboard", path: "/ceo/leaderboard", icon: I(LayoutDashboard), visible: roleIn("customer_success_manager") },
  { id: "page:leaderboard", tab: "leaderboard", label: "Suivi des ventes", path: "/", icon: I(Trophy), visible: access("leaderboard") },
  { id: "page:admin-leads", label: "Monitoring Lead", path: "/admin/leads", icon: I(Eye), visible: access("admin_leads") },
  { id: "page:leads-management", tab: "leads_management", label: "Gestion des leads", path: "/leads-management", icon: I(Shuffle), visible: access("leads_management") },
  { id: "page:monitoring-perf", tab: "perf_sales", label: "Monitoring Sales", path: "/monitoring-perf", icon: I(LineChart), visible: access("monitoring_perf") },
  { id: "page:tracking-sheet", tab: "my_tracking_sheet", label: "Tracking Sheet", path: "/tracking-sheet", icon: I(Sheet), visible: access("tracking_sheet") },
  { id: "page:tracking-setter", label: "Tracking Setter", path: "/tracking-setter", icon: I(PhoneCall), visible: access("tracking_sheet_setter") },
  { id: "page:eod-report", label: "End of Day", path: "/eod-report", icon: I(NotebookPen), visible: access("eod_reports") },
  { id: "page:eod-dashboard", label: "Dashboard EOD", path: "/eod-dashboard", icon: I(Gauge), visible: access("eod_dashboard") },
  { id: "page:campaigns", tab: "campaigns", label: "Campagnes", path: "/campaigns", icon: I(Target), visible: roleIn("admin", "marketing") },
  { id: "page:marketing", tab: "webinar", label: "Marketing", path: "/marketing", icon: I(Megaphone), visible: roleIn("admin", "ceo", "marketing") },
  { id: "page:ceo", tab: "dashboard", label: "CEO Dashboard", path: "/ceo", icon: I(Crown), visible: roleIn("admin", "ceo") },
  { id: "page:funnel-leads", tab: "funnel_leads", label: "Funnel Leads", path: "/funnel-leads", icon: I(Filter), visible: roleIn("admin", "ceo", "acquisition_director", "head_of_acquisition", "head_of_sales_manager") },
  { id: "page:finance", tab: "dispatch", label: "Finance", path: "/tracking-finance", icon: I(Wallet), visible: roleIn("admin", "ceo", "finance_director", "finance_team") },
  { id: "page:dialer", label: "Power Dialer", path: "/dialer", icon: I(MonitorDot), visible: roleIn("admin", "ceo", "finance_director", "finance_team") },
  { id: "page:optilex-board", tab: "optilex_board", label: "Board Owner", path: "/optilex-board", icon: I(Building2), visible: roleIn("admin", "optilex", "finance_team") },
  { id: "page:meta-ads", tab: "meta_ads", label: "Meta Ads", path: "/meta-ads", icon: I(BarChart3), visible: roleIn("ceo", "admin", "finance_director", "acquisition_director", "head_of_acquisition", "marketing", "hr") },
  { id: "page:variables", tab: "variables", label: "Calcul des variables", path: "/ceo/variables", icon: I(Calculator), visible: roleIn("admin", "ceo") },
  { id: "page:variables-setters", label: "Contribution des setters", path: "/variables/setters", icon: I(HeartHandshake), visible: roleIn("admin", "ceo") },
  { id: "page:rh", label: "Dashboard RH", path: "/rh-dashboard", icon: I(UsersRound), visible: roleIn("admin", "ceo", "hr") },
  { id: "page:work-hours", tab: "work_hours", label: "Heures de travail", path: "/work-hours", icon: I(Clock3), visible: roleIn("admin", "ceo", "hr") },
];

// `tab` : l'onglet du menu des tableaux de bord qui ouvre la même page ; le menu ne la répète pas dans « Mes pages »
// quand cet onglet y est déjà (dev 09/11/2026 : « j'ai tout en double »).

// Pages visibles pour l'utilisateur connecté, sans celle où il se trouve déjà.
export function myPages(user = apiClient.getUser(), currentPath = window.location.pathname) {
  return MY_PAGES.filter((p) => p.path !== currentPath && p.visible(user));
}
