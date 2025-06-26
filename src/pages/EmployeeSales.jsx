// ─────────────────────────────────────────────
// src/pages/EmployeeSales.jsx
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function EmployeeSales() {
  const { name } = useParams();              // « :name » dans l’URL
  const [rows, setRows]   = useState([]);
  const [loading, setLoading] = useState(true);

  /* ─── charge uniquement les ventes de cet employé ─── */
  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("Info")
        .select("created_at, client_name, amount, comment")  // ⇢ colonnes utiles
        .eq("employee_name", name)                           // filtre
        .gt("amount", 0)                                     // vraies ventes
        .order("created_at", { ascending: false });          // plus récentes 1ʳᵉ

      if (error) { console.error(error); setLoading(false); return; }
      setRows(data);
      setLoading(false);
    }

    load();
  }, [name]);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <Link to="/">← Back</Link>

      <h1 style={{ margin: "0 0 1rem", textAlign: "center" }}>
        Sales history for <em>{name}</em>
      </h1>

      {loading && <p>Loading…</p>}
      {!loading && rows.length === 0 && <p>No sales yet.</p>}

      {!loading && rows.length > 0 && (
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            maxWidth: "800px",
            margin: "0 auto",
            fontSize: "0.9rem",
          }}
        >
          <thead>
            <tr>
              <th align="left">Date</th>
              <th align="left">Client</th>
              <th align="left">Mode</th>
              <th align="right">€</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.created_at}>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td>{r.client_name || "—"}</td>
                <td>{r.comment || "—"}</td>
                <td align="right">
                  {Number(r.amount).toLocaleString("fr-FR")} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
