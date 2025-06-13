import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./index.css";

// Load environment variables
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [sales, setSales] = useState([]);

useEffect(() => {
  async function fetchSales() {
    const { data, error } = await supabase.from("Info").select("*");
    if (error) {
      console.error("Error fetching sales:", error);
      alert("Failed to fetch sales");
    } else {
      console.log("Fetched sales:", data); 
      setSales(data);
    }
  }

  fetchSales();
}, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Sales Dashboard</h1>
      {sales.length === 0 ? (
        <p>No sales yet.</p>
      ) : (
        <ul>
          {sales.map((sale) => (
            <li key={sale.id}>
              <strong>{sale.client_name}</strong> – {sale.amount} – {sale.mode} – {sale.comment}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
