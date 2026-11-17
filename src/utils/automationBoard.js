// Suivi de l'automatisation des missions d'Opti'Lex (dashboard CEO) : logique pure de la page.
// Les chiffres viennent tels quels du logiciel ; ici, seulement le tri, les filtres et les libellés.

export const PERIODS = [null, 7, 30, 90];

export function periodLabel(period) {
  return period ? `${period} derniers jours` : "Depuis la mise en place";
}

export function periodHint(period) {
  return period ? `missions créées sur les ${period} derniers jours` : "missions créées depuis la mise en place du process";
}

// Texte comparé sans accent ni casse : « remuneration » trouve « Rémunération ».
export function fold(text) {
  return String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Lignes à afficher : un process et ses missions restent ensemble. Un process qui correspond montre toutes ses
// missions ; une mission qui correspond garde son process au-dessus d'elle, pour qu'on sache d'où elle vient.
// `awaiting` : ne garder que les lignes où quelqu'un est attendu, "lawyer" (version à tester) ou "dev" (modification demandée).
// `focus` (tuiles du suivi) demande `follows`, le suivi calculé de chaque ligne (`rowFollow`).
export function visibleRows(rows, { query = "", classification = "", pole = "", toConfirm = false, awaiting = "", focus = "", follows = null, closed = new Set() } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const needle = fold(query);
  const filtering = Boolean(needle || classification || pole || toConfirm || awaiting || focus);
  const match = (row) => (!needle || fold(row.name).includes(needle) || fold(row.owner?.name).includes(needle))
    && (!classification || row.classification === classification)
    && (!pole || row.pole?.group === pole)
    && (!toConfirm || row.toConfirm === true)
    && (!awaiting || row.awaiting?.who === awaiting)
    && (!focus || (focus === "late" ? Boolean(follows?.get(row.id)?.due?.late) : follows?.get(row.id)?.group === focus));
  const children = new Map();
  list.forEach((row) => {
    if (row.parentId != null) children.set(row.parentId, [...(children.get(row.parentId) || []), row]);
  });
  const out = [];
  list.forEach((row) => {
    if (row.parentId != null && list.some((other) => other.id === row.parentId)) return;
    const own = children.get(row.id) || [];
    const hit = match(row);
    const kept = hit ? own : own.filter(match);
    if (!hit && kept.length === 0) return;
    // Pendant une recherche, un process replié se rouvre : le résultat ne doit pas rester caché.
    const open = own.length > 0 && (filtering || !closed.has(row.id));
    out.push({ row, depth: 0, children: own.length, open, dimmed: !hit });
    if (open) kept.forEach((child) => out.push({ row: child, depth: 1, children: 0, open: false, dimmed: false }));
  });
  return out;
}

export function stepOf(steps, value) {
  const list = Array.isArray(steps) ? steps : [];
  const step = list.find((item) => item.value === value);
  return { value, label: step?.label || "", percent: step?.percent ?? 0, last: Math.max(0, list.length - 1) };
}

export function classificationOf(classifications, value) {
  return (Array.isArray(classifications) ? classifications : []).find((item) => item.value === value)
    || { value, label: "Non classée", shortLabel: "Non classée", help: "" };
}

export function countLabel(count, one, many) {
  const n = Number(count) || 0;
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}

// Taille d'une pièce jointe, lisible.
export function sizeLabel(bytes) {
  // Opti'Lex sert déjà une taille lisible (« 471 Ko ») : on la garde telle quelle.
  if (typeof bytes === "string" && /[a-zA-Z]/.test(bytes)) return bytes;
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

// Fil d'un process, réduit à un type d'évènement ; les jours vidés disparaissent.
export function filterHistory(history, filter) {
  const days = Array.isArray(history) ? history : [];
  if (!filter) return days;
  return days.map((day) => ({ ...day, items: (day.items || []).filter((item) => item.filter === filter) })).filter((day) => day.items.length > 0);
}

// ── Suivi côté Owner (12/11/2026) ────────────────────────────────────────────────────────────────────────────────
// Opti'Lex ne donne pas d'identifiant à ses évènements : pour y rattacher un commentaire ou une réaction d'Owner, on en
// calcule une empreinte stable (jour, heure, libellé, auteur). Deux FNV-1a de 32 bits, soit 16 chiffres hexadécimaux.
function fnv(text, seed) {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
export function eventKey(day, item) {
  const text = [day, item?.time, item?.what, item?.who].map((part) => String(part ?? "")).join("|");
  return `x:${fnv(text, 0x811c9dc5)}${fnv(text, 0x01000193)}`;
}

// Jour et heure de Paris d'une entrée d'Owner (horodatage ISO), au format des évènements d'Opti'Lex.
export function parisStamp(iso) {
  const [day, time] = new Date(iso).toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).split(" ");
  return { day, time: (time || "").slice(0, 5) };
}

export function dayLabel(day) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// L'historique de l'automatisation d'une mission : les évènements d'Opti'Lex (étapes, décisions, documents) et les entrées
// d'Owner (points d'avancement, documents déposés), du plus récent au plus ancien, groupés par jour. Chaque entrée porte sa
// clé, à laquelle se rattachent commentaires et réactions. `filter` : "" (tout), "steps" ou "files".
export function mergeHistory(history, entries, filter = "") {
  const items = [];
  (Array.isArray(history) ? history : []).forEach((day) => (day.items || []).forEach((item) => {
    if (item.filter === "comments") return;
    items.push({ key: eventKey(day.day, item), day: day.day, time: item.time || "", group: item.filter === "files" ? "files" : "steps", source: "optilex",
      what: item.what, who: item.who, detail: item.detail, text: item.note || item.text || "", file: item.file || null, files: [] });
  }));
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (entry.kind === "comment") return;
    const stamp = parisStamp(entry.created_at);
    items.push({ key: entry.key, id: entry.id, mine: entry.mine, ...stamp, group: entry.kind === "document" ? "files" : "steps", source: "owner",
      what: entry.kind === "document" ? "Document déposé" : "Point d’avancement", who: entry.author_name, text: entry.body || "", file: null, files: entry.files || [] });
  });
  const kept = items.filter((item) => !filter || item.group === filter).sort((a, b) => `${b.day}T${b.time}`.localeCompare(`${a.day}T${a.time}`));
  const days = [];
  kept.forEach((item) => {
    const last = days[days.length - 1];
    if (last && last.day === item.day) last.items.push(item); else days.push({ day: item.day, label: dayLabel(item.day), items: [item] });
  });
  return { days, counts: { steps: items.filter((item) => item.group === "steps").length, files: items.filter((item) => item.group === "files").length } };
}

