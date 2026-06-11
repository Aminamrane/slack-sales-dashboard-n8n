// src/pages/Dialer/SupervisorPanel.jsx
//
// DAF view (finance_director ; admin also) : create a campaign, upload the
// call list (CSV), and watch live counters + time spent on calls.
// The DAF never makes calls.

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Upload, Phone, CheckCircle2, Clock, ListChecks, Loader2, Timer,
  ChevronDown, AlertTriangle,
} from 'lucide-react';
import dialerClient from '../../services/dialerClient.js';
import { formatDuration, prettyPhone, OUTCOME_META } from './theme.js';

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function SupervisorPanel({
  campaigns, selectedId, onSelect, stats, refreshStats, reloadCampaigns, theme,
}) {
  const T = theme;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null); // { kind: 'ok'|'err'|'warn', msg }
  const [items, setItems] = useState([]);
  const [showDetail, setShowDetail] = useState(false);
  const fileRef = useRef(null);

  const flash = (kind, msg) => { setToast({ kind, msg }); setTimeout(() => setToast(null), 4000); };

  // refetch the per-call detail whenever a new call completes (cheap signal)
  useEffect(() => {
    let alive = true;
    if (!selectedId) { setItems([]); return; }
    dialerClient.items(selectedId).then((r) => { if (alive) setItems(r || []); }).catch(() => {});
    return () => { alive = false; };
  }, [selectedId, stats?.appels_passes, stats?.total_duration_seconds]);

  const createCampaign = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const c = await dialerClient.createCampaign(name);
      setNewName(''); setCreating(false);
      await reloadCampaigns();
      onSelect(c.id);
      flash('ok', `Campagne « ${c.name} » créée.`);
    } catch (e) {
      flash('err', e?.message || 'Création impossible');
    } finally { setBusy(false); }
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedId) return;
    setBusy(true);
    try {
      const r = await dialerClient.uploadCsv(selectedId, file);
      await refreshStats();
      if (!r.inserted) {
        flash('warn', 'Aucune fiche valide importée — vérifie la colonne « phone » du CSV.');
      } else {
        flash('ok', `${r.inserted} fiche${r.inserted > 1 ? 's' : ''} importée${r.inserted > 1 ? 's' : ''}.`);
      }
    } catch (e) {
      flash('err', e?.message || 'Import impossible');
    } finally { setBusy(false); }
  };

  const total = stats?.total || 0;
  const pct = total ? Math.round(((stats?.appels_passes || 0) / total) * 100) : 0;
  const totalTalk = stats?.total_duration_seconds || 0;
  const calledItems = items.filter((it) => it.called_at);
  const todayTalk = calledItems.filter((it) => isToday(it.called_at)).reduce((a, it) => a + (it.duration_seconds || 0), 0);

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      {/* ── campaign bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <select value={selectedId || ''} onChange={(e) => onSelect(Number(e.target.value))}
          style={{
            padding: '10px 14px', borderRadius: 12, fontSize: 14, fontWeight: 600,
            color: T.text, background: T.surface, border: `1px solid ${T.border}`, cursor: 'pointer', minWidth: 220,
          }}>
          {campaigns.length === 0 && <option value="">Aucune campagne</option>}
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {!creating ? (
          <button onClick={() => setCreating(true)} style={ghostBtn(T)}>
            <Plus size={16} /> Nouvelle campagne
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createCampaign()} placeholder="Nom de la campagne"
              style={{
                padding: '10px 14px', borderRadius: 12, fontSize: 14, color: T.text,
                background: T.surface, border: `1px solid ${T.accent}`, outline: 'none', minWidth: 200,
              }} />
            <button onClick={createCampaign} disabled={busy} style={accentBtn(T)}>
              {busy ? <Loader2 size={15} className="dlr-spin" /> : 'Créer'}
            </button>
            <button onClick={() => { setCreating(false); setNewName(''); }} style={linkBtn(T)}>Annuler</button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button onClick={() => fileRef.current?.click()} disabled={!selectedId || busy}
          style={{ ...accentBtn(T), opacity: (!selectedId || busy) ? 0.5 : 1, cursor: (!selectedId || busy) ? 'not-allowed' : 'pointer' }}>
          {busy ? <Loader2 size={16} className="dlr-spin" /> : <Upload size={16} />} Importer un CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickFile} style={{ display: 'none' }} />
      </div>

      {/* ── toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div key="toast" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              marginBottom: 18, padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
              color: toast.kind === 'ok' ? T.green : toast.kind === 'warn' ? T.amber : T.red,
              background: toast.kind === 'ok' ? T.greenBg : toast.kind === 'warn' ? T.amberBg : T.redBg,
              border: `1px solid ${(toast.kind === 'ok' ? T.green : toast.kind === 'warn' ? T.amber : T.red)}33`,
            }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPI grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 22 }}>
        <Kpi T={T} icon={ListChecks} label="Total fiches" value={total} />
        <Kpi T={T} icon={CheckCircle2} label="Traités" value={stats?.traites || 0} tone={T.green} />
        <Kpi T={T} icon={Phone} label="Appels passés" value={stats?.appels_passes || 0} />
        <Kpi T={T} icon={Clock} label="Restants" value={stats?.restants || 0} tone={T.amber} />
        <Kpi T={T} icon={Timer} label="Temps total en appel" value={formatDuration(totalTalk)} tone={T.accent} />
        <Kpi T={T} icon={Timer} label="Session du jour" value={formatDuration(todayTalk)} />
      </div>

      {/* ── progress + last call ── */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: '20px 22px', boxShadow: T.shadowSoft, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>Avancement</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 99, background: T.borderSoft, overflow: 'hidden' }}>
          <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: '100%', borderRadius: 99, background: T.accent }} />
        </div>
        <div style={{ marginTop: 14, fontSize: 13, color: T.textFaint }}>
          Dernier appel : <span style={{ color: T.textMuted, fontWeight: 600 }}>{formatWhen(stats?.dernier_appel)}</span>
        </div>
      </div>

      {/* ── per-call detail (F2) ── */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, boxShadow: T.shadowSoft, overflow: 'hidden' }}>
        <button onClick={() => setShowDetail((v) => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 22px', border: 'none', background: 'transparent', cursor: 'pointer',
            color: T.text, fontSize: 14, fontWeight: 650,
          }}>
          <span>Détail des appels <span style={{ color: T.textFaint, fontWeight: 500 }}>({calledItems.length})</span></span>
          <motion.span animate={{ rotate: showDetail ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', color: T.textMuted }}>
            <ChevronDown size={18} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {showDetail && (
            <motion.div key="detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: 'hidden' }}>
              <div style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                {calledItems.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: T.textFaint, fontSize: 13 }}>Aucun appel encore.</div>
                ) : (
                  calledItems.map((it) => <CallRow key={it.id} T={T} item={it} />)
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`@keyframes dlrSpin { to { transform: rotate(360deg); } } .dlr-spin { animation: dlrSpin 0.8s linear infinite; }`}</style>
    </div>
  );
}

