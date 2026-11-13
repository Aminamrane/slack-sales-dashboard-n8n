// Carte d'un lead dans la tracking sheet des setters : la ligne « pilule » d'un onglet.
//
// Extraite telle quelle de TrackingSheetSetter.jsx (dev 12/11/2026, « optimiser sans affecter l'aspect visuel »), comme
// LeadCard.jsx pour la sheet des sales : `React.memo`, une carte ne se redessine que si SON lead ou SON état change.
// Tout ce dont la carte dépend passe par ses props ; les fonctions de la sheet arrivent dans `actions` (identité
// stable, voir useStableActions), ses constantes et petits composants dans `kit`.
import React from 'react';
import { awaitsSales } from '../../utils/setterJourney.js';
import { originDisplay } from '../../utils/sectors';
import mynoteIcon from '../../assets/mynote.svg';
import meetIcon from '../../assets/meet.png';

// L'entrée en cascade (40 ms par carte) s'arrête à la hauteur d'un grand écran : au-delà, une carte attendait
// jusqu'à 15 secondes avant d'apparaître sur un onglet de 400 leads.
const STAGGER_MAX = 24;

function SetterLeadCard({
  lead, index, activeCat, origin, C, darkMode, imgDark, isAdminView, isSetter, userRole, userEmail,
  isSelected, isExiting, isHighlighted, isSigning, noteSaved, phoneCopied, remoteFocusColor, hasAnimated,
  wsRef, actions, kit,
}) {
  const { setSelectedLead, setNotesError, setEditingNotes, setCommentLeadId, copyToClipboard, handleDateChange } = actions;
  const { SETTER_ROLES, TimeSelect, getSalesOwnerColor, toDatetimeLocal, formatDate } = kit;
  // Un collègue a cette fiche ouverte : la carte prend sa couleur.
  const isRemoteFocused = remoteFocusColor != null;
  const focusColor = remoteFocusColor || '#6366f1';
  return (
      <div
        key={lead.id}
        id={`lead-card-${lead.id}`}
        style={{
          position: 'relative',
          borderRadius: '14px',
          border: `1px solid ${isHighlighted ? '#f59e0b' : isRemoteFocused ? focusColor : isSelected ? (darkMode ? C.accent + '50' : '#cfc9c0') : (darkMode ? 'rgba(255,255,255,0.06)' : '#ece9e4')}`,
          background: isHighlighted
            ? (darkMode ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)')
            : isRemoteFocused
            ? `${focusColor}15`
            : isSelected
            ? (darkMode ? `${C.accent}12` : '#f4f2ee')
            : (darkMode ? 'rgba(255,255,255,0.04)' : '#faf9f7'),
          boxShadow: isHighlighted
            ? '0 0 0 2px rgba(245,158,11,0.3), 0 4px 12px rgba(245,158,11,0.15)'
            : isRemoteFocused
            ? `0 0 0 2px ${focusColor}40, 0 4px 12px ${focusColor}20`
            : undefined,
          transition: 'all 0.3s ease',
          animation: isSigning
            ? 'signedGlow 0.8s ease both'
            : isExiting
              ? 'cardSlideOut 0.35s cubic-bezier(0.22,1,0.36,1) both'
              : hasAnimated
                ? 'none'
                : `cardStaggerIn 0.5s cubic-bezier(0.34,1.56,0.64,1) ${Math.min(index, STAGGER_MAX) * 40}ms both`,
          cursor: 'pointer',
          overflow: isExiting ? 'hidden' : 'visible',
        }}
        onMouseEnter={(e) => {
          if (!isExiting && !isSelected) {
            e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.3)' : '#ddd8d0';
            e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : '#f4f2ee';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.06)' : '#ece9e4';
            e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : '#faf9f7';
          }
        }}
        onClick={() => {
          if (!isExiting) {
            const newVal = isSelected ? null : lead.id;
            setSelectedLead(newVal);
            // Broadcast lead focus to other WS users
            if (wsRef.current && wsRef.current.readyState === 1) {
              wsRef.current.send(JSON.stringify({ type: 'lead_focus', lead_id: newVal ? String(newVal) : null }));
            }
          }
        }}
      >

        {/* ═══ NOTE STICKER ═══ */}
        {lead.notes && lead.notes.trim() && (
          <img
            src={mynoteIcon}
            alt="Note"
            style={{
              position: 'absolute',
              top: -7,
              left: -14,
              width: 50,
              height: 50,
              objectFit: 'contain',
              pointerEvents: 'auto',
              zIndex: 2,
              filter: darkMode ? `${imgDark} drop-shadow(0 1px 3px rgba(0,0,0,0.4))` : 'drop-shadow(0 1px 3px rgba(0,0,0,0.12))',
              transition: 'transform 0.2s ease',
              cursor: 'pointer',
              ...(noteSaved ? { animation: 'noteStickIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both' } : {}),
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            // Le commentaire à un clic depuis la ligne (comme chez les sales) : la note ouvre directement la fenêtre de
            // commentaire ; en consultation d'une autre feuille, le clic ouvre la fiche, où la note se lit.
            title="Ouvrir le commentaire"
            onClick={(e) => {
              if (isAdminView) return;
              e.stopPropagation();
              setNotesError(null);
              setEditingNotes(prev => ({ ...prev, [lead.id]: prev[lead.id] ?? lead.notes ?? '' }));
              setCommentLeadId(lead.id);
            }}
          />
        )}

        {/* ═══ PILL VIEW ═══ */}
        <div
          id={`lead-pill-${lead.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '11px 18px',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {/* Category color dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: activeCat.dotColor || activeCat.color,
            flexShrink: 0,
          }} />

          {/* Name */}
          <span style={{
            fontSize: '14px',
            fontWeight: 500,
            color: isSelected ? C.accent : C.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: '60px',
            maxWidth: 240,
            flexShrink: 0,
            letterSpacing: '-0.01em',
            transition: 'color 0.2s ease',
          }}>
            {lead.full_name}
          </span>

          {/* Origin badge (sales/admin) — Sales owner first name (setter) */}
          {isSetter ? (() => {
            // Ancien webinaire sans commercial (dev 12/11/2026) : l'origine à la place du prénom du sales.
            const waiting = awaitsSales(lead);
            const ownerColor = waiting ? '#8b5cf6' : getSalesOwnerColor(lead.assigned_to);
            const firstName = waiting ? 'Ancien webinaire' : (lead.assigned_to_name?.split(' ')[0] || '—');
            return (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 7,
                fontSize: 11, fontWeight: 500,
                background: darkMode ? `${ownerColor}26` : `${ownerColor}14`,
                color: ownerColor,
                border: `1px solid ${ownerColor}40`,
                flexShrink: 0,
                letterSpacing: '-0.005em',
              }}
                title={waiting ? 'Ancien webinaire : sans commercial, affecté ensuite dans Gestion des leads' : (lead.assigned_to_name || '')}
              >
                {firstName}
              </span>
            );
          })() : (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: '50px',
              fontSize: '10px', fontWeight: 500,
              background: origin.bg, color: origin.text,
              flexShrink: 0,
            }}>
              {originDisplay(lead.origin, lead.cc_sector)}
            </span>
          )}

          {/* Mode MANUEL — badge "donné par [sales]" sur les leads donnés explicitement */}
          {isSetter && lead.manual_setter_id && (
            <span title={`Donné par ${lead.assigned_to_name || 'votre sales'}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 7px', borderRadius: 7, fontSize: 10.5, fontWeight: 500, flexShrink: 0,
              background: darkMode ? '#262626' : '#f1eee9',
              color: darkMode ? '#a3a3a3' : '#4a4540', border: `1px solid ${darkMode ? '#3a3a3a' : '#e3ded6'}`,
            }}>
              donné par {lead.assigned_to_name?.split(' ')[0] || 'sales'}
            </span>
          )}

          {/* Compact info pills */}
          <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
          <span
            onClick={(e) => { e.stopPropagation(); copyToClipboard(lead.phone, `phone-card-${lead.id}`); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', color: phoneCopied ? '#10b981' : C.secondary, fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500, flexShrink: 0, cursor: lead.phone ? 'pointer' : 'default', borderRadius: 6, padding: '1px 5px', margin: '-1px -5px', transition: 'color 0.2s, background 0.15s' }}
            onMouseEnter={(e) => { if (lead.phone) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title={lead.phone ? 'Copier le numéro' : ''}
          >
            {phoneCopied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.45 }}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
            {phoneCopied ? (
              <span style={{ fontSize: 10, fontWeight: 500, color: '#10b981', fontFamily: 'inherit', animation: 'copiedToastIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>Copié</span>
            ) : lead.phone}
          </span>
          {lead.headcount && !SETTER_ROLES.includes(userRole) && (
            <>
              <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: C.muted, flexShrink: 0 }}>
                <span style={{ fontWeight: 500, color: C.text }}>{lead.headcount}</span> sal.
              </span>
            </>
          )}
          {lead.company_name && (
            <>
              <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: C.secondary, fontWeight: 500, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.company_name}
              </span>
            </>
          )}
          {lead.sector && (
            <>
              <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', fontWeight: 500, color: C.accent, flexShrink: 0 }}>
                {lead.sector}
              </span>
            </>
          )}

          {/* Google Meet link */}
          {(lead.r1_meet_link || lead.r2_meet_link) && (
            <>
              <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
              <a
                href={lead.r2_meet_link || lead.r1_meet_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Rejoindre le Google Meet"
                style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, borderRadius: 6, padding: '2px 4px', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <img src={meetIcon} alt="Meet" style={{ width: 18, height: 18, objectFit: 'contain' }} />
              </a>
            </>
          )}


          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* SMS count badge */}
          {lead.sms_count > 0 && (
            <span title={`${lead.sms_count} SMS envoyé${lead.sms_count > 1 ? 's' : ''}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 7, fontSize: 10.5, fontWeight: 500, flexShrink: 0,
              background: darkMode ? 'rgba(16,185,129,0.15)' : '#e2f6ea',
              color: darkMode ? '#10b981' : '#0b7a4b', border: `1px solid ${darkMode ? 'rgba(16,185,129,0.2)' : '#c3ebd3'}`,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {lead.sms_count}
            </span>
          )}

          {/* Résultat du rendez-vous : une étiquette pastel à point (comme sur la feuille des sales : plus d'emoji ni de
              pilule vive). Les mots et les conditions d'affichage des setters ne changent pas. */}
          {((activeCat.key === 'r1' && lead.r1_result) || (activeCat.key === 'r2' && lead.r2_result)) && (() => {
            const stage = activeCat.key.toUpperCase();
            const RESULT_TAGS = activeCat.key === 'r1'
              ? { no_show: ['jaune', 'Lapin'], rescheduled: ['peche', 'Reporté'], to_reschedule: ['beige', 'À reporter'], done: ['vert', `${stage} effectué`], cancelled: ['rouge', 'Annulé'] }
              : { done: ['vert', `${stage} effectué`], comptable: ['bleu', 'Comptable'], associe: ['bleu', 'Associé'], reflexion: ['bleu', 'Réflexion'], relire_contrat: ['bleu', 'Relire contrat'],
                  pas_decision_jour: ['beige', 'Pas de décision'], tresorerie: ['jaune', 'Trésorerie'], reporte: ['peche', 'Reporté'], a_reporter: ['beige', 'À reporter'],
                  pas_interesse: ['rouge', 'Pas intéressé'], annule: ['rouge', 'Annulé'] };
            const tag = RESULT_TAGS[lead[`${activeCat.key}_result`]];
            if (!tag) return null;
            const tone = (darkMode
              ? { vert: ['rgba(16,185,129,.14)', '#7cc49b', 'rgba(16,185,129,.25)'], rouge: ['rgba(239,68,68,.14)', '#f3a6a3', 'rgba(239,68,68,.26)'], jaune: ['rgba(234,179,8,.14)', '#e3c76a', 'rgba(234,179,8,.26)'],
                  peche: ['rgba(251,146,60,.14)', '#e8a877', 'rgba(251,146,60,.26)'], bleu: ['rgba(59,130,246,.14)', '#8fb8ee', 'rgba(59,130,246,.26)'], beige: ['#262626', '#a3a3a3', '#3a3a3a'] }
              : { vert: ['#e2f6ea', '#0b7a4b', '#c3ebd3'], rouge: ['#fde6e6', '#c5221f', '#f6caca'], jaune: ['#fbf1c2', '#7a5a05', '#f0e09a'],
                  peche: ['#fde9da', '#c2500e', '#f8d4ba'], bleu: ['#e4f0fd', '#1b6fd0', '#c9e0fa'], beige: ['#f1eee9', '#4a4540', '#e3ded6'] })[tag[0]];
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '2px 8px', borderRadius: 7, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
                background: tone[0], color: tone[1], border: `1px solid ${tone[2]}` }}>
                <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />{tag[1]}
              </span>
            );
          })()}

          {/* Call timestamps (voicemail/callback). Two pills side-by-side:
              "1er" = first_call_at (existing, now shows date + time) in indigo,
              "Dernier" = last_call_at (new field) in teal. The sales rep
              needs to know when they last tried — not just the first attempt.
              Côté setter : pas affiché sur la card (lead plié), mais conservé
              dans le panel détail (cf. l.~5257). Le setter priorise l'info
              "à qui appartient le lead" sur les rappels historiques. */}
          {!isSetter && (activeCat.key === 'voicemail' || activeCat.key === 'callback') && lead.first_call_at && (() => {
            const d = new Date(lead.first_call_at);
            const dd = String(d.getDate()).padStart(2, '0');
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return (
              <span title={`Premier appel : ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${hh}h${mi}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 500, flexShrink: 0,
                background: darkMode ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)',
                color: '#6366f1',
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                1er {dd}/{mo} {hh}h{mi}
              </span>
            );
          })()}
          {!isSetter && (activeCat.key === 'voicemail' || activeCat.key === 'callback') && lead.last_call_at && lead.last_call_at !== lead.first_call_at && (() => {
            // Hide "Dernier" when it equals "1er" — avoids the redundant
            // case after a single call (or on backfilled historical rows
            // where backend set last = first). Absence carries meaning:
            // no "Dernier" pill ⇒ rep has only called once.
            const d = new Date(lead.last_call_at);
            const dd = String(d.getDate()).padStart(2, '0');
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return (
              <span title={`Dernier appel : ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${hh}h${mi}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 500, flexShrink: 0,
                background: darkMode ? 'rgba(20,184,166,0.14)' : 'rgba(20,184,166,0.08)',
                color: '#14b8a6',
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Dernier {dd}/{mo} {hh}h{mi}
              </span>
            );
          })()}

          {/* Anti-spam : badge "Setter <nom> ×N" affiché en voicemail/callback
              quand un setter a déjà rappelé ce lead, pour éviter un double
              appel par le sales propriétaire. Lecture seule, aucun handler.
              Champs sources : `setter_called_by_name` (fallback `setter_called_by`,
              puis 'Setter') + `setter_call_count`. */}
          {(activeCat.key === 'voicemail' || activeCat.key === 'callback')
            && (lead.setter_called_by_name || lead.setter_called_by) && (() => {
            const setterName = lead.setter_called_by_name || lead.setter_called_by || 'Setter';
            const cnt = Number(lead.setter_call_count || 0);
            const tooltipParts = [`Setter : ${setterName}`];
            if (cnt > 0) tooltipParts.push(`Tentatives setter : ${cnt}`);
            if (lead.setter_called_at) {
              try {
                const sd = new Date(lead.setter_called_at);
                const sdd = String(sd.getDate()).padStart(2, '0');
                const smo = String(sd.getMonth() + 1).padStart(2, '0');
                const shh = String(sd.getHours()).padStart(2, '0');
                const smi = String(sd.getMinutes()).padStart(2, '0');
                tooltipParts.push(`Dernier appel setter : ${sdd}/${smo} ${shh}h${smi}`);
              } catch { /* date illisible : l'infobulle se passe de cette précision */ }
            }
            return (
              <span title={tooltipParts.join(' • ')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 7px', borderRadius: 7, fontSize: 10.5, fontWeight: 500, flexShrink: 0,
                background: darkMode ? 'rgba(251,146,60,.14)' : '#fde9da',
                color: darkMode ? '#e8a877' : '#c2500e',
                border: `1px solid ${darkMode ? 'rgba(251,146,60,.26)' : '#f8d4ba'}`,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l18-5v12L3 14v-3z" />
                  <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                </svg>
                Setter {setterName}{cnt > 1 ? ` ×${cnt}` : ''}
              </span>
            );
          })()}

          {/* Coordination multi-setters : "Pris par <setter(s)>" — les AUTRES
              setters (email != le mien) ayant déjà appelé ce lead
              (lead.treated_by_setters, brique 2). Affiché sur TOUS les onglets
              (y compris Répondeurs / À rappeler) pour un indicateur solide partout ;
              coexiste avec le badge anti-spam (qui montre le dernier appelant). */}
          {isSetter && Array.isArray(lead.treated_by_setters) && (() => {
            const myEmailLower = (userEmail || '').toLowerCase();
            const others = lead.treated_by_setters.filter(e => e?.email && e.email.toLowerCase() !== myEmailLower);
            if (others.length === 0) return null;
            const names = others.map(e => e.name || e.email).join(', ');
            return (
              <span title={`Déjà appelé par : ${names}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 7px', borderRadius: 7, fontSize: 10.5, fontWeight: 500, flexShrink: 0,
                background: darkMode ? 'rgba(251,146,60,.14)' : '#fde9da',
                color: darkMode ? '#e8a877' : '#c2500e',
                border: `1px solid ${darkMode ? 'rgba(251,146,60,.26)' : '#f8d4ba'}`,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l18-5v12L3 14v-3z" />
                  <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                </svg>
                Pris par {names}
              </span>
            );
          })()}

          {/* Right side indicators (la note a déjà son papier collé sur la ligne) */}
          {(lead.r1 || lead.r2) && (
            <span style={{
              fontSize: '10px', fontWeight: 500,
              padding: '2px 7px', borderRadius: 7,
              background: lead.r2 ? (darkMode ? 'rgba(251,146,60,0.12)' : 'rgba(251,146,60,0.08)') : (darkMode ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)'),
              color: lead.r2 ? '#fb923c' : '#3b82f6',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              {lead.r2 ? 'R2' : 'R1'} {String(formatDate(lead.r2 || lead.r1) || '').replace(/ \d{4}$/, '')}
            </span>
          )}
          <span style={{
            fontSize: '11px', color: C.muted, flexShrink: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
          }} title={formatDate(lead.assigned_at)}>
            {String(formatDate(lead.assigned_at) || '').replace(/ \d{4}$/, '')}
          </span>

          {/* Selection chevron */}
          <span style={{
            fontSize: '12px', color: isSelected ? C.accent : C.muted, flexShrink: 0,
            transition: 'color 0.2s ease',
            display: 'flex', alignItems: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>

        {/* Signing animation overlay */}
        {isSigning && (
          <div style={{
            position: 'absolute', bottom: 8, right: 12, zIndex: 10,
            pointerEvents: 'none', animation: 'signatureFade 1.1s ease-in both',
          }}>
            <svg width="60" height="24" viewBox="0 0 90 36" fill="none">
              <path d="M5 28 C 12 8, 18 32, 26 16 S 34 4, 42 20 Q 50 34, 58 14 C 64 6, 70 26, 80 10"
                stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" fill="none"
                strokeDasharray="200" strokeDashoffset="0"
                style={{ animation: 'signatureStroke 0.8s ease-out both' }} />
            </svg>
          </div>
        )}

        {/* Date de rappel (bucket 'callback' uniquement) — champ structure
            callback_at, ecrase la date saisie precedemment dans les notes.
            2026-06-04 : remplacement input datetime-local (qui affichait
            un format AM/PM en US selon browser locale) par 2 inputs séparés
            date + heure custom. Cohérent avec le pattern R1/R2 et le
            workflow inline "À rappeler" du panel détail. */}
        {activeCat.key === 'callback' && (() => {
          const hasDate = !!lead.callback_at;
          const cur = toDatetimeLocal(lead.callback_at);
          const datePart = cur ? cur.slice(0, 10) : '';
          const timePart = cur ? cur.slice(11, 16) : '';  // pas de défaut 10:00 tant qu'aucune vraie date
          const setComposite = (newDate, newTime) => {
            if (!newDate) { handleDateChange(lead.id, 'callback_at', null); return; }
            // Heure 10:00 par défaut UNIQUEMENT au moment où le setter saisit une date
            handleDateChange(lead.id, 'callback_at', `${newDate}T${newTime || '10:00'}`);
          };
          return (
            <div onClick={(e) => e.stopPropagation()} style={{
              padding: '6px 12px 8px',
              borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
              background: darkMode ? 'rgba(148,163,184,0.04)' : 'rgba(148,163,184,0.03)',
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Rappeler le</span>
              <input
                type="date"
                value={datePart}
                onChange={(e) => setComposite(e.target.value, timePart)}
                style={{
                  padding: '4px 8px', borderRadius: 6,
                  border: hasDate ? `1px solid ${C.border}` : `1px dashed ${C.muted}`,
                  background: hasDate ? (darkMode ? C.bg : '#fff') : 'transparent',
                  color: hasDate ? C.text : C.muted,
                  fontSize: 12, fontFamily: 'inherit', outline: 'none',
                  opacity: hasDate ? 1 : 0.7,
                }}
              />
              {hasDate ? (
                <>
                  <div style={{ minWidth: 78 }}>
                    <TimeSelect
                      value={timePart}
                      onChange={(t) => setComposite(datePart, t)}
                      C={C}
                      darkMode={darkMode}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDateChange(lead.id, 'callback_at', null); }}
                    title="Effacer la date de rappel"
                    style={{
                      padding: '4px 8px', borderRadius: 6,
                      border: 'none', background: 'transparent',
                      color: C.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                    }}
                  >Effacer</button>
                </>
              ) : (
                <span style={{ fontSize: 11, fontStyle: 'italic', color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 4, opacity: 0.85 }}>
                  à définir · voir commentaire
                </span>
              )}
            </div>
          );
        })()}

      </div>
  );
}

export default React.memo(SetterLeadCard);
