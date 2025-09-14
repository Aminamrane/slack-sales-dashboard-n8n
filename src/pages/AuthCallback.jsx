// src/pages/AuthCallback.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch (err) {
        console.error("OAuth exchange failed:", err);
      } finally {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate]);

  return <p style={{ padding: 24 }}>Finishing sign-in…</p>;
}
