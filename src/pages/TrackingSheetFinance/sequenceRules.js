// sequenceRules.js — séquences de relance que la finance configure elle-même : le modèle de l'écran.
//
// Tout le vocabulaire (champs, comparaisons, motifs, variables) vient du serveur
// (GET /finance-sequences/rules/meta) : l'écran n'en invente aucun, et c'est le
// serveur qui décide qui est relancé. Ici : la séquence vide, ce qui part au
// serveur, et l'aperçu d'un message (variables, longueur d'un SMS) pendant la saisie.

const VARIABLE = /\{\{\s*([^{}]{1,40}?)\s*\}\}/g;
// Alphabet GSM 03.38 : au-delà, le SMS passe en Unicode (70 caractères par SMS au lieu de 160).
const GSM = new Set('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà');
const GSM_EXT = new Set('^{}\\[~]|€');

export const STATUS = {
  draft: { label: 'Brouillon', tone: 'grey' },
  active: { label: 'Active', tone: 'green' },
  paused: { label: 'En pause', tone: 'amber' },
  done: { label: 'Terminée', tone: 'blue' },
};

export const ENROLLMENT = {
  active: { label: 'En cours', tone: 'blue' },
  done: { label: 'Terminée', tone: 'grey' },
  settled: { label: 'A régularisé', tone: 'green' },
  handled: { label: 'Pris en charge', tone: 'amber' },
  stopped: { label: 'Arrêtée', tone: 'grey' },
};

export const CHANNEL = { sms: 'SMS', email: 'E-mail' };

export function blankStep(channel = 'sms', first = false) {
  return { channel, delay_days: first ? 0 : 3, subject: '', body: '' };
}

// Les champs rangés par thème (L'impayé, Les paiements, Le client), dans l'ordre du serveur.
export function fieldGroups(meta) {
  const groups = [];
  for (const field of meta?.fields || []) {
    const name = field.group || 'Autres';
    const group = groups.find((g) => g.name === name) || groups[groups.push({ name, fields: [] }) - 1];
    group.fields.push(field);
  }
  return groups;
}

export function blankCondition(meta) {
  const field = meta?.fields?.[0];
  return field ? conditionFor(meta, field.key) : null;
}

// Changer de champ remet la comparaison et la valeur à celles du nouveau type.
export function conditionFor(meta, key) {
  const field = meta.fields.find((f) => f.key === key);
  const op = meta.operators[field.type][0].key;
  const value = field.type === 'bool' ? true : field.type === 'enum' ? [field.options[0]?.value].filter(Boolean) : '';
  return { field: key, op, value, value2: '' };
}

export function blankRule(meta) {
  return {
    name: '',
    scope: 'global',
    definition: { match: 'all', conditions: [blankCondition(meta)].filter(Boolean) },
    skip: (meta?.skips || []).map((s) => s.key),
    steps: [blankStep('sms', true)],
    send_hour: 10,
    repeat_after_days: null,
    schedule: { kind: 'daily', date: '', days: [0], day: 5 },
    signature_user_id: null,
  };
}

// Quand les clients entrent : une seule fois, chaque jour ouvré, chaque semaine (jours choisis), chaque mois (jour choisi).
// Changer de rythme règle aussi « recommencer » : chaque lundi ou chaque mois, un client toujours en retard la reçoit de nouveau.
export const REPEAT_BY_KIND = { once: null, daily: null, weekly: 7, monthly: 28 };

