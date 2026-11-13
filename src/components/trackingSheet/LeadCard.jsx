// Carte d'un lead dans la tracking sheet des sales : la ligne « pilule » d'un onglet.
//
// Extraite telle quelle de TrackingSheet.jsx (dev 12/11/2026, « optimiser sans affecter l'aspect visuel ») : la sheet
// est un seul grand composant, et chaque changement d'état (curseur d'un collègue, saisie, rafraîchissement des
// 30 secondes) redessinait toutes les cartes de l'onglet, soit plusieurs centaines. `React.memo` : une carte ne se
// redessine que si SON lead ou SON état change. Le rendu est le même, au pixel près.
//
// Règle pour la suite : tout ce dont la carte dépend passe par ses props. Une valeur par carte arrive en booléen
// (`isSelected`, `isHighlighted`…), jamais en état global de la sheet, sinon toutes les cartes se redessinent.
// Les fonctions de la sheet arrivent dans `actions` (identité stable, voir useStableActions).
import React from 'react';
import { TransferTag } from '../leadTransfer/LeadTransfer.jsx';
import { parisParts } from '../../utils/parisDates';
import { originDisplay } from '../../utils/sectors';
import { formatLeadDate as formatDate } from './leadDate.js';
import mynoteIcon from '../../assets/mynote.svg';
import meetIcon from '../../assets/meet.png';

// L'entrée en cascade (40 ms par carte) s'arrête à la hauteur d'un grand écran : au-delà, une carte attendait
// jusqu'à 15 secondes avant d'apparaître sur un onglet de 400 leads, et la liste restait vide en défilant.
const STAGGER_MAX = 24;

