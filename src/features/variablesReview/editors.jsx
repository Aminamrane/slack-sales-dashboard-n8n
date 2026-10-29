import { useState } from "react";
import { motion as Motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Plus, Trash2, Undo2 } from "lucide-react";
import { createCalculator, money, normalizeInput, Rational } from "./calculation.js";
import { impactedStatements, validateTiers } from "./model.js";
import { Modal, IconButton } from "./ui.jsx";
import { ChannelIcon } from "./ChannelIcon.jsx";
import { calculationParts } from "./dealCalculation.js";
import { SPRING_UI } from "./motion.js";
import { amountInput, CHANNELS, decimalLabel, ofMonth, safeMoney } from "./presentation.js";

const personName = (source, person) => source.profiles?.[person]?.name || person;

function HrNote({ value, onChange, label = "Motif", placeholder }) {
  return (
    <details className="vr-optional-note">
      <summary>Ajouter une note pour les RH <span>facultatif</span></summary>
      <label className="vr-field">{label}<textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>
    </details>
  );
}

function Tabs({ value, onChange, tabs }) {
  return (
    <div className="vr-modal-tabs" role="tablist">
      {tabs.map(([key, label]) => (
        <button type="button" role="tab" key={key} aria-selected={value === key} className={value === key ? "active" : ""} onClick={() => onChange(key)}>
          {label}
          {value === key && <Motion.span layoutId="vr-tab-active" className="vr-tab-active" transition={SPRING_UI} />}
        </button>
      ))}
    </div>
  );
}

