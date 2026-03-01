import { useEffect, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import { motion, AnimatePresence } from "framer-motion";

// import { supabase } from "../lib/supabaseClient"; // No longer needed - using API backend

import apiClient from "../services/apiClient";

import * as XLSX from "xlsx";

import { saveAs } from "file-saver";

import myLogo from "../assets/my_image.png";

import myLogoDark from "../assets/my_image2.png";

import firstPlace from "../assets/1st-place.png";

import secondPlace from "../assets/2st-place.png";

import thirdPlace from "../assets/3st-place.png";

import lightIcon from "../assets/light.png";

import darkIcon from "../assets/dark.png";

import trophyIcon from "../assets/trophy.png";
import ndaIcon from "../assets/icon1.png";
import declareIcon from "../assets/icon2.png";
import toolsIcon from "../assets/icon3.png";
import crownIcon from "../assets/crown.png";
import chefIcon from "../assets/chef.png";
import airBg from "../assets/Air.png";
import airportFont from "../assets/Airport.otf";
import shipIcon from "../assets/ship.png";
import flameIcon from "../assets/flame.png";
import SharedNavbar from "../components/SharedNavbar.jsx";

import Chart from "chart.js/auto";

import ChartDataLabels from "chartjs-plugin-datalabels";

import { Doughnut, Line } from "react-chartjs-2";

import "../index.css";

Chart.register(ChartDataLabels);

const REQUIRED_TEAM = import.meta.env.VITE_SLACK_TEAM_ID || "";

// Unified color palette

const COLORS = {

  primary: "#6366f1",   // Indigo

  secondary: "#fb923c", // Orange  

  tertiary: "#10b981",  // Green

  gray: "#94a3b8",      // Gray

  purple: "#a78bfa",    // Purple

  cyan: "#22d3ee",      // Cyan

  pink: "#f472b6",      // Pink

  yellow: "#fbbf24",    // Yellow

};

// Équipes commerciales

// TEAMS is now fetched from GET /api/v1/teams (no more hardcoded)

/* ────────────────────────────────────────────────────────────────────────────

   Helpers

──────────────────────────────────────────────────────────────────────────── */

function getSlackTeamId(user) {

  if (!user) return "";

  const meta = user.user_metadata || {};

  const fromMeta = meta.team?.id || meta.slack_team_id || meta["https://slack.com/team_id"];

  if (fromMeta) return fromMeta;

  const id0 = user.identities?.[0]?.identity_data;

  const fromIdentity = id0?.team?.id || id0?.team_id || id0?.workspace?.id;

  if (fromIdentity) return fromIdentity;

  const fromAppMeta = user.app_metadata?.team?.id || user.app_metadata?.slack_team_id;

  return fromAppMeta || "";

}

/* ────────────────────────────────────────────────────────────────────────────
   Chef Callout — smart phrase selection
──────────────────────────────────────────────────────────────────────────── */

function getChefPhrase({
  chefFirstName,
  topSellerFirstName,
  chefIsTopSeller,
  todayDay,
  daysInMonth,
  daysLeft,
  gap,
  isPastMonth,
  storyline, // { scenario, winner, runner_up, final_gap, lead_changes, days_as_leader } or null
  teamLabel,
  team1Ventes, // total ventes of #1 team — used for reactive hash
  team2Ventes, // total ventes of #2 team — used for reactive hash
}) {
  const chef = chefFirstName;
  const top = topSellerFirstName;
  const dl = daysLeft;
  const dlStr = `${dl} jour${dl > 1 ? 's' : ''}`;

  // ── Reactive pick: hash changes when situation changes ──
  // Incorporates: day, quarter-hour, gap, ventes, WHO is #1 (teamLabel)
  // → phrase updates on data refresh, leader swap, or every ~15 min
  const now = new Date();
  const quarter = Math.floor(now.getMinutes() / 15);        // 0-3 within each hour
  const labelHash = teamLabel.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
  const seed = todayDay * 31 + now.getHours() * 7 + quarter * 53 + gap * 13
    + (team1Ventes || 0) * 17 + (team2Ventes || 0) * 23 + Math.abs(labelHash);
  const pick = (pool) => pool[Math.abs(seed) % pool.length];

  // Detect momentum from storyline (recent lead change = just took #1)
  const recentLeadChange = (() => {
    if (!storyline?.lead_changes?.length) return false;
    const last = storyline.lead_changes[storyline.lead_changes.length - 1];
    if (!last?.date) return false;
    const d = new Date(last.date);
    const now = new Date();
    return (now - d) / 86400000 <= 5; // within last 5 days
  })();
  const daysAsLeader = storyline?.days_as_leader ?? null;
  // Unified momentum signal: team JUST took the lead (highest priority for current month)
  const justTookLead = (daysAsLeader !== null && daysAsLeader <= 2) || recentLeadChange;

  // ═══════════════════════════════════════════════════════════════════════════
  //  PAST MONTH — storyline-based recap (stable messages)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isPastMonth) {
    const scenario = storyline?.scenario;
    const fg = storyline?.final_gap ?? gap;
    const fgStr = `${fg} vente${fg > 1 ? 's' : ''}`;

    if (scenario === 'comeback') return pick([
      `Renversement : ${teamLabel} a repris la tête et termine #1.`,
      `Longtemps derrière, ${chef} a accéléré au bon moment et décroche la 1ère place.`,
      `Comeback réussi : ${chef} a renversé le classement sur la fin.`,
      `Quand tout semblait joué, ${chef} a relancé son équipe — et ça a payé.`,
      `${teamLabel} a prouvé qu'on ne les enterre pas trop vite.`,
      `Retournement de situation : ${chef} a su remotiver l'équipe pour finir en tête.`,
      `Le mois semblait plié, mais ${chef} a décidé autrement.`,
      `${chef} ne lâche rien : son équipe a remonté le classement main dans la main.`,
    ]);

    if (scenario === 'close_race') return pick([
      `Course serrée jusqu'au bout : ${chef} l'emporte de ${fgStr}.`,
      `Match serré : ${teamLabel} termine #1 d'un souffle.`,
      `${chef} a tenu bon — première place arrachée au finish.`,
      `Rien n'était acquis : ${chef} a gardé son sang-froid jusqu'au dernier jour.`,
      `${fgStr} d'écart — ${chef} a su faire la différence dans les détails.`,
      `Un mois haletant : ${teamLabel} prend la tête d'une courte avance.`,
      `C'était serré, mais ${chef} a l'instinct des grands moments.`,
      `Chaque vente comptait : ${chef} a mené l'équipe à la victoire sur le fil.`,
    ]);

    if (scenario === 'dominance') return pick([
      `${teamLabel} a dominé tout le mois : ${chef} n'a rien lâché.`,
      `Maîtrise totale : ${chef} garde l'équipe au sommet du début à la fin.`,
      `${chef} a imposé son rythme — première place incontestée.`,
      `Aucune équipe n'a pu suivre le tempo de ${chef} ce mois-ci.`,
      `Mois parfait : ${teamLabel} en tête du premier au dernier jour.`,
      `${chef} a installé une dynamique que personne n'a pu briser.`,
      `Domination tranquille : ${chef} a gardé le cap sans trembler.`,
      `Le classement n'a jamais été en doute — ${chef} avait tout planifié.`,
    ]);

    // Fallback recap (no storyline data)
    return pick([
      `Bravo ${chef} : son équipe termine #1 ce mois-ci.`,
      `Fin de mois maîtrisée : ${chef} garde l'équipe au sommet.`,
      `${chef} a su maintenir l'équipe en tête jusqu'au bout.`,
      `Mission accomplie pour ${chef} : première place verrouillée.`,
      `${teamLabel} finit le mois en beauté sous la houlette de ${chef}.`,
      `Objectif atteint : ${chef} ramène la première place à son équipe.`,
      `Un mois solide pour ${chef} — le leadership paie.`,
      `${chef} prouve une fois de plus que la constance fait la différence.`,
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CURRENT MONTH — dynamic phrases (priority: momentum > time > gap)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── TOP PRIORITY: Team just took the lead (overtake/momentum) ──
  // This fires FIRST because an overtake is the most exciting event to surface
  if (justTookLead) {
    if (gap === 0) return pick([
      `Coup de théâtre : ${teamLabel} revient à hauteur — tout est relancé !`,
      `${chef} ramène son équipe à égalité : le suspense est total.`,
      `Retour en force : ${teamLabel} est de retour au coude à coude.`,
      `${chef} galvanise les troupes — l'écart est comblé, tout se joue maintenant.`,
      `Égalité après la remontée : ${chef} a remis les compteurs à zéro.`,
      `${teamLabel} ne lâche rien : retour à égalité, le match repart de zéro.`,
      `${chef} refuse de décrocher — son équipe est revenue à hauteur !`,
      `La course est relancée : ${teamLabel} est de retour dans le game.`,
    ]);
    if (gap <= 2) return pick([
      `Changement de leader : ${teamLabel} passe devant !`,
      `${chef} renverse la tendance — ${teamLabel} prend la tête.`,
      `${chef} vient de reprendre les commandes — l'élan est lancé.`,
      `Coup d'accélérateur : ${teamLabel} arrache la première place !`,
      `${chef} sent le momentum — son équipe vient de passer #1.`,
      `L'équipe de ${chef} accélère : la première place est à eux.`,
      `${chef} a trouvé le déclic : ${teamLabel} est de retour en tête.`,
      `Retournement : ${chef} hisse l'équipe au sommet du classement.`,
    ]);
    return pick([
      `${chef} a pris les commandes et creuse l'écart — belle dynamique.`,
      `${teamLabel} s'est installée en tête : ${chef} confirme jour après jour.`,
      `Nouveau leader : ${chef} a imposé le rythme et l'équipe suit.`,
      `${chef} a pris la tête et ne regarde plus en arrière.`,
      `L'élan est du côté de ${chef} — la première place se consolide.`,
      `${teamLabel} vient de prendre le large : ${chef} capitalise sur le momentum.`,
    ]);
  }

  // ── Dernier jour du mois ──
  if (dl === 0) {
    if (gap <= 2) return pick([
      `Jour J : ${chef} joue la première place aujourd'hui.`,
      `Dernier jour — ${chef} sait que chaque vente peut tout changer.`,
      `C'est maintenant ou jamais : ${chef} galvanise l'équipe.`,
      `Le classement se joue aujourd'hui : ${chef} est prêt.`,
      `Ultime journée : ${chef} veut finir en tête, rien de moins.`,
      `Dernières heures pour sceller la victoire — ${chef} reste focus.`,
    ]);
    return pick([
      `Dernier jour du mois : ${chef} veut finir en beauté.`,
      `${chef} garde le rythme jusqu'au bout — dernier jour, pas de relâchement.`,
      `Jour final : ${teamLabel} termine en position de force.`,
      `${chef} clôture le mois avec la même intensité qu'au premier jour.`,
    ]);
  }

  // ── 3 derniers jours (sprint final) ──
  if (dl <= 3) {
    if (gap <= 2) return pick([
      `Sprint final : ${chef} sent la pression — ${dlStr} pour tenir.`,
      `${chef} ne relâche rien : ${dlStr}, tout peut basculer.`,
      `L'écart est mince et le temps presse — ${chef} garde le cap.`,
      `${dlStr} et une avance fragile : ${chef} pousse l'équipe au maximum.`,
      `Chaque heure compte : ${chef} mobilise l'équipe pour le rush final.`,
      `Le #2 est là : ${chef} sait qu'il faut tout donner sur ces ${dlStr}.`,
    ]);
    if (chefIsTopSeller) return pick([
      `${chef} mène de front : ${dlStr} pour verrouiller la première place.`,
      `En tête et au charbon : ${chef} finit ce qu'il a commencé.`,
      `${dlStr} et ${chef} ne lâche rien : le meilleur vendeur veut la victoire.`,
      `${chef} montre le chemin jusqu'à la dernière seconde.`,
    ]);
    return pick([
      `${dlStr} : ${chef} pousse l'équipe à conclure en force.`,
      `Fin de mois imminente : ${chef} garde tout le monde concentré.`,
      `${chef} prépare le sprint final — ${dlStr} pour finir fort.`,
      `L'équipe de ${chef} aborde les derniers jours avec sérénité.`,
    ]);
  }

  // ── Leader installé (streak > 10 jours consécutifs) — before generic end-of-month ──
  if (daysAsLeader && daysAsLeader > 10 && gap >= 3) return pick([
    `${chef} maintient l'équipe en tête depuis ${daysAsLeader} jours : la constance paie.`,
    `${teamLabel} est installée au sommet — ${chef} ne connaît pas le relâchement.`,
    `En tête depuis ${daysAsLeader} jours : ${chef} impose sa régularité.`,
    `${daysAsLeader} jours en tête : ${chef} prouve que la discipline gagne.`,
    `${chef} a installé une série de ${daysAsLeader} jours — l'équipe suit le mouvement.`,
    `La constance de ${chef} fait la différence : en tête jour après jour.`,
  ]);

  // ── Fin de mois (daysLeft ≤ 10) + gap pressure ──
  if (dl <= 10 && gap <= 1) return pick([
    `${chef} serre les rangs : l'écart est mince, il faut rester solide.`,
    `Dernière ligne droite : le #2 colle au classement de ${chef}.`,
    `Plus que ${dlStr} et une seule vente d'avance — ${chef} mobilise.`,
    `Fin de mois tendue : ${chef} refuse de laisser filer la première place.`,
    `${chef} sent le souffle du #2 : chaque vente est une bataille.`,
    `L'écart se resserre : ${chef} rappelle à l'équipe qu'il faut tout donner.`,
  ]);

  if (dl <= 10 && gap <= 3) return pick([
    `${chef} serre les rangs — ${dlStr} et le #2 n'est pas loin.`,
    `Dernière ligne droite : ${chef} pousse l'équipe à finir fort.`,
    `Plus que ${dlStr} : ${chef} veut verrouiller la première place.`,
    `Le classement peut encore bouger : ${chef} garde tout le monde alerte.`,
    `${chef} ne sous-estime pas le #2 : ${dlStr} pour sécuriser.`,
    `L'avance est correcte mais ${chef} veut du concret — ${dlStr} pour finir.`,
  ]);

  // ── Fin de mois (comfortable) ──
  if (dl <= 10) return pick([
    `Fin de mois : ${chef} garde l'équipe concentrée jusqu'au bout.`,
    `Plus que ${dlStr} : ${chef} veut verrouiller la première place.`,
    `Dernière ligne droite — ${chef} ne relâche pas la pression.`,
    `${chef} aborde la fin de mois avec confiance : l'avance est là.`,
    `${dlStr} et une avance solide : ${chef} gère la fin de mois avec calme.`,
    `${chef} sait que les fins de mois se méritent — il garde le cap.`,
  ]);

  // ── Début de mois (jours 1-3) ──
  if (todayDay <= 3) return pick([
    `Nouveau mois, même ambition : ${chef} veut rester en tête.`,
    `Le mois commence bien : ${chef} place l'équipe en position de force.`,
    `${chef} lance le mois avec la même énergie : objectif #1.`,
    `Démarrage fort : ${chef} donne le ton dès les premiers jours.`,
    `Les compteurs sont remis à zéro — ${chef} veut repartir en tête.`,
    `${chef} n'attend pas : son équipe démarre le mois à fond.`,
  ]);

  // ── Semaine 1 (jours 4-7) ──
  if (todayDay <= 7) return pick([
    `Première semaine solide : ${chef} installe son équipe en tête.`,
    `${chef} pose les bases : le rythme est donné dès la première semaine.`,
    `L'équipe de ${chef} démarre bien — il faut maintenir.`,
    `${chef} construit l'avance brique par brique, dès les premiers jours.`,
    `Début de mois prometteur sous l'impulsion de ${chef}.`,
    `${chef} aime commencer fort : les premières ventes sont au rendez-vous.`,
  ]);

  // ── Égalité parfaite (gap === 0) ──
  if (gap === 0) return pick([
    `Égalité parfaite avec le #2 : ${chef} veut faire la différence.`,
    `${chef} refuse le statu quo — il faut passer devant.`,
    `Coude à coude : ${chef} cherche la vente qui fera basculer le classement.`,
    `Le classement est à égalité : c'est le moment pour ${chef} d'accélérer.`,
    `Tout est à jouer : ${chef} prépare l'équipe pour prendre l'avantage.`,
    `Match nul au classement — ${chef} sait que la prochaine vente compte double.`,
  ]);

  // ── Gap danger (1 vente) ──
  if (gap === 1) {
    if (chefIsTopSeller) return pick([
      `${chef} porte l'équipe : une seule vente d'avance, chaque effort compte.`,
      `${chef} garde l'équipe devant d'une vente — il mène de front.`,
      `Le leader et meilleur vendeur : ${chef} fait tout pour maintenir l'écart.`,
      `${chef} montre l'exemple sous pression : le #2 n'est qu'à 1 vente.`,
      `Une vente d'avance et ${chef} au charbon : le #2 ne passera pas.`,
      `${chef} ne recule devant rien — une vente d'avance, il faut tenir.`,
    ]);
    return pick([
      `${chef} garde l'équipe devant — le #2 n'est plus qu'à 1 vente.`,
      `${chef} le sait : la première place se joue au détail.`,
      `${chef} serre les rangs : l'écart est mince, il faut rester solide.`,
      `Une seule vente d'avance : ${chef} compte sur ${top} pour creuser l'écart.`,
      `${chef} pousse ${top} et l'équipe : le #2 est juste derrière.`,
      `L'écart est minimal — ${chef} sait que chaque vente est décisive.`,
    ]);
  }

  // ── Gap serré (2-3 ventes) ──
  if (gap <= 3) {
    if (chefIsTopSeller) return pick([
      `${chef} garde l'équipe devant — le #2 n'est pas loin.`,
      `${chef} le sait : la première place se joue au détail.`,
      `${chef} donne l'exemple et maintient la pression sur le #2.`,
      `${gap} ventes d'avance : ${chef} veut creuser l'écart.`,
      `${chef} ne se repose pas : l'avance est correcte mais pas suffisante.`,
      `Le meilleur vendeur et le leader — ${chef} fait le boulot.`,
    ]);
    return pick([
      `${chef} garde l'équipe devant — le #2 n'est pas loin.`,
      `${chef} le sait : la première place se joue au détail.`,
      `${gap} ventes d'avance : ${chef} compte sur ${top} pour creuser.`,
      `L'écart est correct mais ${chef} veut du confort : à l'attaque.`,
      `${chef} motive l'équipe : ${top} est en forme, il faut capitaliser.`,
      `Pas le moment de relâcher — ${chef} garde le groupe concentré.`,
    ]);
  }

  // ── Comfortable gap (4-7 ventes) ──
  if (gap >= 4 && gap <= 7) {
    if (chefIsTopSeller) return pick([
      `${chef} donne le tempo : son équipe suit et performe.`,
      `${chef} a de l'avance — mais garde l'équipe disciplinée.`,
      `${chef} sécurise la tête : rester #1, c'est tous les jours.`,
      `${chef} impose le rythme, l'équipe répond présent.`,
      `En tête et meilleur vendeur : ${chef} est sur tous les fronts.`,
      `${chef} ne connaît pas le confort — il veut toujours plus.`,
      `${chef} mène par l'exemple : ${gap} ventes d'avance et pas de relâchement.`,
      `L'avance est là grâce à ${chef} — il ne compte pas s'arrêter.`,
    ]);
    return pick([
      `Sous l'impulsion de ${chef}, ${top} fait la différence.`,
      `${chef} a de l'avance — mais garde l'équipe disciplinée.`,
      `${chef} sécurise la tête : rester #1, c'est tous les jours.`,
      `${chef} met les bons joueurs au bon endroit : ${top} frappe fort.`,
      `L'avance est confortable — ${chef} en profite pour structurer.`,
      `${chef} construit quelque chose de solide : ${top} et l'équipe suivent.`,
      `${gap} ventes d'avance : ${chef} félicite ${top} mais veut plus.`,
      `${chef} sait déléguer : ${top} prend les devants, l'équipe avance.`,
    ]);
  }

  // ── Dominant gap (≥ 8 ventes) ──
  if (gap >= 8) {
    if (chefIsTopSeller) return pick([
      `${chef} domine : meilleur vendeur et leader d'une équipe imbattable.`,
      `${gap} ventes d'avance — ${chef} a installé une machine de guerre.`,
      `${chef} ne ralentit jamais : l'équipe est en pilote automatique.`,
      `Domination totale : ${chef} écrase le classement et motive les troupes.`,
      `${chef} vise l'excellence — la première place ne suffit pas, il veut le record.`,
      `L'écart parle de lui-même : ${chef} est sur une autre planète.`,
    ]);
    return pick([
      `${chef} a construit une avance colossale : ${gap} ventes devant le #2.`,
      `L'équipe de ${chef} est inarrêtable — ${top} et les autres cartonnent.`,
      `${gap} ventes d'écart : ${chef} a créé une dynamique que personne ne peut suivre.`,
      `${chef} gère la première place avec sérénité : l'avance est massive.`,
      `${top} performe sous la direction de ${chef} — le #2 est loin derrière.`,
      `Avance record : ${chef} a transformé son équipe en référence.`,
    ]);
  }

  // ── Standard — chef top performer (Pool A) ──
  if (chefIsTopSeller) return pick([
    `${chef} donne le tempo : son équipe suit et performe.`,
    `Quand ${chef} accélère, l'équipe avance.`,
    `${chef} montre l'exemple, et l'équipe élève son niveau.`,
    `${chef} impose le rythme, l'équipe répond présent.`,
    `${chef} ne demande rien qu'il ne fait pas lui-même — leadership par l'action.`,
    `Le meilleur vendeur est aussi le chef : ${chef} est partout.`,
    `${chef} prouve que le leadership se joue sur le terrain.`,
    `En tête du classement individuel et collectif : ${chef} fait le doublé.`,
  ]);

  // ── Standard — un membre brille (Pool B) ──
  return pick([
    `Sous l'impulsion de ${chef}, ${top} fait la différence.`,
    `${chef} construit l'élan collectif : ${top} conclut.`,
    `${chef} sait faire grandir ses talents — ${top} porte l'équipe.`,
    `${chef} met les bons joueurs au bon endroit : ${top} frappe fort.`,
    `L'œil de ${chef} pour le talent paie : ${top} est en feu.`,
    `${chef} orchestre, ${top} exécute — duo gagnant.`,
    `Le management de ${chef} porte ses fruits : ${top} explose les compteurs.`,
    `${chef} sait tirer le meilleur de chacun — aujourd'hui, ${top} brille.`,
  ]);
}


function getReporterName(session) {
  const user = session?.user || {};
  const meta = user?.user_metadata || {};

  // JWT auth: name fields are directly on user object
  // Slack/Supabase legacy: name fields are in user_metadata
  const full =
    user.full_name ||
    user.name ||
    meta.name ||
    meta.full_name ||
    meta.real_name ||
    meta.display_name ||
    meta.user_name ||
    user.email ||
    "Unknown";

  const first = user.first_name || String(full).trim().split(/\s+/)[0] || "Unknown";

  return { full_name: String(full).trim(), first_name: first };
}

const ALIAS_MAP = new Map([

  ["ads", "ADS"], ["ad", "ADS"], ["publicite", "ADS"],

  ["facebook ads", "ADS"], ["meta ads", "ADS"], ["google ads", "ADS"], ["gg ads", "ADS"],

  ["linkedin", "LinkedIn"], ["lnkd", "LinkedIn"], ["lkd", "LinkedIn"],

  ["cc", "CC"], ["cold call", "CC"], ["call", "CC"],

  ["ref", "Referral"], ["referral", "Referral"], ["parrainage", "Referral"],

  ["site", "Site Web"], ["web", "Site Web"], ["seo", "Site Web"],

]);

const stripDiacritics = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function normalizeTunnelLabel(raw) {

  if (!raw) return "Autre";

  const base = stripDiacritics(String(raw).trim().toLowerCase());

  if (ALIAS_MAP.has(base)) return ALIAS_MAP.get(base);

  return base.split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : "")).join(" ");

}

/* ────────────────────────────────────────────────────────────────────────────

   Tiny hooks / chips

──────────────────────────────────────────────────────────────────────────── */

function useAutoFit(ref, { max = 240, minFont = 12, maxFont = 16, step = 0.5 } = {}) {

  useEffect(() => {

    const el = ref.current;

    if (!el) return;

    el.style.fontSize = `${maxFont}px`;

    const originalMaxWidth = el.style.maxWidth;

    el.style.maxWidth = `${max}px`;

    const fits = () => el.scrollWidth <= max;

    let size = maxFont;

    while (!fits() && size > minFont) {

      size -= step;

      el.style.fontSize = `${size}px`;

    }

    return () => { el.style.maxWidth = originalMaxWidth; };

  }, [ref, max, minFont, maxFont, step]);

}

function TrendBadge({ deltaAbs, deltaPct }) {

  const isUp = deltaAbs > 0;

  const isDown = deltaAbs < 0;

  const ref = useRef(null);

  useAutoFit(ref, { max: 240, minFont: 12, maxFont: 16, step: 0.5 });

  const pctText = deltaPct === null ? "N-1 = 0 €" : `${Math.abs(deltaPct).toFixed(2)}%`;

  return (

    <div

      ref={ref}

      className={`trend-badge ${isUp ? "trend-up" : isDown ? "trend-down" : "trend-flat"}`}

      title="Comparaison mois en cours vs mois précédent (même période)"

    >

      <span className="row">

        {isUp ? "↑" : isDown ? "↓" : "→"} {Math.abs(deltaAbs).toLocaleString("fr-FR")} €

      </span>

      <span className="row">({pctText})</span>

    </div>

  );

}

/* ────────────────────────────────────────────────────────────────────────────

   Counter Animation Hook

──────────────────────────────────────────────────────────────────────────── */

function useCountUp(end, duration = 1500) {

  const [count, setCount] = useState(0);

  const [isComplete, setIsComplete] = useState(false);

  
  
  useEffect(() => {

    setIsComplete(false);

    
    
    if (end === 0) {

      setCount(0);

      return;

    }

    
    
    let startTime = null;

    const startValue = 0;

    
    
    const animate = (currentTime) => {

      if (!startTime) startTime = currentTime;

      const progress = Math.min((currentTime - startTime) / duration, 1);

      
      
      // Easing function (ease-out cubic)

      const easeOut = 1 - Math.pow(1 - progress, 3);

      
      
      setCount(Math.floor(startValue + (end - startValue) * easeOut));

      
      
      if (progress < 1) {

        requestAnimationFrame(animate);

      } else {

        // Animation terminée!

        setIsComplete(true);

        setTimeout(() => setIsComplete(false), 2000); // Reset après 2s

      }

    };

    
    
    requestAnimationFrame(animate);

  }, [end, duration]);

  
  
  return { count, isComplete };

}

/* ────────────────────────────────────────────────────────────────────────────

   Airport Flip Display

──────────────────────────────────────────────────────────────────────────── */

function AirportFlipDigit({ targetDigit, delay = 0, duration = 1500, darkMode }) {
  const [displayDigit, setDisplayDigit] = useState(() => Math.floor(Math.random() * 10));
  const [velocity, setVelocity] = useState(1);
  const [settled, setSettled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const glitchChars = ['#', '@', '&', '%', '!', '?', '*', '0', '7', '3'];

  // ── Initial load animation (vertical flip 0→target, decelerating) ──
  const [offsetY, setOffsetY] = useState(0);
  const flipDuration = 800;
  useEffect(() => {
    const target = parseInt(targetDigit) || 0;
    let startTime = null;
    let frame;
    let prevDigit = -1;

    setSettled(false);
    setDisplayDigit(0);
    setOffsetY(0);
    setVelocity(0);

    // Total flips: cycle through 0→target (going through 10 + target to get a full spin)
    const totalSteps = 10 + target;

    const timeout = setTimeout(() => {
      const animate = (time) => {
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        // Ease-out cubic for deceleration
        const raw = Math.min(elapsed / flipDuration, 1);
        const progress = 1 - Math.pow(1 - raw, 3);

        const currentStep = Math.floor(progress * totalSteps);
        const currentDigit = currentStep % 10;
        const fractional = (progress * totalSteps) % 1;

        if (currentDigit !== prevDigit) {
          prevDigit = currentDigit;
          setDisplayDigit(currentDigit);
        }

        // Vertical offset: slide up during each flip
        setOffsetY(-fractional * 6 * (1 - raw));
        setVelocity(0.3 * (1 - raw));

        if (raw < 1) {
          frame = requestAnimationFrame(animate);
        } else {
          setDisplayDigit(target);
          setOffsetY(0);
          setVelocity(0);
          setSettled(true);
        }
      };

      frame = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targetDigit, delay, duration]);

  // ── Hover glitch animation ──
  useEffect(() => {
    if (!settled) return;
    const target = parseInt(targetDigit) || 0;
    let frame;
    let startTime = null;
    const glitchDuration = 300;

    const animate = (time) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / glitchDuration, 1);

      setVelocity(0.3 * (1 - progress));
      setOffsetY(Math.sin(progress * 8) * 4 * (1 - progress));

      if (progress < 0.8) {
        setDisplayDigit(glitchChars[Math.floor(Math.random() * glitchChars.length)]);
      } else {
        setDisplayDigit(hovered ? '#' : target);
      }

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        setDisplayDigit(hovered ? '#' : target);
        setVelocity(0);
        setOffsetY(0);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => { if (frame) cancelAnimationFrame(frame); };
  }, [hovered]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
      position: 'relative',
      width: '38px',
      height: '50px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <img
        src={airBg}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          borderRadius: '3px',
          pointerEvents: 'none',
        }}
      />
      <span style={{
        position: 'relative',
        fontFamily: "'Airport', monospace",
        fontSize: '38px',
        fontWeight: 700,
        color: darkMode ? '#f5d742' : '#e8e8e8',
        textShadow: darkMode ? '0 0 8px rgba(245,215,66,0.5), 0 0 16px rgba(245,215,66,0.2)' : '0 1px 2px rgba(0,0,0,0.5)',
        transform: `translateY(${offsetY}px)`,
        filter: `blur(${velocity * 0.6}px)`,
        transition: settled ? 'all 0.1s ease-out' : 'none',
        userSelect: 'none',
        lineHeight: 1,
        zIndex: 1,
      }}>
        {displayDigit}
      </span>
    </div>
  );
}

function AirportKPI({ label, value, minDigits = 3, darkMode, suffix }) {
  const digits = String(Math.abs(Math.floor(value || 0))).padStart(minDigits, '0').split('');
  // Insert spaces every 3 digits from the right for readability
  const grouped = [];
  const total = digits.length;
  digits.forEach((d, i) => {
    const posFromRight = total - i;
    if (posFromRight % 3 === 0 && i !== 0) {
      grouped.push('space');
    }
    grouped.push({ digit: d, idx: i });
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '3px',
    }}>
      {label && (
        <span style={{
          fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
          fontWeight: 600,
          fontSize: '15px',
          color: '#9ca3af',
          letterSpacing: '0.2px',
        }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        {grouped.map((item, i) =>
          item === 'space'
            ? <div key={`sp-${i}`} style={{ width: '6px' }} />
            : <AirportFlipDigit
                key={item.idx}
                targetDigit={item.digit}
                delay={item.idx * 100}
                duration={1500 + item.idx * 80}
                darkMode={darkMode}
              />
        )}
        {suffix && (
          <>
            <div style={{ width: '6px' }} />
            <div style={{
              position: 'relative',
              width: '38px',
              height: '50px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <img src={airBg} alt="" style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'fill', borderRadius: '3px', pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', top: '50%', left: 0, right: 0,
                height: '2px', background: 'rgba(0,0,0,0.95)',
                transform: 'translateY(-50%)', zIndex: 2, pointerEvents: 'none',
              }} />
              <span style={{
                position: 'relative',
                fontFamily: "'Airport', monospace",
                fontSize: '38px', fontWeight: 700,
                color: darkMode ? '#f5d742' : '#e8e8e8',
                textShadow: darkMode ? '0 0 8px rgba(245,215,66,0.5), 0 0 16px rgba(245,215,66,0.2)' : '0 1px 2px rgba(0,0,0,0.5)',
                userSelect: 'none', lineHeight: 1, zIndex: 1,
              }}>{suffix}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────

   Team Card (Doodles-style animated)

──────────────────────────────────────────────────────────────────────────── */

function ChefCallout({ text, darkMode, show }) {
  const [typed, setTyped] = useState('');
  const idxRef = useRef(0);
  const contentRef = useRef(null);
  const [contentH, setContentH] = useState(0);

  useEffect(() => {
    if (!show) { setTyped(''); idxRef.current = 0; setContentH(0); return; }
    idxRef.current = 0;
    setTyped('');
    const id = setInterval(() => {
      idxRef.current++;
      if (idxRef.current <= text.length) {
        setTyped(text.slice(0, idxRef.current));
      } else {
        clearInterval(id);
      }
    }, 32);
    return () => clearInterval(id);
  }, [show, text]);

  // Measure content height on every typed change
  useEffect(() => {
    if (contentRef.current) {
      const h = contentRef.current.scrollHeight;
      if (h !== contentH) setContentH(h);
    }
  }, [typed]);

  const GLASS_BG = darkMode ? 'rgba(30, 31, 40, 0.72)' : 'rgba(255, 255, 255, 0.68)';
  const GLASS_BORDER = darkMode ? 'rgba(53, 54, 71, 0.6)' : 'rgba(223, 226, 235, 0.7)';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 4 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          style={{
            position: 'absolute',
            left: 34,
            top: -38,
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            position: 'relative',
            background: GLASS_BG,
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: `1px solid ${GLASS_BORDER}`,
            borderRadius: '10px',
            padding: '0 14px',
            boxShadow: darkMode
              ? '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,138,219,0.10)'
              : '0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(91,106,191,0.05)',
            minWidth: 200,
            maxWidth: 300,
            overflow: 'hidden',
          }}>
            {/* Animated height wrapper — slow start, accelerate, micro-bounce settle */}
            <motion.div
              animate={{ height: contentH || 'auto' }}
              transition={{
                duration: 0.25,
                ease: [0.22, 0.68, 0.35, 1.05],
              }}
              style={{ overflow: 'hidden' }}
            >
              <div ref={contentRef} style={{ padding: '7px 0' }}>
                <span style={{
                  fontSize: '11.5px',
                  fontWeight: 500,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  color: darkMode ? '#c8cbda' : '#3a3f54',
                  lineHeight: 1.4,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'pre-wrap',
                }}>
                  {typed}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                    style={{ color: darkMode ? '#7c8adb' : '#5b6abf', fontWeight: 300 }}
                  >|</motion.span>
                </span>
              </div>
            </motion.div>
            {/* Arrow pointing toward avatar */}
            <div style={{
              position: 'absolute',
              bottom: -6,
              left: 6,
              width: 10,
              height: 10,
              background: GLASS_BG,
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: `1px solid ${GLASS_BORDER}`,
              borderTop: 'none',
              borderLeft: 'none',
              transform: 'rotate(45deg)',
              borderRadius: '0 0 2px 0',
            }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TeamCard({ team, darkMode, isTopTeam, chefPhrase }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const [cw, setCw] = useState(440);
  const [chefHover, setChefHover] = useState(false);

  useEffect(() => {
    if (containerRef.current) setCw(containerRef.current.clientWidth);
  }, []);

  const captain = team.memberAvatars.find(m => m.isCaptain);
  const members = team.memberAvatars.filter(m => !m.isCaptain);

  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  // ── All cards are the EXACT same size. No scale ever. ──
  const SIZE = 42;
  const GAP = 10;
  const cx = SIZE / 2 + 40;

  // ── COLLAPSED: messy deck offsets (translate + rotate only) ──
  const deck = [
    { dx: -18, dy: -5, r: -8 },
    { dx: 15, dy: -7, r: 7 },
    { dx: -24, dy: 6, r: -13 },
    { dx: 20, dy: 7, r: 11 },
    { dx: -6, dy: -13, r: -3 },
    { dx: 10, dy: 12, r: 6 },
  ];

  // ── EXPANDED: single row up to 5, grid of 3 beyond ──
  const ROW_Y = SIZE + 14;
  const COLS = members.length <= 5 ? members.length : 3;
  const rowCount = Math.ceil(members.length / COLS);
  const ROW_GAP = 8;
  const availableW = cw - 16;
  const chiefX = cx - SIZE / 2;
  const expandedPos = members.map((_, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const colsInRow = Math.min(COLS, members.length - row * COLS);
    const idealW = colsInRow * SIZE + (colsInRow - 1) * GAP;
    const maxW = availableW - chiefX;
    const fitGap = idealW > maxW
      ? Math.max(2, Math.floor((maxW - colsInRow * SIZE) / Math.max(1, colsInRow - 1)))
      : GAP;
    return {
      x: chiefX + col * (SIZE + fitGap),
      y: ROW_Y + row * (SIZE + ROW_GAP + 14),
    };
  });

  // ── Animated zone heights ──
  const closedH = SIZE + 16;
  const openH = ROW_Y + rowCount * (SIZE + ROW_GAP + 14) - ROW_GAP + 2;

  const BG = darkMode ? '#1e1f28' : '#ffffff';
  const BORDER = darkMode ? '#2a2b36' : '#e2e6ef';
  const TEXT = darkMode ? '#eef0f6' : '#1e2330';
  const MUTED = darkMode ? '#5e6273' : '#9ca3af';

  return (
    <div
      ref={containerRef}
      onClick={() => setOpen(v => !v)}
      style={{
        padding: '4px 0',
        paddingBottom: '24px',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* ── Animated avatar zone ── */}
      <motion.div
        animate={{ height: open ? openH : closedH }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{ position: 'relative', overflow: 'visible' }}
      >
        {/* ── Member cards (always in DOM — slide between deck & row) ── */}
        {members.map((m, i) => (
          <motion.div
            key={m.name}
            animate={open ? {
              x: expandedPos[i].x,
              y: expandedPos[i].y,
              rotate: 0,
            } : {
              x: cx - SIZE / 2 + (deck[i]?.dx || 0),
              y: 6 + (deck[i]?.dy || 0),
              rotate: deck[i]?.r || 0,
            }}
            transition={{
              type: 'spring', stiffness: 280, damping: 24,
              delay: open ? 0.02 + i * 0.045 : i * 0.02,
            }}
            style={{
              position: 'absolute', left: 0, top: 0,
              width: SIZE, height: SIZE,
              borderRadius: '10px', overflow: 'hidden',
              border: `2px solid ${BG}`,
              zIndex: open ? 2 : members.length - i,
              boxShadow: darkMode
                ? '0 2px 8px rgba(0,0,0,0.30)'
                : '0 2px 8px rgba(0,0,0,0.10)',
            }}
          >
            {m.avatar
              ? <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: darkMode ? '#27272a' : '#e4e4e7',
                  fontSize: '13px', fontWeight: 700, color: team.color,
                }}>{getInitials(m.name)}</div>
            }
          </motion.div>
        ))}

        {/* ── Chief card (always in front, slides up on expand) ── */}
        <motion.div
          animate={{
            x: cx - SIZE / 2,
            y: open ? 0 : 6,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          style={{
            position: 'absolute', left: 0, top: 0,
            width: SIZE, height: SIZE,
            borderRadius: '10px', overflow: 'hidden',
            border: `2px solid ${team.color}`,
            zIndex: 10,
            boxShadow: `0 3px 12px ${team.color}30`,
          }}
        >
          {captain?.avatar
            ? <img src={captain.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${team.color}20`,
                fontSize: '13px', fontWeight: 700, color: team.color,
              }}>{getInitials(captain?.name || team.captain)}</div>
          }
        </motion.div>

        {/* ── Chef cap for best team captain ── */}
        {isTopTeam && (
          <motion.div
            animate={{
              x: cx - 14,
              y: open ? -6 : 0,
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={{ position: 'absolute', left: 0, top: 0, zIndex: 11 }}
            onMouseEnter={() => setChefHover(true)}
            onMouseLeave={() => setChefHover(false)}
          >
            <motion.img
              src={chefIcon}
              alt="Meilleur chef d'équipe"
              whileHover={{ scale: 1.18, y: -3 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              style={{
                width: 28,
                height: 28,
                objectFit: 'contain',
                cursor: 'default',
                filter: darkMode
                  ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.55)) brightness(1.05)'
                  : 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))',
              }}
            />
            <ChefCallout
              text={chefPhrase}
              darkMode={darkMode}
              show={chefHover}
            />
          </motion.div>
        )}

        {/* ── Member name labels (expanded, staggered fade) ── */}
        {members.map((m, i) => (
          <motion.div
            key={`lbl-${m.name}`}
            animate={{ opacity: open ? 1 : 0 }}
            transition={{ delay: open ? 0.2 + i * 0.03 : 0, duration: 0.15 }}
            style={{
              position: 'absolute',
              left: expandedPos[i].x, top: expandedPos[i].y + SIZE + 2,
              width: SIZE, textAlign: 'center',
              fontSize: '8px', fontWeight: 500, color: MUTED,
              lineHeight: 1.1, pointerEvents: 'none',
            }}
          >
            {m.name.split(' ')[0]}
          </motion.div>
        ))}
      </motion.div>

      {/* ── Team name label (animates: below stack → right of captain) ── */}
      <motion.div
        initial={false}
        animate={{
          left: open ? cx + SIZE / 2 + 10 : 19,
          top: open ? SIZE / 2 - 8 : closedH + 8,
          opacity: open ? 1 : 1,
        }}
        transition={{
          left: { type: 'spring', stiffness: 280, damping: 26 },
          top: { type: 'spring', stiffness: 280, damping: 26 },
          opacity: { duration: 0.15, delay: 0.1 },
        }}
        style={{
          position: 'absolute',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: TEXT }}>
          Équipe {(captain?.name || team.captain).split(' ')[0]}
        </span>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: team.color, display: 'inline-block', flexShrink: 0,
        }} />
      </motion.div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────

   Component

──────────────────────────────────────────────────────────────────────────── */

export default function Leaderboard() {

  const navigate = useNavigate();

  // ── DARK MODE ───────────────────────────────────────────────────────────────

  const [darkMode, setDarkMode] = useState(() => {

    const saved = localStorage.getItem("darkMode");

    return saved === "true";

  });

  useEffect(() => {

    localStorage.setItem("darkMode", darkMode);

    
    
    // Appliquer dark-mode à body ET html

    if (darkMode) {

      document.body.classList.add("dark-mode");

      document.documentElement.classList.add("dark-mode");

    } else {

      document.body.classList.remove("dark-mode");

      document.documentElement.classList.remove("dark-mode");

    }

  }, [darkMode]);

  // ── SALE DECLARATION MODAL ─────────────────────────────────────────────────
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleForm, setSaleForm] = useState({
    email: '',
    paymentModality: 'M', // M = Monthly, A = Annual
    employeeRange: ''     // Selected range ID
  });
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);

  // Employee ranges - each has an ID for internal tariff mapping
  const EMPLOYEE_RANGES = [
    { id: '1-2', label: '1 à 2 salariés', min: 1, max: 2 },
    { id: '3-5', label: '3 à 5 salariés', min: 3, max: 5 },
    { id: '6-10', label: '6 à 10 salariés', min: 6, max: 10 },
    { id: '11-19', label: '11 à 19 salariés', min: 11, max: 19 },
    { id: '20-29', label: '20 à 29 salariés', min: 20, max: 29 },
    { id: '30-39', label: '30 à 39 salariés', min: 30, max: 39 },
    { id: '40-49', label: '40 à 49 salariés', min: 40, max: 49 },
    { id: '50-74', label: '50 à 74 salariés', min: 50, max: 74 },
    { id: '75-99', label: '75 à 99 salariés', min: 75, max: 99 },
    { id: '100-149', label: '100 à 149 salariés', min: 100, max: 149 },
    { id: '150-199', label: '150 à 199 salariés', min: 150, max: 199 },
    { id: '200-249', label: '200 à 249 salariés', min: 200, max: 249 },
    { id: '250-299', label: '250 à 299 salariés', min: 250, max: 299 },
    { id: '300-349', label: '300 à 349 salariés', min: 300, max: 349 },
    { id: '350-400', label: '350 à 400 salariés', min: 350, max: 400 },
  ];

  const handleSaleFormChange = (field, value) => {
    setSaleForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setSaleSubmitting(true);
    
    try {
      const webhookUrl = import.meta.env.VITE_N8N_SALES_WEBHOOK_URL || 'https://n8nmay.xyz/webhook/6c57e2c2-79c7-4e21-ad42-6dfe0abc6839';
      
      const reporter = getReporterName(session);
      
      const payload = {
        email: saleForm.email.trim().toLowerCase(),
        payment_mode: saleForm.paymentModality === "M" ? "MONTHLY" : "YEARLY",
        employee_band: saleForm.employeeRange,
        submitted_at: new Date().toISOString(),
        source: "DASHBOARD_FORM",
        reporter_name: reporter.full_name,
        reporter_first_name: reporter.first_name,
        reporter_email: session?.user?.email || null,
      };
      
      console.log('📤 Tentative d\'envoi au webhook...');
      
      // ═══════════════════════════════════════════════════════════════
      // SYSTÈME DE RETRY AVEC BACKOFF EXPONENTIEL
      // ═══════════════════════════════════════════════════════════════
      
      const MAX_RETRIES = 5; // Nombre de tentatives
      const INITIAL_TIMEOUT = 15000; // 15s pour la première tentative
      let lastError = null;
      let success = false;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`🔄 Tentative ${attempt}/${MAX_RETRIES}...`);
          
          // Timeout progressif : 15s, 20s, 25s, 30s, 35s
          const timeoutDuration = INITIAL_TIMEOUT + (attempt - 1) * 5000;
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutDuration);
          
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "X-Retry-Attempt": attempt.toString(), // Info pour n8n
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          
          clearTimeout(timeout);
          
          // Vérifier le statut HTTP
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status}: ${txt}`);
          }
          
          // ✅ SUCCÈS!
          console.log(`✅ Webhook envoyé avec succès (tentative ${attempt})`);
          success = true;
          break; // Sortir de la boucle
          
        } catch (err) {
          lastError = err;
          console.error(`❌ Tentative ${attempt} échouée:`, err.message);
          
          // Si ce n'est pas la dernière tentative, attendre avant retry
          if (attempt < MAX_RETRIES) {
            // Backoff exponentiel : 2s, 4s, 8s, 16s
            const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
            console.log(`⏳ Attente de ${waitTime / 1000}s avant retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      // ═══════════════════════════════════════════════════════════════
      // GESTION DU RÉSULTAT FINAL
      // ═══════════════════════════════════════════════════════════════
      
      if (success) {
        // ✅ Succès après X tentatives
        console.log('✅ Vente déclarée avec succès!');
        setSaleSuccess(true);
        
        setTimeout(() => {
          setShowSaleModal(false);
          setSaleSuccess(false);
          setSaleForm({ email: "", paymentModality: "M", employeeRange: "" });
        }, 1500);
        
      } else {
        // ❌ Échec après toutes les tentatives
        console.error('❌ Échec après toutes les tentatives:', lastError);
        
        // Afficher un message détaillé à l'utilisateur
        const errorDetails = lastError.name === 'AbortError' 
          ? 'Le serveur n8n ne répond pas (timeout)'
          : lastError.message;
        
        alert(
          `❌ Échec d'envoi après ${MAX_RETRIES} tentatives.\n\n` +
          `Erreur : ${errorDetails}\n\n` +
          `⚠️ IMPORTANT : Notez ces informations :\n` +
          `Email : ${payload.email}\n` +
          `Mode : ${payload.payment_mode}\n` +
          `Salariés : ${payload.employee_band}\n` +
          `Date : ${new Date().toLocaleString('fr-FR')}\n\n` +
          `Contactez un administrateur pour enregistrer manuellement.`
        );
      }
      
    } catch (err) {
      console.error("❌ Erreur critique:", err);
      alert(`Erreur critique : ${err.message}`);
    } finally {
      setSaleSubmitting(false);
    }
  };

  const closeSaleModal = () => {
    if (!saleSubmitting) {
      setShowSaleModal(false);
      setSaleForm({ email: '', paymentModality: 'M', employeeRange: '' });
      setSaleSuccess(false);
    }
  };

  // ── AUTH ────────────────────────────────────────────────────────────────────

  const [authChecking, setAuthChecking] = useState(false);

  const [session, setSession] = useState(null);

  const [allowed, setAllowed] = useState(false);

  const [loggingIn, setLoggingIn] = useState(false);

  // Pull-to-refresh state

  const [pullDistance, setPullDistance] = useState(0);

  const [isPulling, setIsPulling] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const pullStartY = useRef(0);

  const PULL_THRESHOLD = 50; // Distance minimum pour trigger le refresh (RÉDUIT)

  // ── JWT AUTH STATE ────────────────────────────────────────────────────────

  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isSalesUser, setIsSalesUser] = useState(false);

  useEffect(() => {

    const checkAuth = async () => {
      const token = apiClient.getToken();
      const user = apiClient.getUser();

      if (token && user) {
        // JWT valide - afficher le contenu
        setSession({ user }); // Simuler une session pour compatibilité
        setAllowed(true);

        // Check admin
        setIsAdminUser(user.role === 'admin' || user.role === 'head_of_sales' || user.role === 'tech');

        // Check sales
        if (user.role === 'commercial') {
          const { data: trackingSheet } = await supabase
            .from('tracking_sheets')
            .select('*')
            .eq('sales_email', user.email)
            .eq('is_active', true)
            .maybeSingle();
          setIsSalesUser(!!trackingSheet);
        }
      } else {
        // Pas de JWT - rediriger vers login (Leaderboard désormais protégé)
        setSession(null);
        setAllowed(false);
        setIsAdminUser(false);
        setIsSalesUser(false);
        navigate('/login');
      }
    };

    checkAuth();

  }, []);

  const logout = () => {
    apiClient.logout();
  };

  // ── DATA ────────────────────────────────────────────────────────────────────

  const [rows, setRows] = useState([]);

  const [allTimeTopSeller, setAllTimeTopSeller] = useState(null);

  const [trophies, setTrophies] = useState({});

  const [tunnelStats, setTunnelStats] = useState({});

  const [totals, setTotals] = useState({ cash: 0, revenu: 0, ventes: 0 });

  const [loading, setLoading] = useState(true);

  // ── ANIMATED COUNTERS ───────────────────────────────────────────────────────

  const { count: animatedCash, isComplete: cashComplete } = useCountUp(totals.cash, 1500);

  const { count: animatedRevenu, isComplete: revenuComplete } = useCountUp(totals.revenu, 1500);

  const { count: animatedVentes, isComplete: ventesComplete } = useCountUp(totals.ventes, 1200);

  const [view, setView] = useState("table");

  const [range, setRange] = useState(() => {

    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  });

  const [sales, setSales] = useState([]);

  const [chartSales, setChartSales] = useState([]); // For 3-month chart

  // ── TEAMS (fetched from backend) ──────────────────────────────────────────
  const [teams, setTeams] = useState([]);
  const [storyline, setStoryline] = useState(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const data = await apiClient.get('/api/v1/teams');
        // Normalize API response to internal format
        const normalized = data.map(t => ({
          id: t.id,
          label: t.label,
          color: t.color,
          captain: t.captain.name,
          captainAvatar: t.captain.avatar_url || '',
          members: t.members.map(m => m.name),
          memberAvatars: [
            { name: t.captain.name, avatar: t.captain.avatar_url || '', isCaptain: true },
            ...t.members.map(m => ({ name: m.name, avatar: m.avatar_url || '', isCaptain: false })),
          ],
        }));
        setTeams(normalized);
      } catch (err) {
        console.error('Error fetching teams:', err);
      }
    };
    fetchTeams();
  }, []);

  // Fetch storyline when range changes (for contextual chef callout)
  useEffect(() => {
    if (!range || range === 'all') { setStoryline(null); return; }
    const fetchStoryline = async () => {
      try {
        const data = await apiClient.get(`/api/v1/teams/storyline?period=${range}`);
        setStoryline(data);
      } catch (err) {
        console.warn('Storyline not available:', err);
        setStoryline(null);
      }
    };
    fetchStoryline();
  }, [range]);

  // ── LOAD CHART DATA (3 months comparison - API Backend) ────────────────────
  useEffect(() => {

    const fetchChartData = async () => {

      try {

        const data = await apiClient.getLeaderboardChart();

        console.log('📊 Chart data loaded:', data);

        // Stocker les données du chart pour utilisation dans useMemo
        setChartSales(data);

      } catch (err) {
        console.error("Erreur chargement chart:", err);
      }

    };

    fetchChartData();

  }, []);

  // ── LOAD ALL-TIME TOP SELLER (API Backend) ─────────────────────────────────
  useEffect(() => {
    const fetchAllTimeTopSeller = async () => {
      try {
        // Récupérer les stats all-time depuis l'API
        const data = await apiClient.getLeaderboardStats('all');
        console.log('👑 All-time data loaded:', data);

        // Le top seller all-time est le premier de all_sellers
        const best = data.all_sellers?.[0];
        setAllTimeTopSeller(best?.name || null);
      } catch (err) {
        console.error("Erreur chargement all-time top seller:", err);
      }
    };

    fetchAllTimeTopSeller();
  }, []);

  // ── LOAD TROPHIES (API Backend) ────────────────────────────────────────────
  useEffect(() => {
    const fetchTrophies = async () => {
      try {
        const data = await apiClient.get('/api/v1/leaderboard/trophies');
        console.log('🏆 Trophies loaded:', data);
        setTrophies(data.monthly_winners || {});
      } catch (err) {
        console.error("Erreur chargement trophies:", err);
      }
    };

    fetchTrophies();
  }, []);

  // ── LOAD LEADERBOARD DATA (API Backend) ────────────────────────────────────
  useEffect(() => {

    const fetchLeaderboardData = async () => {

      setLoading(true);

      try {

        // Appel API backend au lieu de Supabase direct
        const data = await apiClient.getLeaderboardStats(range);

        console.log('📊 Leaderboard data loaded:', data);

        // Mettre à jour les states avec les données du backend
        setTotals({
          cash: data.totals.cash_collected,
          revenu: data.totals.revenue,
          ventes: data.totals.sales
        });

        // Transformer all_sellers pour matcher le format attendu par le frontend
        const formattedRows = data.all_sellers.map(seller => ({
          name: seller.name,
          sales: seller.sales,
          cash: seller.cash_collected,
          revenu: seller.revenue,
          avatar: seller.avatar_url || ''
        }));
        setRows(formattedRows);

        // Tunnel stats - transformer teams en tunnel format
        const tunnel = {};
        data.teams.forEach(team => {
          tunnel[team.name] = team.sales;
        });
        setTunnelStats(tunnel);

        // Pour compatibilité avec le reste du code, garder sales
        setSales(data.all_sellers || []);

      } catch (err) {
        console.error("Erreur chargement leaderboard:", err);
      } finally {
        setLoading(false);
      }

    };

    fetchLeaderboardData();

  }, [range]);

  /* ──────────────────────────────────────────────────────────────────────────

     CHARTS

  ─────────────────────────────────────────────────────────────────────────── */

  // ── Acquisition gauge ───────────────────────────────────────────────────────

  const gauge = useMemo(() => {

    const entries = Object.entries(tunnelStats);

    const total = entries.reduce((s, [,v]) => s + v, 0) || 1;

    const top3 = entries.sort((a,b) => b[1] - a[1]).slice(0, 3);

    
    
    const display = (l) => {

      if (/^ads$/i.test(l)) return "ADS";

      if (/^cc$/i.test(l)) return "CC";

      if (/link/i.test(l)) return "LinkedIn";

      return l;

    };

    
    
    const labels = top3.map(([l]) => display(l));

    const counts = top3.map(([,v]) => v);

    const pct = counts.map(v => (v / total) * 100);

    const colors = labels.map((lbl, i) => {

      if (lbl === "ADS") return COLORS.primary;

      if (lbl === "CC")  return COLORS.secondary;

      if (lbl === "LinkedIn") return COLORS.tertiary;

      return [COLORS.primary, COLORS.secondary, COLORS.tertiary][i] || COLORS.gray;

    });

    const tiles = labels.map((l, i) => ({

      label: l,

      pct: pct[i],

      count: counts[i],

      color: colors[i],

    }));

    const main = tiles[0] || null;

    // FIX: Créer un tableau de fond avec la même longueur que les labels

    const backgroundData = new Array(labels.length).fill(0);

    backgroundData[0] = 100; // Seulement pour créer l'arc de fond

    return {

      total,

      main,

      labels,

      pct,

      tiles,

      data: {

        labels,

        datasets: [

          { 

            label: "", // Pas de label pour éviter la pollution

            data: backgroundData, 

            backgroundColor: darkMode ? "#e5e7eb1a" : "#EEF2FF", 

            borderWidth: 0, 

            cutout: "72%", 

            rotation: -90, 

            circumference: 180 

          },

          { 

            data: pct, 

            backgroundColor: colors, 

            borderWidth: 0, 

            cutout: "72%", 

            rotation: -90, 

            circumference: 180, 

            spacing: 2 

          },

        ]

      }

    };

  }, [tunnelStats, darkMode]);

  const gaugeOptions = useMemo(() => ({

    responsive: true,

    maintainAspectRatio: false,

    plugins: {

      legend: { display: false },

      title: { display: false },

      tooltip: {

        // FIX: Ignorer le dataset de fond (index 0)

        filter: (ctx) => ctx.datasetIndex === 1,

        callbacks: {

          label: (ctx) => {

            const label = ctx.label || "";

            const value = ctx.parsed || 0;

            return `${label} : ${value.toFixed(0)}%`;

          },

        },

        backgroundColor: darkMode ? "#020617" : "#ffffff",

        titleColor: darkMode ? "#e5e7eb" : "#000000",

        bodyColor: darkMode ? "#f9fafb" : "#000000",

        borderColor: darkMode ? "#1f2937" : "#e5e7eb",

        borderWidth: 1,

        padding: 10,

        cornerRadius: 6,

      },

      datalabels: {

        color: "#fff",

        font: { size: 10, weight: 700 },

        formatter: (_v, ctx) => (ctx.chart.data.labels?.[ctx.dataIndex] || "").toUpperCase(),

        // FIX: N'afficher les labels que pour le dataset principal (index 1)

        display: (ctx) => (ctx.datasetIndex === 1 && ctx.dataset.data[ctx.dataIndex] > 8),

      },

    },

  }), [darkMode]);

  // ── Last 3 months comparison (CUMULATIVE) ──────────────────────────────────

  const threeMonths = useMemo(() => {
    if (!chartSales || !chartSales.current_month) {
      // Données par défaut si pas encore chargées
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

      return {
        data: {
          labels,
          datasets: []
        },
        sums: { m0: 0, m1: 0, m2: 0 },
        monthNames: { m0: '', m1: '', m2: '' },
        currentDay: today.getDate()
      };
    }

    const today = new Date();
    const currentDay = chartSales.current_day || today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    // Extraire les données cumulatives du backend
    const m0Data = chartSales.current_month.data.map(d => d.value);
    const m1Data = chartSales.previous_month.data.map(d => d.value);
    const m2Data = chartSales.two_months_ago.data.map(d => d.value);

    const data = {
      labels,
      datasets: [
        {
          label: `${chartSales.two_months_ago.month_label} (N-2)`,
          data: m2Data.slice(0, daysInMonth),
          borderColor: COLORS.gray,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          tension: 0.4,
          pointRadius: 0,
          fill: false,
        },
        {
          label: `${chartSales.previous_month.month_label} (N-1)`,
          data: m1Data.slice(0, daysInMonth),
          borderColor: COLORS.secondary,
          backgroundColor: "transparent",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: false,
        },
        {
          label: `${chartSales.current_month.month_label} (N)`,
          data: m0Data.slice(0, daysInMonth),
          borderColor: COLORS.primary,
          backgroundColor: "transparent",
          borderWidth: 3,
          tension: 0.45,
          pointRadius: labels.map((_, i) => (i === currentDay - 1 ? 4 : 0)),
          pointHoverRadius: 6,
          fill: false,
        },
      ],
    };

    return {
      data,
      sums: {
        m0: chartSales.current_month.total,
        m1: chartSales.previous_month.total,
        m2: chartSales.two_months_ago.total
      },
      monthNames: {
        m0: chartSales.current_month.month_label,
        m1: chartSales.previous_month.month_label,
        m2: chartSales.two_months_ago.month_label
      },
      currentDay
    };
  }, [chartSales, darkMode]);

  const lineOptions = useMemo(() => ({

    responsive: true,

    maintainAspectRatio: false,

    resizeDelay: 150,

    animation: { duration: 250 },

    layout: { padding: { top: 8, bottom: 12, left: 8, right: 8 } },

    plugins: {

      title: { display: false },

      legend: { display: false },

      tooltip: {

        callbacks: {

          label: (ctx) => {

            const value = ctx.parsed.y || 0;

            return `${ctx.dataset.label} : ${value.toLocaleString("fr-FR")} € cumulés`;

          },

        },

        backgroundColor: darkMode ? "#020617" : "#ffffff",

        titleColor: darkMode ? "#e5e7eb" : "#000000",

        bodyColor: darkMode ? "#f9fafb" : "#000000",

        borderColor: darkMode ? "#1f2937" : "#e5e7eb",

        borderWidth: 1,

        padding: 10,

        cornerRadius: 6,

      },

      datalabels: { display: false },

    },

    interaction: { mode: "index", intersect: false },

    scales: {

      y: {

        beginAtZero: true,

        grace: "5%",

        ticks: {

          font: { size: 11 },

          callback: (v) => `${Number(v).toLocaleString("fr-FR")} €`,

          color: darkMode ? "#9ba3af" : "#4b5563",

        },

        grid: {

          color: darkMode ? "rgba(148, 163, 184, 0.15)" : "rgba(209, 213, 219, 0.5)",

        },

      },

      x: {

        ticks: {

          font: { size: 10 },

          padding: 6,

          color: darkMode ? "#9ba3af" : "#4b5563",

          maxRotation: 0,

          autoSkip: true,

          maxTicksLimit: 10,

        },

        grid: { display: false },

      },

    },

    elements: {

      line: {

        borderCapStyle: "round",

        borderJoinStyle: "round",

      },

      point: {

        radius: 0,

        hoverRadius: 5,

        hitRadius: 10,

      },

    },

  }), [darkMode]);

  const prev = threeMonths.sums.m1;

  const deltaAbs = threeMonths.sums.m0 - prev;

  const deltaPct = prev ? (deltaAbs / prev) * 100 : null;

  // Trophy system - Monthly winners since September 2025

  const calculateTrophies = useMemo(() => {
    // Trophies are now fetched from backend API endpoint /api/v1/leaderboard/trophies
    // The trophies state is populated in useEffect above
    console.log('🏆 Using trophies from backend:', trophies);
    return trophies;
  }, [trophies]);

  // ── Team stats ──────────────────────────────────────────────────────────────

  const teamStats = useMemo(() => {
    if (!rows || rows.length === 0 || teams.length === 0) return [];

    const byName = new Map(rows.map((r) => [r.name, r]));

    // Fuzzy lookup: "David Dubois" exact, or "David" prefix match
    const findRow = (name) => {
      if (byName.has(name)) return byName.get(name);
      const lower = name.toLowerCase();
      for (const [key, val] of byName) {
        if (key.toLowerCase().startsWith(lower + ' ') || key.toLowerCase() === lower) return val;
      }
      return null;
    };

    const computed = teams.map((t) => {
      const people = [t.captain, ...t.members];
      let ventes = 0;
      let revenu = 0;

      people.forEach((p) => {
        const r = findRow(p);
        if (r) { ventes += r.sales; revenu += r.revenu; }
      });

      // Merge avatars: prefer API avatar_url, fallback to leaderboard row avatar
      const memberAvatars = t.memberAvatars.map((m) => ({
        ...m,
        avatar: m.avatar || findRow(m.name)?.avatar || '',
      }));

      return { ...t, ventes, revenu, memberAvatars };
    });

    const totalRevenu = computed.reduce((s, t) => s + t.revenu, 0) || 1;
    const bestRevenu = Math.max(...computed.map((t) => t.revenu), 0) || 1;
    const MAX_DOTS = 24;

    return computed
      .map((t) => ({
        ...t,
        share: (t.revenu / totalRevenu) * 100,
        dots: Math.max(1, Math.round((t.revenu / bestRevenu) * MAX_DOTS)),
      }))
      .sort((a, b) => b.ventes - a.ventes)
      .map((t, index) => ({ ...t, rank: index + 1 }));
  }, [rows, teams]);

  // ── Chef callout phrase (smart, contextual) ──
  const chefPhrase = useMemo(() => {
    if (teamStats.length < 2) return '';

    const team1 = teamStats[0]; // #1 by ventes
    const team2 = teamStats[1]; // #2

    // Find captain first name
    const captainName = team1.memberAvatars.find(m => m.isCaptain)?.name || team1.captain;
    const chefFirstName = captainName.split(' ')[0];

    // Find top individual seller in team #1 — prefer storyline.best_seller, fallback to local computation
    const byName = new Map(rows.map(r => [r.name, r]));
    const findRow = (name) => {
      if (byName.has(name)) return byName.get(name);
      const lower = name.toLowerCase();
      for (const [key, val] of byName) {
        if (key.toLowerCase().startsWith(lower + ' ') || key.toLowerCase() === lower) return val;
      }
      return null;
    };

    let topSeller;
    if (storyline?.best_seller?.name) {
      topSeller = { name: storyline.best_seller.name.split(' ')[0], sales: storyline.best_seller.sales || 0 };
    } else {
      const team1People = [team1.captain, ...team1.members];
      topSeller = { name: chefFirstName, sales: 0 };
      team1People.forEach(p => {
        const r = findRow(p);
        if (r && r.sales > topSeller.sales) {
          topSeller = { name: p.split(' ')[0], sales: r.sales };
        }
      });
    }

    const captainRow = findRow(team1.captain);
    const chefIsTopSeller = captainRow && captainRow.sales >= topSeller.sales;

    // Date calculations
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isPastMonth = range !== 'all' && range < currentMonth;
    const isAllTime = range === 'all';

    // For "all" period, use a generic dominant phrase
    if (isAllTime) {
      const c = chefFirstName;
      const pool = [
        `${c} impose le rythme, l'équipe répond présent.`,
        `${c} donne le tempo : son équipe suit et performe.`,
        `${c} sécurise la tête : rester #1, c'est tous les jours.`,
        `Sur la durée, ${c} a prouvé que la constance fait les grands leaders.`,
        `${c} et son équipe : une machine qui tourne, mois après mois.`,
        `All-time #1 : ${c} a écrit l'histoire du classement.`,
      ];
      const h = now.getHours();
      const s = now.getDate() * 31 + h * 7 + (team1.ventes || 0) * 17;
      return pool[Math.abs(s) % pool.length];
    }

    // Parse the selected period for day calculations
    const [y, m] = range.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const todayDay = isPastMonth ? daysInMonth : now.getDate();
    const daysLeft = daysInMonth - todayDay;

    const gap = team1.ventes - team2.ventes;

    return getChefPhrase({
      chefFirstName,
      topSellerFirstName: topSeller.name,
      chefIsTopSeller,
      todayDay,
      daysInMonth,
      daysLeft,
      gap,
      isPastMonth,
      storyline,
      teamLabel: team1.label,
      team1Ventes: team1.ventes,
      team2Ventes: team2.ventes,
    });
  }, [teamStats, rows, range, storyline]);

  // ── RENDER ──────────────────────────────────────────────────────────────────


  // Pull-to-refresh handlers

  const handlePullStart = (e) => {

    // Only allow pull from top of totals area

    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

    pullStartY.current = clientY;

    setIsPulling(true);

  };

  const handlePullMove = (e) => {

    if (!isPulling || isRefreshing) return;

    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

    const distance = clientY - pullStartY.current;

    // Only pull down (positive distance)

    if (distance > 0) {

      e.preventDefault();

      // RÉDUIT: Moins de résistance, distance max 70px au lieu de 120px

      const resistance = Math.min(distance * 0.4, 70);

      setPullDistance(resistance);

    }

  };

  const handlePullEnd = async () => {

    if (!isPulling) return;

    setIsPulling(false);

    // If pulled far enough, trigger refresh

    if (pullDistance >= PULL_THRESHOLD) {

      setIsRefreshing(true);

      
      
      // Refresh the page data

      try {

        // Reload the current data by re-running the effect

        window.location.reload();

      } catch (error) {

        console.error('Refresh error:', error);

      }

    }

    // Reset pull distance with animation

    setPullDistance(0);

  };

  // Progress percentage for objective
  const progressPct = Math.min((totals.ventes / 45) * 100, 100);
  const CARD = {
    bg: darkMode ? '#1e1f28' : '#ffffff',
    border: darkMode ? '#2a2b36' : '#e2e6ef',
    surface: darkMode ? '#13141b' : '#edf0f8',
    text: darkMode ? '#eef0f6' : '#1e2330',
    muted: darkMode ? '#5e6273' : '#9ca3af',
    subtle: darkMode ? '#252636' : '#f4f6fb',
    secondary: darkMode ? '#8b8fa0' : '#6b7280',
    accent: darkMode ? '#7c8adb' : '#5b6abf',
    shadow: darkMode
      ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)'
      : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  };

  return (

    <div style={{
      padding: 0,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      background: CARD.surface,
      minHeight: "100vh",
      paddingTop: '80px',
      color: CARD.text,
    }}>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      {/* ═══════════════════════════════════════════════════════════════════
          OUTER WRAPPER — soft card-behind-card
      ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        maxWidth: 1400,
        margin: '32px auto 64px',
        padding: '18px',
        background: darkMode ? 'rgba(0,0,0,0.10)' : 'rgba(190,197,215,0.20)',
        borderRadius: '32px',
      }}>
      <div className="board-frame" style={{ margin: 0 }}>
        {/* ── Top bar ── */}
        <div style={{
          position: 'absolute',
          top: 'var(--space-xl)',
          left: 'var(--space-2xl)',
          right: 'var(--space-2xl)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          {/* Left controls */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* Pill toggle */}
            <div style={{
              display: 'inline-flex',
              background: darkMode ? '#252636' : '#eef1f6',
              borderRadius: '10px',
              padding: '3px',
              border: `1px solid ${darkMode ? '#2a2b36' : '#dfe3ed'}`,
            }}>
              {[{ key: 'table', label: 'Tableaux' }, { key: 'charts', label: 'Charts' }].map(t => (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: view === t.key ? (darkMode ? '#1e1f28' : '#ffffff') : 'transparent',
                    color: view === t.key ? CARD.text : CARD.muted,
                    fontSize: '13px',
                    fontWeight: view === t.key ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: view === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="range-select"
              style={{
                padding: '6px 12px',
                paddingRight: '28px',
                borderRadius: '8px',
                border: `1px solid ${CARD.border}`,
                background: CARD.bg,
                color: CARD.text,
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {(() => {
                const options = [];
                const startDate = new Date('2025-09-01');
                const today = new Date();
                const months = [];
                const current = new Date(startDate);
                const currentYearMonth = today.getFullYear() * 100 + today.getMonth();

                while (true) {
                  const year = current.getFullYear();
                  const month = current.getMonth();
                  const iterYearMonth = year * 100 + month;
                  if (iterYearMonth > currentYearMonth) break;

                  const monthName = new Intl.DateTimeFormat('fr-FR', {
                    month: 'long',
                    year: 'numeric'
                  }).format(current);

                  const value = `${year}-${String(month + 1).padStart(2, '0')}`;
                  months.unshift({ value, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) });
                  current.setMonth(current.getMonth() + 1);
                }

                months.forEach(m => {
                  options.push(<option key={m.value} value={m.value}>{m.label}</option>);
                });
                options.push(<option key="all" value="all">All time</option>);
                return options;
              })()}
            </select>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => navigate("/contracts/new")}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em',
                color: darkMode ? '#9ca3b8' : '#464b65',
                padding: '8px 18px',
                background: darkMode ? '#2a2b36' : '#dfdfe5',
                borderRadius: '10px',
                border: darkMode ? '1px solid #353647' : '1px solid #c3c3c3',
                borderBottom: darkMode ? '1px solid #252636' : '1px solid #a5a5a5',
                boxShadow: darkMode
                  ? 'inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -3px 4px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.25)'
                  : 'inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 4px #d0d1d8, 0 3px 6px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              NDA
            </button>
            <button
              onClick={() => setShowSaleModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em',
                color: darkMode ? '#9ca3b8' : '#464b65',
                padding: '8px 18px',
                background: darkMode ? '#2a2b36' : '#dfdfe5',
                borderRadius: '10px',
                border: darkMode ? '1px solid #353647' : '1px solid #c3c3c3',
                borderBottom: darkMode ? '1px solid #252636' : '1px solid #a5a5a5',
                boxShadow: darkMode
                  ? 'inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -3px 4px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.25)'
                  : 'inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 4px #d0d1d8, 0 3px 6px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Déclarer une vente
            </button>
          </div>
        </div>

        {/* ── Hero: Logo + Title ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '24px',
        }}>
          <img src={darkMode ? myLogoDark : myLogo} className="title-logo" alt="logo" />
          <h1 className="leaderboard-title" style={{
            letterSpacing: '-0.5px',
            margin: 0,
            fontSize: 'clamp(1.1rem, 2.8vw, 1.5rem)',
            fontWeight: 700,
            color: CARD.text,
          }}>Suivi des ventes</h1>
        </div>

        {/* ── Objective progress (full width, thin) ── */}
        <div style={{
          maxWidth: '560px',
          margin: '0 auto 32px',
          padding: '0 20px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: CARD.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}>
              Objectif mensuel
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: 700,
              color: CARD.accent,
            }}>
              {totals.ventes} / 45
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '5px',
            background: darkMode ? '#252636' : '#e2e6ef',
            borderRadius: '3px',
            position: 'relative',
            overflow: 'visible',
          }}>
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              background: darkMode
                ? 'linear-gradient(90deg, #5b6abf, #7c8adb)'
                : 'linear-gradient(90deg, #5b6abf, #7c8adb)',
              borderRadius: '3px',
              transition: 'width 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              minWidth: '4px',
            }} />
            {/* Ship + Flame */}
            <div style={{
              position: 'absolute',
              left: `${progressPct}%`,
              top: '50%',
              transform: 'translate(-18px, -50%)',
              display: 'flex',
              alignItems: 'center',
              zIndex: 3,
              transition: 'left 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 1s ease',
              opacity: (totals.ventes / 45) >= 0.9 ? Math.max(0, 1 - ((totals.ventes / 45) - 0.9) / 0.1) : 1,
            }}>
              <img src={flameIcon} alt="" style={{
                width: '20px', height: '20px', objectFit: 'contain', marginRight: '-8px',
                filter: darkMode
                  ? 'brightness(0) saturate(100%) invert(60%) sepia(30%) saturate(800%) hue-rotate(200deg) brightness(120%)'
                  : 'brightness(0) saturate(100%) invert(30%) sepia(50%) saturate(1200%) hue-rotate(210deg) brightness(95%)',
              }} />
              <img src={shipIcon} alt="" style={{
                width: '30px', height: '30px', objectFit: 'contain', marginLeft: '-4px',
                filter: darkMode ? 'brightness(0) invert(1)' : 'none',
              }} />
            </div>
          </div>
        </div>

        {/* ── KPI Cards Row ── */}
        <div
          className="pull-refresh-area"
          onMouseDown={handlePullStart}
          onMouseMove={handlePullMove}
          onMouseUp={handlePullEnd}
          onMouseLeave={handlePullEnd}
          onTouchStart={handlePullStart}
          onTouchMove={handlePullMove}
          onTouchEnd={handlePullEnd}
          style={{
            transform: `translateY(${pullDistance}px)`,
            transition: isPulling ? 'none' : 'transform 0.3s ease-out',
            cursor: isPulling ? 'grabbing' : 'grab',
            userSelect: 'none',
            position: 'relative',
            paddingTop: pullDistance > 0 ? '30px' : '0',
          }}
        >
          {pullDistance > 0 && (
            <div style={{
              position: 'absolute', top: 0, left: '50%',
              transform: 'translateX(-50%)', fontSize: 20,
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}>
              {pullDistance >= PULL_THRESHOLD ? '🔄' : '⬇️'}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px',
            maxWidth: '900px',
            margin: '0 auto 36px',
            padding: '0 20px',
          }}>
            {[
              { label: 'Total Cash', value: totals.cash, digits: Math.max(5, String(Math.floor(totals.cash || 0)).length), suffix: '€' },
              { label: 'Total Ventes', value: totals.ventes, digits: 3 },
              { label: 'Total Revenu', value: totals.revenu, digits: Math.max(5, String(Math.floor(totals.revenu || 0)).length), suffix: '€' },
            ].map((kpi) => (
              <div key={kpi.label} style={{
                background: darkMode ? '#16171f' : CARD.bg,
                border: `1px solid ${darkMode ? '#2a2b36' : CARD.border}`,
                borderTop: darkMode ? '1px solid rgba(124, 138, 219, 0.25)' : `1px solid ${CARD.border}`,
                borderBottom: darkMode ? '1px solid #0c0d12' : `1px solid ${CARD.border}`,
                borderRadius: '14px',
                padding: '18px 14px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                boxShadow: darkMode
                  ? '0 -1px 12px rgba(124, 138, 219, 0.08), 0 4px 10px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)'
                  : CARD.shadow,
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: CARD.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                }}>
                  {kpi.label}
                </span>
                <AirportKPI key={`${kpi.label}-${range}`} label="" value={kpi.value} minDigits={kpi.digits} darkMode={darkMode} suffix={kpi.suffix} />
              </div>
            ))}
          </div>
        </div>

        {loading && <p style={{ textAlign: 'center', color: CARD.muted }}>Loading...</p>}
        {!loading && rows.length === 0 && <p style={{ textAlign: 'center', color: CARD.muted }}>Aucune vente ce mois-ci pour l'instant.</p>}

        {view === "table" && !loading && rows.length > 0 && (() => {

          const pillBtn = (label) => ({
            display: 'inline-block',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: darkMode ? '#9ca3b8' : '#464b65',
            padding: '8px 18px',
            background: darkMode ? '#2a2b36' : '#dfdfe5',
            borderRadius: '14px',
            border: darkMode ? '1px solid #353647' : '1px solid #c3c3c3',
            borderBottom: darkMode ? '1px solid #252636' : '1px solid #a5a5a5',
            boxShadow: darkMode
              ? 'inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -3px 4px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.25)'
              : 'inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 4px #d0d1d8, 0 3px 6px rgba(0,0,0,0.1)',
            cursor: 'default',
            userSelect: 'none',
          });

          return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '32px',
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 20px',
            alignItems: 'start',
          }}>
            {/* ── Left column ── */}
            <div>
              <div style={{ marginBottom: '12px' }}>
                <div style={pillBtn()}>Classement Individuel</div>
              </div>
              <div className="leaderboard-wrapper" style={{ margin: 0 }}>
                <table className="leaderboard" style={{ maxWidth: '100%' }}>
                  <thead><tr>
                    <th style={{ width: '36px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: CARD.muted, fontWeight: 600 }}>#</th>
                    <th style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: CARD.muted, fontWeight: 600 }}>Nom</th>
                    <th align="center" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: CARD.muted, fontWeight: 600 }}>Ventes</th>
                    <th align="right" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: CARD.muted, fontWeight: 600 }}>Revenu</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={r.name}
                        style={{ cursor: 'default' }}
                      >
                        <td>
                          {i === 0 ? (
                            <img src={firstPlace} alt="1st" style={{ width: 28, height: 28 }} />
                          ) : i === 1 ? (
                            <img src={secondPlace} alt="2nd" style={{ width: 28, height: 28 }} />
                          ) : i === 2 ? (
                            <img src={thirdPlace} alt="3rd" style={{ width: 28, height: 28 }} />
                          ) : (
                            <span style={{ color: CARD.muted, fontWeight: 500, fontSize: '12px' }}>{i + 1}</span>
                          )}
                        </td>
                        <td className="name-cell">
                          <div className="avatar-wrap">
                            <img src={r.avatar} className="avatar" alt="" />
                            {allTimeTopSeller && r.name === allTimeTopSeller && (
                              <img src={crownIcon} className="crown-icon" alt="Top ventes all-time" title="Top ventes all-time" />
                            )}
                          </div>
                          <span style={{ fontWeight: 500 }}>{r.name}</span>
                          {calculateTrophies[r.name] > 0 && (
                            <div className="trophy-container">
                              <img src={trophyIcon} alt="Trophy" className="trophy-icon" />
                              {calculateTrophies[r.name] > 1 && (
                                <span className="trophy-count">×{calculateTrophies[r.name]}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td align="center" style={{
                          fontWeight: 700,
                          fontSize: '15px',
                          color: CARD.text,
                        }}>{r.sales}</td>
                        <td align="right" style={{
                          fontWeight: 500,
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: '13px',
                          color: CARD.secondary,
                        }}>{r.revenu.toLocaleString("fr-FR")} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Right column: Team ranking (table-style rows + animation) ── */}
            {teamStats.length > 0 && (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={pillBtn()}>Classement Équipes</div>
                </div>
                <div className="leaderboard-wrapper" style={{ margin: 0 }}>
                  <table className="leaderboard" style={{ maxWidth: '100%' }}>
                    <thead><tr>
                      <th style={{ width: '60%', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: CARD.muted, fontWeight: 600, textAlign: 'left' }}><span style={{ marginLeft: '54px' }}>Équipe</span></th>
                      <th style={{ width: '18%', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: CARD.muted, fontWeight: 600, textAlign: 'center' }}>Ventes</th>
                      <th style={{ width: '22%', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: CARD.muted, fontWeight: 600, textAlign: 'center' }}>Revenu</th>
                    </tr></thead>
                    <tbody>
                      {teamStats.map((team, i) => (
                        <tr key={team.id} style={{ cursor: 'default' }}>
                          <td style={{ paddingLeft: '36px' }}>
                            <TeamCard key={team.id} team={team} darkMode={darkMode} isTopTeam={i === 0} chefPhrase={i === 0 ? chefPhrase : ''} />
                          </td>
                          <td style={{
                            fontWeight: 700,
                            fontSize: '15px',
                            color: CARD.text,
                            textAlign: 'center',
                          }}>{team.ventes}</td>
                          <td style={{
                            fontWeight: 500,
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '13px',
                            color: CARD.secondary,
                            textAlign: 'center',
                          }}>{team.revenu.toLocaleString('fr-FR')} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {view === "charts" && !loading && (

          <div className="charts-wrapper">

            {/* FIX: Utiliser les mêmes classes que la carte KPI */}

            <div className="chart-card kpi-card chart--gauge">

              <div className="gauge-header">

                <div className="gauge-title">Tunnel d'acquisition</div>

                <div className="gauge-subtitle">

                  Top 3 canaux – {gauge.total} dossiers

                </div>

              </div>

              <Doughnut data={gauge.data} options={gaugeOptions} />

              <div className="gauge-sep" />

              <div className="gauge-tiles">

                {gauge.tiles.map((t) => (

                  <div key={t.label} className="gauge-tile">

                    <span className="tile-dot" style={{ background: t.color }} />

                    <div className="tile-text">

                      <div className="tile-label">{t.label}</div>

                      <div className="tile-value">

                        {Math.round(t.pct)}% <span className="tile-count">({t.count} dossiers)</span>

                      </div>

                    </div>

                  </div>

                ))}

              </div>

            </div>

            <div className="chart-card chart--weeks kpi-card">

              <div className="chart-header kpi-header">

                <div>

                  <div className="kpi-label">

                    Revenu cumulé&nbsp;({threeMonths.monthNames.m0.toUpperCase()} – N)

                  </div>

                  <div className="kpi-value">

                    {threeMonths.sums.m0.toLocaleString("fr-FR")} €

                  </div>

                  <div className="kpi-sub">

                    Comparé aux {threeMonths.currentDay} premiers jours de{" "}

                    {threeMonths.monthNames.m1.toUpperCase()} (N-1)

                  </div>

                </div>

                <TrendBadge deltaAbs={deltaAbs} deltaPct={deltaPct} />

              </div>

              <div className="chart-title-small">

                Performance des 3 derniers mois (revenu cumulé €/jour)

              </div>

              <div className="chart-body chart-body--glass">

                <Line data={threeMonths.data} options={lineOptions} />

              </div>

              <div className="chart-key">

                <span className="key">

                  <i className="dot" style={{ background: COLORS.gray }} />{" "}

                  {threeMonths.monthNames.m2.toUpperCase()} (N-2)

                </span>

                <span className="key">

                  <i className="dot" style={{ background: COLORS.secondary }} />{" "}

                  {threeMonths.monthNames.m1.toUpperCase()} (N-1)

                </span>

                <span className="key current">

                  <i className="dot" style={{ background: COLORS.primary }} />{" "}

                  {threeMonths.monthNames.m0.toUpperCase()} (N)

                </span>

              </div>

              <div className="chart-footnote">

                Lecture : chaque courbe représente le <strong>CA cumulé</strong> jour par jour.

                On compare les {threeMonths.currentDay} premiers jours de chaque mois

                (N, N-1, N-2).

              </div>

            </div>

            {teamStats.length > 0 && (

              <div className="chart-card kpi-card team-card">

                <div className="team-header">

                  <div className="team-title">Performance par équipe commerciale</div>

                  <div className="team-subtitle">

                    Classement par CA {range === "all" ? "toutes périodes confondues" : "du mois sélectionné"}

                  </div>

                </div>

                <div className="team-grid">

                  {teamStats.map((team) => (

                    <div className="team-col" key={team.id}>

                      <div className="team-rank">#{team.rank}</div>

                      <div className="team-captain">Équipe {team.captain}</div>

                      <div className="team-meta">

                        {team.revenu.toLocaleString("fr-FR")} € · {Math.round(team.share)} %

                      </div>

                      <div className="team-dots">

                        {(() => {

                          const totalDots = 24;

                          const cols = 6;

                          const rows = 4;

                          const filledDots = team.dots;

                          
                          
                          // Créer le pattern de silhouette organique

                          // Les colonnes du bas sont toujours pleines, on "coupe" le haut

                          const getDotsForRow = (rowIndex) => {

                            const bottomRows = Math.floor(filledDots / cols);

                            
                            
                            if (rowIndex >= rows - bottomRows) {

                              // Rangées du bas : toutes les colonnes remplies

                              return cols;

                            } else if (rowIndex === rows - bottomRows - 1) {

                              // Rangée de transition : nombre partiel

                              return filledDots % cols;

                            }

                            // Rangées du haut : vides

                            return 0;

                          };

                          const dots = [];

                          for (let row = 0; row < rows; row++) {

                            const dotsInRow = getDotsForRow(row);

                            for (let col = 0; col < cols; col++) {

                              const isFilled = col < dotsInRow;

                              dots.push(

                                <span

                                  key={`${row}-${col}`}

                                  className={`team-dot ${isFilled ? 'team-dot--filled' : ''}`}

                                  style={isFilled ? { background: team.color } : undefined}

                                />

                              );

                            }

                          }

                          return dots;

                        })()}

                      </div>

                    </div>

                  ))}

                </div>

              </div>

            )}

          </div>

        )}

      </div>
      </div>{/* /outer wrapper */}

      {/* ═══════════════════════════════════════════════════════════════════
          SALE DECLARATION MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {showSaleModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: darkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            transform: 'translateZ(0)',
            willChange: 'opacity',
            contain: 'layout paint',
            animation: 'modalBackdropIn 0.3s ease-out forwards'
          }}
          onClick={closeSaleModal}
        >
          
          {/* Modal card */}
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '420px',
              background: darkMode ? '#242428' : '#ffffff',
              borderRadius: '20px',
              border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
              boxShadow: darkMode 
                ? '0 24px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05) inset' 
                : '0 24px 80px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              animation: 'modalSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transform: 'translateZ(0)',
              isolation: 'isolate'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '24px 24px 0',
              textAlign: 'center'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primary}dd)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '24px',
                boxShadow: `0 8px 24px ${COLORS.primary}40`
              }}>
                {saleSuccess ? '✓' : '💼'}
    </div>
              <h2 style={{
                margin: '0 0 6px',
                fontSize: '22px',
                fontWeight: 600,
                color: darkMode ? '#f5f5f7' : '#1d1d1f',
                letterSpacing: '-0.3px'
              }}>
                {saleSuccess ? 'Vente déclarée !' : 'Déclarer une vente'}
              </h2>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: darkMode ? '#8b8d93' : '#86868b'
              }}>
                {saleSuccess ? 'La vente a été enregistrée avec succès' : 'Renseignez les informations client'}
              </p>
            </div>

            {/* Form */}
            {!saleSuccess && (
              <form onSubmit={handleSaleSubmit} style={{ padding: '24px' }}>
                {/* Email */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: darkMode ? '#f5f5f7' : '#1d1d1f'
                  }}>
                    Adresse email
                  </label>
                  <input
                    type="email"
                    value={saleForm.email}
                    onChange={(e) => handleSaleFormChange('email', e.target.value)}
                    required
                    placeholder="client@exemple.com"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
                      background: darkMode ? '#1a1a1e' : '#f5f5f7',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = COLORS.primary;
                      e.target.style.boxShadow = `0 0 0 4px ${COLORS.primary}20`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = darkMode ? '#333338' : '#e5e5e5';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Payment Modality */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: darkMode ? '#f5f5f7' : '#1d1d1f'
                  }}>
                    Modalité de paiement
                  </label>
                  <div style={{
                    display: 'flex',
                    gap: '10px'
                  }}>
                    <button
                      type="button"
                      onClick={() => handleSaleFormChange('paymentModality', 'M')}
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: `2px solid ${saleForm.paymentModality === 'M' ? COLORS.primary : (darkMode ? '#333338' : '#e5e5e5')}`,
                        background: saleForm.paymentModality === 'M' 
                          ? (darkMode ? `${COLORS.primary}20` : `${COLORS.primary}15`) 
                          : (darkMode ? '#1a1a1e' : '#f5f5f7'),
                        color: saleForm.paymentModality === 'M' ? COLORS.primary : (darkMode ? '#f5f5f7' : '#1d1d1f'),
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontSize: '18px', marginRight: '6px' }}>📅</span>
                      Mensuel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaleFormChange('paymentModality', 'A')}
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: `2px solid ${saleForm.paymentModality === 'A' ? COLORS.primary : (darkMode ? '#333338' : '#e5e5e5')}`,
                        background: saleForm.paymentModality === 'A' 
                          ? (darkMode ? `${COLORS.primary}20` : `${COLORS.primary}15`) 
                          : (darkMode ? '#1a1a1e' : '#f5f5f7'),
                        color: saleForm.paymentModality === 'A' ? COLORS.primary : (darkMode ? '#f5f5f7' : '#1d1d1f'),
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontSize: '18px', marginRight: '6px' }}>📆</span>
                      Annuel
                    </button>
                  </div>
                </div>

                {/* Employee Range Selection - Clean Grid */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: darkMode ? '#f5f5f7' : '#1d1d1f'
                  }}>
                    Nombre de salariés
                  </label>
                  
                  {/* Grid of options */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '6px'
                  }}>
                    {EMPLOYEE_RANGES.map(range => {
                      const isSelected = saleForm.employeeRange === range.id;
                      return (
                        <button
                          key={range.id}
                          type="button"
                          onClick={() => handleSaleFormChange('employeeRange', range.id)}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: `2px solid ${isSelected ? COLORS.primary : 'transparent'}`,
                            background: isSelected 
                              ? (darkMode ? `${COLORS.primary}20` : `${COLORS.primary}10`)
                              : (darkMode ? '#1a1a1e' : '#f9f9f9'),
                            color: isSelected ? COLORS.primary : (darkMode ? '#f5f5f7' : '#1d1d1f'),
                            fontSize: '12px',
                            fontWeight: isSelected ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'center',
                            boxShadow: isSelected ? 'none' : `inset 0 0 0 1px ${darkMode ? '#333338' : '#e5e5e5'}`
                          }}
                        >
                          {range.min}-{range.max}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={closeSaleModal}
                    disabled={saleSubmitting}
                    style={{
                      flex: 1,
                      padding: '14px 20px',
                      borderRadius: '12px',
                      border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
                      background: darkMode ? '#1a1a1e' : '#ffffff',
                      color: darkMode ? '#f5f5f7' : '#1d1d1f',
                      fontSize: '15px',
                      fontWeight: 500,
                      cursor: saleSubmitting ? 'not-allowed' : 'pointer',
                      opacity: saleSubmitting ? 0.5 : 1,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => !saleSubmitting && (e.target.style.background = darkMode ? '#242428' : '#f5f5f7')}
                    onMouseLeave={(e) => e.target.style.background = darkMode ? '#1a1a1e' : '#ffffff'}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saleSubmitting || !saleForm.email || !saleForm.employeeRange}
                    style={{
                      flex: 1,
                      padding: '14px 20px',
                      borderRadius: '12px',
                      border: 'none',
                      background: COLORS.primary,
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: (saleSubmitting || !saleForm.email || !saleForm.employeeRange) ? 'not-allowed' : 'pointer',
                      opacity: (saleSubmitting || !saleForm.email || !saleForm.employeeRange) ? 0.6 : 1,
                      transition: 'all 0.2s',
                      boxShadow: `0 4px 12px ${COLORS.primary}40`
                    }}
                  >
                    {saleSubmitting ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span style={{ 
                          width: '16px', 
                          height: '16px', 
                          border: '2px solid rgba(255,255,255,0.3)', 
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        Envoi...
                      </span>
                    ) : 'Déclarer la vente'}
                  </button>
                </div>
              </form>
            )}

            {/* Success state padding */}
            {saleSuccess && <div style={{ height: '40px' }} />}

            {/* Close button */}
            <button
              onClick={closeSaleModal}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                background: darkMode ? '#333338' : '#f5f5f7',
                color: darkMode ? '#8b8d93' : '#86868b',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = darkMode ? '#444' : '#e5e5e5';
                e.target.style.color = darkMode ? '#fff' : '#1d1d1f';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = darkMode ? '#333338' : '#f5f5f7';
                e.target.style.color = darkMode ? '#8b8d93' : '#86868b';
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Modal animations */}

      {/* Modal animations */}
      <style>{`
        @font-face {
          font-family: 'Airport';
          src: url('${airportFont}') format('opentype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @keyframes modalBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideIn {
          from { 
            opacity: 0; 
            transform: scale(0.95) translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

    </div>

  );

}
