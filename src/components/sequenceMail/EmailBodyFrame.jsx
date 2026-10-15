// src/components/sequenceMail/EmailBodyFrame.jsx
//
// Affiche le corps réel d'un e-mail (HTML tel qu'envoyé, ou version texte).
//
// Le HTML est rendu dans une iframe SANS scripts (sandbox, jamais `allow-scripts`) et sous une politique de
// sécurité posée dans le document (cf. emailHtml.js) : le contenu vient du code de la landing, mais rien de ce
// qu'il contient ne doit pouvoir agir dans l'application. Les liens personnels (lien Zoom, désinscription… qui
// portent l'identifiant de l'inscrit) sont neutralisés : dans cet aperçu ils ne mènent nulle part. Les champs
// personnalisés (`{{prénom}}`) sont surlignés pour qu'on voie où l'e-mail se personnalise.
//
// Le corps peut changer pendant que l'e-mail est affiché (brouillon de l'éditeur de mail, cf.
// MailEditor.jsx) : l'iframe n'est alors PAS rechargée à chaque frappe, son document est remplacé
// sur place (`replaceDocument`) — pas de clignotement, la hauteur est remesurée.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { prepareHtml } from './emailHtml.js';
import { replaceDocument } from './editorDom';

/** @brief Hauteur de départ d'une iframe jamais mesurée (px). */
const DEFAULT_FRAME_HEIGHT = 240;

/**
 * @brief Dernière hauteur mesurée de chaque e-mail, gardée le temps de la session : rouvrir un e-mail (changement
 * d'onglet) repart de cette hauteur au lieu de 240 px — pas de saut de la page quand le corps se charge.
 */
const heightMemory = new Map();

/** @brief Texte brut avec les champs personnalisés surlignés. */
function PlainText({ text }) {
  const nodes = text.split(/(\{\{[^{}]{1,40}\}\})/g).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} style={{ background: '#e8f0fe', color: '#174ea6', borderRadius: 3, padding: '0 3px', fontWeight: 600 }}>
        {part}
      </span>
    ) : (
      part
    )
  );
  return <pre className="smx-plain">{nodes}</pre>;
}

/** @brief Le corps HTML dans une iframe sandbox ; ses changements ultérieurs sont appliqués sur place. */
function HtmlFrame({ html, title, onFit, memoKey }) {
  const frameRef = useRef(null);
  const observerRef = useRef(null);
  const loadedRef = useRef(false);
  const [height, setHeight] = useState(() => (memoKey && heightMemory.get(memoKey)) || DEFAULT_FRAME_HEIGHT);
  const srcDoc = useMemo(() => prepareHtml(html), [html]);
  // `srcDoc` n'est donné à l'iframe qu'une fois, au montage : le changer ensuite la rechargerait.
  const [initialSrcDoc] = useState(srcDoc);
  const shownRef = useRef(initialSrcDoc);

  const fit = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    const root = doc?.documentElement;
    if (!root) return;
    // `getBoundingClientRect` donne la hauteur naturelle du contenu ; scrollHeight ne descendrait
    // jamais sous la hauteur courante de l'iframe.
    const h = Math.ceil(root.getBoundingClientRect().height);
    if (h > 0) {
      if (memoKey) heightMemory.set(memoKey, h);
      setHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
    }
  }, [memoKey]);

  // Amène le document affiché à `srcDoc` s'il en diffère (corps modifié pendant l'affichage).
  const sync = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!loadedRef.current || !doc?.body || shownRef.current === srcDoc) return;
    replaceDocument(doc, srcDoc);
    shownRef.current = srcDoc;
    fit();
  }, [srcDoc, fit]);

  const onLoad = useCallback(() => {
    loadedRef.current = true;
    observerRef.current?.disconnect();
    const root = frameRef.current?.contentDocument?.documentElement;
    if (!root) return;
    fit();
    if (typeof ResizeObserver !== 'undefined') {
      observerRef.current = new ResizeObserver(fit);
      observerRef.current.observe(root);
    }
    sync(); // le corps a pu changer entre le montage et la fin du chargement
  }, [fit, sync]);

  useEffect(() => () => observerRef.current?.disconnect(), []);
  useEffect(() => {
    sync();
  }, [sync]);
  useEffect(() => {
    onFit?.();
  }, [height, onFit]);

  return (
    <iframe
      ref={frameRef}
      title={`Contenu de l'e-mail : ${title}`}
      srcDoc={initialSrcDoc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      style={{ height }}
    />
  );
}

/**
 * @param html Corps HTML de l'e-mail (peut être absent : e-mail en texte brut).
 * @param text Version texte.
 * @param mode `'html'` | `'text'`.
 * @param onFit Appelé après chaque mesure de la hauteur (le parent peut alors réappliquer un défilement).
 * @param memoKey Clé de l'e-mail (optionnelle) : sa dernière hauteur mesurée sert de hauteur de départ.
 */
export default function EmailBodyFrame({ html, text, mode, title, onFit, memoKey }) {
  if (mode === 'text' || !html) return <PlainText text={text || ''} />;
  return <HtmlFrame html={html} title={title} onFit={onFit} memoKey={memoKey} />;
}
