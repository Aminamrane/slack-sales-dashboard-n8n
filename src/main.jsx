// src/main.jsx

import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Leaderboard      from "./pages/Leaderboard.jsx";
import EmployeeSales    from "./pages/EmployeeSales.jsx";
import ContractNew      from "./pages/ContractNew.jsx";
import AdminLeads       from "./pages/AdminLeads.jsx";
import LeadsManagement  from "./pages/LeadsManagement.jsx";
import TrackingSheet    from "./pages/TrackingSheet.jsx";
import MonitoringPerf   from "./pages/MonitoringPerf.jsx";
import EODReport        from "./pages/EODReport.jsx";
import EODDashboard     from "./pages/EODDashboard.jsx";
import Login            from "./pages/Login.jsx";
import ChangePassword   from "./pages/ChangePassword.jsx";

import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import MouseDot from "./components/MouseDot.jsx";

function App() {
  return (
    <BrowserRouter>
      <MouseDot size={10} lag={0.15} color="#071a31ff" />

      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Leaderboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/leads" element={<AdminLeads />} />
        <Route path="/leads-management" element={<LeadsManagement />} />
        <Route path="/tracking-sheet" element={<TrackingSheet />} />
        <Route path="/monitoring-perf" element={<MonitoringPerf />} />
        <Route path="/eod-report" element={<EODReport />} />
        <Route path="/eod-dashboard" element={<EODDashboard />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Protected routes */}
        <Route
          path="/employee/:name"
          element={
            <ProtectedRoute>
              <EmployeeSales />
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
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
