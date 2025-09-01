import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Leaderboard   from "./pages/Leaderboard.jsx";
import EmployeeSales from "./pages/EmployeeSales.jsx";
import Contrat       from "./pages/Contrat.jsx";
import Signature     from "./pages/Signature.jsx";
import ContractNew   from "./pages/ContractNew.jsx";
import ClientNew from "./pages/ClientNew.jsx";
import AssignLeads from './pages/AssignLeads.jsx';

import MouseDot from "./components/MouseDot.jsx"; // 👈 add this

function App() {
  return (
    <BrowserRouter>
      {/* Global tiny blue dot following the cursor */}
      <MouseDot size={10} lag={0.15} color="#071a31ff" /> 
      
      <Routes>
        <Route path="/assign" element={<AssignLeads />} />

        <Route path="/client/new" element={<ClientNew />} />
        <Route path="/" element={<Leaderboard />} />
        <Route path="/employee/:name" element={<EmployeeSales />} />
        <Route path="/contrat" element={<Contrat />} />
        <Route path="/contracts/new" element={<ContractNew />} />
        <Route path="/signature/:id" element={<Signature />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