export function withKind(draft, kind) {
  return { schedule: { ...draft.schedule, kind }, repeat_after_days: REPEAT_BY_KIND[kind] ?? null };
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function dayLabel(iso) {
  const [, month, day] = String(iso || '').slice(0, 10).split('-').map(Number);
  return month && day ? `${day} ${MONTHS[month - 1]}` : '';
}

// « Chaque lundi, jeudi », « Le 5 de chaque mois », « Une seule fois, le 20 novembre », « Chaque jour ouvré ».
export function scheduleLabel(schedule, weekdays = []) {
  const kind = schedule?.kind || 'daily';
  if (kind === 'once') return schedule.date ? `Une seule fois, le ${dayLabel(schedule.date)}` : 'Une seule fois, dès l’activation';
  if (kind === 'weekly') {
    const names = (schedule.days || []).map((d) => weekdays.find((w) => w.key === d)?.label).filter(Boolean);
    return names.length ? `Chaque ${names.join(', ')}` : 'Chaque semaine';
  }
  if (kind === 'monthly') return `Le ${Number(schedule.day) || 1} de chaque mois`;
  return 'Chaque jour ouvré';
}

export function schedulePayload(schedule) {
  const kind = schedule?.kind || 'daily';
  if (kind === 'once') return { kind, date: schedule.date || null };
  if (kind === 'weekly') return { kind, days: [...(schedule.days || [])].sort() };
  if (kind === 'monthly') return { kind, day: Number(schedule.day) || 0 };
  return { kind: 'daily' };
}

// La séquence telle que l'écran l'édite, à partir de ce que le serveur renvoie.
export function editable(rule, meta) {
  const base = blankRule(meta);
  return {
    name: rule.name || '',
    scope: rule.scope || base.scope,
    definition: { match: rule.definition?.match === 'any' ? 'any' : 'all', conditions: (rule.definition?.conditions || []).map((c) => ({ value2: '', ...c })) },
    skip: Array.isArray(rule.skip) ? rule.skip : base.skip,
    steps: (rule.steps?.length ? rule.steps : base.steps).map((s) => ({ ...s, subject: s.subject || '' })),
    send_hour: rule.send_hour ?? base.send_hour,
    repeat_after_days: rule.repeat_after_days ?? null,
    schedule: { ...base.schedule, ...(rule.schedule || {}), date: rule.schedule?.date || '' },
    signature_user_id: rule.signature_user_id || null,
  };
}

// Ce qui part au serveur : la saisie telle quelle. C'est lui qui contrôle et qui explique un refus.
export function payloadOf(draft, ruleId) {
  return {
    ...(ruleId ? { rule_id: ruleId } : {}),
    name: draft.name,
    scope: draft.scope,
    definition: draft.definition,
    skip: draft.skip,
    steps: draft.steps.map((s, i) => ({ channel: s.channel, delay_days: i === 0 ? 0 : Number(s.delay_days) || 0, subject: s.channel === 'email' ? s.subject : null, body: s.body })),
    send_hour: Number(draft.send_hour),
    repeat_after_days: draft.repeat_after_days ? Number(draft.repeat_after_days) : null,
    schedule: schedulePayload(draft.schedule),
    signature_user_id: draft.signature_user_id || null,
  };
}

// Une condition est-elle assez remplie pour demander un aperçu ? (Sinon on attend, sans afficher d'erreur.)
export function conditionReady(meta, condition) {
  const field = meta?.fields?.find((f) => f.key === condition?.field);
  if (!field) return false;
  if (field.type === 'number') {
    const filled = (v) => String(v ?? '').trim() !== '' && !Number.isNaN(Number(String(v).replace(',', '.')));
    return filled(condition.value) && (condition.op !== 'between' || filled(condition.value2));
  }
  if (field.type === 'enum') return Array.isArray(condition.value) && condition.value.length > 0;
  return true;
}

export function audienceReady(meta, draft) {
  const list = draft?.definition?.conditions || [];
  return list.length > 0 && list.every((c) => conditionReady(meta, c));
}

export function variablesIn(...texts) {
  const found = new Set();
  for (const text of texts) for (const match of String(text || '').matchAll(VARIABLE)) found.add(match[1].trim().toLowerCase());
  return [...found].sort();
}

export function unknownVariables(meta, ...texts) {
  const known = new Set((meta?.variables || []).map((v) => v.key));
  return variablesIn(...texts).filter((key) => !known.has(key));
}

export function renderTemplate(text, values) {
  return String(text || '').replace(VARIABLE, (_, key) => values?.[key.trim().toLowerCase()] ?? '');
}

export function sampleValues(meta, preview) {
  return preview?.sample?.values || Object.fromEntries((meta?.variables || []).map((v) => [v.key, v.sample]));
}

// Longueur d'un SMS comme l'opérateur la compte (même règle que le serveur, `sms_shape`).
export function smsShape(content) {
  const chars = [...String(content || '')];
  const odd = [...new Set(chars.filter((c) => !GSM.has(c) && !GSM_EXT.has(c)))].sort();
  if (odd.length) {
    const length = String(content || '').length;
    return { length, parts: length <= 70 ? 1 : Math.ceil(length / 67), unicode: true, odd: odd.slice(0, 6) };
  }
  const length = chars.reduce((n, c) => n + (GSM_EXT.has(c) ? 2 : 1), 0);
  return { length, parts: length <= 160 ? 1 : Math.ceil(length / 153), unicode: false, odd: [] };
}

// Insère une variable à l'endroit du curseur d'un champ de texte.
export function insertAt(text, start, end, token) {
  const value = String(text || '');
  const from = Math.max(0, Math.min(start ?? value.length, value.length));
  const to = Math.max(from, Math.min(end ?? from, value.length));
  return { text: value.slice(0, from) + token + value.slice(to), caret: from + token.length };
}

export function stepTiming(step, index) {
  if (index === 0) return 'Part dès que le client entre dans la séquence';
  const days = Number(step.delay_days) || 0;
  return `Part ${days} jour${days > 1 ? 's' : ''} après le message précédent`;
}

// « SMS, puis e-mail à J+3, puis SMS à J+10 » : le parcours en une ligne.
export function journey(steps) {
  let day = 0;
  return (steps || []).map((step, index) => {
    day += index === 0 ? 0 : Number(step.delay_days) || 0;
    return { channel: step.channel, label: CHANNEL[step.channel] || step.channel, day };
  });
}

export function hourLabel(hour) {
  return `${hour} h`;
}

export function euros(value) {
  const amount = Number(value) || 0;
  const round = Math.abs(amount - Math.round(amount)) < 0.005;
  return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: round ? 0 : 2, maximumFractionDigits: round ? 0 : 2 })} €`;
}

export function monthsLabel(months) {
  return months > 0 ? `${months} mois` : 'ce mois-ci';
}

// Signature d'e-mail : ce que la personne saisit (la photo part à part), et ce qui manque pour l'enregistrer.
export function signatureDraft(sig) {
  return { full_name: sig?.full_name || '', title: sig?.title || '', phone: sig?.phone || '', email: sig?.email || '' };
}

export function signatureMissing(form) {
  if ((form.full_name || '').trim().length < 2) return 'Indiquez votre prénom et votre nom.';
  if ((form.title || '').trim().length < 2) return 'Indiquez votre titre.';
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test((form.email || '').trim())) return 'Indiquez une adresse e-mail valide.';
  return null;
}
