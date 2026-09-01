// StructureSplits.jsx — quelle structure a payé quoi.
//
// Demande dev 2026-09-01 : « des clients paient pour plusieurs structures.
// Quand on met le récupéré, il faut préciser pour laquelle. Par défaut
// structure 1, 2, 3… et ils peuvent entrer le vrai nom des sociétés. Il faut
// aussi pouvoir remonter les mois précédents. »
//
// Deux gestes, dans cet ordre :
//   1. NOMMER les structures — tant que ce n'est pas fait, elles s'appellent
//      « Structure 1 », « Structure 2 »… et restent utilisables. On n'oblige
//      personne à tout renseigner avant de pouvoir ventiler.
//   2. VENTILER un mois — le montant encaissé, réparti entre les structures.
//      N'importe quel mois de l'échéancier, y compris passé : la finance
//      rattrape l'historique quand elle en a le temps.
//
// La ventilation ne CONTRAINT PAS le montant encaissé : on affiche l'écart,
// on ne bloque pas. Une ventilation partielle est le cas normal — exiger le
// compte juste empêcherait de commencer.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Check, Pencil } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { formatEUR, formatMonthLabel } from '../constants.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  green: '#15794a',
  amber: '#b45309',
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function StructureSplits({
  clientId, periods, scope, canEdit, canEditMoney, onShowToast,
}) {
  const [structures, setStructures] = useState(null);
  const [splits, setSplits] = useState([]);
  const [monthId, setMonthId] = useState(null);
  const [draft, setDraft] = useState({});      // structure_id -> montant
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(null);

  const entity = scope === 'optilex' ? 'optilex' : 'owner';

  const load = useCallback(() => {
    if (!clientId) return;
    apiClient.get(`/api/v1/finance-periods/client/${clientId}/structures`)
      .then((d) => setStructures(d?.items || []))
      .catch(() => setStructures([]));
    apiClient.get(`/api/v1/finance-periods/client/${clientId}/splits`)
      .then((d) => setSplits(d?.items || []))
      .catch(() => setSplits([]));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  // Mois où il y a de l'argent à ventiler — du plus récent au plus ancien,
  // parce qu'on saisit le mois courant bien plus souvent que mars dernier.
  const months = useMemo(() => (periods || [])
    .map((p) => ({
      id: p.id,
      period: p.period,
      received: Number(p[`received_${entity === 'owner' ? 'owner' : 'optilex_ttc'}`] || 0)
        + Number(p[`received_overdue_${entity === 'owner' ? 'owner' : 'optilex_ttc'}`] || 0),
    }))
    .filter((m) => m.received > 0)
    .sort((a, b) => String(b.period).localeCompare(String(a.period))), [periods, entity]);

  useEffect(() => {
    if (monthId === null && months.length) setMonthId(months[0].id);
  }, [months, monthId]);

  const current = months.find((m) => m.id === monthId) || null;

  // Le brouillon repart de ce qui est enregistré dès qu'on change de mois.
  useEffect(() => {
    if (!current) { setDraft({}); return; }
    const d = {};
    for (const s of splits) {
      if (s.period_id === current.id && s.entity === entity) d[s.structure_id] = s.amount;
    }
    setDraft(d);
  }, [current, splits, entity]);

  const ventile = useMemo(
    () => round2(Object.values(draft).reduce((a, b) => a + (Number(b) || 0), 0)),
    [draft],
  );
  const reste = current ? round2(current.received - ventile) : 0;

  // Ce que chaque structure a payé au total, tous mois confondus : la
  // question qu'on pose vraiment quand on ouvre cette section.
  const parStructure = useMemo(() => {
    const acc = {};
    for (const s of splits) {
      if (s.entity !== entity) continue;
      acc[s.structure_id] = round2((acc[s.structure_id] || 0) + s.amount);
    }
    return acc;
  }, [splits, entity]);

  const save = useCallback(async () => {
    if (!current || saving) return;
    setSaving(true);
    try {
      const body = Object.entries(draft)
        .map(([structure_id, amount]) => ({
          structure_id: Number(structure_id), entity, kind: 'received',
          amount: round2(amount),
        }))
        .filter((s) => s.amount);
      const d = await apiClient.put(
        `/api/v1/finance-periods/client/${clientId}/splits/${current.id}`, body,
      );
      setSplits(d?.items || []);
      onShowToast?.('Ventilation enregistrée', 'success');
    } catch (e) {
      onShowToast?.(e?.data?.detail || 'Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
    }
  }, [current, draft, entity, clientId, saving, onShowToast]);

  const rename = useCallback(async (structureId, name) => {
    try {
      const d = await apiClient.patch(
        `/api/v1/finance-periods/client/${clientId}/structures/${structureId}`, { name },
      );
      setStructures(d?.items || []);
      setRenaming(null);
    } catch (e) {
      onShowToast?.(e?.data?.detail || 'Renommage impossible', 'error');
    }
  }, [clientId, onShowToast]);

  if (!structures || !structures.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11.5, color: N.textMuted, lineHeight: 1.5 }}>
        Ce client règle pour <strong>{structures.length} structures</strong>.
        Nommez-les, puis indiquez ce que chacune a versé — sur n’importe quel
        mois, y compris passé.
      </div>

      {/* Choix du mois : le plus récent d'abord. */}
      {months.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: N.textMuted }}>Mois</span>
          <select
            value={monthId ?? ''}
            onChange={(e) => setMonthId(Number(e.target.value))}
            style={{
              border: `1px solid ${N.border}`, borderRadius: 6, padding: '6px 8px',
              fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: N.text,
              outline: 'none',
            }}
          >
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {formatMonthLabel(String(m.period).slice(0, 7))} · {formatEUR(m.received)}
              </option>
            ))}
          </select>
          {current && (
            <span style={{
              fontSize: 11.5, fontWeight: 600,
              color: Math.abs(reste) < 0.005 ? N.green : N.amber,
            }}>
              {Math.abs(reste) < 0.005
                ? 'Entièrement ventilé'
                : `${formatEUR(reste)} non attribué`}
            </span>
          )}
        </div>
      )}

      <div style={{
        border: `1px solid ${N.borderSft}`, borderRadius: 10, overflow: 'hidden',
      }}>
        {structures.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: i * 0.03 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
            }}
          >
            <Building2 size={13} style={{ color: N.textFaint, flexShrink: 0 }} />

            {renaming === s.id ? (
              <input
                autoFocus
                defaultValue={s.named ? s.name : ''}
                placeholder={`Structure ${s.position}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') rename(s.id, e.currentTarget.value);
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onBlur={(e) => rename(s.id, e.currentTarget.value)}
                style={{
                  flex: 1, minWidth: 0, border: `1px solid ${N.border}`, borderRadius: 5,
                  padding: '4px 7px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={canEdit ? () => setRenaming(s.id) : undefined}
                title={canEdit ? 'Renommer cette structure' : undefined}
                style={{
                  flex: 1, minWidth: 0, textAlign: 'left', border: 'none',
                  background: 'transparent', padding: 0, font: 'inherit', fontSize: 12.5,
                  color: s.named ? N.text : N.textFaint,
                  fontStyle: s.named ? 'normal' : 'italic',
                  cursor: canEdit ? 'pointer' : 'default',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {s.name}
                {canEdit && <Pencil size={10} style={{ opacity: 0.4, flexShrink: 0 }} />}
              </button>
            )}

            <span style={{
              fontSize: 11, color: N.textFaint, whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }} title="Total versé par cette structure, tous mois confondus">
              {formatEUR(parStructure[s.id] || 0)} au total
            </span>

            <input
              type="number"
              step="0.01"
              min={0}
              disabled={!canEditMoney || !current}
              value={draft[s.id] ?? ''}
              placeholder="0,00"
              onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value }))}
              style={{
                width: 96, border: `1px solid ${N.border}`, borderRadius: 6,
                padding: '5px 7px', fontSize: 12.5, fontFamily: 'inherit',
                textAlign: 'right', outline: 'none', color: N.text,
                background: canEditMoney && current ? '#fff' : N.sideBg,
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </motion.div>
        ))}
      </div>

      {canEditMoney && current && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11.5, color: N.textMuted, marginRight: 'auto' }}>
            Encaissé sur le mois : <strong>{formatEUR(current.received)}</strong> ·
            {' '}ventilé : <strong>{formatEUR(ventile)}</strong>
          </span>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: 'none', borderRadius: 6, padding: '7px 13px',
              fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
              cursor: saving ? 'default' : 'pointer',
              background: saving ? N.sideBg : N.text,
              color: saving ? N.textFaint : '#fff',
            }}
          >
            <Check size={13} />
            {saving ? 'Enregistrement…' : 'Enregistrer la ventilation'}
          </button>
        </div>
      )}

      {!months.length && (
        <div style={{ fontSize: 11.5, color: N.textFaint }}>
          Aucun encaissement à ventiler pour l’instant sur cette vision.
        </div>
      )}
    </div>
  );
}
