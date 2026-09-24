# Mockup `/book` — copie isolée de la landing V2

Maquette de `https://webinaire.ownertechnology.com/v2`, destinée à être servie
sur `https://webinaire.ownertechnology.com/book`, **sans pouvoir toucher ni la
cohorte en cours ni les séquences en cours**.

Visuellement, c'est la V2 à l'identique. Fonctionnellement, c'est une coquille :
rien de ce qu'un visiteur y fait ne sort de sa machine.

---

## Pourquoi une copie « bête » aurait cassé des choses

Ce n'est pas théorique : la V2 réelle porte trois écritures vers la production.
Un simple copier-coller de la page les aurait embarquées.

| Vecteur | Ce qu'il fait | Conséquence d'une copie non traitée |
|---|---|---|
| `POST /api/lead` | Crée le lead avec `webinarId: ACTIVE_WEBINAR` et `source: "landing"` | **Injecte un faux lead dans la cohorte en cours**, qui part ensuite dans la séquence de relance |
| Plausible (`plausible.ownertechnology.com`) | Compte visites et events `CTA Clicked` | Gonfle les visiteurs de la V2, donc **fausse le KPI « Taux conversion LP · V1 vs V2 »** du dashboard CEO (`lpComparison`) |
| Pixel Meta (`facebook.com/tr?id=1503207638200405`) | PageView + conversions | Pollue les conversions et les audiences Meta Ads |

Le premier est le plus grave : au moment de la construction de ce mockup, la
séquence post-webinaire de `webinar-2026-09-07` était en cours et la cohorte
`webinar-2026-09-21` en remplissage.

## Comment ils sont neutralisés

Quatre barrières indépendantes, du plus structurel au plus défensif. Aucune ne
repose sur la précédente.

1. **Il n'y a plus de bundle.** Le générateur retire toutes les balises
   `<script>` de la page. Les trois appels vivaient dans le JavaScript de Next,
   qui n'existe plus dans le fichier servi. Le HTML conservé est le rendu
   pré-calculé par Next : la page s'affiche complète sans la moindre ligne de JS
   d'origine (vérifié : aucun élément en `opacity:0` en attente d'hydratation).
2. **Le serveur refuse d'écrire.** nginx renvoie `405` sur tout ce qui n'est pas
   `GET`/`HEAD`, et ne fait aucun `proxy_pass` : il n'a aucun chemin vers l'API.
3. **Le navigateur refuse de sortir.** L'en-tête `Content-Security-Policy` porte
   `connect-src 'none'` et `form-action 'none'` : tout `fetch`, `XHR`,
   `sendBeacon` ou soumission de formulaire est bloqué par le navigateur
   lui-même, quoi que contienne la page.
4. **Le runtime est verrouillé.** `mockup.js` remplace `fetch`, `XMLHttpRequest`,
   `sendBeacon`, `plausible()` et `fbq()` par des versions qui refusent et
   tracent. Les appels interceptés sont consultables dans
   `window.__mockupBlocked`.

Deux garde-fous automatiques refusent de livrer une page sale : `build.py`
échoue si un vecteur subsiste dans le HTML final, et le `Dockerfile` refait la
vérification au build de l'image (une image ne peut donc pas être fabriquée à
partir d'un `site/` généré par une version antérieure du script).

Le formulaire reste utilisable : il valide les champs et affiche une
confirmation locale, en indiquant clairement que rien n'a été envoyé.

## Ce qui sort encore de la page

Exactement deux liens, tels quels dans l'original, et purement navigationnels :
`ownertechnology.com/mentions-legales` et `ownertechnology.com/conditions-generales-de-vente`.
Ce sont des `<a href>` vers le site vitrine — aucune donnée n'y transite.

---

## Utilisation

### En une commande (recommandé)

```bash
cd mockups/webinaire-book
bash tools/refresh.sh
```

Génère `site/`, construit l'image, (re)crée le conteneur, et vérifie le HTML
réellement servi sur `http://localhost:8088/book/`. C'est la même commande
pour un premier lancement après clone ou pour republier une retouche — voir
« Après toute retouche : une seule commande » ci-dessous pour le détail et le
piège qu'elle évite.

### Étape par étape, si besoin

```bash
python3 tools/build.py      # Aspire la V2 en ligne, neutralise, écrit site/.
                             # `site/` est un artefact généré, ignoré par git.
```

```bash
docker compose up -d --build      # plugin compose v2
```

Sans le plugin `compose` (cas de cette machine) :