// Fenêtre complète d'une cellule (« Plus d'options ») : coefficient, montant ou formule, note RH.
export function ActualCellEditor({ source, draft, onClose, onSave, label, cellRef, activeRule }) {
  const ref = cellRef;
  const calc = createCalculator(source.cells, draft.changes);
  const [input, setInput] = useState(String(calc.raw(ref))),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const sourceInput = source.cells[ref]?.input ?? "";
  const parts = calculationParts(calc, ref);
  const [coefficient, setCoefficient] = useState(decimalLabel(parts.coefficient || ""));
  let candidate = null,
    previewError = "",
    impacts = [];
  try {
    const normalized = normalizeInput(input);
    candidate = createCalculator(source.cells, { ...draft.changes, [ref]: normalized });
    candidate.value(ref);
    impacts = impactedStatements(source, { ...draft.changes, [ref]: normalized });
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
    <Modal title={parts.kind === "coefficient" ? "Modifier le coefficient" : "Modifier le montant"} subtitle={label} onClose={onClose} wide>
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
          {activeRule && <div className="vr-warning">Modification limitée à cette vente.</div>}
          <div className="vr-edit-comparison">
            <div>
              <span>Valeur calculée</span>
              <strong className="vr-num">{safeMoney(createCalculator(source.cells), ref)}</strong>
            </div>
            <ArrowRight size={18} />
            <div className="changed">
              <span>Nouvelle valeur</span>
              <strong className="vr-num">{candidate && !previewError ? safeMoney(candidate, ref) : "À vérifier"}</strong>
            </div>
          </div>
          {parts.kind === "coefficient" && (
            <div className="vr-coefficient-editor">
              <div><small>Base de calcul</small><strong className="vr-num">{money(Rational.from(parts.base))}</strong></div>
              <span>×</span>
              <label className="vr-field">
                Coefficient
                <input autoFocus aria-label="Coefficient de cette vente" inputMode="decimal" value={coefficient}
                  onChange={(e) => {
                    setCoefficient(e.target.value);
                    setInput(`=(${parts.baseExpression})*${e.target.value.replace(",", ".")}`);
                  }} />
              </label>
            </div>
          )}
          <details className="vr-advanced" open={parts.kind !== "coefficient"}>
            <summary>Montant ou formule détaillée</summary>
            <label className="vr-field">Montant ou formule<input aria-label="Montant ou formule" value={input} onChange={(e) => setInput(e.target.value)} /></label>
            {dependencies.length > 0 && (
              <details className="vr-precedents">
                <summary>Éléments du calcul</summary>
                {dependencies.slice(0, 30).map((r) => (
                  <div key={r}><code>{r}</code><span>{String(calc.raw(r)) || "Vide"}</span><b className="vr-num">{safeMoney(calc, r)}</b></div>
                ))}
              </details>
            )}
          </details>
          <HrNote value={reason} onChange={setReason} label="Motif de la modification" placeholder="Ex. ajustement convenu pour ce mois" />
          {impacts.length > 1 && (
            <div className="vr-warning">
              <AlertTriangle size={15} />
              Ce changement modifie aussi : {impacts.slice(0, 5).map((s) => personName(source, s.person)).join(", ")}.
            </div>
          )}
          {(previewError || error) && <div className="vr-error" role="alert">{previewError || error}</div>}
        </div>
        <div className="vr-dialog-footer">
          <button type="button" className="vr-button" onClick={() => { setInput(String(sourceInput)); setCoefficient(decimalLabel(calculationParts(createCalculator(source.cells), ref).coefficient || "")); }}>
            <Undo2 size={14} />Valeur calculée
          </button>
          <button type="button" className="vr-button" onClick={onClose}>Annuler</button>
          <button disabled={!!previewError} className="vr-button primary" type="submit">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

// Saisie du fixe en euros. La formule éventuelle reste derrière « Plus d'options ».
export function FixedEditor({ current, subtitle, tier, preview, onClose, onSave, onMore }) {
  const [amount, setAmount] = useState(amountInput(current)),
    [reason, setReason] = useState("");
  let normalized = "", error = "", next = null;
  try {
    normalized = normalizeInput(amount);
    if (normalized.startsWith("=")) throw new Error("Saisissez un montant en euros.");
    if (Rational.from(normalized).n < 0n) throw new Error("Le fixe ne peut pas être négatif.");
    next = preview(normalized);
  } catch (e) {
    error = amount.trim() ? e.message : "Saisissez un montant en euros.";
  }
  return (
    <Modal title="Modifier le fixe" subtitle={subtitle} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (!error) onSave(normalized, reason.trim()); }}>
        <div className="vr-form-body">
          <div className="vr-edit-comparison">
            <div><span>Fixe actuel</span><strong className="vr-num">{money(current)}</strong></div>
            <ArrowRight size={18} />
            <div className="changed">
              <span>Nouveau fixe</span>
              <strong className="vr-num">{next ? money(Rational.from(normalized)) : "À vérifier"}</strong>
            </div>
          </div>
          <label className="vr-field">
            Fixe du mois (€)
            <span className="vr-input-unit">
              <input autoFocus inputMode="decimal" aria-label="Fixe du mois en euros" value={amount} onChange={(e) => setAmount(e.target.value)} onFocus={(e) => e.target.select()} />
              <span>€</span>
            </span>
          </label>
          <div className="vr-facts">
            {next && <div><span>Rémunération du mois</span><b className="vr-num">{money(next.total)}</b></div>}
            {tier && <div><span>Palier atteint</span><b className="vr-num">{tier.reached.sales} ventes · {money(Rational.from(tier.reached.amount))}</b></div>}
          </div>
          <HrNote value={reason} onChange={setReason} placeholder="Ex. fixe convenu à l’embauche" />
          {error && amount.trim() && <div className="vr-error" role="alert">{error}</div>}
        </div>
        <div className="vr-dialog-footer">
          <button type="button" className="vr-button ghost" onClick={onMore}>Plus d’options</button>
          <button type="button" className="vr-button" onClick={onClose}>Annuler</button>
          <button className="vr-button primary" type="submit" disabled={!!error}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

const withComma = (rules) =>
  Object.fromEntries(Object.entries(rules || {}).map(([k, r]) => [k, {
    ...r,
    coefficient: decimalLabel(r.coefficient ?? ""),
    ...(r.coefficientAnnual != null ? { coefficientAnnual: decimalLabel(r.coefficientAnnual) } : {}),
    ...(r.team != null ? { team: decimalLabel(r.team) } : {}),
  }]));

const toDot = (rule, key) => (rule[key] == null ? {} : { [key]: String(rule[key]).trim().replace(",", ".") });

// Une liste de paliers modifiable : « À partir de N ventes : montant ».
function TierRows({ label, tiers, onChange }) {
  const change = (i, key, value) => onChange(tiers.map((t, index) => (index === i ? { ...t, [key]: value } : t)));
  return (
    <>
      {tiers.map((t, i) => (
        <div className="vr-tier" key={i}>
          <span>À partir de</span>
          <input aria-label={`${label} : seuil du palier ${i + 1}`} type="number" min="1" step="1" value={t.sales} onChange={(e) => change(i, "sales", e.target.value)} />
          <span>ventes :</span>
          <span className="vr-input-unit">
            <input aria-label={`${label} : montant du palier ${i + 1}`} inputMode="decimal" value={t.amount} onChange={(e) => change(i, "amount", e.target.value)} />
            <span>€</span>
          </span>
          <IconButton label={`Supprimer le palier ${i + 1}`} onClick={() => onChange(tiers.filter((_, n) => n !== i))}><Trash2 size={14} /></IconButton>
        </div>
      ))}
      <button type="button" className="vr-button dashed" onClick={() => onChange([...tiers, { sales: "", amount: "" }])}>
        <Plus size={15} />Ajouter un palier
      </button>
    </>
  );
}

const editable = (tiers) => (tiers || []).map((t) => ({ sales: String(t.sales), amount: decimalLabel(t.amount) }));
// Paliers saisis → liste envoyée au serveur (montants au point), validée (seuils, montants, progression).
function cleanTiers(tiers) {
  const normalized = tiers.map((t) => ({ sales: String(t.sales).trim(), amount: normalizeInput(t.amount) }));
  return validateTiers(normalized).map((t) => ({ sales: Number(t.sales), amount: t.amount }));
}
const sameTiers = (a, b) => JSON.stringify(a) === JSON.stringify((b || []).map((t) => ({ sales: Number(t.sales), amount: String(t.amount) })));

// Règles de rémunération de la personne. « Fixe & paliers » (dev 28/10) : paliers généraux (tous les sales et heads)
// ou propres à la personne, à partir d'un mois non versé ; « Coefficients » : par source, pour ce mois.
export function RulesEditor({ initialSection = "fixed", settings, tier, general, own, personName, fromMonthLabel, subtitle, onClose, onSave, onSaveTiers }) {
  const [section, setSection] = useState(initialSection),
    [generalTiers, setGeneralTiers] = useState(editable(general)),
    [ownOn, setOwnOn] = useState(!!own),
    [ownTiers, setOwnTiers] = useState(editable(own || general)),
    [acquisition, setAcquisition] = useState(withComma(settings.acquisition)),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const changeRule = (key, patch) => setAcquisition({ ...acquisition, [key]: { ...acquisition[key], ...patch } });
  // Head qui mène une équipe : le serveur fournit un coefficient d'équipe par source.
  const hasTeam = Object.values(acquisition).some((r) => r?.team != null);
  const saveCoefficients = () => {
    try {
      const rules = Object.fromEntries(
        Object.entries(acquisition).map(([k, r]) => {
          // Source désactivée : conservée telle quelle (comme Codex), seule la virgule redevient un point.
          if (!r.enabled) return [k, { ...r, ...toDot(r, "coefficient"), ...toDot(r, "coefficientAnnual"), ...toDot(r, "team") }];
          const coefficient = normalizeInput(r.coefficient);
          if (Rational.from(coefficient).n < 0n) throw Error("Un coefficient ne peut pas être négatif.");
          const coefficientAnnual = normalizeInput(r.coefficientAnnual ?? coefficient);
          if (Rational.from(coefficientAnnual).n < 0n) throw Error("Coefficient annuel négatif.");
          if (r.team == null) return [k, { ...r, coefficient, coefficientAnnual }];
          const team = normalizeInput(r.team);
          if (Rational.from(team).n < 0n) throw Error("Coefficient d’équipe négatif.");
          return [k, { ...r, coefficient, coefficientAnnual, team }];
        }),
      );
      // Les anciens paliers par relevé (fixe garanti) ne sont plus lus : retirés du réglage.
      const { tiers: _tiers, sales: _sales, ...rest } = settings;
      onSave({ ...rest, acquisition: rules, rulesReason: reason });
    } catch (e) {
      setError(e.message);
    }
  };
  const saveTiers = () => {
    try {
      const nextGeneral = cleanTiers(generalTiers);
      const nextOwn = ownOn ? cleanTiers(ownTiers) : null;
      const changes = [];
      if (!sameTiers(nextGeneral, general)) changes.push({ scope: "general", tiers: nextGeneral, before: general });
      if (ownOn ? !own || !sameTiers(nextOwn, own) : !!own) changes.push({ scope: "person", tiers: nextOwn, before: own });
      if (!changes.length) return onClose();
      onSaveTiers(changes, reason.trim());
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Modal
      title="Règles de rémunération"
      subtitle={subtitle}
      info={
        <ul>
          <li>Paliers : ventes signées dans le mois, payées ou non, sauf rétractation actée au board. Le palier est un minimum sur le total du mois : fixe, commissions de ces ventes et primes. S’il est au-dessus de ce total, la personne touche le palier et toutes ses ventes du mois comptent ce mois-ci ; sinon, chaque vente compte au mois où le client paie.</li>
          <li>Paliers généraux : pour tous les sales et heads. Paliers propres : remplacent les généraux pour cette personne.</li>
          <li>Un changement de palier vaut à partir du mois indiqué ; les mois déjà versés ne bougent pas.</li>
          <li>Coefficients : pour cette personne et ce mois. Une source désactivée garde le calcul d’origine ; une vente en calcul individuel garde sa formule. CCS : cold call setter.</li>
          {hasTeam && <li>Équipe : part du head sur chaque vente de son équipe, base de la vente × coefficient, sans mensuel ni annuel, au mois où le client paie.</li>}
        </ul>
      }
      onClose={onClose}
      wide
    >
      <Tabs value={section} onChange={setSection} tabs={[["fixed", "Fixe & paliers"], ["acquisition", "Coefficients"]]} />
      <div className="vr-form-body">
        {section === "fixed" ? (
          <>
            <div className="vr-facts">
              <div><span>Ventes du mois pour les paliers</span>
                <b className="vr-num">{tier?.monthSales ?? 0}{tier?.retracted ? ` · ${tier.retracted} rétractation${tier.retracted > 1 ? "s" : ""} actée${tier.retracted > 1 ? "s" : ""} retirée${tier.retracted > 1 ? "s" : ""}` : ""}</b></div>
              <div><span>Palier atteint</span>
                <b className="vr-num">{tier?.reached ? `${tier.reached.sales} ventes · ${money(Rational.from(tier.reached.amount))}` : "Aucun"}</b></div>
              {tier?.reached && tier.binding === false && (
                <div><span>Total du mois (fixe, commissions, primes)</span>
                  <b className="vr-num">{money(Rational.from(tier.monthTotal))} · au-dessus, le palier ne joue pas</b></div>
              )}
            </div>
            <span className="vr-pay-group">Paliers généraux · tous les sales et heads</span>
            <TierRows label="Paliers généraux" tiers={generalTiers} onChange={setGeneralTiers} />
            <label className="vr-tier-own">
              <span className="vr-switch">
                <input type="checkbox" aria-label={`Paliers propres à ${personName}`} checked={ownOn} onChange={(e) => setOwnOn(e.target.checked)} />
                <span aria-hidden="true" />
              </span>
              Paliers propres à {personName}
            </label>
            {ownOn && <TierRows label={`Paliers de ${personName}`} tiers={ownTiers} onChange={setOwnTiers} />}
            <div className="vr-warning">S’applique à partir {ofMonth(fromMonthLabel)} ; les mois déjà versés ne changent pas.</div>
          </>
        ) : (
          <div className={`vr-rules-grid ${hasTeam ? "team" : ""}`} role="table" aria-label="Coefficients par source">
            <div className="vr-rules-row head" role="row">
              <span role="columnheader">Source</span>
              <span role="columnheader">Active</span>
              <span role="columnheader">Mensuel</span>
              <span role="columnheader">Annuel</span>
              {hasTeam && <span role="columnheader">Équipe</span>}
            </div>
            {Object.entries(CHANNELS).map(([key, name]) => {
              const rule = acquisition[key] || {};
              return (
                <div className={`vr-rules-row ${rule.enabled ? "" : "off"}`} role="row" key={key}>
                  <span role="cell" className="vr-rules-name"><ChannelIcon channel={key} size={15} />{name}</span>
                  <span role="cell">
                    <label className="vr-switch">
                      <input type="checkbox" aria-label={`Activer ${name}`} checked={!!rule.enabled} onChange={(e) => changeRule(key, { enabled: e.target.checked })} />
                      <span aria-hidden="true" />
                    </label>
                  </span>
                  <span role="cell">
                    <input className="vr-num" aria-label={`Coefficient mensuel ${name}`} inputMode="decimal" disabled={!rule.enabled} placeholder="1,2"
                      value={rule.coefficient ?? ""} onChange={(e) => changeRule(key, { coefficient: e.target.value })} />
                  </span>
                  <span role="cell">
                    <input className="vr-num" aria-label={`Coefficient annuel ${name}`} inputMode="decimal" disabled={!rule.enabled}
                      value={rule.coefficientAnnual ?? rule.coefficient ?? ""} onChange={(e) => changeRule(key, { coefficientAnnual: e.target.value })} />
                  </span>
                  {hasTeam && (
                    <span role="cell">
                      <input className="vr-num" aria-label={`Coefficient d’équipe ${name}`} inputMode="decimal" disabled={!rule.enabled || rule.team == null}
                        value={rule.team ?? ""} onChange={(e) => changeRule(key, { team: e.target.value })} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <HrNote value={reason} onChange={setReason} label="Motif ou décision" placeholder="Pourquoi ces règles changent-elles ?" />
        {error && <div className="vr-error" role="alert">{error}</div>}
      </div>
      <div className="vr-dialog-footer">
        <button type="button" className="vr-button" onClick={onClose}>Annuler</button>
        <button type="button" className="vr-button primary" onClick={section === "fixed" ? saveTiers : saveCoefficients}>
          {section === "fixed" ? "Enregistrer les paliers" : "Enregistrer les coefficients"}
        </button>
      </div>
    </Modal>
  );
}

export function BonusEditor({ subtitle, onClose, onSave }) {
  const [label, setLabel] = useState(""),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  return (
    <Modal title="Ajouter une prime ou un ajustement" subtitle={subtitle} onClose={onClose}
      info={<span>Un montant négatif correspond à une retenue ou une reprise.</span>}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const value = normalizeInput(amount);
            Rational.from(value);
            if (!label.trim()) throw Error("Le libellé est obligatoire.");
            onSave({ id: crypto.randomUUID(), label: label.trim(), amount: value, reason: reason.trim() });
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <div className="vr-form-body">
          <label className="vr-field">Libellé<input autoFocus required placeholder="Prime challenge, régularisation…" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
          <label className="vr-field">
            Montant (€)
            <span className="vr-input-unit">
              <input required inputMode="decimal" placeholder="0,00 ou -50 pour une retenue" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span>€</span>
            </span>
          </label>
          <HrNote value={reason} onChange={setReason} />
          {error && <div className="vr-error" role="alert">{error}</div>}
        </div>
        <div className="vr-dialog-footer">
          <button type="button" className="vr-button" onClick={onClose}>Annuler</button>
          <button className="vr-button primary" type="submit">Ajouter la prime</button>
        </div>
      </form>
    </Modal>
  );
}

const DEAL_OPTIONS = [...Object.entries(CHANNELS), ["", "Origine non retrouvée"]];

export function DealEditor({ row, deal, rules, subtitle, onClose, onSave }) {
  const [channel, setChannel] = useState(deal.channel || ""),
    [base, setBase] = useState(decimalLabel(deal.base ?? "")),
    [exception, setException] = useState(!!deal.exception),
    [reason, setReason] = useState(deal.reason || ""),
    [error, setError] = useState("");
  return (
    <Modal title="Rémunération de cette vente" subtitle={subtitle ?? row.client} onClose={onClose}>
      <div className="vr-form-body">
        <div className="vr-facts">
          <div><span>Origine dans le CRM</span><b>{deal.origin || "Non retrouvée"}</b></div>
        </div>
        <div className="vr-field" role="radiogroup" aria-label="Rémunérer cette vente comme">
          Rémunérer cette vente comme
          <div className="vr-segments">
            {DEAL_OPTIONS.map(([key, name]) => (
              <button type="button" role="radio" aria-checked={channel === key} key={key || "none"} className={`vr-segment ${channel === key ? "active" : ""}`} onClick={() => setChannel(key)}>
                {channel === key && <Motion.span layoutId="vr-segment-active" className="vr-segment-active" transition={SPRING_UI} />}
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
        {channel !== deal.channel && !rules?.[channel]?.enabled && (
          <div className="vr-warning">Aucun coefficient actif pour cette catégorie ce mois-ci : le montant actuel est conservé.</div>
        )}
        <details className="vr-advanced">
          <summary>Plus d’options</summary>
          <label className="vr-field">
            Base de calcul (€)
            <input inputMode="decimal" placeholder="Montant avant coefficient" value={base} onChange={(e) => setBase(e.target.value)} />
          </label>
          <label className="vr-checkbox">
            <input type="checkbox" checked={exception} onChange={(e) => setException(e.target.checked)} />
            Garder une formule particulière pour cette vente
          </label>
        </details>
        <HrNote value={reason} onChange={setReason} label="Motif du choix" placeholder="Ex. décision CEO : rémunérer cette vente Webinaire comme une vente Ads" />
        {error && <div className="vr-error" role="alert">{error}</div>}
      </div>
      <div className="vr-dialog-footer">
        <button type="button" className="vr-button" onClick={onClose}>Annuler</button>
        <button
          type="button"
          className="vr-button primary"
          onClick={() => {
            try {
              const normalized = base === "" ? "" : normalizeInput(base);
              if (normalized !== "" && Rational.from(normalized).n < 0n) throw Error("Base négative invalide");
              onSave({ channel, base: normalized, exception, reason: reason.trim() });
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
