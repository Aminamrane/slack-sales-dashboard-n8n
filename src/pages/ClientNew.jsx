// src/pages/ClientNew.jsx
import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./contract.css";

// --- Supabase (même pattern que le leaderboard) ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function ClientNew() {
  // ---- state principal ----
  const [form, setForm] = useState({
    // Step 0 — Commercial & pré-audit
    salesName: "",
    preAuditNotes: "",
    clientPhone: "",

    // Step 1 — Sociétés liées (simplifié)
    companies: [{ name: "", type: "" }], // juste nom + type

    // Step 2 — Dirigeants / associés (simplifié)
    associates: [{ firstName: "", nature: "" }], // ex. “associé SCI”

    // Step 3 — Personne IR
    person: { firstName: "", lastName: "" },

    // Step 4 — Données fiscales IR
    tax: {
      bi: "",            // Base imposable (RFR)
      ir: "",            // Impôt sur le revenu net
      qf: "",            // Quotient familial (nb parts)
      fraisReels: "non", // "oui" | "non"
      rfNets: "",        // Revenus fonciers nets
      bicMarque: "non",  // "oui" | "non"
      rcm: "",           // RCM (dividendes)
    },

    // Step 5 — Sociétés (compta détaillée)
    // On laisse libre (le sales peut saisir toutes les sociétés pertinentes)
    companiesCompta: [
      {
        companyName: "",
        legalForm: "",
        closingDate: "",     // jj/mm ou mm/aaaa (au choix)
        taxRegime: "IS",     // par défaut IS
        treasury: "",        // “Disponibilités”
        caNet: "",           // Montant net du chiffre d'affaires
        produitsExploit: "", // Total des produits d’exploitation
        caPreference: "ca",  // "ca" (CA net) ou "tpe" (Total produits)
        rnc: "",             // Résultat courant avant impôt (RNC)
        is: "",              // Impôt sur les bénéfices
        cca: "",             // Compte courant associés
      },
    ],
  });

  const [step, setStep] = useState(0); // 0..6

  // ---- helpers ----
  const setField = (path, value) => {
    setForm((prev) => {
      const next = structuredClone(prev);
      const parts = path.split(".");
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts.at(-1)] = value;
      return next;
    });
  };

  const steps = useMemo(
    () => [
      { key: "preaudit",  title: "Commercial & Pré-audit" },
      { key: "companies", title: "Sociétés liées" },
      { key: "assoc",     title: "Dirigeants / Associés" },
      { key: "person",    title: "Client (IR)" },
      { key: "fiscal",    title: "Données fiscales" },
      { key: "socCompta", title: "Sociétés (compta)" },  // ← nouveau
      { key: "apercu",    title: "Aperçu & suite" },
    ],
    []
  );

  const goNext = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  const goTo = (i) => setStep(i);

  // ---- répétiteurs (sociétés / associés) ----
  const addCompany = () =>
    setForm((f) => ({ ...f, companies: [...f.companies, { name: "", type: "" }] }));
  const removeCompany = (idx) =>
    setForm((f) => ({ ...f, companies: f.companies.filter((_, i) => i !== idx) }));

  const addAssociate = () =>
    setForm((f) => ({ ...f, associates: [...f.associates, { firstName: "", nature: "" }] }));
  const removeAssociate = (idx) =>
    setForm((f) => ({ ...f, associates: f.associates.filter((_, i) => i !== idx) }));

  const addCompanyCompta = () =>
    setForm((f) => ({
      ...f,
      companiesCompta: [
        ...f.companiesCompta,
        {
          companyName: "",
          legalForm: "",
          closingDate: "",
          taxRegime: "IS",
          treasury: "",
          caNet: "",
          produitsExploit: "",
          caPreference: "ca",
          rnc: "",
          is: "",
          cca: "",
        },
      ],
    }));
  const removeCompanyCompta = (idx) =>
    setForm((f) => ({
      ...f,
      companiesCompta: f.companiesCompta.filter((_, i) => i !== idx),
    }));

  // ---- enregistrement brouillon (Supabase) ----
  async function saveDraft() {
    try {
      const { data, error } = await supabase
        .from("client_dossiers")
        .insert([
          {
            status: "draft",
            sales_name: form.salesName || null,
            payload: form, // tout le JSON
          },
        ])
        .select()
        .single();

      if (error) throw error;
      alert(`Brouillon enregistré (id ${data.id}).`);
    } catch (e) {
      console.error(e);
      alert("Erreur d’enregistrement brouillon.");
    }
  }

  return (
    <div className="wizard-outer">
      <div className="wizard">
        {/* Stepper gauche */}
        <aside className="wizard-side">
          <div className="wizard-brand">OWNER</div>
          <div className="wizard-steps">
            {steps.map((s, i) => {
              const state = i < step ? "done" : i === step ? "active" : "todo";
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`step ${state}`}
                  onClick={() => goTo(i)}
                >
                  <span className="bullet">{i + 1}</span>
                  <span className="label">{s.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Contenu droite */}
        <section className="wizard-content">
          <h1 className="contract-title">Dossier client • Pré-audit</h1>
          <p className="contract-subtitle">Renseigne les informations clés avant l’audit.</p>

          {/* STEP 0 — Commercial & Pré-audit */}
          {step === 0 && (
            <form>
              <label className="field">
                Commercial (nom & prénom) *
                <input
                  value={form.salesName}
                  onChange={(e) => setField("salesName", e.target.value)}
                  className="input"
                  placeholder="Prénom Nom"
                />
              </label>

              <label className="field">
                Notes pré-audit (ce que tu sais déjà) *
                <textarea
                  className="input"
                  rows={6}
                  value={form.preAuditNotes}
                  onChange={(e) => setField("preAuditNotes", e.target.value)}
                  placeholder="Contexte, problèmes fiscaux/social évoqués, nombre de salariés, points à creuser, etc."
                />
                <span className="warn" style={{ marginTop: ".4rem" }}>
                  Astuce : plus c’est précis, plus l’audit est efficace.
                </span>
              </label>

              <label className="field">
                Téléphone du client
                <input
                  value={form.clientPhone}
                  onChange={(e) => setField("clientPhone", e.target.value)}
                  className="input"
                  placeholder="+33 6 12 34 56 78"
                />
              </label>
            </form>
          )}

          {/* STEP 1 — Sociétés liées */}
          {step === 1 && (
            <form>
              <fieldset className="card">
                <legend>Sociétés liées au client</legend>

                {form.companies.map((c, idx) => (
                  <div key={idx} className="reps-row">
                    <label className="field">
                      Nom de la société
                      <input
                        value={c.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companies[idx].name = v;
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : Owner"
                      />
                    </label>
                    <label className="field">
                      Type (forme)
                      <input
                        value={c.type}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companies[idx].type = v; // SARL, SAS, SCI…
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : SARL, SAS, SCI…"
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => removeCompany(idx)}
                      disabled={form.companies.length === 1}
                    >
                      Suppr
                    </button>
                  </div>
                ))}

                <button type="button" className="btn-ghost" onClick={addCompany}>
                  + Ajouter une société
                </button>
              </fieldset>
            </form>
          )}

          {/* STEP 2 — Dirigeants / Associés */}
          {step === 2 && (
            <form>
              <fieldset className="card">
                <legend>Infos dirigeants / associés</legend>

                {form.associates.map((a, idx) => (
                  <div key={idx} className="reps-row">
                    <label className="field">
                      Prénom (associé)
                      <input
                        value={a.firstName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.associates[idx].firstName = v;
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : Paul"
                      />
                    </label>
                    <label className="field">
                      Nature
                      <input
                        value={a.nature}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.associates[idx].nature = v; // “associé SCI”, “associé SARL”, …
                            return n;
                          });
                        }}
                        className="input"
                        placeholder='Ex : "associé SCI"'
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => removeAssociate(idx)}
                      disabled={form.associates.length === 1}
                    >
                      Suppr
                    </button>
                  </div>
                ))}

                <button type="button" className="btn-ghost" onClick={addAssociate}>
                  + Ajouter un associé
                </button>
              </fieldset>
            </form>
          )}

          {/* STEP 3 — Client (IR) */}
          {step === 3 && (
            <form>
              <div className="grid2">
                <label className="field">
                  Prénom *
                  <input
                    value={form.person.firstName}
                    onChange={(e) => setField("person.firstName", e.target.value)}
                    className="input"
                    placeholder="Prénom"
                  />
                </label>
                <label className="field">
                  Nom *
                  <input
                    value={form.person.lastName}
                    onChange={(e) => setField("person.lastName", e.target.value)}
                    className="input"
                    placeholder="Nom"
                  />
                </label>
              </div>
            </form>
          )}

          {/* STEP 4 — Données fiscales */}
          {step === 4 && (
            <form>
              <div className="grid2">
                <label className="field">
                  BI (RFR) *
                  <input
                    value={form.tax.bi}
                    onChange={(e) => setField("tax.bi", e.target.value)}
                    className="input"
                    placeholder="Ex : 45 000"
                  />
                </label>
                <label className="field">
                  IR (impôt net) *
                  <input
                    value={form.tax.ir}
                    onChange={(e) => setField("tax.ir", e.target.value)}
                    className="input"
                    placeholder="Ex : 7 200"
                  />
                </label>
              </div>

              <div className="grid2">
                <label className="field">
                  QF (nb de parts) *
                  <input
                    value={form.tax.qf}
                    onChange={(e) => setField("tax.qf", e.target.value)}
                    className="input"
                    placeholder="Ex : 2"
                  />
                </label>

                <label className="field">
                  Frais réels (Oui/Non) *
                  <select
                    className="input"
                    value={form.tax.fraisReels}
                    onChange={(e) => setField("tax.fraisReels", e.target.value)}
                  >
                    <option value="non">Non</option>
                    <option value="oui">Oui</option>
                  </select>
                </label>
              </div>

              <div className="grid2">
                <label className="field">
                  Revenus fonciers nets
                  <input
                    value={form.tax.rfNets}
                    onChange={(e) => setField("tax.rfNets", e.target.value)}
                    className="input"
                    placeholder="Ex : 3 600"
                  />
                  <span className="warn">Astuce : repère “revenus fonciers nets”.</span>
                </label>

                <label className="field">
                  BIC (marque) – Oui/Non
                  <select
                    className="input"
                    value={form.tax.bicMarque}
                    onChange={(e) => setField("tax.bicMarque", e.target.value)}
                  >
                    <option value="non">Non</option>
                    <option value="oui">Oui</option>
                  </select>
                  <span className="warn">S’il n’y a pas de ligne BIC → Non.</span>
                </label>
              </div>

              <label className="field">
                RCM (dividendes) – montant €
                <input
                  value={form.tax.rcm}
                  onChange={(e) => setField("tax.rcm", e.target.value)}
                  className="input"
                  placeholder="Ex : 0 ou 1 200"
                />
                <span className="warn">Indice : si &lt; 500 € → probablement pas de dividendes.</span>
              </label>
            </form>
          )}

          {/* STEP 5 — Sociétés (compta détaillée) */}
          {step === 5 && (
            <form>
              {form.companiesCompta.map((c, idx) => (
                <fieldset key={idx} className="card" style={{ marginBottom: "1rem" }}>
                  <legend>Société #{idx + 1}</legend>

                  <div className="grid2">
                    <label className="field">
                      Nom de la société
                      <input
                        value={c.companyName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companiesCompta[idx].companyName = v;
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : ACME"
                      />
                    </label>
                    <label className="field">
                      Forme juridique
                      <input
                        value={c.legalForm}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companiesCompta[idx].legalForm = v;
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : SARL"
                      />
                    </label>
                  </div>

                  <div className="grid2">
                    <label className="field">
                      Date de clôture
                      <input
                        value={c.closingDate}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companiesCompta[idx].closingDate = v;
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : 31/12 ou 06/2024"
                      />
                    </label>
                    <label className="field">
                      Imposition
                      <select
                        className="input"
                        value={c.taxRegime}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companiesCompta[idx].taxRegime = v;
                            return n;
                          });
                        }}
                      >
                        <option value="IS">IS</option>
                        <option value="IR">IR</option>
                      </select>
                    </label>
                  </div>

                  <label className="field">
                    Trésorerie (“Disponibilités”)
                    <input
                      value={c.treasury}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => {
                          const n = structuredClone(f);
                          n.companiesCompta[idx].treasury = v;
                          return n;
                        });
                      }}
                      className="input"
                      placeholder="Ex : 25 000"
                    />
                    <span className="warn">Astuce : dans le Bilan, poste “Disponibilités”.</span>
                  </label>

                  <div className="grid2">
                    <label className="field">
                      CA net (montant net du chiffre d’affaires)
                      <input
                        value={c.caNet}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companiesCompta[idx].caNet = v;
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : 460 984"
                      />
                      <span className="warn">Compte de résultat → “Montant net du chiffre d’affaires”.</span>
                    </label>

                    <label className="field">
                      Total des produits d’exploitation
                      <input
                        value={c.produitsExploit}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companiesCompta[idx].produitsExploit = v;
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : 462 736"
                      />
                      <span className="warn">Même page, ligne “TOTAL DES PRODUITS D’EXPLOITATION”.</span>
                    </label>
                  </div>

                  <label className="field">
                    Choix du CA à retenir
                    <select
                      className="input"
                      value={c.caPreference}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => {
                          const n = structuredClone(f);
                          n.companiesCompta[idx].caPreference = v; // "ca" ou "tpe"
                          return n;
                        });
                      }}
                    >
                      <option value="ca">Montant net du CA</option>
                      <option value="tpe">Total produits d’exploitation</option>
                    </select>
                    <span className="warn">
                      S’il y a subventions d’exploitation importantes, privilégier le “CA net”.
                    </span>
                  </label>

                  <div className="grid2">
                    <label className="field">
                      RNC (résultat courant avant impôt)
                      <input
                        value={c.rnc}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companiesCompta[idx].rnc = v;
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : 85 000"
                      />
                    </label>

                    <label className="field">
                      IS (impôt sur les bénéfices)
                      <input
                        value={c.is}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => {
                            const n = structuredClone(f);
                            n.companiesCompta[idx].is = v;
                            return n;
                          });
                        }}
                        className="input"
                        placeholder="Ex : 22 000"
                      />
                    </label>
                  </div>

                  <label className="field">
                    CCA (compte courant associés)
                    <input
                      value={c.cca}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => {
                          const n = structuredClone(f);
                          n.companiesCompta[idx].cca = v;
                          return n;
                        });
                      }}
                      className="input"
                      placeholder="Ex : 374"
                    />
                    <span className="warn">Bilan passif détaillé → “ASSOCIÉS - COMPTES COURANTS”.</span>
                  </label>

                  <div style={{ marginTop: ".5rem" }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => removeCompanyCompta(idx)}
                      disabled={form.companiesCompta.length === 1}
                    >
                      Supprimer cette société
                    </button>
                  </div>
                </fieldset>
              ))}

              <button type="button" className="btn-ghost" onClick={addCompanyCompta}>
                + Ajouter une société (compta)
              </button>
            </form>
          )}

          {/* STEP 6 — Aperçu & suite */}
          {step === 6 && (
            <div className="card">
              <div className="preview-title">Résumé (brouillon)</div>
              <pre className="preview-body" style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify(form, null, 2)}
              </pre>
              <div className="actions-bottom" style={{ gap: ".75rem", display: "flex", justifyContent: "center" }}>
                <button type="button" className="btn-ghost" onClick={saveDraft}>
                  Enregistrer brouillon
                </button>
                <button
                  type="button"
                  className="export-btn"
                  onClick={() => alert("Génération PDF/Word arrive à l’étape suivante.")}
                >
                  Export (PDF / Word)
                </button>
              </div>
            </div>
          )}

          {/* nav bas */}
          <div className="wizard-nav">
            <button type="button" className="btn-ghost" onClick={goBack} disabled={step === 0}>
              ← Précédent
            </button>
            {step < steps.length - 1 ? (
              <button type="button" className="export-btn" onClick={goNext}>
                Suivant →
              </button>
            ) : (
              <span />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
