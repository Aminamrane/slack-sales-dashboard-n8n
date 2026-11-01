import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Onglet « Setters » du Suivi des ventes (dev 31/10/2026) : classement des setters du mois sur les RDV posés, les RDV
// qualifiés et les ventes, avec le détail par provenance au clic. Les règles de calcul sont celles du back
// (GET /api/v1/leaderboard/setters) ; la bulle « i » les résume.
const EASE = [0.22, 1, 0.36, 1];

const RULES = [
  ['RDV posés', 'premières poses du mois ; une reprogrammation ne compte pas, une reprise Seconde chance oui'],
  ['Qualifiés', 'RDV honorés, d\'après le résultat saisi par le sales'],
  ['Ventes', 'ventes du mois (mois de signature) d\'une personne à qui le setter a posé un RDV avant la signature'],
  ['Webinaire', 'pré-webinaire, pendant le live (3 h), post-webinaire ; rappel quand le webinaire date d\'un mois précédent'],
  ['Lien global', 'RDV pris sur le lien du webinaire, à aucun setter'],
];

function Pill({ children, darkMode }) {
  return (
    <div style={{
      display: 'inline-block', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em',
      color: darkMode ? '#9ca3b8' : '#464b65', padding: '8px 18px',
      background: darkMode ? '#2a2b36' : '#dfdfe5', borderRadius: '14px',
      border: darkMode ? '1px solid #353647' : '1px solid #c3c3c3',
      borderBottom: darkMode ? '1px solid #252636' : '1px solid #a5a5a5',
      boxShadow: darkMode
        ? 'inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -3px 4px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.25)'
        : 'inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 4px #d0d1d8, 0 3px 6px rgba(0,0,0,0.1)',
      userSelect: 'none',
    }}>{children}</div>
  );
}

function RulesBubble({ card }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" aria-label="Règles de calcul" onClick={() => setOpen(o => !o)} style={{
        width: 22, height: 22, borderRadius: '50%', border: `1px solid ${card.border}`, background: card.bg,
        color: card.secondary, fontSize: 12, fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic',
        cursor: 'pointer', lineHeight: '20px', padding: 0,
      }}>i</button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.22, ease: EASE }}
            style={{
              position: 'absolute', top: 30, left: 0, zIndex: 20, width: 340, padding: '14px 16px',
              background: card.bg, border: `1px solid ${card.border}`, borderRadius: 12, boxShadow: card.shadow,
              display: 'grid', gap: 9,
            }}>
            {RULES.map(([title, body]) => (
              <div key={title} style={{ fontSize: 12, lineHeight: 1.45, color: card.secondary }}>
                <span style={{ fontWeight: 700, color: card.text }}>{title}</span> · {body}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

const COLS = '52px minmax(0, 1fr) 92px 92px 72px';

function Header({ card, first }) {
  const th = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: card.muted, fontWeight: 600 };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '8px 4px',
      borderBottom: `1px solid ${card.border}` }}>
      <span style={{ ...th, textAlign: 'center' }}>{first}</span>
      <span style={th}>{first === '#' ? 'Setter' : ''}</span>
      <span style={{ ...th, textAlign: 'right' }}>RDV posés</span>
      <span style={{ ...th, textAlign: 'right' }}>Qualifiés</span>
      <span style={{ ...th, textAlign: 'right' }}>Ventes</span>
    </div>
  );
}

function Figures({ row, card, strong }) {
  const cell = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  return (
    <>
      <span style={{ ...cell, fontSize: 13, fontWeight: 500, color: card.secondary }}>{row.rdv}</span>
      <span style={{ ...cell, fontSize: 13, fontWeight: 500, color: card.secondary }}>{row.qualified}</span>
      <span style={{ ...cell, fontSize: strong ? 15 : 13, fontWeight: strong ? 700 : 600, color: card.text }}>{row.sales}</span>
    </>
  );
}

