import { useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Coins,
  FileSpreadsheet,
  History,
  LayoutGrid,
  ListFilter,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";
import { createCalculator, money, Rational } from "./calculation.js";
import { emptyDraft, initialStatement, parseDraft, statementModel } from "./model.js";
import {
  CHANNELS,
  dayMonthLabel,
  formatTime,
  safeMoney,
} from "./presentation.js";
import { isStaleRevision } from "./api.js";
import { IconButton, Modal } from "./ui.jsx";
import {
  ActualCellEditor,
  RulesEditor,
  BonusEditor,
  DealEditor,
  PeriodEditor,
} from "./editors.jsx";
import "./variables.css";
import { calculationParts, resolveDeal } from "./dealCalculation.js";
import { financeStatus } from "./financeStatus.js";
import { ProfileAvatar } from "./profileAvatar.jsx";
import { RemunerationBreakdown } from "./RemunerationBreakdown.jsx";
const STALE_MESSAGE =
  "Un autre utilisateur a modifié les variables. Rechargez cette page avant de continuer.";
const SAVE_FAILED_MESSAGE =
  "Enregistrement impossible : les dernières modifications n’ont pas été appliquées. Réessayez.";

// source : données CRM lues en direct. initialDraft : brouillon partagé du serveur.
// saveDraft(body) → { draft } ; rien n'est appliqué tant que le serveur n'a pas répondu.
export default function VariablesWorkbench({ source, initialDraft, saveDraft }) {
  const loaded = useMemo(() => {
    try {
      return { draft: parseDraft(initialDraft), error: null };
    } catch {
      return {
        draft: emptyDraft(source.sha256),
        error:
          "Le brouillon enregistré ne peut pas être relu. Il a été conservé ; aucune réécriture automatique.",
      };
    }
  }, [initialDraft, source.sha256]);
  const [draft, setDraft] = useState(loaded.draft),
    // Bloquant (brouillon illisible ou révision dépassée) : plus aucune écriture avant rechargement.
    [blockingError, setBlockingError] = useState(loaded.error),
    // Échec ponctuel (réseau) : rien n'a été appliqué, une nouvelle tentative reste possible.
    [saveError, setSaveError] = useState(""),
    [toast, setToast] = useState("");
  const saving = useRef(false);
  const [person, setPerson] = useState(() => initialStatement(source).person),
    [selectedId, setSelectedId] = useState(() => initialStatement(source).id);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    
    [panel, setPanel] = useState(null),
    [editor, setEditor] = useState(null),
    [filter, setFilter] = useState("ALL"),
    [page, setPage] = useState(1);
  const statement =
    source.statements.find((s) => s.id === selectedId) || source.statements[0];
  const settings = useMemo(
    () => ({...statement.defaults,...draft.settings[statement.id]}),
    [draft.settings, statement.id, statement.defaults],
  );
  const calculator = useMemo(
    () => createCalculator(source.cells, draft.changes),
    [source.cells, draft.changes],
  );

  const result = useMemo(() => {
    try {
      return {
        model: statementModel(source, statement, draft.changes, settings),
        error: null,
      };
    } catch (e) {
      return { model: null, error: e.message };
    }
  }, [source, statement, draft.changes, settings]);
  const model = result.model;
  const people = useMemo(
    () =>
      [...new Set(source.statements.map((s) => s.person))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [source.statements],
  );
  const statements = source.statements.filter((s) => s.person === person);
  const linkedRows = useMemo(() => {
    let refs = [];
    try {
      refs = calculator
        .dependencies(statement.totalCell, {
          recursive: true,
          stopAt: (r) => /^E\d+$/.test(r),
        })
        .filter((r) => /^E\d+$/.test(r));
    } catch {
      /* Error shown above. */
    }
    if (statement.entryRefs) refs=statement.entryRefs;
    return refs
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
      .map(
        (ref) =>
          source.entries.find((x) => x.amountCell === ref) || {
            row: Number(ref.slice(1)),
            amountCell: ref,
            person: statement.person,
            client:
              source.cells[`B${ref.slice(1)}`]?.input ||
              "Ajustement de commission",
          },
      );
  }, [source, calculator, statement]);
  const visibleRows = linkedRows.filter(
    (r) =>
      `${r.client} ${r.person} ${r.amountCell}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "ALL" ||
        (resolveDeal(source,r,settings.deals?.[r.amountCell],calculator).channel || "UNKNOWN") === filter),
  );
  const pageSize = 25,
    pages = Math.max(1, Math.ceil(visibleRows.length / pageSize)),
    shown = visibleRows.slice(
      (Math.min(page, pages) - 1) * pageSize,
      Math.min(page, pages) * pageSize,
    );
  const changedCount =
    Object.keys(draft.changes).length + Object.keys(draft.settings).length;
  function notify(text) {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  }
  // Envoie l'état complet suivant + l'entrée d'audit ; le brouillon affiché
  // devient celui renvoyé par le serveur. Une seule écriture à la fois.
  async function commit(next, action, detail, before, after) {
    if (blockingError) {
      notify("Rechargez cette page avant de continuer.");
      return false;
    }
    if (saving.current) return false;
    const item = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      statementId: statement.id,
      person,
      action,
      detail,
      before,
      after,
    };
    saving.current = true;
    try {
      const response = await saveDraft({
        expected_revision: draft.revision,
        changes: next.changes,
        settings: next.settings,
        audit_item: item,
      });
      setDraft(parseDraft(response?.draft));
      setSaveError("");
      return true;
    } catch (error) {
      if (isStaleRevision(error)) setBlockingError(STALE_MESSAGE);
      else setSaveError(SAVE_FAILED_MESSAGE);
      return false;
    } finally {
      saving.current = false;
    }
  }
  async function updateSettings(next, action, detail) {
    const saved = await commit(
      { ...draft, settings: { ...draft.settings, [statement.id]: next } },
      action,
      detail,
      settings,
      next,
    );
    if (saved) notify("Modifications enregistrées");
    return saved;
  }
  function selectPerson(name) {
    setPerson(name);
    setSelectedId(source.statements.find(s=>s.person===name&&s.period===statement.period)?.id || source.statements.filter(s=>s.person===name).at(-1).id);
    setQuery("");
    setPage(1);
    setFilter("ALL");
  }
  function openEdit(ref, label) {
    if (ref === statement.totalCell) {
      setPanel("breakdown");
      return;
    }
    setEditor({ ref, label });
  }

  return (
    <div className="vr-app vr-embedded">
      <div className="vr-workspace"><main className="vr-main">
        <header className="vr-heading">
          <div><div className="vr-eyebrow">ÉQUIPE COMMERCIALE</div><h1>Variables & rémunérations</h1></div>
          <div className="vr-heading-actions"><button className="vr-button primary" onClick={()=>setPanel('coefficients')}><Pencil size={15}/>Coefficients</button><button className="vr-button" onClick={()=>setPanel('rules')}><SlidersHorizontal size={16}/>Fixe & paliers</button></div>
        </header>
        {(blockingError||saveError)&&<div className="vr-error" role="alert">{blockingError||saveError}</div>}
        <div className="vr-layout">
          <aside className="vr-team">
            <div className="vr-team-title"><h2>Collaborateurs</h2><span>{people.length}</span></div>
            <div className="vr-search"><Search size={16}/><input aria-label="Rechercher un collaborateur" placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
            <div className="vr-team-list">{people.filter(p=>(source.profiles?.[p]?.name||p).toLowerCase().includes(search.toLowerCase())).map((p,i)=><button key={p} className={`vr-person ${p===person?'selected':''}`} onClick={()=>selectPerson(p)}><ProfileAvatar source={source} person={p} className={`color-${i%5}`}/><span><strong>{source.profiles?.[p]?.name||p}</strong><small>{source.statements.filter(s=>s.person===p).length} périodes</small></span>{p===person&&<ChevronRight size={15}/>}</button>)}</div>
          </aside>
          <section className="vr-content">
            <div className="vr-person-heading">
              <div className="vr-person-identity"><ProfileAvatar source={source} person={person} className="large"/><div><h2>{source.profiles?.[person]?.name||person}</h2><p>Commissions personnelles · barème en vérification</p></div></div>
              <div className="vr-period"><label htmlFor="vr-period">PÉRIODE</label><select id="vr-period" value={statement.id} onChange={e=>{setSelectedId(e.target.value);setPage(1);setQuery('');}}>{[...statements].reverse().map((s,i)=><option key={s.id} value={s.id}>{s.label}{statements.filter(x=>x.label===s.label).length>1?` · relevé ${statements.length-i}`:''}</option>)}</select></div>
            </div>
            {result.error?<div className="vr-error" role="alert">Calcul bloqué : {result.error}<button onClick={()=>setPanel('rules')}>Vérifier les règles</button></div>:<section className="vr-pay-summary">
              <div className="vr-pay-total"><span>Fixe + commissions personnelles</span><strong>{money(model.total)}</strong><span className="vr-pay-caption">{statement.label} {settings.period&&`· ${settings.period}`}</span></div>
              <div className="vr-pay-breakdown"><span>Fixe <b>{model.fixedCell?money(model.effectiveFixed):'Non identifié'}</b></span><span>Commissions <b>{money(model.commission)}</b></span><span>Primes <b>{money(model.bonuses)}</b></span>{model.remainder.n!==0n&&<span>Autres ajustements <b>{money(model.remainder)}</b></span>}</div>
              <details className="vr-pay-details"><summary>Ajuster le fixe et les primes <ChevronDown size={14}/></summary><div><div className="vr-summary-actions"><button className="vr-button" disabled={!model.fixedCell} onClick={()=>openEdit(model.fixedCell,'Fixe de base')}><Pencil size={14}/>Modifier le fixe</button><button className="vr-button" onClick={()=>setPanel('bonus')}><Plus size={14}/>Ajouter une prime</button><button className="vr-button" onClick={()=>openEdit(statement.totalCell,'Fixe + commissions personnelles')}><Sigma size={14}/>Détail du calcul</button><button className="vr-button" onClick={()=>setPanel('period')}><Clock3 size={14}/>{settings.period?'Modifier la période':'Préciser l’année'}</button></div>{model.appliedTier&&<p>Palier atteint : {model.appliedTier.sales} ventes → fixe de {money(model.effectiveFixed)}.</p>}</div></details>
            </section>}
            <div className="vr-sales-heading"><div><h3>Ventes & commissions <span>{linkedRows.length}</span></h3><p>Ventes du CRM · seules les ventes encaissées entrent dans le total.</p></div><button className="vr-text-button" onClick={()=>setPanel('history')}><History size={15}/>Activité</button></div>
            <div className="vr-table-card">
              <div className="vr-table-toolbar"><div className="vr-search"><Search size={16}/><input aria-label="Rechercher une commission" placeholder="Rechercher un client…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></div><label className="vr-filter"><ListFilter size={15}/><select aria-label="Filtrer par rémunération" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}><option value="ALL">Toutes les catégories</option>{Object.entries(CHANNELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}<option value="UNKNOWN">Origine non retrouvée</option></select></label></div>
              <div className="vr-table-scroll"><table><thead><tr><th>CLIENT</th><th>RÉMUNÉRATION</th><th>BASE × COEFFICIENT</th><th className="number">COMMISSION HT</th><th/></tr></thead><tbody>{shown.map(row=>{
                const payment=financeStatus(row.finance,source.snapshotDate),ref=row.amountCell,deal=resolveDeal(source,row,settings.deals?.[ref],calculator),applied=model?.appliedAcquisition[ref],calc=applied?model.calculator:calculator,parts=calculationParts(calc,ref),changed=Object.hasOwn(draft.changes,ref);
                return <tr key={ref} className={changed||applied?'edited':''}>
                  <td><div className="vr-client"><span className="vr-client-mark">{row.client[0]}</span><div><strong title={row.client}>{row.client}</strong><small>{row.employeeRange||'Tranche non renseignée'}{deal.origin&&<> · {deal.origin}</>}</small><span className={`vr-finance-badge ${payment.key}`} title={row.finance?'Situation Finance au '+row.finance.checkedAt:'Aucun rapprochement certain avec Finance'}>{payment.label}</span></div></div></td>
                  <td><button className={`vr-source-chip ${deal.channel?.toLowerCase()||''}`} onClick={()=>setPanel({type:'deal',row})}>{CHANNELS[deal.channel]||'Non retrouvée'}<ChevronDown size={11}/></button>{(row.plan==='M'||row.plan==='A')&&<small className="vr-sale-plan">{row.plan==='A'?'Annuelle':'Mensuelle'}</small>}{deal.overridden&&<small className="vr-exception">Choix de rémunération · origine {CHANNELS[deal.originChannel]||deal.origin||'non retrouvée'}</small>}</td>
                  <td>{parts.kind==='coefficient'?<div className="vr-inline-coefficient"><span>{money(Rational.from(parts.base))}</span><span className="vr-times">×</span><button aria-label={`Modifier le coefficient de ${row.client}`} title="Modifier le coefficient" onClick={()=>openEdit(ref,row.client)}>{parts.coefficient.replace('.',',')}<Pencil size={12}/></button></div>:<button className="vr-readable-calculation" onClick={()=>openEdit(ref,row.client)}><span>{parts.label}</span><Pencil size={12}/></button>}{deal.exception&&<small className="vr-exception">Calcul individuel</small>}</td>
                  <td className={`number ${row.counted===false?'vr-unpaid':''}`}><button className="vr-amount" onClick={()=>openEdit(ref,row.client)}>{calculator.raw(ref)===''&&!applied?'—':safeMoney(calc,ref)}</button>{row.counted===false&&<small className="vr-pending-amount">Non comptabilisée</small>}</td>
                  <td><IconButton label={`Modifier ${ref}`} onClick={()=>openEdit(ref,row.client)}><Pencil size={14}/></IconButton></td>
                </tr>;
              })}</tbody></table>{!shown.length&&<div className="vr-empty"><Search/><h3>Aucune vente correspondante</h3></div>}</div>
              <footer className="vr-table-footer"><span>{visibleRows.length} commissions</span><div><IconButton label="Page précédente" disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ArrowLeft size={14}/></IconButton><select aria-label="Numéro de page" value={Math.min(page,pages)} onChange={e=>setPage(Number(e.target.value))}>{Array.from({length:pages},(_,i)=><option key={i} value={i+1}>{i+1} / {pages}</option>)}</select><IconButton label="Page suivante" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}><ArrowRight size={14}/></IconButton></div></footer>
            </div>
            {(settings.bonuses||[]).length>0&&<section className="vr-bonus-list"><h3>Primes & ajustements</h3>{settings.bonuses.map(b=><div key={b.id}><Sparkles size={16}/><span><strong>{b.label}</strong><small>{b.reason}</small></span><b>{money(Rational.from(b.amount))}</b><IconButton label={`Retirer ${b.label}`} onClick={()=>updateSettings({...settings,bonuses:settings.bonuses.filter(x=>x.id!==b.id)},'Retrait de prime',b.label)}><Trash2 size={14}/></IconButton></div>)}</section>}
            <div className="vr-review-footer"><span>Données CRM en direct{dayMonthLabel(source.snapshotDate)&&<> · lues le {dayMonthLabel(source.snapshotDate)}</>} · barème en vérification · hors commissions de management</span><button onClick={()=>setPanel('control')}>Vérifications</button>{changedCount>0&&<button onClick={()=>setPanel('reset')}><Undo2 size={13}/>Annuler les ajustements</button>}</div>
          </section>
        </div>
      </main></div>
      {toast && (
        <div className="vr-toast" role="status">
          <CheckCheck size={17} />
          {toast}
        </div>
      )}
      {panel === "breakdown" && model && (
        <RemunerationBreakdown
          model={model}
          rows={linkedRows}
          settings={settings}
          subtitle={`${source.profiles?.[person]?.name || person} · ${statement.label}`}
          onClose={() => setPanel(null)}
          onFixed={() => { setPanel(null); openEdit(model.fixedCell, "Fixe de base"); }}
          onRules={() => setPanel("coefficients")}
          onBonus={() => setPanel("bonus")}
          onCommission={(ref, label) => { setPanel(null); openEdit(ref, label); }}
        />
      )}
      {editor && (
        <ActualCellEditor
          cellRef={editor.ref}
          label={editor.label}
          source={source}
          draft={draft}
          activeRule={!!model?.appliedAcquisition[editor.ref]}
          onClose={() => setEditor(null)}
          onSave={async (input, reason) => {
            const changes = { ...draft.changes, [editor.ref]: input };
            if (input === String(source.cells[editor.ref]?.input ?? ""))
              delete changes[editor.ref];
            const nextSettings = model?.appliedAcquisition[editor.ref]
              ? {
                  ...draft.settings,
                  [statement.id]: {
                    ...settings,
                    deals: {
                      ...settings.deals,
                      [editor.ref]: {
                        ...settings.deals?.[editor.ref],
                        exception: true,
                        reason,
                      },
                    },
                  },
                }
              : draft.settings;
            const saved = await commit(
              { ...draft, changes, settings: nextSettings },
              "Cellule modifiée",
              `${editor.ref} · ${reason}`,
              calculator.raw(editor.ref),
              input,
            );
            // Fermée aussi en cas d'échec : le bandeau d'erreur reste visible sous la fenêtre sinon.
            setEditor(null);
            if (saved) notify("Calcul mis à jour et modification tracée");
          }}
        />
      )}
      {(panel === "rules" || panel === "coefficients") && (
        <RulesEditor
          initialSection={panel === "coefficients" ? "acquisition" : "fixed"}
          settings={settings}
          fixedCell={model?.fixedCell}
          person={person}
          label={statement.label}
          onClose={() => setPanel(null)}
          onSave={async (next) => {
            await updateSettings(
              next,
              "Règles modifiées",
              `${person}${next.rulesReason ? " · "+next.rulesReason : ""}`,
            );
            setPanel(null);
          }}
        />
      )}
      {panel === "bonus" && (
        <BonusEditor
          onClose={() => setPanel(null)}
          onSave={async (b) => {
            await updateSettings(
              { ...settings, bonuses: [...(settings.bonuses || []), b] },
              "Prime ajoutée",
              b.label,
            );
            setPanel(null);
          }}
        />
      )}
      {panel?.type === "deal" && (
        <DealEditor
          row={panel.row}
          deal={resolveDeal(source,panel.row,settings.deals?.[panel.row.amountCell],calculator)}
          rules={settings.acquisition||{}}
          onClose={() => setPanel(null)}
          onSave={async (deal) => {
            await updateSettings(
              {
                ...settings,
                deals: { ...settings.deals, [panel.row.amountCell]: deal },
              },
              "Rémunération de vente modifiée",
              panel.row.amountCell,
            );
            setPanel(null);
          }}
        />
      )}
      {panel === "period" && (
        <PeriodEditor
          settings={settings}
          person={person}
          onClose={() => setPanel(null)}
          onSave={async (period) => {
            await updateSettings({ ...settings, period }, "Période précisée", period);
            setPanel(null);
          }}
        />
      )}
      {panel === "history" && (
        <Modal
          title="Historique des modifications"
          subtitle="Modifications de cette rémunération"
          onClose={() => setPanel(null)}
          wide
        >
          <div className="vr-history">
            {!draft.audit.some(a=>a.statementId===statement.id) ? (
              <div className="vr-empty">
                <History />
                <h3>Votre source est intacte</h3>
                <p>
                  Les changements de cellules, de règles et de primes
                  apparaîtront ici.
                </p>
              </div>
            ) : (
              draft.audit.filter(a=>a.statementId===statement.id).map((a) => (
                <article key={a.id}>
                  <span className="vr-history-dot" />
                  <div>
                    <strong>{a.action}</strong>
                    <small>
                      {a.person} · {formatTime(a.at)}
                    </small>
                    <p>{a.detail}</p>
                    {a.action === "Cellule modifiée" && (
                      <code>
                        {String(a.before)} → {String(a.after)}
                      </code>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </Modal>
      )}
      {panel === "control" && (
        <Modal
          title="Contrôles avant mise en production"
          subtitle="Données lues en direct dans le CRM, avant modification"
          onClose={() => setPanel(null)}
          wide
        >
          <div className="vr-control"><h3>Données CRM et Finance</h3><p>Ventes signées par mois civil Europe/Paris, dédoublonnées par lead. Rapprochement Finance par lead, puis par e-mail unique. Seuls les montants Owner encaissés à partir du mois de signature sont retenus ; une date seule ne valide pas le paiement.</p><h3>Barème en vérification</h3><p>Coefficients reconstitués à partir des formules : distinction Sales / Head, paiement mensuel / annuel et origine. Les coefficients proposés doivent encore être rapprochés de l’ensemble des cas. Les commissions de management ne sont pas incluses dans cet aperçu.</p><p>Le fixe des nouveaux collaborateurs reste à configurer. Aucune paie réelle ne peut être lancée ici.</p></div>
        </Modal>
      )}
      {panel === "reset" && (
        <Modal
          title="Revenir aux valeurs calculées ?"
          subtitle="Le brouillon de tous les relevés sera réinitialisé. L’historique restera disponible."
          onClose={() => setPanel(null)}
        >
          <div className="vr-form-body">
            <p>
              La réinitialisation s’applique pour tous les utilisateurs de cette page.
            </p>
          </div>
          <div className="vr-dialog-footer">
            <button className="vr-button" onClick={() => setPanel(null)}>
              Conserver le brouillon
            </button>
            <button
              className="vr-button primary"
              onClick={async () => {
                const saved = await commit(
                  { ...emptyDraft(source.sha256), audit: draft.audit },
                  "Réinitialisation",
                  "Tous les relevés",
                  draft.changes,
                  {},
                );
                setPanel(null);
                if (saved) notify("Valeurs de référence restaurées");
              }}
            >
              Revenir aux valeurs calculées
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
