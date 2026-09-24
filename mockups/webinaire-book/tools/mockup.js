/*
 * Mockup /book — comportement local uniquement.
 *
 * Deux rôles :
 *   1. Rendre la page utilisable (les CTA et le formulaire faisaient appel au
 *      bundle Next, qui a été retiré à la génération).
 *   2. Servir de SECONDE barrière réseau. La première est structurelle (plus
 *      aucun <script> d'origine dans la page) ; celle-ci verrouille le runtime
 *      pour que même un copier-coller malheureux dans cette page ne puisse pas
 *      joindre l'API, Plausible ou Meta.
 *
 * Rien ici n'écrit sur le réseau, ni dans un stockage partagé.
 */
(function () {
  'use strict';

  // ── 1. Verrou réseau ────────────────────────────────────────────────────
  // On neutralise les sorties plutôt que de les laisser échouer en silence :
  // un appel bloqué est tracé en console, ce qui rend l'isolation vérifiable.
  var blocked = [];

  function refuse(kind, target) {
    blocked.push({ kind: kind, target: String(target) });
    console.warn('[mockup /book] sortie réseau bloquée —', kind, String(target));
  }

  window.fetch = function (input) {
    refuse('fetch', (input && input.url) || input);
    return Promise.reject(new Error('mockup isolé : réseau désactivé'));
  };

  var OpenXHR = window.XMLHttpRequest;
  if (OpenXHR) {
    var open = OpenXHR.prototype.open;
    OpenXHR.prototype.open = function (method, url) {
      refuse('xhr', method + ' ' + url);
      // On laisse l'objet exister mais on le pointe dans le vide.
      return open.call(this, method, 'about:blank');
    };
  }

  if (navigator.sendBeacon) {
    navigator.sendBeacon = function (url) {
      refuse('sendBeacon', url);
      return false;
    };
  }

  // Plausible pousse ses events dans une file tant que le script n'est pas là.
  // On l'absorbe pour qu'une file résiduelle ne parte jamais.
  window.plausible = function () { refuse('plausible', arguments[0]); };
  window.fbq = function () { refuse('meta-pixel', arguments[0]); };

  window.__mockupBlocked = blocked;

  // ── 2. Bandeau ──────────────────────────────────────────────────────────
  function banner() {
    var el = document.createElement('div');
    el.className = 'otmk-banner';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<strong>Mockup</strong>' +
      '<span>copie isolée de la page /v2 — aucune inscription n’est enregistrée, ' +
      'aucune statistique n’est comptée</span>';

    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Masquer';
    close.addEventListener('click', function () {
      el.remove();
      document.body.classList.remove('otmk-shifted');
    });
    el.appendChild(close);

    document.body.appendChild(el);
    document.body.classList.add('otmk-shifted');
    document.body.style.setProperty('--otmk-banner-h', el.offsetHeight + 'px');

    window.addEventListener('resize', function () {
      if (el.isConnected) {
        document.body.style.setProperty('--otmk-banner-h', el.offsetHeight + 'px');
      }
    });
  }

  // ── 3. Formulaires : confirmation locale, zéro envoi ────────────────────
  function forms() {
    var list = document.querySelectorAll('form[data-mockup-inert]');
    Array.prototype.forEach.call(list, function (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        if (!form.reportValidity || form.reportValidity()) {
          var done = form.querySelector('.otmk-fakeconfirm');
          if (!done) {
            done = document.createElement('div');
            done.className = 'otmk-fakeconfirm';
            done.innerHTML =
              '<b>Inscription simulée</b>' +
              'Rien n’a été envoyé : ni lead créé, ni séquence déclenchée, ' +
              'ni cohorte touchée. Cette page est une maquette.';
            form.appendChild(done);
          }
          done.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return false;
      });
    });
  }

  // ── 4. CTA « attentes » → renvoient vers le formulaire ──────────────────
  // Dans la page d'origine ces boutons ouvrent le modal d'inscription. Sans le
  // bundle Next ils seraient inertes : on les recâble sur le premier
  // formulaire visible, ce qui reproduit l'intention sans aucune dépendance.
  function ctas() {
    var target = null;
    var all = document.querySelectorAll('form[data-mockup-inert]');
    Array.prototype.forEach.call(all, function (f) {
      if (!target && f.getClientRects().length) target = f;
    });
    if (!target) return;

    var buttons = document.querySelectorAll('button[type="button"]');
    Array.prototype.forEach.call(buttons, function (btn) {
      if (btn.closest('.otmk-banner')) return;
      btn.addEventListener('click', function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var first = target.querySelector('input:not([tabindex="-1"])');
        if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 420);
      });
    });
  }

  function init() {
    banner();
    forms();
    ctas();
    console.info(
      '[mockup /book] page isolée — réseau verrouillé. ' +
      'window.__mockupBlocked liste les appels interceptés.'
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
