// ValidationsView.jsx — la file des demandes de l'équipe finance, pour la direction.
//
// Dev (2026-09-23) : « Lény et Aurélie ont la même flexibilité, mais tout
// changement chez eux est en attente de validation d'Ismahane. Elle a un
// onglet avec ses demandes. Il faut qu'elles soient claires : ce que la
// personne a voulu modifier, ce qu'elle a modifié, ce qu'elle propose. Dès
// qu'elle valide, c'est pris en compte. »
//
// Une carte par demande : qui, quand, quel client ; la phrase du geste ;
// le tableau mois par mois avant → proposé ; le motif ; Valider / Refuser
// (avec motif). Si un mois a bougé depuis la demande, la carte le dit et le
// serveur refuse la validation : on relit avec l'auteur, on n'écrase pas.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, RefreshCw, TriangleAlert, ExternalLink } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { formatEUR, formatMonthLabel } from '../constants.js';

const N = {
  text: '#37352f', textMuted: '#787774', textFaint: '#9b9a97',
  border: '#e3e2e0', borderSft: '#ededec', sideBg: '#f7f7f5',
  red: '#b42318', redBg: '#fdecec', amber: '#b45309', amberBg: '#fff8ed',
  green: '#15794a', greenBg: '#e9f9f0', blue: '#1e40af', blueBg: '#e7f0fb',
};

const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS = {
  pending:   { label: 'En attente', bg: N.amberBg, fg: N.amber },
  approved:  { label: 'Validée',    bg: N.greenBg, fg: N.green },
  rejected:  { label: 'Refusée',    bg: N.redBg,   fg: N.red },
  withdrawn: { label: 'Retirée',    bg: N.sideBg,  fg: N.textMuted },
};

const ENTITY = { owner: 'Owner', optilex: "Opti'lex" };
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

// Ce que la demande change, mois par mois, dans les mots de l'écran :
// attendu, reçu, reste dû, pause, report. On part des valeurs proposées ;
// l'état d'avant vient de la photo prise au moment de la demande.
function monthChanges(req) {
  const before = req.before || {};
  const proposed = req.proposed || {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(proposed)])]
    .filter((k) => !k.startsWith('__')).sort();
  const rows = [];
  for (const iso of keys) {
    const b = before[iso] || {};
    const p = proposed[iso] || {};
    const changes = [];
    for (const ent of ['owner', 'optilex']) {
      const suffix = ent === 'owner' ? 'owner' : 'optilex_ttc';
      const expB = num(b[`expected_${suffix}`]);
      const recB = (num(b[`received_${suffix}`]) || 0) + (num(b[`received_overdue_${suffix}`]) || 0);
      const resteB = b[`remaining_${ent}`] !== undefined ? num(b[`remaining_${ent}`])
        : (expB !== null ? Math.max(expB - recB, 0) : null);
      if (p[`expected_${suffix}`] !== undefined) changes.push({ what: `Attendu ${ENTITY[ent]}`, before: expB, after: num(p[`expected_${suffix}`]) });
      if (p[`received_${suffix}`] !== undefined) changes.push({ what: `Reçu ${ENTITY[ent]}`, before: num(b[`received_${suffix}`]) || 0, after: num(p[`received_${suffix}`]) });
      if (p[`remaining_${ent}`] !== undefined) changes.push({ what: `Reste dû ${ENTITY[ent]}`, before: resteB, after: num(p[`remaining_${ent}`]), note: 'ajustement de créance' });
      if (p[`deferred_out_${ent}`] !== undefined) changes.push({ what: `Créance ${ENTITY[ent]} reportée ailleurs`, before: resteB, after: Math.max((resteB || 0) - num(p[`deferred_out_${ent}`]), 0), note: `−${formatEUR(num(p[`deferred_out_${ent}`]))}` });
      if (p[`deferred_in_${ent}`] !== undefined) changes.push({ what: `Créance ${ENTITY[ent]} reçue ici`, before: resteB, after: (resteB || 0) + num(p[`deferred_in_${ent}`]), note: `+${formatEUR(num(p[`deferred_in_${ent}`]))}` });
    }
    if (p.expected_paused !== undefined) {
      changes.push({
        what: 'Pause', text: true,
        before: b.expected_paused ? 'en pause' : 'exigible',
        after: p.expected_paused ? `en pause${p.expected_paused_until ? ` jusqu'au ${String(p.expected_paused_until).slice(0, 10).split('-').reverse().join('/')}` : ''}${p.owed === 'never' ? ', rien dû' : p.owed === 'later' ? ', à rattraper' : ''}` : 'exigible',
      });
    }
    rows.push({ iso, label: formatMonthLabel(iso.slice(0, 7)), changes, context: { b } });
  }
  return rows;
}

