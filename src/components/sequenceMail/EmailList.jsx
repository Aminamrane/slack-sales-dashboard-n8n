// src/components/sequenceMail/EmailList.jsx
//
// Liste des e-mails, façon boîte de réception : lignes compactes, groupes repliables,
// survol Gmail, cases à cocher, navigation clavier (↑/↓, Début/Fin, Entrée, x). La liste est
// virtualisée : seules les lignes visibles existent dans le DOM, quel que soit le volume.

import { forwardRef, memo, useCallback, useEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { ChevronDown, ExternalLink, SearchX, TriangleAlert, Inbox } from 'lucide-react';
import { fmtDayMonth, fmtInt, fmtRatio, fmtWhenShort, fmtWhenLong } from './format';
import { useLatest } from './hooks';
import { PHASES, SEGMENTS, shortRelative } from './model';
import { Chip, Highlight } from './ui';

const CHIP_TONE = { blue: 'blue', purple: 'purple', amber: 'amber', red: 'red', green: 'green', grey: 'grey' };

/** @brief Résumé d'engagement d'une ligne, uniquement si les compteurs réels existent. */
function statOf(email) {
  const s = email.stats;
  if (!s || !(s.sent > 0)) return '';
  const base = s.delivered > 0 ? s.delivered : s.sent;
  return typeof s.opened === 'number' ? `${fmtInt(s.sent)} · ${fmtRatio(s.opened, base)} ouv.` : `${fmtInt(s.sent)} env.`;
}

const EmailRow = memo(function EmailRow({
  index, email, tokens, isOpen, isActive, isChecked, isFocus, onOpen, onOpenFloating, onCheck, onFocusRow,
}) {
  const t = email.timing;
  const when = t?.mode === 'calendar' ? fmtWhenShort(t.at) : shortRelative(t);
  const phase = PHASES[email.phase];
  const segment = email.segment ? SEGMENTS[email.segment] : null;
  const title = email.subject || (email.hasContent ? '(sans objet)' : email.kind);
  const stat = statOf(email);
  const fullWhen = t?.mode === 'calendar' ? fmtWhenLong(t.at) : t?.label || '';
  const cls = ['smx-row', isOpen && 'is-open', isActive && 'is-active', isChecked && 'is-checked', isFocus && 'is-focus'].filter(Boolean).join(' ');
  return (
    <div
      role="row"
      aria-level={2}
      aria-selected={isChecked}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`${title}. ${phase?.label ?? ''}${segment ? `, ${segment}` : ''}. ${email.status.label}. ${when}`}
      data-row-index={index}
      data-email-key={email.key}
      tabIndex={isFocus ? 0 : -1}
      className={cls}
      title={`${title}${fullWhen ? `\n${fullWhen}` : ''}\n${email.status.label}`}
      onFocus={() => onFocusRow(index)}
      onClick={(e) => onOpen(email.key, { background: e.ctrlKey || e.metaKey, floating: e.shiftKey })}
    >
      <span role="gridcell" className="smx-row-check" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" tabIndex={-1} checked={isChecked} onChange={() => onCheck(email.key)} aria-label={`Sélectionner l'e-mail : ${title}`} />
      </span>
      <span className="smx-row-n" aria-hidden>{String(email.order).padStart(2, '0')}</span>
      <span className={`smx-dot is-${email.status.key}`} aria-hidden />
      <span role="gridcell" className="smx-row-main">
        <span className="smx-row-tags">
          {phase && <Chip tone={CHIP_TONE[phase.tone]}>{phase.label}</Chip>}
          {segment && <Chip className="is-seg">{segment}</Chip>}
        </span>
        <span className={`smx-row-subject${email.subject ? '' : ' is-empty'}`}>
          <Highlight text={title} tokens={tokens} />
        </span>
        {email.snippet && <span className="smx-row-snippet">— {email.snippet}</span>}
      </span>
      <span role="gridcell" className="smx-row-side">
        {stat && <span className="smx-row-stat" title="Envoyés · taux d'ouverture (compteurs du CRM)">{stat}</span>}
        <span className="smx-row-time">{when}</span>
        <span className="smx-row-actions">
          <button
            type="button"
            tabIndex={-1}
            className="smx-iconbtn is-sm"
            aria-label={`Ouvrir « ${title} » dans une fenêtre flottante`}
            title="Ouvrir dans une fenêtre flottante (Maj + clic)"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFloating(email.key);
            }}
          >
            <ExternalLink size={15} strokeWidth={1.9} aria-hidden />
          </button>
        </span>
      </span>
    </div>
  );
});

