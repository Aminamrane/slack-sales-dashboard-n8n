import { motion } from "framer-motion";

/**
 * Pill toggle 2 onglets (Répondeurs équipe / Mes cold calls).
 * Inspiré du segmented control TrackingSheetFinance (layoutId animé).
 */
export default function SetterTabs({ value, onChange, darkMode, counts = {} }) {
  const C = {
    bg: darkMode ? "rgba(0,0,0,0.18)" : "rgba(190,197,215,0.18)",
    activeBg: darkMode ? "#7c8adb" : "#1e2330",
    activeText: "#ffffff",
    text: darkMode ? "#9ca3af" : "#5e6273",
    activeBoxShadow: darkMode
      ? "0 4px 14px rgba(124,138,219,0.35)"
      : "0 4px 14px rgba(30,35,48,0.18)",
  };

  const tabs = [
    { key: "team", label: "Répondeurs équipe", count: counts.team },
    { key: "mine", label: "Mes cold calls", count: counts.mine },
  ];

  return (
    <div
      style={{
        display: "inline-flex",
        padding: 4,
        borderRadius: 999,
        background: C.bg,
        gap: 4,
      }}
    >
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              position: "relative",
              padding: "8px 18px",
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
              background: "transparent",
              color: active ? C.activeText : C.text,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              transition: "color 0.25s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              zIndex: 1,
            }}
          >
            {active && (
              <motion.div
                layoutId="setter-tab-pill"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  background: C.activeBg,
                  boxShadow: C.activeBoxShadow,
                  zIndex: -1,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 999,
                  background: active
                    ? "rgba(255,255,255,0.22)"
                    : darkMode
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(30,35,48,0.08)",
                  color: active ? "#ffffff" : C.text,
                  minWidth: 20,
                  textAlign: "center",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
