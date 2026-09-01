// StructureAmountCell.jsx — saisir le récupéré structure par structure.
//
// Demande dev 2026-09-01 : « sur les clients qui ont plusieurs structures,
// elle peut choisir structure 1 et mettre le montant que structure 1 a payé,
// puis structure 2… valider, et récupérer le global. Derrière, si tu cliques
// dessus, tu as le détail dans un drop-down. »
//
// La ventilation devient donc la SAISIE, et le montant du mois en est la
// somme. Le serveur écrit les deux dans la même transaction (`sync_received`)
// pour qu'ils ne puissent pas diverger — un total qui ne correspond pas à son
// détail serait pire que pas de détail du tout.
//
// La cellule reste identique pour les 686 clients mono-structure : elle ne
// s'active que sur les 44 qui règlent pour plusieurs sociétés.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Check, X } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { formatEUR } from '../constants.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  green: '#0f7b6c',
  amber: '#b45309',
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function StructureAmountCell({
  row, entity, value, expected, canEdit, onSaved, onShowToast,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [structures, setStructures] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const btnRef = useRef(null);

  const clientId = row.client?.id;

  const load = useCallback(async () => {
    if (!clientId) return;
    try {
      const [st, sp] = await Promise.all([
        apiClient.get(`/api/v1/finance-periods/client/${clientId}/structures`),
        apiClient.get(`/api/v1/finance-periods/client/${clientId}/splits`),
      ]);
      setStructures(st?.items || []);
      const d = {};
      for (const s of (sp?.items || [])) {
        if (s.period_id === row.id && s.entity === entity) d[s.structure_id] = s.amount;
      }
      setDraft(d);
    } catch {
      setStructures([]);
    }
  }, [clientId, row.id, entity]);

  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const up = r.bottom + 300 > window.innerHeight && r.top > 300;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.min(r.left, window.innerWidth - 330), up });
    setOpen(true);
    load();
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e?.target?.closest?.('[data-structure-popover]')) return;
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const total = round2(Object.values(draft).reduce((a, b) => a + (Number(b) || 0), 0));

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const body = Object.entries(draft)
        .map(([structure_id, amount]) => ({
          structure_id: Number(structure_id), entity, kind: 'received',
          amount: round2(amount),
        }))
        .filter((s) => s.amount);
      await apiClient.put(
        `/api/v1/finance-periods/client/${clientId}/splits/${row.id}?sync_received=true`,
        body,
      );
      onShowToast?.(`Récupéré ${formatEUR(total)} · ${body.length} structure${body.length > 1 ? 's' : ''}`, 'success');
      setOpen(false);
      onSaved?.(total);
    } catch (e) {
      onShowToast?.(e?.data?.detail || 'Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
    }
  }, [saving, draft, entity, clientId, row.id, total, onSaved, onShowToast]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title={canEdit
          ? 'Ventiler le récupéré par structure'
          : 'Voir le détail par structure'}
        style={{
          border: 'none', background: 'transparent', padding: 0, width: '100%',
          font: 'inherit', cursor: 'pointer', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', gap: 5,
          color: value > 0 ? N.green : N.textFaint,
          fontWeight: value > 0 ? 700 : 400,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value > 0 ? formatEUR(value) : '—'}
        <Building2 size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
      </button>

      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10060 }} />
          <AnimatePresence>
            <motion.div
              data-structure-popover="1"
              initial={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
                left: pos.left, zIndex: 10061, width: 320,
                background: '#fff', border: `1px solid ${N.border}`, borderRadius: 10,
                boxShadow: '0 10px 32px rgba(17,24,39,0.16)', padding: 12,
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: N.text }}>
                  Récupéré par structure
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: N.textFaint, padding: 2 }}
                >
                  <X size={13} />
                </button>
              </div>

              {structures === null ? (
                <div style={{ fontSize: 12, color: N.textMuted, padding: '8px 0' }}>Chargement…</div>
              ) : !structures.length ? (
                <div style={{ fontSize: 12, color: N.textMuted, padding: '8px 0' }}>
                  Aucune structure déclarée pour ce client.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {structures.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={11} style={{ color: N.textFaint, flexShrink: 0 }} />
                      <span style={{
                        flex: 1, minWidth: 0, fontSize: 12,
                        color: s.named ? N.text : N.textFaint,
                        fontStyle: s.named ? 'normal' : 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={s.name}>
                        {s.name}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        disabled={!canEdit}
                        value={draft[s.id] ?? ''}
                        placeholder="0,00"
                        onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                        style={{
                          width: 92, border: `1px solid ${N.border}`, borderRadius: 5,
                          padding: '4px 6px', fontSize: 12, fontFamily: 'inherit',
                          textAlign: 'right', outline: 'none',
                          background: canEdit ? '#fff' : N.sideBg,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div style={{
                marginTop: 10, paddingTop: 9, borderTop: `1px solid ${N.borderSft}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 12,
              }}>
                <span style={{ color: N.textMuted }}>
                  Total <strong style={{ color: N.text }}>{formatEUR(total)}</strong>
                </span>
                {expected > 0 && (
                  <span style={{
                    fontSize: 11,
                    color: Math.abs(total - expected) < 0.005 ? N.green : N.amber,
                  }}>
                    attendu {formatEUR(expected)}
                  </span>
                )}
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || structures === null || !structures.length}
                  style={{
                    marginTop: 9, width: '100%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    border: 'none', borderRadius: 6, padding: '7px 12px',
                    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                    cursor: saving ? 'default' : 'pointer',
                    background: saving ? N.sideBg : N.text,
                    color: saving ? N.textFaint : '#fff',
                  }}
                >
                  <Check size={13} />
                  {saving ? 'Enregistrement…' : 'Valider et reporter le total'}
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </>,
        document.body,
      )}
    </>
  );
}
