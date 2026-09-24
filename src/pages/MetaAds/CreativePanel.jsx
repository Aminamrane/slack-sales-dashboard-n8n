// src/pages/MetaAds/CreativePanel.jsx — le détail d'une créa, pour creuser.
//
// S'ouvre au clic sur une créa (onglet Créas ou onglet Campagnes au niveau
// publicité) : le visuel en grand, le score et ses composantes, l'entonnoir
// leads → R1 tenus → R2 tenus → ventes, les coûts, la recommandation, et les
// clients signés rattachés à cette créa. Si la ligne vient du tableau
// Campagnes (sans entonnoir), le panneau va chercher la créa dans le
// leaderboard de la même période.

import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import apiClient from '../../services/apiClient.js';
import CreativeThumb from './CreativeThumb.jsx';
import Pict from './icons.jsx';
import { Ring, Funnel, Pill, EASE } from './motion.jsx';
import { fmtInt, fmtEur, fmtEur2, fmtRoas, fmtDay, fmtPct } from './theme.js';

const norm = (v) => String(v || '').trim().toLowerCase();

export const RECO_TONE = {
  observer: 'navy', garder: 'muted', decliner: 'green', hook: 'amber', qualif: 'amber', noshow: 'red', couper: 'red',
  scale: 'green', keep: 'muted', variant: 'green', fix_qualification: 'amber', fix_noshow: 'amber', stop: 'red', wait: 'navy',
};
const agoLabel = (iso) => {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins < 1 ? "à l'instant" : mins < 60 ? `il y a ${mins} min` : `il y a ${Math.floor(mins / 60)} h`;
};
export const toneColors = (T, tone) => ({
  green: { color: T.green, bg: T.accentBg },
  navy: { color: T.text, bg: T.track },
  amber: { color: T.amber, bg: T.isDark ? 'rgba(217,163,92,0.16)' : 'rgba(185,138,58,0.12)' },
  red: { color: T.red, bg: T.isDark ? 'rgba(217,123,108,0.16)' : 'rgba(181,84,74,0.10)' },
  muted: { color: T.textMuted, bg: T.surfaceAlt },
}[tone] || { color: T.textMuted, bg: T.surfaceAlt });

export function scoreColor(score, T) {
  if (score == null) return T.textFaint;
  if (score >= 65) return T.green;
  if (score >= 40) return T.primary;
  return T.red;
}

function Block({ T, icon, title, children, sub }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Pict name={icon} size={16} color={T.accent} />
        <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textMuted }}>{title}</h4>
        {sub && <span style={{ fontSize: 11.5, color: T.textFaint }}>{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ T, label, value, strong }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: T.radiusSm, background: T.surfaceAlt }}>
      <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 16, fontWeight: 500, color: strong || T.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