export default function ValidationsView({ onOpenClient, onChanged, showToast }) {
  const [tab, setTab] = useState('pending');            // 'pending' | 'done'
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [acting, setActing] = useState(null);           // id en cours
  const [confirm, setConfirm] = useState(null);         // { id, kind: 'approve' | 'reject' }
  const [notes, setNotes] = useState({});               // id -> motif de refus

  const load = useCallback(async (silent = false) => {
    if (!silent) setReloading(true);
    try {
      const status = tab === 'pending' ? 'pending' : 'all';
      const d = await apiClient.get(`/api/v1/finance-periods/client/requests?status=${status}&limit=200`);
      const list = Array.isArray(d?.items) ? d.items : [];
      setItems(tab === 'pending' ? list : list.filter((r) => r.status !== 'pending'));
      setError(null);
    } catch (e) {
      setError(e?.data?.detail || 'Chargement impossible');
      if (items === null) setItems([]);
    } finally {
      setReloading(false);
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    let pending = false;
    setItems(null);
    const tick = async (silent) => {
      if (cancelled || pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { await load(silent); } finally { pending = false; }
    };
    tick(false);
    const id = setInterval(() => tick(true), 15000);
    const onFocus = () => tick(true);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  const act = useCallback(async (req, kind) => {
    if (acting) return;
    const note = (notes[req.id] || '').trim();
    if (kind === 'reject' && !note) {
      showToast?.('Un motif de refus est attendu : l’auteur doit comprendre.', 'error');
      return;
    }
    setActing(req.id);
    try {
      await apiClient.post(`/api/v1/finance-periods/client/requests/${req.id}/${kind}`, { note: note || null });
      showToast?.(kind === 'approve'
        ? `Validé : ${req.requested_by_name || 'la demande'} — ${req.label}`
        : `Refusé : ${req.label}`, 'success');
      setConfirm(null);
      setNotes((n) => ({ ...n, [req.id]: '' }));
      await load(true);
      onChanged?.();
    } catch (e) {
      showToast?.(e?.data?.detail || 'Action impossible', 'error');
      await load(true);
    } finally {
      setActing(null);
    }
  }, [acting, notes, load, onChanged, showToast]);

  const pendingCount = useMemo(() => (items || []).filter((r) => r.status === 'pending').length, [items]);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 2px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', background: '#f1f1ef', border: `1px solid ${N.border}`, borderRadius: 8, padding: 2, gap: 2 }}>
          {[{ key: 'pending', label: tab === 'pending' && items ? `À valider (${pendingCount})` : 'À valider' }, { key: 'done', label: 'Traitées' }].map((o) => {
            const active = tab === o.key;
            return (
              <button key={o.key} type="button" onClick={() => setTab(o.key)} style={{
                position: 'relative', height: 26, padding: '0 12px', border: 'none', borderRadius: 6,
                background: active ? '#fff' : 'transparent', boxShadow: active ? '0 1px 3px rgba(15,15,15,0.12)' : 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? N.text : N.textMuted,
              }}>
                {o.label}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: N.textMuted }}>
          Chaque demande dit qui, quoi et pourquoi. Valider rejoue le geste sous votre nom, avec la trace de l’auteur ; refuser demande un mot pour lui.
        </span>
        <button type="button" onClick={() => load(false)} title="Actualiser" style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${N.border}`,
          background: '#fff', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', color: N.text,
        }}>
          <RefreshCw size={12} style={{ animation: reloading ? 'spin 0.8s linear infinite' : 'none' }} /> Actualiser
        </button>
      </div>

      {error && items !== null && (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: N.redBg, color: N.red, fontSize: 12.5 }}>{error}</div>
      )}
      {items === null && <div style={{ padding: 30, textAlign: 'center', color: N.textMuted, fontSize: 13 }}>Chargement…</div>}
      {items !== null && items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: N.textMuted, fontSize: 13, background: '#fff', border: `1px dashed ${N.border}`, borderRadius: 12 }}>
          {tab === 'pending' ? 'Aucune demande en attente.' : 'Aucune demande traitée.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(items || []).map((req, i) => (
          <RequestCard
            key={req.id}
            req={req}
            index={i}
            busy={acting === req.id}
            confirm={confirm?.id === req.id ? confirm.kind : null}
            onConfirm={(kind) => setConfirm(kind ? { id: req.id, kind } : null)}
            note={notes[req.id] || ''}
            onNote={(v) => setNotes((n) => ({ ...n, [req.id]: v }))}
            onAct={(kind) => act(req, kind)}
            onOpenClient={onOpenClient}
          />
        ))}
      </div>
    </div>
  );
}

function RequestCard({ req, index, busy, confirm, onConfirm, note, onNote, onAct, onOpenClient }) {
  const st = STATUS[req.status] || STATUS.pending;
  const months = useMemo(() => monthChanges(req), [req]);
  const pending = req.status === 'pending';
  const client = req.client || {};
  const title = [client.societe, client.numero_client].filter(Boolean).join(' · ') || `Client ${req.client_id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03 }}
      style={{ background: '#fff', border: `1px solid ${req.drift && pending ? '#f5dcb5' : N.border}`, borderRadius: 12, padding: '14px 16px' }}
    >
      {/* Qui, quand, quel client */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <button
            type="button"
            onClick={() => client.id && onOpenClient?.(client.id)}
            title="Ouvrir la fiche du client"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: N.text }}
          >
            {title} <ExternalLink size={12} style={{ color: N.textFaint }} />
          </button>
          <div style={{ fontSize: 12, color: N.textMuted, marginTop: 2 }}>
            <strong style={{ color: N.text }}>{req.requested_by_name || 'Quelqu’un'}</strong> · {fmtWhen(req.requested_at)} · {req.action_label}
          </div>
        </div>
        <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: st.bg, color: st.fg, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {st.label}
        </span>
      </div>

      {/* Ce qu'elle a voulu faire */}
      <div style={{ marginTop: 10, fontSize: 13.5, color: N.text, lineHeight: 1.5 }}>
        Demande de <strong>{req.label}</strong>.
      </div>
      {req.reason && (
        <div style={{ marginTop: 4, fontSize: 12.5, color: N.textMuted, fontStyle: 'italic' }}>« {req.reason} »</div>
      )}

      {/* Ce qu'elle a modifié, mois par mois : avant → proposé */}
      {months.some((m) => m.changes.length) && (
        <div style={{ marginTop: 12, border: `1px solid ${N.borderSft}`, borderRadius: 9, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(160px, 1.2fr) 120px 24px 120px', gap: 10, padding: '7px 12px', background: N.sideBg, fontSize: 10.5, fontWeight: 600, color: N.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span>Mois</span><span>Ce qui change</span><span style={{ textAlign: 'right' }}>Avant</span><span /><span style={{ textAlign: 'right' }}>Proposé</span>
          </div>
          {months.flatMap((m) => m.changes.map((c, j) => (
            <div key={`${m.iso}-${j}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(160px, 1.2fr) 120px 24px 120px', gap: 10, padding: '7px 12px', borderTop: `1px solid ${N.borderSft}`, fontSize: 12.5, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: N.text }}>{j === 0 ? m.label : ''}</span>
              <span style={{ color: N.text }}>{c.what}{c.note ? <span style={{ color: N.textFaint }}> · {c.note}</span> : null}</span>
              <span style={{ textAlign: 'right', color: N.textMuted, fontVariantNumeric: 'tabular-nums' }}>{c.text ? c.before : (c.before === null ? '—' : formatEUR(c.before))}</span>
              <span style={{ textAlign: 'center', color: N.textFaint }}>→</span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: N.text, fontVariantNumeric: 'tabular-nums' }}>{c.text ? c.after : (c.after === null ? '—' : formatEUR(c.after))}</span>
            </div>
          )))}
        </div>
      )}

      {/* Ce qui a bougé depuis : on n'écrase pas en silence */}
      {pending && req.drift && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 8, background: N.amberBg, color: N.amber, fontSize: 12.5 }}>
          <TriangleAlert size={14} /> {req.drift.charAt(0).toUpperCase() + req.drift.slice(1)} : à revoir avec {req.requested_by_name || 'l’auteur'} avant de valider.
        </div>
      )}

      {/* Traitée : par qui, quand, pourquoi */}
      {!pending && (
        <div style={{ marginTop: 10, fontSize: 12, color: N.textMuted }}>
          {req.status === 'approved' && <>Validée par {req.decided_by_name || 'la direction'} le {fmtWhen(req.decided_at)}{req.decision_note ? ` — « ${req.decision_note} »` : ''}.</>}
          {req.status === 'rejected' && <>Refusée par {req.decided_by_name || 'la direction'} le {fmtWhen(req.decided_at)}{req.decision_note ? ` — « ${req.decision_note} »` : ''}.</>}
          {req.status === 'withdrawn' && <>Retirée par {req.decided_by_name || 'son auteur'} le {fmtWhen(req.decided_at)}.</>}
        </div>
      )}

      {/* Valider / Refuser, en deux temps, au même endroit */}
      {pending && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {confirm === 'reject' ? (
            <>
              <input
                value={note}
                onChange={(e) => onNote(e.target.value)}
                placeholder="Pourquoi (visible par l’auteur et dans le fil du client)"
                autoFocus
                style={{ flex: '1 1 260px', border: `1px solid ${N.border}`, borderRadius: 7, padding: '7px 9px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}
              />
              <button type="button" disabled={busy || !note.trim()} onClick={() => onAct('reject')} style={btnStyle('danger', busy || !note.trim())}>
                <X size={13} /> {busy ? 'Refus…' : 'Confirmer le refus'}
              </button>
              <button type="button" disabled={busy} onClick={() => onConfirm(null)} style={btnStyle('ghost')}>Garder</button>
            </>
          ) : confirm === 'approve' ? (
            <>
              <span style={{ fontSize: 12.5, color: N.text }}>Appliquer ce geste maintenant, sous votre nom ?</span>
              <button type="button" disabled={busy} onClick={() => onAct('approve')} style={btnStyle('primary', busy)}>
                <Check size={13} /> {busy ? 'Validation…' : 'Confirmer la validation'}
              </button>
              <button type="button" disabled={busy} onClick={() => onConfirm(null)} style={btnStyle('ghost')}>Pas maintenant</button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy || !!req.drift} onClick={() => onConfirm('approve')} title={req.drift ? 'Les chiffres ont bougé : à revoir avec l’auteur' : 'Rejouer le geste, tracé « demande de …, validée »'} style={btnStyle('primary', busy || !!req.drift)}>
                <Check size={13} /> Valider
              </button>
              <button type="button" disabled={busy} onClick={() => onConfirm('reject')} style={btnStyle('solid')}>
                <X size={13} /> Refuser
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

function btnStyle(kind, disabled = false) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 7, padding: '7px 12px',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1, whiteSpace: 'nowrap', transition: 'opacity 0.12s',
  };
  if (kind === 'primary') return { ...base, border: 'none', background: N.text, color: '#fff' };
  if (kind === 'danger') return { ...base, border: 'none', background: N.red, color: '#fff' };
  if (kind === 'ghost') return { ...base, border: 'none', background: 'transparent', color: N.textMuted };
  return { ...base, border: `1px solid ${N.border}`, background: '#fff', color: N.text };
}
