// src/components/sequenceMail/editorDom.js
//
// Manipulations DOM de l'éditeur de mail (prototype), faites sur le document d'une iframe :
//   - préparer le HTML d'un e-mail pour l'édition (`prepareEditorHtml`) ;
//   - protéger les blocs qui ne doivent pas être modifiés (`lockProtectedBlocks`) ;
//   - récupérer un HTML propre, sans aucune trace de l'éditeur (`serializeEditorDocument`) ;
//   - remplacer le contenu d'un document déjà chargé sans le recharger (`replaceDocument`).
//
// Le HTML d'un e-mail réel est un document complet (tableaux, styles en ligne, liens personnels) :
// on l'édite DANS une iframe, tel quel, plutôt que dans un modèle de document d'éditeur qui le
// réécrirait. L'iframe isole aussi les styles de l'e-mail de ceux de l'application. Elle est en
// `sandbox` sans scripts, comme l'aperçu (EmailBodyFrame.jsx).

/** Marque tout ce que l'éditeur ajoute au document : retiré à la sérialisation. */
const EDIT_MARK = 'data-smx-edit';
const LOCK_ATTR = 'data-smx-lock';
const LOCK_TITLE_ATTR = 'data-smx-lock-title';
const LOCK_ID_ATTR = 'data-smx-lock-id';
/** Attributs posés sur <body> pour l'édition (et l'accessibilité de la zone de saisie). */
const BODY_EDIT_ATTRS = ['contenteditable', 'spellcheck', 'role', 'aria-multiline', 'aria-label'];

const FOOTER_HINT = "Pied de page de désinscription : protégé, il n'est pas modifiable.";

const EDITOR_FRAME_CSS =
  'html{background:#fff}' +
  'body{cursor:text;outline:none;min-height:100vh;box-sizing:border-box}' +
  'a{cursor:text}img{cursor:default}' +
  '[data-smx-lock]{cursor:default;-webkit-user-select:none;user-select:none}' +
  '[data-smx-lock="footer"]{outline:1px dashed #c3c8d0;outline-offset:4px;opacity:.85}' +
  '::selection{background:#cfe0fc}';

/**
 * @brief HTML d'un e-mail prêt à être chargé dans l'iframe d'édition (styles de l'éditeur injectés).
 * @returns Document HTML complet, pour `srcDoc`.
 */
export function prepareEditorHtml(html) {
  const inject = `<meta ${EDIT_MARK} name="color-scheme" content="light"><style ${EDIT_MARK}>${EDITOR_FRAME_CSS}</style>`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + inject) : inject + html;
}

const hasHiddenStyle = (el) => {
  const style = (el.getAttribute('style') || '').replace(/\s+/g, '').toLowerCase();
  return style.includes('max-height:0') || style.includes('display:none');
};

function lock(el, kind) {
  el.setAttribute('contenteditable', 'false');
  el.setAttribute(LOCK_ATTR, kind);
  if (kind === 'footer' && !el.hasAttribute('title')) {
    el.setAttribute('title', FOOTER_HINT);
    el.setAttribute(LOCK_TITLE_ATTR, '1');
  }
}

/**
 * @brief Rend non modifiables les blocs qui ne sont pas du contenu rédactionnel :
 *  - le pré-en-tête (bloc invisible dupliquant le texte d'aperçu de la boîte de réception) ;
 *  - le pied de page de désinscription (lien personnel `…/u/EVENT_ID`, obligation légale).
 * Les autres liens personnels (boutons « Rejoindre… ») restent modifiables : on corrige le libellé d'un bouton.
 */
export function lockProtectedBlocks(doc) {
  for (const el of doc.body.querySelectorAll('[style]')) {
    if (hasHiddenStyle(el)) lock(el, 'hidden');
  }
  for (const a of doc.body.querySelectorAll('a[href*="/u/EVENT_ID"]')) {
    lock(a.closest('p') || a, 'footer');
  }
}

