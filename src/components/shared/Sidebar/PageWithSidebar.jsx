// Pages hors tableaux de bord (Suivi des ventes, Profil…) : le même menu de gauche que partout (dev 09/11/2026 :
// « tout le monde aura un menu comme le CEO à gauche, seulement avec les pages auxquelles il a accès »).
// Notifications en haut, « Mes pages » (la page ouverte en surbrillance), profil en bas. `enabled` à faux : la page
// est intégrée dans un tableau de bord qui a déjà son menu, elle s'affiche seule.
// Rôles qui ont un tableau de bord (dev 21/11/2026 : « le menu à gauche ne doit pas changer en fonction des pages où on
// va ») : le menu de leur tableau de bord, le même que sur /ceo, au lieu de « Mes pages ».
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import { myPages } from "../../../navigation/myPages.js";
import { dashboardMenuSections, dashboardTabForPath, hasDashboardMenu, openDashboardTab } from "../../../navigation/dashboardMenu.jsx";
import apiClient from "../../../services/apiClient";
import { getColors } from "../../../utils/ceoColors.js";

export default function PageWithSidebar({ enabled = true, darkMode, setDarkMode, children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try { const v = localStorage.getItem("ceoSideCollapsed_v2"); return v === null ? true : v === "true"; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem("ceoSideCollapsed_v2", String(collapsed)); } catch { /* stockage indisponible */ } }, [collapsed]);
  const role = apiClient.getUser()?.role;
  const dashboard = hasDashboardMenu(role);
  const pages = useMemo(() => myPages(undefined, null), []);
  const sections = useMemo(() => (dashboard ? dashboardMenuSections(role)
    : [{ key: "pages", label: "Mes pages", items: pages.map((p) => ({ id: p.id, label: p.label, icon: p.icon })) }]), [dashboard, role, pages]);
  const active = dashboard ? dashboardTabForPath(pathname) : pages.find((p) => p.path === pathname)?.id || null;
  const open = (id) => {
    if (dashboard) { openDashboardTab(navigate, role, id); return; }
    const p = pages.find((x) => x.id === id);
    if (p && p.path !== pathname) navigate(p.path);
  };
  if (!enabled) return children;
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar width={collapsed ? 56 : 260} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)}
        sections={sections} activeTab={active} setActiveTab={open}
        C={getColors(darkMode)} darkMode={darkMode} setDarkMode={setDarkMode} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
