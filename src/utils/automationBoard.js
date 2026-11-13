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
export function visibleRows(rows, { query = "", classification = "", pole = "", toConfirm = false, awaiting = "", closed = new Set() } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const needle = fold(query);
  const filtering = Boolean(needle || classification || pole || toConfirm || awaiting);
  const match = (row) => (!needle || fold(row.name).includes(needle))
    && (!classification || row.classification === classification)
    && (!pole || row.pole?.group === pole)
    && (!toConfirm || row.toConfirm === true)
    && (!awaiting || row.awaiting?.who === awaiting);
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
export function turnOf(row, steps, locked = false) {
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
