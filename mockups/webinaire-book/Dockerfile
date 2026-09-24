# Mockup isolé de la landing V2, servi sous /book/.
#
# Image volontairement minimale : nginx + des fichiers statiques, rien d'autre.
# Pas d'applicatif, pas de client base de données, aucun secret, aucune variable
# d'environnement pointant vers la production. Le conteneur ne peut rien écrire
# nulle part — il ne sait que renvoyer des octets déjà présents dans l'image.
#
# Base « unprivileged » : nginx tourne sous l'utilisateur nginx (uid 101) et
# écoute sur 8080. Cela évite l'entrypoint root de l'image officielle, qui
# tente un chown au démarrage et rend le conteneur incompatible avec
# `cap_drop: ALL` + `read_only`. Ici : aucune capacité requise, aucun root.
#
# Prérequis : `python3 tools/build.py` a généré `site/`.

FROM nginxinc/nginx-unprivileged:1.27-alpine

LABEL org.opencontainers.image.title="webinaire-book-mockup"
LABEL org.opencontainers.image.description="Maquette isolée de /v2 servie sur /book — aucune écriture vers la production"

USER root

# La conf par défaut est remplacée : pas de vhost résiduel.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/mockup.conf
COPY site/ /usr/share/nginx/html/

# Filet de sécurité à la construction : si un vecteur d'écriture réapparaissait
# dans les sources, l'image ne se construirait pas. La vérification est faite
# ici aussi, et pas seulement dans build.py, pour qu'une image ne puisse pas
# être fabriquée à partir d'un `site/` généré par une version antérieure.
RUN set -eu; \
    for pattern in 'plausible' 'facebook.com/tr' '/api/lead' '/_next/'; do \
        if grep -rqF "$pattern" /usr/share/nginx/html/index.html; then \
            echo "REFUS : '$pattern' présent dans le mockup" >&2; \
            exit 1; \
        fi; \
    done; \
    echo "Mockup vérifié : aucun appel vers l'infra de production."

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/book/ || exit 1
