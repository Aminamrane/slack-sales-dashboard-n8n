// src/pages/SequencesMonitor.jsx
//
// Monitoring des séquences de réengagement et du parcours de RDV (route /ceo/sequences). Vue lecture seule (seul
// l'envoi de test écrit côté serveur, sans rien compter). Refonte du 2026-11-19 : famille de styles `seq-`
// (components/sequences/sequences.css), mêmes données, mêmes fonctions qu'avant.
//
// Données : GET /api/v1/tracking/broad-sequence/monitoring (toutes les séquences + no-show), puis, seulement sur
// l'onglet concerné, confirmation-email/monitoring, <séquence>/activity et prospect-sms/activity. Lectures « en direct »
// toutes les 20 s par `useLivePoll` : suspendues onglet caché, jamais deux en même temps, la dernière demandée l'emporte.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';

import apiClient from '../services/apiClient';
import SequenceTestPanel from '../components/SequenceTestPanel';
import { SmsActivity } from '../components/SequenceActivity';
import { isReadOnlyViewer } from '../utils/readOnlyRoles';
import useLivePoll from '../components/sequences/useLivePoll.js';
import useBodyTheme from '../components/sequences/useBodyTheme.js';
import MetaSequence from '../components/sequences/MetaSequence.jsx';
import { ConfirmationView, NoShowView } from '../components/sequences/SimpleViews.jsx';
import { Ago, Card, Empty, ErrorState, Segmented, Skeletons, StaleBanner } from '../components/sequences/parts.jsx';
import '../components/sequences/sequences.css';

const CONF_KEY = '__confirmation__';
const NOSHOW_KEY = '__noshow__';
const SMS_KEY = '__sms__';
const PERIODS = [
  { key: 7, label: '7 derniers jours' },
  { key: 30, label: '30 jours' },
  { key: 90, label: '90 jours' },
  { key: null, label: 'Depuis le lancement' },
];

const monitoringUrl = (days) => `/api/v1/tracking/broad-sequence/monitoring${days ? `?days=${days}` : ''}`;

