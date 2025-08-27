// src/components/MouseDot.jsx
import { useEffect, useRef } from "react";
import "./mouse-dot.css";

// Convert #RRGGBBAA → rgba(r,g,b,a)
function hex8ToRgba(hex) {
  const m = /^#?([A-Fa-f0-9]{8})$/.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  const r = (v >> 24) & 255;
  const g = (v >> 16) & 255;
  const b = (v >> 8) & 255;
  const a = (v & 255) / 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function MouseDot({
  size = 10,
  color = "rgba(14,20,62,1)", // safe default
  speed = 0.14,
  boostScale = 4,
  boostOpacity = 0.25,
  growSpeed = 0.22,
  enabled = true,
}) {
  const dotRef = useRef(null);
  const pos = useRef({ x: -9999, y: -9999 });
  const target = useRef({ x: -9999, y: -9999 });
  const scale = useRef(1);
  const tScale = useRef(1);
  const opacity = useRef(1);
  const tOpacity = useRef(1);
  const raf = useRef(0);
  const currentBoostEl = useRef(null);

  // Create or reuse a single global dot
  useEffect(() => {
    if (!enabled) return;
    if ("ontouchstart" in window && matchMedia("(pointer: coarse)").matches) return;

    let dot = document.getElementById("mouse-dot");
    if (!dot) {
      dot = document.createElement("div");
      dot.id = "mouse-dot";
      dot.className = "mouse-dot";
      document.body.appendChild(dot);
    }
    dot.style.position = "fixed";
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.zIndex = "999999";
    dot.style.pointerEvents = "none";
    dotRef.current = dot;

    const onMove = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;

      const boostEl = (e.target instanceof Element) ? e.target.closest(".dot-boost") : null;
      if (boostEl && currentBoostEl.current !== boostEl) {
        currentBoostEl.current = boostEl;
        tScale.current = boostScale;
        tOpacity.current = boostOpacity;
      } else if (!boostEl && currentBoostEl.current) {
        currentBoostEl.current = null;
        tScale.current = 1;
        tOpacity.current = 1;
      }
    };

    const onMouseOver = (e) => {
      const boostEl = (e.target instanceof Element) ? e.target.closest(".dot-boost") : null;
      if (boostEl) {
        currentBoostEl.current = boostEl;
        tScale.current = boostScale;
        tOpacity.current = boostOpacity;
      }
    };
    const onMouseOut = (e) => {
      if (!currentBoostEl.current) return;
      const toEl = (e.relatedTarget instanceof Element) ? e.relatedTarget.closest(".dot-boost") : null;
      if (!toEl) {
        currentBoostEl.current = null;
        tScale.current = 1;
        tOpacity.current = 1;
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);

    const tick = () => {
      // position easing
      pos.current.x += (target.current.x - pos.current.x) * speed;
      pos.current.y += (target.current.y - pos.current.y) * speed;

      // grow/fade easing
      scale.current += (tScale.current - scale.current) * growSpeed;
      opacity.current += (tOpacity.current - opacity.current) * growSpeed;

      const curSize = size * scale.current;
      const x = pos.current.x - curSize / 2;
      const y = pos.current.y - curSize / 2;

      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      dot.style.width = `${curSize}px`;
      dot.style.height = `${curSize}px`;
      dot.style.opacity = String(opacity.current);

      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("mouseout", onMouseOut, true);
      // Do NOT remove the element here (we reuse the single #mouse-dot)
    };
  }, [enabled, size, speed, boostScale, boostOpacity, growSpeed]);

  // Update color live whenever the prop changes (with hex8 support)
  useEffect(() => {
    const dot = dotRef.current || document.getElementById("mouse-dot");
    if (!dot) return;
    let resolved = color;
    if (/^#([0-9a-f]{8})$/i.test(color)) {
      const rgba = hex8ToRgba(color);
      if (rgba) resolved = rgba;
    }
    dot.style.backgroundColor = resolved;
  }, [color]);

  return null;
}
