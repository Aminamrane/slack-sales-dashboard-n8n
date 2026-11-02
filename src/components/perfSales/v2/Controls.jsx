import React from 'react';

// Mois et actualisation, dans l'en-tête (dev 14/10 : « cette partie-là, il y a une meilleure manière de l'intégrer »).
export default function Controls({ controls }) {
  if (!controls) return null;
  const current = controls.options.find((o) => o.value === controls.value);
  return (
    <span className="ps2-controls">
      <label className="ps2-month">
        <span>{current?.label || controls.value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        <select aria-label="Mois affiché" value={controls.value} onChange={(e) => controls.onChange(e.target.value)}>
          {controls.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <button type="button" className={`ps2-refresh${controls.loading ? ' is-loading' : ''}`} onClick={controls.onRefresh} disabled={controls.loading} aria-label="Actualiser" title="Actualiser">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
      </button>
    </span>
  );
}