export default function SequencesMonitor({ embed = false, dark }) {
  const bodyDark = useBodyTheme();
  const isDark = dark ?? bodyDark;
  const readOnly = isReadOnlyViewer(apiClient.getUser()?.role);

  const [active, setActive] = useState(null);       // clé de l'onglet (séquence Meta ou onglet fixe)
  const [days, setDays] = useState(null);           // prospects contactés pour la 1re fois dans les N derniers jours (null = depuis le lancement)

  const main = useLivePoll(() => apiClient.get(monitoringUrl(days)), { key: `mon:${days ?? 'all'}` });
  // Changer de période : les chiffres de l'ancienne période restent à l'écran, atténués, le temps de lire la nouvelle
  // (le rail et le test ne disparaissent pas) ; un chiffre d'une autre période n'est jamais présenté comme à jour.
  const lastData = useRef(null);
  if (main.data) lastData.current = main.data;
  const data = main.data || lastData.current;
  const switching = !main.data && !!data;
  const isConf = active === CONF_KEY;
  const isNoshow = active === NOSHOW_KEY;
  const isSms = active === SMS_KEY;
  const special = isConf || isNoshow || isSms;

  // Le mail de confirmation n'est lu que sur son onglet (l'ancienne page le relisait toutes les 20 s, vu ou non).
  const conf = useLivePoll(() => apiClient.get('/api/v1/tracking/confirmation-email/monitoring'), { key: 'conf', enabled: isConf });

  // Première séquence par défaut, dès que la liste est connue ; si la séquence choisie disparaît de la réponse, on y revient.
  const sequences = data?.sequences;
  useEffect(() => {
    if (!sequences?.length) return;
    setActive((prev) => (prev && (prev.startsWith('__') || sequences.some((s) => s.key === prev)) ? prev : sequences[0].key));
  }, [sequences]);

  const seq = useMemo(() => (sequences ? sequences.find((s) => s.key === active) || null : null), [sequences, active]);
  const anyEnabled = !!sequences?.some((s) => s.enabled);
  const label = isConf ? 'Mail de confirmation' : isNoshow ? 'Relance no-show' : isSms ? 'SMS prospects' : (seq?.label || active);

  // Rail : séquences Meta (dynamiques) | parcours fixes. Flèches, Début, Fin : navigation au clavier.
  const tabs = useMemo(() => [
    ...(sequences || []).map((s) => ({ key: s.key, label: s.label, on: !!s.enabled })),
    { key: CONF_KEY, label: 'Mail de confirmation', on: true, fixed: true, group: true },
    { key: NOSHOW_KEY, label: 'Relance no-show', on: true, fixed: true },
    { key: SMS_KEY, label: 'SMS prospects', on: null },
  ], [sequences]);
  const tabRefs = useRef({});
  const onTabKey = useCallback((e) => {
    const i = tabs.findIndex((t) => t.key === active);
    const to = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setActive(tabs[to].key);
    tabRefs.current[tabs[to].key]?.focus();
  }, [tabs, active]);

  const showPeriod = !!data && !special;

  return (
    <div className={`seq${isDark ? ' is-dark' : ''}${switching ? ' is-loading' : ''}`} data-hue="blue" aria-busy={switching || undefined} style={embed ? undefined : { paddingTop: 24 }}>
      <header className="seq-head seq-in">
        <div className="seq-head-id">
          <span className="seq-head-badge" aria-hidden="true"><Mail size={24} strokeWidth={1.8} /></span>
          <div>
            <h1 className="seq-title">Séquences email</h1>
            <span className="seq-sub">Réengagement des prospects Meta non convertis en R1</span>
          </div>
        </div>
        <div className="seq-head-right">
          {data && (
            <span className="seq-live" data-on={anyEnabled ? 'true' : 'false'}>
              {anyEnabled ? 'En direct' : 'Toutes en pause'}
              <span className="seq-live-age">· à jour <Ago at={main.updatedAt} /></span>
            </span>
          )}
          <button type="button" className="seq-refresh" onClick={main.refresh} disabled={main.busy} aria-label="Actualiser" title="Actualiser">
            <RefreshCw size={15} className={main.busy ? 'seq-spin' : undefined} aria-hidden="true" />
          </button>
        </div>
      </header>

      {!data && !main.error && <Skeletons blocks={[52, 190, 130, 320]} />}
      {!data && main.error && <ErrorState detail={main.error} busy={main.busy} onRetry={main.refresh} />}
      {data && !sequences?.length && <Card delay={1}><Empty>Aucune séquence.</Empty></Card>}

      {data && !!sequences?.length && (
        <>
          {main.error && <StaleBanner text={`Actualisation impossible : ${main.error}. Les dernières données restent affichées.`} busy={main.busy} onRetry={main.refresh} />}

          <div className="seq-rail seq-in" role="tablist" aria-label="Séquences" style={{ '--i': 1 }} onKeyDown={onTabKey}>
            {tabs.map((t) => (
              <span key={t.key} style={{ display: 'contents' }}>
                {t.group && <span className="seq-rail-sep" aria-hidden="true" />}
                <button type="button" role="tab" id={`seq-tab-${t.key}`} ref={(el) => { tabRefs.current[t.key] = el; }} className="seq-tab"
                  aria-selected={active === t.key} tabIndex={active === t.key ? 0 : -1} aria-controls="seq-panel" onClick={() => setActive(t.key)}>
                  {t.on !== null && <span className="seq-tab-dot" data-on={t.on ? 'true' : 'false'} aria-hidden="true" />}
                  {t.label}
                  {t.on !== null && <span className="seq-sr">{t.on ? (t.fixed ? ' (actif)' : ' (active)') : ' (en pause)'}</span>}
                </button>
              </span>
            ))}
          </div>

          {showPeriod && (
            <div className="seq-toolbar seq-in" style={{ '--i': 2 }}>
              <span className="seq-toolbar-label">Prospects entrés dans la séquence :</span>
              <Segmented label="Période" value={days} onChange={setDays} options={PERIODS} />
            </div>
          )}

          {active && <SequenceTestPanel active={active} label={label} readOnly={readOnly} />}

          <div id="seq-panel" role="tabpanel" aria-labelledby={`seq-tab-${active}`}>
            {isSms ? (
              <div className="seq-body"><SmsActivity delay={1} /></div>
            ) : isConf ? (
              conf.data ? <ConfirmationView data={conf.data} />
                : conf.error ? <ErrorState title="Mail de confirmation indisponible" detail={conf.error} busy={conf.busy} onRetry={conf.refresh} />
                  : <Skeletons blocks={[170, 220]} />
            ) : isNoshow ? (
              <NoShowView data={data} />
            ) : seq ? (
              <MetaSequence key={seq.key} seq={seq} />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
