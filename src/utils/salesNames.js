// Noms canoniques des personnes de la Performance Sales (variantes de saisie -> une seule clé), partagés par la page Performance Sales
// (lignes, effectifs, avatars) et par Perf Setter (avatars des setters et des sales). Déplacé tel quel de MonitoringPerf.jsx (2026-10-30), rien n'a changé :
// toute évolution d'équipe passe par NAME_VARIANTS_TO_CANONICAL. Dépôt public : n'y mettre que ce qui sert à rapprocher des noms.
export const stripDiacritics = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
export const normalizeSalesKey = (name) => {
  if (!name) return "unknown";
  return stripDiacritics(name).toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z\s'-]/g, "");
};

export const NAME_VARIANTS_TO_CANONICAL = {
  "kyle dif": "kail", "kail": "kail", "kyle": "kail",
  "yohan": "yohan debowski", "yohan debowski": "yohan debowski", "debowski": "yohan debowski",
  "leo": "leo mafrici", "leo mafrici": "leo mafrici", "mafrici": "leo mafrici",
  "yanis": "yanis zairi", "yanis zairi": "yanis zairi", "zairi": "yanis zairi",
  "youness": "youness el boukhrissi", "youness el boukhrissi": "youness el boukhrissi", "el boukhrissi": "youness el boukhrissi",
  "mourad": "mourad derradji", "mourad derradji": "mourad derradji", "derradji": "mourad derradji",
  "alex": "alex gaudrillet", "alex gaudrillet": "alex gaudrillet", "gaudrillet": "alex gaudrillet",
  "sebastien": "sebastien itema", "sebastien itema": "sebastien itema", "itema": "sebastien itema",
  "quentin": "quentin rattez", "quentin rattez": "quentin rattez", "rattez": "quentin rattez",
  "gwenael": "gwenael", "gwenaelle": "gwenael",
  "david": "david dubois", "david dubois": "david dubois", "dubois": "david dubois",
  "eva": "eva meilhac", "eva meilhac": "eva meilhac", "meilhac": "eva meilhac",
  "gwenael derouet": "gwenael", "derouet": "gwenael",
  "aurelie": "aurelie briquet", "aurelie briquet": "aurelie briquet", "briquet": "aurelie briquet",
  "selim": "selim kouay", "selim kouay": "selim kouay", "kouay": "selim kouay",
  "mehdi": "mehdi bouffessil", "mehdi bouffessil": "mehdi bouffessil", "bouffessil": "mehdi bouffessil",
  "mehdi mestiri": "mehdi mestiri", "mestiri": "mehdi mestiri",
  "sarah": "sarah amroune", "sarah amroune": "sarah amroune", "amroune": "sarah amroune",
  "sara": "sara benabid", "sara benabid": "sara benabid", "benabid": "sara benabid",
  "mohamed": "mohamed bouaksa", "mohamed bouaksa": "mohamed bouaksa", "bouaksa": "mohamed bouaksa",
  "youcef": "youcef amrane", "youcef amran": "youcef amrane", "youcef amrane": "youcef amrane", "amran": "youcef amrane", "amrane": "youcef amrane", "yamraneownertechnologycom": "youcef amrane"
};


export const getCanonicalKey = (rawName) => { const n = normalizeSalesKey(rawName); return NAME_VARIANTS_TO_CANONICAL[n] || n; };
