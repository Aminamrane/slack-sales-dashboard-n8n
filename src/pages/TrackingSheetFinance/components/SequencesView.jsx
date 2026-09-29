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
// Sources : GET /finance-sequences, /finance-sequences/detail?key=…,
// /finance-sequences/messages/{id}/content.

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, MessageSquare, RefreshCw } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  green: '#0f7b6c',
  greenBg: '#e9f9f0',
  blue: '#1e40af',
  blueBg: '#e7f0fb',
  amber: '#b45309',
  amberBg: '#fff8ed',
  red: '#b42318',
  redBg: '#fdecec',
  slate: '#5b6472',
  slateBg: '#eef1f6',
};

const STATUS = {
  sent:      { label: 'Envoyé',  fg: N.slate, bg: N.slateBg },
  delivered: { label: 'Délivré', fg: N.blue,  bg: N.blueBg },
  opened:    { label: 'Ouvert',  fg: N.green, bg: N.greenBg },
  clicked:   { label: 'Cliqué',  fg: N.green, bg: N.greenBg },
  failed:    { label: 'Échec',   fg: N.red,   bg: N.redBg },
};

const FAILURE_LABEL = {
  bounced: 'adresse rejetée', complained: 'signalé comme indésirable', hardBounce: 'numéro invalide',
  softBounce: 'refus temporaire', blocked: 'bloqué', rejected: 'rejeté', failed: 'échec d’envoi',
};

// Tient dans l'écran intégré (/ceo/dispatch, ~950 px).
const LIST_GRID = 'minmax(260px, 2.6fr) 110px 100px 80px 110px 70px';
const RECIP_GRID = 'minmax(170px, 1.3fr) minmax(210px, 1.6fr) minmax(120px, 0.9fr) minmax(170px, 1.2fr)';

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

