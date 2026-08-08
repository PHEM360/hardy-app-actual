import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Finance from "@/pages/Finance";
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
import TagScan from "@/pages/TagScan";
import TagScanBySlug from "@/pages/TagScanBySlug";
import CalendarPage from "@/pages/Calendar";
import NotFound from "@/pages/NotFound";
import Freezer from "@/pages/Freezer";
import AiAnalysis from "@/pages/AiAnalysis";
import FinancePreview from "@/pages/FinancePreview";
import RequireAuth from "@/auth/RequireAuth";
import RequireRole from "@/auth/RequireRole";
import RequireFeature from "@/auth/RequireFeature";

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
                <DisplayPair />
              </RequireAuth>
            }
          />
          <Route path="/tag/:petId/:tagId" element={<TagScan />} />
          <Route path="/p/:slug" element={<TagScanBySlug />} />
          {import.meta.env.DEV && (
            <Route path="/dev/finance-preview" element={<FinancePreview />} />
          )}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
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
          </Route>
          <Route path="/" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
