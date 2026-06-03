import React from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion } from 'framer-motion';

/**
 * Reusable white card with consistent radius / shadow / padding —
 * mirrors the SaaS dashboard refs (rounded 18-20px, generous padding,
 * soft shadow). Supports an optional header with title + subtitle +
 * right-aligned action node.
 */
export default function Card({
  title,
  subtitle,
  action,
  children,
  C,
  noPadding = false,
  delay = 0,
  hoverable = false,
  style = {},
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.surface,
        borderRadius: 20,
        border: `1px solid ${C.hairline}`,
        boxShadow: C.shadow,
        overflow: 'hidden',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        ...style,
      }}
      whileHover={hoverable ? { y: -2 } : undefined}
    >
      {(title || action) && (
        <header style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: noPadding ? 'none' : `1px solid ${C.hairline}`,
        }}>
          <div>
            {title && (
              <h3 style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: C.text,
                letterSpacing: '-0.01em',
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                margin: '4px 0 0',
                fontSize: 12,
                color: C.muted,
                fontWeight: 500,
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </header>
      )}
      <div style={{ padding: noPadding ? 0 : 24 }}>{children}</div>
    </motion.section>
  );
}