// Les commentaires de la mission : les notes d'Opti'Lex (partagées avec le cabinet) et les commentaires d'Owner sans
// rattachement (internes), du plus récent au plus ancien.
export function missionComments(history, entries) {
  const items = [];
  (Array.isArray(history) ? history : []).forEach((day) => (day.items || []).forEach((item) => {
    if (item.filter !== "comments") return;
    // `target` : l'étape du parcours que le commentaire vise dans Opti'Lex, s'il en vise une.
    items.push({ key: eventKey(day.day, item), day: day.day, time: item.time || "", shared: true, who: item.who, text: item.text || "", files: [], target: Number.isInteger(item.target) ? item.target : null });
  }));
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (entry.kind !== "comment" || entry.target_key) return;
    items.push({ key: entry.key, id: entry.id, mine: entry.mine, ...parisStamp(entry.created_at), shared: false, who: entry.author_name, text: entry.body || "", files: entry.files || [] });
  });
  return items.sort((a, b) => `${b.day}T${b.time}`.localeCompare(`${a.day}T${a.time}`));
}

// Les réponses rattachées à une entrée, de la plus ancienne à la plus récente.
export function repliesTo(entries, key) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => entry.kind === "comment" && entry.target_key === key)
    .map((entry) => ({ key: entry.key, id: entry.id, mine: entry.mine, ...parisStamp(entry.created_at), who: entry.author_name, text: entry.body || "", files: entry.files || [] }))
    .sort((a, b) => `${a.day}T${a.time}`.localeCompare(`${b.day}T${b.time}`));
}

