import React, { useState } from 'react';
import apiClient from '../../services/apiClient';

/**
 * Ligne "Lien de rendez-vous" dans le détail d'un lead (vue sales).
 *
 * Le lien est CONTEXTUEL : le serveur décide le bon type selon l'étape du lead
 * (nouveau lead -> prendre un R1 ; R1 effectué -> prendre le R2 ; R2 posé ->
 * reprogrammer le R2 ; R2 effectué/R3 -> R3...). Au clic, récupère le lien via
 * /rdv-booking/manage/lead/{id}/link, copie l'URL (origine du CRM + /rdv/<token>)
 * et affiche le statut ouvert/réservé. Le label affiché est calculé côté client
 * pour l'indice visuel ; le TOKEN vient du serveur (autorité).
 *
 * Props : { lead, C, darkMode }.
 */

const LinkIcon = ({ color, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 13.5a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.5 1.5" />
    <path d="M14.5 10.5a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.5-1.5" />
  </svg>
);

const fmt = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
};

// Étape contextuelle (miroir de _repro_stage côté serveur).
function stageOf(lead) {
  const r1r = lead.r1_result || '';
  const r2r = lead.r2_result || '';
  const r3d = lead.r3 || lead.r3_date;
  if (r3d || r2r === 'done') return 'r3';
  if (r1r === 'done' || lead.r2) return 'r2';
  return 'r1';
}
function isFresh(lead, stage) {
  if (stage === 'r1') return !lead.r1;
  if (stage === 'r2') return !lead.r2;
  return !(lead.r3 || lead.r3_date);
}

export default function ReproLinkRow({ lead, C, darkMode }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(false);

  const stage = stageOf(lead);
  const label = `Copier le lien pour ${isFresh(lead, stage) ? 'prendre' : 'reprogrammer'} le ${stage.toUpperCase()}`;

  const onClick = async () => {
    if (loading) return;
    setLoading(true); setErr(false);
    try {
      const data = await apiClient.get(`/api/v1/rdv-booking/manage/lead/${lead.id}/link`);
      if (!data || !data.url) throw new Error('no link');
      await navigator.clipboard.writeText(data.url); // URL audit (jamais interne)
      setStatus({ opened_at: data.opened_at, booked_at: data.booked_at });
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setErr(true);
      setTimeout(() => setErr(false), 2500);
    } finally {
      setLoading(false);
    }
  };

  const valueColor = err ? '#ef4444' : copied ? '#10b981' : C.accent;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, cursor: loading ? 'wait' : 'pointer',
        borderRadius: 8, padding: '4px 6px', margin: '-4px -6px', transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LinkIcon color={err ? '#ef4444' : copied ? '#10b981' : C.accent} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Lien de rendez-vous
        </div>
        <div style={{ fontSize: 12, color: valueColor, fontWeight: 600 }}>
          {err ? 'Erreur, réessayez' : copied ? 'Lien copié ✓' : loading ? 'Génération…' : label}
        </div>
        {status && (status.booked_at || status.opened_at) && (
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontWeight: 500 }}>
            {status.booked_at
              ? <span style={{ color: '#10b981', fontWeight: 600 }}>Prospect a réservé le {fmt(status.booked_at)}</span>
              : <>Prospect a ouvert le {fmt(status.opened_at)}</>}
          </div>
        )}
      </div>
    </div>
  );
}
