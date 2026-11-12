// SequencesView.jsx — onglet « Séquences » : le suivi des envois de la finance.
//
// Demande dev 2026-09-29 : « quand on envoie des séquences email ou SMS, faut
// qu'on ait un suivi […] ouvrir chaque séquence, un peu comme s'ils étaient
// dans un email, voir à qui elle a été envoyée, voir le taux d'ouverture ».
// Pour les SMS, « si on sait dire si ça a bien été délivré, c'est suffisant ».
// Puis : répertorier chaque envoi, « ils vont en envoyer plus tard dans
// d'autres jours ».
//
// Un envoi = les emails d'un même objet partis le même jour, et les SMS
// envoyés aux mêmes clients dans la foulée. Les ouvertures ne sont suivies que
// depuis le 18/08 (avant : « non suivi », jamais un 0 % trompeur) et celles
// d'un robot, à la réception, ne comptent pas. Le contenu d'un email est lu
// chez Resend à l'ouverture.
//
// Refonte dev 10/11/2026 : la liste et le détail d'un envoi parlent le langage
// des Statistiques (chiffres clés, anneaux et barres de remise, tableaux à
// en-têtes illustrés). Les chargements et les règles de lecture sont ceux
// d'origine.
//
// Depuis le 12/11/2026, l'onglet s'ouvre sur les séquences que la finance
// configure elle-même (SequenceRules.jsx) ; ce suivi reste à un clic (« Envois »)
// et montre aussi leurs messages, un envoi par séquence et par jour.
//
// Sources : GET /finance-sequences, /finance-sequences/detail?key=…,
// /finance-sequences/messages/{id}/content.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowLeft, Building2, Eye, Mail, MailCheck, MailOpen, MessageSquare, MessageSquareText, Search, Send, TriangleAlert, Users, X,
} from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { reducedMotion, useDrawn } from '../../../components/perfSales/motion.jsx';
import { count, plural } from '../statistics/model.js';
import { Fill, ProgressRing } from '../statistics/parts.jsx';
import { Card, Empty, Num, OpenCue, Page, Pill, RefreshButton, Reveal, Segmented, Stat, Stats, TableBox, Tag, Th } from './PageKit.jsx';
import SequenceRules from './SequenceRules.jsx';
import './FollowupTabs.css';

const GREEN = '#6cc493';
const AMBER = '#f1b76a';
const BLUE = '#8fbdf3';
const RED = '#ee8f8a';
const GREY = '#cfc8bd';

const STATUS = {
  sent:      { label: 'Envoyé',  tone: 'grey' },
  delivered: { label: 'Délivré', tone: 'blue' },
  opened:    { label: 'Ouvert',  tone: 'green' },
  clicked:   { label: 'Ouvert',  tone: 'green' },   // clics retirés de l'écran (dev 29/09)
  failed:    { label: 'Échec',   tone: 'red' },
};

const FAILURE_LABEL = {
  bounced: 'adresse rejetée', complained: 'signalé comme indésirable', hardBounce: 'numéro invalide',
  softBounce: 'refus temporaire', blocked: 'bloqué', rejected: 'rejeté', failed: 'échec d’envoi',
};

// Où en est un destinataire, tous canaux confondus : un échec d'abord, sinon le mieux obtenu.
const REACH = {
  opened:    { label: 'A ouvert l’email', color: GREEN },
  delivered: { label: 'Remis',            color: BLUE },
  sent:      { label: 'Parti, remise en attente', color: GREY },
  failed:    { label: 'En échec',         color: RED },
};
const REACH_ORDER = ['opened', 'delivered', 'sent', 'failed'];
const reach = (r) => {
  const states = [r.email, r.sms].filter(Boolean)
    .map((m) => (m.failed_at || m.status === 'failed' ? 'failed' : m.status === 'clicked' ? 'opened' : (REACH[m.status] ? m.status : 'sent')));
  return ['failed', 'opened', 'delivered'].find((key) => states.includes(key)) || 'sent';
};

