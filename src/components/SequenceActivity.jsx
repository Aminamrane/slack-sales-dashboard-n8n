// Qui a reçu quoi, qui est en cours, qui attend : page « Séquences email ».
// Lecture seule ; les états et heures prévues viennent des règles d'envoi du
// serveur (plan_lead, reminder_due_at) : la page annonce ce que le cron fera.
// Lectures par `useLivePoll` : rien n'est interrogé onglet caché, la dernière lecture demandée l'emporte.
import apiClient from '../services/apiClient';
import useLivePoll from './sequences/useLivePoll.js';
import { Card, CountUp, Empty, ErrorState, Hint, Skeletons, StaleBanner } from './sequences/parts.jsx';
import { STATE_META, fmtWhen, isLate, num } from './sequences/format.js';

function List({ title, empty, rows, render }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span className="seq-list-title">{title}</span>
      {!rows.length ? <Empty>{empty}</Empty> : <div className="seq-list" tabIndex={0} role="region" aria-label={title}>{rows.map(render)}</div>}
    </div>
  );
}

function Row({ left, main, sub, right, tone }) {
  return (
    <div className="seq-row">
      <span className="seq-row-when">{left}</span>
      <span className="seq-row-main">{main}{sub && <span className="seq-row-sub"> · {sub}</span>}</span>
      <span className="seq-row-right" data-tone={tone}>{right}</span>
    </div>
  );
}

export function EmailActivity({ seqKey, delay = 0 }) {
  const url = `/api/v1/tracking/broad-sequence/${encodeURIComponent(seqKey)}/activity`;
  const { data, error, busy, refresh } = useLivePoll(() => apiClient.get(url), { key: url });
  const now = Date.now();
  return (
    <Card title="Activité de la séquence" delay={delay} busy={busy && !!data}
      hintTitle="Activité de la séquence"
      hint="Qui a reçu quoi, et qui va recevoir quoi et quand, selon la règle d’envoi elle-même (envois chaque minute).">
      {error && data && <StaleBanner text={`Actualisation impossible : ${error}`} busy={busy} onRetry={refresh} />}
      {!data && !error && <Skeletons blocks={[84, 160]} />}
      {!data && error && <ErrorState title="Activité indisponible" detail={error} busy={busy} onRetry={refresh} />}
      {data && (
        <>
          <div className="seq-states">
            {STATE_META.map(([k, label, hint, hue]) => {
              const n = data.counts?.[k];
              const alert = k === 'sans_sales' && n > 0;
              return (
                <div key={k} className="seq-state-tile" data-hue={hue} data-alert={alert ? 'true' : 'false'}>
                  <span className="seq-state-n" data-alert={alert ? 'true' : 'false'}><CountUp value={n} /></span>
                  <span className="seq-state-label">{label}<Hint label={`Détail : ${label}`}>{hint}</Hint></span>
                </div>
              );
            })}
          </div>
          <div className="seq-lists">
            <List title="Derniers envois" empty="Aucun email envoyé." rows={data.recent || []}
              render={(r) => <Row key={`${r.lead_id}-${r.email_num}`} left={fmtWhen(r.sent_at)} main={r.full_name || r.email}
                sub={`email ${r.email_num}/10${r.sales ? ` · ${r.sales}` : ''}`}
                right={r.clicked_at ? 'cliqué' : 'envoyé'} tone={r.clicked_at ? 'good' : 'muted'} />} />
            <List title={`Prochains envois (${num(data.upcoming_total)})`} empty={data.enabled ? 'Personne en attente.' : 'Séquence en pause : aucun envoi programmé.'} rows={data.upcoming || []}
              render={(u) => {
                const late = isLate(u.due_at, now);
                return <Row key={u.lead_id} left={fmtWhen(u.due_at)} main={u.full_name || u.email}
                  sub={`${u.state === 'en_file' ? '1er email' : `a reçu ${u.received}/10`} · ${u.sales || 'sans sales'}`}
                  right={`${late ? 'en retard · ' : ''}email ${u.next_num}`} tone={late ? 'warn' : undefined} />;
              }} />
          </div>
        </>
      )}
    </Card>
  );
}

export function SmsActivity({ delay = 0 }) {
  const { data, error, busy, refresh } = useLivePoll(() => apiClient.get('/api/v1/tracking/prospect-sms/activity'), { key: 'sms' });
  const tiles = data ? [
    ['Envoyés 24 h', data.counts?.sent_24h, 'blue'], ['Envoyés 7 jours', data.counts?.sent_7d, 'blue-soft'],
    ['Échecs 7 jours', data.counts?.failed_7d, 'orange'], ['À venir', data.counts?.pending, 'violet'],
  ] : [];
  return (
    <Card title="SMS prospects" delay={delay} busy={busy && !!data}
      hintTitle="SMS prospects"
      hint="Répondeur, Lapin et rappels de RDV (Brevo, expéditeur OWNER). Les SMS ne partent pas en rafale : le répondeur respecte l’espacement et les horaires d’envoi, les rappels partent à leur heure.">
      {error && data && <StaleBanner text={`Actualisation impossible : ${error}`} busy={busy} onRetry={refresh} />}
      {!data && !error && <Skeletons blocks={[84, 180]} />}
      {!data && error && <ErrorState title="SMS indisponibles" detail={error} busy={busy} onRetry={refresh} />}
      {data && (
        <>
          <div className="seq-sms-tiles">
            {tiles.map(([label, v, hue]) => {
              const alert = label.startsWith('Échecs') && v > 0;
              return (
                <div key={label} className="seq-state-tile" data-hue={hue} data-alert={alert ? 'true' : 'false'}>
                  <span className="seq-state-n" data-alert={alert ? 'true' : 'false'}><CountUp value={v} /></span>
                  <span className="seq-state-label">{label}</span>
                </div>
              );
            })}
          </div>
          <div className="seq-lists">
            <List title="Derniers SMS" empty="Aucun SMS envoyé." rows={data.recent || []}
              render={(r, i) => <Row key={i} left={fmtWhen(r.at)} main={r.full_name || r.phone}
                sub={`${r.type}${r.sales ? ` · ${r.sales}` : ''}`}
                right={r.status === 'sent' ? 'envoyé' : <span title={r.error || ''}>échec</span>} tone={r.status === 'sent' ? 'good' : 'low'} />} />
            <List title="Prochains SMS" empty="Aucun SMS programmé." rows={data.pending || []}
              render={(p, i) => <Row key={i} left={fmtWhen(p.at)} main={p.full_name || p.phone}
                sub={`${p.type} · ${p.why}`} right={p.sales || ''} />} />
          </div>
        </>
      )}
    </Card>
  );
}
