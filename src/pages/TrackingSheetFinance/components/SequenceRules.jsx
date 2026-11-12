// SequenceRules.jsx — onglet « Séquences » : les séquences de relance que la finance configure elle-même.
//
// Demande dev 12/11/2026 : « il faut que les opérationnels en finance puissent configurer eux-mêmes les
// relances SMS avec des triggers (les impayés de plus de tel mois…). Ils remplissent les modèles. Ils
// peuvent tester les SMS sur leurs numéros, faire des lectures seules des séquences pour voir combien de
// personnes ça va affecter. Pour les SMS et pour les emails. » Puis : « éviter les relances automatiques
// lorsqu'un client a déjà régularisé ou qu'un dossier nécessite un traitement humain », et « que ce soit
// simple, ce ne sont pas des développeurs ».
//
// Retours dev du 12/11 au soir : plus de conditions (rangées par thème : l'impayé, les paiements, le client, dont
// « onboarding fait mais jamais payé ») et un vrai rythme : une seule fois, chaque jour ouvré, chaque semaine
// (« tous les lundis »), chaque mois.
//
// Signature (dev 12/11) : chacun enregistre la sienne dans le CRM (photo, nom, titre, téléphone, e-mail, logo Owner
// dessous la photo, sans Trustpilot) ; une séquence choisit qui signe ses e-mails. Aucun nom dans ce fichier : tout
// vient du serveur (/finance-sequences/signatures).
//
// Une séquence se lit en trois questions : QUI relancer, QUOI leur écrire, QUAND. Le compteur « clients
// concernés » est une lecture seule du serveur, recalculée à chaque changement : rien ne part d'ici sans
// « Activer » ou « Lancer maintenant ». Le vocabulaire (champs, motifs, variables) vient du serveur.
//
// Sources : /finance-sequences/rules (liste, meta, preview, test-email, test-sms, {id}, {id}/status, {id}/run).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowLeft, CalendarClock, Check, Eye, FlaskConical, ImageUp, ListChecks, Mail, MessageSquareText, Pause, PenLine, Play, Plus, Send, ShieldCheck,
  Trash2, TriangleAlert, Users, X, Zap,
} from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { READ_ONLY_PROPS } from '../../../utils/readOnlyRoles.js';
import { count, plural } from '../statistics/model.js';
import { Card, Collapse, Empty, Num, OpenCue, Page, Pill, RefreshButton, Reveal, Segmented, Stat, Stats, TableBox, Tag, Th } from './PageKit.jsx';
import {
  CHANNEL, ENROLLMENT, STATUS, audienceReady, blankCondition, blankRule, blankStep, conditionFor, dayLabel, editable, euros, fieldGroups, hourLabel,
  insertAt, journey, monthsLabel, payloadOf, renderTemplate, sampleValues, scheduleLabel, signatureDraft, signatureMissing, smsShape, stepTiming,
  unknownVariables, withKind,
} from '../sequenceRules.js';
import './FollowupTabs.css';
import './SequenceRules.css';

const API = '/api/v1/finance-sequences/rules';
const SIGNATURES = '/api/v1/finance-sequences/signatures';
const say = (e, fallback) => e?.data?.detail || e?.message || fallback;
const pct = (rate) => (rate == null ? '–' : `${Math.round(rate * 100)} %`);
const when = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');
const dayOf = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' }) : '–');
const todayParis = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const top = (event) => event?.currentTarget?.closest('.tsf-stage')?.scrollTo?.({ top: 0 });

export default function SequenceRules({ readOnly = false, onOpenClient, switcher }) {
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(null);   // null = la liste ; { id } = une séquence ; { id: null } = une nouvelle

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReloading(true);
      try {
        const [m, d] = await Promise.all([meta ? Promise.resolve(meta) : apiClient.get(`${API}/meta`), apiClient.get(API)]);
        if (!cancelled) { setMeta(m); setItems(d?.items || []); setError(null); }
      } catch (e) {
        if (!cancelled) setError(say(e, 'chargement impossible'));
      } finally {
        if (!cancelled) setReloading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setRefresh((n) => n + 1), []);
  const totals = useMemo(() => (items || []).reduce((t, r) => ({
    active: t.active + (r.status === 'active' ? 1 : 0), running: t.running + r.running, entered: t.entered + r.entered, settled: t.settled + r.settled,
  }), { active: 0, running: 0, entered: 0, settled: 0 }), [items]);

  if (open && meta) {
    return <RuleEditor key={open.id || 'new'} meta={meta} ruleId={open.id} readOnly={readOnly} onOpenClient={onOpenClient}
      onBack={() => { setOpen(null); reload(); }} onCreated={(id) => setOpen({ id })} />;
  }

  const create = (event) => { top(event); setOpen({ id: null }); };
  const head = {
    title: 'Séquences',
    sub: 'Les relances que vous réglez vous-même : qui relancer, quoi leur écrire, quand.',
    actions: (
      <>
        {switcher}
        <RefreshButton onClick={reload} busy={reloading} />
        <button type="button" className="fst-btn is-dark" onClick={create} disabled={!meta} {...(readOnly ? READ_ONLY_PROPS : {})}><Plus size={14} /> Nouvelle séquence</button>
      </>
    ),
  };

  if (error && items === null) {
    return <Page {...head}><div className="fst-error" role="alert">Séquences indisponibles · {error}<button type="button" onClick={reload}>Réessayer</button></div></Page>;
  }
  if (items === null) return <Page {...head}><Empty boxed>Chargement des séquences…</Empty></Page>;

  return (
    <Page {...head}>
      <Stats>
        <Stat label="Séquences actives" Icon={Zap} value={totals.active} note={`sur ${plural(items.length, 'séquence')}`} />
        <Stat label="Clients en cours" Icon={Users} value={totals.running} note="reçoivent encore des messages" />
        <Stat label="Clients relancés" Icon={Send} value={totals.entered} note="depuis la première séquence" />
        <Stat label="Ont régularisé" Icon={Check} value={totals.settled} note="sortis d’eux-mêmes de la séquence" tone={totals.settled ? 'green' : undefined} />
      </Stats>

      <Reveal amount={0.03}>
        <Card title="Vos séquences" Icon={ListChecks} hint="Un clic ouvre la séquence : ses réglages, ses messages et les clients qui la suivent.">
          {items.length === 0 ? (
            <Empty boxed>
              Aucune séquence pour l’instant. Une séquence relance toute seule les clients que vous décrivez, par exemple
              « impayé depuis au moins 2 mois », et s’arrête dès qu’ils ont réglé.
              <div className="sqr-empty-cta">
                <button type="button" className="fst-btn is-dark" onClick={create} {...(readOnly ? READ_ONLY_PROPS : {})}><Plus size={14} /> Créer la première séquence</button>
              </div>
            </Empty>
          ) : (
            <TableBox minWidth={1180}>
              <thead>
                <tr>
                  <Th Icon={ListChecks}>Séquence</Th>
                  <Th Icon={MessageSquareText}>Messages</Th>
                  <Th Icon={CalendarClock}>Rythme</Th>
                  <Th Icon={Users} num>En cours</Th>
                  <Th Icon={Send} num>Relancés</Th>
                  <Th Icon={Check} num>Ont régularisé</Th>
                  <Th Icon={Mail} num title="E-mails remis, puis ouverts">E-mails</Th>
                  <Th Icon={MessageSquareText} num title="SMS remis">SMS</Th>
                  <Th Icon={Send}>Dernier passage</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.id} data-open="true" style={{ '--i': i }} onClick={(e) => { top(e); setOpen({ id: r.id }); }}>
                    <td>
                      <div className="fst-cell-main"><span className="sqr-name">{r.name}</span><OpenCue /></div>
                      <div className="fup-status"><Pill plain tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label}</Pill><span className="sqr-clip">{r.summary}</span></div>
                    </td>
                    <td><Journey steps={r.steps} /></td>
                    <td className="fst-cell-muted">{scheduleLabel(r.schedule, meta?.weekdays)}{r.next_entry_on && <div className="fst-cell-sub">prochaine entrée le {dayLabel(r.next_entry_on)}</div>}</td>
                    <td className="fst-num">{count(r.running)}</td>
                    <td className="fst-num">{count(r.entered)}</td>
                    <td className={`fst-num ${r.settled ? 'fup-tone-green' : 'fup-tone-zero'}`}>{count(r.settled)}</td>
                    <td className="fst-num">{r.email ? <>{pct(r.email.delivery_rate)}<div className="fst-cell-sub">ouverts {pct(r.email.open_rate)}</div></> : <span className="fup-tone-zero">–</span>}</td>
                    <td className="fst-num">{r.sms ? pct(r.sms.delivery_rate) : <span className="fup-tone-zero">–</span>}</td>
                    <td className="fst-cell-muted">{r.last_run ? <>{when(r.last_run.started_at)}<div className="fst-cell-sub">{plural(r.last_run.sent, 'message')}{r.last_run.failed ? ` · ${plural(r.last_run.failed, 'échec')}` : ''}</div></> : 'Jamais passée'}</td>
                  </tr>
                ))}
              </tbody>
            </TableBox>
          )}
        </Card>
      </Reveal>
    </Page>
  );
}

