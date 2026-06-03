import React, { useMemo, useState } from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion, AnimatePresence } from 'framer-motion';
import Card from './Card';
import { fmtRelative, fmtParisTime } from '../theme';

// Same source-pill / score-pill rules as the landing's Pipeline.tsx —
// translated to inline-styles. EMAIL_KIND_ORDER is duplicated here for
// position computation.
const EMAIL_KIND_LABELS = {
  email_confirmation: 'Confirmation',
  email_marc_story: 'Marc 15k€',
  email_preview_reveal: 'Preview',
  email_why_concern: 'Pourquoi',
  email_charges_unknown: 'Charges',
  email_j_minus_1: 'J-1',
  email_webinar_morning: 'Matin J',
  email_live_now: 'Live',
  email_postponement: 'Décalage',
  email_broad_invite: 'Broad invite',
  email_live_plus_15: 'Live +15',
};
const EMAIL_KIND_ORDER = [
  'email_confirmation', 'email_postponement', 'email_broad_invite',
  'email_marc_story', 'email_preview_reveal', 'email_why_concern',
  'email_charges_unknown', 'email_j_minus_1', 'email_webinar_morning',
  'email_live_now', 'email_live_plus_15',
];
const TECHNICAL_INTEGRATION_KINDS = new Set(['n8n_webhook', 'meta_capi_lead', 'wazzap_contact']);

function getInitials(prenom, nom) {
  const a = (prenom || '').charAt(0).toUpperCase();
  const b = (nom || '').charAt(0).toUpperCase();
  return (a + b) || '?';
}

function avatarColor(seed) {
  // Stable hash → palette index
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const PALETTE = ['#5b6abf', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
  return PALETTE[h % PALETTE.length];
}

function currentPosition(outbox) {
  const items = (outbox || []).filter((o) => EMAIL_KIND_ORDER.includes(o.kind));
  const sentKinds = new Set(items.filter((o) => o.status === 'sent').map((o) => o.kind));
  const total = EMAIL_KIND_ORDER.length;
  let lastSentIdx = -1;
  EMAIL_KIND_ORDER.forEach((k, idx) => { if (sentKinds.has(k)) lastSentIdx = idx; });
  if (lastSentIdx === -1) return { label: 'Aucun email envoyé', done: 0, total };
  return { label: EMAIL_KIND_LABELS[EMAIL_KIND_ORDER[lastSentIdx]] || '—', done: sentKinds.size, total };
}

function nextEmail(outbox) {
  const sentKinds = new Set((outbox || []).filter((o) => o.status === 'sent').map((o) => o.kind));
  const nxt = EMAIL_KIND_ORDER.find((k) => !sentKinds.has(k) && (outbox || []).some((o) => o.kind === k));
  return nxt ? EMAIL_KIND_LABELS[nxt] || nxt : '—';
}

function SourcePill({ source, C }) {
  if (source === 'meta') {
    return <Pill bg={C.fuchsia.bg} fg={C.fuchsia.fg}>Meta</Pill>;
  }
  if (source === 'broad') {
    return <Pill bg={C.amber.bg} fg={C.amber.fg}>Broad</Pill>;
  }
  return <Pill bg={C.blue.bg} fg={C.blue.fg}>Landing</Pill>;
}

function Pill({ bg, fg, children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 50,
      background: bg,
      color: fg,
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function ScorePill({ score, temperature, C, size = 'sm' }) {
  if (!score || !temperature) return null;
  const tone = temperature === 'hot' ? { bg: C.emerald.bg, fg: C.emerald.fg, icon: '🔥' }
    : temperature === 'warm' ? { bg: C.amber.bg, fg: C.amber.fg, icon: '⚠' }
    : { bg: C.rose.bg, fg: C.rose.fg, icon: '❄' };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: size === 'md' ? '4px 10px' : '2px 8px',
      borderRadius: 50,
      background: tone.bg,
      color: tone.fg,
      fontSize: size === 'md' ? 12 : 10,
      fontWeight: 700,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
    }} title={`Score d'engagement ${score}/10 (${temperature})`}>
      <span aria-hidden>{tone.icon}</span>
      <span>{score}</span>
    </span>
  );
}

/**
 * Leads pipeline — clean table with avatar+initials, source pill, salaries
 * badge, engagement score, position progress bar, next email. Search +
 * sort. Click row to open detail modal.
 */
