// src/pages/MetaAds/CreativeThumb.jsx — visuel d'une créa Meta.
//
// Le backend stocke les visuels chez nous et les sert sur une route
// authentifiée (`/api/v1/marketing/meta-ads/creative/<asset>`). Une balise
// <img src> n'envoie pas le JWT : on récupère donc l'image en fetch avec le
// jeton, puis on l'affiche via un object URL.
//
// Deux mutualisations évitent de retélécharger : un cache mémoire par asset
// (l'object URL vit le temps de l'onglet) et un cache de requêtes en vol, pour
// que dix lignes pointant le même visuel ne déclenchent qu'un seul appel.

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import apiClient from '../../services/apiClient.js';

// asset -> object URL (résolu). Volontairement au niveau module : le cache
// doit survivre au démontage des lignes pendant qu'on change d'onglet.
const objectUrls = new Map();
// asset -> Promise en cours, pour dédupliquer les appels simultanés.
const inFlight = new Map();

async function loadCreative(path) {
  if (objectUrls.has(path)) return objectUrls.get(path);
  if (inFlight.has(path)) return inFlight.get(path);

  const promise = (async () => {
    const token = apiClient.getToken();
    const res = await fetch(`${apiClient.baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    objectUrls.set(path, url);
    return url;
  })().finally(() => inFlight.delete(path));

  inFlight.set(path, promise);
  return promise;
}

// ── Repli dessiné ──────────────────────────────────────────────────────────
// Quand une créa n'a pas de visuel exploitable, on ne laisse pas un carré
// vide : un motif discret, dérivé du nom, garde la ligne lisible et permet
// malgré tout de distinguer deux créas l'une de l'autre.
function hashString(value) {
  let h = 0;
  for (let i = 0; i < (value || '').length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function FallbackArt({ name, T }) {
  const h = hashString(name);
  const hue = h % 360;
  const rotate = (h % 4) * 45;
  // Assez soutenu pour qu'une ligne sans visuel reste lisible dans un tableau,
  // assez sobre pour ne jamais voler l'attention à une vraie créa.
  const from = `hsl(${hue} ${T.isDark ? 34 : 52}% ${T.isDark ? 30 : 82}%)`;
  const to = `hsl(${(hue + 38) % 360} ${T.isDark ? 28 : 44}% ${T.isDark ? 22 : 90}%)`;
  const ink = `hsl(${hue} ${T.isDark ? 52 : 58}% ${T.isDark ? 76 : 32}%)`;
  return (
    <svg width="100%" height="100%" viewBox="0 0 48 48" preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={`fb-${h}`} x1="0" y1="0" x2="1" y2="1" gradientTransform={`rotate(${rotate} .5 .5)`}>
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill={`url(#fb-${h})`} />
      {/* Un cadre et un horizon : lecture « emplacement d'image », sans icône générique. */}
      <rect x="12.5" y="13.5" width="23" height="21" rx="3.5" fill="none" stroke={ink} strokeWidth="1.8" opacity="0.9" />
      <path d="M13.4 30l5.8-5.4 4.5 4.1 3.5-3.1 6.1 5.6" fill="none" stroke={ink}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx="20.1" cy="19.9" r="2.1" fill={ink} opacity="0.75" />
    </svg>
  );
}

// ── Pastille « vidéo » ─────────────────────────────────────────────────────
function VideoBadge({ size }) {
  // `size` peut être fluide ("100%") : on retombe alors sur une pastille
  // confortable plutôt que de la calculer.
  const d = typeof size === 'number' ? Math.max(14, Math.round(size * 0.3)) : 26;
  const inset = typeof size === 'number' ? 3 : 8;
  return (
    <span
      title="Créa vidéo"
      style={{
        position: 'absolute', right: inset, bottom: inset, width: d, height: d, borderRadius: 99,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8,10,16,0.62)', backdropFilter: 'blur(3px)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
      }}
    >
      <svg width={Math.round(d * 0.5)} height={Math.round(d * 0.5)} viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3.4 2.3l6 3.3a.45.45 0 010 .8l-6 3.3a.45.45 0 01-.68-.4V2.7a.45.45 0 01.68-.4z" fill="#fff" />
      </svg>
    </span>
  );
}

/**
 * Vignette d'une créa.
 *
 * @param creative  objet `creative` renvoyé par l'API (peut être null)
 * @param name      nom de la créa, sert au repli dessiné et à l'infobulle
 * @param size      côté en pixels, ou "100%" pour une largeur fluide
 * @param aspect    ratio CSS à tenir quand la largeur est fluide
 * @param radius    arrondi
 * @param interactive  léger zoom au survol (désactivé dans les tableaux denses)
 */
export default function CreativeThumb({
  creative, name, size = 34, radius = 9, T, interactive = false, aspect = null,
}) {
  const path = creative?.thumb || null;
  const [src, setSrc] = useState(() => (path ? objectUrls.get(path) || null : null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!path) return undefined;
    if (objectUrls.has(path)) { setSrc(objectUrls.get(path)); return undefined; }
    let alive = true;
    setSrc(null); setFailed(false);
    loadCreative(path)
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [path]);

  const fluid = typeof size !== 'number';
  const box = {
    position: 'relative',
    width: fluid ? '100%' : size,
    height: fluid ? 'auto' : size,
    aspectRatio: fluid ? (aspect || '1 / 1') : undefined,
    borderRadius: radius,
    overflow: 'hidden',
    flexShrink: fluid ? undefined : 0,
    background: T.surfaceAlt,
    border: `1px solid ${T.border}`,
  };

  // Aucun visuel connu, ou téléchargement impossible : repli dessiné.
  if (!path || failed) {
    return (
      <div style={box} title={name || ''}>
        <FallbackArt name={name || ''} T={T} />
      </div>
    );
  }

  return (
    <motion.div
      style={box}
      whileHover={interactive ? { scale: 1.035 } : undefined}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      title={name || ''}
    >
      {/* Pendant le chargement : un reflet qui balaie, pas un trou blanc. Le
          mouvement horizontal lit mieux qu'un clignotement d'opacité, surtout
          sur les grandes vignettes du podium. */}
      {!src && (
        <div style={{ position: 'absolute', inset: 0, background: T.surfaceAlt, overflow: 'hidden' }}>
          <motion.div
            animate={{ x: ['-140%', '140%'] }}
            transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(105deg, transparent 18%, ${
                T.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.85)'
              } 50%, transparent 82%)`,
            }}
          />
        </div>
      )}
      {src && (
        <motion.img
          src={src}
          alt={name || 'Créa'}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {creative?.kind === 'video' && <VideoBadge size={size} />}
    </motion.div>
  );
}
