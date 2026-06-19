import React, { useState } from 'react';
// eslint-disable-next-line no-unused-vars -- motion + AnimatePresence utilisés via JSX (faux positif)
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../Marketing/components/Card';
import { ANALYSIS_BY_MONTH } from './analysisData';

/**
 * Bloc « Analyse de l'acquisition » placé sous l'entonnoir de la page Funnel
 * Leads. Aperçu replié (accroche + chiffres saillants) que l'on déplie pour
 * lire la synthèse complète. Calqué sur le design system Marketing (buildTheme
 * + Card, font Inter) pour rester cohérent avec le reste de la page.
 *
 * Contenu = synthèse éditoriale figée par mois (cf. analysisData.js). Si le
 * mois sélectionné n'a pas d'analyse, le composant ne rend rien.
 */

// ── Petit jeu d'icônes ligne (stroke, 24x24, currentColor) ────────────────
const ICON_PATHS = {
  sparkle: 'M12 4l1.7 4.1L18 9.8l-4.3 1.7L12 16l-1.7-4.5L6 9.8l4.3-1.7z',
  funnel: 'M4.5 5h15l-5.6 6.8V18l-3.8 2v-8.2z',
  layers: 'M12 3.2l8.4 4.3L12 11.8 3.6 7.5zM4 12l8 4.1 8-4.1M4 16.2l8 4.1 8-4.1',
  phone: 'M5 4h3.4l1.5 4.1-2.2 1.6a11 11 0 005.4 5.4l1.6-2.2 4.1 1.5V18a2 2 0 01-2.2 2A15.5 15.5 0 014 6.2 2 2 0 015 4z',
  snow: 'M12 3v18M4.6 7.5l14.8 9M19.4 7.5l-14.8 9',
  trending: 'M4 16l5.4-5.4 3.6 3.6L21 7M21 12V7h-5',
  repeat: 'M3.6 12a8.4 8.4 0 0114.1-6M20.4 12a8.4 8.4 0 01-14.1 6M17.7 6V3.3M17.7 6h-2.7M6.3 18v2.7M6.3 18h2.7',
  calendar: 'M4.5 5.5h15v14h-15zM4.5 9.7h15M8.7 3.5v3.4M15.3 3.5v3.4M9 14.2l2.2 2.2 4-4',
};

function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  if (name === 'target') {
    return (<svg {...common}><circle cx="12" cy="12" r="8.4" /><circle cx="12" cy="12" r="3.8" /></svg>);
  }
  if (name === 'clock') {
    return (<svg {...common}><circle cx="12" cy="12" r="8.4" /><path d="M12 7.6v4.7l3.1 1.9" /></svg>);
  }
  if (name === 'info') {
    return (<svg {...common}><circle cx="12" cy="12" r="8.4" /><path d="M12 11.2v4.6M12 7.9v.01" /></svg>);
  }
  return (<svg {...common}><path d={ICON_PATHS[name] || ICON_PATHS.sparkle} /></svg>);
}

// **gras** -> <strong> (chiffres mis en avant). Pas de dépendance markdown.
const renderRich = (text, C) => {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
};

const toneOf = (C, tone) => (C[tone] || C.violet);

// Pastille d'icône (carré arrondi, ton doux).
const IconChip = ({ C, icon, tone, size = 30 }) => {
  const t = toneOf(C, tone);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: 9, flexShrink: 0,
      background: t.bg, color: t.fg, border: `1px solid ${C.hairline}`,
    }}>
      <Icon name={icon} size={Math.round(size * 0.5)} strokeWidth={1.85} />
    </span>
  );
};

