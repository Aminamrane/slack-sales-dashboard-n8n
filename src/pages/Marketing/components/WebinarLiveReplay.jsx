import { useMemo, useRef, useState, useCallback } from 'react';

/**
 * Section "Analyse IA du live" : lecteur vidéo (fichier local OU URL hébergée)
 * + segments horodatés cliquables qui rejouent le moment exact + synthèse
 * (verdict, funnel, positifs, fuites, axes). 100% frontend, data statique par
 * cohorte (voir data/webinarReplay.js).
 */

const KIND = {
  good: { label: 'Ça vend', color: '#15a34a', bg: 'rgba(21,163,74,0.12)' },
  bad: { label: 'Fuite', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  cta: { label: 'CTA', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  objection: { label: 'Objection', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  proof: { label: 'Preuve', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
};

const fmtClock = (hhmmss) => (hhmmss || '').split(':').slice(0, 2).join(':');

export default function WebinarLiveReplay({ data, C }) {
  const videoRef = useRef(null);
  const [videoSrc, setVideoSrc] = useState(data?.videoUrl || null);
  const [activeSeg, setActiveSeg] = useState(null);

  const onPickFile = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) setVideoSrc(URL.createObjectURL(f));
  }, []);

  const seekTo = useCallback((seg) => {
    setActiveSeg(seg.at);
    const v = videoRef.current;
    if (!v || !videoSrc) return;
    v.currentTime = seg.at;
    v.play?.().catch(() => {});
  }, [videoSrc]);

  const segments = useMemo(() => data?.segments || [], [data]);
  if (!data) return null;

  const card = { background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: 16, boxShadow: C.shadow };
  const sectionTitle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.faded, marginBottom: 10 };

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ ...card, padding: 20 }}>
        {/* En-tête : verdict + score */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ minWidth: 260, flex: 1 }}>
            <div style={sectionTitle}>Analyse IA du live</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.5 }}>{data.verdict}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>{data.score}</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4, maxWidth: 220 }}>{data.scoreNote}</div>
          </div>
        </div>

        {/* Funnel */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
          {(data.funnel || []).map((f) => (
            <div key={f.label} style={{ background: C.subtle, border: `1px solid ${C.hairline}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{f.value}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{f.label}</div>
              {f.sub && <div style={{ fontSize: 11, color: C.faded, marginTop: 2 }}>{f.sub}</div>}
            </div>
          ))}
        </div>

        {/* Vidéo + segments */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <div>
            {videoSrc ? (
              <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', borderRadius: 12, background: '#000', aspectRatio: '16 / 9' }} />
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, aspectRatio: '16 / 9', background: C.subtle, border: `1.5px dashed ${C.hairline}`, borderRadius: 12, cursor: 'pointer', textAlign: 'center', padding: 20 }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Charger la vidéo du live</div>
                <div style={{ fontSize: 12, color: C.muted }}>Sélectionne le fichier .mp4 depuis ton Mac. Les segments ci-contre rejouent le moment exact.</div>
                <input type="file" accept="video/*" onChange={onPickFile} style={{ display: 'none' }} />
              </label>
            )}
            <div style={{ ...sectionTitle, marginTop: 14, marginBottom: 8 }}>{data.title}</div>
          </div>

          <div style={{ maxHeight: 460, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
            {segments.map((seg) => {
              const k = KIND[seg.kind] || KIND.good;
              const on = activeSeg === seg.at;
              return (
                <button key={seg.at} type="button" onClick={() => seekTo(seg)}
                  style={{ textAlign: 'left', background: on ? k.bg : C.subtle, border: `1px solid ${on ? k.color : C.hairline}`, borderRadius: 10, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, background 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: k.color, background: k.bg, borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap' }}>{k.label}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtClock(seg.clock)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{seg.title}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.4, marginTop: 3 }}>{seg.insight}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Positifs / Fuites / Axes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 20 }}>
          <AnalysisCol title="Ce qui a vendu" accent="#15a34a" C={C}
            items={(data.positives || []).map((p) => ({ head: p.title, body: p.detail }))} />
          <AnalysisCol title="Ce qui a fui" accent="#dc2626" C={C}
            items={(data.negatives || []).map((p) => ({ head: p.title, tag: p.time, body: p.detail }))} />
          <AnalysisCol title="Axes d'amélioration" accent="#2563eb" C={C}
            items={(data.axes || []).map((p) => ({ head: p.title, tag: p.priority, body: p.detail }))} />
        </div>

        {/* Clôture */}
        {data.closing && (
          <div style={{ marginTop: 18, background: C.violet?.bg || C.subtle, borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${C.accent}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.55, fontStyle: 'italic' }}>{data.closing}</div>
          </div>
        )}
      </div>
    </section>
  );
}

function AnalysisCol({ title, accent, items, C }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />{title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: C.subtle, border: `1px solid ${C.hairline}`, borderRadius: 10, padding: '9px 11px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, lineHeight: 1.35 }}>{it.head}</span>
              {it.tag && <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: 6, padding: '0 6px', whiteSpace: 'nowrap' }}>{it.tag}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.45, marginTop: 3 }}>{it.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
