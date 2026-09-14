import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { HomeLayoutMode } from "@/lib/homeLayout";
import HomeTiles from "@/pages/HomeTiles";
import Today from "@/pages/Today";

function requestedHomeView(value: string | null): HomeLayoutMode | null {
  return value === "today" || value === "tiles" ? value : null;
}

const Dashboard = () => {
  const { profile, loading } = useUserProfile();
  const [params] = useSearchParams();
  const [sessionView, setSessionView] = useState<HomeLayoutMode | null>(() => requestedHomeView(params.get("view")));
  const requested = requestedHomeView(params.get("view"));
  useEffect(() => {
    if (requested) setSessionView(requested);
  }, [requested]);
  if (loading) return null;
  const mode: HomeLayoutMode = sessionView ?? profile?.homeLayout ?? "tiles";
  if (mode === "today") {
    return <Today homeSwitch={{ mode, onChange: setSessionView }} />;
  }
  return <HomeTiles homeSwitch={{ mode, onChange: setSessionView }} />;
};

export default Dashboard;
