import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import TopBar from "./TopBar";

const AppLayout = () => {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  const hideChrome =
    location.pathname === "/notes/quick" || location.pathname.startsWith("/widget");

  if (isLogin) return <Outlet />;

  if (hideChrome) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] w-full">
        <div className="mx-auto w-full max-w-screen-sm sm:max-w-screen-md md:max-w-screen-lg xl:max-w-screen-xl px-0">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
