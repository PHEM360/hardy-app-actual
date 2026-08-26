import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { markSecurityAuthentication } from "@/lib/securitySession";

interface BeginRegistrationResult {
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

interface BeginAuthenticationResult {
  challengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}

export function passkeysSupported() {
  return window.isSecureContext && browserSupportsWebAuthn();
}

function moveRegistrationToCanonicalHost() {
  const legacyHosts = new Set(["hardyhub-7b30d.web.app", "hardyhub-7b30d.firebaseapp.com"]);
  if (!legacyHosts.has(window.location.hostname)) return false;
  window.location.replace(`https://hardyapp.co.uk${window.location.pathname}${window.location.search}${window.location.hash}`);
  return true;
}

export async function registerPasskey(label = "My passkey") {
  if (!auth.currentUser) throw new Error("You must be signed in to create a passkey");
  if (!passkeysSupported()) throw new Error("This browser or device does not support passkeys");
  if (moveRegistrationToCanonicalHost()) {
    throw new Error("Opening hardyapp.co.uk so this passkey works on your other devices");
  }
  const begin = httpsCallable<Record<string, never>, BeginRegistrationResult>(functions, "beginPasskeyRegistration");
  const finish = httpsCallable<unknown, { verified: boolean; token: string }>(
    functions,
    "finishPasskeyRegistration",
  );
  const started = await begin({});
  const response = await startRegistration({ optionsJSON: started.data.options });
  const completed = await finish({ challengeId: started.data.challengeId, response, label });
  if (!completed.data.verified || !completed.data.token) throw new Error("The passkey could not be verified");
  const credential = await signInWithCustomToken(auth, completed.data.token);
  markSecurityAuthentication(credential.user.uid, "passkey");
}

export async function authenticateWithPasskey(reauthenticate = false) {
  if (!passkeysSupported()) throw new Error("This browser or device does not support passkeys");
  const begin = httpsCallable<{ reauthenticate: boolean }, BeginAuthenticationResult>(
    functions,
    "beginPasskeyAuthentication",
  );
  const finish = httpsCallable<unknown, { verified: boolean; token: string }>(
    functions,
    "finishPasskeyAuthentication",
  );
  const started = await begin({ reauthenticate });
  const response = await startAuthentication({ optionsJSON: started.data.options });
  const completed = await finish({ challengeId: started.data.challengeId, response });
  if (!completed.data.verified || !completed.data.token) throw new Error("The passkey could not be verified");
  const credential = await signInWithCustomToken(auth, completed.data.token);
  markSecurityAuthentication(credential.user.uid, "passkey");
  return credential.user;
}

function cleanPasskeyMessage(message: string) {
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, "").trim();
}

export function passkeyErrorMessage(error: unknown) {
  const code = String((error as { code?: string } | undefined)?.code || "");
  const message = String((error as { message?: string } | undefined)?.message || "");
  const cleaned = cleanPasskeyMessage(message);
  if (code.includes("cancelled") || code.includes("not-allowed") || message.includes("NotAllowedError")) {
    return "No matching passkey was selected. Check that both devices use hardyapp.co.uk and that the same password provider is enabled.";
  }
  if (cleaned.includes("not available from this web address")) {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return `Passkeys on this computer need http://localhost:8080. You are on ${window.location.origin}.`;
    }
    return "Open hardyapp.co.uk to use your passkey.";
  }
  if (cleaned.includes("No passkey is registered for this web address")) {
    return "This address does not have a passkey yet. Sign in with your email and password, then create one for this device.";
  }
  if (code.includes("failed-precondition")) {
    return cleaned || "This passkey request expired. Please try again.";
  }
  if (code.includes("permission-denied")) {
    return cleaned || "That passkey could not be verified.";
  }
  return cleaned || "Passkey authentication failed.";
}
