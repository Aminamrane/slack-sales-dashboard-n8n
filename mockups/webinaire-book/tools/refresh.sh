#!/usr/bin/env bash
# tools/refresh.sh — LA seule commande à lancer après toute retouche à /book.
#
# Pourquoi ce script existe (ticket #51) : `python3 tools/build.py` régénère
# `site/` sur DISQUE, mais l'image Docker qui sert la page est figée au moment
# de son `docker build` (COPY site/ → /usr/share/nginx/html/). Modifier
# `site/` après coup ne change RIEN à ce qui est réellement servi tant que
# l'image n'a pas été reconstruite et le conteneur recréé. Le ticket #51 a été
# marqué `traite` après la seule régénération de `site/` — la page servie,
# elle, montrait encore l'ancien titre 2h34 plus tard.
#
# Ce script fait les TROIS étapes d'un coup, dans le bon ordre, pour qu'il
# devienne impossible d'en oublier une :
#   1. régénère site/               (python3 tools/build.py)
#   2. reconstruit l'image et recrée le conteneur (docker compose, ou le
#      docker build/run équivalent si le plugin compose n'est pas installé)
#   3. VÉRIFIE ce qui est réellement servi, à la bonne adresse
#
# ⚠️ L'adresse à vérifier est http://localhost:8088/book/ — le CONTENEUR
# LOCAL. PAS https://webinaire.ownertechnology.com/book : cette page n'est pas
# déployée côté serveur de la landing (404 constaté, ticket distinct, voir
# README.md « Mise en ligne »). Consulter l'URL de production ne peut QUE
# induire en erreur ici — elle ne reflète aucune retouche faite sur /book,
# ni maintenant ni tant que la mise en ligne n'a pas eu lieu.
#
# Usage :  bash tools/refresh.sh
# Sort en erreur (set -e) à la première étape qui échoue — jamais de `traite`
# sur un échec silencieux.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."   # toujours depuis mockups/webinaire-book/

echo "→ [1/3] Régénération de site/"
python3 tools/build.py

echo
echo "→ [2/3] Reconstruction de l'image et recréation du conteneur"
if docker compose version >/dev/null 2>&1; then
  docker compose up -d --build
else
  # Plugin `docker compose` absent (cas de cette machine au moment de l'écriture
  # de ce script) : mêmes réglages que docker-compose.yml, passés en ligne de
  # commande. Toute modification de docker-compose.yml doit être répercutée ici.
  docker rm -f webinaire-book-mockup >/dev/null 2>&1 || true
  docker build -t webinaire-book-mockup:latest .
  docker run -d --name webinaire-book-mockup \
    -p 127.0.0.1:8088:8080 \
    --read-only \
    --tmpfs /var/cache/nginx:size=16m --tmpfs /var/run:size=1m --tmpfs /tmp:size=8m \
    --security-opt no-new-privileges:true --cap-drop ALL \
    --memory 128m --pids-limit 64 \
    webinaire-book-mockup:latest >/dev/null
fi

echo
echo "→ [3/3] Vérification du contenu RÉELLEMENT SERVI (pas du fichier source)"
for _ in $(seq 1 15); do
  if curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:8088/book/ 2>/dev/null; then break; fi
  sleep 1
done

served="$(curl -fsS --max-time 10 http://127.0.0.1:8088/book/)"
h1="$(printf '%s' "$served" | grep -oE '<h1[^>]*>.{0,140}' | head -1)"

echo
echo "  Adresse vérifiée : http://localhost:8088/book/  (le conteneur local)"
echo "  H1 servi          : ${h1:-<introuvable>}"
echo
echo "  ⚠️  https://webinaire.ownertechnology.com/book n'est PAS déployée (404) :"
echo "      ne t'y fie jamais pour vérifier une retouche /book."
echo
echo "✓ site/, image et conteneur sont synchronisés — /book sert la dernière version."
