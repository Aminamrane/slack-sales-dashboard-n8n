// src/components/sequenceMail/SequenceEmailManager.jsx
//
// Mini client e-mail intégré à la fenêtre « Gestion de séquence » de /ceo/Sub-Tickets.
//
//   barre du haut  : recherche plein texte, actualisation, densité
//   navigation     : cohortes (comme les libellés d'un client mail) et séquences
//   onglets        : comme dans un navigateur, en haut de la zone principale — le premier onglet est la
//                    liste, chaque e-mail ouvert a le sien (réordonnable, détachable)
//   liste          : les e-mails de la cohorte, groupés et repliables, virtualisés (premier onglet ;
//                    elle reste montée quand un e-mail est ouvert : défilement et focus conservés)
//   lecteur        : l'e-mail (corps réel) + informations de séquence, sur toute la zone de l'onglet
//   fenêtres       : les e-mails détachés, flottants, indépendants (portail sous <body>)
//
// Direction artistique : celle d'un client Gmail (cf. styles.js), volontairement distincte du
// reste du site. Données réelles uniquement (cf. dataStore.js). État : store de module,
// persistant pendant la session (cf. store.js).

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AlignJustify, Check, ChevronsDownUp, ChevronsUpDown, Menu, Mail, RefreshCw, Rows3, Search, X,
} from 'lucide-react';
import { SMX_CSS } from './styles';
import { actions, useSeqStore } from './store';
import { audienceTone, parseKey } from './model';
import { buildListModel } from './listModel';
import { useElementSize, useEmailDetail, useSequenceMail } from './hooks';
import { ensureContent } from './dataStore';
import { fmtInt, fmtWhenLong } from './format';
import { Chip, MenuButton } from './ui';
import { ThemeContext } from './themeContext';
import Splitter from './Splitter';
import CohortNav from './CohortNav';
import EmailList from './EmailList';
import EmailTabs from './EmailTabs';
import { LIST_PANEL_ID, LIST_TAB_ID, panelDomId, tabDomId } from './domIds';
import EmailViewer from './EmailViewer';
import FloatingLayer from './FloatingEmailWindow';

const NAV_MIN = 160;
const NAV_MAX = 360;
const NAV_RAIL = 56;
/** @brief En dessous de cette largeur, le volet de navigation se réduit à une colonne d'icônes. */
const AUTO_COLLAPSE_W = 640;

/** @brief Contenu d'un onglet : charge le détail de l'e-mail actif et le montre dans le lecteur. */
function TabViewer({ emailKey: key, apiStatus }) {
  const detail = useEmailDetail(key);
  return (
    <EmailViewer
      detail={detail}
      context="tab"
      tabId={tabDomId(key)}
      panelId={panelDomId(key)}
      apiStatus={apiStatus}
      onDetach={() => {
        // La barre d'onglets est en haut de la fenêtre : la fenêtre flottante s'ouvre juste dessous, sans la recouvrir.
        const r = document.getElementById(tabDomId(key))?.closest('[data-smx-tab]')?.getBoundingClientRect();
        actions.detachTab(key, r ? { x: r.left, y: r.bottom + 12 } : undefined);
      }}
      onNavigate={(toKey) => actions.replaceEmail(key, toKey)}
      onClose={() => actions.closeTab(key)}
      onRetry={() => void ensureContent(parseKey(key).cohortId, true)}
    />
  );
}

