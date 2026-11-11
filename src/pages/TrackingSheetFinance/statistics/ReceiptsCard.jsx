import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useDrawn } from '../../../components/perfSales/motion.jsx';
import { barHeights, count, eur, plural } from './model.js';
import { monthLabel, monthShort } from './period.js';
import { Card, Fill, Num, Segmented } from './parts.jsx';

const euros = (n) => eur(Math.round(n));
const bucketLabel = (bucket) => (bucket.to == null ? `${count(bucket.from)} € et plus` : `${count(bucket.from)} – ${count(bucket.to)} €`);

// Douze mois de moyenne payée par client ; les mois de la période sont pleins, un clic ouvre le mois.
function History({ history, onPickMonth }) {
  const drawn = useDrawn();
  const heights = barHeights(history.map((month) => month.average_eur));
  return (
    <div className="fst-bars">
      {history.map((month, i) => (
        <button key={month.month} type="button" className="fst-bar" data-in={month.in_period || undefined} onClick={() => onPickMonth(month.month)}
          aria-label={`${monthLabel(month.month)} : ${month.average_eur == null ? 'aucun paiement' : `${euros(month.average_eur)} par client`}`}>
          <span className="fst-tip" role="presentation">
            <b>{monthLabel(month.month)}</b><br />
            {month.average_eur == null ? <span>Aucun paiement</span> : (
              <>{euros(month.average_eur)} <span>par client</span><br />{plural(month.payers, 'client')} <span>· {euros(month.received_eur)}</span></>
            )}
          </span>
          <span className="fst-bar-value fst-num">{month.average_eur == null ? '' : count(Math.round(month.average_eur))}</span>
          <span className="fst-bar-fill" style={{ height: `${drawn ? heights[i] * 0.72 : 0}%`, transitionDelay: `${i * 28}ms` }} />
          <span className="fst-bar-label">{monthShort(month.month)}</span>
        </button>
      ))}
    </div>
  );
}

export default function ReceiptsCard({ state, onPickMonth }) {
  const [entityKey, setEntityKey] = useState('owner');
  const entities = state.data?.entities || [];
  const entity = entities.find((e) => e.key === entityKey) || entities[0];
  const months = state.data?.period?.months || 1;
  const totals = entity?.totals || {};
  const largest = Math.max(1, ...(entity?.distribution || []).map((b) => b.clients));
  const options = entities.map((e) => ({ key: e.key, label: e.kind === 'partner' ? `${e.label} · cabinet partenaire` : e.label }));

  return (
    <Card title="Ce que paie un client" Icon={Wallet} state={state} skeleton={420}
      hint="L’argent réellement entré, divisé par les clients qui ont payé ce mois-là."
      actions={options.length > 1 && <Segmented small options={options} value={entity?.key} onChange={setEntityKey} label="Entité" />}>
      {entity && (
        <>
          <div className="fst-hero">
            <div>
              <Num className="fst-big" value={totals.average_eur} format={euros} duration={1100} />
              <span className="fst-big-unit">par client et par mois · {entity.tax}{months > 1 ? ` · moyenne sur ${months} mois` : ''}</span>
            </div>
          </div>
          <div className="fst-facts">
            <div className="fst-fact">
              <span className="fst-fact-label">Clients qui ont payé</span>
              <Num className="fst-fact-value" value={totals.unique_payers} />
              {months > 1 && <span className="fst-fact-note">{plural(totals.payer_months, 'mensualité')}</span>}
            </div>
            <div className="fst-fact">
              <span className="fst-fact-label">Encaissé {entity.tax}</span>
              <Num className="fst-fact-value" value={totals.received_eur} format={euros} />
            </div>
            <div className="fst-fact">
              <span className="fst-fact-label">Médiane</span>
              <Num className="fst-fact-value" value={totals.median_eur} format={euros} />
            </div>
            <div className="fst-fact" title="Impayés d’un mois précédent, réglés pendant la période. Ils sont comptés dans l’encaissé.">
              <span className="fst-fact-label">Dont rattrapages d’impayés</span>
              <Num className="fst-fact-value" value={totals.catch_up_eur} format={euros} />
            </div>
            {totals.refunds_eur ? (
              <div className="fst-fact" title="Remboursements saisis sur la période. Ils ne sont pas retirés de l’encaissé.">
                <span className="fst-fact-label">Remboursements</span>
                <Num className="fst-fact-value" value={Math.abs(totals.refunds_eur)} format={euros} />
              </div>
            ) : null}
          </div>

          <div className="fst-chart">
            <div className="fst-chart-title"><span>Moyenne par client, 12 mois</span><span>Cliquer sur un mois pour l’ouvrir</span></div>
            <History history={entity.history} onPickMonth={onPickMonth} />
          </div>

          {months > 1 && (
            <div className="fst-chart">
              <div className="fst-chart-title"><span>Mois par mois</span></div>
              <table className="fst-months">
                <thead><tr><th>Mois</th><th>Clients qui ont payé</th><th>Moyenne</th><th>Médiane</th><th>Encaissé</th><th>Dont rattrapages</th></tr></thead>
                <tbody>
                  {entity.months.map((month) => (
                    <tr key={month.month}>
                      <td className="is-strong" style={{ textTransform: 'capitalize' }}>{monthLabel(month.month)}</td>
                      <td className="fst-num">{count(month.payers)}</td>
                      <td className="fst-num is-strong">{eur(month.average_eur)}</td>
                      <td className="fst-num">{eur(month.median_eur)}</td>
                      <td className="fst-num">{eur(month.received_eur)}</td>
                      <td className="fst-num">{eur(month.catch_up_eur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="fst-chart">
            <div className="fst-chart-title"><span>Combien paient-ils</span><span>{months > 1 ? 'mensualités' : 'clients'} par tranche</span></div>
            <div className="fst-dist">
              {entity.distribution.map((bucket) => (
                <div key={bucket.from} className="fst-dist-row">
                  <span>{bucketLabel(bucket)}</span>
                  <Fill value={bucket.clients / largest} />
                  <span className="fst-num">{count(bucket.clients)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