// ── Le parcours d'une mission, en frise (12/11/2026 : « un état clair, c'est à ce moment-là que ça a été créé, validé, et je
// peux rajouter quelque chose ») ─────────────────────────────────────────────────────────────────────────────────────
// Des jalons dans l'ordre du temps : l'entrée dans le suivi, chaque étape de l'automatisation, la validation par la direction
// du cabinet. Un jalon atteint porte la date et l'auteur lus dans l'historique d'Opti'Lex (« a changé l'étape », détail
// « avant → après ») ; l'étape en cours est `now`, les suivantes `next`. Tout le reste (documents, changements de classement,
// points d'avancement et documents d'Owner) se range sous le jalon en cours à ce moment-là, du plus ancien au plus récent.
// Chaque jalon et chaque entrée a une clé pour ses commentaires : celle de son évènement, sinon `s:<étape>`.
export function journey(row, steps, history, entries) {
  const list = Array.isArray(steps) ? steps : [];
  const current = Number(row?.step) || 0;
  const at = (day, time) => `${day}T${time || "00:00"}`;
  const events = [];
  (Array.isArray(history) ? history : []).forEach((day) => (day.items || []).forEach((item) => {
    if (item.filter === "comments") return;
    events.push({ ...item, day: day.day, time: item.time || "", key: eventKey(day.day, item), at: at(day.day, item.time), source: "optilex", files: [] });
  }));
  const reached = {};
  let created = null;
  let validated = null;
  events.forEach((event) => {
    const what = String(event.what || "");
    // Un changement d'étape : Opti'Lex donne l'étape atteinte (`step`) ; à défaut, elle se lit dans « avant → après ».
    if (Number.isInteger(event.step) || (event.kind === "decision" && /étape/i.test(what) && String(event.detail || "").includes("→"))) {
      const step = Number.isInteger(event.step) ? list.find((item) => item.value === event.step) : list.find((item) => item.label === event.detail.split("→").pop().trim());
      if (step && (!reached[step.value] || event.at > reached[step.value].at)) reached[step.value] = event;
    } else if ((event.kind === "first" || /ajouté le process/i.test(what)) && (!created || event.at < created.at)) created = event;
    else if (event.kind === "validated" && (!validated || event.at > validated.at)) validated = event;
  });
  const milestones = [{ key: created?.key || "s:0", kind: "created", step: 0, label: current === 0 ? list[0]?.label || "Non commencé" : "Entrée dans le suivi", state: current === 0 ? "now" : "done", event: created, items: [] }];
  list.filter((step) => step.value > 0).forEach((step) => milestones.push({
    key: (step.value <= current && reached[step.value]?.key) || `s:${step.value}`, kind: "step", step: step.value, label: step.label,
    state: step.value < current ? "done" : step.value === current ? "now" : "next", event: step.value <= current ? reached[step.value] || null : null, items: [],
  }));
  milestones.push({ key: (row?.validated && validated?.key) || "s:9", kind: "validated", step: null, label: "Validation par la direction du cabinet",
    state: row?.validated ? "done" : "next", event: row?.validated ? validated : null, by: row?.validated?.by || null, date: row?.validated?.at || null, items: [] });

  const used = new Set(milestones.map((milestone) => milestone.event?.key).filter(Boolean));
  const rest = events.filter((event) => !used.has(event.key)).map((event) => ({ ...event, group: event.filter === "files" ? "files" : "steps", text: [event.text, event.note].filter(Boolean).join("\n") }));
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (entry.kind === "comment") return;
    const stamp = parisStamp(entry.created_at);
    rest.push({ key: entry.key, id: entry.id, mine: entry.mine, ...stamp, at: at(stamp.day, stamp.time), source: "owner", group: entry.kind === "document" ? "files" : "steps",
      what: entry.kind === "document" ? "a déposé un document" : "a fait un point d’avancement", who: entry.author_name, text: entry.body || "", file: null, files: entry.files || [] });
  });
  rest.sort((a, b) => a.at.localeCompare(b.at));
  const dated = milestones.filter((milestone) => milestone.event).sort((a, b) => a.event.at.localeCompare(b.event.at));
  const fallback = milestones.find((milestone) => milestone.state === "now") || milestones[0];
  rest.forEach((event) => {
    let host = null;
    dated.forEach((milestone) => { if (milestone.event.at <= event.at) host = milestone; });
    (host || (dated.length ? milestones[0] : fallback)).items.push(event);
  });
  return milestones;
}

