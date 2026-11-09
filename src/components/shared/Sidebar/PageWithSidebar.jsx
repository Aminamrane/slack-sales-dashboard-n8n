// Pages hors tableaux de bord (Suivi des ventes, Profil…) : le même menu de gauche que partout (dev 09/11/2026 :
// « tout le monde aura un menu comme le CEO à gauche, seulement avec les pages auxquelles il a accès »).
// Notifications en haut, « Mes pages » (la page ouverte en surbrillance), profil en bas. `enabled` à faux : la page
// est intégrée dans un tableau de bord qui a déjà son menu, elle s'affiche seule.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import { myPages } from "../../../navigation/myPages.js";
import { getColors } from "../../../utils/ceoColors.js";

export default function PageWithSidebar({ enabled = true, darkMode, setDarkMode, children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try { const v = localStorage.getItem("ceoSideCollapsed_v2"); return v === null ? true : v === "true"; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem("ceoSideCollapsed_v2", String(collapsed)); } catch { /* stockage indisponible */ } }, [collapsed]);
  const pages = useMemo(() => myPages(undefined, null), []);
  const sections = useMemo(() => [{ key: "pages", label: "Mes pages", items: pages.map((p) => ({ id: p.id, label: p.label, icon: p.icon })) }], [pages]);
  const active = pages.find((p) => p.path === pathname)?.id || null;
  if (!enabled) return children;
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar width={collapsed ? 56 : 260} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)}
        sections={sections} activeTab={active} setActiveTab={(id) => { const p = pages.find((x) => x.id === id); if (p && p.path !== pathname) navigate(p.path); }}
        C={getColors(darkMode)} darkMode={darkMode} setDarkMode={setDarkMode} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
