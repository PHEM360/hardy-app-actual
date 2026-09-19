import { Capacitor } from "@capacitor/core";
import { APP_BASE_URL } from "@/lib/appUrl";

/** Firebase Hosting origin used for /api photo proxies from the native app. */
export const NATIVE_API_ORIGIN = "https://hardyhub-7b30d.web.app";

export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Public https origin for OAuth redirects, QR codes, and Universal Links. */
export function publicWebOrigin() {
  if (isNativeApp()) return APP_BASE_URL.replace(/\/$/, "");
  if (typeof window === "undefined") return APP_BASE_URL.replace(/\/$/, "");
  return window.location.origin;
}

export async function bootstrapNativeApp() {
  if (!isNativeApp()) return;

  document.documentElement.classList.add("native-app");
  document.documentElement.dataset.platform = Capacitor.getPlatform();

  const [{ StatusBar, Style }, { SplashScreen }, { Keyboard }, { App }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
    import("@capacitor/keyboard"),
    import("@capacitor/app"),
  ]);

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#0f1923" });
  } catch {
    // Status bar styling is best-effort on Android variants.
  }

  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch {
    // Accessory bar is iOS-only.
  }

  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) {
      window.history.back();
      return;
    }
    void App.exitApp();
  });

  // Give the first paint a beat so the native splash does not flash the login
  // screen mid-layout on a cold start.
  window.setTimeout(() => {
    void SplashScreen.hide({ fadeOutDuration: 280 });
  }, 250);
}

export async function openExternalUrl(url: string) {
  if (!url) return;
  if (!isNativeApp()) {
    window.location.href = url;
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

export function pathFromAppUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "hardyapp:") {
      const host = parsed.hostname;
      const nestedPath = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
      if (host && host !== "hardyapp.co.uk" && host !== "www.hardyapp.co.uk") {
        return `/${host}${nestedPath}${parsed.search}${parsed.hash}`;
      }
      return `${nestedPath || "/"}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return null;
  }
}