const pct = (v) => (v == null ? null : `${Math.round(v * 100)} %`);

// 33627222732 → +33 6 27 22 27 32
const phone = (raw) => {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('33') ? `+33 ${d[2]} ${d.slice(3).match(/../g).join(' ')}` : raw;
};

// Heure de Paris : un envoi du soir ne glisse pas au lendemain.
const when = (iso, withTime = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : { year: 'numeric' }),
  });
};

// « 2026-09-29 » (jour de Paris calculé côté API) → « 29/09/2026 », sans passer par Date.
const day = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');

const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ratio = (part, total) => (total ? part / total : null);

// Deux vues dans l'onglet (dev 12/11/2026) : les séquences que la finance configure, et le suivi de tous les envois.
const MODES = [
  { key: 'rules', label: 'Séquences', title: 'Les relances que vous réglez vous-même' },
  { key: 'sends', label: 'Envois', title: 'Chaque envoi parti, sa remise et ses ouvertures' },
];

export default function SequencesView({ onOpenClient, readOnly = false }) {
  const [mode, setMode] = useState('rules');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [openKey, setOpenKey] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReloading(true);
      try {
        const d = await apiClient.get('/api/v1/finance-sequences');
        if (!cancelled) { setItems(d?.items || []); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e?.data?.detail || e?.message || 'chargement impossible');
      } finally {
        if (!cancelled) setReloading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const totaux = useMemo(() => {
    const t = { emails: 0, opensBase: 0, opened: 0, sms: 0, smsDelivered: 0, emailDelivered: 0, emailFailed: 0, smsFailed: 0 };
    for (const s of items || []) {
      if (s.email) {
        t.emails += s.email.sent;
        t.opensBase += s.email.opens_base || 0;
        t.opened += s.email.opened;
        t.emailDelivered += s.email.delivered || 0;
        t.emailFailed += s.email.failed || 0;
      }
      if (s.sms) {
        t.sms += s.sms.sent;
        t.smsDelivered += s.sms.delivered;
        t.smsFailed += s.sms.failed || 0;
      }
    }
    return t;
  }, [items]);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return (items || []).filter((s) => !q || fold(`${s.label} ${day(s.date)}`).includes(q));
  }, [items, query]);

  const reload = () => setRefresh((n) => n + 1);

  const switcher = <Segmented options={MODES} value={mode} onChange={setMode} label="Vue de l’onglet Séquences" />;
  if (mode === 'rules') return <SequenceRules readOnly={readOnly} onOpenClient={onOpenClient} switcher={switcher} />;

  if (openKey) {
    return <SequenceDetail sequenceKey={openKey} onBack={() => setOpenKey(null)} onOpenClient={onOpenClient} />;
  }

  const head = {
    title: 'Envois',
    sub: 'Chaque envoi d’emails et de SMS de la finance : à qui il est parti, s’il a été remis, s’il a été ouvert.',
    actions: <>{switcher}<RefreshButton onClick={reload} busy={reloading} /></>,
  };

  if (error && items === null) {
    return (
      <Page {...head}>
        <div className="fst-error" role="alert">Séquences indisponibles · {error}<button type="button" onClick={reload}>Réessayer</button></div>
      </Page>
    );
  }
  if (items === null) return <Page {...head}><Empty boxed>Chargement des séquences…</Empty></Page>;

  const failed = totaux.emailFailed + totaux.smsFailed;
  // La page défile en entier : on remonte en haut avant d'ouvrir le détail d'un envoi.
  const open = (event, key) => {
    event.currentTarget.closest('.tsf-stage')?.scrollTo?.({ top: 0 });
    setOpenKey(key);
  };

  return (
    <Page {...head}>
      <Stats>
        <Stat label="Envois" Icon={Send} value={items.length} note="séquences de la finance" />
        <Stat label="Emails envoyés" Icon={Mail} value={totaux.emails}
          note={totaux.opensBase ? `ouverts à ${pct(totaux.opened / totaux.opensBase)} (depuis le suivi)` : 'ouvertures non suivies'} />
        <Stat label="SMS envoyés" Icon={MessageSquare} value={totaux.sms}
          note={totaux.sms ? `délivrés à ${pct(totaux.smsDelivered / totaux.sms)}` : 'aucun SMS suivi'} />
        <Stat label="Échecs" Icon={TriangleAlert} value={failed} tone={failed ? 'red' : undefined}
          note={failed ? 'emails et SMS qui ne sont pas arrivés' : 'tout est arrivé'} />
      </Stats>

      {items.length > 0 && (
        <Reveal className="fst-grid is-even">
          <Card title="Emails" Icon={MailOpen} hint="Sur tous les envois : ce qui a été remis, puis ouvert. Les ouvertures ne se lisent que sur les envois suivis.">
            <Channel
              rate={ratio(totaux.opened, totaux.opensBase)} ringLabel="ouverts" empty={totaux.emails ? 'non suivi' : 'aucun email'}
              lines={[
                { label: 'Délivrés', part: totaux.emailDelivered, total: totaux.emails, color: BLUE },
                { label: 'Ouverts', part: totaux.opened, total: totaux.opensBase, color: GREEN, none: 'non suivi' },
                { label: 'En échec', part: totaux.emailFailed, total: totaux.emails, color: RED },
              ]} />
          </Card>
          <Card title="SMS" Icon={MessageSquareText} hint="Un SMS n’a pas d’ouverture : on suit sa remise, message par message.">
            <Channel
              rate={ratio(totaux.smsDelivered, totaux.sms)} ringLabel="délivrés" empty="aucun SMS"
              lines={[
                { label: 'Délivrés', part: totaux.smsDelivered, total: totaux.sms, color: GREEN },
                { label: 'En attente', part: Math.max(totaux.sms - totaux.smsDelivered - totaux.smsFailed, 0), total: totaux.sms, color: GREY },
                { label: 'En échec', part: totaux.smsFailed, total: totaux.sms, color: RED },
              ]} />
          </Card>
        </Reveal>
      )}

      <Reveal amount={0.03}>
        <Card title="Tous les envois" Icon={Send}
          hint={`Les plus récents d’abord. Un clic ouvre l’envoi : son contenu et ses destinataires.${error ? ' Actualisation indisponible, réessayez.' : ''}`}>
          {items.length === 0 ? <Empty boxed>Aucune séquence envoyée par la finance pour l’instant.</Empty> : (
            <>
              <div className="fst-tools">
                <span className="fst-cell-muted">{plural(visible.length, 'envoi')}</span>
                <label className="fst-search">
                  <Search size={14} />
                  <input type="search" placeholder="Objet, date…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher un envoi" />
                </label>
              </div>
              <TableBox minWidth={860} after={visible.length === 0 && <Empty>Aucun envoi ne correspond à cette recherche.</Empty>}>
                <thead>
                  <tr>
                    <Th Icon={Send}>Envoi</Th>
                    <Th Icon={MailCheck} num>Emails délivrés</Th>
                    <Th Icon={Eye} num>Ouverts</Th>
                    <Th Icon={MessageSquare} num>SMS délivrés</Th>
                    <Th Icon={TriangleAlert} num>Échecs</Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s, i) => {
                    const lost = (s.email?.failed || 0) + (s.sms?.failed || 0);
                    return (
                      <tr key={s.key} style={{ '--i': Math.min(i, 14) }} data-open="true" onClick={(e) => open(e, s.key)} title="Ouvrir cet envoi">
                        <td>
                          <div className="fup-envoi">
                            <Canaux email={!!s.email} sms={!!s.sms} />
                            <div>
                              <div className="fst-cell-main">{s.label}<OpenCue /></div>
                              <div className="fst-cell-sub fst-num">Envoyée le {day(s.date)}</div>
                            </div>
                          </div>
                        </td>
                        {s.email
                          ? <Taux part={s.email.delivered} total={s.email.sent} rate={s.email.delivery_rate} color={s.email.delivery_rate === 1 ? GREEN : AMBER}
                            tint={s.email.delivery_rate === 1 ? 'green' : 'amber'} />
                          : <Vide texte="—" />}
                        {s.email?.opens_tracked
                          ? <Taux part={s.email.opened} rate={s.email.open_rate} color={BLUE} />
                          : <Vide texte={s.email ? 'non suivi' : '—'} />}
                        {s.sms
                          ? <Taux part={s.sms.delivered} total={s.sms.sent} rate={s.sms.delivery_rate} color={s.sms.delivery_rate === 1 ? GREEN : AMBER}
                            tint={s.sms.delivery_rate === 1 ? 'green' : 'amber'} />
                          : <Vide texte="—" />}
                        <td className={`is-num fst-num ${lost ? 'fup-tone-red' : 'fup-tone-zero'}`} style={{ fontWeight: 500 }}>{count(lost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {visible.length > 1 && !query.trim() && (
                  <tfoot>
                    <tr>
                      <td>{plural(visible.length, 'envoi')}</td>
                      <td className="is-num fst-num">{count(totaux.emailDelivered)} / {count(totaux.emails)}</td>
                      <td className="is-num fst-num">{totaux.opensBase ? `${count(totaux.opened)} / ${count(totaux.opensBase)}` : '—'}</td>
                      <td className="is-num fst-num">{totaux.sms ? `${count(totaux.smsDelivered)} / ${count(totaux.sms)}` : '—'}</td>
                      <td className={`is-num fst-num${failed ? ' fup-tone-red' : ''}`}>{count(failed)}</td>
                    </tr>
                  </tfoot>
                )}
              </TableBox>
            </>
          )}
        </Card>
      </Reveal>
    </Page>
  );
}

// ── Un canal sur tous les envois : l'anneau du taux qui compte, puis remis / ouverts / en échec ─────
function Channel({ rate, ringLabel, empty, lines }) {
  return (
    <div className="fst-goal fup-goal">
      <ProgressRing value={rate || 0} size={116} stroke={10} color={GREEN} label={rate == null ? empty : `${pct(rate)} ${ringLabel}`}>
        {rate == null
          ? <div className="fst-ring-sub" style={{ marginTop: 0 }}>{empty}</div>
          : <><Num className="fst-ring-num" value={rate} format={pct} /><div className="fst-ring-sub">{ringLabel}</div></>}
      </ProgressRing>
      <div className="fst-dist fup-rates">
        {lines.map((line) => (
          <div key={line.label} className="fst-dist-row">
            <span>{line.label}</span>
            <Fill value={line.total ? line.part / line.total : 0} color={line.color} />
            <span className="fst-num">
              {line.total ? pct(line.part / line.total) : (line.none || '—')}
              {line.total > 0 && <small>{count(line.part)}</small>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Le détail d'un envoi : ses chiffres, l'email tel qu'il est parti, puis chaque destinataire ──────
function SequenceDetail({ sequenceKey, onBack, onOpenClient }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [shownId, setShownId] = useState(null);
  const [status, setStatus] = useState(null);
  const [query, setQuery] = useState('');
  const previewRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get(`/api/v1/finance-sequences/detail?key=${encodeURIComponent(sequenceKey)}`)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setShownId(d?.recipients?.find((r) => r.email)?.email.id || null);
      })
      .catch((e) => { if (!cancelled) setError(e?.data?.detail || e?.message || 'chargement impossible'); });
    return () => { cancelled = true; };
  }, [sequenceKey]);

  const recipients = useMemo(() => detail?.recipients || [], [detail]);
  const reached = useMemo(() => {
    const c = { opened: 0, delivered: 0, sent: 0, failed: 0 };
    for (const r of recipients) c[reach(r)] += 1;
    return c;
  }, [recipients]);
  const visible = useMemo(() => {
    const q = fold(query.trim());
    return recipients.filter((r) => (!status || reach(r) === status)
      && (!q || fold([r.client?.societe, r.client?.numero_client, r.email?.recipient, r.sms?.recipient].join(' ')).includes(q)));
  }, [recipients, status, query]);

  const back = <Retour onBack={onBack} />;
  if (error) {
    return (
      <Page title="Séquence" actions={back}>
        <div className="fst-error" role="alert">Séquence indisponible · {error}</div>
      </Page>
    );
  }
  if (!detail) return <Page title="Séquence" actions={back}><Empty boxed>Chargement de la séquence…</Empty></Page>;

  const { email, sms } = detail;
  const shown = recipients.find((r) => r.email?.id === shownId)?.email;
  const failed = (email?.failed || 0) + (sms?.failed || 0);
  const channels = email && sms ? ' par email et SMS' : email ? ' par email' : ' par SMS';

  // Un clic sur un destinataire affiche son email, et ramène l'aperçu sous les yeux.
  const show = (id) => {
    setShownId(id);
    previewRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <Page title={detail.label} actions={back}
      sub={`Envoyée le ${day(detail.date)}, à ${recipients.length} client${recipients.length > 1 ? 's' : ''}${channels}`}>
      <Stats>
        {email && (
          <Stat label="Emails délivrés" Icon={MailCheck} text={`${email.delivered} / ${email.sent}`} note={pct(email.delivery_rate)}
            tone={email.delivery_rate === 1 ? 'green' : 'amber'} />
        )}
        {email && (email.opens_tracked
          ? <Stat label="Ouverts" Icon={Eye} value={email.opened} note={pct(email.open_rate)} tone="green" />
          : <Stat label="Ouvertures" Icon={Eye} text="non suivies" note="envoi antérieur au suivi" />)}
        {sms && (
          <Stat label="SMS délivrés" Icon={MessageSquare} text={`${sms.delivered} / ${sms.sent}`} note={pct(sms.delivery_rate)}
            tone={sms.delivery_rate === 1 ? 'green' : 'amber'} />
        )}
        {failed > 0 && <Stat label="Échecs" Icon={TriangleAlert} value={failed} tone="red" note="messages qui ne sont pas arrivés" />}
      </Stats>

      <Reveal className="fst-grid">
        {/* Le contenu envoyé : celui du client choisi dans la liste. */}
        <Card title={shown ? 'L’email reçu' : 'Le message'} Icon={MailOpen} ref={previewRef} style={{ scrollMarginTop: 78 }}
          hint={shown ? 'Tel que le client choisi dans la liste l’a reçu.' : undefined}>
          {shown ? <Contenu message={shown} /> : (
            <Empty boxed>Brevo ne conserve pas le texte des SMS envoyés : on suit leur remise, message par message.</Empty>
          )}
        </Card>

        {/* L'en-tête, comme dans une messagerie. */}
        <Card title="L’envoi" Icon={Send} hint="D’où il est parti, et où en est chaque destinataire. Un clic filtre la liste.">
          <Reached counts={reached} total={recipients.length} status={status} onStatus={setStatus} />
          <dl className="fst-kv">
            <dt>Envoyée le</dt><dd className="fst-num">{day(detail.date)}</dd>
            <dt>Canaux</dt><dd><Canaux email={!!email} sms={!!sms} /></dd>
            {email && <><dt>De</dt><dd style={{ overflowWrap: 'anywhere' }}>{detail.sender || '—'}</dd></>}
            {email && <><dt>Répondre à</dt><dd style={{ overflowWrap: 'anywhere' }}>{detail.reply_to || '—'}</dd></>}
          </dl>
        </Card>
      </Reveal>

      <Reveal amount={0.03}>
        <Card title="Destinataires" Icon={Users}
          hint={email ? 'Un clic sur une ligne affiche l’email reçu par ce client ; son nom ouvre sa fiche.' : 'Le nom d’un client ouvre sa fiche.'}>
          <div className="fst-tools">
            <span className="fst-cell-muted">{plural(visible.length, 'destinataire')}</span>
            <AnimatePresence initial={false}>
              {status && (
                <Motion.button key={status} type="button" className="fst-chip" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }} onClick={() => setStatus(null)} title="Retirer ce filtre">
                  {REACH[status].label}<X size={13} />
                </Motion.button>
              )}
            </AnimatePresence>
            <label className="fst-search">
              <Search size={14} />
              <input type="search" placeholder="Client, adresse, numéro…" value={query} onChange={(e) => setQuery(e.target.value)}
                aria-label="Chercher un destinataire" />
            </label>
          </div>
          <TableBox minWidth={900} after={visible.length === 0 && <Empty>Aucun destinataire ne correspond à ces filtres.</Empty>}>
            <thead>
              <tr>
                <Th Icon={Building2}>Client</Th>
                <Th Icon={Mail}>Email</Th>
                <Th Icon={Eye}>Ouvertures</Th>
                <Th Icon={MessageSquare}>SMS</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const actif = r.email && r.email.id === shown?.id;
                return (
                  <tr key={(r.email || r.sms).id} style={{ '--i': Math.min(i, 14) }} className={actif ? 'fup-on' : undefined}
                    data-open={r.email ? 'true' : undefined} onClick={() => r.email && show(r.email.id)}
                    title={r.email ? 'Afficher l’email reçu par ce client' : undefined}>
                    <td>
                      {r.client ? (
                        <>
                          <button type="button" className="fst-case-name" title="Ouvrir la fiche du client"
                            onClick={(e) => { e.stopPropagation(); onOpenClient?.(r.client.id); }}>
                            {r.client.societe || '—'}
                          </button>
                          {r.client.numero_client && <div className="fst-cell-sub fst-num">n° {r.client.numero_client}</div>}
                        </>
                      ) : <span className="fst-cell-muted">Client non retrouvé</span>}
                    </td>
                    <td><Envoi message={r.email} label={r.email?.recipient} /></td>
                    <td className="fst-num">
                      {!r.email ? <span className="fst-cell-muted">—</span>
                        : r.email.failed_at ? <span className="fst-cell-muted">—</span>
                        : r.email.opens == null ? <span className="fst-cell-muted">non suivi</span>
                        : r.email.opens > 0 ? (
                          <>
                            <span style={{ fontWeight: 500 }}>{r.email.opens} fois</span>
                            <div className="fst-cell-sub" style={{ whiteSpace: 'nowrap' }}>dernière le {when(r.email.last_open)}</div>
                          </>
                        ) : <span className="fst-cell-muted">pas encore</span>}
                    </td>
                    <td><Envoi message={r.sms} label={r.sms && phone(r.sms.recipient)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </TableBox>
        </Card>
      </Reveal>
    </Page>
  );
}

// Où en sont les destinataires : une barre découpée, puis sa légende qui filtre la liste.
function Reached({ counts, total, status, onStatus }) {
  const drawn = useDrawn();
  const present = REACH_ORDER.filter((key) => counts[key] > 0);
  return (
    <>
      <div className="fst-split" aria-hidden="true" style={{ marginTop: 4 }}>
        {present.map((key) => (
          <i key={key} style={{ flexGrow: drawn ? counts[key] : 0, flexBasis: 0, background: REACH[key].color, opacity: !status || status === key ? 1 : 0.25 }} />
        ))}
      </div>
      <div className="fst-legend">
        {present.map((key) => (
          <button key={key} type="button" className="fst-legend-row" aria-pressed={status === key} onClick={() => onStatus(status === key ? null : key)}
            title="Voir ces destinataires dans la liste">
            <span className="fst-dot" style={{ background: REACH[key].color }} />
            {REACH[key].label}
            <b className="fst-num">{count(counts[key])}</b>
            <small className="fst-num">{pct(total ? counts[key] / total : 0)}</small>
          </button>
        ))}
      </div>
    </>
  );
}

// Un message dans la liste des destinataires : adresse ou numéro, statut, remise.
function Envoi({ message, label }) {
  if (!message) return <span className="fst-cell-muted">—</span>;
  const st = STATUS[message.status] || STATUS.sent;
  return (
    <>
      <div className="fst-num" style={{ whiteSpace: 'nowrap' }}>{label}</div>
      <div className="fup-status">
        <Pill plain tone={st.tone}>{st.label}</Pill>
        {message.failed_at
          ? <span className="fup-tone-red">{FAILURE_LABEL[message.failure] || message.failure}</span>
          : <span className="fst-num">{message.delivered_at ? `délivré le ${when(message.delivered_at)}` : `envoyé le ${when(message.sent_at)}`}</span>}
      </div>
    </>
  );
}

// Aperçu verrouillé : sandbox vide (ni script ni navigation, un clic dans
// l'aperçu ne compte pas comme un clic du client) et images limitées à nos
// hôtes exacts, pour qu'un pixel de suivi ne compte jamais une ouverture
// quand la finance relit l'email. Une image hébergée ailleurs ne s'affiche pas.
const PREVIEW_CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; '
  + 'img-src data: https://webinaire.ownertechnology.com https://www.ownertechnology.com; style-src \'unsafe-inline\'">';

// Le contenu exact d'un email, lu chez Resend (jamais stocké chez nous).
function Contenu({ message }) {
  const [state, setState] = useState({ id: null, data: null, error: null });
  const id = message?.id;
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setState({ id, data: null, error: null });
    apiClient.get(`/api/v1/finance-sequences/messages/${id}/content`)
      .then((d) => { if (!cancelled) setState({ id, data: d, error: null }); })
      .catch((e) => { if (!cancelled) setState({ id, data: null, error: e?.data?.detail || 'Contenu indisponible.' }); });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="fst-table-box">
      <div className="fup-mail-head">
        Email reçu par <strong>{message?.recipient || '—'}</strong>
        {message?.sent_at ? ` le ${when(message.sent_at)}` : ''}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <Motion.div key={state.data?.html ? `mail-${state.id}` : `wait-${state.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}>
          {state.data?.html ? (
            <iframe
              title="Contenu de l’email"
              sandbox=""
              srcDoc={PREVIEW_CSP + state.data.html}
              className="fup-mail-frame"
            />
          ) : (
            <div className="fup-mail-body">
              {state.error || (state.data ? (state.data.text || 'Email sans contenu HTML.') : 'Chargement du contenu…')}
            </div>
          )}
        </Motion.div>
      </AnimatePresence>
    </div>
  );
}

function Retour({ onBack }) {
  return (
    <button type="button" className="fst-btn fup-back" onClick={onBack}>
      <ArrowLeft size={14} />Toutes les séquences
    </button>
  );
}

// Les canaux d'un envoi, en deux étiquettes.
function Canaux({ email, sms }) {
  return (
    <span className="fup-channels">
      {email && <Tag tone="blue" title="Email (Resend)"><Mail size={12} strokeWidth={2} /></Tag>}
      {sms && <Tag tone="green" title="SMS (Brevo)"><MessageSquare size={12} strokeWidth={2} /></Tag>}
    </span>
  );
}

// Un taux dans le tableau : le pourcentage, le décompte, et une barre fine dessous.
function Taux({ part, total, rate, color, tint }) {
  return (
    <td className="is-num">
      <div className="fup-rate">
        <small className="fst-num">{total != null ? `${count(part)}/${count(total)}` : count(part)}</small>
        <b className={`fst-num${tint ? ` fup-tone-${tint}` : ''}`}>{pct(rate) ?? '—'}</b>
      </div>
      <div className="fup-mini"><Fill value={rate} color={color} /></div>
    </td>
  );
}

const Vide = ({ texte }) => <td className="is-num"><span className="fst-cell-muted">{texte}</span></td>;
