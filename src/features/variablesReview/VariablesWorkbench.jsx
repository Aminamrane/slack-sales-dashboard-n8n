import { useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion as Motion } from "framer-motion";
import { CheckCheck, History, Undo2 } from "lucide-react";
import { createCalculator, money, ZERO } from "./calculation.js";
import { emptyDraft, parseDraft, statementModel } from "./model.js";
import {
  auditDetail,
  auditValue,
  baseCaption,
  crossMonthLabel,
  paidDayOf,
  saleState,
  signedDayOf,
  dayMonthLabel,
  decimalLabel,
  financeBadge,
  formatTime,
  monthLabel,
  safeMoney,
  saleTimeline,
  signedMonthOf,
  signedParis,
} from "./presentation.js";
import {
  entryIndex,
  filterSales,
  groupTotals,
  pendingBreakdown,
  periodsOf,
  saleCounts,
  MISSED_STATUSES,
  missedOf,
  sortSales,
  statementSettings,
  statusFor,
  teamEntryIndex,
  teamRows,
  teamShareOf,
  teamTotals,
} from "./team.js";
import { isStaleRevision } from "./api.js";
import { Modal } from "./ui.jsx";
import { ActualCellEditor, BonusEditor, DealEditor, FixedEditor, RulesEditor } from "./editors.jsx";
import { calculationParts, resolveDeal } from "./dealCalculation.js";
import { RemunerationBreakdown } from "./RemunerationBreakdown.jsx";
import { MonthNav } from "./MonthNav.jsx";
import { TeamList } from "./TeamList.jsx";
import { PersonCard } from "./PersonCard.jsx";
import { SalesTable } from "./SalesTable.jsx";
import { TeamShareTable } from "./TeamShareTable.jsx";
import { entryOffset, EXIT, SPRING_UI, TABLE_DELAY } from "./motion.js";
import "./variables.css";

const STALE_MESSAGE =
  "Un autre utilisateur a modifié les variables. Rechargez cette page avant de continuer.";
const SAVE_FAILED_MESSAGE =
  "Enregistrement impossible : les dernières modifications n’ont pas été appliquées. Réessayez.";
const PAGE_SIZE = 25;
const NO_FILTERS = { status: "ALL", channel: "ALL", query: "" };
const COEFFICIENT = /^\d+(?:[.,]\d+)?$/;
// Montant d'une cellule, null s'il ne se calcule pas (compté dans les nombres, pas dans les sous-totaux).
const valueOf = (calc, ref) => {
  try {
    return calc.value(ref);
  } catch {
    return null;
  }
};
// Base « total × 80 % » de l'Excel dans une formule de vente ou de part d'équipe.
const TOTAL_BASE = /\/0\.7\*0\.8\/12\)?$/;

