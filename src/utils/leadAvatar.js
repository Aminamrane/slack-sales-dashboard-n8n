// src/utils/leadAvatar.js
//
// Avatar de lead : un visage dessiné, choisi selon le genre déduit du PRÉNOM
// français, stable pour un même lead (hash sur l'id). Jeu d'images fourni par
// le dev le 02/09 : 8 femmes (f1-f8), 9 hommes (m1-m9) dans
// public/avatars/leads/.
//
// La détection est volontairement simple : deux dictionnaires construits
// depuis les prénoms RÉELS de la base (top des 14 000 leads nommés), complétés
// des prénoms français courants, puis deux heuristiques de repli. Un nom de
// société ou un prénom inconnu tombe sur le jeu masculin par défaut : le but
// est décoratif, jamais bloquant.

const FEMALE = new Set([
  // Top de la base
  "isabelle", "nathalie", "marie", "sylvie", "sandrine", "stephanie", "karine",
  "virginie", "celine", "valerie", "delphine", "christine", "sophie", "julie",
  "anne", "laetitia", "veronique", "sandra", "corinne", "christelle", "audrey",
  "caroline", "florence", "patricia", "laurence", "catherine", "helene",
  "aurelie", "martine", "camille", "melanie", "severine", "emilie",
  "charlotte", "vanessa", "fabienne", "cecile", "francoise", "nadine",
  "alexandra", "sarah", "muriel", "nicole", "claire", "nadege", "laure",
  "estelle", "magali", "elodie", "amelie", "elisabeth", "carine", "sabrina",
  "chantal", "angelique", "nadia", "sonia", "marine", "myriam", "malika",
  "katia", "jennifer", "agnes", "emmanuelle", "gaelle", "beatrice",
  "amandine", "sabine", "rose", "brigitte", "morgane", "cathy", "monique",
  "lydia", "mariana",
  // Courants hors top
  "anais", "chloe", "lea", "manon", "emma", "lucie", "pauline", "marion",
  "justine", "oceane", "margaux", "clara", "eva", "ines", "jade", "lisa",
  "laura", "marina", "melissa", "jessica", "cindy", "deborah", "coralie",
  "aurore", "ophelie", "noemie", "alice", "juliette", "mathilde", "victoria",
  "solene", "maeva", "salome", "celia", "fanny", "ingrid", "ssabrina",
  "peggy", "sylviane", "josiane", "jacqueline", "colette", "denise",
  "annie", "michele", "danielle", "ghislaine", "odile", "edith", "eliane",
  "samira", "fatima", "fatiha", "aicha", "khadija", "leila", "yasmina",
  "sofia", "meriem", "amina", "karima", "rachida", "naima", "souad",
  "latifa", "zohra", "saida", "samia", "hanane", "imane", "siham",
  "salima", "linda", "mina", "assia", "lamia", "dounia", "kenza", "yasmine",
]);