export default function FunnelAnalysis({ C, month }) {
  const a = ANALYSIS_BY_MONTH[month];
  const [open, setOpen] = useState(false);
  if (!a) return null;

  const cellH = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: C.faded, padding: '9px 10px', background: C.subtle,
  };
  const cellB = {
    fontSize: 12.5, padding: '11px 10px', borderTop: `1px solid ${C.hairline}`,
    color: C.text, fontVariantNumeric: 'tabular-nums',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{ marginTop: 20 }}
    >
      <Card
        C={C}
        title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <Icon name="sparkle" size={17} color={C.accent} strokeWidth={1.7} />
            Analyse de l'acquisition
          </span>
        )}
        subtitle={`${a.monthLabel} · synthèse au ${a.generatedAt}`}
        action={(
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999, lineHeight: 1.4,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
            background: C.accent, color: '#fff',
          }}>
            <Icon name="sparkle" size={13} color="#fff" strokeWidth={1.6} />
            Analyse IA
          </span>
        )}
      >
        {/* ── Aperçu (toujours visible) ── */}
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.65, color: C.muted }}>
          {renderRich(a.teaser, C)}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {a.highlights.map((h) => (
            <div key={h.label} style={{
              flex: '1 1 170px', minWidth: 160, display: 'flex', alignItems: 'center', gap: 11,
              padding: '12px 14px', borderRadius: 14, background: C.subtle, border: `1px solid ${C.hairline}`,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: C.surface, color: C.accent, border: `1px solid ${C.hairline}`,
              }}>
                <Icon name={h.icon} size={17} strokeWidth={1.85} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                  {h.value}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1, lineHeight: 1.3 }}>{h.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Bouton ouvrir / réduire ── */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="funnel-analysis-full"
          style={{
            marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 11, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            border: `1px solid ${open ? C.accent : C.border}`,
            background: C.surface, color: open ? C.accent : C.text,
            boxShadow: C.shadow, transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          {open ? "Réduire l'analyse" : "Lire l'analyse complète"}
          <motion.svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ flexShrink: 0 }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </button>

        {/* ── Analyse complète (dépliable) ── */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="full"
              id="funnel-analysis-full"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.hairline}` }}>
                {a.sections.map((sec, si) => (
                  <section key={sec.title} style={{ marginTop: si === 0 ? 0 : 26 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <IconChip C={C} icon={sec.icon} tone={sec.tone} />
                      <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', color: C.text }}>
                        {sec.title}
                      </h4>
                    </div>

                    {sec.body.map((p, pi) => (
                      <p key={pi} style={{ margin: '0 0 9px', fontSize: 13, lineHeight: 1.68, color: C.muted }}>
                        {renderRich(p, C)}
                      </p>
                    ))}

                    {/* Tableau des sources */}
                    {sec.block === 'sources' && (
                      <div style={{ overflowX: 'auto', margin: '12px 0 6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                          <thead>
                            <tr>
                              <th scope="col" style={{ ...cellH, textAlign: 'left' }}>Source</th>
                              <th scope="col" style={{ ...cellH, textAlign: 'right' }}>Clean</th>
                              <th scope="col" style={{ ...cellH, textAlign: 'right' }}>Réponse</th>
                              <th scope="col" style={{ ...cellH, textAlign: 'right' }}>R1 / clean</th>
                              <th scope="col" style={{ ...cellH, textAlign: 'right' }}>Conv. utile</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.sources.map((src) => {
                              const t = toneOf(C, src.tone);
                              return (
                                <tr key={src.name}>
                                  <td style={{ ...cellB, textAlign: 'left' }}>
                                    <div style={{ fontWeight: 700, color: C.text }}>{src.name}</div>
                                    <span style={{
                                      display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 999,
                                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.01em',
                                      background: t.bg, color: t.fg,
                                    }}>
                                      {src.tag}
                                    </span>
                                  </td>
                                  <td style={{ ...cellB, textAlign: 'right' }}>
                                    {src.clean}
                                    <span style={{ color: C.faded, fontWeight: 500, marginLeft: 5 }}>{src.share}</span>
                                  </td>
                                  <td style={{ ...cellB, textAlign: 'right' }}>{src.reply}</td>
                                  <td style={{ ...cellB, textAlign: 'right', fontWeight: 700 }}>{src.r1}</td>
                                  <td style={{ ...cellB, textAlign: 'right' }}>
                                    <span style={{
                                      display: 'inline-block', padding: '2px 9px', borderRadius: 999,
                                      background: t.bg, color: t.fg, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                    }}>
                                      {src.useful}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div style={{ fontSize: 11, color: C.faded, marginTop: 8, lineHeight: 1.45 }}>
                          Les trois sources principales couvrent 718 des 731 leads clean ; le reliquat (13 leads :
                          Simulateur web et landing pages résiduelles) est trop faible pour en tirer une lecture.
                        </div>
                      </div>
                    )}

                    {sec.after && sec.after.map((p, pi) => (
                      <p key={`a-${pi}`} style={{ margin: '0 0 9px', fontSize: 13, lineHeight: 1.68, color: C.muted }}>
                        {renderRich(p, C)}
                      </p>
                    ))}

                    {/* Plan d'action */}
                    {sec.block === 'levers' && (
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))',
                        gap: 12, marginTop: 12,
                      }}>
                        {a.levers.map((lv, li) => (
                          <div key={lv.title} style={{
                            display: 'flex', gap: 11, padding: 14, borderRadius: 14,
                            background: C.subtle, border: `1px solid ${C.hairline}`,
                          }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                              background: C.surface, color: C.accent, border: `1px solid ${C.hairline}`,
                            }}>
                              <Icon name={lv.icon} size={16} strokeWidth={1.85} />
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                                <span style={{ color: C.faded, marginRight: 6, fontVariantNumeric: 'tabular-nums' }}>{li + 1}.</span>
                                {lv.title}
                              </div>
                              <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>{lv.text}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}

                {a.nuance && (
                  <div style={{
                    display: 'flex', gap: 11, marginTop: 24, padding: '14px 16px', borderRadius: 14,
                    background: C.subtle, border: `1px solid ${C.hairline}`,
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                      background: C.surface, color: C.accent, border: `1px solid ${C.hairline}`,
                    }}>
                      <Icon name="info" size={16} strokeWidth={1.85} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                        Une nuance, pas une incohérence
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.6 }}>
                        {renderRich(a.nuance, C)}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 22, paddingTop: 14, borderTop: `1px solid ${C.hairline}`, fontSize: 11, color: C.faded, lineHeight: 1.5 }}>
                  Indicateurs de traitement (81 % le jour même, médiane 3h49) et de présence (R1 ≈ 51 %, R2 ≈ 61 %)
                  alignés sur Perf Sales : même source, même vérité. Synthèse éditoriale figée au {a.generatedAt} ;
                  les chiffres de l'entonnoir ci-dessus sont recalculés en direct.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