/** @brief Sans trace de l'éditeur : retire marques, verrous et attributs d'édition d'un arbre cloné. */
function stripEditorTraces(root) {
  root.querySelectorAll(`[${EDIT_MARK}]`).forEach((el) => el.remove());
  const body = root.querySelector('body');
  for (const name of BODY_EDIT_ATTRS) body?.removeAttribute(name);
  root.querySelectorAll(`[${LOCK_ATTR}]`).forEach((el) => {
    el.removeAttribute('contenteditable');
    el.removeAttribute(LOCK_ATTR);
    el.removeAttribute(LOCK_ID_ATTR);
    if (el.hasAttribute(LOCK_TITLE_ATTR)) {
      el.removeAttribute('title');
      el.removeAttribute(LOCK_TITLE_ATTR);
    }
  });
}

/** @brief Remplace chaque élément `from` par un élément `to` de même contenu et mêmes attributs. */
function renameTag(root, from, to) {
  for (const el of root.querySelectorAll(from)) {
    const next = root.ownerDocument.createElement(to);
    for (const attr of el.attributes) next.setAttribute(attr.name, attr.value);
    next.append(...el.childNodes);
    el.replaceWith(next);
  }
}

/**
 * @brief Chrome enveloppe parfois du texte dans un `<span style="…">` qui recopie le style calculé
 * (polices, `orphans`, `widows`…) quand il fusionne deux paragraphes : du bruit, pas du contenu.
 */
function unwrapComputedStyleSpans(root) {
  for (const span of root.querySelectorAll('span[style]')) {
    const style = span.getAttribute('style') || '';
    if (/orphans:|widows:|-webkit-text-stroke-width:|text-decoration-thickness:/i.test(style)) span.replaceWith(...span.childNodes);
  }
}

/**
 * @brief HTML de l'e-mail tel qu'il est dans l'éditeur, sans trace de celui-ci.
 * @note `<b>`/`<i>` deviennent `<strong>`/`<em>`, comme dans le reste des e-mails. Un document intact
 * redonne exactement `normalizeEmailHtml` de son HTML d'origine : c'est ce qui permet de savoir s'il
 * a vraiment été modifié.
 */
export function serializeEditorDocument(doc) {
  const root = doc.documentElement.cloneNode(true);
  stripEditorTraces(root);
  renameTag(root, 'b', 'strong');
  renameTag(root, 'i', 'em');
  unwrapComputedStyleSpans(root);
  return `<!doctype html>\n${root.outerHTML}`;
}

/** @brief HTML d'origine d'un e-mail, passé par la même sérialisation que celui de l'éditeur. */
export function normalizeEmailHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return serializeEditorDocument(doc);
}

/**
 * @brief Position du curseur sous le point (x, y) du document `doc` : un `Range` réduit, ou `null`.
 * @note `caretRangeFromPoint` (Chrome, Safari) ou `caretPositionFromPoint` (Firefox) : sert à poser le curseur
 * à l'endroit d'un dépôt (glisser-déposer) avant d'y insérer du texte brut.
 */
export function caretRangeAt(doc, x, y) {
  if (typeof doc.caretRangeFromPoint === 'function') return doc.caretRangeFromPoint(x, y);
  const position = doc.caretPositionFromPoint?.(x, y);
  if (!position) return null;
  const range = doc.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}

const importAll = (doc, nodes) => [...nodes].map((n) => doc.importNode(n, true));
const syncAttributes = (to, from) => {
  for (const a of [...to.attributes]) if (!from.hasAttribute(a.name)) to.removeAttribute(a.name);
  for (const a of from.attributes) if (to.getAttribute(a.name) !== a.value) to.setAttribute(a.name, a.value);
};

/**
 * @brief Remplace le contenu d'un document d'iframe DÉJÀ chargé par celui de `html`, sans le recharger
 * (pas de clignotement, la boîte de rendu et la hauteur sont conservées).
 * @note Les `<script>` sont retirés avant l'import ; l'iframe est de toute façon sans scripts.
 */
export function replaceDocument(doc, html) {
  const next = new DOMParser().parseFromString(html, 'text/html');
  next.querySelectorAll('script').forEach((s) => s.remove());
  syncAttributes(doc.documentElement, next.documentElement);
  doc.head.replaceChildren(...importAll(doc, next.head.childNodes));
  syncAttributes(doc.body, next.body);
  doc.body.replaceChildren(...importAll(doc, next.body.childNodes));
}
