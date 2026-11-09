// Interrupteur disponible / indisponible du sales (chantier réactivité), déplacé de TrackingSheet.jsx le 09/11/2026
// pour être aussi dans le menu de gauche des autres pages : la navbar l'affichait partout, le menu prend le relais.
// Le back décide qui le voit (`show`) ; `targetEmail` : la sheet d'un autre sales ouverte par un manager.
import { useEffect, useState } from "react";
import apiClient from "../../../services/apiClient";

// ── Statut disponible / indisponible du sales (chantier réactivité) ─────────
// Affiché EN PERMANENCE dans la barre latérale : le sales voit son état et le
// bascule d'un clic. Passer en indisponible coupe l'auto-affectation (aucun
// nouveau lead) ; le retour en disponible est toujours manuel.
export default function SidebarAvailability({ C, darkMode, collapsed, targetEmail }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const fetchSt = async () => {
      try {
        if (!apiClient.getToken()) return;
        const qs = targetEmail ? `?email=${encodeURIComponent(targetEmail)}` : '';
        const d = await apiClient.get(`/api/v1/tracking/availability/me${qs}`);
        if (alive && d && typeof d.show !== 'undefined') setSt(d);
      } catch { /* réseau : le prochain passage (30 s) réessaie */ }
    };
    fetchSt();
    const t = setInterval(fetchSt, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [targetEmail]);
  const toggle = async () => {
    if (!st || busy) return;
    const next = !st.available;
    if (!next && !window.confirm("Passer en indisponible ? Vous ne recevrez plus de nouveaux leads tant que vous ne serez pas repassé en disponible.")) return;
    setBusy(true);
    try {
      await apiClient.post('/api/v1/tracking/availability', targetEmail ? { available: next, email: targetEmail } : { available: next });
      setSt((s) => ({ ...s, available: next }));
    } catch { /* échec : l’état affiché reste l’ancien */ }
    setBusy(false);
  };
  if (!st || !st.show) return null;
  const on = !!st.available;
  const green = '#22c55e', red = '#ef4444';
  return (
    <button type="button" onClick={toggle} disabled={busy}
      title={on ? "Vous recevez les nouveaux leads — cliquer pour passer indisponible" : "Auto-affectation coupée : vous ne recevez aucun lead — cliquer pour redevenir disponible"}
      style={{
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9,
        justifyContent: collapsed ? 'center' : 'flex-start',
        width: '100%', padding: collapsed ? '10px 0' : '10px 12px', marginTop: 8,
        borderRadius: 12, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
        border: `1px solid ${on ? (darkMode ? 'rgba(34,197,94,0.35)' : '#bfe7cd') : (darkMode ? 'rgba(239,68,68,0.4)' : '#f6c9c5')}`,
        background: on ? (darkMode ? 'rgba(34,197,94,0.12)' : '#eefaf1') : (darkMode ? 'rgba(239,68,68,0.14)' : '#fdecea'),
        transition: 'background 0.15s, border-color 0.15s',
      }}>
      <span style={{ position: 'relative', width: 9, height: 9, flexShrink: 0 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: on ? green : red }} />
        {on && <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${green}`, opacity: 0.5, animation: 'availPulseTS 2.2s ease-out infinite' }} />}
      </span>
      {!collapsed && (
        <span style={{ textAlign: 'left', minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: on ? '#1d7a44' : '#b42318', whiteSpace: 'nowrap' }}>
            {on ? 'Disponible' : 'Indisponible'}
          </span>
          <span style={{ display: 'block', fontSize: 10, color: C.muted, whiteSpace: 'nowrap' }}>
            {st.self === false ? (on ? 'reçoit les leads' : 'ne reçoit aucun lead')
              : (on ? 'je reçois les leads' : 'aucun lead ne m\'est envoyé')}
          </span>
        </span>
      )}
      <style>{`@keyframes availPulseTS{0%{transform:scale(0.7);opacity:0.6}80%{transform:scale(1.5);opacity:0}100%{opacity:0}}`}</style>
    </button>
  );
}
