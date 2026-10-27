// Filtre « mobiles uniquement » des exports de « Mes listes » : seuls les 06 et 07 passent. Un fixe (01 à 05, 09), un 08,
// un numéro étranger ou une cellule vide sont écartés. Module pur (testé sous node --test), sans React ni réseau.

// « 06 12 34 56 78 », « 06.12.34.56.78 », « +33 6 12 34 56 78 », « 0033 6… », « +33 (0)6… » ou « 612345678 » → « 0612345678 ».
const national = (phone) => {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const intl = /^(?:00)?33(0?\d{9})$/.exec(digits);
  if (intl) return intl[1].length === 10 ? intl[1] : `0${intl[1]}`;
  return /^[67]\d{8}$/.test(digits) ? `0${digits}` : digits;
};

const isMobileNumber = (phone) => /^0[67]\d{8}$/.test(national(phone));

// Un champ peut porter plusieurs numéros (« 04 72 00 11 22 / 06 12 34 56 78 », « … ou … », « … - … ») : mêmes séparateurs
// que le backend (setter_prospect_calls). Un seul mobile suffit à garder la fiche ; un tiret collé aux chiffres (06-12-34-56-78)
// ne sépare pas deux numéros.
const SEPARATORS = /\s*(?:\/|;|,|\||\n|\s-\s|\s+et\s+|\s+ou\s+)\s*/i;

export const isMobilePhone = (phone) => {
  const text = String(phone ?? '');
  return isMobileNumber(text) || text.split(SEPARATORS).some(isMobileNumber);
};

// Une page des entreprises à mobile, dans la forme de la réponse du serveur (`items`, `total`, `page`, `pages`) ;
// `excluded` = fixes ou sans numéro écartés. Le serveur ne sait pas filtrer sur le type de numéro : `all` = toute la liste.
export function mobilePage(all, { page = 1, pageSize = 50 } = {}) {
  const mobiles = all.filter((item) => isMobilePhone(item.company?.phone));
  const pages = Math.max(1, Math.ceil(mobiles.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return {
    total: mobiles.length, excluded: all.length - mobiles.length, page: current, pages, page_size: pageSize,
    items: mobiles.slice((current - 1) * pageSize, current * pageSize),
  };
}

// Ce que « Exporter vers CRM » créerait (ni déjà au CRM, ni écartée, comme le serveur) réduit aux entreprises à mobile ;
// `left` = celles qui restent dans la liste.
export function crmMobileSelection(all) {
  const pending = all.filter((item) => !item.crm_lead_id && item.manual_status !== 'ecarte');
  const ids = pending.filter((item) => isMobilePhone(item.company?.phone)).map((item) => item.id);
  return { ids, left: pending.length - ids.length };
}

// CSV du serveur (export_csv) : séparateur « ; », guillemets seulement si besoin, lignes terminées par CRLF.
const SEP = ';';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === SEP) { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      endRow();
    } else field += ch;
  }
  if (field !== '' || row.length) endRow();
  return rows;
}

const cell = (value) => (/[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
export const formatCsv = (rows) => rows.map((row) => `${row.map(cell).join(SEP)}\r\n`).join('');

const plain = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// Le CSV du serveur sans les lignes dont « Téléphone » n'est pas un mobile (en-tête gardé, autres colonnes intactes).
// Sans cette colonne, on s'arrête : mieux vaut ne rien exporter que livrer les fixes.
export function keepMobileRows(text) {
  const [header = [], ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  const col = header.findIndex((name) => plain(name) === 'telephone');
  if (col < 0) throw new Error('Export CSV impossible : colonne « Téléphone » introuvable.');
  const kept = rows.filter((row) => isMobilePhone(row[col]));
  return { csv: formatCsv([header, ...kept]), kept: kept.length, dropped: rows.length - kept.length };
}