// source : données CRM lues en direct. initialDraft : brouillon partagé du serveur.
// saveDraft(body) → { draft } ; rien n'est appliqué tant que le serveur n'a pas répondu.
export default function VariablesWorkbench({ source, initialDraft, saveDraft, darkMode = false }) {
  const loaded = useMemo(() => {
    try {
      return { draft: parseDraft(initialDraft), error: null };
    } catch {
      return {
        draft: emptyDraft(source.sha256),
        error: "Le brouillon enregistré ne peut pas être relu. Il a été conservé ; aucune réécriture automatique.",
      };
    }
  }, [initialDraft, source.sha256]);
  const [draft, setDraft] = useState(loaded.draft),
    // Bloquant (brouillon illisible ou révision dépassée) : plus aucune écriture avant rechargement.
    [blockingError, setBlockingError] = useState(loaded.error),
    // Échec ponctuel (réseau) : rien n'a été appliqué, une nouvelle tentative reste possible.
    [saveError, setSaveError] = useState(""),
    [toast, setToast] = useState(null);
  const saving = useRef(false);
  const salesSection = useRef(null);
  const teamSection = useRef(null);
  // Section de la part d'équipe à ouvrir depuis la carte (« Pas encore payées » de l'équipe, etc.).
  const [teamFocus, setTeamFocus] = useState(null);

  // Mois de toute la page, puis la liste de l'équipe de ce mois (heads, puis total décroissant).
  const periods = useMemo(() => periodsOf(source), [source]);
  // Le mois affiché est toujours un mois qui a des relevés (donc au moins une ligne d'équipe) :
  // une valeur inconnue (option absente, valeur vide) retombe sur le mois par défaut.
  const fallbackPeriod = periods.includes(source.defaultPeriod) ? source.defaultPeriod : periods.at(-1);
  const [periodChoice, setPeriod] = useState(fallbackPeriod);
  const period = periods.includes(periodChoice) ? periodChoice : fallbackPeriod;
  const team = useMemo(() => teamRows(source, draft, period), [source, draft, period]);
  const totals = useMemo(() => teamTotals(team), [team]);
  const [person, setPerson] = useState(() => team[0]?.person ?? null);
  const row = team.find((r) => r.person === person) || team[0];
  const statement = row.statement;
  const monthText = monthLabel(period);
  const readingDay = dayMonthLabel(source.snapshotDate);

  // Cause du dernier changement, qui choisit le déplacement d'entrée (motion.js) :
  // « load », « person » (vertical, dans le sens de la liste), « month » (horizontal : → par la
  // droite, ← par la gauche), « filter » (tableau seul), « edit » (valeurs modifiées).
  const [motionState, setMotionState] = useState({ direction: 1, cause: "load" });
  const [filters, setFilters] = useState(NO_FILTERS),
    [page, setPage] = useState(1),
    [panel, setPanel] = useState(null),
    [editor, setEditor] = useState(null),
    [inline, setInline] = useState(null);

  const settings = useMemo(() => statementSettings(statement, draft), [statement, draft]);
  const calculator = useMemo(() => createCalculator(source.cells, draft.changes), [source.cells, draft.changes]);
  const result = useMemo(() => {
    try {
      return { model: statementModel(source, statement, draft.changes, settings), error: null };
    } catch (e) {
      return { model: null, error: e.message };
    }
  }, [source, statement, draft.changes, settings]);
  const model = result.model;
  const entries = useMemo(() => entryIndex(source), [source]);
  // Part d'équipe : seulement pour le relevé d'un head qui mène une équipe (teamRefs fourni par le serveur).
  const teamEntries = useMemo(() => teamEntryIndex(source), [source]);
  const teamShare = useMemo(
    () => (model && Array.isArray(statement.teamRefs) ? teamShareOf(statement, teamEntries, model) : null),
    [statement, teamEntries, model],
  );
  // Manque à gagner du mois : ventes du relevé hors rémunération du mois, par raison (et parts d'équipe d'un head).
  const currentMonth = String(source.snapshotDate || "").slice(0, 7) || null;
  const missed = useMemo(() => (model ? missedOf(statement, entries, model, teamEntries, currentMonth) : null),
    [statement, entries, model, teamEntries, currentMonth]);

  const linkedRows = useMemo(() => {
    let refs = [];
    try {
      refs = calculator
        .dependencies(statement.totalCell, { recursive: true, stopAt: (r) => /^E\d+$/.test(r) })
        .filter((r) => /^E\d+$/.test(r));
    } catch {
      /* Erreur affichée dans la carte. */
    }
    if (statement.entryRefs) refs = statement.entryRefs;
    return [...refs]
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
      .map((ref) => source.entries.find((x) => x.amountCell === ref) || {
        row: Number(ref.slice(1)),
        amountCell: ref,
        person: statement.person,
        client: source.cells[`B${ref.slice(1)}`]?.input || "Ajustement de commission",
      });
  }, [source, calculator, statement]);

  const saleRows = useMemo(() => {
    const statusOf = statusFor(statement);
    return linkedRows.map((entry) => {
      const ref = entry.amountCell;
      const status = statusOf(entry);
      const deal = resolveDeal(source, entry, settings.deals?.[ref], calculator);
      const applied = !!model?.appliedAcquisition[ref];
      const calc = applied ? model.calculator : calculator;
      const parts = calculationParts(calc, ref);
      return {
        ref,
        entry,
        client: entry.client,
        status,
        crossMonth: crossMonthLabel(status, entry, statement.period),
        timeline: saleTimeline(entry),
        paidInfo: !!(entry.paidOn || entry.paidOnUnknown),
        channel: deal.channel || "UNKNOWN",
        finance: financeBadge(entry.finance, entry.unlinkedReason),
        signedAt: entry.signedAt,
        signedLabel: signedParis(entry.signedAt)?.label,
        range: entry.employeeRange,
        origin: deal.origin,
        plan: deal.plan,
        overridden: deal.overridden,
        originChannel: deal.originChannel,
        exception: deal.exception,
        parts,
        baseCaption: baseCaption(source.cells, parts.baseExpression),
        baseTotal: TOTAL_BASE.test(parts.baseExpression || ""),
        signedDay: signedDayOf(entry),
        paidDay: status === "counted" || status === "deferred" ? paidDayOf(entry) : "",
        saleState: saleState(entry, currentMonth),
        signedBefore: status === "counted" && !!signedMonthOf(entry) && signedMonthOf(entry) < statement.period,
        countedMonth: entry.countedMonth,
        boardState: entry.finance?.boardState || null,
        boardLost: !!entry.finance?.boardLost,
        amount: valueOf(calc, ref),
        value: calculator.raw(ref) === "" && !applied ? "Non calculée" : safeMoney(calc, ref),
        edited: Object.hasOwn(draft.changes, ref) || !!settings.deals?.[ref],
        search: `${entry.client} ${entry.origin || ""}`,
      };
    });
  }, [linkedRows, source, settings, calculator, model, draft.changes, statement, currentMonth]);

  // Tableau « Part d'équipe » d'un head : ventes de son équipe comptées ce mois, puis hors rémunération du mois
  // par raison (versées plus tard, clients pas encore payés, perdus), comme le manque à gagner de la carte.
  const teamTable = useMemo(() => {
    if (!teamShare || !model) return null;
    const toRow = (status, ref) => {
      const e = teamEntries.get(ref), parts = calculationParts(model.calculator, ref), value = valueOf(model.calculator, ref);
      return {
        ref, status,
        client: e?.client || "Part d’équipe ajustée",
        seller: e?.person,
        sellerName: source.profiles?.[e?.person]?.name || e?.person,
        channel: e?.originChannel || "UNKNOWN",
        range: e?.employeeRange,
        plan: e?.plan,
        origin: e?.origin,
        timeline: e ? saleTimeline(e) : "",
        parts,
        baseCaption: baseCaption(source.cells, parts.baseExpression),
        baseTotal: TOTAL_BASE.test(parts.baseExpression || ""),
        signedDay: e ? signedDayOf(e) : "",
        paidDay: e && (status === "counted" || status === "deferred") ? paidDayOf(e) : "",
        saleState: saleState(e, currentMonth),
        signedBefore: status === "counted" && !!e && signedMonthOf(e) < statement.period,
        countedMonth: e?.countedMonth,
        signedAt: e?.signedAt,
        boardState: e?.finance?.boardState || null,
        boardLost: !!e?.finance?.boardLost,
        amount: value,
        exception: !!settings.deals?.[ref]?.exception,
        edited: Object.hasOwn(draft.changes, ref) || !!settings.deals?.[ref],
        value: value ? money(value) : "À vérifier",
      };
    };
    const missedRows = (status) => (missed?.team?.[status].refs || []).map((ref) => toRow(status, ref));
    return {
      counted: teamShare.counted.map(({ ref }) => toRow("counted", ref)),
      deferred: missedRows("deferred"),
      pending: missedRows("pending"),
      lost: missedRows("lost"),
      months: missed?.team?.deferred.months || [],
      missed: missed?.team ? missed.team.pending.amount.add(missed.team.lost.amount) : ZERO,
    };
  }, [teamShare, missed, teamEntries, model, source, settings, draft.changes, currentMonth, statement.period]);

  const visible = useMemo(() => sortSales(filterSales(saleRows, filters)), [saleRows, filters]);
  const groups = useMemo(() => groupTotals(visible), [visible]);
  const signedBefore = useMemo(() => ({
    own: saleRows.filter((r) => r.status === "counted" && r.signedBefore).length,
    team: teamTable ? teamTable.counted.filter((r) => r.signedBefore).length : 0,
  }), [saleRows, teamTable]);
  const counts = useMemo(() => saleCounts(saleRows, filters), [saleRows, filters]);
  const breakdown = useMemo(() => pendingBreakdown(filterSales(saleRows, { ...filters, status: "ALL" })), [saleRows, filters]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const shown = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const changedCount = Object.keys(draft.changes).length + Object.keys(draft.settings).length;
  // Tout change dans la même image ; seul le déplacement diffère. Le tableau part 60 ms
  // après la liste et la carte quand la personne ou le mois change, tout de suite sinon.
  const entry = { axis: motionState.cause === "month" ? "x" : "y", direction: motionState.direction };
  const navigating = motionState.cause === "person" || motionState.cause === "month";
  const rowEntry = motionState.cause === "edit" ? null : entryOffset(entry, 10);

  function notify(text) {
    const id = crypto.randomUUID();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3600);
  }
  // Envoie l'état complet suivant + l'entrée d'audit ; le brouillon affiché
  // devient celui renvoyé par le serveur. Une seule écriture à la fois.
  async function commit(next, action, detail, before, after) {
    if (blockingError) {
      notify("Rechargez cette page avant de continuer.");
      return false;
    }
    if (saving.current) return false;
    const item = { id: crypto.randomUUID(), at: new Date().toISOString(), statementId: statement.id, person: statement.person, action, detail, before, after };
    saving.current = true;
    try {
      const response = await saveDraft({ expected_revision: draft.revision, changes: next.changes, settings: next.settings, audit_item: item });
      setDraft(parseDraft(response?.draft));
      setSaveError("");
      setMotionState({ direction: 1, cause: "edit" });
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
    const saved = await commit({ ...draft, settings: { ...draft.settings, [statement.id]: next } }, action, detail, settings, next);
    if (saved) notify("Modifications enregistrées");
    return saved;
  }
  // Une cellule (coefficient, montant, fixe) : même chemin pour la saisie en ligne et les fenêtres.
  // La référence reste dans l'audit pour la traçabilité ; l'historique affiché la masque.
  function saveCell(ref, input, reason, label) {
    const changes = { ...draft.changes, [ref]: input };
    if (input === String(source.cells[ref]?.input ?? "")) delete changes[ref];
    const nextSettings = model?.appliedAcquisition[ref]
      ? { ...draft.settings, [statement.id]: { ...settings, deals: { ...settings.deals, [ref]: { ...settings.deals?.[ref], exception: true, reason } } } }
      : draft.settings;
    return commit({ ...draft, changes, settings: nextSettings }, "Cellule modifiée", [ref, label, reason].filter(Boolean).join(" · "), calculator.raw(ref), input);
  }

  function selectPerson(name) {
    if (name === row.person) return;
    const from = team.findIndex((r) => r.person === row.person), to = team.findIndex((r) => r.person === name);
    setMotionState({ direction: to >= from ? 1 : -1, cause: "person" });
    setPerson(name);
    setFilters(NO_FILTERS);
    setPage(1);
    setInline(null);
    setTeamFocus(null);
  }
  function changePeriod(next) {
    if (!periods.includes(next) || next === period) return;
    setMotionState({ direction: next > period ? 1 : -1, cause: "month" });
    const nextTeam = teamRows(source, draft, next);
    if (!nextTeam.some((r) => r.person === row.person)) setPerson(nextTeam[0]?.person ?? null);
    setPeriod(next);
    setFilters(NO_FILTERS);
    setPage(1);
    setInline(null);
    setTeamFocus(null);
  }
  function changeFilters(next) {
    const onlySearch = next.status === filters.status && next.channel === filters.channel;
    if (!onlySearch) setMotionState({ direction: 1, cause: "filter" });
    setFilters(next);
    setPage(1);
    setInline(null);
  }
  function showTeam() {
    teamSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // Ligne du manque à gagner : les ventes concernées (filtre du tableau), ou le tableau de la part d'équipe.
  function showMissed(scope, status) {
    if (scope === "team") return setTeamFocus({ key: status });
    changeFilters({ ...NO_FILTERS, status });
    salesSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function openEdit(ref, label) {
    if (ref === statement.totalCell) {
      setPanel("breakdown");
      return;
    }
    setEditor({ ref, label });
  }

  const inlineRow = inline && saleRows.find((r) => r.ref === inline.ref);
  const inlineView = inline && inlineRow && (() => {
    const valid = COEFFICIENT.test(inline.text.trim());
    let preview = null;
    if (valid) {
      const formula = `=(${inlineRow.parts.baseExpression})*${inline.text.trim().replace(",", ".")}`;
      preview = safeMoney(createCalculator(source.cells, { ...draft.changes, [inline.ref]: formula }), inline.ref);
    }
    return { ...inline, valid, preview };
  })();
  const inlineApi = {
    start: (r) => setInline({ ref: r.ref, text: decimalLabel(r.parts.coefficient), saving: false }),
    change: (text) => setInline((i) => i && { ...i, text }),
    cancel: () => setInline(null),
    more: (r) => { setInline(null); openEdit(r.ref, r.client); },
    commit: async (r) => {
      const coefficient = inline?.text.trim().replace(",", ".");
      if (!coefficient || Number(coefficient) === Number(r.parts.coefficient)) {
        setInline(null);
        return;
      }
      setInline((i) => i && { ...i, saving: true });
      const saved = await saveCell(r.ref, `=(${r.parts.baseExpression})*${coefficient}`, "", r.client);
      setInline(null);
      if (saved) notify("Coefficient enregistré");
    },
  };

  const history = draft.audit.filter((a) => a.statementId === statement.id);
  const who = `${row.name} · ${monthText}`;

  return (
    <MotionConfig reducedMotion="user">
      <div className={`vr-app vr-embedded ${darkMode ? "vr-dark" : ""}`}>
        <main className="vr-main">
          <header className="vr-heading">
            <div><div className="vr-eyebrow">ÉQUIPE COMMERCIALE</div><h1>Variables & rémunérations</h1></div>
            <div className="vr-heading-actions">
              {changedCount > 0 && (
                <button type="button" className="vr-text-button" onClick={() => setPanel("reset")}><Undo2 size={14} />Annuler les ajustements</button>
              )}
              <MonthNav periods={periods} value={period} direction={motionState.direction} onChange={changePeriod} />
            </div>
          </header>
          {(blockingError || saveError) && <div className="vr-error vr-banner" role="alert">{blockingError || saveError}</div>}
          <div className="vr-layout">
            <TeamList source={source} period={period} rows={team} totals={totals} selected={row.person} direction={motionState.direction} onSelect={selectPerson} />
            <section className="vr-content">
              <PersonCard
                source={source}
                row={row}
                model={model}
                error={result.error}
                settings={settings}
                monthText={monthText}
                readingDay={readingDay}
                entry={entry}
                teamShare={teamShare}
                missed={missed}
                signedBefore={signedBefore}
                onCoefficients={() => setPanel("coefficients")}
                onTiers={() => setPanel("rules")}
                onHistory={() => setPanel("history")}
                onFixed={() => setPanel("fixed")}
                onBreakdown={() => setPanel("breakdown")}
                onTeam={showTeam}
                onMissed={showMissed}
                onBonusAdd={() => setPanel("bonus")}
                onBonusRemove={(b) => updateSettings({ ...settings, bonuses: settings.bonuses.filter((x) => x.id !== b.id) }, "Retrait de prime", b.label)}
                onCheckRules={() => setPanel("rules")}
              />
              <div ref={salesSection} className="vr-sales-anchor">
                <SalesTable
                  readingDay={readingDay}
                  period={period}
                  groups={groups}
                  total={saleRows.length}
                  rows={shown}
                  counts={counts}
                  breakdown={breakdown}
                  filters={filters}
                  onFilters={changeFilters}
                  page={currentPage}
                  pages={pages}
                  onPage={(p) => { setMotionState({ direction: p > currentPage ? 1 : -1, cause: "filter" }); setPage(p); }}
                  bodyKey={`${statement.id}|${filters.status}|${filters.channel}|${currentPage}`}
                  rowEntry={rowEntry}
                  rowDelay={navigating ? TABLE_DELAY : 0}
                  inline={inlineView}
                  onInline={inlineApi}
                  onDeal={(r) => setPanel({ type: "deal", row: r })}
                  onEdit={openEdit}
                />
              </div>
              {teamTable && (
                <div ref={teamSection} className="vr-sales-anchor">
                  <TeamShareTable
                    source={source}
                    groups={teamTable}
                    period={period}
                    total={teamShare.amount}
                    missedTotal={teamTable.missed}
                    settings={settings}
                    bodyKey={statement.id}
                    rowEntry={rowEntry}
                    rowDelay={navigating ? TABLE_DELAY : 0}
                    onEdit={openEdit}
                    focus={teamFocus}
                    onRules={() => setPanel("coefficients")}
                  />
                </div>
              )}
            </section>
          </div>
        </main>

        <AnimatePresence>
          {toast && (
            <Motion.div key={toast.id} className="vr-toast" role="status"
              initial={{ y: 96 }} animate={{ y: 0, transition: SPRING_UI }} exit={{ y: 96, transition: EXIT }}>
              <CheckCheck size={16} />{toast.text}
            </Motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {panel === "breakdown" && model && (
            <RemunerationBreakdown
              key="breakdown"
              model={model}
              rows={linkedRows}
              settings={settings}
              missed={missed}
              teamShare={teamShare}
              subtitle={who}
              onClose={() => setPanel(null)}
              onFixed={() => setPanel("fixed")}
              onRules={() => setPanel("coefficients")}
              onBonus={() => setPanel("bonus")}
              onCommission={(ref, label) => { setPanel(null); openEdit(ref, label); }}
            />
          )}
          {panel === "fixed" && model?.fixedCell && (
            <FixedEditor
              key="fixed"
              current={model.fixed}
              tier={model.appliedTier}
              subtitle={who}
              preview={(input) => ({ total: statementModel(source, statement, { ...draft.changes, [model.fixedCell]: input }, settings).total })}
              onClose={() => setPanel(null)}
              onMore={() => { setPanel(null); setEditor({ ref: model.fixedCell, label: "Fixe de base" }); }}
              onSave={async (input, reason) => {
                const saved = await saveCell(model.fixedCell, input, reason, "Fixe");
                setPanel(null);
                if (saved) notify("Fixe enregistré");
              }}
            />
          )}
          {editor && (
            <ActualCellEditor
              key={`cell-${editor.ref}`}
              cellRef={editor.ref}
              label={editor.label}
              source={source}
              draft={draft}
              activeRule={!!model?.appliedAcquisition[editor.ref]}
              onClose={() => setEditor(null)}
              onSave={async (input, reason) => {
                const saved = await saveCell(editor.ref, input, reason, editor.label);
                // Fermée aussi en cas d'échec : le bandeau d'erreur reste visible sous la fenêtre sinon.
                setEditor(null);
                if (saved) notify("Calcul mis à jour et modification tracée");
              }}
            />
          )}
          {(panel === "rules" || panel === "coefficients") && (
            <RulesEditor
              key="rules"
              initialSection={panel === "coefficients" ? "acquisition" : "fixed"}
              settings={settings}
              computedSales={statement.defaults?.sales ?? String(row.counted)}
              fixedCell={model?.fixedCell}
              subtitle={`${monthText} · ${row.name} uniquement`}
              onClose={() => setPanel(null)}
              onSave={async (next) => {
                await updateSettings(next, "Règles modifiées", next.rulesReason || "");
                setPanel(null);
              }}
            />
          )}
          {panel === "bonus" && (
            <BonusEditor
              key="bonus"
              subtitle={who}
              onClose={() => setPanel(null)}
              onSave={async (b) => {
                await updateSettings({ ...settings, bonuses: [...(settings.bonuses || []), b] }, "Prime ajoutée", b.label);
                setPanel(null);
              }}
            />
          )}
          {panel?.type === "deal" && (
            <DealEditor
              key={`deal-${panel.row.ref}`}
              row={panel.row}
              deal={resolveDeal(source, panel.row.entry, settings.deals?.[panel.row.ref], calculator)}
              rules={settings.acquisition || {}}
              subtitle={[panel.row.client, panel.row.signedLabel && `signée le ${panel.row.signedLabel}`].filter(Boolean).join(" · ")}
              onClose={() => setPanel(null)}
              onSave={async (deal) => {
                await updateSettings({ ...settings, deals: { ...settings.deals, [panel.row.ref]: deal } }, "Rémunération de vente modifiée", `${panel.row.ref} · ${panel.row.client}`);
                setPanel(null);
              }}
            />
          )}
          {panel === "history" && (
            <Modal key="history" title="Historique des modifications" subtitle={who} onClose={() => setPanel(null)} wide>
              <div className="vr-history">
                {!history.length ? (
                  <div className="vr-empty"><History size={22} /><h3>Aucune modification ce mois-ci</h3></div>
                ) : (
                  history.map((a) => (
                    <article key={a.id}>
                      <span className="vr-history-dot" />
                      <div>
                        <strong>{a.action}</strong>
                        <small>{formatTime(a.at)}</small>
                        {auditDetail(a.detail) && <div className="vr-history-detail">{auditDetail(a.detail)}</div>}
                        {a.action === "Cellule modifiée" && (
                          <div className="vr-history-change vr-num">{auditValue(a.before)} → {auditValue(a.after)}</div>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </Modal>
          )}
          {panel === "reset" && (
            <Modal key="reset" title="Revenir aux valeurs calculées ?" subtitle="Tous les ajustements de l’équipe, sur tous les mois. L’historique est conservé." onClose={() => setPanel(null)}>
              <div className="vr-dialog-footer">
                <button type="button" className="vr-button" onClick={() => setPanel(null)}>Annuler</button>
                <button
                  type="button"
                  className="vr-button primary"
                  onClick={async () => {
                    const saved = await commit({ ...emptyDraft(source.sha256), audit: draft.audit }, "Réinitialisation", "Tous les ajustements", draft.changes, {});
                    setPanel(null);
                    if (saved) notify("Valeurs calculées restaurées");
                  }}
                >
                  Revenir aux valeurs calculées
                </button>
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
