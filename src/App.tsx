import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Finance from "@/pages/Finance";
import FinanceBankCallback from "@/pages/FinanceBankCallback";
import Pets from "@/pages/Pets";
import Admin from "@/pages/Admin";
import HouseholdFinance from "@/pages/HouseholdFinance";
import Inheritance from "@/pages/Inheritance";
import Households from "@/pages/Households";
import WeightTracker from "@/pages/WeightTracker";
import Health from "@/pages/Health";
import Tattersalls from "@/pages/Tattersalls";
import Tasks from "@/pages/Tasks";
import Today from "@/pages/Today";
import Companies from "@/pages/Companies";
import CompanyDetail from "@/pages/CompanyDetail";
import More from "@/pages/More";
import Settings from "@/pages/Settings";
import NotificationSettings from "@/pages/NotificationSettings";
import Themes from "@/pages/Themes";
import LogInDetails from "@/pages/LogInDetails";
import QRCodes from "@/pages/QRCodes";
import Locate from "@/pages/Locate";
import Display from "@/pages/Display";
import DisplayPair from "@/pages/DisplayPair";
import RemoteDisplays from "@/pages/RemoteDisplays";
import TagScan from "@/pages/TagScan";
import TagScanBySlug from "@/pages/TagScanBySlug";
import LinkRedirect from "@/pages/LinkRedirect";
import CalendarPage from "@/pages/Calendar";
import AnnualLeave from "@/pages/AnnualLeave";
import Holidays from "@/pages/Holidays";
import Notes from "@/pages/Notes";
import Photos from "@/pages/Photos";
import Email from "@/pages/Email";
import HubWidget from "@/pages/HubWidget";
import NotFound from "@/pages/NotFound";
import Freezer from "@/pages/Freezer";
import AiAnalysis from "@/pages/AiAnalysis";
import HolidaysPreview from "@/pages/HolidaysPreview";
import FinancePreview from "@/pages/FinancePreview";
import FlatsInvestmentPreview from "@/pages/FlatsInvestmentPreview";
import RequireAuth from "@/auth/RequireAuth";
import RequireRole from "@/auth/RequireRole";
import RequireFeature from "@/auth/RequireFeature";
import { MandatoryPasskeyGate, PasskeyGate } from "@/components/security/SecurityGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/locate" element={<Locate />} />
          <Route path="/display" element={<Display />} />
          <Route
            path="/pair/:pairingId"
            element={
              <RequireAuth>
                <MandatoryPasskeyGate>
                  <PasskeyGate
                    title="Approve a trusted display"
                    description="Use your passkey before giving this screen access to your photos, calendar and tasks."
                  >
                    <DisplayPair />
                  </PasskeyGate>
                </MandatoryPasskeyGate>
              </RequireAuth>
            }
          />
          <Route path="/tag/:petId/:tagId" element={<TagScan />} />
          <Route path="/p/:slug" element={<TagScanBySlug />} />
          <Route path="/l/:slug" element={<LinkRedirect />} />
          {import.meta.env.DEV && (
            <>
              <Route path="/dev/finance-preview" element={<FinancePreview />} />
              <Route path="/dev/holidays-preview" element={<HolidaysPreview />} />
              <Route path="/dev/flats-investment-preview" element={<FlatsInvestmentPreview />} />
            </>
          )}
          <Route
            element={
              <RequireAuth>
                <MandatoryPasskeyGate>
                  <AppLayout />
                </MandatoryPasskeyGate>
              </RequireAuth>
            }
          >
            {/* Make the root domain show the login page. Move dashboard to /dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/finance"
              element={
                <RequireFeature featureKey="finance_personal">
                  <Finance />
                </RequireFeature>
              }
            />
            <Route
              path="/finance/bank-callback"
              element={
                <RequireFeature featureKey="finance_personal">
                  <FinanceBankCallback />
                </RequireFeature>
              }
            />
            <Route
              path="/pets"
              element={
                <RequireFeature featureKey="pets">
                  <Pets />
                </RequireFeature>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireRole minRole="admin">
                  <Admin />
                </RequireRole>
              }
            />
            <Route
              path="/household-finance"
              element={
                <RequireFeature featureKey="finance_household">
                  <HouseholdFinance />
                </RequireFeature>
              }
            />
            <Route
              path="/inheritance"
              element={
                <RequireFeature featureKey="inheritance_tax">
                  <Inheritance />
                </RequireFeature>
              }
            />
            <Route
              path="/households"
              element={
                <RequireFeature featureKey="households">
                  <Households />
                </RequireFeature>
              }
            />
            <Route path="/freezer" element={<Freezer />} />
            <Route
              path="/weight"
              element={
                <RequireFeature featureKey="weight_tracking">
                  <Health />
                </RequireFeature>
              }
            />
            <Route
              path="/health"
              element={
                <RequireFeature featureKey="weight_tracking">
                  <Health />
                </RequireFeature>
              }
            />
            <Route
              path="/tattersalls"
              element={
                <RequireFeature featureKey="tattersalls">
                  <Tattersalls />
                </RequireFeature>
              }
            />
            <Route
              path="/tasks"
              element={
                <RequireFeature featureKey="tasks">
                  <Tasks />
                </RequireFeature>
              }
            />
            <Route path="/today" element={<Today />} />
            <Route
              path="/companies"
              element={
                <RequireFeature featureKey="companies">
                  <Companies />
                </RequireFeature>
              }
            />
            <Route
              path="/companies/:id"
              element={
                <RequireFeature featureKey="companies">
                  <CompanyDetail />
                </RequireFeature>
              }
            />
            <Route path="/more" element={<More />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/notifications" element={<NotificationSettings />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
            <Route path="/themes" element={<Themes />} />
            <Route path="/login-details" element={<LogInDetails />} />
            <Route path="/qr-codes" element={<QRCodes />} />
            <Route path="/remote-displays" element={<RemoteDisplays />} />
            <Route
              path="/ai-analysis"
              element={
                <RequireFeature featureKey="ai_analysis">
                  <AiAnalysis />
                </RequireFeature>
              }
            />
            <Route
              path="/calendar"
              element={
                <RequireFeature featureKey="calendar">
                  <CalendarPage />
                </RequireFeature>
              }
            />
            <Route
              path="/annual-leave"
              element={
                <RequireFeature featureKey="annual_leave">
                  <AnnualLeave />
                </RequireFeature>
              }
            />
            <Route
              path="/holidays"
              element={
                <RequireFeature featureKey="holidays">
                  <Holidays />
                </RequireFeature>
              }
            />
            <Route
              path="/notes"
              element={
                <RequireFeature featureKey="notes">
                  <Notes />
                </RequireFeature>
              }
            />
            <Route
              path="/notes/quick"
              element={
                <RequireFeature featureKey="notes">
                  <Navigate to="/notes?new=1" replace />
                </RequireFeature>
              }
            />
            <Route path="/photos" element={<Photos />} />
            <Route path="/email" element={<Email />} />
            <Route path="/widget" element={<HubWidget />} />
            <Route path="/widget/:kind" element={<HubWidget />} />
          </Route>
          <Route path="/" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
