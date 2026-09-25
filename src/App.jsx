// src/main.jsx

import "./index.css";
import React, { lazy, Suspense, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const Leaderboard = lazy(() => import("./pages/Leaderboard.jsx"));
const EmployeeSales = lazy(() => import("./pages/EmployeeSales.jsx"));
const ContractNew = lazy(() => import("./pages/ContractNew.jsx"));
const AdminLeads = lazy(() => import("./pages/AdminLeads.jsx"));
const LeadsManagement = lazy(() => import("./pages/LeadsManagement.jsx"));
const TrackingSheet = lazy(() => import("./pages/TrackingSheet.jsx"));
const MonitoringPerf = lazy(() => import("./pages/MonitoringPerf.jsx"));
const EODReport = lazy(() => import("./pages/EODReportV2.jsx"));
const EODDashboard = lazy(() => import("./pages/EODDashboard.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const BookingOnboarding = lazy(() => import("./pages/BookingOnboarding.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Campaigns = lazy(() => import("./pages/Campaigns.jsx"));
const PerfClosing = lazy(() => import("./pages/PerfClosing.jsx"));
const TrackingSheetAdmin = lazy(() => import("./pages/TrackingSheetAdmin.jsx"));
const TrackingSheetSetter = lazy(() => import("./pages/TrackingSheetSetter.jsx"));
const TrackingSheetFinance = lazy(() => import("./pages/TrackingSheetFinance/index.jsx"));
const CeoDashboard = lazy(() => import("./pages/CeoDashboard.jsx"));
const CeoSheetView = lazy(() => import("./pages/CeoSheetView.jsx"));
const CeoSetterSheetView = lazy(() => import("./pages/CeoSetterSheetView.jsx"));
const CeoDispatchView = lazy(() => import("./pages/CeoDispatchView.jsx"));
const CeoLeaderboardView = lazy(() => import("./pages/CeoLeaderboardView.jsx"));
const CeoPerfSalesView = lazy(() => import("./pages/CeoPerfSalesView.jsx"));
const CeoAutoAssignView = lazy(() => import("./pages/CeoAutoAssignView.jsx"));
const CeoSequencesView = lazy(() => import("./pages/CeoSequencesView.jsx"));
const CeoVariablesView = lazy(() => import("./pages/CeoVariablesView.jsx"));
const CeoCongesView = lazy(() => import("./pages/CeoCongesView.jsx"));
const CeoCampaignsView = lazy(() => import("./pages/CeoCampaignsView.jsx"));
const CeoOptilexBoardView = lazy(() => import("./pages/CeoOptilexBoardView.jsx"));
const HrDashboard = lazy(() => import("./pages/HrDashboard.jsx"));
const CeoLeadQualityView = lazy(() => import("./pages/CeoLeadQualityView.jsx"));
const CeoSalesTeamView = lazy(() => import("./pages/CeoSalesTeamView.jsx"));
const OwnerIntegrationPreview = lazy(() => import("./pages/OwnerIntegrationPreview.jsx"));
const CeoSalesRecordingsView = lazy(() => import("./pages/CeoSalesRecordingsView.jsx"));
const CeoWebinarView = lazy(() => import("./pages/CeoWebinarView.jsx"));
const CeoFunnelLeadsView = lazy(() => import("./pages/CeoFunnelLeadsView.jsx"));
const CeoLeadsManagementView = lazy(() => import("./pages/CeoLeadsManagementView.jsx"));
const AcquisitionDirectorDashboard = lazy(() => import("./pages/AcquisitionDirectorDashboard.jsx"));
const Marketing = lazy(() => import("./pages/Marketing/index.jsx"));
const FunnelLeads = lazy(() => import("./pages/FunnelLeads/index.jsx"));
const Dialer = lazy(() => import("./pages/Dialer/index.jsx"));
const ContractSplitMonitoring = lazy(() => import("./pages/ContractSplitMonitoring.jsx"));
const OptilexBoard = lazy(() => import("./pages/OptilexBoard.jsx"));
const MetaAds = lazy(() => import("./pages/MetaAds/index.jsx"));
const CeoMetaAdsView = lazy(() => import("./pages/CeoMetaAdsView.jsx"));
const LeadAssignmentEquity = lazy(() => import("./pages/LeadAssignmentEquity.jsx"));
const LeadAssignmentMonitor = lazy(() => import("./pages/LeadAssignmentMonitor.jsx"));
const LeadAssignmentLive = lazy(() => import("./pages/LeadAssignmentLive.jsx"));
const TeamAbsences = lazy(() => import("./pages/TeamAbsences.jsx"));
const Variables = lazy(() => import("./pages/Variables.jsx"));
const OptilexRdvMonitoring = lazy(() => import("./pages/OptilexRdvMonitoring.jsx"));
const WorkHours = lazy(() => import("./pages/WorkHours.jsx"));
const CeoWorkHoursView = lazy(() => import("./pages/CeoWorkHoursView.jsx"));
const ReactivityMonitor = lazy(() => import("./pages/ReactivityMonitor.jsx"));

import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import MouseDot from "./components/MouseDot.jsx";

import PageLoading from "./components/PageLoading.jsx";
import PageLoadBoundary from "./components/PageLoadBoundary.jsx";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/inter/latin-900.css";

function App() {
  useEffect(() => { window.ownerStartup?.finish(); }, []);
  return (
    <BrowserRouter>
      <MouseDot size={10} lag={0.15} color="#071a31ff" />

      <PageLoadBoundary>
      <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Leaderboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        {/* Lien dedie (jeton dans l'URL) : reservation d'un onboarding chez Vincent */}
        <Route path="/rdv-onboarding" element={<BookingOnboarding />} />
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
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'acquisition_director', 'head_of_acquisition']}>
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
          path="/ceo/setter-sheet/:email"
          element={
            <ProtectedRoute>
              <CeoSetterSheetView />
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
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'hr', 'finance_director']}>
              <CeoVariablesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/conges"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'hr', 'finance_director']}>
              <CeoCongesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/campaigns"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'marketing', 'finance_director', 'head_of_acquisition']}>
              <CeoCampaignsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/optilex-board"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'customer_success_manager', 'finance_director']}>
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
          path="/work-hours"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'hr']}>
              <WorkHours />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/work-hours"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'hr']}>
              <CeoWorkHoursView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reactivity-monitor"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ReactivityMonitor />
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
        <Route path="/owner/integration-preview" element={<ProtectedRoute><OwnerIntegrationPreview /></ProtectedRoute>} />
        <Route
          path="/ceo/sales-recordings"
          element={
            <ProtectedRoute>
              <CeoSalesRecordingsView />
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
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'acquisition_director', 'head_of_acquisition', 'hr', 'customer_success_manager', 'finance_director']}>
              <CeoFunnelLeadsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/leads-management"
          element={
            <ProtectedRoute allowedRoles={['admin', 'ceo', 'head_of_acquisition']}>
              <CeoLeadsManagementView />
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
            <ProtectedRoute allowedRoles={['admin', 'optilex', 'finance_team']}>
              <OptilexBoard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ceo/meta-ads"
          element={
            <ProtectedRoute allowedRoles={['ceo', 'finance_director', 'acquisition_director', 'head_of_acquisition', 'marketing']}>
              <CeoMetaAdsView />
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
        <Route
          path="/optilex-rdv-monitoring"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <OptilexRdvMonitoring />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
      </PageLoadBoundary>
    </BrowserRouter>
  );
}

export function mountApp() {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
}
