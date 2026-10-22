// src/components/sequenceMail/SequenceInfo.jsx
//
// « Informations de séquence » sous le corps de l'e-mail : programmation, cohorte, compteurs
// d'envoi et métadonnées techniques. Chaque champ n'apparaît que si la donnée existe : rien
// n'est inventé, et une donnée absente est dite absente (avec sa raison quand on la connaît).

import { CalendarClock, ChartNoAxesColumn, Info, Paperclip, Users } from 'lucide-react';
import { fmtBytes, fmtDayMonth, fmtInt, fmtRatio, fmtWhenLong, fmtWhenShort } from './format.js';
import { PHASES, SEGMENTS, SEQUENCES, delayBetween, describeTiming } from './model.js';
import { Chip } from './ui';

const KV = ({ label, children, sub }) =>
  children === null || children === undefined || children === '' || children === false ? null : (
    <>
      <dt>{label}</dt>
      <dd>
        {children}
        {sub ? <span className="smx-sub">{sub}</span> : null}
      </dd>
    </>
  );

function Meter({ part, total }) {
  if (!(total > 0) || !Number.isFinite(part)) return null;
  const pct = Math.max(0, Math.min(100, (part / total) * 100));
  return (
    <span className="smx-meter" aria-hidden>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * @brief Raison lisible pour laquelle les compteurs manquent ou ne sont pas à jour (`null` : rien à dire).
 * @note Trois situations distinctes : « cohorte absente du CRM » (état `unavailable`, permanent), « CRM injoignable »
 * ou erreur d'appel (état `error`, réessayable : les derniers chiffres connus restent affichés), et relevé en cours.
 */
function statsUnavailable(stats, apiStatus) {
  if (!stats) return 'Chargement des compteurs du CRM…';
  const hasData = Number.isFinite(stats.fetchedAt);
  if (stats.status === 'idle') return 'Compteurs non relevés.';
  if (stats.status === 'loading') return hasData ? null : 'Chargement des compteurs du CRM…';
  if (stats.status === 'unavailable') return 'Cohorte absente du CRM : le CRM ne fournit pas de compteurs pour elle.';
  if (stats.status === 'error') {
    return `Compteurs du CRM indisponibles (${stats.error || 'erreur du CRM'})${hasData ? ' : derniers chiffres connus affichés.' : ' ; ils seront redemandés.'}`;
  }
  if (apiStatus === 'error') return 'CRM injoignable : chiffres du dernier relevé.';
  return null;
}

export default function SequenceInfo({ detail, apiStatus }) {
  const { step, cohort, meta, sequenceMeta, index, total, seqPrev, seqNext, kindStats, stats, status, rules, generatedAt } = detail;
  const liveAt = meta?.liveAt || cohort?.liveAt || null;
  const timing = describeTiming(step, liveAt);
  const phase = PHASES[step.phase];
  const seqLabel = SEQUENCES[step.sequence]?.label ?? step.sequence;
  const before = delayBetween(seqPrev, step);
  const after = delayBetween(step, seqNext);
  const summary = stats?.summary;
  const unavailable = statsUnavailable(stats, apiStatus);
  const sent = kindStats?.sent ?? 0;
  const delivered = kindStats?.delivered;
  const base = delivered > 0 ? delivered : sent;
  const hasEngagement = typeof kindStats?.opened === 'number';
  // « Jour concerné » : le jour de la semaine (avec sa position par rapport au live en sous-texte) ou, à défaut, la
  // relation à l'inscription ; jamais le même texte deux fois, et pas du tout s'il répète déjà « Envoi ».
  const dayValue = timing.weekday || timing.relation;
  const dayRow = dayValue && dayValue !== timing.when ? dayValue : null;
  const daySub = timing.weekday && timing.relation && timing.relation !== dayValue ? timing.relation : null;
  const fetched = Number.isFinite(stats?.fetchedAt) ? fmtWhenShort(new Date(stats.fetchedAt).toISOString()) : null;

  return (
    <section className="smx-info" aria-label="Informations de séquence">
      <h3 className="smx-info-title">
        <Info size={16} aria-hidden /> Informations de séquence
      </h3>
      <div className="smx-info-grid">
        <div className="smx-card">
          <h4><CalendarClock size={12} aria-hidden style={{ verticalAlign: '-1px', marginRight: 5 }} />Programmation</h4>
          {step.fallback ? (
            // Étape synthétisée : seul le type d'e-mail est connu (via ses compteurs). Sa place dans la séquence et sa
            // date d'envoi ne sont PAS connues : on ne les affiche pas.
            <>
              <dl className="smx-kv">
                <KV label="Statut">
                  <Chip tone={status.tone}>{status.label}</Chip>
                </KV>
              </dl>
              <p className="smx-note">
                Contenu local absent : cette cohorte n'a pas de contenu embarqué. Seuls le type d'e-mail et ses compteurs d'envoi
                viennent du CRM ; sa place dans la séquence et sa date d'envoi ne sont pas connues.
              </p>
            </>
          ) : (
            <dl className="smx-kv">
              <KV label="Étape" sub={total ? `${index + 1} sur ${total} dans la cohorte` : null}>
                {step.sequenceCount ? `${step.sequenceIndex} sur ${step.sequenceCount} · ${seqLabel}` : seqLabel}
              </KV>
              <KV label="Phase">{phase && phase.label !== seqLabel ? <Chip tone={phase.tone}>{phase.label}</Chip> : null}</KV>
              <KV label="Segment">{step.segment ? SEGMENTS[step.segment] : null}</KV>
              <KV label="Envoi" sub={timing.note}>{timing.when}</KV>
              <KV label="Jour concerné" sub={daySub}>{dayRow}</KV>
              <KV label="Précédent" sub={seqPrev ? seqPrev.subject : null}>
                {seqPrev ? (before ? `${before} avant cet envoi` : 'Délai variable (dépend de l\'inscription)') : 'Premier e-mail de la séquence'}
              </KV>
              <KV label="Suivant" sub={seqNext ? seqNext.subject : null}>
                {seqNext ? (after ? `${after} après cet envoi` : 'Délai variable (dépend de l\'inscription)') : 'Dernier e-mail de la séquence'}
              </KV>
              <KV label="Fréquence">{sequenceMeta?.frequency}</KV>
              <KV label="Statut">
                <Chip tone={status.tone}>{status.label}</Chip>
              </KV>
            </dl>
          )}
          {step.conditions?.length > 0 && (
            <>
              <h4 style={{ marginTop: 12 }}>Conditions d'envoi</h4>
              <ul className="smx-cond">
                {step.conditions.map((c) => <li key={c}>{c}</li>)}
                {rules?.filter((r) => !step.conditions.includes(r)).map((r) => <li key={r}>{r}</li>)}
              </ul>
            </>
          )}
        </div>

        <div className="smx-card">
          <h4><Users size={12} aria-hidden style={{ verticalAlign: '-1px', marginRight: 5 }} />Cohorte</h4>
          <dl className="smx-kv">
            <KV label="Nom">{cohort?.apiTitle || meta?.label || cohort?.label}</KV>
            <KV label="Public">{meta?.audience || cohort?.audience}</KV>
            <KV label="Live">{liveAt ? fmtWhenLong(liveAt) : 'Date inconnue'}</KV>
            <KV label="Intervenants">{meta?.speakers?.length ? meta.speakers.join(', ') : null}</KV>
            <KV label="Inscrits" sub={summary?.leadsBySource ? Object.entries(summary.leadsBySource).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${fmtInt(v)}`).join(' · ') : null}>
              {typeof summary?.leadsDb === 'number' ? fmtInt(summary.leadsDb) : null}
            </KV>
            <KV label="Désinscrits">{typeof summary?.unsubscribed === 'number' ? fmtInt(summary.unsubscribed) : null}</KV>
            <KV label="Position">{total ? `E-mail ${index + 1} sur ${total}` : null}</KV>
            <KV label="Pages d'inscription">{meta?.pages?.length ? meta.pages.join(' · ') : null}</KV>
            <KV label="Destinataires">{step.recipientsLabel}</KV>
          </dl>
          {meta?.notes?.length > 0 && (
            <p className="smx-note">{meta.notes.join(' ')}</p>
          )}
          {!cohort?.inApi && apiStatus === 'ready' && (
            <p className="smx-note">Cette cohorte n'est pas (ou pas encore) exposée par le CRM : ses compteurs ne sont pas disponibles.</p>
          )}
        </div>

        <div className="smx-card">
          <h4><ChartNoAxesColumn size={12} aria-hidden style={{ verticalAlign: '-1px', marginRight: 5 }} />Envoi et engagement</h4>
          {unavailable && !kindStats ? (
            <p className="smx-note" style={{ marginTop: 0 }}>{unavailable}</p>
          ) : (
            <dl className="smx-kv">
              <KV label="Envoyés">{fmtInt(sent)}</KV>
              <KV label="En attente">{kindStats?.pending > 0 ? fmtInt(kindStats.pending) : null}</KV>
              <KV label="Non envoyés" sub="désinscrits ou annulés">{kindStats?.failed > 0 ? fmtInt(kindStats.failed) : null}</KV>
              <KV label="Délivrés">{typeof delivered === 'number' ? <>{fmtInt(delivered)}<Meter part={delivered} total={sent} /></> : null}</KV>
              <KV label="Ouverts" sub={hasEngagement ? 'sur délivrés (le pré-chargement Apple gonfle ce chiffre)' : null}>
                {hasEngagement ? <>{fmtInt(kindStats.opened)} · {fmtRatio(kindStats.opened, base)}<Meter part={kindStats.opened} total={base} /></> : null}
              </KV>
              <KV label="Clics">{typeof kindStats?.clicked === 'number' && hasEngagement ? <>{fmtInt(kindStats.clicked)} · {fmtRatio(kindStats.clicked, base)}<Meter part={kindStats.clicked} total={base} /></> : null}</KV>
              <KV label="Rebonds">{kindStats?.bounced > 0 ? fmtInt(kindStats.bounced) : null}</KV>
              <KV label="Plaintes spam">{kindStats?.complained > 0 ? fmtInt(kindStats.complained) : null}</KV>
              <KV label="Premier envoi en attente">{kindStats?.firstPending ? fmtWhenShort(kindStats.firstPending) : null}</KV>
              <KV label="Dernier envoi">{kindStats?.lastSent ? fmtWhenShort(kindStats.lastSent) : null}</KV>
            </dl>
          )}
          {(unavailable && kindStats) && <p className="smx-note">{unavailable}</p>}
          {!unavailable && !kindStats && <p className="smx-note" style={{ marginTop: 0 }}>Aucun envoi enregistré pour ce type d'e-mail.</p>}
          {fetched && (
            <p className="smx-note">
              {stats.status === 'ready' ? 'Compteurs du CRM relevés à' : 'Derniers compteurs relevés avec succès à'} {fetched}.
            </p>
          )}
        </div>

        <div className="smx-card">
          <h4><Paperclip size={12} aria-hidden style={{ verticalAlign: '-1px', marginRight: 5 }} />Détails techniques</h4>
          <dl className="smx-kv">
            <KV label="Type"><span className="smx-code">{step.kind}</span></KV>
            <KV label="Marqueurs">{step.tags?.length ? step.tags.map((t) => `${t.name}=${t.value}`).join(', ') : null}</KV>
            <KV label="En-têtes">{step.headers?.length ? step.headers.map((h) => h.name).join(', ') : null}</KV>
            <KV label="Pièces jointes">
              {step.attachments?.length ? step.attachments.map((a) => `${a.filename} (${fmtBytes(a.bytes)})`).join(', ') : null}
            </KV>
            <KV label="Boutons">
              {step.links?.filter((l) => l.button).length ? step.links.filter((l) => l.button).map((l) => l.label).join(' · ') : null}
            </KV>
          </dl>
          {step.links?.length > 0 && (
            <>
              <h4 style={{ marginTop: 12 }}>Liens</h4>
              <ul className="smx-linklist">
                {step.links.map((l) => (
                  <li key={`${l.label}|${l.href}`}>
                    <span>{l.label || '(sans libellé)'}</span>
                    <span title={l.href}>
                      {l.unsubscribe ? 'désinscription' : l.personal ? 'lien personnel' : l.href.replace(/^https?:\/\//, '')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {meta?.codeEra && (
            <p className="smx-note">
              Contenu reconstitué depuis le code de la landing (ère « {meta.codeEra} »), instantané du {generatedAt ? fmtDayMonth(generatedAt) : '—'}.
              {step.textDerived ? ' La version texte est dérivée du HTML.' : ''}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