export default function SequencesView({ onOpenClient }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [openKey, setOpenKey] = useState(null);

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
    const t = { emails: 0, opensBase: 0, opened: 0, sms: 0, smsDelivered: 0 };
    for (const s of items || []) {
      if (s.email) {
        t.emails += s.email.sent;
        t.opensBase += s.email.opens_base || 0;
        t.opened += s.email.opened;
      }
      if (s.sms) {
        t.sms += s.sms.sent;
        t.smsDelivered += s.sms.delivered;
      }
    }
    return t;
  }, [items]);

  if (openKey) {
    return <SequenceDetail sequenceKey={openKey} onBack={() => setOpenKey(null)} onOpenClient={onOpenClient} />;
  }
  if (error && items === null) return <Message texte={`Séquences indisponibles · ${error}`} />;
  if (items === null) return <Message texte="Chargement des séquences…" />;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 2px 40px' }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 18 }}
      >
        <Carte label="Envois" value={items.length} hint="séquences de la finance" accent={N.text} />
        <Carte label="Emails envoyés" value={totaux.emails}
          hint={totaux.opensBase ? `ouverts à ${pct(totaux.opened / totaux.opensBase)} (depuis le suivi)` : 'ouvertures non suivies'}
          accent={N.blue} />
        <Carte label="SMS envoyés" value={totaux.sms}
          hint={totaux.sms ? `délivrés à ${pct(totaux.smsDelivered / totaux.sms)}` : 'aucun SMS suivi'}
          accent={N.green} />
        <button
          type="button"
          onClick={() => setRefresh((n) => n + 1)}
          title="Recharger"
          style={{
            marginLeft: 'auto', alignSelf: 'center',
            border: `1px solid ${N.borderSft}`, background: '#fff', borderRadius: 10,
            padding: '0 14px', height: 40, cursor: 'pointer', color: N.textMuted,
            display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12.5,
          }}
        >
          <motion.span
            animate={{ rotate: reloading ? 360 : 0 }}
            transition={reloading ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            style={{ display: 'inline-flex' }}
          >
            <RefreshCw size={13} />
          </motion.span>
          Actualiser
        </button>
      </motion.div>

      {items.length === 0 ? (
        <Message texte="Aucune séquence envoyée par la finance pour l’instant." />
      ) : (
        <div style={{ border: `1px solid ${N.borderSft}`, borderRadius: 10, overflowX: 'auto', background: '#fff' }}>
          <HeaderRow grid={LIST_GRID} cells={['Envoi', 'Emails délivrés', 'Ouverts', 'Cliqués', 'SMS délivrés', 'Échecs']}
            right={[1, 2, 3, 4, 5]} />
          {items.map((s, i) => {
            const failed = (s.email?.failed || 0) + (s.sms?.failed || 0);
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i, 12) * 0.02, ease: [0.4, 0, 0.2, 1] }}
                onClick={() => setOpenKey(s.key)}
                style={{
                  display: 'grid', gridTemplateColumns: LIST_GRID, minWidth: 880, gap: 10,
                  padding: '10px 14px', fontSize: 12.5, alignItems: 'center', cursor: 'pointer',
                  borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = N.sideBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Canaux email={!!s.email} sms={!!s.sms} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: N.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: 11, color: N.textFaint }}>Envoyée le {day(s.date)}</span>
                  </span>
                </span>
                {s.email ? <Taux count={`${s.email.delivered}/${s.email.sent}`} rate={s.email.delivery_rate} color={s.email.delivery_rate === 1 ? N.green : N.amber} /> : <Vide texte="—" />}
                {!s.email ? <Vide texte="—" />
                  : s.email.opens_tracked ? <Taux count={s.email.opened} rate={s.email.open_rate} color={N.green} />
                  : <Vide texte="non suivi" />}
                {s.email?.opens_tracked ? <Taux count={s.email.clicked} rate={s.email.click_rate} color={N.text} /> : <Vide texte="—" />}
                {s.sms ? <Taux count={`${s.sms.delivered}/${s.sms.sent}`} rate={s.sms.delivery_rate} color={s.sms.delivery_rate === 1 ? N.green : N.amber} /> : <Vide texte="—" />}
                <Nombre value={failed} color={failed ? N.red : N.textFaint} />
              </motion.div>
            );
          })}
        </div>
      )}
      <div style={{ color: N.textFaint, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
        Un envoi regroupe les emails d’un même objet partis le même jour et les SMS envoyés aux mêmes clients dans la foulée.
        Ouvertures suivies depuis le 18/08 ; celles d’un robot, à la réception, ne comptent pas. Les aperçus internes ne sont pas comptés.
      </div>
    </div>
  );
}