// ── À qui de jouer (dev 13/11/2026 : « que nous, les devs, ce soit intuitif de mettre le suivi, que pour les juristes, ce
// soit intuitif d'aller mettre si c'est validé ou pas, ou s'ils veulent une update ») ────────────────────────────────
// Opti'Lex dit qui est attendu sur une ligne (`row.awaiting.who`) : "lawyer" quand une version attend le test du juriste,
// "dev" quand il a demandé une modification. Sinon l'étape parle : avant toute version, c'est aux développeurs ; une
// version validée n'attend personne. Chaque situation a son geste, enregistré d'un clic ; le classement suit tout seul.
// Un geste est une action du suivi (`action`) ou un changement d'étape (`step`) ; `needsNote` : le mot est obligatoire.
function baseTurn(row, steps, locked) {
  const step = Number(row?.step) || 0;
  const awaiting = row?.awaiting?.who === "lawyer" || row?.awaiting?.who === "dev" ? row.awaiting : null;
  const who = awaiting ? awaiting.who : step < 2 ? "build" : step === 2 ? "idle" : "done";
  const from = awaiting?.by ? ` par ${awaiting.by}${awaiting.since ? ` le ${String(awaiting.since).slice(0, 10)}` : ""}` : "";
  const label = (value) => (Array.isArray(steps) ? steps : []).find((item) => item.value === value)?.label || "";
  const change = { key: "request_change", action: "request_change", label: "Demander une modification", needsNote: true };
  if (who === "lawyer") return {
    who, tone: "yellow", tag: "À tester par le juriste", title: "Au juriste de jouer : la version est à tester",
    hint: `${from ? `Livrée${from}. ` : ""}Une fois testée : la valider, ou dire ce qu’il faut modifier.`,
    placeholder: "Un mot (obligatoire pour demander une modification) : ce qui va, ce qui ne va pas…", quote: awaiting.text || "",
    actions: [{ key: "approve", action: "approve", label: "Version validée par le juriste", primary: true }, change],
  };
  if (who === "dev") return {
    who, tone: "peach", tag: "Modification demandée", title: "Aux développeurs de jouer : une modification est demandée",
    hint: `${from ? `Demandée${from}. ` : ""}Une fois corrigé, dites-le : le juriste retestera.`,
    placeholder: "Ce qui a été corrigé (facultatif)…", quote: awaiting.text || "",
    actions: [{ key: "deliver", action: "deliver", label: "Version corrigée, à retester", primary: true }, { ...change, label: "Compléter la demande" }],
  };
  if (who === "done") return {
    who, tone: "green", tag: "Version validée", title: "Personne n’attend : la version est validée",
    hint: "Un souci ou une évolution à demander ? Écrivez-le : les développeurs seront attendus.",
    placeholder: "Ce qu’il faut modifier…", quote: "",
    actions: [change, ...(!locked && step === 3 && label(4) ? [{ key: "step-4", step: 4, label: `Passer à « ${label(4)} »` }] : [])],
  };
  if (who === "idle") return {
    who, tone: undefined, tag: "Version disponible", title: "Une version existe, personne ne l’attend",
    hint: "Une nouvelle version à faire tester, ou une modification à demander ?",
    placeholder: "Ce qu’il faut tester, ou ce qu’il faut modifier…", quote: "",
    actions: [{ key: "deliver", action: "deliver", label: "Nouvelle version livrée, à tester", primary: true }, change],
  };
  return {
    who, tone: undefined, tag: "Chez les développeurs", title: "Aux développeurs de jouer : aucune version n’est encore livrée",
    hint: "Dès qu’une version tourne, dites-le ici : le juriste saura qu’il doit la tester.",
    placeholder: "Ce qu’il faut tester (facultatif)…", quote: "",
    actions: [{ key: "deliver", action: "deliver", label: "Version livrée, à tester", primary: true },
      ...(!locked && step === 0 && label(1) ? [{ key: "step-1", step: 1, label: label(1) }] : [])],
  };
}

// ── Suivi des développeurs (13/11/2026 : « un onglet où on voit ce que les devs sont en train de travailler, sur quoi ils
// attendent une validation ») ────────────────────────────────────────────────────────────────────────────────────────
// Opti'Lex dit, pour chaque ligne, si les développeurs y travaillent (`working` : depuis quand, qui l'a dit, le dernier point
// d'avancement). Trois gestes : « On y travaille », un point d'avancement (un mot obligatoire), « Mettre de côté ».
const WORK = {
  start: { key: "start", action: "start", label: "On y travaille" },
  progress: { key: "progress", action: "progress", label: "Point d’avancement", needsNote: true, missing: "Écrivez où vous en êtes : c’est ce que le cabinet lira." },
  pause: { key: "pause", action: "pause", label: "Mettre de côté" },
};

// À qui de jouer sur une mission, avec ses gestes ; le travail en cours des développeurs s'y ajoute. Pendant que le juriste
// teste une version, il n'y a rien à commencer.
export function turnOf(row, steps, locked = false) {
  const turn = baseTurn(row, steps, locked);
  const working = row?.working || null;
  const extra = working ? [WORK.progress, WORK.pause] : turn.who === "lawyer" ? [] : [WORK.start];
  return { ...turn, working, actions: [...turn.actions, ...extra],
    placeholder: working && turn.who !== "lawyer" ? "Où vous en êtes (obligatoire pour un point d’avancement), ou ce qu’il faut tester…" : turn.placeholder };
}

// Depuis quand, par qui : « Depuis le 12/11/2026 · Prénom Nom ».
function sinceLine(fact) {
  return [fact?.since ? `Depuis le ${String(fact.since).slice(0, 10)}` : "", fact?.by || ""].filter(Boolean).join(" · ");
}