```bash
docker rm -f webinaire-book-mockup 2>/dev/null
docker build -t webinaire-book-mockup:latest .
docker run -d --name webinaire-book-mockup \
  -p 127.0.0.1:8088:8080 \
  --read-only \
  --tmpfs /var/cache/nginx:size=16m --tmpfs /var/run:size=1m --tmpfs /tmp:size=8m \
  --security-opt no-new-privileges:true --cap-drop ALL \
  --memory 128m --pids-limit 64 \
  webinaire-book-mockup:latest
```

→ **http://localhost:8088/book/**

Arrêt : `docker compose down`, ou `docker rm -f webinaire-book-mockup`.

⚠️ Les deux étapes vont **toujours ensemble** : `python3 tools/build.py` seul
ne republie rien, il ne fait qu'écrire des fichiers qu'aucune image n'a encore
lus (cf. ticket #51 ci-dessous). Préférez `refresh.sh`.

### Cloisonnement du conteneur

Réseau dédié, système de fichiers en lecture seule, aucune capacité Linux,
aucun volume vers les données de production, aucune variable d'environnement,
aucun secret. nginx tourne en utilisateur non privilégié (uid 101) sur le port
8080. Le port est publié sur `127.0.0.1` uniquement : rien n'est exposé au
réseau local tant que vous ne le décidez pas.

Le conteneur ne sait faire qu'une chose : renvoyer des octets déjà présents
dans son image.

---

## Après toute retouche : une seule commande

```bash
bash tools/refresh.sh
```

⚠️ **Ne lance jamais `python3 tools/build.py` seul et ne t'arrête pas là.**
`site/` n'est qu'un fichier sur disque — la page servie vient d'une **image
Docker** figée au moment de son `docker build` (`COPY site/ → …/html/`).
Modifier `site/` sans reconstruire l'image et recréer le conteneur ne change
**rien** à ce qu'un navigateur affiche. C'est exactement ce qui s'est produit
sur le ticket Bot IA #51 (changement de titre) : `site/index.html` était bon,
la confirmation était sincère, mais la page servie a mis 2h34 à se mettre à
jour parce que le conteneur n'avait jamais été recréé.

`refresh.sh` fait les trois étapes dans l'ordre — régénère `site/`, reconstruit
l'image et recrée le conteneur (`docker compose`, ou l'équivalent en
`docker build`/`docker run` si le plugin n'est pas installé), puis **vérifie
le HTML réellement servi** — et s'arrête net (`set -e`) à la première étape en
échec.

**La vérification se fait sur `http://localhost:8088/book/` — le conteneur
local — et nulle part ailleurs.** En particulier,
`https://webinaire.ownertechnology.com/book` n'est **pas déployée** (404
constaté) : ce n'est ni un signe d'échec de ta retouche, ni une adresse à
consulter pour la vérifier (cf. § Mise en ligne ci-dessous). `refresh.sh`
l'affiche explicitement pour ne pas laisser le doute s'installer.

---

## Mise en ligne sur `webinaire.ownertechnology.com/book`

**Cette étape n'a pas été faite** : elle demande un accès au serveur de la
landing, qui n'est pas dans ce dépôt. Voici ce qu'il reste à appliquer.

Sur le serveur qui héberge la landing, faire tourner le conteneur, puis ajouter
au vhost existant :

```nginx
# Maquette isolée — ne touche pas l'application Next.
location ^~ /book/ {
    proxy_pass       http://127.0.0.1:8088/book/;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location = /book {
    return 301 /book/;
}
```

Le `^~` est important : il garantit que ce préfixe l'emporte sur les locations
en expression régulière du vhost, sans quoi les assets du mockup seraient
récupérés par une règle de cache existante (c'est précisément le piège
rencontré ici, cf. `nginx.conf`).

Points à connaître avant de publier :

- `/book` n'existe pas aujourd'hui (404 vérifié) : aucune route n'est écrasée.
- L'application Next n'est pas touchée — le mockup vit dans un autre processus.
- Les visites de `/book` apparaîtront dans les logs nginx de production. Elles
  ne remontent dans aucun tableau de bord : sans script Plausible, Plausible ne
  voit rien.
- La page est marquée `noindex, nofollow` et sert un `robots.txt` interdisant
  tout, pour ne pas concurrencer la vraie landing en référencement.

---

## Fichiers

```
mockups/webinaire-book/
├── README.md
├── Dockerfile              image nginx non privilégiée + vérification au build
├── docker-compose.yml      conteneur cloisonné
├── nginx.conf              routage /book, CSP, refus des écritures
├── tools/
│   ├── build.py            aspiration + neutralisation + vérification
│   ├── refresh.sh          LA commande à lancer après toute retouche (build + docker + vérif)
│   ├── mockup.css          bandeau « Mockup » et confirmation locale
│   └── mockup.js           verrou réseau + interactions locales
└── site/                   (généré, non versionné)
```