export default function LeadsPipeline({ leads = [], scoresByLeadId, C, sourceFilter }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(null);
  const hasScores = scoresByLeadId && scoresByLeadId.size > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = !q
      ? leads
      : leads.filter((l) =>
          [l.email, l.prenom, l.nom, l.societe, l.telephone]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q))
        );
    const sorted = [...base];
    if (sortKey === 'score') {
      sorted.sort((a, b) => {
        const sa = scoresByLeadId?.get(a.id)?.score ?? 0;
        const sb = scoresByLeadId?.get(b.id)?.score ?? 0;
        return sortDir === 'asc' ? sa - sb : sb - sa;
      });
    } else {
      sorted.sort((a, b) => {
        const cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return sorted;
  }, [leads, search, sortKey, sortDir, scoresByLeadId]);

  const toggleSort = (k) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const HEADER_CELL = {
    padding: '12px 16px',
    fontSize: 10,
    fontWeight: 700,
    color: C.faded,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    textAlign: 'left',
    background: C.subtle,
    borderBottom: `1px solid ${C.hairline}`,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  };
  const CELL = {
    padding: '12px 16px',
    fontSize: 13,
    color: C.text,
    borderTop: `1px solid ${C.hairline}`,
    verticalAlign: 'middle',
  };

  const HeaderAction = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {sourceFilter}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Rechercher prospect, email, société…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: 260,
            padding: '7px 12px 7px 30px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            fontSize: 12,
            fontWeight: 500,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
    </div>
  );

  return (
    <>
      <Card
        title="Pipeline prospects"
        subtitle={`${leads.length} inscrits dans la fenêtre · clic sur une ligne pour ouvrir le détail`}
        C={C}
        action={HeaderAction}
        noPadding
      >
        <div style={{ maxHeight: 540, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...HEADER_CELL, cursor: 'pointer' }} onClick={() => toggleSort('createdAt')}>
                  Inscrit le {sortKey === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th style={HEADER_CELL}>Prospect</th>
                <th style={HEADER_CELL}>Salariés</th>
                {hasScores && (
                  <th style={{ ...HEADER_CELL, cursor: 'pointer' }} onClick={() => toggleSort('score')}>
                    Score {sortKey === 'score' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                )}
                <th style={HEADER_CELL}>Position</th>
                <th style={HEADER_CELL}>Prochain</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={hasScores ? 6 : 5} style={{ ...CELL, textAlign: 'center', color: C.muted, padding: '40px 16px' }}>
                    Aucun lead dans cette fenêtre.
                  </td>
                </tr>
              )}
              {filtered.map((l) => {
                const pos = currentPosition(l.outbox);
                const score = scoresByLeadId?.get(l.id);
                return (
                  <tr
                    key={l.id}
                    onClick={() => setSelected(l)}
                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.subtle; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ ...CELL, color: C.muted, whiteSpace: 'nowrap' }} title={fmtParisTime(l.createdAt)}>
                      {fmtRelative(l.createdAt)}
                    </td>
                    <td style={CELL}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: avatarColor(l.email || l.id),
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {getInitials(l.prenom, l.nom)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>
                              {l.prenom} {l.nom}
                            </span>
                            <SourcePill source={l.source} C={C} />
                          </div>
                          <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={CELL}>
                      {l.salaries ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          background: parseInt(l.salaries, 10) >= 4 ? C.emerald.bg : C.subtle,
                          color: parseInt(l.salaries, 10) >= 4 ? C.emerald.fg : C.muted,
                        }}>
                          {l.salaries}
                        </span>
                      ) : (
                        <span style={{ color: C.faded }}>—</span>
                      )}
                    </td>
                    {hasScores && (
                      <td style={CELL}>
                        {score ? <ScorePill score={score.score} temperature={score.temperature} C={C} /> : <span style={{ color: C.faded }}>—</span>}
                      </td>
                    )}
                    <td style={CELL}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{pos.label}</div>
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 70, height: 4, background: C.subtle, borderRadius: 50, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(pos.done / pos.total) * 100}%`,
                            height: '100%',
                            background: C.emerald.strong,
                            transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                          }} />
                        </div>
                        <span style={{ fontSize: 10, color: C.faded, fontWeight: 600 }}>
                          {pos.done}/{pos.total}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...CELL, color: C.muted, fontSize: 12, fontWeight: 500 }}>
                      {nextEmail(l.outbox)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {selected && (
          <LeadDetailModal
            lead={selected}
            score={scoresByLeadId?.get(selected.id)}
            C={C}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function LeadDetailModal({ lead, score, C, onClose }) {
  const [techOpen, setTechOpen] = useState(false);
  const sorted = useMemo(() => {
    const arr = [...(lead.outbox || [])];
    arr.sort((a, b) => {
      const ai = EMAIL_KIND_ORDER.indexOf(a.kind);
      const bi = EMAIL_KIND_ORDER.indexOf(b.kind);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
    return arr;
  }, [lead.outbox]);

  const primary = sorted.filter((i) => !TECHNICAL_INTEGRATION_KINDS.has(i.kind));
  const technical = sorted.filter((i) => TECHNICAL_INTEGRATION_KINDS.has(i.kind));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,18,30,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          borderRadius: 20,
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          overflow: 'auto',
          border: `1px solid ${C.hairline}`,
          boxShadow: C.shadowFloat,
        }}
      >
        <div style={{ padding: '24px 28px', borderBottom: `1px solid ${C.hairline}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: C.text,
                  letterSpacing: '-0.02em',
                }}>
                  {lead.prenom} {lead.nom}
                </h2>
                <SourcePill source={lead.source} C={C} />
                {score && <ScorePill score={score.score} temperature={score.temperature} C={C} size="md" />}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted, fontWeight: 500 }}>
                {lead.email} · {lead.telephone}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: C.text, fontWeight: 500 }}>
                <span style={{ color: C.muted }}>Société :</span> {lead.societe || '—'}
                {lead.salaries && <> · <span style={{ color: C.muted }}>Salariés :</span> {lead.salaries}</>}
                {lead.ca && <> · <span style={{ color: C.muted }}>CA :</span> {lead.ca}</>}
              </p>
              {lead.attentes && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {lead.attentes.charges && <Pill bg={C.blue.bg} fg={C.blue.fg}>Charges</Pill>}
                  {lead.attentes.remuneration && <Pill bg={C.blue.bg} fg={C.blue.fg}>Rémunération</Pill>}
                  {lead.attentes.restructuration && <Pill bg={C.blue.bg} fg={C.blue.fg}>Restructuration</Pill>}
                </div>
              )}
              <p style={{ margin: '8px 0 0', fontSize: 11, color: C.faded, fontWeight: 500 }}>
                Inscrit le {fmtParisTime(lead.createdAt)}{lead.consent && ' · Consentement marketing'}
              </p>
              {lead.source === 'meta' && (lead.metaCampaignName || lead.metaAdsetName || lead.metaAdName) && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  background: C.fuchsia.bg,
                  borderRadius: 12,
                  border: `1px solid ${C.fuchsia.bg}`,
                }}>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: C.fuchsia.fg,
                  }}>
                    Attribution Meta
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: C.text, lineHeight: 1.6 }}>
                    {lead.metaPlatform && (<><span style={{ color: C.muted }}>Plateforme :</span> {lead.metaPlatform}<br/></>)}
                    {lead.metaCampaignName && (<><span style={{ color: C.muted }}>Campagne :</span> {lead.metaCampaignName}<br/></>)}
                    {lead.metaAdsetName && (<><span style={{ color: C.muted }}>Adset :</span> {lead.metaAdsetName}<br/></>)}
                    {lead.metaAdName && (<><span style={{ color: C.muted }}>Annonce :</span> {lead.metaAdName}</>)}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: C.subtle,
                border: `1px solid ${C.hairline}`,
                color: C.muted,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Fermer
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 28px 28px' }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.faded,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 14,
          }}>
            Timeline emails & WhatsApp
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {primary.map((item, i) => <TimelineItem key={i} item={item} C={C} />)}
          </div>

          {technical.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setTechOpen((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 14px',
                  background: C.subtle,
                  border: `1px solid ${C.hairline}`,
                  borderRadius: 12,
                  color: C.text,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  Intégrations techniques
                  <span style={{
                    padding: '1px 6px',
                    background: C.surface,
                    borderRadius: 50,
                    fontSize: 10,
                    color: C.muted,
                  }}>{technical.length}</span>
                </span>
                <span style={{ color: C.muted }}>{techOpen ? '▾' : '▸'}</span>
              </button>
              {techOpen && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {technical.map((item, i) => <TimelineItem key={`t-${i}`} item={item} C={C} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function TimelineItem({ item, C }) {
  const statusStyle = item.status === 'sent'
    ? { bg: C.emerald.bg, fg: C.emerald.fg }
    : item.status === 'failed'
      ? { bg: C.rose.bg, fg: C.rose.fg }
      : { bg: C.amber.bg, fg: C.amber.fg };
  return (
    <div style={{
      padding: '10px 14px',
      background: C.subtle,
      border: `1px solid ${C.hairline}`,
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {EMAIL_KIND_LABELS[item.kind] || item.kind}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontWeight: 500 }}>
            {item.status === 'sent'
              ? `Envoyé le ${fmtParisTime(item.sentAt)}`
              : item.status === 'failed'
                ? `Échec après ${item.attempts} tentative(s)`
                : 'En attente'}
          </div>
          {item.lastError && (
            <div style={{ fontSize: 11, color: C.rose.fg, marginTop: 4 }}>
              {item.lastError}
            </div>
          )}
        </div>
        <span style={{
          padding: '3px 9px',
          borderRadius: 50,
          background: statusStyle.bg,
          color: statusStyle.fg,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {item.status}
        </span>
      </div>
      {item.status === 'sent' && (
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <Chip label="Envoyé" active C={C} />
          <Chip label="Délivré" active={!!item.delivered} C={C} />
          <Chip label="Ouvert" active={!!item.opened} tone="emerald" C={C} />
          <Chip label="Cliqué" active={!!item.clicked} tone="emerald" C={C} />
          {item.bounced && <Chip label="Bounce" active tone="rose" C={C} />}
          {item.complained && <Chip label="Spam" active tone="rose" C={C} />}
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, tone, C }) {
  let bg = C.subtle, fg = C.faded;
  if (active) {
    if (tone === 'emerald') { bg = C.emerald.bg; fg = C.emerald.fg; }
    else if (tone === 'rose') { bg = C.rose.bg; fg = C.rose.fg; }
    else { bg = C.surface; fg = C.text; }
  }
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 50,
      background: bg,
      color: fg,
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      border: `1px solid ${active ? bg : C.hairline}`,
    }}>
      {label}
    </span>
  );
}
