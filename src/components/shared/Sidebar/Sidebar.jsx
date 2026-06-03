// src/components/shared/Sidebar/Sidebar.jsx
//
// Sidebar Notion-style partagée par les 5 pages de l'écosystème CEO :
//   CeoDashboard, CeoSheetView, CeoDispatchView, CeoLeaderboardView,
//   AcquisitionDirectorDashboard.
//
// Extrait initialement depuis CeoDashboard.jsx (commentaire historique
// avait flag "extraire au 3e usage"; on était à 5).
//
// Le composant attend :
//   - sections : déjà construites côté caller (voir SIDEBAR_SECTIONS dans
//     CeoDashboard.jsx — généré depuis SIDEBAR_TABS, spécifique au métier
//     Owner). On garde la responsabilité métier côté CeoDashboard, le shared
//     ne fait QUE le rendu.
//   - C       : palette { bg, text, muted, border, ... } — typiquement
//                getColors(darkMode) côté caller.
//   - darkMode : booléen pour les hover styles
//   - activeTab + setActiveTab : routing/state côté caller
//   - width / collapsed / onToggle : pilotage de la largeur animée
//
// Les classes CSS `.ceo-side`, `.ceo-side-item`, `.ceo-side-scroll`,
// `.ceo-icon-btn` sont conservées telles quelles (déjà injectées dans le
// `<style>` de chaque page hôte).

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Home, MessageSquare, Mail, Search, Sparkles, PanelLeft } from "lucide-react";
import companyLogo from "../../../assets/my_image.png";

export default function Sidebar({ width, collapsed, onToggle, sections, activeTab, setActiveTab, C, darkMode }) {
  return (
    <motion.aside
      className="ceo-side"
      animate={{ width }}
      initial={false}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={{
        flexShrink: 0,
        background: C.bg,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <WorkspaceHeader collapsed={collapsed} C={C} />
        <IconRow collapsed={collapsed} C={C} />
      </div>

      <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0' }} className="ceo-side-scroll">
        {sections.map((sec) => (
          <SidebarSection
            key={sec.key}
            section={sec}
            collapsed={collapsed}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            C={C}
            darkMode={darkMode}
          />
        ))}
      </nav>

      <div style={{ flexShrink: 0 }}>
        <SidebarFooter collapsed={collapsed} onToggle={onToggle} C={C} />
      </div>
    </motion.aside>
  );
}

function WorkspaceHeader({ collapsed, C }) {
  return (
    <div style={{
      padding: collapsed ? '10px 8px' : '10px 8px 6px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 6,
    }}>
      <button
        className="ceo-icon-btn"
        style={{
          flex: 1,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 6px',
          borderRadius: 4,
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
          minWidth: 0,
        }}
      >
        <span style={{
          width: 22, height: 22, flexShrink: 0,
          borderRadius: 4,
          background: '#fff',
          border: `1px solid ${C.border}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img src={companyLogo} alt="Owner" style={{ width: 18, height: 18, objectFit: 'contain' }} />
        </span>
        {!collapsed && (
          <>
            <span style={{
              fontSize: 14, fontWeight: 600, color: C.text,
              letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Owner Technology
            </span>
            <ChevronDown size={14} style={{ color: C.muted, flexShrink: 0, marginLeft: 'auto' }} />
          </>
        )}
      </button>
    </div>
  );
}

function IconRow({ collapsed, C }) {
  const items = [
    { key: 'home',   icon: <Home size={16} />,          label: 'Accueil' },
    { key: 'inbox',  icon: <MessageSquare size={16} />, label: 'Discussions' },
    { key: 'mail',   icon: <Mail size={16} />,          label: 'Boîte de réception' },
    { key: 'search', icon: <Search size={16} />,        label: 'Recherche' },
  ];
  return (
    <div style={{
      display: collapsed ? 'flex' : 'grid',
      flexDirection: collapsed ? 'column' : undefined,
      gridTemplateColumns: collapsed ? undefined : 'repeat(4, 1fr)',
      gap: 2,
      padding: collapsed ? '4px 8px 8px' : '0 8px 6px',
    }}>
      {items.map((it) => (
        <button
          key={it.key}
          className="ceo-icon-btn"
          title={it.label}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 8,
            padding: '6px 0',
            borderRadius: 4,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: C.muted, fontFamily: 'inherit',
          }}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}

function SidebarSection({ section, collapsed, activeTab, setActiveTab, C, darkMode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ padding: collapsed ? '4px 6px' : '4px 8px' }}>
      {!collapsed && (
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 6px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'inherit',
            color: C.muted,
            fontSize: 12, fontWeight: 600,
            letterSpacing: '0.01em',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f4'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <ChevronDown
            size={12}
            style={{
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s ease',
              color: C.muted,
            }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {section.label}
          </span>
        </button>
      )}

      <AnimatePresence initial={false}>
        {(open || collapsed) && (
          <motion.div
            key="items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
              {section.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  active={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                  C={C}
                  darkMode={darkMode}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ item, collapsed, active, onClick, C, darkMode }) {
  return (
    <button
      className="ceo-side-item"
      title={collapsed ? item.label : undefined}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: collapsed ? '6px 0' : '4px 6px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        border: 'none',
        background: active ? (darkMode ? 'rgba(255,255,255,0.08)' : '#eeeeec') : 'transparent',
        cursor: 'pointer',
        borderRadius: 4,
        fontFamily: 'inherit',
        color: C.text,
        fontSize: 14,
        textAlign: 'left',
        width: '100%',
        minWidth: 0,
      }}
    >
      <span style={{
        width: 20, height: 20, flexShrink: 0, borderRadius: 4,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: active ? C.text : C.muted,
      }}>
        {item.icon}
      </span>
      {!collapsed && (
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: active ? 500 : 400,
          color: C.text,
          flex: 1,
        }}>
          {item.label}
        </span>
      )}
    </button>
  );
}

function SidebarFooter({ collapsed, onToggle, C }) {
  return (
    <div style={{
      borderTop: `1px solid ${C.border}`,
      padding: collapsed ? '6px 6px' : '6px 8px',
      display: 'flex',
      flexDirection: collapsed ? 'column' : 'row',
      alignItems: 'center',
      gap: 6,
    }}>
      {!collapsed && (
        <button
          className="ceo-side-item"
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            borderRadius: 4,
            fontFamily: 'inherit',
            color: C.text,
            fontSize: 13,
            textAlign: 'left',
            minWidth: 0,
          }}
        >
          <Sparkles size={14} style={{ color: C.muted }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Nouvelle discussion
          </span>
          <span style={{
            fontSize: 11, color: C.muted,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 3,
            padding: '0 4px',
            fontFamily: 'inherit',
          }}>
            ⌘O
          </span>
        </button>
      )}

      <button
        onClick={onToggle}
        title={collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
        className="ceo-icon-btn"
        style={{
          width: 28, height: 28,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'pointer',
          borderRadius: 4,
          color: C.muted,
        }}
      >
        <PanelLeft size={15} />
      </button>
    </div>
  );
}