function Medal({ rank, medals, card }) {
  const img = [medals.first, medals.second, medals.third][rank - 1];
  return img
    ? <img src={img} alt={`${rank}`} style={{ width: 28, height: 28, justifySelf: 'center' }} />
    : <span style={{ color: card.muted, fontWeight: 500, fontSize: 12, textAlign: 'center' }}>{rank}</span>;
}

function Avatar({ person, darkMode }) {
  const initials = (person.name || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return person.avatar_url
    ? <img src={person.avatar_url} className="avatar" alt="" />
    : (
      <span className="avatar" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
        background: darkMode ? '#2a2b36' : '#e4e8f2', color: darkMode ? '#9ca3b8' : '#5b6380',
      }}>{initials}</span>
    );
}

function Chevron({ open, card }) {
  return (
    <motion.svg width="10" height="10" viewBox="0 0 10 10" animate={{ rotate: open ? 90 : 0 }}
      transition={{ duration: 0.25, ease: EASE }} style={{ flex: 'none', color: card.muted }}>
      <path d="M3.5 1.5 7 5l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  );
}

function SetterRow({ setter, index, open, onToggle, card, darkMode, medals }) {
  const clickable = setter.by_provenance.length > 0;
  const first = setter.rank === 1 && setter.sales + setter.rdv > 0;
  return (
    <motion.div layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 12) * 0.035 }}
      style={{ borderBottom: `1px solid ${darkMode ? '#2a2b36' : '#eef1f6'}` }}>
      <div onClick={clickable ? onToggle : undefined} role={clickable ? 'button' : undefined}
        aria-expanded={clickable ? open : undefined} className="setters-board__row"
        style={{
          display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '8px 4px', borderRadius: 8,
          cursor: clickable ? 'pointer' : 'default', fontWeight: first ? 600 : 400,
          background: open ? (darkMode ? '#252636' : '#f4f6fb') : first ? 'rgba(91, 106, 191, 0.06)' : 'transparent',
          transition: 'background-color .2s ease',
        }}>
        <Medal rank={setter.rank} medals={medals} card={card} />
        <span className="name-cell" style={{ minWidth: 0 }}>
          <span className="avatar-wrap"><Avatar person={setter} darkMode={darkMode} /></span>
          <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{setter.name}</span>
          {clickable && <Chevron open={open} card={card} />}
        </span>
        <Figures row={setter} card={card} strong />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: EASE }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '2px 4px 10px' }}>
              {setter.by_provenance.map((p, i) => (
                <motion.div key={p.key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, ease: EASE, delay: 0.04 + i * 0.03 }} style={{ padding: '4px 0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center' }}>
                    <span />
                    <span style={{ fontSize: 12.5, color: card.secondary, paddingLeft: 46 }}>{p.label}</span>
                    <Figures row={p} card={card} />
                  </div>
                  {p.origins?.length > 0 && <OriginLines origins={p.origins} card={card} indent={56} />}
                  {p.clients?.length > 0 && <ClientLines clients={p.clients} card={card} darkMode={darkMode} />}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const shortDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' });

// Clients signés d'une provenance (dev 31/10/2026 : « savoir qui est ce client ») ; le back ne les envoie qu'aux
// admins et au CEO. Une vente comptée sur son seul contrat signé, pas encore déclarée, porte une pastille.
function ClientLines({ clients, card, darkMode }) {
  return clients.map((c, i) => (
    <div key={`${c.client}-${c.signed_at}-${i}`} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center',
      padding: '2px 0' }}>
      <span />
      <span style={{ fontSize: 12, color: card.text, paddingLeft: 58, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: card.muted, flex: 'none' }} />
        <span title={c.client || undefined} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.client || 'Client sans nom'}</span>
      </span>
      <span style={{ gridColumn: '3 / 6', textAlign: 'right', fontSize: 11.5, color: card.muted, whiteSpace: 'nowrap',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
        {!c.declared && (
          <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
            color: darkMode ? '#fbbf77' : '#b45309', background: darkMode ? 'rgba(251,191,119,0.12)' : '#fef3c7' }}>
            Non déclarée
          </span>
        )}
        {[c.sales_name, shortDate(c.signed_at)].filter(Boolean).join(' · ')}
      </span>
    </div>
  ));
}

