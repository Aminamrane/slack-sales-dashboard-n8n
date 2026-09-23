import { useMemo, useRef, useState, useCallback } from 'react';

/**
 * Section « Analyse IA du live » : lecture éditoriale d'un webinaire pour la
 * direction marketing. En-tête (titre + score), verdict, entonnoir, vidéo
 * (fichier local OU URL hébergée) avec la frise des moments clés qui rejouent
 * l'instant exact, puis les trois lectures (ce qui a vendu, ce qui a fui, les
 * axes) et la conclusion. 100 % frontend, données statiques par cohorte
 * (voir data/webinarReplay.js).
 */

const KIND = {
  good: { label: 'Ça vend', tone: 'emerald' },
  bad: { label: 'Fuite', tone: 'rose' },
  cta: { label: 'CTA', tone: 'blue' },
  objection: { label: 'Objection', tone: 'amber' },
  proof: { label: 'Preuve', tone: 'violet' },
};

const fmtClock = (hhmmss) => (hhmmss || '').split(':').slice(0, 2).join(':');

const scoreNumber = (s) => {
  const m = String(s ?? '').match(/\d+/);
  return m ? Number(m[0]) : null;
};
const scoreTone = (n) => (n >= 75 ? 'emerald' : n >= 60 ? 'amber' : 'rose');
const scoreLabel = (n) => (n >= 80 ? 'Solide' : n >= 70 ? 'Correct' : n >= 60 ? 'Moyen' : 'Insuffisant');

// Première phrase mise en avant, le reste en corps de texte : le verdict se
// lit en deux temps au lieu d'un bloc uniforme.
const splitLead = (text) => {
  const src = String(text || '');
  const m = src.match(/^(.+?[.!?])\s+(?=[A-ZÀ-Ý«])/);
  return m ? [m[1], src.slice(m[0].length)] : [src, ''];
};

const CSS = `
.wlr-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:22px;align-items:start;margin-top:26px}
.wlr-sticky{position:sticky;top:16px}
.wlr-moment{transition:background .15s ease,border-color .15s ease,transform .15s ease}
.wlr-moment:hover{transform:translateX(2px)}
@media (max-width:900px){.wlr-grid{grid-template-columns:minmax(0,1fr)}.wlr-sticky{position:static}}
`;

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
  const kindCounts = useMemo(
    () => segments.reduce((acc, s) => { acc[s.kind] = (acc[s.kind] || 0) + 1; return acc; }, {}),
    [segments],
  );
  if (!data) return null;

  const n = scoreNumber(data.score);
  const [lead, rest] = splitLead(data.verdict);
  const card = { background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: 16, boxShadow: C.shadow };
  const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.faded };

  return (
    <section style={{ marginBottom: 24 }}>
      <style>{CSS}</style>
      <div style={{ ...card, padding: '22px 24px 24px' }}>
        {/* En-tête : titre + score */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <div style={eyebrow}>Analyse IA du live</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: C.text }}>{data.title}</h2>
          </div>
          {n != null && <ScoreBadge n={n} C={C} />}
        </div>

        {/* Verdict */}
        <div style={{ marginTop: 18, maxWidth: 860 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: C.text }}>{lead}</p>
          {rest && <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.65, color: C.muted }}>{rest}</p>}
          {data.scoreNote && (
            <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5, color: C.faded }}>
              <span style={{ fontWeight: 700 }}>Notation · </span>{data.scoreNote}
            </p>
          )}
        </div>

        <Funnel steps={data.funnel || []} C={C} />

        {/* Vidéo + frise des moments */}
        <div className="wlr-grid">
          <div className="wlr-sticky">
            {videoSrc ? (
              <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', borderRadius: 14, background: '#000', aspectRatio: '16 / 9', display: 'block' }} />
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, aspectRatio: '16 / 9', background: C.subtle, border: `1.5px dashed ${C.hairline}`, borderRadius: 14, cursor: 'pointer', textAlign: 'center', padding: 20 }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Charger la vidéo du live</div>
                <div style={{ fontSize: 12, color: C.muted, maxWidth: 320 }}>Sélectionne le fichier .mp4 depuis ton Mac. Chaque moment de la frise rejoue l&apos;instant exact.</div>
                <input type="file" accept="video/*" onChange={onPickFile} style={{ display: 'none' }} />
              </label>
            )}
            <KindLegend counts={kindCounts} C={C} />
          </div>
          <Timeline segments={segments} activeSeg={activeSeg} onPick={seekTo} hasVideo={!!videoSrc} eyebrow={eyebrow} C={C} />
        </div>

        {/* Les trois lectures */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 30 }}>
          <Reading title="Ce qui a vendu" tone="emerald" C={C}
            items={(data.positives || []).map((p) => ({ head: p.title, body: p.detail }))} />
          <Reading title="Ce qui a fui" tone="rose" C={C}
            items={(data.negatives || []).map((p) => ({ head: p.title, tag: p.time, body: p.detail }))} />
          <Reading title="Axes d'amélioration" tone="blue" C={C}
            items={(data.axes || []).map((p) => ({ head: p.title, tag: p.priority, body: p.detail }))} />
        </div>

        {/* Conclusion */}
        {data.closing && (
          <blockquote style={{ margin: '26px 0 0', padding: '14px 18px', borderLeft: `3px solid ${C.accent}`, background: C.subtle, borderRadius: '0 12px 12px 0', fontSize: 14.5, lineHeight: 1.6, color: C.text, fontStyle: 'italic' }}>
            {data.closing}
          </blockquote>
        )}
      </div>
    </section>
  );
}

