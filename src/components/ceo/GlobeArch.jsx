import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ceo5 from '../../assets/ceo5.svg';
import { useMotionPrefs } from './motion.js';

// Le globe de l'équipe, vu à travers une arche. L'iframe (three.js, chargé depuis un
// CDN) n'est montée que lorsque la carte entre dans le champ : le haut de page ne
// l'attend jamais. Le menu « Cabinet partenaire » remplace le globe par le plan
// d'Opti'Lex (mapbox, chargé à la demande).
export default function GlobeArch({ avatarMap, dark, C }) {
  const { item } = useMotionPrefs();
  const hostRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [cabinet, setCabinet] = useState(null);
  const menuRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || visible) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) { setMenuOpen(false); setSubOpen(false); } };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  useEffect(() => {
    if (cabinet !== 'optilex' || !mapContainerRef.current) return undefined;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled) return;
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [2.3485, 48.8595], zoom: 11, pitch: 0, bearing: 10,
        antialias: true, attributionControl: false, logoPosition: 'bottom-left',
      });
      mapInstanceRef.current = map;
      map.on('load', () => {
        map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.4, position: [1.5, 210, 30] });
        map.addLayer({
          id: '3d-buildings', source: 'composite', 'source-layer': 'building', filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 14,
          paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'height'], 0, '#e8ebf4', 30, '#d5dae8', 80, '#b8bfd3', 150, '#9aa3bf'],
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
            'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
            'fill-extrusion-opacity': 0.94, 'fill-extrusion-vertical-gradient': true,
          },
        });
        map.once('idle', () => {
          map.flyTo({ center: [2.3485, 48.8595], zoom: 16.2, pitch: 52, bearing: -22, duration: 3200, curve: 1.4, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), essential: true });
          map.once('moveend', () => {
            if (cancelled) return;
            const labelEl = document.createElement('div');
            labelEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';
            labelEl.innerHTML = `
              <div style="background:#1c2b6e;color:#fff;font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:600;letter-spacing:-0.01em;padding:4px 9px;border-radius:10px;box-shadow:0 4px 12px rgba(28,43,110,0.4);white-space:nowrap;margin-bottom:2px;">Opti'Lex</div>
              <div style="width:10px;height:10px;background:#1c2b6e;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>`;
            new mapboxgl.Marker({ element: labelEl, anchor: 'bottom' }).setLngLat([2.3485, 48.8595]).addTo(map);
          });
        });
      });
    })();
    return () => { cancelled = true; if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [cabinet]);

  const menuItem = (label, onClick, { active, chevron } = {}) => (
    <div onClick={onClick} style={{ padding: '9px 14px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, transition: 'background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.subtle; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ fontSize: 14, color: C.text }}>{label}</span>
      {chevron && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>}
      {active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
    </div>
  );
  const menuBox = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 6, boxShadow: dark ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(0,0,0,0.10)', animation: 'ceoFadeIn 0.2s cubic-bezier(0.16,1,0.3,1) both' };

  return (
    <motion.div ref={hostRef} className="an-panel an-arch" variants={item} style={{ zIndex: menuOpen ? 100 : 'auto', aspectRatio: '1 / 1' }} aria-label="Globe de l’équipe">
      <span className="an-arch-frame" aria-hidden="true" />
      <div ref={menuRef} className="an-arch-menu">
        <img src={ceo5} alt="" onClick={() => { setMenuOpen((o) => !o); setSubOpen(false); }}
          style={{ width: 58, height: 55, objectFit: 'contain', cursor: 'pointer', transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', transformOrigin: 'center' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }} />
        {menuOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 220, zIndex: 2000, ...menuBox }}>
            <div style={{ position: 'relative' }}>
              {menuItem('Cabinet partenaire', () => setSubOpen((o) => !o), { chevron: true })}
              {subOpen && (
                <div style={{ position: 'absolute', left: 'calc(100% + 2px)', top: 0, minWidth: 180, ...menuBox }}>
                  {menuItem("Opti'Lex", () => { setCabinet(cabinet === 'optilex' ? null : 'optilex'); setMenuOpen(false); setSubOpen(false); }, { active: cabinet === 'optilex' })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="an-arch-globe">
        {visible ? (
          <iframe
            src="/globe.html"
            title="Globe"
            loading="lazy"
            ref={(el) => {
              if (el && Object.keys(avatarMap).length > 0) {
                el.onload = () => el.contentWindow.postMessage({ type: 'avatars', data: avatarMap }, '*');
              }
            }}
            style={{ opacity: cabinet === 'optilex' ? 0 : 1, pointerEvents: cabinet === 'optilex' ? 'none' : 'auto', transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1)' }}
          />
        ) : <div className="an-arch-wait" aria-hidden="true" />}
        {cabinet === 'optilex' && (
          <div ref={mapContainerRef} className="ceo-optilex-map" style={{ position: 'absolute', inset: 0, borderRadius: 12, overflow: 'hidden', animation: 'ceoFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both' }} />
        )}
      </div>
    </motion.div>
  );
}