// Le tableau de suivi : ce qui est en cours chez les développeurs, ce qui attend le test d'un juriste, ce qu'on leur a demandé
// de reprendre et qu'ils n'ont pas encore repris. Une ligne n'apparaît que dans une colonne : « en cours » l'emporte.
export function devBoard(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const item = (row, fact, actions, extra = "") => ({ id: row.id, name: row.name, pole: row.pole?.label || "", meta: [sinceLine(fact), extra].filter(Boolean).join(" · "), text: fact?.text || "", actions });
  const deliver = (label) => ({ key: "deliver", action: "deliver", label, primary: true });
  return [
    { key: "working", title: "En cours chez les développeurs", tone: "blue", empty: "Rien en cours. Ajoutez la mission sur laquelle vous travaillez.",
      // Une modification demandée que les développeurs ont reprise garde le mot du juriste tant qu'ils n'ont pas donné de nouvelles.
      items: list.filter((row) => row.working).map((row) => {
        const asked = row.awaiting?.who === "dev";
        const fact = row.working.text || !asked ? row.working : { ...row.working, text: row.awaiting.text };
        return item(row, fact, [deliver(asked ? "Version corrigée, à retester" : "Version livrée, à tester"), WORK.progress, WORK.pause],
          [asked ? "modification demandée" : "", row.working.updatedAt && row.working.updatedAt !== row.working.since ? `dernier point le ${String(row.working.updatedAt).slice(0, 10)}` : ""].filter(Boolean).join(" · "));
      }) },
    { key: "lawyer", title: "En attente du juriste", tone: "yellow", empty: "Aucune version n’attend de test.",
      items: list.filter((row) => !row.working && row.awaiting?.who === "lawyer").map((row) => item(row, row.awaiting, [])) },
    { key: "dev", title: "Modification demandée", tone: "peach", empty: "Aucune modification en attente.",
      items: list.filter((row) => !row.working && row.awaiting?.who === "dev").map((row) => item(row, row.awaiting, [{ ...WORK.start, primary: true }, { ...deliver("Version corrigée, à retester"), primary: false }])) },
  ];
}

// Les missions qu'on peut déclarer « en cours » : celles qui ne le sont pas, hors process validés par la direction.
export function startable(rows, query, limit = 6) {
  const needle = fold(query);
  if (!needle) return [];
  return (Array.isArray(rows) ? rows : []).filter((row) => !row.working && !row.validated && fold(row.name).includes(needle)).slice(0, limit);
}

// Le message d'une erreur du serveur, tel qu'on peut le lire : une saisie refusée par le serveur arrive en liste.
export function errorText(error, fallback) {
  const detail = error?.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg).filter(Boolean).join(" ") || fallback;
  const message = typeof detail === "string" ? detail : error?.message;
  return message && message !== "[object Object]" ? message : fallback;
}

// La phrase d'un évènement d'Opti'Lex : « Nom a changé l'étape ». Sans auteur, le libellé seul.
export function eventSentence(event) {
  const what = String(event?.what || "");
  return event?.who && /^[a-zàâéèêîôû]/.test(what) ? `${event.who} ${what}` : what || event?.who || "";
}

// ── Les deux voix d'une mission (dev 16/11/2026 : « c'est dur de savoir où en sont les devs, les derniers avis des
// juristes ») ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Opti'Lex date ses faits de deux façons : « 2026-11-12 » + heure dans l'historique, « 12/11/2026 à 14:04 » dans les
// lignes (attente, travail en cours). Les deux se lisent ici en une date.
export function factDate(value, time = "") {
  if (!value) return null;
  const text = String(value).trim();
  const fr = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s*à\s*(\d{1,2})[:h](\d{2}))?/);
  const date = fr ? new Date(`${fr[3]}-${fr[2]}-${fr[1]}T${(fr[4] || "12").padStart(2, "0")}:${fr[5] || "00"}:00`)
    : /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T${time || "12:00"}:00`) : new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

// Il y a combien de temps, en mots : « aujourd'hui à 14 h 04 », « hier », « il y a 3 jours », « le 2 novembre ».
export function whenLabel(date, now = Date.now()) {
  if (!date) return "";
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  const hour = `${String(date.getHours()).padStart(2, "0")} h ${String(date.getMinutes()).padStart(2, "0")}`;
  if (days <= 0) return `aujourd’hui à ${hour}`;
  if (days === 1) return `hier à ${hour}`;
  if (days < 7) return `il y a ${days} jours`;
  return `le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

