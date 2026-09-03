// ResponsibleSelect.jsx — qui suit ce client dans l'équipe finance.
//
// Demande dev 2026-09-03 : « la personne qui a eu le dernier contact avec le
// client et qui a les infos. Un drop-down avec les personnes de l'équipe
// finance ; ils peuvent se sélectionner, ou une autre personne peut prendre
// la responsabilité. Ça se met à jour chez tout le monde. »
//
// Pas dans le tableau (pas de colonne), seulement dans la fiche — et dans le
// menu Filtre, pour retrouver ses clients. La propagation aux autres postes
// passe par le delta de la page, rien à faire ici.
//
// Toute l'équipe finance peut désigner ou reprendre : ce n'est pas une
// décision qui engage, c'est une organisation de travail.

import React, { useCallback, useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e9e9e7',
  sideBg: '#f7f7f5',
};

// La liste ne change pas en cours de session : un seul chargement, partagé
// entre toutes les fiches ouvertes.
let teamPromise = null;
const loadTeam = () => {
  if (!teamPromise) {
    teamPromise = apiClient.get('/api/v1/finance-periods/team')
      .catch((e) => { teamPromise = null; throw e; });
  }
  return teamPromise;
};

export default function ResponsibleSelect({ clientId, value, canEdit, onChanged, onShowToast, label = true }) {
  const [team, setTeam] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    loadTeam()
      .then((list) => { if (alive) setTeam(Array.isArray(list) ? list : []); })
      .catch((e) => { if (alive) setUnavailable(e?.status === 404); });
    return () => { alive = false; };
  }, []);

  const me = apiClient.getUser();
  const meId = me?.id ? String(me.id) : null;
  const currentId = value?.responsible_user_id || '';
  const currentName = value?.responsible_name || null;
  const meInTeam = !!(meId && team?.some((m) => m.id === meId));

  const assign = useCallback(async (userId) => {
    if (!clientId || saving) return;
    setSaving(true);
    try {
      const r = await apiClient.put(
        `/api/v1/finance-periods/client/${clientId}/responsible`,
        { user_id: userId || null },
      );
      onChanged?.(r);
      onShowToast?.(
        r?.responsible_name ? `${r.responsible_name} suit désormais ce client` : 'Plus de responsable sur ce client',
        'success',
      );
    } catch (e) {
      onShowToast?.(e?.data?.detail || 'Changement impossible', 'error');
    } finally {
      setSaving(false);
    }
  }, [clientId, saving, onChanged, onShowToast]);

  const editable = canEdit && !unavailable && !!team;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 24, flexWrap: 'wrap' }}>
      {label && (
        <span style={{
          fontSize: 11, fontWeight: 600, color: N.textFaint,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Responsable
        </span>
      )}

      {editable ? (
        <select
          value={currentId}
          disabled={saving}
          onChange={(e) => assign(e.target.value)}
          title="Qui suit ce client dans l'équipe finance"
          style={{
            border: `1px solid ${N.border}`, borderRadius: 6,
            padding: '3px 26px 3px 9px', fontSize: 12.5, fontFamily: 'inherit',
            background: '#fff', color: currentId ? N.text : N.textMuted,
            fontWeight: currentId ? 600 : 500, outline: 'none',
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          <option value="">Personne</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
      ) : (
        <span
          title={unavailable ? "Indisponible tant que l'API n'est pas déployée" : undefined}
          style={{ fontSize: 12.5, fontWeight: currentName ? 600 : 500, color: currentName ? N.text : N.textFaint }}
        >
          {currentName || '—'}
        </span>
      )}

      {editable && meInTeam && currentId !== meId && (
        <button
          type="button"
          onClick={() => assign(meId)}
          disabled={saving}
          title="Prendre la responsabilité de ce client"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            border: `1px solid ${N.border}`, background: '#fff', borderRadius: 6,
            padding: '3px 9px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            color: N.textMuted, cursor: saving ? 'wait' : 'pointer',
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = N.sideBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
        >
          <UserCheck size={12} />
          Je prends la main
        </button>
      )}

      {value?.responsible_set_by && currentName && (
        <span style={{ fontSize: 11, color: N.textFaint }}>
          désigné par {value.responsible_set_by}
        </span>
      )}
    </div>
  );
}