function SequenceDetail({ sequenceKey, onBack, onOpenClient }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [shownId, setShownId] = useState(null);

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

  if (error) return <Message texte={`Séquence indisponible · ${error}`} action={<Retour onBack={onBack} />} />;
  if (!detail) return <Message texte="Chargement de la séquence…" />;

  const { email, sms } = detail;
  const shown = detail.recipients.find((r) => r.email?.id === shownId)?.email;
  const failed = (email?.failed || 0) + (sms?.failed || 0);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 2px 40px' }}>
      <Retour onBack={onBack} />

      {/* L'en-tête, comme dans une messagerie. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ border: `1px solid ${N.borderSft}`, borderRadius: 12, background: '#fff', padding: '16px 20px', marginBottom: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Canaux email={!!email} sms={!!sms} />
          <div style={{ fontSize: 17, fontWeight: 700, color: N.text, minWidth: 0 }}>{detail.label}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 4, marginTop: 12, fontSize: 12.5 }}>
          <span style={{ color: N.textFaint }}>Envoyée le</span>
          <span style={{ color: N.text }}>
            {day(detail.date)}, à {detail.recipients.length} client{detail.recipients.length > 1 ? 's' : ''}
            {email && sms ? ' par email et SMS' : email ? ' par email' : ' par SMS'}
          </span>
          {email && <><span style={{ color: N.textFaint }}>De</span><span style={{ color: N.text }}>{detail.sender || '—'}</span></>}
          {email && <><span style={{ color: N.textFaint }}>Répondre à</span><span style={{ color: N.text }}>{detail.reply_to || '—'}</span></>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {email && <Pastille label="Emails délivrés" value={`${email.delivered} / ${email.sent}`} hint={pct(email.delivery_rate)} color={email.delivery_rate === 1 ? N.green : N.amber} />}
          {email && (email.opens_tracked ? (
            <>
              <Pastille label="Ouverts" value={email.opened} hint={pct(email.open_rate)} color={N.green} />
              <Pastille label="Cliqués" value={email.clicked} hint={pct(email.click_rate)} color={N.text} />
            </>
          ) : <Pastille label="Ouvertures" value="non suivies" hint="envoi antérieur au suivi" color={N.textMuted} />)}
          {sms && <Pastille label="SMS délivrés" value={`${sms.delivered} / ${sms.sent}`} hint={pct(sms.delivery_rate)} color={sms.delivery_rate === 1 ? N.green : N.amber} />}
          {failed > 0 && <Pastille label="Échecs" value={failed} color={N.red} />}
        </div>
      </motion.div>

      {/* Le contenu envoyé : celui du client choisi dans la liste. */}
      {shown ? <Contenu message={shown} /> : (
        <div style={{ border: `1px dashed ${N.border}`, borderRadius: 10, padding: '14px 18px', color: N.textMuted, fontSize: 12.5, marginBottom: 14 }}>
          Brevo ne conserve pas le texte des SMS envoyés : on suit leur remise, message par message.
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: N.text, margin: '18px 0 8px' }}>Destinataires</div>
      <div style={{ border: `1px solid ${N.borderSft}`, borderRadius: 10, overflowX: 'auto', background: '#fff' }}>
        <HeaderRow grid={RECIP_GRID} cells={['Client', 'Email', 'Ouvertures', 'SMS']} />
        {detail.recipients.map((r, i) => {
          const actif = r.email && r.email.id === shown?.id;
          return (
            <div
              key={(r.email || r.sms).id}
              onClick={() => r.email && setShownId(r.email.id)}
              title={r.email ? 'Afficher l’email reçu par ce client' : undefined}
              style={{
                display: 'grid', gridTemplateColumns: RECIP_GRID, minWidth: 880, gap: 10,
                padding: '10px 14px', fontSize: 12.5, alignItems: 'center',
                borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
                background: actif ? N.sideBg : 'transparent', cursor: r.email ? 'pointer' : 'default',
              }}
            >
              <span style={{ minWidth: 0 }}>
                {r.client ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenClient?.(r.client.id); }}
                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', maxWidth: '100%' }}
                  >
                    <span style={{ display: 'block', color: N.text, fontWeight: 500, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.client.societe || '—'}
                    </span>
                    <span style={{ fontSize: 11, color: N.textFaint }}>{r.client.numero_client}</span>
                  </button>
                ) : <span style={{ color: N.textFaint }}>Client non retrouvé</span>}
              </span>
              <Envoi message={r.email} label={r.email?.recipient} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {!r.email ? <span style={{ color: N.textFaint }}>—</span>
                  : r.email.failed_at ? <span style={{ color: N.textFaint }}>—</span>
                  : r.email.opens == null ? <span style={{ color: N.textFaint }}>non suivi</span>
                  : r.email.opens > 0 ? (
                    <span style={{ color: N.text }}>
                      {r.email.opens} fois
                      <span style={{ display: 'block', fontSize: 11, color: N.textFaint }}>dernière le {when(r.email.last_open)}</span>
                    </span>
                  ) : <span style={{ color: N.textFaint }}>pas encore</span>}
              </span>
              <Envoi message={r.sms} label={r.sms && phone(r.sms.recipient)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Un message dans la liste des destinataires : adresse ou numéro, statut, remise.
function Envoi({ message, label }) {
  if (!message) return <span style={{ color: N.textFaint }}>—</span>;
  const st = STATUS[message.status] || STATUS.sent;
  return (
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', color: N.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 11 }}>
        <span style={{ padding: '1px 7px', borderRadius: 4, background: st.bg, color: st.fg, fontWeight: 600 }}>{st.label}</span>
        {message.failed_at
          ? <span style={{ color: N.red }}>{FAILURE_LABEL[message.failure] || message.failure}</span>
          : <span style={{ color: N.textFaint, fontVariantNumeric: 'tabular-nums' }}>
              {message.delivered_at ? `délivré le ${when(message.delivered_at)}` : `envoyé le ${when(message.sent_at)}`}
            </span>}
      </span>
    </span>
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
    <div style={{ border: `1px solid ${N.borderSft}`, borderRadius: 12, background: '#fff', overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${N.borderSft}`, fontSize: 12, color: N.textMuted, background: N.sideBg }}>
        Email reçu par <strong style={{ color: N.text }}>{message?.recipient || '—'}</strong>
        {message?.sent_at ? ` le ${when(message.sent_at)}` : ''}
      </div>
      {state.data?.html ? (
        <iframe
          title="Contenu de l’email"
          sandbox=""
          srcDoc={PREVIEW_CSP + state.data.html}
          style={{ width: '100%', height: 480, border: 'none', display: 'block', background: '#fff' }}
        />
      ) : (
        <div style={{ padding: '26px 18px', color: N.textMuted, fontSize: 12.5, textAlign: 'center' }}>
          {state.error || (state.data ? (state.data.text || 'Email sans contenu HTML.') : 'Chargement du contenu…')}
        </div>
      )}
    </div>
  );
}

function Retour({ onBack }) {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{
        border: 'none', background: 'transparent', color: N.textMuted, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 0', marginBottom: 10,
      }}
    >
      <ArrowLeft size={14} /> Toutes les séquences
    </button>
  );
}

function HeaderRow({ grid, cells, right = [] }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: grid, minWidth: 880, gap: 10, padding: '9px 14px',
      background: N.sideBg, borderBottom: `1px solid ${N.borderSft}`,
      fontSize: 10.5, fontWeight: 600, color: N.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {cells.map((c, i) => <span key={c} style={{ textAlign: right.includes(i) ? 'right' : 'left' }}>{c}</span>)}
    </div>
  );
}

function Canal({ channel }) {
  const Icon = channel === 'sms' ? MessageSquare : Mail;
  return (
    <span title={channel === 'sms' ? 'SMS (Brevo)' : 'Email (Resend)'} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      width: 24, height: 24, borderRadius: 6, background: channel === 'sms' ? N.greenBg : N.blueBg,
      color: channel === 'sms' ? N.green : N.blue,
    }}>
      <Icon size={13} />
    </span>
  );
}

function Canaux({ email, sms }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
      {email && <Canal channel="email" />}
      {sms && <Canal channel="sms" />}
    </span>
  );
}

function Nombre({ value, color = N.text }) {
  return <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color }}>{value}</span>;
}

function Taux({ count, rate, color }) {
  return (
    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ fontWeight: 600, color }}>{pct(rate) ?? '—'}</span>
      <span style={{ color: N.textFaint, fontSize: 11, marginLeft: 6 }}>{count}</span>
    </span>
  );
}

function Vide({ texte }) {
  return <span style={{ textAlign: 'right', color: N.textFaint, fontSize: 12 }}>{texte}</span>;
}

function Pastille({ label, value, hint, color }) {
  return (
    <div style={{ border: `1px solid ${N.borderSft}`, borderRadius: 9, padding: '7px 12px', minWidth: 110 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: N.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {value}{hint ? <span style={{ fontSize: 11.5, fontWeight: 500, color: N.textFaint, marginLeft: 6 }}>{hint}</span> : null}
      </div>
    </div>
  );
}

function Carte({ label, value, hint, accent }) {
  return (
    <div style={{ border: `1px solid ${N.borderSft}`, borderRadius: 10, background: '#fff', padding: '12px 18px', minWidth: 170 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: N.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: N.textFaint, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function Message({ texte, action = null }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: N.textMuted, fontSize: 13 }}>
      {action}
      <div>{texte}</div>
    </div>
  );
}
