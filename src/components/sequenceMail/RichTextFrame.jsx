// src/components/sequenceMail/RichTextFrame.jsx
//
// Zone d'édition riche du corps d'un e-mail : l'e-mail réel, tel qu'il sera rendu, dans une
// iframe dont le contenu est éditable (WYSIWYG). Aucune bibliothèque d'éditeur n'existait dans le
// projet et le HTML d'un e-mail est un document complet (tableaux, styles en ligne, liens
// personnels) qu'un modèle de document d'éditeur réécrirait : on édite donc le DOM d'origine avec
// `contenteditable` et `document.execCommand` (gras, italique, listes, lien…), le seul moyen
// d'éditer sans dépendance. `execCommand` est « obsolète » sur le papier mais pris en charge par
// tous les navigateurs ; il se remplacera sans toucher au reste (cf. l'API impérative ci-dessous).
//
// Le composant ne connaît ni le store ni le brouillon : il charge `html` une fois (par e-mail), prévient
// `onChange` avec le HTML propre (cf. serializeEditorDocument) à chaque modification, et expose :
//   exec(commande, valeur)  mise en forme            setHtml(html)  remplace le contenu (rétablissement)
//   focus()                 prend la main            getHtml()      HTML propre courant
//   captureSelection()      mémorise la sélection    applyLink(url, plage)  pose / modifie un lien ; renvoie
//   currentLink()           lien sous le curseur                    `true` si le lien a été posé, `false` sinon
//   removeLink()            retire le lien sous le curseur
//
// Garde-fous : le pied de page de désinscription et le pré-en-tête caché sont verrouillés (et
// rétablis si une suppression de grande ampleur les emportait) ; le collage ET le glisser-déposer
// venus d'ailleurs sont du texte brut (pas de styles ni de HTML venu d'une autre page) ; le dépôt de
// fichiers est ignoré ; un clic sur un lien ne navigue pas.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useLatest } from './hooks';
import { caretRangeAt, lockProtectedBlocks, prepareEditorHtml, replaceDocument, serializeEditorDocument } from './editorDom';

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

const elementOf = (node) => (node ? (node.nodeType === 1 ? node : node.parentElement) : null);
const isPersonalHref = (a) => /EVENT_ID/.test(a?.getAttribute?.('href') || '');

/**
 * @brief Mise en forme sous le curseur / la sélection, pour allumer les boutons de la barre d'outils.
 * @note `hasSelection` : le corps contient un curseur ou une sélection éditable (pas dans un bloc protégé). Sans lui,
 * poser un lien ne ferait rien — l'outil « lien » est alors désactivé plutôt que d'échouer en silence.
 */
function readFormat(doc) {
  const q = (command) => {
    try {
      return doc.queryCommandState(command);
    } catch {
      return false;
    }
  };
  const selection = doc.getSelection();
  const el = elementOf(selection?.anchorNode);
  const link = el?.closest?.('a') ?? null;
  return {
    hasSelection: Boolean(selection && selection.rangeCount > 0 && el && doc.body.contains(el) && !el.closest?.('[data-smx-lock]')),
    bold: q('bold'),
    italic: q('italic'),
    underline: q('underline'),
    ul: q('insertUnorderedList'),
    ol: q('insertOrderedList'),
    link: Boolean(link),
    personalLink: link ? isPersonalHref(link) : false,
    locked: Boolean(el?.closest?.('[data-smx-lock]')),
  };
}

/**
 * @param html HTML d'origine, chargé une seule fois (changer de e-mail = remonter le composant avec une autre `key`).
 * @param title Nom accessible de la zone.
 * @param onChange Reçoit le HTML propre après chaque modification (au plus une fois par image).
 * @param onFormatChange Reçoit la mise en forme sous la sélection (`readFormat`).
 * @param onRequestLink Ctrl/⌘ + K dans le texte : demande d'ouvrir la saisie d'un lien.
 * @param onProtectedRestore Un bloc protégé emporté par une suppression a été remis en place.
 */
