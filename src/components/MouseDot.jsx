// src/components/MouseDot.jsx
import { useEffect, useRef } from "react";
import "./mouse-dot.css";

export default function MouseDot({
  size = 10,
  color = "rgba(25, 37, 122, 1)",   // << safer than #RRGGBBAA
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

  // Mount once
  useEffect(() => {
    if (!enabled) return;
    if ("ontouchstart" in window && matchMedia("(pointer: coarse)").matches) return;

    const dot = document.createElement("div");
    dot.className = "mouse-dot";
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    document.body.appendChild(dot);
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
      pos.current.x += (target.current.x - pos.current.x) * speed;
      pos.current.y += (target.current.y - pos.current.y) * speed;
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
      dot.remove();
    };
  }, [enabled, size, speed, boostScale, boostOpacity, growSpeed]);

  // ⬇️ Update color live whenever the prop changes
  useEffect(() => {
    if (dotRef.current) {
      dotRef.current.style.setProperty("--dot-color", color);
      dotRef.current.style.backgroundColor = color; // direct, bypasses var()/fallback issues
    }
  }, [color]);

  return null;
}
