// Mentions @ dans l'espace commun du board (Owner / Opti'Lex / finance) :
// détection de la saisie « @… », complétion, personnes mentionnées dans un texte, rendu surligné.
// Le serveur reconnaît aussi « @Nom Complet » dans le texte : les ids envoyés sont un confort, pas la vérité.
const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr-FR');

export function mentionQuery(text, caret) {
  const before = String(text || '').slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/[\s(]/.test(before[at - 1])) return null;      // « x@y » est une adresse, pas une mention
  const query = before.slice(at + 1);
  if (/\n/.test(query) || query.length > 40) return null;
  return { start: at, query };
}

export function filterPeople(people, query, limit = 6) {
  const q = fold(query).trim();
  const scored = (people || []).map(p => {
    const name = fold(p.name), email = fold(p.email);
    const score = !q ? 1 : name.startsWith(q) ? 3 : name.split(/\s+/).some(w => w.startsWith(q)) ? 2 : (name.includes(q) || email.startsWith(q)) ? 1 : 0;
    return { p, score };
  }).filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score || String(a.p.name).localeCompare(String(b.p.name), 'fr'));
  return scored.slice(0, limit).map(s => s.p);
}

export function insertMention(text, start, caret, person) {
  const token = `@${person.name} `;
  const source = String(text || '');
  return { text: source.slice(0, start) + token + source.slice(caret), caret: start + token.length };
}

export function mentionedIds(text, people) {
  const body = fold(text);
  return (people || []).filter(p => p.name && body.includes('@' + fold(p.name))).map(p => p.id);
}

// Segments [{ text, mention }] : « @Nom » des personnes mentionnées est surligné, le reste rendu tel quel.
export function splitMentions(text, mentions) {
  const source = String(text || '');
  const names = [...new Set((mentions || []).map(m => m && m.name).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!names.length || !source) return [{ text: source, mention: false }];
  const lower = source.toLowerCase();
  const out = [];
  const pushText = chunk => {
    if (!chunk) return;
    const last = out[out.length - 1];
    if (last && !last.mention) last.text += chunk; else out.push({ text: chunk, mention: false });
  };
  let i = 0;
  while (i < source.length) {
    const hit = source[i] === '@' ? names.find(name => lower.slice(i + 1, i + 1 + name.length) === name.toLowerCase()) : null;
    if (hit) {
      out.push({ text: source.slice(i, i + 1 + hit.length), mention: true });
      i += 1 + hit.length;
    } else {
      const next = source.indexOf('@', i + 1);
      const end = next < 0 ? source.length : next;
      pushText(source.slice(i, end));
      i = end;
    }
  }
  return out;
}

export const groupLabel = role => role === 'optilex' ? "Opti'Lex" : ['finance_team', 'finance_director'].includes(role) ? 'Finance' : 'Owner';

// Phrase de confirmation après publication : qui a été prévenu et par quels canaux.
export function notifiedSummary(notified) {
  const people = Object.values(notified || {}).filter(n => n && n.name);
  if (!people.length) return '';
  const names = people.map(n => n.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}` : names[0];
  const emailed = people.some(n => n.email && n.email.ok);
  const inApp = people.some(n => n.app && n.app.ok);
  const channels = [inApp && 'CRM', emailed && 'e-mail'].filter(Boolean);
  return channels.length ? `Notification envoyée à ${list} (${channels.join(' et ')}).` : `${list} : la notification n'a pas pu partir, le commentaire est publié.`;
}
