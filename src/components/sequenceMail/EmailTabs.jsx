// src/components/sequenceMail/EmailTabs.jsx
//
// Barre d'onglets de la fenêtre, comme celle d'un navigateur : le premier onglet est la liste des
// e-mails (épinglé, jamais fermé), suivi d'un onglet par e-mail ouvert — de vrais onglets
// d'application (ARIA tablist, clavier, fermeture au milieu-clic, réordonnables) et point de
// départ du détachement en fenêtre.
//
// Glisser un onglet : à l'intérieur de la barre il se réordonne ; en le sortant de la barre
// (plus de 24 px au-dessus/au-dessous, ou 48 px sur les côtés), un fantôme « Relâcher pour
// détacher » apparaît, et au relâchement l'e-mail devient une fenêtre flottante à cet endroit.
// La barre sert aussi de cible pour réintégrer une fenêtre flottante (cf. FloatingEmailWindow).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import { AppWindow, ChevronDown, ChevronLeft, ChevronRight, Inbox, Mail, PictureInPicture, X } from 'lucide-react';
import { beginDragMode, useElementSize } from './hooks';
import { fmtDayMonth, fmtTime } from './format';
import { shortRelative } from './model';
import { LIST_PANEL_ID, LIST_TAB_ID, tabDomId, panelDomId } from './domIds';
import { MenuButton } from './ui';
import { useThemeClass } from './themeContext';

/** @brief Distance (px) à partir de laquelle un onglet glissé hors de la barre devient « détachable ». */
const DETACH_Y = 24;
const DETACH_X = 48;
/** @brief Clé (DOM et clavier) du premier onglet, la liste : le store la désigne par `null`. */
const LIST_KEY = '@list';

function labelOf(email, key) {
  if (!email) return { title: 'Chargement…', sub: key.split('::')[1] || '' };
  const t = email.timing;
  const when = t?.mode === 'calendar' ? `${fmtDayMonth(t.at)} ${fmtTime(t.at)}` : shortRelative(t);
  return { title: email.subject || (email.hasContent ? '(sans objet)' : email.kind), sub: [email.cohortShort, when].filter(Boolean).join(' · ') };
}

/**
 * @brief Le premier onglet : la liste des e-mails. Épinglé à gauche (il reste visible quand les autres
 * défilent), ni fermable, ni réordonnable, ni détachable.
 */
