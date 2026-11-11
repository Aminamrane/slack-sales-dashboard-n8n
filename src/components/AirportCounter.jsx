// Compteur « tableau d'aéroport » (chiffres à volets) du Suivi des ventes, partagé avec le board Opti'Lex
// (dev 29/10/2026 : « combien d'onboardings il reste, à la manière du suivi des ventes »). Code déplacé de
// pages/Leaderboard.jsx sans changement de rendu ; `scale` réduit l'ensemble (1 = taille du Suivi des ventes).
import { useEffect, useState } from "react";
import airBg from "../assets/Air.png";
import airportFont from "../assets/Airport.otf";

const FONT_FACE = `@font-face { font-family: 'Airport'; src: url('${airportFont}') format('opentype'); font-weight: normal; font-style: normal; font-display: swap; }`;

function AirportFlipDigit({ targetDigit, delay = 0, duration = 1500, darkMode, scale = 1 }) {
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
      width: `${38 * scale}px`,
      height: `${50 * scale}px`,
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
        fontSize: `${38 * scale}px`,
        fontWeight: 500,
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

export function AirportKPI({ label, value, minDigits = 3, darkMode, suffix, scale = 1 }) {
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
      <style>{FONT_FACE}</style>
      {label && (
        <span style={{
          fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
          fontWeight: 500,
          fontSize: '15px',
          color: '#a8a39b',
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
                scale={scale}
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
                fontSize: '38px', fontWeight: 500,
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