export default function CreativePanel({ row, sales, period, T, jev, onClose }) {
  const reduce = useReducedMotion();
  const [full, setFull] = useState(row);
  const [lookup, setLookup] = useState(false);

  // Ligne sans entonnoir (tableau Campagnes) : on complète depuis le leaderboard.
  useEffect(() => {
    setFull(row);
    if (!row || row.r1_fait != null) return undefined;
    let alive = true;
    setLookup(true);
    apiClient.get(`/api/v1/marketing/meta-ads/leaderboard?since=${period.since}&until=${period.until}`)
      .then((r) => {
        if (!alive) return;
        const hit = (r?.rows || []).find((x) => norm(x.name) === norm(row.name));
        if (hit) setFull({ ...row, ...hit });
      })
      .catch(() => {})
      .finally(() => { if (alive) setLookup(false); });
    return () => { alive = false; };
  }, [row, period]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mine = useMemo(() => (sales?.detail || []).filter((s) => s.attributed_to && norm(s.attributed_to) === norm(row?.name)), [sales, row]);
  if (!row) return null;
  const r = full || row;
  const hasFunnel = r.r1_fait != null;
  const leads = hasFunnel ? Math.max(r.crm_leads || 0, r.leads_meta || 0) : (r.leads ?? r.match ?? 0);
  const active = (r.status || 'active') === 'active';
  const decision = r.jev || null;
  const tone = toneColors(T, decision ? (decision.tone || RECO_TONE[decision.action] || 'muted') : 'muted');
  const subs = !decision && r.subs ? [['Coût par lead', r.subs.cpl], ['Lead → R1 tenu', r.subs.r1], ['R1 → R2', r.subs.r2], ['Closing', r.subs.close], ['Volume', r.subs.vol]] : [];
  const signals = decision ? [
    ['Données suffisantes', decision.signals?.enough_data, true],
    ['Fatigue de la créa', decision.signals?.fatigue, false],
    ['Retours sales négatifs', decision.signals?.sales_feedback_negative, false],
  ] : [];
  const jevStatus = jev?.status;
  const ventesCa = r.ca ?? mine.reduce((s, x) => s + (x.amount || 0), 0);

  return (
    <>
      <motion.div onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(18,27,53,0.34)', zIndex: 80, backdropFilter: 'blur(2px)' }} />
      <motion.aside role="dialog" aria-label={`Détail de la créa ${r.name}`}
        initial={reduce ? { x: 0, opacity: 1 } : { x: 56, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : { x: 56, opacity: 0 }}
        transition={{ duration: 0.36, ease: EASE }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 100vw)', zIndex: 81, background: T.surface, color: T.text,
          boxShadow: '-12px 0 40px rgba(18,27,53,0.18)', overflowY: 'auto', padding: '18px 22px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.accent }}>Créa</span>
          <button onClick={onClose} aria-label="Fermer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surface, color: T.textMuted, cursor: 'pointer' }}>
            <Pict name="close" size={16} />
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <CreativeThumb creative={r.creative} name={r.name} size="fluid" aspect="4 / 3" radius={T.radius} T={T} />
        </div>
        <h3 style={{ margin: '14px 0 4px', fontSize: 19, fontWeight: 500, lineHeight: 1.2 }}>{r.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: T.textMuted }}>
          {r.campaign_name && <span>{r.campaign_name}</span>}
          <Pill T={T} color={active ? T.green : T.textMuted} bg={active ? T.accentBg : T.surfaceAlt}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: active ? T.green : T.textFaint }} />{active ? 'Active' : 'Inactive'}
          </Pill>
          {r.confidence && <Pill T={T}>confiance {r.confidence}</Pill>}
        </div>

        {(r.score != null || lookup) && (
          <Block T={T} icon="score" title={decision ? 'Score Jev' : 'Score'} sub={decision ? `décidé par Jev ${agoLabel(decision.decided_at)}` : (r.score_source === 'rules' && jevStatus === 'ready' ? 'score de repli (règles) : créa non analysée par Jev' : '0 à 100, lissé sur la période')}>
            {lookup && r.score == null ? <div style={{ fontSize: 12.5, color: T.textFaint }}>Recherche dans le leaderboard…</div> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Ring value={(r.score || 0) / 100} size={72} stroke={6} color={scoreColor(r.score, T)} label={Math.round(r.score || 0)} sub="/ 100" T={T} />
                <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                  {decision && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Pill T={T} color={tone.color} bg={tone.bg}>{decision.action_label}</Pill>
                        {decision.confidence != null && <span style={{ fontSize: 11.5, color: T.textMuted }}>confiance {Math.round(decision.confidence * 100)} %</span>}
                      </div>
                      {signals.map(([label, p, positive]) => (
                        <div key={label} title={`Probabilité estimée par Jev : ${Math.round((p || 0) * 100)} % de chances que ce soit vrai`} style={{ display: 'grid', gridTemplateColumns: '132px 1fr 44px', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
                          <span style={{ color: T.textMuted }}>{label}</span>
                          <div style={{ height: 6, borderRadius: 99, background: T.track, overflow: 'hidden' }}>
                            <motion.div initial={reduce ? { scaleX: p || 0 } : { scaleX: 0 }} animate={{ scaleX: Math.max(0.02, p || 0) }} transition={{ duration: 0.7, ease: EASE }}
                              style={{ height: '100%', transformOrigin: 'left center', background: positive ? T.green : ((p || 0) >= 0.5 ? T.amber : T.textFaint), borderRadius: 99 }} />
                          </div>
                          <span style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Math.round((p || 0) * 100)} %</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 10.5, color: T.textFaint, marginTop: 2 }}>Probabilités estimées par Jev</div>
                    </div>
                  )}
                  {subs.map(([label, v]) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 34px', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
                      <span style={{ color: T.textMuted }}>{label}</span>
                      <div style={{ height: 6, borderRadius: 99, background: T.track, overflow: 'hidden' }}>
                        <motion.div initial={reduce ? { scaleX: v } : { scaleX: 0 }} animate={{ scaleX: Math.max(0.02, v || 0) }} transition={{ duration: 0.7, ease: EASE }}
                          style={{ height: '100%', transformOrigin: 'left center', background: T.green, borderRadius: 99 }} />
                      </div>
                      <span style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Math.round((v || 0) * 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Block>
        )}

        <Block T={T} icon="funnel" title="Entonnoir" sub={hasFunnel ? 'leads de la période' : 'leads de la période (détail CRM indisponible)'}>
          {hasFunnel ? (
            <>
              <Funnel T={T} steps={[{ label: 'Leads', value: leads }, { label: 'R1 posés', value: r.r1_pose }, { label: 'R1 tenus', value: r.r1_fait }, { label: 'R2 tenus', value: r.r2_fait }, { label: 'Ventes', value: r.ventes }]} />
              {r.r1_noshow > 0 && <div style={{ marginTop: 8, fontSize: 11.5, color: T.textFaint }}>{fmtInt(r.r1_noshow)} no-show en R1 ({fmtPct((r.r1_noshow / Math.max(1, r.r1_pose)) * 100, 0)} des R1 posés)</div>}
            </>
          ) : (
            <Funnel T={T} steps={[{ label: 'Leads Meta', value: r.leads ?? 0 }, { label: 'Retrouvés CRM', value: r.match ?? 0 }, { label: 'Ventes', value: r.ventes ?? mine.length }]} />
          )}
        </Block>

        <Block T={T} icon="spend" title="Les chiffres">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <Stat T={T} label="Dépense" value={fmtEur(r.spend)} />
            <Stat T={T} label="Coût par lead" value={fmtEur2(r.cpl)} />
            {hasFunnel ? <Stat T={T} label="Coût par R1 tenu" value={fmtEur2(r.cpr1)} /> : <Stat T={T} label="CPM" value={fmtEur2(r.cpm)} />}
            <Stat T={T} label="Ventes" value={fmtInt(r.ventes ?? mine.length)} strong={T.green} />
            <Stat T={T} label="Coût par vente" value={fmtEur(r.cac ?? (r.ventes ? r.spend / r.ventes : null))} />
            <Stat T={T} label="Retour sur dépense" value={fmtRoas(r.roas ?? (r.spend ? ventesCa / r.spend : null))} strong={(r.roas ?? 0) >= 1 ? T.green : undefined} />
          </div>
        </Block>

        <Block T={T} icon="info" title="Décision Jev" sub={decision ? `${decision.model || 'jev'} · ${agoLabel(decision.decided_at)}` : undefined}>
          {decision ? (
            <>
              <div style={{ padding: '12px 14px', borderRadius: T.radiusSm, background: tone.bg }}>
                <div style={{ fontSize: 15, fontWeight: 650, color: tone.color, letterSpacing: '-0.01em' }}>{decision.action_label}</div>
                {decision.guardrail && <div style={{ marginTop: 4, fontSize: 12.5, color: T.textMuted, lineHeight: 1.45 }}>{decision.guardrail}</div>}
                {decision.alternatives?.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: T.textMuted }}>Aussi envisagé : {decision.alternatives.map((a) => `${a.label} (${Math.round(a.p * 100)} %)`).join(' · ')}</div>
                )}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textFaint }}>Ce que Jev a vu</div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 16, display: 'grid', gap: 4 }}>
                {(decision.facts || []).map((f, i) => <li key={i} style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.45 }}>{f}</li>)}
              </ul>
              {jev?.glossary?.length > 0 && (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: T.radiusSm, background: T.surfaceAlt, fontSize: 11.5, color: T.textMuted, lineHeight: 1.5 }}>
                  {jev.glossary.map(([term, def]) => <div key={term}><strong style={{ color: T.text }}>{term}</strong> : {def}</div>)}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: T.textFaint, lineHeight: 1.5 }}>
              {jevStatus === 'pending' ? 'Jev analyse les créas de cette période, la décision arrive dans quelques secondes.'
                : jevStatus === 'ready' ? 'Créa non analysée par Jev sur cette période (au-delà des 80 créas les plus dépensières, ou sans dépense).'
                  : jevStatus === 'unconfigured' ? 'Jev n’est pas configuré sur le serveur.' : 'Décision Jev indisponible pour le moment.'}
            </div>
          )}
        </Block>

        <Block T={T} icon="sales" title="Ventes signées" sub={`${mine.length} sur la période`}>
          {mine.length === 0 ? <div style={{ fontSize: 12.5, color: T.textFaint }}>Aucune vente déclarée rattachée à cette créa sur la période.</div> : (
            <div style={{ display: 'grid', gap: 6 }}>
              {mine.map((s) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 10px', padding: '9px 12px', borderRadius: T.radiusSm, background: T.surfaceAlt }}>
                  <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.client || '—'} <span style={{ color: T.textFaint, fontWeight: 500 }}>{s.numero_client || ''}</span></span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: T.green }}>{fmtEur(s.amount)}</span>
                  <span style={{ fontSize: 11.5, color: T.textFaint }}>{fmtDay(s.date)} · {s.seller || 'vendeur inconnu'}</span>
                </div>
              ))}
            </div>
          )}
        </Block>
      </motion.aside>
    </>
  );
}
