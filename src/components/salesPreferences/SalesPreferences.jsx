// Préférences de secteur des sales (dev 06/10/2026). Elles guident l'auto-affectation des RDV posés
// par les setters : à créneau égal, le sales qui préfère le secteur du lead passe devant, et un
// secteur refusé l'écarte. Deux usages :
//   mode="all" : le dev (admin) voit et modifie les préférences de tous les sales ;
//   mode="me"  : chaque sales voit et modifie seulement les siennes.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Check, X, Ban, Star } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { sectorMeta } from '../../utils/sectors';

const BASE = '/api/v1/sales-preferences';

const errorText = (err, fallback) => {
  const detail = err?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
};

const fmtUpdated = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
  return `${day} à ${time}`;
};

const ROLE_LABEL = { head_of_sales: 'Head of sales', head_of_sales_manager: 'Head of sales manager' };

function tint(hex, alpha) {
  const h = (hex || '#8b94a6').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function SectorChip({ sectorKey, label, kind, active = true, onClick, darkMode }) {
  const meta = sectorMeta(sectorKey);
  const color = kind === 'excluded' ? '#c25555' : (meta?.color || '#8b94a6');
  const text = label || meta?.label || sectorKey;
  const clickable = typeof onClick === 'function';
  return (
    <button type="button" onClick={onClick} disabled={!clickable}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999,
        fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', lineHeight: 1.2,
        cursor: clickable ? 'pointer' : 'default', transition: 'all 0.15s ease',
        border: `1px solid ${active ? tint(color, darkMode ? 0.55 : 0.45) : (darkMode ? '#2a2b36' : '#e2e6ef')}`,
        background: active ? tint(color, darkMode ? 0.22 : 0.12) : 'transparent',
        color: active ? (darkMode ? '#eef0f6' : '#1e2330') : (darkMode ? '#8b8fa0' : '#6b7280'),
        textDecoration: kind === 'excluded' && active ? 'line-through' : 'none',
        textDecorationColor: tint(color, 0.8),
      }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: active ? color : (darkMode ? '#3a3b48' : '#d6dae3'), flexShrink: 0 }} />
      {text}
    </button>
  );
}

function Summary({ pref, C, darkMode }) {
  const preferred = pref.preferred || [];
  const excluded = pref.excluded || [];
  if (!preferred.length && !excluded.length) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 10px', borderRadius: 999, background: C.subtle, color: C.secondary, border: `1px solid ${C.border}` }}>
          Ouvert à tout
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {preferred.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {preferred.map((k) => <SectorChip key={k} sectorKey={k} kind="preferred" darkMode={darkMode} />)}
        </div>
      )}
      {excluded.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.secondary, fontWeight: 600 }}>{preferred.length ? 'Jamais :' : 'Tout sauf :'}</span>
          {excluded.map((k) => <SectorChip key={k} sectorKey={k} kind="excluded" darkMode={darkMode} />)}
        </div>
      )}
    </div>
  );
}

const CHOICES = [
  { value: 'none', label: 'Indifférent' },
  { value: 'preferred', label: 'Priorité', Icon: Star, color: '#bf945f' },
  { value: 'excluded', label: 'Jamais', Icon: Ban, color: '#c25555' },
];

