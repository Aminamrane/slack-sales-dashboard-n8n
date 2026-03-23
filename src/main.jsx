// src/main.jsx

import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Leaderboard      from "./pages/Leaderboard.jsx";
import EmployeeSales    from "./pages/EmployeeSales.jsx";
import ContractNew      from "./pages/ContractNew.jsx";
import AdminLeads       from "./pages/AdminLeads.jsx";
import LeadsManagement  from "./pages/LeadsManagement.jsx";
import TrackingSheet    from "./pages/TrackingSheet.jsx";
import MonitoringPerf   from "./pages/MonitoringPerf.jsx";
import EODReport        from "./pages/EODReportV2.jsx"; // V2 — V1 kept as EODReport.jsx
import EODDashboard     from "./pages/EODDashboard.jsx";
import Login            from "./pages/Login.jsx";
import ForgotPassword   from "./pages/ForgotPassword.jsx";
import ResetPassword    from "./pages/ResetPassword.jsx";
import Profile          from "./pages/Profile.jsx";
import Campaigns        from "./pages/Campaigns.jsx";
import PerfClosing      from "./pages/PerfClosing.jsx";

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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin/leads" element={<AdminLeads />} />
        <Route path="/leads-management" element={<LeadsManagement />} />
        <Route path="/tracking-sheet" element={<TrackingSheet />} />
        <Route path="/monitoring-perf" element={<MonitoringPerf />} />
        <Route path="/eod-report" element={<EODReport />} />
        <Route path="/eod-dashboard" element={<EODDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/perf-closing" element={<PerfClosing />} />
        <Route path="/change-password" element={<Navigate to="/profile" replace />} />

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
