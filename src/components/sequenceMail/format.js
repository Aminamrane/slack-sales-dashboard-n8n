// src/components/sequenceMail/format.js
//
// Formatage de dates/nombres pour le mini client e-mail. Tout est affiché à l'heure de
// Paris : les séquences sont planifiées en Europe/Paris quel que soit le fuseau du poste.

const TZ = 'Europe/Paris';

const fmt = (opts) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts });
const F_DAY_MONTH = fmt({ day: 'numeric', month: 'short' });
const F_TIME = fmt({ hour: '2-digit', minute: '2-digit' });
const F_SHORT = fmt({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const F_SHORT_YEAR = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const F_LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const F_WEEKDAY = fmt({ weekday: 'long' });
const F_YEAR = fmt({ year: 'numeric' });
const F_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const F_INT = new Intl.NumberFormat('fr-FR');

const valid = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** @brief « 18 sept. » */
export function fmtDayMonth(iso) {
  const d = valid(iso);
  return d ? F_DAY_MONTH.format(d) : '';
}

/** @brief « 11:00 » */
export function fmtTime(iso) {
  const d = valid(iso);
  return d ? F_TIME.format(d) : '';
}

/** @brief « ven. 18 sept., 11:00 » (l'année n'apparaît que si elle diffère de l'année courante). */
export function fmtWhenShort(iso, nowMs = Date.now()) {
  const d = valid(iso);
  if (!d) return '';
  const sameYear = F_YEAR.format(d) === F_YEAR.format(new Date(nowMs));
  return (sameYear ? F_SHORT : F_SHORT_YEAR).format(d).replace(' à ', ', ');
}

/** @brief « vendredi 18 septembre 2026 à 11:00 » */
export function fmtWhenLong(iso) {
  const d = valid(iso);
  return d ? `${F_LONG.format(d)} à ${F_TIME.format(d)}` : '';
}

/** @brief « vendredi » */
export function fmtWeekday(iso) {
  const d = valid(iso);
  return d ? F_WEEKDAY.format(d) : '';
}

/** @brief Jour civil à Paris (`AAAA-MM-JJ`), pour comparer des jours sans dépendre du fuseau du poste. */
function parisDay(iso) {
  const d = valid(iso);
  return d ? F_YMD.format(d) : '';
}

/** @brief Nombre de jours civils (Paris) entre deux instants : positif si `b` est après `a`. */
export function dayDiff(aIso, bIso) {
  const a = parisDay(aIso);
  const b = parisDay(bIso);
  if (!a || !b) return null;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** @brief Position par rapport au live : « J-3 », « J », « J+1 ». */
export function relToLive(atIso, liveIso) {
  const n = dayDiff(liveIso, atIso);
  if (n === null) return '';
  if (n === 0) return 'J';
  return n > 0 ? `J+${n}` : `J${n}`;
}

/** @brief Durée lisible : « 3 j 7 h », « 2 h 15 min », « 45 min ». */
export function humanSpan(ms) {
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h > 0 ? `${d} j ${h} h` : `${d} j`;
  if (h > 0) return m > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
  return `${m} min`;
}

/** @brief « dans 3 jours » / « il y a 7 jours » (approximatif, pour un coup d'œil). */
export function fromNow(iso, nowMs = Date.now()) {
  const d = valid(iso);
  if (!d) return '';
  const diff = d.getTime() - nowMs;
  const abs = Math.abs(diff);
  let text;
  if (abs < 3600000) text = `${Math.max(1, Math.round(abs / 60000))} min`;
  else if (abs < 86400000) text = `${Math.round(abs / 3600000)} h`;
  else {
    const days = Math.round(abs / 86400000);
    text = `${days} jour${days > 1 ? 's' : ''}`;
  }
  return diff >= 0 ? `dans ${text}` : `il y a ${text}`;
}

export const fmtInt = (n) => (typeof n === 'number' && Number.isFinite(n) ? F_INT.format(n) : '—');

/** @brief Pourcentage entier, « — » si le dénominateur est nul. */
export function fmtRatio(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return '—';
  return `${Math.round((part / total) * 100)} %`;
}

/** @brief Minuscules sans accents, pour la recherche. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** @brief Taille de fichier lisible. */
export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} o`;
  return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} Ko`;
}
