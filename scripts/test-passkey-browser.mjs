import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const functionsRequire = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = functionsRequire("@simplewebauthn/server");

const origin = "http://localhost:8080";
const rpID = "localhost";
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").waitFor();
  await page.getByLabel("Password").waitFor();
  await page.getByRole("button", { name: "Sign in with passkey" }).waitFor();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable", { enableUI: false });
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  const registrationOptions = await generateRegistrationOptions({
    rpName: "Hardy Hub",
    rpID,
    userID: Buffer.from("passkey-browser-test-user"),
    userName: "passkey-test@hardyapp.co.uk",
    userDisplayName: "Passkey Test",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
  });

  const registrationResponse = await page.evaluate(async (options) => {
    const fromB64 = (value) => {
      const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
      return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    };
    const toB64 = (value) => {
      let binary = "";
      new Uint8Array(value).forEach((byte) => { binary += String.fromCharCode(byte); });
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    };
    const publicKey = {
      ...options,
      challenge: fromB64(options.challenge),
      user: { ...options.user, id: fromB64(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map((credential) => ({
        ...credential,
        id: fromB64(credential.id),
      })),
    };
    const credential = await navigator.credentials.create({ publicKey });
    if (!(credential instanceof PublicKeyCredential)) throw new Error("No registration credential returned");
    const response = credential.response;
    return {
      id: credential.id,
      rawId: toB64(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || undefined,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: toB64(response.clientDataJSON),
        attestationObject: toB64(response.attestationObject),
        transports: response.getTransports?.(),
      },
    };
  }, registrationOptions);

  const registration = await verifyRegistrationResponse({
    response: registrationResponse,
    expectedChallenge: registrationOptions.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  assert.equal(registration.verified, true);
  assert.ok(registration.registrationInfo);

  await assert.rejects(
    verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: "wrong-challenge",
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    }),
  );

  const storedCredential = registration.registrationInfo.credential;
  const authenticationOptions = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });
  assert.equal(authenticationOptions.allowCredentials, undefined);

  const authenticationResponse = await page.evaluate(async (options) => {
    const fromB64 = (value) => {
      const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
      return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    };
    const toB64 = (value) => {
      let binary = "";
      new Uint8Array(value).forEach((byte) => { binary += String.fromCharCode(byte); });
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    };
    const credential = await navigator.credentials.get({
      publicKey: {
        ...options,
        challenge: fromB64(options.challenge),
        allowCredentials: options.allowCredentials?.map((entry) => ({
          ...entry,
          id: fromB64(entry.id),
        })),
      },
    });
    if (!(credential instanceof PublicKeyCredential)) throw new Error("No authentication credential returned");
    const response = credential.response;
    return {
      id: credential.id,
      rawId: toB64(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || undefined,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: toB64(response.clientDataJSON),
        authenticatorData: toB64(response.authenticatorData),
        signature: toB64(response.signature),
        userHandle: response.userHandle ? toB64(response.userHandle) : undefined,
      },
    };
  }, authenticationOptions);

  const authentication = await verifyAuthenticationResponse({
    response: authenticationResponse,
    expectedChallenge: authenticationOptions.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: storedCredential,
    requireUserVerification: true,
  });
  assert.equal(authentication.verified, true);
  assert.ok(authentication.authenticationInfo.newCounter >= storedCredential.counter);
  console.log("PASS: browser WebAuthn registration, discoverable login, UV and challenge verification");
} finally {
  await browser.close();
}
