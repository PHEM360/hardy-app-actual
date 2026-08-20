const ITERATIONS = 120_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function hashPin(pin: string, saltB64?: string): Promise<{ salt: string; hash: string }> {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(pin, salt);
  const raw = await crypto.subtle.exportKey("raw", key);
  return { salt: toB64(salt), hash: toB64(raw) };
}

export async function encryptPayload(secret: string, plaintext: string): Promise<{ salt: string; iv: string; data: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  return { salt: toB64(salt), iv: toB64(iv), data: toB64(cipher) };
}

export async function decryptPayload(secret: string, salt: string, iv: string, data: string): Promise<string> {
  const key = await deriveKey(secret, fromB64(salt));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) },
    key,
    fromB64(data)
  );
  return decoder.decode(plain);
}

export async function registerPlatformPasskey(userId: string, displayName: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Hardy Hub", id: window.location.hostname },
      user: {
        id: encoder.encode(userId).slice(0, 64),
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Passkey not created");
  return toB64(new Uint8Array(cred.rawId));
}

export async function assertPlatformPasskey(credentialIdB64: string): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const result = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: fromB64(credentialIdB64), type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return !!result;
}

export function webauthnAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}