function SequenceEmailManager({ darkMode = false, onOpenSchema, schemaOpen = false }) {
  const themeName = darkMode ? 'dark' : 'light';
  const rootRef = useRef(null);
  const bodyRef = useRef(null);
  const listPanelRef = useRef(null);
  const searchRef = useRef(null);
  const selectAllRef = useRef(null);

  const cohortId = useSeqStore((s) => s.cohortId);
  const sequence = useSeqStore((s) => s.sequence);
  const search = useSeqStore((s) => s.search);
  const density = useSeqStore((s) => s.density);
  const layout = useSeqStore((s) => s.layout);
  const collapsed = useSeqStore((s) => s.collapsed);
  const tabs = useSeqStore((s) => s.tabs);
  const activeKey = useSeqStore((s) => s.activeKey);
  const selectedKey = useSeqStore((s) => s.selectedKey);
  const floating = useSeqStore((s) => s.floating);
  const checkedList = useSeqStore((s) => s.checked);
  const announce = useSeqStore((s) => s.announce);

  const openKeys = useMemo(() => [...tabs, ...floating.map((f) => f.key)], [tabs, floating]);
  const openSet = useMemo(() => new Set(openKeys), [openKeys]);
  const checked = useMemo(() => new Set(checkedList), [checkedList]);

  const { cohorts, api, emails, emailByKey, loadingContent, contentError, refreshing, refresh } = useSequenceMail({ cohortId, openKeys });

  // Une cohorte sélectionnée qui n'existe plus (liste du CRM modifiée) : retour à la vue d'ensemble.
  useEffect(() => {
    if (cohortId !== 'all' && cohorts.length > 0 && !cohorts.some((c) => c.id === cohortId)) actions.selectCohort('all');
  }, [cohortId, cohorts]);

  const model = useMemo(
    () => buildListModel({ emails, cohorts, cohortId, sequence, search, collapsed }),
    [emails, cohorts, cohortId, sequence, search, collapsed]
  );
  const cohort = cohortId === 'all' ? null : cohorts.find((c) => c.id === cohortId) ?? null;

  const seqCounts = useMemo(() => {
    const c = { any: emails.length, pre: 0, post: 0, oneshot: 0 };
    for (const e of emails) c[e.sequence] = (c[e.sequence] || 0) + 1;
    return c;
  }, [emails]);
  const totalCount = useMemo(() => cohorts.reduce((n, c) => n + (c.stepCount || 0), 0), [cohorts]);
  const emptyCounts = useMemo(() => new Map(), []);

  // ── Volets redimensionnables ──────────────────────────────────────────────
  const rootSize = useElementSize(rootRef);
  const navCollapsed = layout.navCollapsed || (rootSize.w > 0 && rootSize.w < AUTO_COLLAPSE_W);
  const navPx = navCollapsed ? NAV_RAIL : layout.navW;
  // Onglet actif : `null` = la liste (premier onglet), sinon la clé de l'e-mail affiché sur toute la zone.
  const listActive = activeKey === null;

  // Ouvrir un e-mail depuis la liste la masque (comme un lien qui s'ouvre dans un nouvel onglet) : le
  // focus, qui était sur sa ligne, passe au lecteur au lieu de se perdre — le clavier y défile aussitôt.
  useEffect(() => {
    if (activeKey === null) return;
    const focused = document.activeElement;
    if (!focused || focused === document.body || listPanelRef.current?.contains(focused)) {
      document.getElementById(panelDomId(activeKey))?.focus({ preventScroll: true });
    }
  }, [activeKey]);

  // ── Sélection ─────────────────────────────────────────────────────────────
  const filteredKeys = useMemo(() => model.filtered.map((e) => e.key), [model.filtered]);
  const checkedInView = filteredKeys.filter((k) => checked.has(k));
  const allChecked = filteredKeys.length > 0 && checkedInView.length === filteredKeys.length;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = checkedInView.length > 0 && !allChecked;
  }, [checkedInView.length, allChecked]);

  const handleOpen = useCallback((key, mods = {}) => {
    if (mods.floating) actions.openFloating(key);
    else actions.openEmail(key, { background: Boolean(mods.background) });
  }, []);
  const handleOpenFloating = useCallback((key) => actions.openFloating(key), []);
  const handleCheck = useCallback((key) => actions.toggleChecked(key), []);
  const openChecked = (asWindows) => {
    const keys = filteredKeys.filter((k) => checked.has(k));
    if (asWindows) keys.forEach((k) => actions.openFloating(k));
    else {
      // Tous les onglets s'ouvrent dans l'ordre de la liste, puis le premier passe au premier plan.
      keys.forEach((k) => actions.openEmail(k, { background: true }));
      if (keys.length > 0) actions.activate(keys[0]);
    }
    actions.setChecked([]);
  };

  // Cohorte, séquence et recherche règlent ce que montre la liste : les changer depuis un onglet d'e-mail
  // ramène sur la liste, sinon ils sembleraient sans effet.
  const selectCohort = useCallback((id) => {
    actions.selectCohort(id);
    actions.activate(null);
  }, []);
  const selectSequence = useCallback((id) => {
    actions.selectSequence(id);
    actions.activate(null);
  }, []);
  const changeSearch = useCallback((value) => {
    actions.setSearch(value);
    actions.activate(null);
  }, []);

  const allCollapsed = model.groupIds.length > 0 && model.groupIds.every((id) => collapsed[id]);

  // ── Raccourcis : « / » place le curseur dans la recherche ─────────────────
  const onRootKeyDown = (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      e.preventDefault();
      searchRef.current?.focus();
    }
  };

  const listInfo =
    model.filtered.length === emails.length
      ? `${fmtInt(emails.length)} e-mail${emails.length > 1 ? 's' : ''}`
      : `${fmtInt(model.filtered.length)} sur ${fmtInt(emails.length)}`;
  const cohortLive = cohort?.liveAt ? fmtWhenLong(cohort.liveAt) : null;
  // Titre de l'onglet de la liste : la cohorte comme dans le volet de navigation (« 21 sept. · TPE/PME »).
  const listLabel = {
    title: cohort ? [cohort.short, cohort.audience].filter(Boolean).join(' · ') : 'Toutes les cohortes',
    sub: loadingContent ? 'Chargement…' : listInfo,
  };

  return (
    <ThemeContext.Provider value={themeName}>
      <style>{SMX_CSS}</style>
      <div
        ref={rootRef}
        className={`smx-root smx-theme-${themeName}${density === 'compact' ? ' is-compact' : ''}`}
        role="region"
        aria-label="Gestion de séquence : cohortes et e-mails"
        onKeyDown={onRootKeyDown}
      >
        <div className="smx-sr" role="status" aria-live="polite">{announce}</div>

        {/* ── Barre du haut ── */}
        <div className="smx-top" role="group" aria-label="Recherche et actions">
          <button
            type="button"
            className="smx-iconbtn"
            aria-label={navCollapsed ? 'Développer le volet de navigation' : 'Réduire le volet de navigation'}
            aria-expanded={!navCollapsed}
            title={navCollapsed ? 'Développer le volet de navigation' : 'Réduire le volet de navigation'}
            disabled={rootSize.w > 0 && rootSize.w < AUTO_COLLAPSE_W}
            onClick={() => actions.setLayout({ navCollapsed: !layout.navCollapsed })}
          >
            <Menu size={20} aria-hidden />
          </button>
          <div className="smx-brand">
            <span className="smx-brand-mark"><Mail size={17} aria-hidden /></span>
            <span className="smx-brand-name">Séquences</span>
          </div>
          <div className="smx-search" role="search">
            <span className="smx-iconbtn" style={{ pointerEvents: 'none' }}><Search size={18} aria-hidden /></span>
            <input
              ref={searchRef}
              type="text"
              value={search}
              placeholder="Rechercher dans les e-mails (objet, contenu, cohorte…)"
              aria-label="Rechercher dans les e-mails"
              aria-keyshortcuts="/"
              onChange={(e) => changeSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && search) {
                  e.stopPropagation();
                  changeSearch('');
                }
              }}
            />
            {search && (
              <button type="button" className="smx-iconbtn is-sm" aria-label="Effacer la recherche" title="Effacer la recherche" onClick={() => { changeSearch(''); searchRef.current?.focus(); }}>
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
          <div className="smx-top-actions">
            <button type="button" className="smx-iconbtn" aria-label="Actualiser" title="Actualiser les cohortes et les compteurs du CRM" onClick={() => void refresh()}>
              <RefreshCw size={18} aria-hidden className={refreshing ? 'smx-spin' : undefined} />
            </button>
            <MenuButton
              align="right"
              renderButton={({ props, toggle }) => (
                <button type="button" className="smx-iconbtn" onClick={toggle} aria-label="Densité d'affichage" title="Densité d'affichage" {...props}>
                  {density === 'compact' ? <AlignJustify size={18} aria-hidden /> : <Rows3 size={18} aria-hidden />}
                </button>
              )}
            >
              <div className="smx-menu-title">Densité</div>
              {[['comfortable', 'Confortable'], ['compact', 'Compacte']].map(([value, label]) => (
                <button key={value} type="button" role="menuitem" className={`smx-menu-item${density === value ? ' is-current' : ''}`} onClick={() => actions.setDensity(value)}>
                  <span className="smx-menu-label">{label}</span>
                  {density === value && <Check size={15} aria-hidden />}
                </button>
              ))}
            </MenuButton>
          </div>
        </div>

        {api.status === 'error' && (
          <div className="smx-banner" role="status">
            <span>Les cohortes du CRM sont indisponibles ({api.error}) : seul le contenu local est affiché, sans compteurs d'envoi.</span>
            <button type="button" onClick={() => void refresh()}>Réessayer</button>
          </div>
        )}
        {contentError && (
          <div className="smx-banner is-danger" role="alert">
            <span>Contenu indisponible : {contentError}</span>
            <button type="button" onClick={() => void refresh()}>Réessayer</button>
          </div>
        )}

        {/* ── Corps : navigation + panneau principal ── */}
        <div ref={bodyRef} className="smx-body" style={{ '--smx-nav-w': `${navPx}px` }}>
          <CohortNav
            cohorts={cohorts}
            cohortId={cohortId}
            sequence={sequence}
            totalCount={totalCount}
            countsByCohort={emptyCounts}
            seqCounts={seqCounts}
            collapsed={navCollapsed}
            apiStatus={api.status}
            onSelectCohort={selectCohort}
            onSelectSequence={selectSequence}
            onOpenSchema={onOpenSchema}
            schemaOpen={schemaOpen}
          />
          {!navCollapsed && (
            <Splitter
              orientation="v"
              targetRef={bodyRef}
              cssVar="--smx-nav-w"
              value={navPx}
              min={NAV_MIN}
              max={NAV_MAX}
              label="Largeur du volet de navigation"
              onCommit={(px) => actions.setLayout({ navW: px })}
              onReset={() => actions.resetLayout()}
            />
          )}

          <div className="smx-main">
            {/* Barre d'onglets en haut de la zone principale, comme dans un navigateur. */}
            <EmailTabs
              tabs={tabs}
              activeKey={activeKey}
              emailByKey={emailByKey}
              floating={floating}
              listLabel={listLabel}
              onActivate={actions.activate}
              onClose={actions.closeTab}
              onCloseOthers={actions.closeOtherTabs}
              onCloseAll={actions.closeAllTabs}
              onReorder={actions.reorderTabs}
              onDetach={actions.detachTab}
              onDockFloating={actions.dockFloating}
              onFocusFloating={actions.focusFloating}
            />

            <div className="smx-stage">
              {/* Premier onglet : la liste. Masquée (pas démontée) quand un e-mail est actif. */}
              <div
                ref={listPanelRef}
                id={LIST_PANEL_ID}
                role="tabpanel"
                aria-labelledby={LIST_TAB_ID}
                className={`smx-listarea${listActive ? '' : ' is-hidden'}`}
              >
                <div className="smx-toolbar" role="toolbar" aria-label="Actions sur la liste">
                  <span className="smx-row-check">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allChecked}
                      disabled={filteredKeys.length === 0}
                      aria-label="Sélectionner tous les e-mails affichés"
                      onChange={() => actions.setChecked(allChecked ? [] : filteredKeys)}
                    />
                  </span>
                  <button
                    type="button"
                    className="smx-iconbtn"
                    disabled={model.groupIds.length === 0 || model.searching}
                    aria-label={allCollapsed ? 'Tout déplier' : 'Tout replier'}
                    title={model.searching ? 'Les groupes sont dépliés pendant une recherche' : allCollapsed ? 'Tout déplier' : 'Tout replier'}
                    onClick={() => actions.setAllGroups(model.groupIds, !allCollapsed)}
                  >
                    {allCollapsed ? <ChevronsUpDown size={18} aria-hidden /> : <ChevronsDownUp size={18} aria-hidden />}
                  </button>
                  {checkedInView.length > 0 ? (
                    <>
                      <span className="smx-toolbar-sep" />
                      <span className="smx-toolbar-title">{checkedInView.length} sélectionné{checkedInView.length > 1 ? 's' : ''}</span>
                      <button type="button" className="smx-btn" onClick={() => openChecked(false)}>Ouvrir dans des onglets</button>
                      <button type="button" className="smx-btn" onClick={() => openChecked(true)} style={{ marginLeft: 6 }}>Ouvrir en fenêtres</button>
                      <button type="button" className="smx-btn" onClick={() => actions.setChecked([])} style={{ marginLeft: 6 }}>Désélectionner</button>
                    </>
                  ) : (
                    <span className="smx-toolbar-title">{cohort ? cohort.label : 'Toutes les cohortes'}</span>
                  )}
                  <span className="smx-toolbar-info" aria-live="polite">{loadingContent ? 'Chargement…' : listInfo}</span>
                </div>
                {cohort && (
                  <div className="smx-cohortbar">
                    {cohort.audience && <Chip tone={audienceTone(cohort.audience)}>{cohort.audience}</Chip>}
                    {cohortLive && <span className="smx-cb-item">Live : <strong>{cohortLive}</strong></span>}
                    {cohort.speakers?.length > 0 && <span className="smx-cb-item">Intervenants : <strong>{cohort.speakers.join(', ')}</strong></span>}
                    {!cohort.inApi && api.status === 'ready' && <span className="smx-cb-item">Cohorte absente du CRM : pas de compteurs d'envoi</span>}
                  </div>
                )}
                <div className="smx-listbody">
                  <EmailList
                    model={model}
                    openKeys={openSet}
                    currentKey={selectedKey}
                    visible={listActive}
                    checked={checked}
                    loading={loadingContent}
                    error={contentError}
                    search={search}
                    hasCohorts={cohorts.length > 0}
                    onOpen={handleOpen}
                    onOpenFloating={handleOpenFloating}
                    onToggleGroup={actions.toggleGroup}
                    onCheck={handleCheck}
                    onClearSearch={() => actions.setSearch('')}
                    onRetry={() => void refresh()}
                  />
                </div>
              </div>

              {/* Onglet d'un e-mail : le lecteur occupe toute la zone. */}
              {!listActive && <TabViewer key={activeKey} emailKey={activeKey} apiStatus={api.status} />}
            </div>
          </div>
        </div>
      </div>
      <FloatingLayer apiStatus={api.status} />
    </ThemeContext.Provider>
  );
}

export default memo(SequenceEmailManager);
