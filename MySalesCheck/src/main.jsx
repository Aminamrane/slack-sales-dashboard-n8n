// src/main.jsx
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// → Our two page components (still empty for now)
import Leaderboard from "./pages/Leaderboard.jsx";
import EmployeeSales from "./pages/EmployeeSales.jsx";
import Contrat       from "./pages/Contrat.jsx";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Homepage = leaderboard */}
        <Route path="/" element={<Leaderboard />} />
        {/* Sales history for a given employee */}
        <Route path="/employee/:name" element={<EmployeeSales />} />
        <Route path="/contrat"    element={<Contrat />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
