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
import Themes from "@/pages/Themes";
import LogInDetails from "@/pages/LogInDetails";
import QRCodes from "@/pages/QRCodes";
import Locate from "@/pages/Locate";
import CalendarPage from "@/pages/Calendar";
import NotFound from "@/pages/NotFound";
import RequireAuth from "@/auth/RequireAuth";
import RequireRole from "@/auth/RequireRole";

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
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            {/* Make the root domain show the login page. Move dashboard to /dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/pets" element={<Pets />} />
            <Route
              path="/admin"
              element={
                <RequireRole minRole="admin">
                  <Admin />
                </RequireRole>
              }
            />
            <Route path="/household-finance" element={<HouseholdFinance />} />
            <Route path="/inheritance" element={<Inheritance />} />
            <Route path="/households" element={<Households />} />
            <Route path="/weight" element={<Health />} />
            <Route path="/tattersalls" element={<Tattersalls />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/today" element={<Today />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/more" element={<More />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/themes" element={<Themes />} />
            <Route path="/login-details" element={<LogInDetails />} />
            <Route path="/qr-codes" element={<QRCodes />} />
            <Route path="/calendar" element={<CalendarPage />} />
          </Route>
          <Route path="/" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
