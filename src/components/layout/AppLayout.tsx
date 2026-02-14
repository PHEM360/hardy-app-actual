import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import TopBar from "./TopBar";

const AppLayout = () => {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  if (isLogin) return <Outlet />;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />
      <main className="flex-1 pb-20 overflow-y-auto max-w-3xl mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
