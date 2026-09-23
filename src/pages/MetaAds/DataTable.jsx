// src/pages/MetaAds/DataTable.jsx — tableau de dimension façon Search Console.
//
// Onglets de dimension en tête (Créas, Campagnes, Régions…), colonnes triables
// (flèche sur la colonne active), chiffres alignés à droite en tabulaire,
// lignes cliquables quand un détail existe, et « Afficher plus » par pages
// de 25 : pas de pagination compliquée, la page reste lisible.

import React, { useMemo, useState } from 'react';
import Pict from './icons.jsx';

export function DimensionTabs({ T, tabs, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: `1px solid ${T.borderSoft}`, padding: '0 8px' }}>
      {tabs.map((t) => {
        const on = value === t.key;
        return (
          <button key={t.key} type="button" onClick={() => onChange(t.key)} aria-selected={on}
            style={{ position: 'relative', padding: '14px 14px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: on ? T.primary : T.textMuted, whiteSpace: 'nowrap' }}>
            {t.label}
            {on && <span style={{ position: 'absolute', left: 8, right: 8, bottom: -1, height: 3, borderRadius: '3px 3px 0 0', background: T.primary }} />}
          </button>
        );
      })}
    </div>
  );
}

export default function DataTable({ T, columns, rows, defaultSort, onRowClick, rowKey, loading, error, emptyText = 'Aucune donnée sur cette période.', pageSize = 25 }) {
  const [sort, setSort] = useState(defaultSort || { key: columns.find((c) => c.sortable !== false && c.align === 'right')?.key, dir: 'desc' });
  const [shown, setShown] = useState(pageSize);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows || [];
    const val = (r) => (col.sortValue ? col.sortValue(r) : r[col.key]);
    const list = [...(rows || [])];
    list.sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr');
      return sort.dir === 'asc' ? c : -c;
    });
    return list;
  }, [rows, columns, sort]);
  const th = (c) => ({ textAlign: c.align || 'left', padding: '10px 14px', fontSize: 12, fontWeight: 500, color: T.textMuted, whiteSpace: 'nowrap', cursor: c.sortable === false ? 'default' : 'pointer', userSelect: 'none', width: c.width, background: T.surface, borderBottom: `1px solid ${T.borderSoft}`, position: 'sticky', top: 0 });
  const td = { padding: '10px 14px', fontSize: 13, color: T.text, whiteSpace: 'nowrap', verticalAlign: 'middle', borderBottom: `1px solid ${T.borderSoft}` };
  const toggle = (c) => { if (c.sortable === false) return; setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' })); };
  const visible = sorted.slice(0, shown);

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 720 }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={th(c)} onClick={() => toggle(c)} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: sort.key === c.key ? T.text : T.textMuted }}>
                    {sort.key === c.key && <span style={{ display: 'inline-flex', transform: sort.dir === 'asc' ? 'rotate(90deg)' : 'rotate(-90deg)' }}><Pict name="back" size={12} /></span>}
                    {c.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={columns.length} style={{ ...td, textAlign: 'center', color: T.textFaint, padding: '28px 14px' }}>Chargement…</td></tr>}
            {!loading && error && <tr><td colSpan={columns.length} style={{ ...td, textAlign: 'center', color: T.red, padding: '28px 14px' }}>{error}</td></tr>}
            {!loading && !error && visible.length === 0 && <tr><td colSpan={columns.length} style={{ ...td, textAlign: 'center', color: T.textFaint, padding: '28px 14px' }}>{emptyText}</td></tr>}
            {!loading && !error && visible.map((r, i) => (
              <Row key={rowKey ? rowKey(r) : i} r={r} columns={columns} td={td} T={T} onClick={onRowClick} />
            ))}
          </tbody>
        </table>
      </div>
      {!loading && sorted.length > shown && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 10, borderTop: `1px solid ${T.borderSoft}` }}>
          <button type="button" onClick={() => setShown((n) => n + pageSize)} style={{ border: `1px solid ${T.border}`, background: T.surface, color: T.primary, borderRadius: T.radiusSm, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Afficher plus ({sorted.length - shown} restantes)
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ r, columns, td, T, onClick }) {
  const [hover, setHover] = useState(false);
  const clickable = !!onClick;
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={clickable ? () => onClick(r) : undefined}
      style={{ background: hover ? T.rowHover : 'transparent', cursor: clickable ? 'pointer' : 'default', transition: 'background 0.1s' }}>
      {columns.map((c) => (
        <td key={c.key} style={{ ...td, textAlign: c.align || 'left', fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : undefined, color: c.color ? c.color(r, T) : td.color, fontWeight: c.strong ? 500 : 400 }}>
          {c.render ? c.render(r, T) : c.format ? c.format(r[c.key]) : (r[c.key] ?? '—')}
        </td>
      ))}
    </tr>
  );
}
