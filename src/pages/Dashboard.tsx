import { useUserProfile } from "@/hooks/useUserProfile";
import HomeTiles from "@/pages/HomeTiles";
import Today from "@/pages/Today";

const Dashboard = () => {
  const { profile, loading } = useUserProfile();
  if (loading) return null;
  if (profile?.homeLayout === "today") return <Today />;
  return <HomeTiles />;
};

export default Dashboard;