function SectorRow({ sector, value, onChange, C, darkMode, disabled }) {
  const meta = sectorMeta(sector.key);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: value === 'none' ? C.secondary : C.text, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: meta?.color || '#8b94a6', flexShrink: 0, opacity: value === 'none' ? 0.45 : 1 }} />
        <span style={{ textDecoration: value === 'excluded' ? 'line-through' : 'none', textDecorationColor: 'rgba(194,85,85,0.7)' }}>{sector.label}</span>
      </span>
      <div role="radiogroup" aria-label={sector.label} style={{ display: 'inline-flex', padding: 2, gap: 2, borderRadius: 9, background: darkMode ? 'rgba(255,255,255,0.04)' : '#f1f3f7', flexShrink: 0 }}>
        {CHOICES.map(({ value: v, label, Icon, color }) => {
          const on = value === v;
          const tone = v === 'preferred' ? (meta?.color || color) : color;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', transition: 'all 0.15s ease',
                border: `1px solid ${on ? (v === 'none' ? C.border : tint(tone, darkMode ? 0.55 : 0.4)) : 'transparent'}`,
                background: on ? (v === 'none' ? (darkMode ? '#2a2b36' : '#fff') : tint(tone, darkMode ? 0.22 : 0.13)) : 'transparent',
                color: on ? (v === 'excluded' ? '#c25555' : C.text) : C.muted,
                boxShadow: on && v === 'none' && !darkMode ? '0 1px 2px rgba(16,24,40,0.06)' : 'none' }}>
              {Icon && <Icon size={11.5} strokeWidth={2.4} />}{label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Editor({ pref, sectors, C, darkMode, saving, error, onSave, onCancel, columns = 1 }) {
  const [choice, setChoice] = useState(() => {
    const init = {};
    (pref.preferred || []).forEach((k) => { init[k] = 'preferred'; });
    (pref.excluded || []).forEach((k) => { init[k] = 'excluded'; });
    return init;
  });
  const [note, setNote] = useState(pref.note || '');
  const pick = (kind) => sectors.map((s) => s.key).filter((k) => choice[k] === kind);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: columns > 1 ? 'repeat(auto-fit, minmax(390px, 1fr))' : '1fr', columnGap: 28 }}>
        {sectors.map((s) => (
          <SectorRow key={s.key} sector={s} value={choice[s.key] || 'none'} C={C} darkMode={darkMode} disabled={saving}
            onChange={(v) => setChoice((prev) => ({ ...prev, [s.key]: v }))} />
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} disabled={saving}
        placeholder="Précision libre, par exemple « 3 à 20 salariés » ou « sud-ouest »"
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, fontSize: 13, fontFamily: 'inherit',
          border: `1px solid ${C.border}`, background: darkMode ? C.subtle : '#fff', color: C.text, outline: 'none' }} />
      {error && <div style={{ fontSize: 12.5, color: '#c25555', fontWeight: 600 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={saving}
          onClick={() => onSave({ preferred: pick('preferred'), excluded: pick('excluded'), note: note.trim() || null })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none',
            background: darkMode ? '#eef0f6' : '#1e2330', color: darkMode ? '#1e2330' : '#fff', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          <Check size={14} strokeWidth={2.4} />{saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" disabled={saving} onClick={() => setChoice({})}
          style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.secondary,
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
          Tout remettre à « ouvert à tout »
        </button>
        <button type="button" disabled={saving} onClick={onCancel}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 10px', borderRadius: 9, border: 'none',
            background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
          <X size={14} strokeWidth={2.2} />Annuler
        </button>
      </div>
    </div>
  );
}

function EditDialog({ title, subtitle, children, onClose, busy, C, darkMode }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: darkMode ? 'rgba(0,0,0,0.55)' : 'rgba(17,24,39,0.32)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'tabFadeIn 0.18s ease-out both' }}>
      <section role="dialog" aria-modal="true" aria-label={title}
        style={{ width: 'min(920px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box',
          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 22px',
          boxShadow: darkMode ? '0 24px 60px rgba(0,0,0,0.55)' : '0 24px 60px rgba(16,24,40,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: C.secondary, marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer"
            style={{ border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', padding: 4, display: 'inline-flex' }}>
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}

function SalesCard({ pref, sectors, endpoint, C, darkMode, showName, onSaved, startEditing = false }) {
  const [editing, setEditing] = useState(startEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (body) => {
    setSaving(true); setError('');
    try {
      const fresh = await apiClient.put(endpoint, body);
      onSaved(fresh);
      setEditing(false);
    } catch (err) {
      setError(errorText(err, 'Enregistrement impossible. Réessayez.'));
    } finally {
      setSaving(false);
    }
  };

  const updated = fmtUpdated(pref.updated_at);
  const by = (pref.updated_by_email || '').split('@')[0];
  return (
    <div style={{ background: C.bg, border: `1px solid ${editing && !showName ? (darkMode ? '#3a3b48' : '#cfd5e2') : C.border}`, borderRadius: 14,
      padding: '16px 18px', boxShadow: C.shadow, display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          {showName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>{pref.full_name || pref.email}</span>
              {ROLE_LABEL[pref.role] && (
                <span style={{ fontSize: 11, fontWeight: 600, color: C.secondary, background: C.subtle, borderRadius: 6, padding: '2px 7px' }}>{ROLE_LABEL[pref.role]}</span>
              )}
            </div>
          )}
          {!(editing && !showName) && pref.note && <div style={{ fontSize: 12.5, color: C.secondary, marginTop: showName ? 4 : 0 }}>{pref.note}</div>}
        </div>
        {!(editing && !showName) && (
          <button type="button" onClick={() => setEditing(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.secondary, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
            <Pencil size={12.5} strokeWidth={2.2} />Modifier
          </button>
        )}
      </div>
      {editing && !showName
        ? <Editor pref={pref} sectors={sectors} C={C} darkMode={darkMode} saving={saving} error={error} columns={2}
            onSave={save} onCancel={() => { setEditing(false); setError(''); }} />
        : <Summary pref={pref} C={C} darkMode={darkMode} />}
      {editing && showName && (
        <EditDialog title={pref.full_name || pref.email} subtitle="Secteurs reçus en priorité, et secteurs jamais attribués, quand un setter pose un rendez-vous."
          busy={saving} C={C} darkMode={darkMode} onClose={() => { setEditing(false); setError(''); }}>
          <Editor pref={pref} sectors={sectors} C={C} darkMode={darkMode} saving={saving} error={error} columns={2}
            onSave={save} onCancel={() => { setEditing(false); setError(''); }} />
        </EditDialog>
      )}
      {!(editing && !showName) && updated && (
        <div style={{ fontSize: 11.5, color: C.muted }}>Modifié le {updated}{by ? ` par ${by}` : ''}</div>
      )}
    </div>
  );
}

export default function SalesPreferences({ mode = 'all', C, darkMode }) {
  const [sectors, setSectors] = useState([]);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [secs, data] = await Promise.all([
          apiClient.get(`${BASE}/sectors`),
          apiClient.get(mode === 'me' ? `${BASE}/me` : BASE),
        ]);
        if (!alive) return;
        setSectors(Array.isArray(secs) ? secs : []);
        setRows(mode === 'me' ? [data] : (Array.isArray(data) ? data : []));
      } catch (err) {
        if (alive) setError(errorText(err, 'Impossible de charger les préférences.'));
      }
    })();
    return () => { alive = false; };
  }, [mode]);

  const replace = (fresh) => setRows((prev) => (prev || []).map((r) => (r.user_id === fresh.user_id ? fresh : r)));
  const counts = useMemo(() => {
    const list = rows || [];
    return { total: list.length, open: list.filter((r) => !(r.preferred || []).length && !(r.excluded || []).length).length };
  }, [rows]);

  return (
    <div style={{ maxWidth: mode === 'me' ? 720 : 1180, margin: '0 auto', padding: '28px 32px 48px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
          {mode === 'me' ? 'Mes préférences' : 'Préférences des sales'}
        </h2>
        <p style={{ fontSize: 13, color: C.secondary, margin: '6px 0 0', lineHeight: 1.5, maxWidth: 680 }}>
          {mode === 'me'
            ? 'Les secteurs que vous voulez recevoir en priorité quand un setter pose un rendez-vous, et ceux que vous ne voulez jamais.'
            : `Quand un setter pose un rendez-vous, le créneau va d'abord à un sales qui préfère le secteur du lead, puis au moins servi de la semaine. « Jamais » écarte le sales pour ce secteur.${rows ? ` ${counts.total} sales, dont ${counts.open} ouverts à tout.` : ''}`}
        </p>
      </div>
      {error && <div style={{ fontSize: 13, color: '#c25555', fontWeight: 600 }}>{error}</div>}
      {!error && rows === null && <div style={{ fontSize: 13, color: C.muted }}>Chargement…</div>}
      {rows && (
        <div style={{ display: 'grid', gridTemplateColumns: mode === 'me' ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {rows.map((r) => (
            <SalesCard key={r.user_id} pref={r} sectors={sectors} C={C} darkMode={darkMode}
              endpoint={mode === 'me' ? `${BASE}/me` : `${BASE}/${r.user_id}`}
              showName={mode !== 'me'} onSaved={replace} />
          ))}
        </div>
      )}
    </div>
  );
}
