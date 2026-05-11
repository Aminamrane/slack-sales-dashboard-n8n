import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Versionner la clé permet de re-déclencher le tuto pour tous les setters
// après une refonte majeure du tutoriel (incrémenter _v2, _v3, etc.).
const STORAGE_KEY_PREFIX = 'owner_setter_onboarding_dismissed_v1_';

const SLIDES = [
  {
    emoji: '👋',
    title: 'Bienvenue dans ton espace setter',
    body: "Voici ta vue en 5 étapes rapides — moins de 30 secondes. Tu peux passer ce tuto à tout moment en haut à droite.",
  },
  {
    emoji: '🎯',
    title: 'Onglet « Nouveau lead »',
    body: "Tes cold calls + les leads de ton équipe non traités après 24h ouvrées (samedi/dimanche exclus). C'est ton point de départ chaque jour.",
  },
  {
    emoji: '📞',
    title: 'Onglet « Répondeurs »',
    body: "Les leads de ton équipe qui n'ont pas décroché. Sur chaque lead, 4 actions : Marquer appelé, Placer R1, Placer R2, Disqualifier.",
  },
  {
    emoji: '📅',
    title: 'Onglets « R1 placés / R2 placés / Signés »',
    body: "Lecture seule — tu y suis les RDV que tu as placés. Le sales prend le relais à partir du R2 et tu vois quand le lead a signé.",
  },
  {
    emoji: '🔍',
    title: 'Astuce filtre',
    body: "Dans l'onglet Répondeurs, tu peux filtrer par sales propriétaire (par exemple les répondeurs de Yohan uniquement) via le panneau Filtres à gauche.",
  },
];

export default function SetterOnboarding({ userId, darkMode = false }) {
  const [open, setOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const storageKey = userId ? `${STORAGE_KEY_PREFIX}${userId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    if (!localStorage.getItem(storageKey)) {
      // Petit delay pour que la page sous-jacente render avant l'overlay
      const t = setTimeout(() => setOpen(true), 450);
      return () => clearTimeout(t);
    }
  }, [storageKey]);

  const dismiss = () => {
    if (storageKey) localStorage.setItem(storageKey, new Date().toISOString());
    setOpen(false);
  };

  const next = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (currentSlide > 0) setCurrentSlide((s) => s - 1);
  };

  if (!open) return null;

  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;
  const isFirst = currentSlide === 0;

  const C = {
    bg: darkMode ? '#16171e' : '#ffffff',
    text: darkMode ? '#e4e4e7' : '#0a0a0a',
    muted: darkMode ? '#a1a1aa' : '#71717a',
    border: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    accent: '#6366f1',
    softHover: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="setter-onboarding-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <motion.div
          initial={{ scale: 0.94, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, y: 10, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            background: C.bg,
            color: C.text,
            maxWidth: 520,
            width: '100%',
            borderRadius: 18,
            padding: '40px 36px 24px',
            boxShadow: darkMode
              ? '0 20px 60px rgba(0,0,0,0.5)'
              : '0 20px 60px rgba(0,0,0,0.25)',
            position: 'relative',
            fontFamily: 'inherit',
          }}
        >
          {/* Skip top-right */}
          <button
            onClick={dismiss}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: 'transparent',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              color: C.muted,
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: 8,
              transition: 'all 0.15s',
              fontFamily: 'inherit',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = C.text;
              e.currentTarget.style.background = C.softHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = C.muted;
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Passer le tuto
          </button>

          {/* Slide content (key re-mount pour animer la transition) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              style={{ minHeight: 200, paddingTop: 8 }}
            >
              <div style={{ fontSize: 42, marginBottom: 14, lineHeight: 1 }}>
                {slide.emoji}
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  margin: '0 0 12px',
                  letterSpacing: '-0.02em',
                  color: C.text,
                }}
              >
                {slide.title}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: C.muted,
                  margin: 0,
                }}
              >
                {slide.body}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dots indicators (cliquables pour navigation directe) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              margin: '24px 0 18px',
            }}
          >
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                aria-label={`Aller à l'étape ${i + 1}`}
                style={{
                  width: i === currentSlide ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === currentSlide ? C.accent : C.border,
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0,
                  transition: 'width 0.25s ease, background 0.25s ease',
                }}
              />
            ))}
          </div>

          {/* Footer : prev / next */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <button
              onClick={prev}
              disabled={isFirst}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                color: isFirst ? 'transparent' : C.muted,
                cursor: isFirst ? 'default' : 'pointer',
                padding: '10px 14px',
                borderRadius: 10,
                transition: 'color 0.15s, background 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (!isFirst) {
                  e.currentTarget.style.color = C.text;
                  e.currentTarget.style.background = C.softHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isFirst) {
                  e.currentTarget.style.color = C.muted;
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              ← Précédent
            </button>

            <button
              onClick={next}
              style={{
                background: C.accent,
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                color: '#ffffff',
                cursor: 'pointer',
                padding: '11px 22px',
                borderRadius: 10,
                transition: 'all 0.18s',
                fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                letterSpacing: '-0.005em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow =
                  '0 6px 20px rgba(99,102,241,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  '0 4px 14px rgba(99,102,241,0.3)';
              }}
            >
              {isLast ? "C'est compris ✓" : 'Suivant →'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
