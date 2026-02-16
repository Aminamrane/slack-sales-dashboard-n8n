// src/components/MouseDot.jsx - With hover boost effect
import { useEffect, useRef } from "react";
import "./mouse-dot.css";

export default function MouseDot({ 
  size = 10, 
  lag = 0.15, 
  color = "#071a31ff", 
  boostScale = 2.5,  // Scale multiplier when hovering .dot-boost elements
  enabled = true 
}) {
  const raf = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if ("ontouchstart" in window && matchMedia("(pointer: coarse)").matches) return;

    // Create dot once
    let dot = document.getElementById("mouse-dot");
    if (!dot) {
      dot = document.createElement("div");
      dot.id = "mouse-dot";
      dot.className = "mouse-dot";
      document.body.appendChild(dot);
    }
    
    dot.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      z-index: 999999;
      pointer-events: none;
      border-radius: 50%;
      left: 0;
      top: 0;
      will-change: transform;
      transition: width 0.2s ease, height 0.2s ease, opacity 0.2s ease;
    `;

    // Simple position tracking
    let x = 0, y = 0;
    let targetX = 0, targetY = 0;
    let currentSize = size;
    let isBoosted = false;

    // Update color based on dark mode
    const updateColor = () => {
      const isDark = document.body.classList.contains("dark-mode");
      dot.style.backgroundColor = isDark ? "rgba(255, 255, 255, 0.75)" : color;
    };
    updateColor();

    // Watch body class changes for dark mode
    const observer = new MutationObserver(updateColor);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    // Check if hovering over a .dot-boost element
    const checkBoost = (e) => {
      const target = e.target;
      const boostEl = target.closest('.dot-boost');
      
      if (boostEl && !isBoosted) {
        isBoosted = true;
        currentSize = size * boostScale;
        dot.style.width = `${currentSize}px`;
        dot.style.height = `${currentSize}px`;
        dot.style.opacity = '0.5';
      } else if (!boostEl && isBoosted) {
        isBoosted = false;
        currentSize = size;
        dot.style.width = `${size}px`;
        dot.style.height = `${size}px`;
        dot.style.opacity = '1';
      }
    };

    // Simple mousemove - track position and check for boost
    const onMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      checkBoost(e);
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    // Super simple animation loop with lag
    const tick = () => {
      x += (targetX - x) * lag;
      y += (targetY - y) * lag;
      dot.style.transform = `translate3d(${x - currentSize/2}px, ${y - currentSize/2}px, 0)`;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("mousemove", onMove);
      observer.disconnect();
    };
  }, [enabled, size, lag, color, boostScale]);

  return null;
}