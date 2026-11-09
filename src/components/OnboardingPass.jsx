// Pièces de l'onboarding « comme un jeu » (dev 29/10/2026) : le passe « Onboardé » posé sur le client, le
// code-barres des billets, et la pluie de confettis de la clôture. Partagées par le board et le parcours.
import { useEffect, useId, useMemo, useRef } from "react";

// ── Passe « Onboardé » : un ticket vert à encoches, comme les passes d'un portefeuille. ─────────────────
const PASS_SHAPE = "M4 1h12a3 3 0 0 1 3 3v6.2a2.3 2.3 0 0 0 0 4.6V19a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3v-4.2a2.3 2.3 0 0 0 0-4.6V4a3 3 0 0 1 3-3Z";
export function OnboardedPass({ size = 16 }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg className="ob-pass-svg" width={size} height={Math.round(size * 1.15)} viewBox="0 0 20 23" aria-hidden="true">
      <defs>
        <linearGradient id={`pg-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34b37c" /><stop offset="1" stopColor="#13704a" /></linearGradient>
        <clipPath id={`pc-${uid}`}><path d={PASS_SHAPE} /></clipPath>
      </defs>
      {/* Ombre dessinée (pas de filtre CSS : le passe est répété sur des centaines de lignes). */}
      <path d={PASS_SHAPE} transform="translate(0 .9)" fill="#0f5c3c" opacity=".28" />
      <path d={PASS_SHAPE} fill={`url(#pg-${uid})`} />
      <g clipPath={`url(#pc-${uid})`}><rect className="ob-pass-glint" x="-14" y="-4" width="7" height="32" fill="#fff" opacity=".45" transform="rotate(24 10 11)" /></g>
      <path d="M5.2 12.5h9.6" stroke="#fff" strokeOpacity=".5" strokeWidth="1" strokeDasharray="1.2 1.5" strokeLinecap="round" />
      <path d="M6.3 6.6l2.2 2.2 4.9-4.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 16.2v2.6M7.8 16.2v2.6M9 16.2v2.6M10.9 16.2v2.6M12.4 16.2v2.6M13.8 16.2v2.6" stroke="#fff" strokeOpacity=".7" strokeWidth=".8" />
    </svg>
  );
}

// ── Tampon « Onboardé » (dev 29/10/2026 : « il faut un meilleur tampon ») : un sceau encreur rond, double anneau,
// « ONBOARDING » en arc, bandeau central, date en bas, étoiles ; l'encre est usée par une texture fixe (aucune
// animation permanente), et le tampon se fond dans le papier (multiplication).
export function OnboardedSeal({ date, size = 96, ink = "#2f7a4f" }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const day = (() => {
    const m = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
  })();
  return (
    <svg className="ob-seal" width={size} height={size} viewBox="0 0 120 120" aria-label={`Onboardé${day ? ` le ${day}` : ""}`} role="img">
      <defs>
        <path id={`st-${uid}`} d="M20 60a40 40 0 0 1 80 0" />
        <path id={`sb-${uid}`} d="M17 60a43 43 0 0 0 86 0" />
        <filter id={`si-${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="11" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -9 0 0 0 7.4" result="wear" />
          <feComposite in="SourceGraphic" in2="wear" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#si-${uid})`} fill="none" stroke={ink}>
        <circle cx="60" cy="60" r="56" strokeWidth="4.2" />
        <circle cx="60" cy="60" r="49.5" strokeWidth="1.4" />
        <circle cx="60" cy="60" r="31" strokeWidth="1.4" />
        <text fill={ink} stroke="none" fontSize="10.5" fontWeight="800" letterSpacing="3" fontFamily="Inter, -apple-system, 'Segoe UI', sans-serif">
          <textPath href={`#st-${uid}`} startOffset="50%" textAnchor="middle">ONBOARDING</textPath>
        </text>
        {day && (
          <text fill={ink} stroke="none" fontSize="9.5" fontWeight="800" letterSpacing="2" fontFamily="Inter, -apple-system, 'Segoe UI', sans-serif">
            <textPath href={`#sb-${uid}`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">{day}</textPath>
          </text>
        )}
        <path d="M14.5 60l1.7 3.4 3.8.5-2.7 2.6.6 3.7-3.4-1.8-3.4 1.8.7-3.7-2.8-2.6 3.8-.5Z" fill={ink} stroke="none" transform="translate(-1 -5)" />
        <path d="M105.5 60l1.7 3.4 3.8.5-2.7 2.6.6 3.7-3.4-1.8-3.4 1.8.7-3.7-2.8-2.6 3.8-.5Z" fill={ink} stroke="none" transform="translate(1 -5)" />
        <rect x="10" y="49" width="100" height="23" rx="3" fill="#fff" strokeWidth="2.6" />
        <text x="60" y="65.5" textAnchor="middle" fill={ink} stroke="none" fontSize="14" fontWeight="900" letterSpacing="1.6" fontFamily="Inter, -apple-system, 'Segoe UI', sans-serif">ONBOARDÉ</text>
        <path d="m52 33.5 5 5 10-10" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 2)" />
      </g>
    </svg>
  );
}

// ── Code-barres décoratif, tiré d'une valeur (le numéro client) : toujours le même pour un client. ─────────
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
export function Barcode({ value, height = 30, width: maxWidth = 132, className = "ob-tk-barcode" }) {
  const { bars, width } = useMemo(() => {
    let h = hash(String(value || "owner")) || 7;
    const out = []; let x = 0;
    while (x < maxWidth) {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      const w = 1 + (h % 3);
      out.push([x, w]); x += w + 1 + ((h >> 4) % 2);
    }
    return { bars: out, width: x };
  }, [value, maxWidth]);
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {bars.map(([x, w]) => <rect key={x} x={x} y="0" width={w} height={height} rx=".3" fill="currentColor" />)}
    </svg>
  );
}

// ── Confettis : une gerbe tirée du haut de la fenêtre, qui retombe en 3 secondes. ──────────────────────
// Dessinés sur un canevas posé par-dessus tout (aucun clic intercepté) ; rien si l'utilisateur réduit les animations.
const CONFETTI_COLORS = ["#3e7d5a", "#34b37c", "#121b35", "#f5b301", "#e85d75", "#5b8def", "#9b7bf0", "#ffd4a3"];
export function ConfettiBurst({ origin = { x: 0.5, y: 0.32 }, count = 160, duration = 3200 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; };
    resize();
    window.addEventListener("resize", resize);
    const ox = window.innerWidth * origin.x, oy = window.innerHeight * origin.y;
    const pieces = Array.from({ length: count }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
      const speed = 7 + Math.random() * 9;
      return {
        x: ox + (Math.random() - 0.5) * 40, y: oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        size: 5 + Math.random() * 6, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        shape: i % 3, spin: (Math.random() - 0.5) * 0.35, rot: Math.random() * Math.PI, wobble: Math.random() * 10,
      };
    });
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = now - start;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const fade = Math.max(0, 1 - Math.max(0, t - duration * 0.62) / (duration * 0.38));
      for (const p of pieces) {
        p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.32; p.wobble += 0.12;
        p.x += p.vx + Math.sin(p.wobble) * 0.6; p.y += p.vy; p.rot += p.spin;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.scale(1, Math.cos(p.wobble)); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.9); }
        ctx.restore();
      }
      if (t < duration) frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [origin.x, origin.y, count, duration]);
  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 10080 }} />;
}