function CallRow({ T, item }) {
  const meta = OUTCOME_META[item.status];
  const tone = meta ? { green: T.green, amber: T.amber, red: T.red }[meta.tone] : T.textFaint;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px',
      borderBottom: `1px solid ${T.borderSoft}`, fontSize: 13.5,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 99, background: tone, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 650, color: T.text }}>{(item.first_name || '') + ' ' + (item.last_name || '')}</span>
        <span style={{ color: T.textFaint, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>{prettyPhone(item.phone)}</span>
      </div>
      <span style={{ color: T.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatWhen(item.called_at)}</span>
      <span style={{ width: 90, textAlign: 'right', fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {formatDuration(item.duration_seconds)}
      </span>
    </div>
  );
}

function Kpi({ T, icon: Icon, label, value, tone }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: '16px 18px', boxShadow: T.shadowSoft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.textFaint, marginBottom: 10 }}>
        <Icon size={15} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <motion.div key={String(value)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        style={{ fontSize: 26, fontWeight: 700, color: tone || T.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </motion.div>
    </div>
  );
}

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function accentBtn(T) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12,
    border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#fff',
    background: T.accent, boxShadow: `0 4px 12px ${T.accent}33`,
  };
}
function ghostBtn(T) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12,
    cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.text, background: T.surfaceAlt, border: `1px solid ${T.border}`,
  };
}
function linkBtn(T) {
  return { border: 'none', background: 'transparent', color: T.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
}