function GroupRow({ index, row, isFocus, onToggle, onFocusRow }) {
  const g = row.group;
  const cohort = g.cohort;
  const meta =
    g.kind === 'cohort'
      ? [cohort.audience, cohort.liveAt ? `live le ${fmtDayMonth(cohort.liveAt)}` : null].filter(Boolean).join(' · ')
      : '';
  return (
    <div
      role="row"
      aria-level={1}
      aria-expanded={!row.collapsed}
      aria-label={`${g.label}, ${g.emails.length} e-mail${g.emails.length > 1 ? 's' : ''}, ${row.collapsed ? 'replié' : 'déplié'}`}
      data-row-index={index}
      tabIndex={isFocus ? 0 : -1}
      className={`smx-group${row.collapsed ? ' is-collapsed' : ''}`}
      onFocus={() => onFocusRow(index)}
      onClick={() => onToggle(g.id)}
    >
      <span role="gridcell" className="smx-group-cell">
        <span className="smx-group-chev"><ChevronDown size={16} aria-hidden /></span>
        <span>{g.label}</span>
        <span className="smx-group-count">{fmtInt(g.emails.length)}</span>
        {meta && <span className="smx-group-meta">{meta}</span>}
      </span>
    </div>
  );
}

/**
 * @brief Liste de Virtuoso rendue comme une grille arborescente ARIA (`treegrid`) : ses enfants directs
 * sont les lignes ; les en-têtes de groupe (niveau 1, `aria-expanded`) contiennent les e-mails (niveau 2).
 */
const GridList = forwardRef(function GridList({ children, context, ...props }, ref) {
  return (
    <div ref={ref} {...props} role="treegrid" aria-label="E-mails" aria-multiselectable="true" aria-rowcount={context?.count}>
      {children}
    </div>
  );
});
const VIRTUOSO_COMPONENTS = { List: GridList };

