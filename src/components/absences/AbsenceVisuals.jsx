import { useState } from "react";

export function PersonAvatar({ person, small = false }) {
  const [failed, setFailed] = useState(null);
  const name = person.full_name || person.email || "Collaborateur";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={"hr-avatar " + (small ? "hr-avatar-small" : "")}
      aria-hidden="true"
    >
      {person.avatar_url && failed !== person.avatar_url ? (
        <img
          src={person.avatar_url}
          alt=""
          loading="lazy"
          onError={() => setFailed(person.avatar_url)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}

// Duotone SVG illustrations remain crisp at every display size.
export function MetricIllustration({ type }) {
  return (
    <svg
      className={"hr-illustration hr-illustration-" + type}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="35" fill="currentColor" opacity=".07" />
      <circle cx="68" cy="17" r="4" fill="currentColor" opacity=".25" />
      <path
        d="M10 62h6m-3-3v6"
        stroke="currentColor"
        opacity=".4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {type === "review" && (
          <>
            <rect
              x="22"
              y="17"
              width="33"
              height="45"
              rx="7"
              fill="var(--abs-bg)"
            />
            <rect
              x="30"
              y="13"
              width="17"
              height="9"
              rx="4"
              fill="var(--abs-soft)"
            />
            <path d="m29 32 3 3 5-6m5 4h6M29 44h12M29 51h8" />
            <circle cx="56" cy="54" r="13" fill="var(--abs-bg)" />
            <path d="M56 47v8l5 3" />
          </>
        )}
        {type === "days" && (
          <>
            <rect
              x="17"
              y="21"
              width="46"
              height="41"
              rx="8"
              fill="var(--abs-bg)"
            />
            <path d="M17 33h46M28 16v11M52 16v11" />
            <path d="M28 43h3m9 0h3m9 0h1M28 52h3" strokeWidth="3" />
            <circle cx="51" cy="55" r="12" fill="var(--abs-bg)" />
            <path
              d="M51 43a12 12 0 0 1 0 24Z"
              fill="currentColor"
              opacity=".22"
              stroke="none"
            />
            <path d="M51 46v18" />
          </>
        )}
        {type === "people" && (
          <>
            <circle cx="40" cy="28" r="10" fill="var(--abs-bg)" />
            <circle cx="20" cy="35" r="7" fill="currentColor" opacity=".13" />
            <circle cx="61" cy="35" r="7" fill="currentColor" opacity=".13" />
            <path d="M9 59v-4a11 11 0 0 1 16-10m46 14v-4a11 11 0 0 0-16-10" />
            <path d="M23 63V56a17 17 0 0 1 34 0v7Z" fill="var(--abs-bg)" />
            <path d="M32 57v6m16-6v6" />
          </>
        )}
        {type === "today" && (
          <>
            <circle cx="39" cy="39" r="19" fill="var(--abs-bg)" />
            <path d="M39 11v5m0 46v5M11 39h5m46 0h5M19 19l4 4m32 32 4 4m0-40-4 4M23 55l-4 4" />
            <path d="m31 39 6 6 12-13" strokeWidth="3" />
            <circle cx="61" cy="61" r="9" fill="var(--abs-bg)" />
            <path d="M61 57v4l3 2" />
          </>
        )}
      </g>
    </svg>
  );
}