const RichTextFrame = forwardRef(function RichTextFrame(
  { html, title, onChange, onFormatChange, onRequestLink, onProtectedRestore },
  ref
) {
  const frameRef = useRef(null);
  const docRef = useRef(null);
  const rafRef = useRef(0);
  const disposeRef = useRef(null);
  const protectedRef = useRef([]);
  const latest = useLatest({ title, onChange, onFormatChange, onRequestLink, onProtectedRestore });
  // Donné à l'iframe une seule fois : le changer rechargerait le document et ferait perdre le curseur.
  const [initialSrcDoc] = useState(() => prepareEditorHtml(html));

  /** @brief Rend le document éditable, verrouille les blocs protégés et en garde une copie pour les rétablir. */
  const prepare = useCallback((doc) => {
    lockProtectedBlocks(doc);
    protectedRef.current = [...doc.body.querySelectorAll('[data-smx-lock]')].map((el, i) => {
      el.setAttribute('data-smx-lock-id', String(i));
      return { id: String(i), kind: el.getAttribute('data-smx-lock'), html: el.outerHTML };
    });
    const body = doc.body;
    body.contentEditable = 'true';
    body.setAttribute('role', 'textbox');
    body.setAttribute('aria-multiline', 'true');
    body.setAttribute('aria-label', `Contenu de l'e-mail : ${latest.current.title}`);
    try {
      doc.execCommand('defaultParagraphSeparator', false, 'p');
      doc.execCommand('styleWithCSS', false, false);
      doc.execCommand('enableObjectResizing', false, false);
    } catch {
      /* commande inconnue de ce navigateur : sans conséquence */
    }
  }, [latest]);

  /** @brief Remet en place un bloc protégé qu'une suppression (Ctrl + A, Suppr) aurait emporté. */
  const restoreProtected = useCallback((doc) => {
    let restored = false;
    for (const saved of protectedRef.current) {
      if (doc.body.querySelector(`[data-smx-lock-id="${saved.id}"]`)) continue;
      const holder = doc.createElement('div');
      holder.innerHTML = saved.html;
      const block = holder.firstElementChild;
      if (!block) continue;
      if (saved.kind === 'hidden') doc.body.prepend(block);
      else doc.body.append(block);
      restored = true;
    }
    if (restored) latest.current.onProtectedRestore?.();
  }, [latest]);

  const emit = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const doc = docRef.current;
      if (!doc?.body) return;
      restoreProtected(doc);
      latest.current.onChange?.(serializeEditorDocument(doc));
    });
  }, [latest, restoreProtected]);

  const reportFormat = useCallback(() => {
    const doc = docRef.current;
    if (doc?.body) latest.current.onFormatChange?.(readFormat(doc));
  }, [latest]);

  const onLoad = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    disposeRef.current?.();
    docRef.current = doc;
    prepare(doc);

    const disposers = [];
    const on = (type, fn) => {
      doc.addEventListener(type, fn);
      disposers.push(() => doc.removeEventListener(type, fn));
    };
    on('input', emit);
    on('selectionchange', reportFormat);
    on('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        latest.current.onRequestLink?.();
      }
    });
    // Collage en texte brut : ni styles, ni HTML, ni scripts venus d'une page ou d'un document Word.
    on('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain');
      if (text) doc.execCommand('insertText', false, text);
    });
    // Glisser-déposer : comme le collage, ce qui vient d'ailleurs (autre page, Word…) entre en texte brut — pas de styles
    // en ligne importés. Déplacer du texte DE la zone elle-même (`dragstart` ici) reste l'affaire du navigateur.
    let internalDrag = false;
    on('dragstart', () => {
      internalDrag = true;
    });
    on('dragend', () => {
      internalDrag = false;
    });
    on('drop', (e) => {
      const fromHere = internalDrag;
      internalDrag = false;
      if (fromHere) return;
      e.preventDefault();
      const dt = e.dataTransfer;
      if (!dt || dt.files?.length) return;
      const text = dt.getData('text/plain');
      const range = text ? caretRangeAt(doc, e.clientX, e.clientY) : null;
      const node = range?.startContainer;
      // Pas de curseur sous le point, ou point sur un bloc protégé : rien n'est inséré.
      if (!node || !doc.body.contains(node) || elementOf(node)?.closest('[data-smx-lock]')) return;
      const selection = doc.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      doc.execCommand('insertText', false, text);
    });
    // Un clic sur un lien place le curseur : il ne navigue pas.
    on('click', (e) => {
      if (elementOf(e.target)?.closest('a')) e.preventDefault();
    });
    disposeRef.current = () => disposers.forEach((d) => d());
    reportFormat();
  }, [prepare, emit, reportFormat, latest]);

  // À la fermeture : la dernière frappe en attente est transmise, rien n'est perdu.
  useEffect(() => () => {
    disposeRef.current?.();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      try {
        const doc = docRef.current;
        if (doc?.body) latest.current.onChange?.(serializeEditorDocument(doc));
      } catch {
        /* document déjà détaché */
      }
    }
  }, [latest]);

  const api = {
    focus() {
      const doc = docRef.current;
      doc?.defaultView?.focus();
      doc?.body?.focus();
    },
    exec(command, value) {
      const doc = docRef.current;
      if (!doc?.body) return false;
      doc.defaultView?.focus();
      let ok = false;
      try {
        ok = doc.execCommand(command, false, value);
      } catch {
        ok = false;
      }
      emit();
      reportFormat();
      return ok;
    },
    getHtml() {
      const doc = docRef.current;
      return doc?.body ? serializeEditorDocument(doc) : '';
    },
    /** Remplace tout le contenu (rétablissement de l'original) sans recharger l'iframe. */
    setHtml(next) {
      const doc = docRef.current;
      if (!doc?.body) return;
      replaceDocument(doc, prepareEditorHtml(next));
      prepare(doc);
      reportFormat();
    },
    captureSelection() {
      const sel = docRef.current?.getSelection();
      return sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    },
    selectedText() {
      return docRef.current?.getSelection()?.toString() ?? '';
    },
    /** Adresse du lien sous le curseur (`null` s'il n'y en a pas). */
    currentLink() {
      const a = elementOf(docRef.current?.getSelection()?.anchorNode)?.closest?.('a');
      return a ? a.getAttribute('href') || '' : null;
    },
    /**
     * Pose un lien sur la sélection (ou insère l'adresse comme texte), ou en change l'adresse.
     * @returns `true` si le lien a été posé ; `false` quand il n'y avait nulle part où le poser (aucun curseur dans le
     * corps, bloc protégé, lien personnel, sélection sans texte) ou que le navigateur a refusé la commande : l'appelant
     * le dit à l'utilisateur.
     */
    applyLink(url, range) {
      const doc = docRef.current;
      if (!doc?.body) return false;
      doc.defaultView?.focus();
      const sel = doc.getSelection();
      if (range) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      const anchor = elementOf(sel.anchorNode);
      if (sel.rangeCount === 0 || !anchor || !doc.body.contains(anchor) || anchor.closest('[data-smx-lock]')) return false;
      const existing = anchor.closest('a');
      if (existing) {
        if (isPersonalHref(existing)) return false;
        existing.setAttribute('href', url);
        emit();
        reportFormat();
        return true;
      }
      // `execCommand` répond `true` même quand rien n'a été créé (sélection réduite à un saut de ligne, par exemple) :
      // on vérifie qu'un lien vers cette adresse est bien apparu dans le corps.
      const countLinks = () => [...doc.body.querySelectorAll('a')].filter((a) => a.getAttribute('href') === url).length;
      const before = countLinks();
      const accepted = sel.isCollapsed
        ? doc.execCommand('insertHTML', false, `<a href="${escapeAttr(url)}">${escapeText(url)}</a>`)
        : doc.execCommand('createLink', false, url);
      emit();
      reportFormat();
      return Boolean(accepted) && countLinks() > before;
    },
    removeLink() {
      const doc = docRef.current;
      const a = elementOf(doc?.getSelection()?.anchorNode)?.closest?.('a');
      if (!a || isPersonalHref(a)) return;
      doc.defaultView?.focus();
      doc.execCommand('unlink', false);
      emit();
      reportFormat();
    },
  };
  // L'API est stable : tout ce qu'elle lit passe par des refs.
  useImperativeHandle(ref, () => api, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <iframe
      ref={frameRef}
      title={`Zone de rédaction : ${title}`}
      srcDoc={initialSrcDoc}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      className="smx-ed-frame"
    />
  );
});

export default RichTextFrame;