function Skeleton() {
  return (
    <div aria-hidden style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="smx-skel" style={{ width: 16, height: 16 }} />
          <div className="smx-skel" style={{ width: `${44 + ((i * 17) % 34)}%` }} />
          <div className="smx-skel" style={{ width: 70, marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  );
}

/**
 * @param model Résultat de buildListModel.
 * @param openKeys Ensemble des e-mails ouverts (onglet ou fenêtre).
 * @param currentKey Dernier e-mail consulté : sa ligne est repérée et ramenée dans le champ au retour sur la liste.
 * @param visible La liste est l'onglet actif. Elle reste montée quand un e-mail est ouvert (défilement et focus conservés).
 * @param checked Ensemble des e-mails cochés.
 */
export default function EmailList({
  model, openKeys, currentKey, visible, checked, loading, error, search, hasCohorts,
  onOpen, onOpenFloating, onToggleGroup, onCheck, onClearSearch, onRetry,
}) {
  const virtuosoRef = useRef(null);
  const scrollerRef = useRef(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const { rows, tokens } = model;
  const last = rows.length - 1;
  const focus = Math.min(focusIndex, Math.max(0, last));

  // Au retour sur la liste, ou quand le dernier e-mail consulté change (précédent/suivant dans un
  // onglet), la ligne de cet e-mail doit être visible : on ne fait défiler que si elle est hors champ.
  const rowsRef = useLatest(rows);
  useEffect(() => {
    if (!currentKey || !visible) return undefined;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const index = rowsRef.current.findIndex((r) => r.type === 'email' && r.email.key === currentKey);
        if (index < 0) return;
        // La visibilité se lit dans le DOM (une ligne hors fenêtre virtuelle n'y existe pas) : on ne
        // dépend pas de la mesure interne de la liste, qui peut être en retard sur le redimensionnement.
        const scroller = scrollerRef.current;
        const el = scroller?.querySelector(`[data-email-key="${CSS.escape(currentKey)}"]`);
        const box = scroller?.getBoundingClientRect();
        const r = el?.getBoundingClientRect();
        const inView = Boolean(r && box && r.top >= box.top - 1 && r.bottom <= box.bottom + 1);
        if (!inView) virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'auto' });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [currentKey, visible, rowsRef]);

  // Une ligne supprimée par un filtre ne doit pas laisser l'index de focus dans le vide.
  useEffect(() => {
    setFocusIndex((i) => Math.min(i, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const goTo = useCallback(
    (i) => {
      const idx = Math.max(0, Math.min(last, i));
      setFocusIndex(idx);
      virtuosoRef.current?.scrollIntoView({
        index: idx,
        behavior: 'auto',
        done: () =>
          requestAnimationFrame(() => scrollerRef.current?.querySelector(`[data-row-index="${idx}"]`)?.focus({ preventScroll: true })),
      });
    },
    [last]
  );

  const onKeyDown = (e) => {
    if (e.target.closest('input, button') && e.target.tagName !== 'DIV') return;
    const row = rows[focus];
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        goTo(focus + 1);
        break;
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        goTo(focus - 1);
        break;
      case 'Home':
        e.preventDefault();
        goTo(0);
        break;
      case 'End':
        e.preventDefault();
        goTo(last);
        break;
      case 'PageDown':
        e.preventDefault();
        goTo(focus + 8);
        break;
      case 'PageUp':
        e.preventDefault();
        goTo(focus - 8);
        break;
      case 'ArrowRight':
        if (row?.type === 'group' && row.collapsed) {
          e.preventDefault();
          onToggleGroup(row.id);
        }
        break;
      case 'ArrowLeft':
        if (row?.type === 'group' && !row.collapsed) {
          e.preventDefault();
          onToggleGroup(row.id);
        }
        break;
      case 'Enter':
      case 'o':
        if (!row) break;
        e.preventDefault();
        if (row.type === 'group') onToggleGroup(row.id);
        else if (e.shiftKey) onOpenFloating(row.email.key);
        else onOpen(row.email.key, { background: e.ctrlKey || e.metaKey });
        break;
      case ' ':
      case 'x':
        if (row?.type === 'email') {
          e.preventDefault();
          onCheck(row.email.key);
        }
        break;
      default:
    }
  };

  const itemContent = useCallback(
    (index, row) =>
      row.type === 'group' ? (
        <GroupRow index={index} row={row} isFocus={index === focus} onToggle={onToggleGroup} onFocusRow={setFocusIndex} />
      ) : (
        <EmailRow
          index={index}
          email={row.email}
          tokens={tokens}
          isOpen={openKeys.has(row.email.key)}
          isActive={row.email.key === currentKey}
          isChecked={checked.has(row.email.key)}
          isFocus={index === focus}
          onOpen={onOpen}
          onOpenFloating={onOpenFloating}
          onCheck={onCheck}
          onFocusRow={setFocusIndex}
        />
      ),
    [focus, tokens, openKeys, currentKey, checked, onOpen, onOpenFloating, onCheck, onToggleGroup]
  );

  let content;
  if (rows.length > 0) {
    content = (
      <Virtuoso
        ref={virtuosoRef}
        scrollerRef={(el) => {
          scrollerRef.current = el;
        }}
        style={{ height: '100%' }}
        data={rows}
        defaultItemHeight={44}
        computeItemKey={(_, row) => row.id}
        components={VIRTUOSO_COMPONENTS}
        context={{ count: rows.length }}
        itemContent={itemContent}
        increaseViewportBy={200}
      />
    );
  } else if (loading) {
    content = <Skeleton />;
  } else if (error) {
    content = (
      <div className="smx-state" role="alert">
        <TriangleAlert size={28} aria-hidden />
        <strong>Impossible de charger les e-mails</strong>
        <p>{error}</p>
        <button type="button" className="smx-btn" onClick={onRetry}>Réessayer</button>
      </div>
    );
  } else if (search.trim()) {
    content = (
      <div className="smx-state">
        <SearchX size={28} aria-hidden />
        <strong>Aucun e-mail ne correspond à « {search.trim()} »</strong>
        <p>La recherche porte sur l'objet, le contenu, la cohorte et la phase.</p>
        <button type="button" className="smx-btn" onClick={onClearSearch}>Effacer la recherche</button>
      </div>
    );
  } else {
    content = (
      <div className="smx-state">
        <Inbox size={28} aria-hidden />
        <strong>{hasCohorts ? 'Aucun e-mail à afficher' : 'Aucune cohorte'}</strong>
        <p>
          {hasCohorts
            ? "Cette cohorte n'a pas d'e-mail dans ce filtre, ou son contenu n'est pas disponible localement."
            : "Aucune cohorte n'est disponible : ni dans le CRM, ni dans le contenu local."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%' }} onKeyDown={onKeyDown}>
      {content}
    </div>
  );
}
