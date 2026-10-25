import { useState } from "react";
import {
  ArrowRight,
  Undo2,
  AlertTriangle,
  Coins,
  Plus,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import { createCalculator, normalizeInput, Rational } from "./calculation.js";
import { impactedStatements, validateTiers } from "./model.js";
import { Modal, IconButton } from "./ui.jsx";
import { calculationParts } from "./dealCalculation.js";
import { safeMoney, CHANNELS } from "./presentation.js";
export function ActualCellEditor({
  source,
  draft,
  onClose,
  onSave,
  label,
  cellRef,
  activeRule,
}) {
  const ref = cellRef;
  const calc = createCalculator(source.cells, draft.changes);
  const [input, setInput] = useState(String(calc.raw(ref))),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");

  const sourceInput = source.cells[ref]?.input ?? "";
  const parts = calculationParts(calc, ref);
  const [coefficient, setCoefficient] = useState(parts.coefficient || "");
  let candidate = null,
    previewError = "",
    impacts = [];
  try {
    const normalized = normalizeInput(input);
    candidate = createCalculator(source.cells, {
      ...draft.changes,
      [ref]: normalized,
    });
    candidate.value(ref);
    impacts = impactedStatements(source, {
      ...draft.changes,
      [ref]: normalized,
    });
    for (const s of impacts) candidate.value(s.totalCell);
  } catch (e) {
    previewError = e.message;
  }
  const dependencies = String(input).startsWith("=")
    ? (() => {
        try {
          return candidate?.dependencies(ref) || [];
        } catch {
          return [];
        }
      })()
    : [];
  return (
    <Modal
      title={parts.kind === "coefficient" ? "Modifier le coefficient" : "Modifier le montant"}
      subtitle={label}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (previewError) {
            setError(previewError);
            return;
          }
          onSave(normalizeInput(input), reason.trim());
        }}
      >
        <div className="vr-form-body">
          {activeRule && (
            <p className="vr-warning">
              Modification limitée à cette vente.
            </p>
          )}
          <div className="vr-edit-comparison">
            <div>
              <span>Valeur de référence</span>
              <strong>{safeMoney(createCalculator(source.cells), ref)}</strong>
              
            </div>
            <ArrowRight size={20} />
            <div className="changed">
              <span>Nouvelle valeur</span>
              <strong>
                {candidate && !previewError
                  ? safeMoney(candidate, ref)
                  : "À vérifier"}
              </strong>
              <small>Recalcul immédiat</small>
            </div>
          </div>
          {parts.kind === "coefficient" && <div className="vr-coefficient-editor"><div><small>Base de calcul</small><strong>{parts.base.replace('.',',')} €</strong></div><span>×</span><label className="vr-field">Coefficient<input autoFocus aria-label="Coefficient de cette vente" inputMode="decimal" value={coefficient} onChange={e=>{setCoefficient(e.target.value);setInput(`=(${parts.baseExpression})*${e.target.value.replace(',','.')}`);}}/></label></div>}
          <details className="vr-advanced" open={parts.kind !== "coefficient"}><summary>Montant ou formule détaillée</summary><label className="vr-field">Montant ou formule<input aria-label="Montant ou formule" value={input} onChange={e=>setInput(e.target.value)}/><small>Les références d’origine sont conservées dans le calcul.</small></label></details>
          {dependencies.length > 0 && (
            <details className="vr-precedents"><summary>Voir les éléments du calcul</summary>
              {dependencies.slice(0, 30).map((r) => (
                <div key={r}>
                  <code>{r}</code>
                  <span>{String(calc.raw(r)) || "Vide"}</span>
                  <b>{safeMoney(calc, r)}</b>
                </div>
              ))}
            </details>
          )}
          <details className="vr-optional-note"><summary>Ajouter une note pour les RH <span>facultatif</span></summary><label className="vr-field">Motif de la modification<textarea
              
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. ajustement du fixe convenu pour cette période"
            /></label></details>
          {impacts.length > 1 && (
            <p className="vr-warning">
              <AlertTriangle size={16} />
              Cette cellule intervient dans {impacts.length} relevés dont le
              résultat diffère de la source :{" "}
              {impacts
                .slice(0, 5)
                .map((s) => `${s.person} (${s.totalCell})`)
                .join(", ")}
              .
            </p>
          )}
          {(previewError || error) && (
            <div className="vr-error" role="alert">
              {previewError || error}
            </div>
          )}
        </div>
        <div className="vr-dialog-footer">
          <button
            type="button"
            className="vr-button"
            onClick={() => setInput(String(sourceInput))}
          >
            <Undo2 size={15} />
            Valeur source
          </button>
          <button type="button" className="vr-button" onClick={onClose}>
            Annuler
          </button>
          <button
            disabled={!!previewError}
            className="vr-button primary"
            type="submit"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function RulesEditor({
  initialSection="fixed",
  settings,
  fixedCell,
  person,
  label,
  onClose,
  onSave,
}) {
  const [section, setSection] = useState(initialSection),
    [tiers, setTiers] = useState(settings.tiers || []),
    [sales, setSales] = useState(settings.sales ?? ""),
    [acquisition, setAcquisition] = useState(settings.acquisition || {}),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const changeTier = (i, key, value) =>
    setTiers(
      tiers.map((t, index) => (index === i ? { ...t, [key]: value } : t)),
    );
  const save = () => {
    try {
      const normalized = tiers.map((t) => ({
        ...t,
        amount: normalizeInput(t.amount),
      }));
      validateTiers(normalized);
      if (tiers.length && (!fixedCell || !/^\d+$/.test(String(sales))))
        throw Error(
          "Identifiez le fixe et renseignez un nombre entier de ventes validées.",
        );
      const rules = Object.fromEntries(
        Object.entries(acquisition).map(([k, r]) => {
          if (!r.enabled) return [k, r];
          const coefficient = normalizeInput(r.coefficient);
          if (Rational.from(coefficient).n < 0n)
            throw Error("Un coefficient ne peut pas être négatif.");
          const coefficientAnnual = normalizeInput(r.coefficientAnnual ?? coefficient);
          if (Rational.from(coefficientAnnual).n < 0n) throw Error("Coefficient annuel négatif.");
          return [k, { ...r, coefficient, coefficientAnnual }];
        }),
      );

      onSave({
        ...settings,
        tiers: normalized,
        sales,
        acquisition: rules,
        rulesReason: reason,
      });
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Modal
      title="Règles de rémunération"
      subtitle={`${person} · ${label} · appliquées à ce relevé uniquement`}
      onClose={onClose}
      wide
    >
      <div className="vr-modal-tabs">
        <button
          className={section === "fixed" ? "active" : ""}
          onClick={() => setSection("fixed")}
        >
          Fixe & paliers
        </button>
        <button
          className={section === "acquisition" ? "active" : ""}
          onClick={() => setSection("acquisition")}
        >
          Sources d’acquisition
        </button>
      </div>
      <div className="vr-form-body">
        {section === "fixed" ? (
          <>
            <div className="vr-rule-explainer">
              <Coins size={24} />
              <div>
                <h3>Un fixe qui évolue avec les ventes</h3>

              </div>
            </div>
            <label className="vr-field">
              Nombre de ventes validées pour ce relevé
              <input
                type="number"
                min="0"
                step="1"
                placeholder="À confirmer"
                value={sales}
                onChange={(e) => setSales(e.target.value)}
              />
              <small>
                Ventes du CRM avec un encaissement Owner confirmé en Finance.
              </small>
            </label>
            {tiers.map((t, i) => (
              <div className="vr-tier" key={i}>
                <span>À partir de</span>
                <input
                  aria-label={`Seuil du palier ${i + 1}`}
                  type="number"
                  min="1"
                  step="1"
                  value={t.sales}
                  onChange={(e) => changeTier(i, "sales", e.target.value)}
                />
                <span>ventes, fixe de</span>
                <input
                  aria-label={`Fixe du palier ${i + 1}`}
                  inputMode="decimal"
                  value={t.amount}
                  onChange={(e) => changeTier(i, "amount", e.target.value)}
                />
                <span>€</span>
                <IconButton
                  label={`Supprimer palier ${i + 1}`}
                  onClick={() => setTiers(tiers.filter((_, n) => n !== i))}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            ))}
            <button
              className="vr-button dashed"
              disabled={!fixedCell}
              onClick={() => setTiers([...tiers, { sales: "", amount: "" }])}
            >
              <Plus size={16} />
              Ajouter un palier
            </button>
            {!fixedCell && (
              <p className="vr-warning">
                Le fixe n’est pas identifiable dans cette formule. Il faut
                d’abord préciser sa cellule source.
              </p>
            )}
            <p className="vr-rule-example">
              Exemple de fonctionnement : si vous définissez un palier à 5
              ventes, il s’applique dès la 5e vente. Aucun montant n’est
              prédéfini.
            </p>
          </>
        ) : (
          <>
            <div className="vr-rule-explainer">
              <SlidersHorizontal size={24} />
              <div>
                <h3>Une règle par source</h3>

              </div>
            </div>
            {Object.entries(CHANNELS).map(([key, name]) => (
              <div className="vr-acquisition-rule" key={key}>
                <div>
                  <strong>{key === "WEB" ? "Webinaire" : key}</strong>
                  <span>{name}</span>
                </div>
                <label>
                  <input
                    aria-label={`Activer règle ${key}`}
                    type="checkbox"
                    checked={!!acquisition[key]?.enabled}
                    onChange={(e) =>
                      setAcquisition({
                        ...acquisition,
                        [key]: {
                          ...acquisition[key],
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  Activer
                </label>
                <label>
                  Mensuel · coefficient
                  <input
                    aria-label={`Coefficient ${key}`}
                    disabled={!acquisition[key]?.enabled}
                    placeholder="Ex. 1,2"
                    value={acquisition[key]?.coefficient ?? ""}
                    onChange={(e) =>
                      setAcquisition({
                        ...acquisition,
                        [key]: {
                          ...acquisition[key],
                          coefficient: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>Annuel · coefficient<input aria-label={`Coefficient annuel ${key}`} disabled={!acquisition[key]?.enabled} value={acquisition[key]?.coefficientAnnual ?? acquisition[key]?.coefficient ?? ""} onChange={e=>setAcquisition({...acquisition,[key]:{...acquisition[key],coefficientAnnual:e.target.value}})}/></label>
              </div>
            ))}
            <p className="vr-rule-example">
              CCS = cold call setter. Les exceptions par vente gardent leur
              formule propre. Une règle désactivée laisse le calcul d’origine
              inchangé.
            </p>
          </>
        )}
        <details className="vr-optional-note"><summary>Ajouter une note pour les RH <span>facultatif</span></summary><label className="vr-field">Motif / décision<textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Pourquoi ces règles changent-elles ?"
          /></label></details>
        {error && (
          <div className="vr-error" role="alert">
            {error}
          </div>
        )}
      </div>
      <div className="vr-dialog-footer">
        <button className="vr-button" onClick={onClose}>
          Annuler
        </button>
        <button className="vr-button primary" onClick={save}>
          Enregistrer les règles
        </button>
      </div>
    </Modal>
  );
}
export function BonusEditor({ onClose, onSave }) {
  const [label, setLabel] = useState(""),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  return (
    <Modal
      title="Ajouter une prime ou un ajustement"
      subtitle="Pour cette personne et cette période"
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const value = normalizeInput(amount);
            Rational.from(value);
            if (!label.trim()) throw Error("Le libellé est obligatoire.");
            onSave({
              id: crypto.randomUUID(),
              label: label.trim(),
              amount: value,
              reason: reason.trim(),
            });
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <div className="vr-form-body">
          <label className="vr-field">
            Libellé
            <input
              autoFocus
              required
              placeholder="Prime challenge, régularisation…"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="vr-field">
            Montant (€)
            <input
              required
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <small>
              Un montant négatif correspond à une retenue ou une reprise.
            </small>
          </label>
          <details className="vr-optional-note"><summary>Ajouter une note pour les RH <span>facultatif</span></summary><label className="vr-field">Motif<textarea
              
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            /></label></details>
          {error && (
            <div className="vr-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="vr-dialog-footer">
          <button type="button" className="vr-button" onClick={onClose}>
            Annuler
          </button>
          <button className="vr-button primary" type="submit">
            Ajouter la prime
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function DealEditor({ row, deal, rules, onClose, onSave }) {
  const [channel, setChannel] = useState(deal.channel || ""),
    [base, setBase] = useState(deal.base ?? ""),
    [exception, setException] = useState(!!deal.exception),
    [reason, setReason] = useState(deal.reason || ""),
    [error, setError] = useState("");
  return (
    <Modal
      title="Rémunération de cette vente"
      subtitle={`${row.client} · ${row.amountCell}`}
      onClose={onClose}
    >
      <div className="vr-form-body"><div className="vr-origin-reference"><small>Origine de la vente</small><strong>{deal.origin || "Non retrouvée dans les données disponibles"}</strong><span>Conservée dans le CRM</span></div>
        <label className="vr-field">
          Rémunérer cette vente comme
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Origine non retrouvée</option>
            {Object.entries(CHANNELS).map(([k, n]) => (
              <option key={k} value={k}>
                {k} · {n}
              </option>
            ))}
          </select>
        </label>
        <details className="vr-advanced"><summary>Paramètres du calcul</summary><label className="vr-field">
          Base de calcul (€)
          <input
            inputMode="decimal"
            placeholder="Montant avant application du coefficient"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
          <small>
            Base reprise du calcul existant lorsqu’il est identifiable.
          </small>
        </label>
        <label className="vr-checkbox">
          <input
            type="checkbox"
            checked={exception}
            onChange={(e) => setException(e.target.checked)}
          />
          Conserver une formule particulière pour cette vente
        </label></details>
        {channel!==deal.channel&&!rules?.[channel]?.enabled&&<p className="vr-warning">Aucun coefficient n’est configuré pour cette catégorie sur ce relevé. Configurez sa règle pour recalculer la commission ; le montant existant reste conservé.</p>}
        <details className="vr-optional-note"><summary>Ajouter une note pour les RH <span>facultatif</span></summary><label className="vr-field">Motif du choix<textarea
            
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. décision CEO : rémunérer cette vente Webinaire comme une vente ADS"
          /></label></details>
        {error && (
          <div className="vr-error" role="alert">
            {error}
          </div>
        )}
      </div>
      <div className="vr-dialog-footer">
        <button className="vr-button" onClick={onClose}>
          Annuler
        </button>
        <button
          className="vr-button primary"
          onClick={() => {
            try {
              const normalized = base === "" ? "" : normalizeInput(base);
              if (normalized !== "" && Rational.from(normalized).n < 0n)
                throw Error("Base négative invalide");

              onSave({
                channel,
                base: normalized,
                exception,
                reason: reason.trim(),
              });
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
export function PeriodEditor({ settings, person, onClose, onSave }) {
  const [period, setPeriod] = useState(settings.period || "");
  return (
    <Modal
      title="Préciser la période de paie"
      subtitle={`Relevé de ${person}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) onSave(period);
        }}
      >
        <div className="vr-form-body">
          <label className="vr-field">
            Mois et année
            <input
              required
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
          <p>
            Cette information qualifie le relevé local. Elle ne déplace aucune
            vente et ne change pas le Sheet.
          </p>
        </div>
        <div className="vr-dialog-footer">
          <button className="vr-button primary" type="submit">
            Confirmer la période
          </button>
        </div>
      </form>
    </Modal>
  );
}