/* ─── Score : nombre, appréciation et jauge à dix crans ─── */
function ScoreBadge({ n, C }) {
  const t = C[scoreTone(n)];
  const ticks = Array.from({ length: 10 }, (_, i) => i < Math.round(n / 10));
  return (
    <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: C.subtle, border: `1px solid ${C.hairline}`, borderRadius: 14 }}>
      <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: C.text, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
        {n}<span style={{ fontSize: 14, fontWeight: 600, color: C.faded, marginLeft: 3 }}>/100</span>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.fg }}>{scoreLabel(n)}</div>
        <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
          {ticks.map((on, i) => <span key={i} style={{ width: 12, height: 6, borderRadius: 2, background: on ? t.strong : C.hairline }} />)}
        </div>
      </div>
    </div>
  );
}

/* ─── Entonnoir : une carte par étape, numérotée ─── */
function Funnel({ steps, C }) {
  if (!steps.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 22 }}>
      {steps.map((f, i) => (
        <div key={f.label} style={{ position: 'relative', background: C.subtle, border: `1px solid ${C.hairline}`, borderRadius: 14, padding: '14px 16px' }}>
          <span style={{ position: 'absolute', top: 10, right: 12, fontSize: 10.5, fontWeight: 700, color: C.faded, fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{f.value}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginTop: 8 }}>{f.label}</div>
          {f.sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{f.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ─── Légende des natures de moments, avec leur nombre ─── */
function KindLegend({ counts, C }) {
  const kinds = Object.keys(KIND).filter((k) => counts[k]);
  if (!kinds.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
      {kinds.map((k) => {
        const t = C[KIND[k].tone];
        return (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: C.muted, background: C.subtle, border: `1px solid ${C.hairline}`, borderRadius: 999, padding: '3px 10px 3px 8px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.strong }} />
            {KIND[k].label}
            <span style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{counts[k]}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ─── Frise verticale des moments : heure, pastille, nature, titre, lecture ─── */
function Timeline({ segments, activeSeg, onPick, hasVideo, eyebrow, C }) {
  if (!segments.length) return null;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={eyebrow}>Les moments qui comptent</div>
        <div style={{ fontSize: 11.5, color: C.faded }}>
          {segments.length} moments · {hasVideo ? 'un clic rejoue le passage' : 'charge la vidéo pour rejouer'}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <span aria-hidden style={{ position: 'absolute', left: 65, top: 10, bottom: 10, width: 2, background: C.hairline, borderRadius: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {segments.map((seg) => {
            const k = KIND[seg.kind] || KIND.good;
            const t = C[k.tone];
            const on = activeSeg === seg.at;
            return (
              <button key={seg.at} type="button" className="wlr-moment" onClick={() => onPick(seg)}
                style={{ display: 'grid', gridTemplateColumns: '48px 28px minmax(0, 1fr)', alignItems: 'start', textAlign: 'left', background: on ? t.bg : 'transparent', border: `1px solid ${on ? t.strong : 'transparent'}`, borderRadius: 12, padding: '9px 10px 9px 4px', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums', paddingTop: 3 }}>{fmtClock(seg.clock)}</span>
                <span style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.strong, boxShadow: `0 0 0 3px ${on ? t.bg : C.surface}` }} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.fg, background: t.bg, borderRadius: 6, padding: '1px 6px', marginBottom: 5 }}>{k.label}</span>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{seg.title}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginTop: 3 }}>{seg.insight}</span>
                  {on && Array.isArray(seg.reasoning) && seg.reasoning.length > 0 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                      {seg.reasoning.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Une lecture : titre à pastille, compteur, cartes en grille ─── */
function Reading({ title, tone, items, C }) {
  if (!items.length) return null;
  const t = C[tone];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.strong }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.fg, background: t.bg, borderRadius: 999, padding: '1px 8px', fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: C.subtle, border: `1px solid ${C.hairline}`, borderLeft: `3px solid ${t.strong}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{it.head}</span>
              {it.tag && <span style={{ fontSize: 10.5, fontWeight: 700, color: t.fg, background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: 6, padding: '1px 7px', whiteSpace: 'nowrap' }}>{it.tag}</span>}
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, marginTop: 5 }}>{it.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
