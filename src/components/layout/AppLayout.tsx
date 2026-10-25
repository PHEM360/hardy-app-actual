import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import TopBar from "./TopBar";
import { ModuleSecurityGate } from "@/components/security/SecurityGate";
import { HomeLayoutGate } from "@/components/home/HomeLayoutGate";
import { FcmBootstrap } from "@/components/notifications/FcmBootstrap";
import { AlarmRingingOverlay } from "@/components/display/AlarmRingingOverlay";
import { useAuth } from "@/auth/AuthContext";

const AppLayout = () => {
  const location = useLocation();
  const { dataUid } = useAuth();
  const isLogin = location.pathname === "/login";
  const hideChrome =
    location.pathname === "/notes/quick" ||
    location.pathname === "/calendar-app" ||
    location.pathname.startsWith("/widget");

  if (isLogin) return <Outlet />;

  if (hideChrome) {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-background safe-top">
        <FcmBootstrap />
        <AlarmRingingOverlay uid={dataUid} />
        <div className="h-full min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          <ModuleSecurityGate><Outlet /></ModuleSecurityGate>
        </div>
      </div>
    );
  }

  return (
    <HomeLayoutGate>
      <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background">
        <FcmBootstrap />
        <AlarmRingingOverlay uid={dataUid} />
        <TopBar />
        <main
          className="w-full min-w-0 min-h-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
          style={{
            paddingBottom: "calc(var(--app-nav-h, 4rem) + env(safe-area-inset-bottom, 0px) + var(--kbd, 0px))",
          }}
        >
          <div className="mx-auto w-full min-w-0 max-w-screen-sm sm:max-w-screen-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
            <ModuleSecurityGate><Outlet /></ModuleSecurityGate>
          </div>
        </main>
      </div>
      <BottomNav />
    </HomeLayoutGate>
  );
};

export default AppLayout;
