// src/routes/ProtectedRoute.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const REQUIRED_TEAM = import.meta.env.VITE_SLACK_TEAM_ID || "";

function getSlackTeamId(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  const fromMeta =
    meta.team?.id ||
    meta.slack_team_id ||
    meta["https://slack.com/team_id"];
  if (fromMeta) return fromMeta;

  const id0 = user.identities?.[0]?.identity_data;
  const fromIdentity = id0?.team?.id || id0?.team_id || id0?.workspace?.id;
  if (fromIdentity) return fromIdentity;

  const fromAppMeta =
    user.app_metadata?.team?.id || user.app_metadata?.slack_team_id;
  return fromAppMeta || "";
}

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const ses = data?.session || null;

        if (!REQUIRED_TEAM) {
          setAllowed(Boolean(ses));
        } else {
          const tid = getSlackTeamId(ses?.user);
          // If team id exists, enforce it. If missing, allow to avoid false negatives.
          setAllowed(Boolean(ses) && (!tid || tid === REQUIRED_TEAM));
        }
      } finally {
        setChecking(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, ses) => {
      if (!REQUIRED_TEAM) {
        setAllowed(Boolean(ses));
      } else {
        const tid = getSlackTeamId(ses?.user);
        setAllowed(Boolean(ses) && (!tid || tid === REQUIRED_TEAM));
      }
      setChecking(false);
    });

    sync();
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  if (checking) return <p style={{ padding: 24 }}>Checking access…</p>;

  // If not allowed → send them to "/" (your Slack login lives there).
  if (!allowed) return <Navigate to="/" replace />;

  return children;
}