// La dernière parole de chaque côté. Le juriste : sa demande de modification, sa validation d'une version, ses commentaires
// partagés depuis Opti'Lex. Les développeurs : la version livrée, le travail en cours et ses points d'avancement, les
// points d'avancement posés depuis Owner. `null` quand un côté ne s'est pas encore exprimé.
export function voices(row, history, entries) {
  const lawyer = [];
  const devs = [];
  const aw = row?.awaiting;
  if (aw?.who === "dev") lawyer.push({ who: aw.by, at: factDate(aw.since), what: "a demandé une modification", text: aw.text || "", tone: "change" });
  if (aw?.who === "lawyer") devs.push({ who: aw.by, at: factDate(aw.since), what: "a livré une version à tester", text: aw.text || "", tone: "deliver" });
  const w = row?.working;
  if (w) devs.push({ who: w.updatedBy || w.by, at: factDate(w.updatedAt || w.since), what: w.updatedAt && w.updatedAt !== w.since ? "a fait un point d’avancement" : "travaille dessus", text: w.text || "", tone: "work" });
  (Array.isArray(history) ? history : []).forEach((day) => (day.items || []).forEach((item) => {
    const at = factDate(day.day, item.time);
    if (item.filter === "comments" && item.who) lawyer.push({ who: item.who, at, what: "a écrit", text: item.text || "", tone: "comment" });
    const step = Number.isInteger(item.step) ? item.step : null;
    if (item.kind === "decision" && step === 3) lawyer.push({ who: item.who, at, what: "a validé la version", text: item.note || item.text || "", tone: "approve" });
    if (item.kind === "decision" && step === 2) devs.push({ who: item.who, at, what: "a livré une version à tester", text: item.note || item.text || "", tone: "deliver" });
  }));
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (entry.kind === "update") devs.push({ who: entry.author_name, at: factDate(entry.created_at), what: "a fait un point d’avancement", text: entry.body || "", tone: "work" });
  });
  const latest = (list) => list.filter((item) => item.at).sort((a, b) => b.at - a.at)[0] || null;
  return { lawyer: latest(lawyer), devs: latest(devs) };
}

// Le menu d'état de la mission (dev 17/11/2026 : « quand on clique sur “à tester par le juriste”, on doit pouvoir
// changer l'état et mettre l'état où ça en est », sans descendre aux commentaires). Un choix par état, dans l'ordre du
// parcours ; chacun passe par le geste qui le dit le mieux, pour que le parcours garde le bon mot : « livrée » pour une
// version à tester, « validée par le juriste » quand le juriste répond, l'étape seule sinon. La validation de la
// direction (le cadenas) reste à la direction, dans Opti'Lex : elle figure au menu, sans s'y faire.
export function stateChoices(row, steps, turn) {
  const step = Number(row?.step) || 0;
  const label = (value) => (Array.isArray(steps) ? steps : []).find((item) => item.value === value)?.label || "";
  const who = turn?.who;
  const answering = who === "lawyer" || step === 2;
  const list = [
    { key: "s0", icon: "start", label: label(0), hint: "Rien n’est encore lancé.", step: 0, current: step === 0 },
    { key: "s1", icon: "spec", label: label(1), hint: "Le cabinet a dit ce que le logiciel doit faire.", step: 1, current: step === 1 },
    { key: "deliver", icon: "test", label: step >= 3 ? "Nouvelle version, à tester par le juriste" : "V1 livrée, à tester par le juriste",
      hint: "Le juriste est attendu pour la tester.", action: "deliver", current: who === "lawyer" || (step === 2 && who === "idle") },
    ...(step >= 2 ? [{ key: "request_change", icon: "change", label: "Modification demandée aux développeurs",
      hint: "Écrivez ce qu’il faut modifier : c’est ce qu’ils liront.", action: "request_change", needsNote: true, current: who === "dev" }] : []),
    { key: "approve", icon: "approve", label: label(3) || "V1 testée et approuvée", hint: "Le juriste l’a testée, elle convient.",
      ...(answering ? { action: "approve" } : { step: 3 }), current: step === 3 && who !== "lawyer" && who !== "dev" },
    { key: "s4", icon: "best", label: label(4) || "Version maximale optimisée", hint: "La version finale, sans erreur.", step: 4,
      current: step === 4 && who !== "lawyer" && who !== "dev" },
  ];
  return list.filter((item) => item.label);
}

