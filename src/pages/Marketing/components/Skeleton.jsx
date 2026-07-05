import React from 'react';

/**
 * Skeleton primitive — a ghost placeholder with a soft shimmer sweep.
 *
 * Used only on the Marketing page during the *initial* load (no data in
 * memory yet), so the user sees premium ghost containers instead of a
 * blank / frozen screen while the slow Meta + landing aggregator resolves.
 *
 * Design notes (kept aligned with the page design system / theme.js) :
 *  - The shimmer is a 3-stop gradient painted at 200% width whose
 *    background-position is animated by the `mktShimmer` keyframe
 *    (injected once in theme.js). Soft, gliding, never flashing.
 *  - Colours are derived from the theme tokens `C` so the skeleton reads
 *    correctly in both light and dark mode (base = subtle surface,
 *    highlight = a slightly lighter band that travels across).
 *  - Honours `prefers-reduced-motion` : the moving sweep is dropped in
 *    favour of a calm opacity breathe (`mktSkeletonBreathe`).
 *
 * It renders nothing layout-specific by itself — the caller sizes it to
 * match the real content (same width / height / radius) so the swap to
 * real data produces zero layout shift.
 */

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Skeleton({
  C,
  width = '100%',
  height = 16,
  radius = 8,
  style = {},
}) {
  // Base = the subtle inset surface (matches nested cards / table heads).
  // Highlight = a brighter band that the gradient sweeps across. In dark
  // mode we lift towards a soft slate; in light mode towards near-white.
  const base = C.subtle;
  const highlight = C.surface;

  const shimmerStyle = prefersReducedMotion
    ? {
        background: base,
        animation: 'mktSkeletonBreathe 1.6s ease-in-out infinite',
      }
    : {
        backgroundImage: `linear-gradient(100deg, ${base} 30%, ${highlight} 50%, ${base} 70%)`,
        backgroundSize: '200% 100%',
        backgroundRepeat: 'no-repeat',
        animation: 'mktShimmer 1.6s ease-in-out infinite',
      };

  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        ...shimmerStyle,
        ...style,
      }}
    />
  );
}
