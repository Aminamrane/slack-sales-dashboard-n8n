// Palette des pages CEO et du menu de gauche (clair / sombre). Sortie de CeoDashboard.jsx le 09/11/2026 pour que
// le menu de gauche s'affiche sur n'importe quelle page sans charger le tableau de bord CEO.
export const getColors = (dark) => ({
  bg: dark ? '#1e1f28' : '#ffffff',
  surface: dark ? '#13141b' : '#f6f7f9',
  border: dark ? '#2a2b36' : '#d5dae5',
  text: dark ? '#eef0f6' : '#1e2330',
  muted: dark ? '#5e6273' : '#9ca3af',
  subtle: dark ? '#252636' : '#f4f6fb',
  secondary: dark ? '#8b8fa0' : '#6b7280',
  accent: dark ? '#7c8adb' : '#5b6abf',
  shadow: dark ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
});