// Origine des leads repris en Seconde chance (dev 31/10/2026 : « il faut bien avoir l'origine ») : leads ads, cold call
// des sales, CCS, webinaire, LinkedIn, ou l'origine écrite sur la fiche.
function OriginLines({ origins, card, indent }) {
  return origins.map((o) => (
    <div key={o.label} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '2px 0' }}>
      <span />
      <span style={{ fontSize: 12, color: card.secondary, paddingLeft: indent, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 1, background: card.muted, flex: 'none' }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
      </span>
      {[o.rdv, o.qualified, o.sales].map((n, i) => (
        <span key={i} style={{ textAlign: 'right', fontSize: 12, color: card.muted, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      ))}
    </div>
  ));
}

function ProvenanceTable({ rows, card, darkMode, title }) {
  return (
    <div>
      {title && (
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: card.muted, fontWeight: 600,
          padding: '18px 4px 6px 56px' }}>{title}</div>
      )}
      {rows.map((p, i) => (
        <motion.div key={p.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE, delay: i * 0.03 }}
          style={{ padding: '8px 4px', borderBottom: `1px solid ${darkMode ? '#2a2b36' : '#eef1f6'}`,
            opacity: p.rdv || p.sales ? 1 : 0.45 }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center' }}>
            <span />
            <span style={{ fontSize: 13, fontWeight: 500, color: card.text }}>{p.label}</span>
            <Figures row={p} card={card} />
          </div>
          {p.origins?.length > 0 && (
            <div style={{ paddingTop: 4 }}><OriginLines origins={p.origins} card={card} indent={10} /></div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export default function SettersBoard({ data, darkMode, card, medals }) {
  const [openId, setOpenId] = useState(null);
  useEffect(() => { setOpenId(null); }, [data?.month]);

  if (!data) return <p style={{ textAlign: 'center', color: card.muted }}>Chargement…</p>;
  if (data.error) return <p style={{ textAlign: 'center', color: card.muted }}>Classement des setters indisponible.</p>;

  const active = data.setters.filter(s => s.rdv || s.sales);
  const idle = data.setters.filter(s => !s.rdv && !s.sales);
  const globalRows = data.global_link?.provenances || [];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', maxWidth: '1400px', margin: '0 auto',
      padding: '0 20px', alignItems: 'start' }} className="setters-board">
      <div>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Pill darkMode={darkMode}>Classement Setters</Pill>
          <RulesBubble card={card} />
        </div>
        <div className="leaderboard-wrapper" style={{ margin: 0, textAlign: 'left' }}>
          <Header card={card} first="#" />
          {active.length === 0 && (
            <p style={{ textAlign: 'center', color: card.muted, fontSize: 13, padding: '18px 0' }}>Aucun RDV de setter ce mois-ci.</p>
          )}
          {[...active, ...idle].map((s, i) => (
            <SetterRow key={s.id} setter={s} index={i} open={openId === s.id} card={card} darkMode={darkMode}
              medals={medals} onToggle={() => setOpenId(id => (id === s.id ? null : s.id))} />
          ))}
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 12 }}><Pill darkMode={darkMode}>Par provenance</Pill></div>
        <div className="leaderboard-wrapper" style={{ margin: 0, textAlign: 'left' }}>
          <Header card={card} first="" />
          <ProvenanceTable rows={data.provenances} card={card} darkMode={darkMode} />
          {(data.global_link?.rdv > 0 || data.global_link?.sales > 0) && (
            <ProvenanceTable rows={globalRows} card={card} darkMode={darkMode} title="Lien global du webinaire · sans setter" />
          )}
          {data.landing !== 'ok' && (
            <p style={{ fontSize: 11.5, color: card.muted, padding: '10px 4px 0' }}>
              Inscriptions au webinaire indisponibles : pré et post-webinaire estimés sur le dernier live.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