// ── Le suivi depuis la liste (dev 17/11/2026 : « on est obligé de rentrer dans la fiche pour continuer le suivi, on ne
// peut pas faire le suivi vis-à-vis du tableau ») ───────────────────────────────────────────────────────────────────
// Tout ce qu'une ligne du tableau doit dire et permettre sans ouvrir la mission : à qui c'est de jouer (`turn`), la
// dernière parole connue (`news` : développeurs ou juriste, la plus récente), depuis combien de jours quelqu'un est
// attendu (`waitDays`), et le geste le plus probable (`main`), qui s'enregistre depuis la ligne. Une version validée
// n'a pas de geste principal : ses gestes restent dans la bulle.
const ROW_LABEL = { approve: "Valider", deliver: "Version livrée", start: "On y travaille" };
export function rowFollow(row, steps, now = Date.now()) {
  const turn = turnOf(row, steps, Boolean(row?.validated));
  // Opti'Lex donne la dernière parole de la mission, commentaires compris (`lastWord`) ; à défaut, on la lit dans
  // l'attente et le travail en cours. `side` : "cabinet" quand elle vient du juriste, "owner" des développeurs.
  const word = row?.lastWord ? { who: row.lastWord.who, at: factDate(row.lastWord.at), what: row.lastWord.what, text: row.lastWord.text || "", tone: row.lastWord.tone, side: row.lastWord.side } : null;
  const said = word ? null : voices(row, [], []);
  const news = word || [said.devs && { ...said.devs, side: "owner" }, said.lawyer && { ...said.lawyer, side: "cabinet" }].filter(Boolean).sort((a, b) => (b.at || 0) - (a.at || 0))[0] || null;
  const since = row?.awaiting ? factDate(row.awaiting.since) : null;
  const waitDays = since ? Math.max(0, Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(since).setHours(0, 0, 0, 0)) / 86400000)) : null;
  const pick = (action) => turn.actions.find((item) => item.action === action) || null;
  // Tant que les développeurs n'ont pas dit qu'ils y travaillent, c'est le premier geste ; ensuite, livrer la version.
  const gesture = turn.who === "lawyer" ? pick("approve")
    : turn.who === "done" ? null
    : turn.who === "idle" ? pick("deliver")
    : turn.working ? pick("deliver") : pick("start");
  const main = gesture ? { ...gesture, short: turn.who === "dev" && gesture.action === "deliver" ? "Version corrigée" : turn.who === "idle" ? "Nouvelle version" : ROW_LABEL[gesture.action] || gesture.label } : null;
  // Le cabinet a écrit ou demandé quelque chose en dernier : personne ne lui a encore répondu.
  const unanswered = news?.side === "cabinet" && (news.tone === "comment" || news.tone === "change");
  return { turn, news, waitDays, main, unanswered, group: groupOf(row, turn), due: dueOf(row, now) };
}

// ── La vue « À suivre » (dev 17/11/2026 : « le meilleur suivi qu'on puisse avoir ») ───────────────────────────────
// Les missions rangées par ce qu'elles attendent, pas par volume : ce qui est à reprendre, ce qui est en cours, ce
// qui attend le juriste, ce qu'il faut faire avancer ; ce qui est validé ou pas commencé se replie en bas.
function groupOf(row, turn) {
  if (row?.validated) return "done";
  if (turn.who === "dev") return turn.working ? "working" : "redo";
  if (turn.who === "lawyer") return "lawyer";
  if (turn.working) return "working";
  if (turn.who === "done") return "done";
  return (Number(row?.step) || 0) > 0 || row?.owner || row?.due ? "next" : "idle";
}

// La date cible d'une ligne : son libellé court, en retard quand Opti'Lex le dit, proche à trois jours ou moins.
function dueOf(row, now) {
  const date = row?.due?.date ? new Date(`${row.due.date}T12:00:00`) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
  const label = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(date.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}) });
  return { date: row.due.date, label, days, late: Boolean(row.due.late), soon: !row.due.late && days >= 0 && days <= 3,
    hint: row.due.late ? `Date cible dépassée de ${countLabel(-days, "jour", "jours")}` : days === 0 ? "Date cible : aujourd’hui" : days > 0 ? `Date cible dans ${countLabel(days, "jour", "jours")}` : "Date cible passée" };
}

// `side` : "owner" met en tête ce que les développeurs ont à faire, "cabinet" ce que le juriste doit tester.
const GROUPS = {
  redo: { title: "À reprendre", hint: "Le juriste a demandé une modification : aux développeurs de reprendre.", tone: "peach" },
  working: { title: "En cours chez les développeurs", hint: "Un développeur a dit qu’il y travaille.", tone: "blue" },
  lawyer: { title: "Chez le juriste", hint: "Une version est livrée : le juriste doit la tester.", tone: "yellow" },
  next: { title: "À faire avancer", hint: "Lancées ou prévues, sans personne dessus pour l’instant.", tone: undefined },
  done: { title: "Version validée", hint: "Le juriste a validé la version : plus personne n’est attendu.", tone: "green", folded: true },
  idle: { title: "Pas commencé", hint: "Rien n’est lancé sur ces missions.", tone: undefined, folded: true },
};
const GROUP_ORDER = { owner: ["redo", "working", "lawyer", "next", "done", "idle"], cabinet: ["lawyer", "redo", "working", "next", "done", "idle"] };