function ListTab({ label, active, tabIndex, onActivate }) {
  return (
    <div role="presentation" data-smx-tab="" data-smx-list-tab="" className={`smx-tab is-pinned${active ? ' is-active' : ''}`}>
      <div
        role="tab"
        id={LIST_TAB_ID}
        data-key={LIST_KEY}
        aria-selected={active}
        aria-controls={active ? LIST_PANEL_ID : undefined}
        tabIndex={tabIndex}
        title={`${label.title}${label.sub ? `\n${label.sub}` : ''}`}
        className="smx-tab-main"
        onClick={onActivate}
      >
        <Inbox size={14} aria-hidden style={{ flexShrink: 0, opacity: 0.7 }} />
        <span className="smx-tab-body">
          <span className="smx-tab-title">{label.title}</span>
          <span className="smx-tab-sub">{label.sub}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * @brief Un onglet d'e-mail : le conteneur (glissable) porte l'onglet proprement dit (`role="tab"`) ET son
 * bouton de fermeture, en frères — un bouton ne peut pas vivre à l'intérieur d'un onglet.
 */
function SortableTab({ tabKey, label, active, tabIndex, onActivate, onClose, onDetachClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tabKey });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      role="presentation"
      data-smx-tab=""
      className={`smx-tab${active ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: DndCSS.Translate.toString(transform), transition }}
    >
      <div
        role="tab"
        id={tabDomId(tabKey)}
        data-key={tabKey}
        aria-selected={active}
        aria-controls={active ? panelDomId(tabKey) : undefined}
        aria-roledescription="onglet déplaçable"
        aria-describedby={attributes['aria-describedby']}
        tabIndex={tabIndex}
        title={`${label.title}${label.sub ? `\n${label.sub}` : ''}`}
        className="smx-tab-main"
        onClick={() => onActivate(tabKey)}
        onMouseDown={(e) => {
          if (e.button === 1) e.preventDefault(); // pas de défilement automatique au milieu-clic
        }}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            onClose(tabKey);
          }
        }}
        onDoubleClick={() => onDetachClick(tabKey)}
      >
        <Mail size={14} aria-hidden style={{ flexShrink: 0, opacity: 0.7 }} />
        <span className="smx-tab-body">
          <span className="smx-tab-title">{label.title}</span>
          <span className="smx-tab-sub">{label.sub}</span>
        </span>
      </div>
      {/* Un tablist ne peut contenir que des onglets : ce bouton ne sert qu'à la souris et est
          masqué aux technologies d'assistance, qui ferment l'onglet au clavier (Suppr, cf. onKeyDown). */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="smx-tab-close"
        title="Fermer l'onglet (Suppr)"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClose(tabKey);
        }}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

/**
 * @param tabs Clés des e-mails ouverts, dans l'ordre des onglets (à droite de la liste).
 * @param activeKey Clé de l'onglet actif ; `null` = la liste.
 * @param emailByKey Index des e-mails connus (pour les libellés).
 * @param floating Fenêtres flottantes (`{ key, … }`).
 * @param listLabel Libellé de l'onglet de la liste : `{ title, sub }`.
 * @param onActivate Reçoit la clé de l'onglet à activer, ou `null` pour la liste.
 */
export default function EmailTabs({
  tabs, activeKey, emailByKey, floating, listLabel,
  onActivate, onClose, onCloseOthers, onCloseAll, onReorder, onDetach, onDockFloating, onFocusFloating,
}) {
  const themeClass = useThemeClass();
  const scrollRef = useRef(null);
  const stripRef = useRef(null);
  const refocusRef = useRef(false);
  const size = useElementSize(scrollRef);
  // Les chevrons de défilement existent dès qu'il y a débordement (désactivés en butée) : leur place est
  // ainsi réservée d'avance et ne fait pas bouger la zone après un défilement automatique.
  const [overflow, setOverflow] = useState({ overflowing: false, atStart: true, atEnd: true });
  const [dragKey, setDragKey] = useState(null);
  const [intent, setIntent] = useState(false);
  const pointerRef = useRef(null);
  const endModeRef = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeId = activeKey ?? LIST_KEY;
  const order = [LIST_KEY, ...tabs];
  const activateId = (id) => onActivate(id === LIST_KEY ? null : id);

  const measureOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 2;
    const atStart = el.scrollLeft <= 2;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setOverflow((o) => (o.overflowing === overflowing && o.atStart === atStart && o.atEnd === atEnd ? o : { overflowing, atStart, atEnd }));
  }, []);
  useLayoutEffect(() => {
    measureOverflow();
  }, [measureOverflow, size.w, tabs.length]);

  // L'onglet actif doit toujours être visible, même quand beaucoup d'onglets sont ouverts. Le
  // défilement est calculé ici (et non par scrollIntoView, qui remonterait dans tous les
  // conteneurs) et appliqué sans animation ; on le rejoue une image plus tard, une fois la
  // largeur de la zone stabilisée (apparition des chevrons).
  useEffect(() => {
    if (!activeKey) return undefined; // la liste est épinglée : toujours visible
    const reveal = () => {
      const sc = scrollRef.current;
      const el = sc?.querySelector(`[data-key="${CSS.escape(activeKey)}"]`)?.closest('[data-smx-tab]');
      if (!sc || !el) return;
      // L'onglet de la liste, collé à gauche, recouvre le début de la zone défilante.
      const pinned = sc.querySelector('[data-smx-list-tab]')?.getBoundingClientRect().width ?? 0;
      const r = el.getBoundingClientRect();
      const b = sc.getBoundingClientRect();
      const left = b.left + pinned;
      if (r.left < left) sc.scrollTo({ left: sc.scrollLeft - (left - r.left) - 8, behavior: 'instant' });
      else if (r.right > b.right) sc.scrollTo({ left: sc.scrollLeft + (r.right - b.right) + 8, behavior: 'instant' });
    };
    reveal();
    const raf = requestAnimationFrame(reveal);
    return () => cancelAnimationFrame(raf);
  }, [activeKey, tabs.length, overflow.overflowing]);

  // Après une fermeture au clavier, le focus suit l'onglet devenu actif (jamais perdu dans le vide).
  useEffect(() => {
    if (!refocusRef.current) return;
    refocusRef.current = false;
    const target = scrollRef.current?.querySelector(`[data-key="${CSS.escape(activeId)}"]`);
    (target || stripRef.current)?.focus({ preventScroll: true });
  }, [tabs, activeId]);

  const labelFor = (key) => labelOf(emailByKey.get(key), key);

  const focusTab = (key) => scrollRef.current?.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();

  const detachFromTab = (key) => {
    const el = scrollRef.current?.querySelector(`[data-key="${CSS.escape(key)}"]`);
    const r = el?.closest('[data-smx-tab]')?.getBoundingClientRect();
    onDetach(key, r ? { x: r.left, y: r.bottom + 12 } : undefined);
  };

  const onKeyDown = (e) => {
    const key = e.target.closest?.('[role="tab"]')?.dataset.key;
    if (!key) return;
    const isList = key === LIST_KEY;
    const i = order.indexOf(key);
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      // La liste reste le premier onglet : ni elle ne bouge, ni un e-mail ne passe devant elle.
      const over = isList ? undefined : tabs[tabs.indexOf(key) + (e.key === 'ArrowLeft' ? -1 : 1)];
      if (over) {
        onReorder(key, over);
        requestAnimationFrame(() => focusTab(key));
      }
      return;
    }
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isList) detachFromTab(key);
      return;
    }
    const go = (idx) => {
      const k = order[(idx + order.length) % order.length];
      e.preventDefault();
      activateId(k);
      focusTab(k);
    };
    if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(order.length - 1);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !isList) {
      e.preventDefault();
      refocusRef.current = true;
      onClose(key);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateId(key);
    }
  };

  const pointerOf = (event) => {
    const a = event.activatorEvent;
    if (!a || typeof a.clientX !== 'number') return null;
    return { x: a.clientX + event.delta.x, y: a.clientY + event.delta.y };
  };
  const isOutside = (p) => {
    const r = stripRef.current?.getBoundingClientRect();
    if (!p || !r) return false;
    return p.y < r.top - DETACH_Y || p.y > r.bottom + DETACH_Y || p.x < r.left - DETACH_X || p.x > r.right + DETACH_X;
  };

  const onDragStart = (event) => {
    setDragKey(event.active.id);
    endModeRef.current = beginDragMode('grabbing');
  };
  const endDrag = () => {
    setDragKey(null);
    setIntent(false);
    pointerRef.current = null;
    endModeRef.current?.();
    endModeRef.current = null;
  };
  const onDragMove = (event) => {
    const p = pointerOf(event);
    pointerRef.current = p;
    const out = isOutside(p);
    setIntent((prev) => (prev === out ? prev : out));
  };
  const onDragEnd = (event) => {
    const p = pointerOf(event) || pointerRef.current;
    const key = event.active.id;
    const detach = isOutside(p);
    endDrag();
    if (detach && p) {
      onDetach(key, { x: p.x - 150, y: p.y - 18 });
      return;
    }
    if (event.over && event.over.id !== key) onReorder(key, event.over.id);
  };

  const label = (id) => labelFor(id).title;
  const announcements = {
    onDragStart: ({ active }) => `Onglet « ${label(active.id)} » saisi.`,
    onDragOver: ({ active, over }) => (over ? `« ${label(active.id)} » au-dessus de « ${label(over.id)} ».` : undefined),
    onDragEnd: ({ active }) => `Onglet « ${label(active.id)} » déposé.`,
    onDragCancel: ({ active }) => `Déplacement de « ${label(active.id)} » annulé.`,
  };

  const scrollBy = (dx) => scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  const dragLabel = dragKey ? labelFor(dragKey) : null;

  return (
    <div ref={stripRef} className="smx-tabstrip" data-smx-tabstrip="" tabIndex={-1} style={{ outline: 'none' }}>
      {overflow.overflowing && (
        <button type="button" className="smx-iconbtn is-sm" style={{ alignSelf: 'center' }} disabled={overflow.atStart} aria-label="Faire défiler les onglets vers la gauche" onClick={() => scrollBy(-240)}>
          <ChevronLeft size={16} aria-hidden />
        </button>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={endDrag}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Suppr ferme l'onglet. Alt + flèche gauche ou droite le réordonne. Alt + flèche haut le détache dans une fenêtre flottante.",
          },
        }}
      >
        <div ref={scrollRef} className="smx-tabs-scroll" role="tablist" aria-label="Onglets : liste et e-mails ouverts" onKeyDown={onKeyDown} onScroll={measureOverflow}>
          <ListTab label={listLabel} active={activeKey === null} tabIndex={activeKey === null ? 0 : -1} onActivate={() => onActivate(null)} />
          <SortableContext items={tabs} strategy={horizontalListSortingStrategy}>
            {tabs.map((key) => (
              <SortableTab
                key={key}
                tabKey={key}
                label={labelFor(key)}
                active={key === activeKey}
                tabIndex={key === activeKey ? 0 : -1}
                onActivate={onActivate}
                onClose={onClose}
                onDetachClick={detachFromTab}
              />
            ))}
          </SortableContext>
        </div>
        {createPortal(
          <DragOverlay zIndex={3000} dropAnimation={null}>
            {dragLabel ? (
              <div className={`smx-ghost ${themeClass}${intent ? ' is-detach' : ''}`}>
                <Mail size={14} aria-hidden style={{ flexShrink: 0 }} />
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span className="smx-tab-title">{dragLabel.title}</span>
                  <span className={intent ? 'smx-ghost-hint' : 'smx-tab-sub'}>
                    {intent ? 'Relâcher pour détacher en fenêtre' : dragLabel.sub}
                  </span>
                </span>
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
      {overflow.overflowing && (
        <button type="button" className="smx-iconbtn is-sm" style={{ alignSelf: 'center' }} disabled={overflow.atEnd} aria-label="Faire défiler les onglets vers la droite" onClick={() => scrollBy(240)}>
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
      <div className="smx-tabs-end">
        {floating.length > 0 && (
          <MenuButton
            align="right"
            renderButton={({ props, toggle }) => (
              <button type="button" className="smx-iconbtn is-sm" onClick={toggle} aria-label={`Fenêtres flottantes (${floating.length})`} title={`Fenêtres flottantes (${floating.length})`} {...props}>
                <AppWindow size={16} aria-hidden />
                <span className="smx-badge">{floating.length}</span>
              </button>
            )}
          >
            <div className="smx-menu-title">Fenêtres flottantes</div>
            {floating.map((f) => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center' }}>
                <button type="button" role="menuitem" className="smx-menu-item" onClick={() => onFocusFloating(f.key)} title="Ramener au premier plan">
                  <span className="smx-menu-label">{labelFor(f.key).title}</span>
                </button>
                <button type="button" role="menuitem" className="smx-iconbtn is-sm" style={{ marginRight: 6 }} onClick={() => onDockFloating(f.key)} aria-label={`Réintégrer « ${labelFor(f.key).title} » dans les onglets`} title="Réintégrer dans les onglets">
                  <PictureInPicture size={15} aria-hidden />
                </button>
              </div>
            ))}
            <div className="smx-menu-sep" />
            <button type="button" role="menuitem" className="smx-menu-item" onClick={() => floating.forEach((f) => onDockFloating(f.key))}>
              <span className="smx-menu-label">Tout réintégrer dans les onglets</span>
            </button>
          </MenuButton>
        )}
        {tabs.length > 0 && (
          <MenuButton
            align="right"
            renderButton={({ props, toggle }) => (
              <button type="button" className="smx-iconbtn is-sm" onClick={toggle} aria-label="Liste des onglets ouverts" title="Liste des onglets ouverts" {...props}>
                <ChevronDown size={16} aria-hidden />
              </button>
            )}
          >
            <div className="smx-menu-title">Onglets ouverts ({tabs.length})</div>
            <button type="button" role="menuitem" className={`smx-menu-item${activeKey === null ? ' is-current' : ''}`} onClick={() => onActivate(null)}>
              <span className="smx-menu-label">Liste · {listLabel.title}</span>
            </button>
            {tabs.map((k) => (
              <button key={k} type="button" role="menuitem" className={`smx-menu-item${k === activeKey ? ' is-current' : ''}`} onClick={() => onActivate(k)}>
                <span className="smx-menu-label">{labelFor(k).title}</span>
              </button>
            ))}
            <div className="smx-menu-sep" />
            {tabs.length > 1 && activeKey && (
              <button type="button" role="menuitem" className="smx-menu-item" onClick={() => onCloseOthers(activeKey)}>
                <span className="smx-menu-label">Fermer les autres onglets d'e-mail</span>
              </button>
            )}
            <button type="button" role="menuitem" className="smx-menu-item" onClick={onCloseAll}>
              <span className="smx-menu-label">Fermer tous les onglets d'e-mail</span>
            </button>
          </MenuButton>
        )}
      </div>
    </div>
  );
}
