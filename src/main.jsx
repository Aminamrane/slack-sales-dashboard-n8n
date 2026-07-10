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
import TrackingSheetAdmin from "./pages/TrackingSheetAdmin.jsx";
import TrackingSheetSetter from "./pages/TrackingSheetSetter.jsx";
import TrackingSheetFinance from "./pages/TrackingSheetFinance/index.jsx";
import CeoDashboard       from "./pages/CeoDashboard.jsx";
import CeoSheetView       from "./pages/CeoSheetView.jsx";
import CeoDispatchView    from "./pages/CeoDispatchView.jsx";
import CeoLeaderboardView from "./pages/CeoLeaderboardView.jsx";
import CeoPerfSalesView   from "./pages/CeoPerfSalesView.jsx";
import CeoAutoAssignView  from "./pages/CeoAutoAssignView.jsx";
import CeoVariablesView   from "./pages/CeoVariablesView.jsx";
import CeoCongesView      from "./pages/CeoCongesView.jsx";
import CeoCampaignsView   from "./pages/CeoCampaignsView.jsx";
import CeoOptilexBoardView from "./pages/CeoOptilexBoardView.jsx";
import HrDashboard        from "./pages/HrDashboard.jsx";
import CeoLeadQualityView from "./pages/CeoLeadQualityView.jsx";
import CeoSalesTeamView   from "./pages/CeoSalesTeamView.jsx";
import CeoWebinarView     from "./pages/CeoWebinarView.jsx";
import CeoFunnelLeadsView from "./pages/CeoFunnelLeadsView.jsx";
import AcquisitionDirectorDashboard from "./pages/AcquisitionDirectorDashboard.jsx";
import Marketing          from "./pages/Marketing/index.jsx";
import FunnelLeads        from "./pages/FunnelLeads/index.jsx";
import Dialer             from "./pages/Dialer/index.jsx";
import ContractSplitMonitoring from "./pages/ContractSplitMonitoring.jsx";
import OptilexBoard from "./pages/OptilexBoard.jsx";
import MetaAds            from "./pages/MetaAds/index.jsx";
import LeadAssignmentEquity from "./pages/LeadAssignmentEquity.jsx";
import LeadAssignmentMonitor from "./pages/LeadAssignmentMonitor.jsx";
import LeadAssignmentLive from "./pages/LeadAssignmentLive.jsx";
import TeamAbsences from "./pages/TeamAbsences.jsx";
import Variables from "./pages/Variables.jsx";

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
        <Route path="/tracking-setter" element={<TrackingSheetSetter />} />
        <Route path="/monitoring-perf" element={<MonitoringPerf />} />
        <Route path="/affectation-auto" element={<LeadAssignmentEquity />} />
        <Route path="/affectation-auto-monitor" element={<LeadAssignmentMonitor />} />
        <Route path="/affectation-en-direct" element={<LeadAssignmentLive />} />
        <Route path="/equipe" element={<TeamAbsences />} />
        <Route path="/eod-report" element={<EODReport />} />
        <Route path="/eod-dashboard" element={<EODDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/perf-closing" element={<PerfClosing />} />
        <Route path="/tracking-sheets" element={<TrackingSheetAdmin />} />
        <Route path="/tracking-finance" element={<TrackingSheetFinance />} />
        <Route path="/marketing" element={<Marketing />} />
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
        <Route
          path="/funnel-leads"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'acquisition_director']}>
              <FunnelLeads />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo"
          element={
            <ProtectedRoute>
              <CeoDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/sheet/:email"
          element={
            <ProtectedRoute>
              <CeoSheetView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/dispatch"
          element={
            <ProtectedRoute>
              <CeoDispatchView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/leaderboard"
          element={
            <ProtectedRoute>
              <CeoLeaderboardView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/perf-sales"
          element={
            <ProtectedRoute>
              <CeoPerfSalesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/auto-affectation"
          element={
            <ProtectedRoute>
              <CeoAutoAssignView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/sequences"
          element={
            <ProtectedRoute>
              <CeoSequencesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/variables"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'hr']}>
              <CeoVariablesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/conges"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'hr']}>
              <CeoCongesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/campaigns"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'marketing']}>
              <CeoCampaignsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/optilex-board"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'customer_success_manager']}>
              <CeoOptilexBoardView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rh-dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'hr']}>
              <HrDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/lead-quality"
          element={
            <ProtectedRoute>
              <CeoLeadQualityView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/sales-team"
          element={
            <ProtectedRoute>
              <CeoSalesTeamView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/webinar"
          element={
            <ProtectedRoute>
              <CeoWebinarView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/funnel-leads"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'acquisition_director', 'hr', 'customer_success_manager']}>
              <CeoFunnelLeadsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/acquisition-director"
          element={
            <ProtectedRoute>
              <AcquisitionDirectorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dialer"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance_director', 'finance_team']}>
              <Dialer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contract-split"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ContractSplitMonitoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/optilex-board"
          element={
            <ProtectedRoute allowedRoles={['admin', 'optilex']}>
              <OptilexBoard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/meta-ads"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MetaAds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/variables"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'hr']}>
              <Variables />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
