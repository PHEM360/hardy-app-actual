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
import Tattersalls from "@/pages/Tattersalls";
import More from "@/pages/More";
import Settings from "@/pages/Settings";
import Themes from "@/pages/Themes";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/pets" element={<Pets />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/household-finance" element={<HouseholdFinance />} />
            <Route path="/inheritance" element={<Inheritance />} />
            <Route path="/households" element={<Households />} />
            <Route path="/weight" element={<WeightTracker />} />
            <Route path="/tattersalls" element={<Tattersalls />} />
            <Route path="/more" element={<More />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/themes" element={<Themes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