const MALE = new Set([
  // Top de la base
  "jean", "philippe", "david", "stephane", "sebastien", "christophe",
  "olivier", "laurent", "frederic", "eric", "thierry", "nicolas", "franck",
  "jerome", "patrick", "pascal", "michel", "pierre", "marc", "julien",
  "alain", "cedric", "guillaume", "alexandre", "vincent", "didier",
  "anthony", "francois", "arnaud", "romain", "dominique", "herve", "gilles",
  "fabrice", "bruno", "ludovic", "christian", "sylvain", "thomas", "damien",
  "fabien", "daniel", "xavier", "benoit", "emmanuel", "mathieu", "yannick",
  "patrice", "mohamed", "gerard", "fred", "jose", "lionel", "mickael",
  "richard", "claude", "bernard", "charles", "andre", "florian", "jonathan",
  "yves", "bertrand", "kevin", "serge", "jeremy", "tony", "benjamin",
  "antoine", "loic", "denis", "cyril", "maxime", "alex", "guy", "yann",
  "jacques", "seb", "florent", "karim", "yoann", "georges", "aurelien",
  "clement", "remy", "regis", "joseph", "ali", "matthieu", "cyrille",
  "adrien", "farid", "rachid", "gregory", "simon", "manu", "raphael",
  "tom", "jeremie", "ahmed", "arthur", "alexis", "roger", "samuel", "ben",
  "william", "etienne", "gerald", "marco", "gaetan", "quentin", "francis",
  "marcel", "hugo", "carlos", "mika", "geoffrey", "joel", "luc", "valentin",
  "morgan", "jacky", "mario", "thibaut", "gabriel", "robert", "romuald",
  "rudy", "louis", "manuel", "lucas", "brice", "antony", "luis", "axel",
  "kamel", "jimmy", "sam", "miguel", "james", "rene", "baptiste",
  "fernando", "nabil", "steve", "nico", "corentin", "theo", "frank",
  "flavien", "dylan", "gael", "teddy", "martial", "paul", "michael",
  "chris", "jp", "jo", "hakim", "mehdi", "badis", "yanis", "yohan",
  // Arabes/latins en -a, exceptions de l'heuristique « finale en a = féminin »
  "moussa", "mustapha", "reda", "sacha", "nicola", "elia", "andrea",
  "ilya", "issa", "mounia" /* piégeux mais rare */,
]);

const strip = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Genre déduit du prénom : "f" ou "m" (défaut).
export function guessGender(fullName) {
  const raw = strip(fullName).trim().split(/\s+/)[0] || "";
  if (!raw) return "m";
  // Composé : « jean-françois » = le premier segment décide (marie-… = f).
  if (FEMALE.has(raw)) return "f";
  if (MALE.has(raw)) return "m";
  const head = raw.split("-")[0];
  if (FEMALE.has(head)) return "f";
  if (MALE.has(head)) return "m";
  // Heuristiques de repli sur les finales typiquement féminines.
  if (/(ette|elle|ine|enne|ia|ah)$/.test(raw)) return "f";
  if (/a$/.test(raw)) return "f";
  return "m";
}

// Jeux d'images par ORIGINE : chaque canal peut avoir son ambiance (demande
// dev 02/09 — Micro-crèche a ses propres visages, tenues « pousse » incluses).
// `dir` = sous-dossier de public/avatars/leads, `f`/`m` = nombre d'images.
const SETS = {
  default: { dir: "", f: 8, m: 9 },
  "micro-creche": { dir: "microcreche/", f: 5, m: 4 },
  // Deux libellés restaurant coexistent en base : même jeu pour les deux.
  "resto interne": { dir: "resto/", f: 5, m: 5 },
  "restaurant interne": { dir: "resto/", f: 5, m: 5 },
  "ambulance interne": { dir: "ambulance/", f: 2, m: 3 },
  "ambulance": { dir: "ambulance/", f: 2, m: 3 },
  // Pas une origine : réservé aux Général(e) interne dont la CAMPAGNE est btp.
  __btp: { dir: "btp/", f: 2, m: 3 },
};

// Général(e) interne se départage par la campagne Meta : btp -> casques,
// sinon jeu broad par défaut.
const GENERAL = new Set(["general interne", "generale interne"]);

function setFor(origin, campaign) {
  const key = strip(origin).trim();
  if (GENERAL.has(key) && /btp/.test(strip(campaign))) return SETS.__btp;
  return SETS[key] || SETS.default;
}

// Hash déterministe sur l'ID DU LEAD : le même lead garde le même visage à
// chaque rendu, chaque refresh, pour tout le monde. Jamais de tirage.
function hash(s) {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function leadAvatar(fullName, leadId, origin, campaign) {
  const set = setFor(origin, campaign);
  const g = guessGender(fullName);
  const n = (hash(leadId != null ? leadId : strip(fullName)) % set[g]) + 1;
  return `/avatars/leads/${set.dir}${g}${n}.png`;
}
