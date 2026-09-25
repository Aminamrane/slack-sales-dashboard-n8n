// Qui a reçu quoi, qui est en cours, qui attend : page « Séquences email ».
// Lecture seule ; les états et heures prévues viennent des règles d'envoi du
// serveur (plan_lead, reminder_due_at) : la page annonce ce que le cron fera.
import { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';

// Horodatage réel (avec fuseau) → heure de Paris ; heure murale sans fuseau → telle quelle.
function fmtWhen(iso) {
  if (!iso) return '·';
  const s = String(iso);
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const [d, t] = s.split('T');
    const [, m, day] = d.split('-');
    return `${day}/${m} ${t.slice(0, 5).replace(':', 'h')}`;
  }
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date(s)).replace(' ', ' ').replace(':', 'h');
}

function usePolling(url, ms = 20000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const load = () => apiClient.get(url)
      .then((r) => { if (alive) { setData(r); setError(''); } })
      .catch((e) => { if (alive) setError(e?.message || 'Indisponible'); });
    setData(null); load();
    const id = setInterval(load, ms);
    return () => { alive = false; clearInterval(id); };
  }, [url, ms]);
  return { data, error };
}

const STATE_META = [
  ['en_cours', 'En cours', 'ont reçu au moins un email, la suite est programmée'],
  ['en_file', 'En file', 'vont recevoir leur 1er email'],
  ['termine', 'Terminés', '10 emails reçus'],
  ['sorti', 'Sortis', 'RDV repris, signés, désabonnés ou requalifiés'],
  ['hors_cible', 'Hors cible', 'entrés en qualification avant l’activation'],
  ['recupere', 'Repris', 'récupérés dans le pool commun par un autre sales : séquence coupée'],
  ['sans_sales', 'Bloqués', 'ni sales ni ancien sales, ou lead archivé : rien ne part'],
  ['doublon', 'Doublons', 'même adresse déjà contactée via une autre fiche'],
];

function List({ C, title, empty, rows, render }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>{title}</div>
      {!rows.length ? <div style={{ fontSize: 12, color: C.muted, padding: '6px 0' }}>{empty}</div> : (
        <div style={{ display: 'grid', gap: 2, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>{rows.map(render)}</div>
      )}
    </div>
  );
}

function Row({ C, left, main, sub, right, tone }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '82px minmax(0,1fr) auto', gap: 10, alignItems: 'baseline', padding: '6px 8px', borderRadius: 8, background: tone || 'transparent' }}>
      <span style={{ fontSize: 11.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{left}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{main}</span>
        {sub && <span style={{ fontSize: 11, color: C.muted }}> · {sub}</span>}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600 }}>{right}</span>
    </div>
  );
}

export function EmailActivity({ seqKey, C, card }) {
  const { data, error } = usePolling(`/api/v1/tracking/broad-sequence/${encodeURIComponent(seqKey)}/activity`);
  const now = Date.now();
  return (
    <div style={{ ...card, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Activité de la séquence</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Qui a reçu quoi, et qui va recevoir quoi et quand, selon la règle d’envoi elle-même (envois chaque minute).</div>
      {error && <div style={{ fontSize: 12, color: '#b42318' }}>{error}</div>}
      {!data ? <div style={{ fontSize: 12, color: C.muted }}>Chargement…</div> : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {STATE_META.map(([k, label, hint]) => (
              <div key={k} title={hint} style={{ padding: '7px 11px', borderRadius: 10, border: '1px solid ' + C.border, background: k === 'sans_sales' && data.counts[k] ? '#fff4e0' : C.bg }}>
                <div style={{ fontSize: 17, fontWeight: 780, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{data.counts[k] ?? 0}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text2 }}>{label}</div>
                <div style={{ fontSize: 10.5, color: C.muted, maxWidth: 170 }}>{hint}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            <List C={C} title="Derniers envois" empty="Aucun email envoyé." rows={data.recent}
              render={(r) => <Row key={`${r.lead_id}-${r.email_num}`} C={C} left={fmtWhen(r.sent_at)} main={r.full_name || r.email}
                sub={`email ${r.email_num}/10${r.sales ? ' · ' + r.sales : ''}`}
                right={r.clicked_at ? <span style={{ color: C.ok }}>cliqué</span> : <span style={{ color: C.muted }}>envoyé</span>} />} />
            <List C={C} title={`Prochains envois (${data.upcoming_total})`} empty={data.enabled ? 'Personne en attente.' : 'Séquence en pause : aucun envoi programmé.'} rows={data.upcoming}
              render={(u) => {
                const late = new Date(u.due_at).getTime() < now - 5 * 60000;
                return <Row key={u.lead_id} C={C} left={fmtWhen(u.due_at)} main={u.full_name || u.email}
                  sub={`${u.state === 'en_file' ? '1er email' : `a reçu ${u.received}/10`} · ${u.sales || 'sans sales'}`}
                  right={<span style={{ color: late ? '#b45309' : C.text2 }}>{late ? 'en retard · ' : ''}email {u.next_num}</span>} />;
              }} />
          </div>
        </>
      )}
    </div>
  );
}

export function SmsActivity({ C, card }) {
  const { data, error } = usePolling('/api/v1/tracking/prospect-sms/activity');
  const tiles = data ? [
    ['Envoyés 24 h', data.counts.sent_24h], ['Envoyés 7 jours', data.counts.sent_7d],
    ['Échecs 7 jours', data.counts.failed_7d], ['À venir', data.counts.pending],
  ] : [];
  return (
    <div style={{ ...card, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>SMS prospects</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Répondeur, Lapin et rappels de RDV (Brevo, expéditeur OWNER). Les SMS ne partent pas en rafale : le répondeur respecte l’espacement et les horaires d’envoi, les rappels partent à leur heure.</div>
      {error && <div style={{ fontSize: 12, color: '#b42318' }}>{error}</div>}
      {!data ? <div style={{ fontSize: 12, color: C.muted }}>Chargement…</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
            {tiles.map(([label, v]) => (
              <div key={label} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid ' + C.border }}>
                <div style={{ fontSize: 20, fontWeight: 780, color: label.startsWith('Échecs') && v ? '#b42318' : C.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            <List C={C} title="Derniers SMS" empty="Aucun SMS envoyé." rows={data.recent}
              render={(r, i) => <Row key={i} C={C} left={fmtWhen(r.at)} main={r.full_name || r.phone}
                sub={`${r.type}${r.sales ? ' · ' + r.sales : ''}`}
                right={r.status === 'sent' ? <span style={{ color: C.ok }}>envoyé</span> : <span style={{ color: '#b42318' }} title={r.error || ''}>échec</span>} />} />
            <List C={C} title="Prochains SMS" empty="Aucun SMS programmé." rows={data.pending}
              render={(p, i) => <Row key={i} C={C} left={fmtWhen(p.at)} main={p.full_name || p.phone}
                sub={`${p.type} · ${p.why}`} right={<span style={{ color: C.text2 }}>{p.sales || ''}</span>} />} />
          </div>
        </>
      )}
    </div>
  );
}
