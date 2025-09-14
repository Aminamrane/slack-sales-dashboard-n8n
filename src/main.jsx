// src/main.jsx
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Leaderboard   from "./pages/Leaderboard.jsx";
import EmployeeSales from "./pages/EmployeeSales.jsx";
import Contrat       from "./pages/Contrat.jsx";
import Signature     from "./pages/Signature.jsx";
import ContractNew   from "./pages/ContractNew.jsx";
import ClientNew     from "./pages/ClientNew.jsx";
import AssignLeads   from "./pages/AssignLeads.jsx";
import AuthCallback  from "./pages/AuthCallback.jsx";

import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import MouseDot from "./components/MouseDot.jsx";

function App() {
  return (
    <BrowserRouter>
      <MouseDot size={10} lag={0.15} color="#071a31ff" />

      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Leaderboard />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Everything below is protected */}
        <Route
          path="/employee/:name"
          element={
            <ProtectedRoute>
              <EmployeeSales />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contrat"
          element={
            <ProtectedRoute>
              <Contrat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contracts/new"
          element={
            <ProtectedRoute>
              <ContractNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/signature/:id"
          element={
            <ProtectedRoute>
              <Signature />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/new"
          element={
            <ProtectedRoute>
              <ClientNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assign"
          element={
            <ProtectedRoute>
              <AssignLeads />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
