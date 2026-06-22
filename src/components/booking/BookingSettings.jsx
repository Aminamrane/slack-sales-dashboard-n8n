import React, { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';

/**
 * Section "Mon lien de prise de RDV" dans les réglages du sales (onglet Relance).
 *
 * Additif et autonome : charge/sauve les réglages de booking (horaires + jours +
 * on/off) via /rdv-booking/manage/settings, et affiche le LIEN GÉNÉRAL du sales
 * (à envoyer aux nouveaux prospects / cold calls) via /rdv-booking/manage/general-link.
 * Sauvegarde instantanée par champ (comme les toggles relance). Props : { C, darkMode }.
 */

const DAYS = [
  { iso: 1, label: 'L' }, { iso: 2, label: 'M' }, { iso: 3, label: 'M' },
  { iso: 4, label: 'J' }, { iso: 5, label: 'V' }, { iso: 6, label: 'S' }, { iso: 7, label: 'D' },
];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6h..21h

const LinkIcon = ({ color, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 13.5a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.5 1.5" />
    <path d="M14.5 10.5a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.5-1.5" />
  </svg>
);

export default function BookingSettings({ C, darkMode }) {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [startH, setStartH] = useState(9);
  const [endH, setEndH] = useState(19);
  const [days, setDays] = useState(new Set([1, 2, 3, 4, 5]));
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get('/api/v1/rdv-booking/manage/settings'),
      apiClient.get('/api/v1/rdv-booking/manage/general-link'),
    ]).then(([s, g]) => {
      if (cancelled) return;
      setEnabled(!!s.booking_enabled);
      setStartH(s.booking_start_hour ?? 9);
      setEndH(s.booking_end_hour ?? 19);
      setDays(new Set(String(s.booking_days || '1,2,3,4,5').split(',').map(Number).filter(Boolean)));
      if (g && g.url) setUrl(g.url); // URL audit (jamais interne) — autorité serveur
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const save = (patch) => { apiClient.put('/api/v1/rdv-booking/manage/settings', patch).catch(() => {}); };

  const toggleEnabled = () => { const v = !enabled; setEnabled(v); save({ booking_enabled: v }); };
  const changeStart = (h) => { setStartH(h); save({ booking_start_hour: h }); };
  const changeEnd = (h) => { setEndH(h); save({ booking_end_hour: h }); };
  const toggleDay = (iso) => {
    const next = new Set(days);
    if (next.has(iso)) next.delete(iso); else next.add(iso);
    setDays(next);
    save({ booking_days: [...next].sort((a, b) => a - b).join(',') });
  };
  const copy = () => { if (!url) return; navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  if (!loaded) return null;

  const card = { padding: '16px 20px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}` };
  const selectStyle = {
    padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
    background: darkMode ? C.subtle : '#f9fafb', color: C.text, fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer', outline: 'none', textAlign: 'center',
  };

  return (
    <div style={{ marginTop: 28, paddingTop: 28, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Mon lien de prise de RDV</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 }}>Un lien personnel à envoyer à vos prospects. Ils réservent selon vos disponibilités (vos RDV et absences sont exclus automatiquement).</p>
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Activer mon lien</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Désactivé, le lien n'affiche aucun créneau.</div>
        </div>
        <button type="button" onClick={toggleEnabled} aria-pressed={enabled} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: enabled ? '#3b82f6' : (darkMode ? '#3a3b46' : '#d1d5db'), position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: enabled ? 23 : 3, transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </button>
      </div>

      {enabled && (
        <>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>Heures de disponibilité</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: C.muted }}>De</span>
              <select value={startH} onChange={(e) => changeStart(Number(e.target.value))} style={selectStyle}>
                {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
              </select>
              <span style={{ fontSize: 13, color: C.muted }}>à</span>
              <select value={endH} onChange={(e) => changeEnd(Number(e.target.value))} style={selectStyle}>
                {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
              </select>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '16px 0 10px' }}>Jours</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {DAYS.map((d, i) => {
                const on = days.has(d.iso);
                return (
                  <button key={`${d.iso}-${i}`} type="button" onClick={() => toggleDay(d.iso)} style={{
                    width: 34, height: 34, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                    border: `1px solid ${on ? '#3b82f6' : C.border}`, background: on ? '#3b82f6' : 'transparent', color: on ? '#fff' : C.muted, transition: 'all 0.15s',
                  }}>{d.label}</button>
                );
              })}
            </div>
          </div>

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <LinkIcon color={C.accent} size={16} />
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Votre lien à partager</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={url} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: darkMode ? C.subtle : '#f9fafb', color: C.muted, fontSize: 12.5, fontFamily: 'monospace', outline: 'none' }} />
              <button type="button" onClick={copy} style={{
                padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                background: copied ? 'rgba(16,185,129,0.12)' : C.accent, color: copied ? '#10b981' : '#fff', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>{copied ? 'Copié ✓' : 'Copier'}</button>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>Envoyez ce lien à un nouveau prospect (cold call) : il choisit un créneau et le lead se crée automatiquement dans votre pipeline.</div>
          </div>
        </>
      )}
    </div>
  );
}
