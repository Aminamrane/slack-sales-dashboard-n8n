// FilterBuilder.jsx — composition d'un filtre personnel, façon tableur.
//
// Demande dev 2026-08-28 : laisser l'équipe finance créer ses propres
// filtres, les nommer et les retrouver. Une ligne = un champ, un opérateur,
// une valeur ; les lignes se combinent en ET ou en OU.
//
// Le composant ne connaît que la grammaire (savedFilters.js) : ajouter un
// champ là-bas suffit à l'exposer ici.

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Save } from 'lucide-react';

import { FILTER_FIELDS, FIELD_BY_KEY, OPERATORS } from '../savedFilters.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  sideHover: '#efeeec',
};

const inputStyle = {
  border: `1px solid ${N.border}`,
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12.5,
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  color: N.text,
  minWidth: 0,
};

const emptyCondition = () => ({ field: 'overdueToDate', op: 'gt', value: '', value2: '' });

export default function FilterBuilder({ onCancel, onSave, etatValues = [] }) {
  const [name, setName] = useState('');
  const [match, setMatch] = useState('all');
  const [conditions, setConditions] = useState([emptyCondition()]);
  const [saving, setSaving] = useState(false);

  const update = useCallback((i, patch) => {
    setConditions((cs) => cs.map((c, idx) => {
      if (idx !== i) return c;
      const next = { ...c, ...patch };
      // Changer de champ peut invalider l'opérateur : on retombe sur le
      // premier opérateur du nouveau type plutôt que de garder l'ancien.
      if (patch.field) {
        const type = FIELD_BY_KEY[patch.field]?.type || 'text';
        next.op = OPERATORS[type][0].key;
        next.value = '';
        next.value2 = '';
      }
      return next;
    }));
  }, []);

  const submit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        definition: { match, conditions },
      });
    } finally {
      setSaving(false);
    }
  }, [saving, onSave, name, match, conditions]);

  const nameOk = name.trim().length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        padding: 12, borderTop: `1px solid ${N.borderSft}`,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du filtre (ex. « Gros retards Owner »)"
        style={{ ...inputStyle, fontWeight: 600 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: N.textMuted }}>
        Afficher les clients qui remplissent
        <select
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          style={{ ...inputStyle, padding: '3px 6px' }}
        >
          <option value="all">toutes les conditions</option>
          <option value="any">au moins une condition</option>
        </select>
      </div>

      {conditions.map((c, i) => {
        const field = FIELD_BY_KEY[c.field] || FILTER_FIELDS[0];
        const ops = OPERATORS[field.type] || OPERATORS.text;
        const op = ops.find((o) => o.key === c.op) || ops[0];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              value={c.field}
              onChange={(e) => update(i, { field: e.target.value })}
              style={{ ...inputStyle, flex: '1 1 130px' }}
            >
              {FILTER_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <select
              value={c.op}
              onChange={(e) => update(i, { op: e.target.value })}
              style={{ ...inputStyle, flex: '1 1 110px' }}
            >
              {ops.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>

            {op.arity > 0 && (
              field.key === 'etat' && etatValues.length ? (
                <select
                  value={c.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  style={{ ...inputStyle, flex: '1 1 110px' }}
                >
                  <option value="">—</option>
                  {etatValues.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input
                  value={c.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder={field.type === 'date' ? 'JJ/MM/AAAA' : 'valeur'}
                  style={{ ...inputStyle, flex: '1 1 90px' }}
                />
              )
            )}
            {op.arity === 2 && (
              <input
                value={c.value2}
                onChange={(e) => update(i, { value2: e.target.value })}
                placeholder="et"
                style={{ ...inputStyle, flex: '1 1 70px' }}
              />
            )}

            {conditions.length > 1 && (
              <button
                type="button"
                onClick={() => setConditions((cs) => cs.filter((_, idx) => idx !== i))}
                title="Retirer cette condition"
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: N.textFaint, display: 'inline-flex', padding: 2,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setConditions((cs) => [...cs, emptyCondition()])}
        style={{
          alignSelf: 'flex-start', border: 'none', background: 'transparent',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
          color: N.textMuted, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          padding: '2px 0',
        }}
      >
        <Plus size={13} /> Ajouter une condition
      </button>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: N.textMuted, fontSize: 12.5, fontFamily: 'inherit', padding: '6px 8px',
          }}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!nameOk || saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            border: 'none', borderRadius: 6, padding: '6px 12px',
            fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
            cursor: nameOk && !saving ? 'pointer' : 'default',
            background: nameOk && !saving ? N.text : N.sideBg,
            color: nameOk && !saving ? '#fff' : N.textFaint,
          }}
        >
          <Save size={13} />
          {saving ? 'Enregistrement…' : 'Enregistrer le filtre'}
        </button>
      </div>
    </motion.div>
  );
}