function LeadCard({
  lead, index, activeCat, origin, C, darkMode, imgDark, isAdminView,
  isSelected, isExiting, isHighlighted, isSigning, noteSaved, phoneCopied, remoteFocusColor,
  wsRef, actions,
}) {
  const { setSelectedLead, setNotesError, setEditingNotes, setCommentLeadId, copyToClipboard, isGuidedLead } = actions;
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
            // Le commentaire à un clic depuis la ligne (11/11/2026) : sur un lead du parcours guidé, la note ouvre
            // directement la fenêtre de commentaire ; sinon le clic ouvre la fiche, où la note se lit et se modifie.
            title="Ouvrir le commentaire"
            tabIndex={0}
            onClick={(e) => {
              if (isAdminView || !isGuidedLead(lead)) return;
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
          {/* Ligne allégée (dev 11/11/2026) : nom, société, origine, téléphone ; effectif et secteur se lisent dans la
              fiche de droite, la date perd son année, le SMS reçu n'est plus qu'une pastille à compteur. */}
          {lead.company_name && (
            <span style={{ fontSize: 12.5, color: C.muted, minWidth: 0, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.company_name}
            </span>
          )}

          {/* Origin badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 8px', borderRadius: '50px',
            fontSize: '10px', fontWeight: 500,
            background: origin.bg, color: origin.text,
            flexShrink: 0,
          }}>
            {originDisplay(lead.origin, lead.cc_sector)}
          </span>
          {/* Lead reçu d'un collègue : la mention, discrète. */}
          <TransferTag lead={lead} darkMode={darkMode} compact />

          {/* Compact info pills */}
          <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
          <span
            onClick={(e) => { e.stopPropagation(); copyToClipboard(lead.phone, `phone-card-${lead.id}`, lead.id); }}
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

          {/* Badge "issu des répondeurs communs" */}
          {lead.from_common_pool && (
            <span title="Récupéré depuis le pool des répondeurs communs" style={{
              display: 'inline-flex', alignItems: 'center', flexShrink: 0,
              padding: '2px 9px', borderRadius: 50, fontSize: 10, fontWeight: 500,
              background: darkMode ? 'rgba(6,182,212,0.16)' : 'rgba(6,182,212,0.1)',
              color: '#0891b2', border: '1px solid rgba(6,182,212,0.25)',
            }}>issu des répondeurs</span>
          )}

          {/* Résultat du rendez-vous : une étiquette pastel à point, aux mots des fenêtres de qualification, R3 compris
              (audit 11/11/2026 : plus d'emoji ni de pilule vive, et le même vocabulaire que la fenêtre). */}
          {['r1', 'r2', 'r3'].includes(activeCat.key) && lead[`${activeCat.key}_result`] && (() => {
            const stage = activeCat.key.toUpperCase();
            const RESULT_TAGS = {
              done: ['vert', `${stage} effectué`], no_show: ['jaune', 'Client absent'],
              rescheduled: ['peche', 'Reporté'], reporte: ['peche', 'Reporté'], to_reschedule: ['beige', 'À reprogrammer'], a_reporter: ['beige', 'À reprogrammer'],
              cancelled: ['rouge', 'Annulé'], annule: ['rouge', 'Annulé'], pas_interesse: ['rouge', 'Pas intéressé'],
              comptable: ['bleu', 'Avis du comptable'], associe: ['bleu', 'Avis d’un associé'], reflexion: ['bleu', 'Temps de réflexion'],
              relire_contrat: ['bleu', 'Relire le contrat'], pas_decision_jour: ['beige', 'Décision en attente'], tresorerie: ['jaune', 'Trésorerie à prévoir'],
            };
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
              needs to know when they last tried — not just the first attempt. */}
          {(activeCat.key === 'voicemail' || activeCat.key === 'callback') && lead.first_call_at && (() => {
            const d = new Date(lead.first_call_at);
            const dd = parisParts(d).day;
            const mo = parisParts(d).month;
            const hh = parisParts(d).hour;
            const mi = parisParts(d).minute;
            return (
              <span title={`Premier appel : ${d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' })} à ${hh}h${mi}`} style={{
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
          {(activeCat.key === 'voicemail' || activeCat.key === 'callback') && lead.last_call_at && lead.last_call_at !== lead.first_call_at && (() => {
            // Hide "Dernier" when it equals "1er" — avoids the redundant
            // case after a single call (or on backfilled historical rows
            // where backend set last = first). Absence carries meaning:
            // no "Dernier" pill ⇒ rep has only called once.
            const d = new Date(lead.last_call_at);
            const dd = parisParts(d).day;
            const mo = parisParts(d).month;
            const hh = parisParts(d).hour;
            const mi = parisParts(d).minute;
            return (
              <span title={`Dernier appel : ${d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' })} à ${hh}h${mi}`} style={{
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

          {/* Bandeau setter — wording contextuel selon l'onglet :
              - Onglet R1 (lead.r1_placed_by_setter_id) → "Traité par X"
                (le setter a placé le R1, son boulot est terminé sur ce lead).
              - Onglet R2 (lead.r2_placed_by_setter_id) → "Traité par X"
                (idem côté R2).
              - Onglets Répondeurs / Callback / autres (lead.setter_called_by) →
                "En traitement par X ×N" (le setter est en cours d'appel).
              Signal fort pour éviter qu'un sales appelle un lead qu'un setter
              est en train de retravailler ou a déjà traité. Lecture seule.
              Fallback nom = 'Setter' tant que le backend n'expose pas
              `r1_placed_by_setter_name` / `r2_placed_by_setter_name`. */}
          {(() => {
            let label = null;
            let setterName = null;
            let originStep = null; // 'R1' | 'R2' — pour préciser tooltip quand fallback
            let cnt = 0;
            if (activeCat.key === 'r1' && lead.r1_placed_by_setter_id) {
              label = 'Traité par';
              setterName = lead.r1_placed_by_setter_name || 'Setter';
              originStep = 'R1';
            } else if (activeCat.key === 'r2' && lead.r2_placed_by_setter_id) {
              label = 'Traité par';
              setterName = lead.r2_placed_by_setter_name || 'Setter';
              originStep = 'R2';
            } else if (activeCat.key === 'r2' && lead.r1_placed_by_setter_id) {
              // Fallback R2 tab : le R2 a été placé par le sales mais le R1
              // originel venait d'un setter. Trace préservée pour le suivi.
              label = 'Traité par';
              setterName = lead.r1_placed_by_setter_name || 'Setter';
              originStep = 'R1';
            } else if (activeCat.key === 'signed' && (lead.r2_placed_by_setter_id || lead.r1_placed_by_setter_id)) {
              // Tab Signés : préserve la trace setter de bout en bout. R2
              // setter prime sur R1 (étape la plus avancée).
              label = 'Traité par';
              if (lead.r2_placed_by_setter_id) {
                setterName = lead.r2_placed_by_setter_name || 'Setter';
                originStep = 'R2';
              } else {
                setterName = lead.r1_placed_by_setter_name || 'Setter';
                originStep = 'R1';
              }
            } else if (lead.setter_called_by_name || lead.setter_called_by) {
              label = 'En traitement par';
              setterName = lead.setter_called_by_name || lead.setter_called_by || 'Setter';
              cnt = Number(lead.setter_call_count || 0);
            }
            if (!label) return null;
            const tooltipParts = [`${label} ${setterName}`];
            if (originStep) tooltipParts.push(`${originStep} placé par ce setter`);
            if (cnt > 0) tooltipParts.push(`Tentatives setter : ${cnt}`);
            if (label === 'En traitement par' && lead.setter_called_at) {
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
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 50, fontSize: 10.5, fontWeight: 500, flexShrink: 0,
                background: darkMode ? 'rgba(245,158,11,0.20)' : 'rgba(245,158,11,0.13)',
                color: '#d97706',
                border: `1.5px solid ${darkMode ? 'rgba(245,158,11,0.45)' : 'rgba(245,158,11,0.35)'}`,
                letterSpacing: '0.01em',
                boxShadow: darkMode ? '0 0 0 1px rgba(245,158,11,0.10)' : '0 1px 2px rgba(245,158,11,0.10)',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l18-5v12L3 14v-3z" />
                  <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                </svg>
                {label} {setterName}{cnt > 1 ? ` ×${cnt}` : ''}
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
          }} title={formatDate(lead.created_at)}>
            {String(formatDate(lead.created_at) || '').replace(/ \d{4}$/, '')}
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


      </div>
  );
}

export default React.memo(LeadCard);
