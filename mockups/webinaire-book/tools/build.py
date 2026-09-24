#!/usr/bin/env python3
"""
Génère le mockup ISOLÉ de la landing V2 dans `site/`.

Aspire https://webinaire.ownertechnology.com/v2 (HTML prerendered + CSS +
images + fonts), puis neutralise TOUT ce qui écrit vers la production avant
d'écrire le résultat sur disque. Le site produit est 100 % statique et inerte :
aucune requête ne sort vers l'infra Owner.

Ce qui est retiré, et pourquoi (cf. README) :

  1. `POST /api/lead`   — créait un lead rattaché à `ACTIVE_WEBINAR`, ce qui
                          l'injecte dans la cohorte en cours ET déclenche la
                          séquence de relance. C'est LE vecteur à tuer.
  2. Plausible          — `plausible.ownertechnology.com`. Ses visites
                          alimentent `lpComparison` côté /admin, qui remonte
                          dans le KPI « Taux conversion LP · V1 vs V2 » du
                          dashboard CEO. Une visite du mockup fausserait le
                          dénominateur de la V2.
  3. Pixel Meta         — `facebook.com/tr?id=...`. Pollue les conversions et
                          les audiences Meta Ads.

La neutralisation est structurelle, pas cosmétique : on supprime les balises
<script>, donc le bundle Next qui portait ces trois appels n'existe plus dans
la page. Le <form> d'origine n'ayant pas d'attribut `action`, il devient inerte
de lui-même ; on ajoute malgré tout un garde-fou explicite (`onsubmit` + JS).

Usage :  python3 tools/build.py
"""

import re
import shutil
import sys
import urllib.request
from pathlib import Path

SRC = "https://webinaire.ownertechnology.com/v2"
BASE = "https://webinaire.ownertechnology.com"
CLOUDFRONT_PAUL = (
    "https://d1yei2z3i6k35z.cloudfront.net/14020886/69ef7339b55386.73306775_2.png"
)

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"

# Images Next à rapatrier : nom distant -> nom local, avec la largeur voulue.
IMAGES = {
    "v2-hero-ambulance.jpg": 1920,
    "logo-white.png": 256,
    "maitre-bouchared.png": 640,
}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "owner-mockup-build/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()


def write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"  + {path.relative_to(ROOT)}  ({len(data):,} o)")


# Retouches de contenu appliquées au seul mockup /book (ticket Bot IA #51).
# Format : (chaîne attendue dans le HTML de la V2, remplacement, libellé).
TWEAKS = [
    (
        'Êtes-vous prêt à optimiser<br class="hidden sm:block"/>'
        "votre rémunération de dirigeant\u00a0?",
        "test_1",
        "titre H1 du hero",
    ),
]


