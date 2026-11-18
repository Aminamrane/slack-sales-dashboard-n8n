// Ce que la Finance doit voir du board avant d'appeler un client (dev 18/11/2026).
//
// 1. Un départ, en cours ou acté (rétractation, résiliation) : sans le savoir, la Finance appelle pour un paiement et
//    peut relancer l'envie de partir d'un client que le Client Success tente de garder.
// 2. Un onboarding en no show, puis recalé : la règle du board (`onboardingSituation`, la même que « Onboarding no
//    show » dans Affiner) et le dernier no show qualifié par le Client Success (champ `no_show` du board : {day, by}).
//    Quand une nouvelle date à venir suit ce no show, le client n'est plus no show : il est « recalé ».
import { onboardingSituation } from '../../utils/boardIntegration.js';
import { parisToday } from '../../utils/parisDates.js';
import { isOutOfOnboarding } from '../../utils/boardClientState.js';

export const DEPARTURE_ETATS = [
  'En cours de rétractation', 'Rétractation', 'En cours de résiliation', 'Résiliation', 'Self-Résiliation',
];
export const departureOf = (displayedEtat) => (DEPARTURE_ETATS.includes(displayedEtat) ? displayedEtat : null);

export const NO_SHOW_TONES = {
  noshow: { fg: '#c5221f', bg: '#fdeeee' },
  recale: { fg: '#1b6fd0', bg: '#e4f0fd' },
};

const dayOf = (raw) => (raw ? String(raw).slice(0, 10) : null);

// « JJ/MM » d'un jour ISO, sans fuseau : le jour du rendez-vous tel que le board le garde.
export const shortDay = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : '';
};

// {kind: 'noshow', day, by} | {kind: 'recale', day, noShowDay, by} | null.
// `today` : jour de Paris « AAAA-MM-JJ », `displayedEtat` : état affiché du board (un client qui part n'a plus
// d'onboarding à suivre, comme sur le board).
export function noShowOf(boardRow, today = parisToday(), displayedEtat = null) {
  if (!boardRow?.numero_client) return null;
  const situation = onboardingSituation(boardRow, today, { exited: isOutOfOnboarding(displayedEtat) });
  if (!situation || situation === 'done') return null;
  const planned = dayOf(boardRow.rdv_onboarding_date_manual || boardRow.rdv_onboarding_date);
  const qualified = dayOf(boardRow.no_show?.day);
  const by = boardRow.no_show?.by || '';
  // Le no show qualifié porte sur le rendez-vous prévu (ou le client n'a plus de date) : il est no show.
  if (qualified && (!planned || qualified >= planned)) return { kind: 'noshow', day: qualified, by };
  if (situation === 'noshow') return { kind: 'noshow', day: planned, by: '' };
  // Une date à venir suit le no show qualifié : recalé.
  if (situation === 'venir' && qualified) return { kind: 'recale', day: planned, noShowDay: qualified, by };
  return null;
}

export function noShowInfo(state) {
  if (!state) return null;
  if (state.kind === 'recale') {
    return {
      kind: 'recale', label: 'Recalé', value: `au ${shortDay(state.day)}`, tone: NO_SHOW_TONES.recale,
      title: `No show du ${shortDay(state.noShowDay)}, nouvel onboarding prévu le ${shortDay(state.day)}.`,
    };
  }
  const day = shortDay(state.day);
  return {
    kind: 'noshow', label: 'No show', value: day ? `du ${day}` : '', tone: NO_SHOW_TONES.noshow,
    title: state.by ? `No show${day ? ` de l’onboarding du ${day}` : ''}, noté par ${state.by}`
      : `No show${day ? ` de l’onboarding du ${day}` : ''} : passé, ni réalisé ni noté par le Client Success.`,
  };
}
