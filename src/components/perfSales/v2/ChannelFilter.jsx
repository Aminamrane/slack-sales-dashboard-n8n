import React from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { EASE } from '../motion';
import { AD_SOURCES, SOURCES, fr } from './model';

// Filtre par canal d'acquisition, puis par publicité pour les canaux ADS (dev 15/10/2026 : « filtrer par canaux
// d'acquisition, voir quels canaux font le plus de nos shows » ; « parmi les ads, filtrer par pub : Général, interne… »).
// `value` = { source, ad } ; `steps` : étapes qui rendent un canal visible ; `countStep` : le nombre affiché sur chaque pub.
export default function ChannelFilter({ model, value, onChange, steps, countStep, id, withAds = true }) {
  const g = model?.views?.global || {};
  const sources = SOURCES.filter((s) => steps.some((st) => (g[st]?.[s.key] || 0) > 0));
  const ads = withAds && AD_SOURCES.includes(value.source)
    ? (model?.ads?.[value.source] || []).filter((a) => steps.some((st) => a.steps?.[st])) : [];
  const color = SOURCES.find((s) => s.key === value.source)?.color;
  return (
    <div className="ps2-cfilter">
      <div className="ps2-picker" role="radiogroup" aria-label="Canal d’acquisition" style={{ marginTop: 0 }}>
        {[{ key: null, label: 'Global' }, ...sources].map((s) => (
          <button type="button" key={s.key || 'global'} role="radio" aria-checked={value.source === s.key} className="ps2-pick"
            onClick={() => onChange({ source: s.key, ad: null })}>
            {value.source === s.key && <Motion.span layoutId={`${id}-pill`} className="ps2-pick-pill" transition={{ duration: 0.4, ease: EASE }} />}
            <span className="ps2-pick-label">{s.color && <i style={{ background: s.color }} />}{s.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {ads.length > 1 && (
          <Motion.div key={value.source} className="ps2-adrow" style={{ '--c': color }} role="radiogroup" aria-label="Publicité"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.32, ease: EASE }}>
            <svg className="ps2-adrow-hook" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <Motion.path d="M4 1v9a7 7 0 0 0 7 7h9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: EASE }} />
            </svg>
            {[{ key: null, label: 'Toutes les pubs' }, ...ads].map((a, i) => (
              <Motion.button type="button" key={a.key || 'all'} role="radio" aria-checked={value.ad === a.key} className="ps2-adchip"
                onClick={() => onChange({ ...value, ad: a.key })}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE, delay: 0.05 + i * 0.035 }}>
                {value.ad === a.key && <Motion.span layoutId={`${id}-ad`} className="ps2-adchip-pill" transition={{ duration: 0.35, ease: EASE }} />}
                <span className="ps2-adchip-label">{a.label}{a.key && (a.steps?.[countStep] || 0) > 0 && <b className="ps2-num">{fr(a.steps[countStep])}</b>}</span>
              </Motion.button>
            ))}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
