import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Leaderboard from "./pages/Leaderboard.jsx";
import EmployeeSales from "./pages/EmployeeSales.jsx";
import Contrat from "./pages/Contrat.jsx";
import Signature from "./pages/Signature.jsx"; // 👈 AJOUT
import ContractNew   from "./pages/ContractNew.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/employee/:name" element={<EmployeeSales />} />
        <Route path="/contrat" element={<Contrat />} />
        <Route path="/contracts/new" element={<ContractNew />} />
        <Route path="/signature/:id" element={<Signature />} /> {/* 👈 AJOUT */}
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