function Journey({ steps }) {
  const list = journey(steps);
  if (!list.length) return <span className="fup-tone-zero">Aucun message</span>;
  return (
    <span className="sqr-journey">
      {list.map((s, i) => <Tag key={i} tone={s.channel === 'email' ? 'blue' : 'green'}>{s.label}{s.day ? ` J+${s.day}` : ''}</Tag>)}
    </span>
  );
}

// ── Une séquence : ses réglages, son aperçu, ses clients ─────────────────────────────────────────

function RuleEditor({ meta, ruleId, readOnly, onBack, onCreated, onOpenClient }) {
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(() => (ruleId ? null : blankRule(meta)));
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(null);       // 'save' | 'active' | 'paused' | 'archived' | 'run'
  const [confirm, setConfirm] = useState(null); // même clés : le geste attend un second clic
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [preview, setPreview] = useState({ state: 'idle' });
  const [showList, setShowList] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [signs, setSigns] = useState({ mine: null, items: [] });
  const [signing, setSigning] = useState(false);   // le formulaire « ma signature » est ouvert

  useEffect(() => {
    let cancelled = false;
    apiClient.get(SIGNATURES).then((d) => { if (!cancelled) setSigns({ mine: d?.mine || null, items: d?.items || [] }); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ruleId) return undefined;
    let cancelled = false;
    apiClient.get(`${API}/${ruleId}`)
      .then((d) => { if (!cancelled) { setDetail(d); setDraft(editable(d, meta)); setDirty(false); setLoadError(null); } })
      .catch((e) => { if (!cancelled) setLoadError(say(e, 'chargement impossible')); });
    return () => { cancelled = true; };
  }, [ruleId, meta, reloadKey]);

  const status = detail?.status || 'draft';
  const locked = readOnly || status === 'active';
  const lockProps = readOnly ? READ_ONLY_PROPS : locked ? { disabled: true, title: 'Mettez la séquence en pause pour la modifier' } : {};
  const change = useCallback((patch) => { setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) })); setDirty(true); setFlash(null); }, []);

  // Lecture seule du serveur : qui serait relancé maintenant. Relancée 450 ms après le dernier changement.
  const audienceKey = draft ? JSON.stringify([draft.scope, draft.definition, draft.skip, draft.steps.map((s) => s.channel)]) : '';
  const ready = draft ? audienceReady(meta, draft) : false;
  useEffect(() => {
    if (!draft) return undefined;
    if (!ready) { setPreview({ state: 'idle' }); return undefined; }
    let live = true;
    setPreview((p) => ({ ...p, state: 'loading' }));
    // Lecture seule : le serveur ne laisse passer que des GET, donc l'aperçu de la séquence telle qu'enregistrée.
    const ask = () => (readOnly ? apiClient.get(`${API}/${ruleId}/preview`) : apiClient.post(`${API}/preview`, payloadOf(draft, ruleId)));
    const timer = setTimeout(() => {
      ask()
        .then((data) => { if (live) setPreview({ state: 'ready', data }); })
        .catch((e) => { if (live) setPreview({ state: 'error', error: say(e, 'aperçu indisponible') }); });
    }, 450);
    return () => { live = false; clearTimeout(timer); };
  }, [audienceKey, ready, ruleId, reloadKey, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const values = useMemo(() => sampleValues(meta, preview.data), [meta, preview.data]);
  const signature = signs.items.find((x) => x.user_id === draft?.signature_user_id) || null;
  // Ma signature vient d'être enregistrée : elle rejoint la liste, et signe la séquence si personne ne la signait.
  const signatureSaved = (sig) => {
    setSigns((cur) => ({ mine: sig, items: [...cur.items.filter((x) => x.user_id !== sig.user_id), sig].sort((a, b) => a.full_name.localeCompare(b.full_name)) }));
    if (!locked && !draft.signature_user_id) change({ signature_user_id: sig.user_id });
  };
  const data = preview.data;

  const save = async () => {
    const saved = ruleId ? await apiClient.put(`${API}/${ruleId}`, payloadOf(draft)) : await apiClient.post(API, payloadOf(draft));
    setDirty(false);
    if (!ruleId) onCreated(saved.id); else setDetail((d) => ({ ...d, ...saved }));
    return saved;
  };

  const act = async (kind) => {
    setBusy(kind); setError(null); setFlash(null);
    try {
      if (kind === 'save') {
        await save();
        setFlash('Séquence enregistrée.');
      } else if (kind === 'run') {
        const tally = await apiClient.post(`${API}/${ruleId}/run`, {});
        setFlash(`Passage terminé : ${plural(tally.sent, 'message envoyé', 'messages envoyés')}, ${plural(tally.entered, 'client entré', 'clients entrés')}`
          + `${tally.closed ? `, ${plural(tally.closed, 'sorti', 'sortis')}` : ''}${tally.failed ? `, ${plural(tally.failed, 'échec')}` : ''}.`);
        setReloadKey((n) => n + 1);
      } else {
        const id = (dirty || !ruleId) && kind === 'active' ? (await save()).id : ruleId;
        await apiClient.post(`${API}/${id}/status`, { status: kind });
        if (kind === 'archived') { onBack(); return; }
        setFlash(kind === 'active' ? `Séquence activée : ${scheduleLabel(draft.schedule, meta.weekdays).toLowerCase()}, à ${hourLabel(draft.send_hour)}.` : 'Séquence en pause. Plus rien ne part.');
        setReloadKey((n) => n + 1);
      }
      setConfirm(null);
    } catch (e) {
      setError(say(e, 'Action impossible.'));
    } finally {
      setBusy(null);
    }
  };

  const back = (event) => {
    if (dirty && !leaving) { setLeaving(true); return; }
    top(event); onBack();
  };
  const backButton = (
    <button type="button" className={`fst-btn fup-back${leaving ? ' fup-danger' : ''}`} onClick={back} onBlur={() => setLeaving(false)}>
      <ArrowLeft size={14} /> {leaving ? 'Quitter sans enregistrer ?' : 'Toutes les séquences'}
    </button>
  );

  if (loadError) {
    return <Page title="Séquence" actions={backButton}><div className="fst-error" role="alert">Séquence indisponible · {loadError}</div></Page>;
  }
  if (!draft) return <Page title="Séquence" actions={backButton}><Empty boxed>Chargement de la séquence…</Empty></Page>;

  const conditions = draft.definition.conditions;
  const setCondition = (i, patch) => change((d) => ({ definition: { ...d.definition, conditions: d.definition.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) } }));
  const setStep = (i, patch) => change((d) => ({ steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const kind = draft.schedule.kind;
  const rhythm = scheduleLabel(draft.schedule, meta.weekdays);
  const several = draft.steps.length > 1;
  const whenSentence = kind === 'once'
    ? `${rhythm}, à ${hourLabel(draft.send_hour)} : les clients concernés ce jour-là reçoivent le premier message${several ? ', puis les suivants aux délais prévus' : ''}. Ensuite la séquence se termine.`
    : `${rhythm}, à ${hourLabel(draft.send_hour)} : les clients qui répondent aux conditions ce jour-là entrent dans la séquence${several ? ' ; les messages suivants partent ensuite aux délais prévus' : ''}.`;

  return (
    <Page
      title={draft.name.trim() || (ruleId ? 'Séquence' : 'Nouvelle séquence')}
      sub={ruleId
        ? <><Pill plain tone={STATUS[status]?.tone}>{STATUS[status]?.label}</Pill>{' '}{status === 'active' ? `${rhythm}, à ${hourLabel(draft.send_hour)}. Mettez-la en pause pour la modifier.`
          : status === 'done' ? 'Elle a été jouée jusqu’au bout. L’activer de nouveau la rejoue.' : 'Rien ne part tant qu’elle n’est pas activée.'}</>
        : 'Trois questions : qui relancer, quoi leur écrire, quand. Rien ne part avant l’activation.'}
      actions={backButton}
    >
      {ruleId && detail && (
        <Stats>
          <Stat label="En cours" Icon={Users} value={detail.running || 0} note="reçoivent encore des messages" />
          <Stat label="Relancés" Icon={Send} value={detail.entered || 0} note="entrés dans la séquence" />
          <Stat label="Ont régularisé" Icon={Check} value={detail.settled || 0} note="sortis dès le paiement" tone={detail.settled ? 'green' : undefined} />
          <Stat label="Pris en charge" Icon={ShieldCheck} value={detail.handled || 0} note="laissés à une personne" />
        </Stats>
      )}

      <Reveal amount={0.03}>
        <Card title="1. Qui relancer" Icon={Users} hint="Les clients en retard qui répondent à ces conditions. Un client qui ne doit plus rien n’est jamais relancé.">
          <div className="sqr-grid">
            <div className="sqr-form">
              <label className="sqr-field">
                <span className="fst-micro">Nom de la séquence</span>
                <input className="fup-input sqr-wide" value={draft.name} maxLength={80} placeholder="Ex. Impayés de deux mois" onChange={(e) => change({ name: e.target.value })} {...lockProps} />
              </label>

              <div className="sqr-field">
                <span className="fst-micro">Conditions</span>
                {conditions.map((c, i) => (
                  <ConditionRow key={i} meta={meta} condition={c} lockProps={lockProps} locked={locked}
                    onChange={(patch) => setCondition(i, patch)}
                    onRemove={conditions.length > 1 ? () => change((d) => ({ definition: { ...d.definition, conditions: d.definition.conditions.filter((_, j) => j !== i) } })) : null} />
                ))}
                <div className="sqr-row">
                  <button type="button" className="fst-btn is-small" onClick={() => change((d) => ({ definition: { ...d.definition, conditions: [...d.definition.conditions, blankCondition(meta)] } }))} {...lockProps}>
                    <Plus size={13} /> Ajouter une condition
                  </button>
                  {conditions.length > 1 && (
                    <Segmented small label="Lien entre les conditions" value={draft.definition.match}
                      onChange={(match) => !locked && change((d) => ({ definition: { ...d.definition, match } }))}
                      options={[{ key: 'all', label: 'Toutes à la fois' }, { key: 'any', label: 'Au moins une' }]} />
                  )}
                </div>
              </div>

              <div className="sqr-field">
                <span className="fst-micro">Dette prise en compte</span>
                <Segmented small label="Dette prise en compte" value={draft.scope} onChange={(scope) => !locked && change({ scope })}
                  options={meta.scopes.map((s) => ({ key: s.key, label: s.label }))} />
              </div>

              <div className="sqr-field">
                <span className="fst-micro">Dossiers laissés à une personne</span>
                <p className="sqr-help">Ces clients ne reçoivent aucune relance automatique. S’ils étaient déjà dans la séquence, ils en sortent.</p>
                <div className="sqr-checks">
                  {meta.skips.map((s) => (
                    <label key={s.key} className="sqr-check" data-locked={s.locked || undefined}>
                      <input type="checkbox" checked={s.locked || draft.skip.includes(s.key)} disabled={s.locked || locked}
                        onChange={(e) => change((d) => ({ skip: e.target.checked ? [...d.skip, s.key] : d.skip.filter((k) => k !== s.key) }))}
                        {...(readOnly ? READ_ONLY_PROPS : {})} />
                      <span>{s.label}</span>{s.locked && <small>toujours</small>}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <Audience preview={preview} ready={ready} showList={showList} onToggle={() => setShowList((v) => !v)} />
          </div>

          <Collapse open={showList && !!data}>
            {data && <AudienceList data={data} onOpenClient={onOpenClient} />}
          </Collapse>
        </Card>
      </Reveal>

      <Reveal amount={0.03}>
        <Card title="2. Quoi leur écrire" Icon={MessageSquareText}
          hint={`Les e-mails partent de ${meta.sender} ; les réponses arrivent à ${meta.reply_to}. Les SMS sont signés ${meta.sms_sender}.`}>
          <div className="sqr-signbar">
            <label className="sqr-inline">
              <span>Les e-mails sont signés par</span>
              <select className="fst-select" value={draft.signature_user_id || ''} onChange={(e) => change({ signature_user_id: e.target.value || null })} {...lockProps}>
                <option value="">personne (pas de signature)</option>
                {signs.items.map((x) => <option key={x.user_id} value={x.user_id}>{x.full_name} · {x.title}</option>)}
              </select>
            </label>
            <button type="button" className="fst-btn is-small" onClick={() => setSigning((v) => !v)} aria-expanded={signing} {...(readOnly ? READ_ONLY_PROPS : {})}>
              <PenLine size={13} /> {signs.mine?.saved ? 'Modifier ma signature' : 'Créer ma signature'}
            </button>
          </div>
          <Collapse open={signing && !!signs.mine}>
            {signs.mine && <SignatureEditor mine={signs.mine} onSaved={signatureSaved} onClose={() => setSigning(false)} />}
          </Collapse>

          <div className="sqr-steps">
            {draft.steps.map((step, i) => (
              <StepEditor key={i} index={i} step={step} meta={meta} values={values} signature={signature} fromClient={!!data?.sample?.from_client} locked={locked} lockProps={lockProps} readOnly={readOnly}
                context={{ rule_id: ruleId, scope: draft.scope, definition: draft.definition, skip: draft.skip, signature_user_id: draft.signature_user_id }}
                onChange={(patch) => setStep(i, patch)}
                onRemove={draft.steps.length > 1 ? () => change((d) => ({ steps: d.steps.filter((_, j) => j !== i) })) : null} />
            ))}
          </div>
          {draft.steps.length < meta.max_steps && (
            <div className="sqr-row sqr-add">
              <button type="button" className="fst-btn is-small" onClick={() => change((d) => ({ steps: [...d.steps, blankStep('sms')] }))} {...lockProps}><Plus size={13} /> Ajouter un SMS</button>
              <button type="button" className="fst-btn is-small" onClick={() => change((d) => ({ steps: [...d.steps, blankStep('email')] }))} {...lockProps}><Plus size={13} /> Ajouter un e-mail</button>
            </div>
          )}
        </Card>
      </Reveal>

      <Reveal amount={0.03}>
        <Card title="3. Quand" Icon={CalendarClock} hint="Une seule fois, ou à un rythme régulier. Les chiffres de chaque client sont relus juste avant l’envoi.">
          <div className="sqr-when">
            <div className="sqr-field">
              <span className="fst-micro">Les clients concernés entrent dans la séquence</span>
              <Segmented small label="Rythme d’entrée dans la séquence" value={kind} onChange={(next) => !locked && change((d) => withKind(d, next))}
                options={meta.schedules.map((x) => ({ key: x.key, label: x.label }))} />
            </div>
            {kind === 'once' && (
              <label className="sqr-inline">
                <span>Le</span>
                <input className="fup-input sqr-date" type="date" min={todayParis()} value={draft.schedule.date || ''} aria-label="Jour de l’envoi"
                  onChange={(e) => change((d) => ({ schedule: { ...d.schedule, date: e.target.value } }))} {...lockProps} />
                <span className="sqr-quiet">Sans date, elle part dès l’activation.</span>
              </label>
            )}
            {kind === 'weekly' && (
              <div className="sqr-inline">
                <span>Le</span>
                <span className="sqr-options">
                  {meta.weekdays.map((w) => {
                    const on = (draft.schedule.days || []).includes(w.key);
                    return (
                      <button key={w.key} type="button" className="sqr-option" aria-pressed={on}
                        onClick={() => change((d) => ({ schedule: { ...d.schedule, days: on ? d.schedule.days.filter((x) => x !== w.key) : [...(d.schedule.days || []), w.key] } }))} {...lockProps}>{w.label}</button>
                    );
                  })}
                </span>
              </div>
            )}
            {kind === 'monthly' && (
              <label className="sqr-inline">
                <span>Le</span>
                <input className="fup-input sqr-num" type="number" min={1} max={28} value={draft.schedule.day ?? ''} aria-label="Jour du mois"
                  onChange={(e) => change((d) => ({ schedule: { ...d.schedule, day: e.target.value } }))} {...lockProps} />
                <span>de chaque mois</span>
                <span className="sqr-quiet">Un week-end ou un jour férié : le jour ouvré suivant.</span>
              </label>
            )}
            <label className="sqr-inline">
              <span>Les messages partent à</span>
              <select className="fst-select" value={draft.send_hour} onChange={(e) => change({ send_hour: Number(e.target.value) })} {...lockProps}>
                {meta.hours.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
              <span className="sqr-quiet">Du lundi au vendredi, hors jours fériés.</span>
            </label>
            {kind !== 'once' && (
              <label className="sqr-inline">
                <span>Un client toujours en retard après le dernier message</span>
                <select className="fst-select" value={draft.repeat_after_days ? 'again' : 'never'}
                  onChange={(e) => change({ repeat_after_days: e.target.value === 'again' ? (kind === 'weekly' ? 7 : 30) : null })} {...lockProps}>
                  <option value="never">ne la reçoit plus</option>
                  <option value="again">la reçoit de nouveau après</option>
                </select>
                {draft.repeat_after_days != null && (
                  <><input className="fup-input sqr-num" type="number" min={7} max={365} value={draft.repeat_after_days}
                    onChange={(e) => change({ repeat_after_days: e.target.value })} aria-label="Nombre de jours" {...lockProps} /><span>jours</span></>
                )}
              </label>
            )}
            <p className="sqr-help sqr-sum">{whenSentence}</p>
          </div>

          <div className="fup-actions">
            {error && <div className="fst-error sqr-error" role="alert">{error}</div>}
            <AnimatePresence mode="wait" initial={false}>
              <Motion.div key={confirm || 'rest'} className="fup-actions-row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
                {confirm === 'active' ? (
                  <>
                    <span>Activer : {rhythm.toLowerCase()}, à {hourLabel(draft.send_hour)}{data ? `. Aujourd’hui, ${plural(data.targeted, 'client répond', 'clients répondent')} aux conditions` : ''}.</span>
                    <button type="button" className="fst-btn is-dark" disabled={!!busy} data-busy={busy === 'active' || undefined} onClick={() => act('active')}><Play size={14} /> {busy === 'active' ? 'Activation…' : 'Confirmer l’activation'}</button>
                    <button type="button" className="fst-btn fup-quiet" disabled={!!busy} onClick={() => setConfirm(null)}>Pas maintenant</button>
                  </>
                ) : confirm === 'run' ? (
                  <>
                    <span>Lancer maintenant : {data ? `${plural(data.targeted, 'nouveau client reçoit', 'nouveaux clients reçoivent')} le premier message, ` : ''}les clients en cours reçoivent leur message suivant s’il est dû.</span>
                    <button type="button" className="fst-btn is-dark" disabled={!!busy} data-busy={busy === 'run' || undefined} onClick={() => act('run')}><Send size={14} /> {busy === 'run' ? 'Envoi…' : 'Confirmer l’envoi'}</button>
                    <button type="button" className="fst-btn fup-quiet" disabled={!!busy} onClick={() => setConfirm(null)}>Pas maintenant</button>
                  </>
                ) : confirm === 'archived' ? (
                  <>
                    <span>Archiver : la séquence disparaît de la liste et ses clients en cours ne reçoivent plus rien. Les envois passés restent dans le suivi.</span>
                    <button type="button" className="fst-btn fup-danger" disabled={!!busy} onClick={() => act('archived')}><Trash2 size={14} /> {busy === 'archived' ? 'Archivage…' : 'Confirmer l’archivage'}</button>
                    <button type="button" className="fst-btn fup-quiet" disabled={!!busy} onClick={() => setConfirm(null)}>Garder</button>
                  </>
                ) : status === 'active' ? (
                  <>
                    <button type="button" className="fst-btn is-dark" disabled={!!busy} onClick={() => act('paused')} {...(readOnly ? READ_ONLY_PROPS : {})}><Pause size={14} /> {busy === 'paused' ? 'Mise en pause…' : 'Mettre en pause'}</button>
                    <button type="button" className="fst-btn" disabled={!!busy} onClick={() => setConfirm('run')} {...(readOnly ? READ_ONLY_PROPS : {})}><Send size={14} /> Lancer maintenant</button>
                    {flash && <span className="sqr-flash" role="status"><Check size={14} /> {flash}</span>}
                  </>
                ) : (
                  <>
                    <button type="button" className="fst-btn is-dark" disabled={!!busy || (!dirty && !!ruleId)} data-busy={busy === 'save' || undefined} onClick={() => act('save')} {...(readOnly ? READ_ONLY_PROPS : {})}>
                      <Check size={14} /> {busy === 'save' ? 'Enregistrement…' : ruleId ? 'Enregistrer' : 'Enregistrer le brouillon'}
                    </button>
                    <button type="button" className="fst-btn" disabled={!!busy} onClick={() => setConfirm('active')} {...(readOnly ? READ_ONLY_PROPS : {})}><Play size={14} /> Activer la séquence</button>
                    {ruleId && <button type="button" className="fst-btn fup-quiet" disabled={!!busy} onClick={() => setConfirm('archived')} {...(readOnly ? READ_ONLY_PROPS : {})}><Trash2 size={14} /> Archiver</button>}
                    {flash && <span className="sqr-flash" role="status"><Check size={14} /> {flash}</span>}
                  </>
                )}
              </Motion.div>
            </AnimatePresence>
          </div>
        </Card>
      </Reveal>

      {ruleId && detail && (detail.clients?.length > 0 || detail.runs?.length > 0) && (
        <Reveal amount={0.03} className="fst-grid">
          <Card title="Clients de la séquence" Icon={Users} hint="En cours d’abord. Un clic sur le nom ouvre la fiche.">
            {detail.clients.length === 0 ? <Empty>Aucun client n’est encore entré dans cette séquence.</Empty> : (
              <TableBox minWidth={620}>
                <thead><tr><Th>Client</Th><Th>Où il en est</Th><Th num>Dû à l’entrée</Th><Th>Dernier message</Th></tr></thead>
                <tbody>
                  {detail.clients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button type="button" className="fst-case-name" onClick={() => onOpenClient?.(c.client_id)}>{c.societe || 'Client'}</button>
                        <div className="fst-cell-sub">{c.numero_client}</div>
                      </td>
                      <td>
                        <Pill plain tone={ENROLLMENT[c.status]?.tone}>{ENROLLMENT[c.status]?.label}</Pill>
                        <div className="fst-cell-sub">{c.status === 'active' ? `message ${c.steps_sent} sur ${draft.steps.length}` : c.status === 'handled' ? c.reason_label : `le ${dayOf(c.closed_at)}`}</div>
                      </td>
                      <td className="fst-num">{euros(c.amount_at_entry)}</td>
                      <td className="fst-cell-muted">{when(c.last_sent_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableBox>
            )}
          </Card>
          <Card title="Passages" Icon={CalendarClock} hint="Chaque fois que la séquence a tourné.">
            {detail.runs.length === 0 ? <Empty>La séquence n’est pas encore passée.</Empty> : (
              <ul className="sqr-runs">
                {detail.runs.map((r, i) => (
                  <li key={i}>
                    <div><strong>{when(r.started_at)}</strong><span>{r.kind === 'manual' ? `lancé par ${r.by_name || 'la finance'}` : 'automatique'}</span></div>
                    <div className="fst-num">{plural(r.sent, 'message')}{r.entered ? ` · ${plural(r.entered, 'entrée')}` : ''}{r.closed ? ` · ${plural(r.closed, 'sortie')}` : ''}{r.failed ? ` · ${plural(r.failed, 'échec')}` : ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      )}
    </Page>
  );
}

function ConditionRow({ meta, condition, onChange, onRemove, lockProps, locked }) {
  const field = meta.fields.find((f) => f.key === condition.field) || meta.fields[0];
  const operators = meta.operators[field.type];
  return (
    <div className="sqr-condition" title={field.help}>
      <select className="fst-select" value={field.key} aria-label="Sur quoi porte la condition" onChange={(e) => onChange(conditionFor(meta, e.target.value))} {...lockProps}>
        {fieldGroups(meta).map((g) => (
          <optgroup key={g.name} label={g.name}>{g.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>
        ))}
      </select>
      {field.type === 'number' && (
        <>
          <select className="fst-select" value={condition.op} aria-label="Comparaison" onChange={(e) => onChange({ op: e.target.value })} {...lockProps}>
            {operators.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <input className="fup-input sqr-num" inputMode="decimal" value={condition.value ?? ''} aria-label="Valeur" onChange={(e) => onChange({ value: e.target.value })} {...lockProps} />
          {condition.op === 'between' && (
            <><span className="sqr-and">et</span><input className="fup-input sqr-num" inputMode="decimal" value={condition.value2 ?? ''} aria-label="Seconde valeur" onChange={(e) => onChange({ value2: e.target.value })} {...lockProps} /></>
          )}
          <span className="sqr-unit">{field.unit}</span>
        </>
      )}
      {field.type === 'bool' && (
        <Segmented small label={field.label} value={condition.value ? 'yes' : 'no'} onChange={(v) => !locked && onChange({ value: v === 'yes' })}
          options={[{ key: 'yes', label: 'Oui' }, { key: 'no', label: 'Non, jamais' }]} />
      )}
      {field.type === 'enum' && (
        <>
          <select className="fst-select" value={condition.op} aria-label="Comparaison" onChange={(e) => onChange({ op: e.target.value })} {...lockProps}>
            {operators.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <span className="sqr-options">
            {field.options.map((o) => {
              const on = (condition.value || []).includes(o.value);
              return (
                <button key={o.value} type="button" className="sqr-option" aria-pressed={on}
                  onClick={() => onChange({ value: on ? condition.value.filter((v) => v !== o.value) : [...(condition.value || []), o.value] })} {...lockProps}>{o.label}</button>
              );
            })}
          </span>
        </>
      )}
      {onRemove && <button type="button" className="fst-btn is-small fup-quiet sqr-remove" onClick={onRemove} aria-label="Retirer cette condition" {...lockProps}><X size={14} /></button>}
    </div>
  );
}

// Le compteur : lecture seule de ce que la séquence ferait si elle passait maintenant.
function Audience({ preview, ready, showList, onToggle }) {
  const d = preview.data;
  return (
    <aside className="sqr-audience" aria-live="polite" data-state={preview.state}>
      <span className="fst-micro"><Eye size={12} /> Lecture seule · rien ne part</span>
      {!ready ? (
        <p className="sqr-audience-wait">Complétez les conditions : le nombre de clients concernés s’affiche ici.</p>
      ) : preview.state === 'error' ? (
        <p className="sqr-audience-wait">{preview.error}</p>
      ) : !d ? (
        <p className="sqr-audience-wait">Calcul en cours…</p>
      ) : (
        <>
          <div className="sqr-big"><Num value={d.targeted} /><span>{d.targeted > 1 ? 'clients seraient relancés' : 'client serait relancé'} aujourd’hui</span></div>
          <p className="sqr-audience-line">{d.targeted ? `Ils doivent ${euros(d.total_due)} au total.` : 'Personne ne répond à ces conditions pour l’instant.'}</p>
          {d.running > 0 && <p className="sqr-audience-line">{plural(d.running, 'client est déjà en cours', 'clients sont déjà en cours')} dans cette séquence.</p>}
          {d.held_total > 0 && (
            <div className="sqr-held">
              <p className="sqr-audience-line"><ShieldCheck size={13} /> {plural(d.held_total, 'dossier laissé', 'dossiers laissés')} à une personne :</p>
              <div className="sqr-held-tags">{d.held.map((h) => <Tag key={h.reason} tone="yellow">{h.count} · {h.label}</Tag>)}</div>
            </div>
          )}
          {d.no_phone > 0 && <div className="fup-warn"><TriangleAlert size={14} /><span>{plural(d.no_phone, 'client n’a', 'clients n’ont')} pas de mobile : le SMS sera sauté pour {d.no_phone > 1 ? 'eux' : 'lui'}. Ajoutez le numéro sur sa fiche.</span></div>}
          {d.no_email > 0 && <div className="fup-warn"><TriangleAlert size={14} /><span>{plural(d.no_email, 'client n’a', 'clients n’ont')} pas d’adresse e-mail : l’e-mail sera sauté.</span></div>}
          {(d.targeted > 0 || d.held_total > 0) && (
            <button type="button" className="fst-btn is-small" onClick={onToggle} aria-expanded={showList}><Users size={13} /> {showList ? 'Masquer la liste' : 'Voir qui est concerné'}</button>
          )}
        </>
      )}
    </aside>
  );
}

function AudienceList({ data, onOpenClient }) {
  const [tab, setTab] = useState('targets');
  const rows = tab === 'targets' ? data.clients : data.held_clients;
  const tabs = [{ key: 'targets', label: 'Seraient relancés', n: data.targeted }, { key: 'held', label: 'Laissés à une personne', n: data.held_total }];
  return (
    <div className="sqr-list">
      <div className="fst-tools">
        <div className="fst-tabs" role="group" aria-label="Liste affichée">
          {tabs.map((t) => (
            <button key={t.key} type="button" className="fst-tab" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
              {tab === t.key && <Motion.span layoutId="sqr-list-tab" className="fst-tab-bg" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
              <span>{t.label}</span><span className="fst-tab-count fst-num">{count(t.n)}</span>
            </button>
          ))}
        </div>
      </div>
      <TableBox minWidth={720} after={rows.length === 0 ? <Empty>Personne dans cette liste.</Empty> : null}>
        <thead>
          <tr><Th>Client</Th><Th num>Reste dû</Th><Th>Impayé depuis</Th><Th>{tab === 'targets' ? 'Coordonnées' : 'Pourquoi'}</Th></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.client_id}>
              <td>
                <button type="button" className="fst-case-name" onClick={() => onOpenClient?.(c.client_id)}>{c.societe || 'Client'}</button>
                <div className="fst-cell-sub">{c.numero_client}</div>
              </td>
              <td className="fst-num">{euros(c.amount)}</td>
              <td className="fst-cell-muted">{monthsLabel(c.months)}</td>
              <td>{tab === 'targets'
                ? <span className="fup-channels"><Tag tone={c.has_phone ? 'green' : 'red'}>{c.has_phone ? 'Mobile' : 'Sans mobile'}</Tag><Tag tone={c.has_email ? 'blue' : 'red'}>{c.has_email ? 'E-mail' : 'Sans e-mail'}</Tag></span>
                : <Tag tone="yellow">{c.reason_label}</Tag>}</td>
            </tr>
          ))}
        </tbody>
      </TableBox>
    </div>
  );
}

function StepEditor({ index, step, meta, values, signature, fromClient, locked, lockProps, readOnly, context, onChange, onRemove }) {
  const area = useRef(null);
  const subject = useRef(null);
  const focused = useRef('body');
  const caret = useRef(null);
  const [phone, setPhone] = useState('');
  const [test, setTest] = useState({ state: 'idle' });
  const sms = step.channel === 'sms';
  const shown = renderTemplate(step.body, values);
  const shape = sms ? smsShape(shown) : null;
  const unknown = unknownVariables(meta, step.subject, step.body);

  const insert = (key) => {
    const target = focused.current === 'subject' && !sms ? subject.current : area.current;
    const field = target === subject.current ? 'subject' : 'body';
    const next = insertAt(step[field], target?.selectionStart, target?.selectionEnd, `{{${key}}}`);
    caret.current = { target, at: next.caret };
    onChange({ [field]: next.text });
  };
  // Le curseur revient juste après la variable, une fois le nouveau texte affiché : on continue d'écrire à la suite.
  useEffect(() => {
    if (!caret.current) return;
    const { target, at } = caret.current;
    caret.current = null;
    target?.focus();
    target?.setSelectionRange(at, at);
  });

  const send = async () => {
    setTest({ state: 'sending' });
    try {
      const body = { ...context, step: { channel: step.channel, subject: step.subject, body: step.body }, ...(sms ? { phone } : {}) };
      const sent = await apiClient.post(`${API}/${sms ? 'test-sms' : 'test-email'}`, body);
      setTest({ state: 'done', message: sms ? 'SMS d’essai envoyé à ce numéro.' : `E-mail d’essai envoyé à ${sent.to}.` });
    } catch (e) {
      setTest({ state: 'error', message: say(e, 'L’essai n’est pas parti.') });
    }
  };

  return (
    <section className="sqr-step">
      <header className="sqr-step-head">
        <span className="sqr-step-n">{index + 1}</span>
        <Segmented small label="Canal du message" value={step.channel} onChange={(channel) => !locked && onChange({ channel })}
          options={[{ key: 'sms', label: CHANNEL.sms }, { key: 'email', label: CHANNEL.email }]} />
        {index === 0 ? <span className="sqr-timing">{stepTiming(step, 0)}</span> : (
          <label className="sqr-inline sqr-timing">
            <span>Part</span>
            <input className="fup-input sqr-num" type="number" min={1} max={90} value={step.delay_days} onChange={(e) => onChange({ delay_days: e.target.value })} aria-label="Jours après le message précédent" {...lockProps} />
            <span>jour{Number(step.delay_days) > 1 ? 's' : ''} après le message précédent</span>
          </label>
        )}
        {onRemove && <button type="button" className="fst-btn is-small fup-quiet sqr-remove" onClick={onRemove} {...lockProps}><Trash2 size={13} /> Retirer</button>}
      </header>

      <div className="sqr-step-body">
        <div className="sqr-form">
          {!sms && (
            <label className="sqr-field">
              <span className="fst-micro">Objet</span>
              <input ref={subject} className="fup-input sqr-wide" value={step.subject} maxLength={150} placeholder="Ex. Impayé sur votre compte Owner"
                onFocus={() => { focused.current = 'subject'; }} onChange={(e) => onChange({ subject: e.target.value })} {...lockProps} />
            </label>
          )}
          <label className="sqr-field">
            <span className="fst-micro">{sms ? 'Texte du SMS' : 'Texte de l’e-mail'}</span>
            <textarea ref={area} className="sqr-area" rows={sms ? 4 : 9} value={step.body}
              placeholder={sms ? 'Ex. Bonjour, votre compte Owner présente un impayé de {{montant}} depuis {{depuis}}. Merci de régulariser.' : 'Bonjour,\n\nVotre compte présente un impayé de {{montant}}…'}
              onFocus={() => { focused.current = 'body'; }} onChange={(e) => onChange({ body: e.target.value })} {...lockProps} />
          </label>
          <div className="sqr-vars">
            <span className="fst-micro">Insérer</span>
            {meta.variables.map((v) => (
              <button key={v.key} type="button" className="sqr-var" title={`${v.label} · ex. ${v.sample}`} onClick={() => insert(v.key)} {...lockProps}>{v.label}</button>
            ))}
          </div>
          {unknown.length > 0 && <div className="fup-warn"><TriangleAlert size={14} /><span>« {`{{${unknown[0]}}}`} » n’existe pas. Utilisez les boutons « Insérer ».</span></div>}
          {shape && step.body.trim() && (
            <p className="sqr-count" data-warn={shape.parts > 1 || shape.unicode || undefined}>
              {shape.length} caractères · {plural(shape.parts, 'SMS', 'SMS')} par client
              {shape.unicode && ` · ${shape.odd.map((c) => (c.trim() ? `« ${c} »` : 'une espace insécable')).join(', ')} ${shape.odd.length > 1 ? 'ramènent' : 'ramène'} le SMS à 70 caractères : remplacez-${shape.odd.length > 1 ? 'les' : 'le'} pour en envoyer moins`}
            </p>
          )}
        </div>

        <div className="sqr-preview">
          <span className="fst-micro">{fromClient ? `Ce que recevrait ${values.societe || 'le premier client'}` : 'Aperçu avec un exemple'}</span>
          {sms ? (
            <div className="sqr-phone"><span className="sqr-phone-from">{meta.sms_sender}</span><p>{shown.trim() || 'Votre SMS apparaît ici.'}</p></div>
          ) : (
            <div className="sqr-mail">
              <div className="fup-mail-head"><strong>{renderTemplate(step.subject, values).trim() || 'Objet de l’e-mail'}</strong></div>
              <div className="sqr-mail-body">
                {shown.trim() || 'Votre e-mail apparaît ici.'}
                {signature && <SignatureCard sig={signature} />}
              </div>
            </div>
          )}
          <div className="sqr-test">
            {sms && <input className="fup-input" value={phone} inputMode="tel" placeholder="Votre mobile : 06 12 34 56 78" aria-label="Mobile pour l’essai" onChange={(e) => setPhone(e.target.value)} {...(readOnly ? READ_ONLY_PROPS : {})} />}
            <button type="button" className="fst-btn is-small" disabled={test.state === 'sending' || !step.body.trim() || (sms && !phone.trim())} data-busy={test.state === 'sending' || undefined}
              title={sms ? 'Envoie ce SMS à votre numéro, avec les valeurs de l’aperçu' : 'Envoie cet e-mail à l’adresse de votre compte'} onClick={send} {...(readOnly ? READ_ONLY_PROPS : {})}>
              <FlaskConical size={13} /> {test.state === 'sending' ? 'Envoi de l’essai…' : sms ? 'M’envoyer ce SMS' : 'M’envoyer cet e-mail'}
            </button>
            {(test.state === 'done' || test.state === 'error') && <span className="sqr-test-result" data-tone={test.state} role="status">{test.message}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Signature d'e-mail ───────────────────────────────────────────────────────────────────────────

// La carte telle qu'elle part dans l'e-mail : photo et logo à gauche, nom, titre et coordonnées à droite.
// Trois lignes sous le titre (dev 12/11) : l'e-mail, le site, puis le téléphone. `hint` : dans le formulaire, la
// ligne du téléphone se voit avant d'être remplie.
function SignatureCard({ sig, photo, hint = false }) {
  const picture = photo || sig.photo_url;
  return (
    <div className="sqr-sig">
      <div className="sqr-sig-left">
        {picture ? <img className="sqr-sig-photo" src={picture} alt="" /> : <div className="sqr-sig-photo is-empty">Photo</div>}
        {sig.logo_url && <img className="sqr-sig-logo" src={sig.logo_url} alt="Owner" />}
      </div>
      <div className="sqr-sig-right">
        <strong>{sig.full_name || 'Prénom Nom'}</strong>
        <span className="sqr-sig-title">{sig.title || 'Votre titre'}</span>
        <span className="sqr-sig-link">{sig.email || 'votre adresse e-mail'}</span>
        <span className="sqr-sig-link">{sig.website}/</span>
        {sig.phone ? <span>{sig.phone}</span> : hint && <span className="sqr-sig-hint">votre téléphone</span>}
      </div>
    </div>
  );
}

// Ma signature : quatre champs, une photo, et la carte qui se met à jour pendant la saisie.
function SignatureEditor({ mine, onSaved, onClose }) {
  const [form, setForm] = useState(() => signatureDraft(mine));
  const [file, setFile] = useState(null);
  const [state, setState] = useState({ busy: false, error: null, done: false });
  const picker = useRef(null);
  const local = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (local) URL.revokeObjectURL(local); }, [local]);
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setState({ busy: false, error: null, done: false }); };
  const missing = signatureMissing(form);

  const save = async () => {
    setState({ busy: true, error: null, done: false });
    try {
      let saved = await apiClient.put(`${SIGNATURES}/mine`, form);
      if (file) saved = await apiClient.uploadFile(`${SIGNATURES}/mine/photo`, file);
      setFile(null);
      setState({ busy: false, error: null, done: true });
      onSaved(saved);
    } catch (e) {
      setState({ busy: false, error: say(e, 'La signature n’a pas pu être enregistrée.'), done: false });
    }
  };

  return (
    <div className="sqr-signer">
      <div className="sqr-form">
        <div className="sqr-sig-fields">
          <label className="sqr-field"><span className="fst-micro">Prénom et nom</span>
            <input className="fup-input sqr-wide" value={form.full_name} maxLength={80} onChange={set('full_name')} /></label>
          <label className="sqr-field"><span className="fst-micro">Titre</span>
            <input className="fup-input sqr-wide" value={form.title} maxLength={80} placeholder="Ex. Chargée de facturation" onChange={set('title')} /></label>
          <label className="sqr-field"><span className="fst-micro">Téléphone</span>
            <input className="fup-input sqr-wide" value={form.phone} inputMode="tel" maxLength={24} placeholder="06 12 34 56 78" onChange={set('phone')} /></label>
          <label className="sqr-field"><span className="fst-micro">E-mail</span>
            <input className="fup-input sqr-wide" value={form.email} inputMode="email" maxLength={120} onChange={set('email')} /></label>
        </div>
        <div className="sqr-row">
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" hidden
            onChange={(e) => { setFile(e.target.files?.[0] || null); setState({ busy: false, error: null, done: false }); }} />
          <button type="button" className="fst-btn is-small" onClick={() => picker.current?.click()}>
            <ImageUp size={13} /> {file || mine.photo_url ? 'Changer la photo' : 'Choisir une photo'}
          </button>
          <span className="sqr-quiet">{file ? file.name : 'JPG ou PNG. Elle est recadrée au carré, centrée sur le visage.'}</span>
        </div>
        {state.error && <div className="fst-error" role="alert">{state.error}</div>}
        <div className="fup-actions-row">
          <button type="button" className="fst-btn is-dark" disabled={state.busy || !!missing} title={missing || undefined} data-busy={state.busy || undefined} onClick={save}>
            <Check size={14} /> {state.busy ? 'Enregistrement…' : 'Enregistrer ma signature'}
          </button>
          <button type="button" className="fst-btn fup-quiet" disabled={state.busy} onClick={onClose}>Fermer</button>
          {state.done && <span className="sqr-flash" role="status"><Check size={14} /> Signature enregistrée dans le CRM.</span>}
        </div>
      </div>
      <div className="sqr-preview">
        <span className="fst-micro">Votre signature dans l’e-mail</span>
        <div className="sqr-mail"><div className="sqr-mail-body"><SignatureCard sig={{ ...mine, ...form }} photo={local} hint /></div></div>
      </div>
    </div>
  );
}
