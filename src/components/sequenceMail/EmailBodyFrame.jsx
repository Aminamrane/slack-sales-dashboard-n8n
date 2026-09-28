// src/components/sequenceMail/EmailBodyFrame.jsx
//
// Affiche le corps réel d'un e-mail (HTML tel qu'envoyé, ou version texte).
//
// Le HTML est rendu dans une iframe SANS scripts (sandbox) : le contenu vient du code de la
// landing, mais rien de ce qu'il contient ne doit pouvoir agir dans l'application. Les liens
// personnels (lien Zoom, désinscription… qui portent l'identifiant de l'inscrit) sont
// neutralisés : dans cet aperçu ils ne mènent nulle part. Les champs personnalisés
// (`{{prénom}}`) sont surlignés pour qu'on voie où l'e-mail se personnalise.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { prepareHtml } from './emailHtml';

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

/**
 * @param html Corps HTML de l'e-mail (peut être absent : e-mail en texte brut).
 * @param text Version texte.
 * @param mode `'html'` | `'text'`.
 * @param onFit Appelé après chaque mesure de la hauteur (le parent peut alors réappliquer un défilement).
 */
export default function EmailBodyFrame({ html, text, mode, title, onFit }) {
  const frameRef = useRef(null);
  const observerRef = useRef(null);
  const [height, setHeight] = useState(240);
  const srcDoc = useMemo(() => (html ? prepareHtml(html) : ''), [html]);

  const fit = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    const root = doc?.documentElement;
    if (!root) return;
    // `getBoundingClientRect` donne la hauteur naturelle du contenu ; scrollHeight ne descendrait
    // jamais sous la hauteur courante de l'iframe.
    const h = Math.ceil(root.getBoundingClientRect().height);
    if (h > 0) setHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  const onLoad = useCallback(() => {
    observerRef.current?.disconnect();
    const root = frameRef.current?.contentDocument?.documentElement;
    if (!root || typeof ResizeObserver === 'undefined') return;
    fit();
    observerRef.current = new ResizeObserver(fit);
    observerRef.current.observe(root);
  }, [fit]);

  useEffect(() => () => observerRef.current?.disconnect(), []);
  useEffect(() => {
    onFit?.();
  }, [height, onFit]);

  if (mode === 'text' || !html) return <PlainText text={text || ''} />;

  return (
    <iframe
      ref={frameRef}
      title={`Contenu de l'e-mail : ${title}`}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      style={{ height }}
    />
  );
}