// Les lignes d'une vue, filtrées. `focus` : "redo", "working", "lawyer" ou "late" (les tuiles du haut).
function matcher({ query = "", classification = "", pole = "", toConfirm = false, focus = "" } = {}) {
  const needle = fold(query);
  return (row, follow) => (!needle || fold(row.name).includes(needle) || fold(row.owner?.name).includes(needle))
    && (!classification || row.classification === classification)
    && (!pole || row.pole?.group === pole)
    && (!toConfirm || row.toConfirm === true)
    && (!focus || (focus === "late" ? Boolean(follow.due?.late) : follow.group === focus));
}

export function followGroups(rows, follows, filters = {}, { side = "owner", closed = null } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const match = matcher(filters);
  const filtering = Boolean(fold(filters.query) || filters.classification || filters.pole || filters.focus);
  const names = new Map(list.map((row) => [row.id, row.name]));
  const buckets = Object.fromEntries(Object.keys(GROUPS).map((key) => [key, []]));
  list.forEach((row) => {
    // Un process qui ne fait que regrouper des missions n'a pas de suivi propre : ses missions parlent pour lui.
    if (row.isParent && list.some((other) => other.parentId === row.id)) return;
    const follow = follows.get(row.id);
    if (!follow || !match(row, follow)) return;
    buckets[follow.group].push({ row, follow, parent: row.parentId != null ? names.get(row.parentId) || "" : "" });
  });
  // Dans un groupe : le retard d'abord, puis ce à quoi le cabinet attend une réponse, puis l'attente la plus longue.
  const weight = ({ follow }) => (follow.due?.late ? 4 : 0) + (follow.unanswered ? 2 : 0) + (follow.due?.soon ? 1 : 0);
  return GROUP_ORDER[side].map((key) => {
    const items = buckets[key].sort((a, b) => weight(b) - weight(a) || (b.follow.waitDays ?? -1) - (a.follow.waitDays ?? -1) || (a.row.rank ?? 1e6) - (b.row.rank ?? 1e6));
    const folded = closed?.has(key) ?? Boolean(GROUPS[key].folded && !filtering);
    return { key, ...GROUPS[key], items, open: !folded };
  }).filter((group) => group.items.length > 0);
}

// Les compteurs du suivi, pour les tuiles du haut : ce qui attend qui, et ce qui dépasse sa date.
export function followTotals(rows, follows) {
  const totals = { redo: 0, working: 0, lawyer: 0, late: 0, lawyerLate: 0, unanswered: 0 };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const follow = follows.get(row.id);
    if (!follow || (row.isParent && rows.some((other) => other.parentId === row.id))) return;
    if (follow.group in totals) totals[follow.group] += 1;
    if (follow.due?.late) totals.late += 1;
    if (follow.group === "lawyer" && (follow.waitDays ?? 0) >= 7) totals.lawyerLate += 1;
    if (follow.unanswered) totals.unanswered += 1;
  });
  return totals;
}

// Les noms déjà vus sur le board, pour proposer un responsable sans le retaper : responsables actuels d'abord.
export function planPeople(rows) {
  const seen = new Map();
  const add = (name, score) => { const key = String(name || "").trim(); if (key) seen.set(key, (seen.get(key) || 0) + score); };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    add(row.owner?.name, 3);
    add(row.working?.by, 2);
    if (row.lastWord?.side === "owner") add(row.lastWord.who, 1);
    if (row.awaiting?.who === "lawyer") add(row.awaiting.by, 1);
  });
  return [...seen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).map(([name]) => name).slice(0, 6);
}

// « depuis 8 j » : l'attente d'une ligne, en court. Rien le jour même.
export function waitLabel(days) {
  if (days == null || days < 1) return "";
  return days === 1 ? "depuis hier" : `depuis ${days} j`;
}

// Ce qu'un geste ou un choix d'état envoie à Opti'Lex : une action du suivi, ou une étape (le classement suit).
export function gestureCall(row, gesture, text) {
  const note = String(text || "").trim().slice(0, 2000) || null;
  return gesture.action
    ? { path: "action", body: { action: gesture.action, note } }
    : { path: "classification", body: { classification: row.classification, step: gesture.step, comment: note } };
}
