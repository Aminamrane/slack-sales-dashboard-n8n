import { SlidersHorizontal } from "lucide-react";
import { money } from "./calculation.js";
import { InfoTip } from "./InfoTip.jsx";
import { CHANNELS, decimalLabel } from "./presentation.js";
import { ProfileAvatar } from "./profileAvatar.jsx";
import { SaleLine, SaleMeta, SectionList } from "./SalesTable.jsx";
import { groupTotals, sortSales } from "./team.js";

// Part d'équipe d'un head, vente par vente, lue comme la liste des ventes : client et vendeur, statut en pastille,
// part et son calcul (base de la vente × coefficient d'équipe). D'abord les ventes
// de l'équipe comptées ce mois (dans sa rémunération, = la ligne « Part d'équipe » de la carte), puis les
// autres, comme la carte : reportées (dans la paie du mois du paiement), clients pas encore payés, clients
// perdus. Chaque part s'ouvre pour être modifiée.
// Mouvement : comme les ventes, entrée en cascade quand la personne ou le mois change.
export function TeamShareTable({ source, groups, period, total, missedTotal, settings, bodyKey, rowEntry, rowDelay, focus, onEdit, onRules }) {
  const outside = groups.deferred.length + groups.pending.length + groups.lost.length;
  const coefficients = Object.entries(CHANNELS)
    .filter(([key]) => settings.acquisition?.[key]?.team != null)
    .map(([key, name]) => `${decimalLabel(settings.acquisition[key].team)} ${name.toLowerCase()}`)
    .join(", ");
  return (
    <section className="vr-sales vr-team-sales" aria-label="Part d’équipe">
      <div className="vr-sales-head">
        <h3>Part d’équipe <span className="vr-count vr-num">{groups.counted.length}</span></h3>
        <InfoTip label="Calcul de la part d’équipe" align="start">
          <ul>
            <li>Sur chaque vente d’un membre de son équipe, au mois où le client paie sa 1re échéance Owner, comme ses propres ventes.</li>
            <li>Base de la vente × coefficient d’équipe : {coefficients}.</li>
            <li>Équipe du CRM ; aucune part sur ses propres ventes.</li>
          </ul>
        </InfoTip>
        <button type="button" className="vr-button vr-sales-action" onClick={onRules}><SlidersHorizontal size={14} />Coefficients d’équipe</button>
      </div>
      <div className="vr-card vr-table-card">
        <div className="vr-table" role="table" aria-label="Ventes de l’équipe">
          <TeamBody key={bodyKey} source={source} groups={groups} period={period} rowEntry={rowEntry} rowDelay={rowDelay} focus={focus} onEdit={onEdit} />
        </div>
        <footer className="vr-table-footer vr-team-footer">
          <span>Part d’équipe du mois{outside > 0 && missedTotal.n !== 0n && <> · manque à gagner <span className="vr-num">{money(missedTotal)}</span></>}</span>
          <b className="vr-num">{money(total)}</b>
        </footer>
      </div>
    </section>
  );
}

// Même liste que les ventes, vendeur dans la ligne de détail. Seule « Dans la paie » est ouverte au départ : c'est
// la part du head ce mois-ci ; les autres sections montrent leur nombre et leur total, et s'ouvrent au clic ou
// depuis la carte (focus).
function TeamBody({ source, groups, period, rowEntry, rowDelay, focus, onEdit }) {
  const rows = sortSales([...groups.counted, ...groups.deferred, ...groups.pending, ...groups.lost]);
  if (!rows.length) return <div className="vr-empty">Aucune vente de l’équipe ce mois-ci</div>;
  return (
    <SectionList rows={rows} stats={groupTotals(rows)} period={period} laterMonths={groups.months} rowEntry={rowEntry} rowDelay={rowDelay}
      initialOpen={(key) => key === "counted"} focus={focus}
      renderRow={(row, motionProps) => {
        const seller = row.seller && (
          <span className="vr-meta-seller"><ProfileAvatar source={source} person={row.seller} className="tiny" />{row.sellerName}</span>
        );
        return <SaleLine key={row.ref} row={row} motionProps={motionProps} onEdit={onEdit} label={`Part d’équipe · ${row.client}`}
          meta={<SaleMeta row={row} prefix={seller} />} />;
      }} />
  );
}
