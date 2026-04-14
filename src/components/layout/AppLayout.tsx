import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import TopBar from "./TopBar";

const AppLayout = () => {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  if (isLogin) return <Outlet />;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] max-w-2xl mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
