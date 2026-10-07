import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "uk.co.hardyapp.app",
  appName: "Hardy App",
  webDir: "dist",
  backgroundColor: "#0f1923",
  // Claim hardyapp.co.uk inside the WebView so existing family passkeys
  // (RP ID hardyapp.co.uk) keep working. Same-origin /api photo proxies are
  // rewritten onto Firebase Hosting in src/lib/photoUrl.ts so they are not
  // swallowed by this local hostname.
  server: {
    androidScheme: "https",
    iosScheme: "https",
    hostname: "hardyapp.co.uk",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#0f1923",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#0f1923",
      overlaysWebView: true,
    },
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    backgroundColor: "#0f1923",
    scheme: "Hardy App",
  },
};

export default config;