def main() -> int:
    print(f"→ Aspiration de {SRC}")
    html = get(SRC).decode("utf-8")
    print(f"  HTML source : {len(html):,} o")

    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir(parents=True)

    # ── 1. Assets ────────────────────────────────────────────────────────
    print("→ Assets")
    css_files = sorted(set(re.findall(r"/_next/static/chunks/([\w.~-]+\.css)", html)))
    for name in css_files:
        css = get(f"{BASE}/_next/static/chunks/{name}").decode("utf-8")
        # Les url(../media/…) restent valides : site/assets/../media == site/media.
        # Les chemins absolus, eux, casseraient dès que le site est servi sous
        # un préfixe (/book/…), donc on les rend relatifs au fichier CSS.
        css = css.replace("url(/fonts/", "url(../fonts/")
        css = css.replace("url(/hero-bg", "url(../hero-bg")
        write(SITE / "assets" / name, css.encode("utf-8"))

    for name, width in IMAGES.items():
        data = get(f"{BASE}/_next/image?url=%2F{name}&w={width}&q=75")
        write(SITE / "assets" / name, data)
    write(SITE / "assets" / "paul.png", get(CLOUDFRONT_PAUL))

    for name in sorted(set(re.findall(r"url\(\.\./media/([^)]+)\)", "".join(
        (SITE / "assets" / f).read_text(encoding="utf-8") for f in css_files
    )))):
        write(SITE / "media" / name, get(f"{BASE}/_next/static/media/{name}"))

    write(SITE / "fonts" / "DSEG7Classic-Bold.woff2",
          get(f"{BASE}/fonts/DSEG7Classic-Bold.woff2"))
    write(SITE / "hero-bg.png", get(f"{BASE}/hero-bg.png"))
    write(SITE / "hero-bg-mobile.jpg", get(f"{BASE}/hero-bg-mobile.jpg"))

    # ── 2. Neutralisation ────────────────────────────────────────────────
    print("→ Neutralisation")

    def drop(pattern: str, label: str, flags=re.S | re.I) -> None:
        nonlocal html
        html, n = re.subn(pattern, "", html, flags=flags)
        print(f"  - {label} : {n}")

    drop(r"<script\b[^>]*>.*?</script>", "balises <script> (Next, Plausible, RSC)")
    drop(r"<script\b[^>]*/>", "scripts auto-fermants")
    drop(r"<noscript>.*?</noscript>", "noscript (pixel Meta)")
    drop(r'<link\b[^>]*\bas="script"[^>]*>', "preload de scripts")
    drop(r'\s(?:imageSrcSet|imageSizes|srcSet|srcset)="[^"]*"', "srcset Next")
    # Plausible « tagged events » : les tags ne sont pas des attributs, ce sont
    # des tokens GLISSÉS DANS class= (class="v2-btn-cta plausible-event-name=…").
    # Sans le script ils sont inoffensifs, mais on les retire pour qu'aucune
    # copie de ce balisage ne réactive le tracking si le script revenait.
    drop(r'\splausible-event-[\w-]+=[^\s"]+', "tags plausible dans class=")

    # ── 3. Réécriture des chemins en RELATIF ─────────────────────────────
    # Relatif = le mockup marche sous /book/, à la racine, ou en file://.
    html = re.sub(r"/_next/static/chunks/([\w.~-]+\.css)", r"assets/\1", html)
    html = re.sub(r"/_next/static/media/([\w.~-]+)", r"media/\1", html)
    html = re.sub(
        r"/_next/image\?url=%2F([\w.%-]+?)(?:&amp;|&)w=\d+(?:&amp;|&)q=\d+",
        lambda m: "assets/" + m.group(1),
        html,
    )
    # Le portrait hébergé sur CloudFront transite par l'optimiseur Next, qui
    # ré-encode l'URL distante dans son paramètre `url=` : la chaîne brute
    # n'apparaît donc jamais telle quelle dans le HTML. On traite les deux formes.
    html = re.sub(
        r"/_next/image\?url=https%3A%2F%2Fd1yei2z3i6k35z[^\"'\s>]*",
        "assets/paul.png",
        html,
    )
    html = html.replace(CLOUDFRONT_PAUL, "assets/paul.png")

    # ── 4. Garde-fou explicite sur les formulaires ───────────────────────
    html, n_forms = re.subn(
        r"<form\b", '<form data-mockup-inert="1" onsubmit="return false"', html
    )
    print(f"  ✓ {n_forms} formulaire(s) rendus inertes")

    html = html.replace(
        "<title>",
        "<title>[MOCKUP] ",
        1,
    ) if "<title>" in html else html

    html = html.replace(
        "</head>",
        '<link rel="stylesheet" href="mockup.css"></head>',
        1,
    )
    html = html.replace(
        "</body>",
        '<script src="mockup.js"></script></body>',
        1,
    )

    # ── 4 bis. Personnalisations propres à /book ─────────────────────────
    # La maquette est régénérée depuis la V2 en ligne : les retouches de
    # contenu demandées pour /book doivent vivre ICI, sinon un rebuild les
    # écrase. Elles ne touchent que le HTML écrit dans site/ — jamais la V2.
    print("→ Personnalisations /book")
    for old, new, label in TWEAKS:
        if old not in html:
            print(f"  !! ÉCHEC : retouche introuvable ({label})", file=sys.stderr)
            return 1
        html = html.replace(old, new, 1)
        print(f"  ✓ {label}")

    # ── 5. Vérification du livrable ──────────────────────────────────────
    # Contrôlée sur le HTML FINAL, pas sur un état intermédiaire : c'est ce
    # fichier-là qui sera servi. Toute trace d'un vecteur d'écriture ou d'un
    # chemin pointant encore vers la prod fait échouer le build.
    print("→ Vérification")
    for needle, why in [
        ("plausible", "référence Plausible"),
        ("facebook.com/tr", "pixel Meta"),
        ("fbq(", "pixel Meta (fbq)"),
        ("/api/lead", "endpoint de création de lead"),
        ("/_next/", "chemin Next vers la prod"),
        ("<script src=\"/", "script distant"),
        ("webinaire.ownertechnology.com", "appel au domaine de prod"),
    ]:
        if needle in html:
            print(f"  !! ÉCHEC : {why} encore présent ({needle!r})", file=sys.stderr)
            return 1
    print("  ✓ aucun appel sortant vers l'infra Owner")

    write(SITE / "index.html", html.encode("utf-8"))
    for extra in ("mockup.css", "mockup.js"):
        shutil.copy(ROOT / "tools" / extra, SITE / extra)
        print(f"  + site/{extra}")

    print(f"\n✓ Mockup généré dans {SITE}")
    print("  Servir :  docker compose up -d   →  http://localhost:8088/book/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
