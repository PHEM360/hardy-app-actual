import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNativeApp, pathFromAppUrl } from "@/lib/nativeApp";

/**
 * Opens Universal Links / app scheme URLs (bank OAuth, shared Hardy links)
 * on the matching React route inside the native shell.
 */
export function NativeDeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;

    const go = (url: string) => {
      const path = pathFromAppUrl(url);
      if (!path || path === "/") return;
      navigate(path, { replace: true });
    };

    void import("@capacitor/app").then(async ({ App }) => {
      if (cancelled) return;
      const launch = await App.getLaunchUrl();
      if (launch?.url) go(launch.url);
      const handle = await App.addListener("appUrlOpen", ({ url }) => go(url));
      remove = () => {
        void handle.remove();
      };
    });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [navigate]);

  return null;
}
