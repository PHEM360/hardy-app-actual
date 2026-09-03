const PIN_ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface VaultCipher {
  iv: string;
  data: string;
}

export interface PasswordVaultConfig {
  version: 1;
  pinSalt: string;
  encryptedPrivateKeyPin: VaultCipher;
  biometric?: {
    credentialId: string;
    prfSalt: string;
    encryptedPrivateKey: VaultCipher;
  };
}

export interface VaultPublicKey {
  version: 1;
  publicKey: JsonWebKey;
}

export type CredentialFieldType =
  | "username"
  | "email"
  | "userId"
  | "password"
  | "website"
  | "phone"
  | "accountNumber"
  | "membershipNumber"
  | "pin"
  | "other";

export interface CredentialField {
  id: string;
  type: CredentialFieldType;
  label: string;
  value: string;
}

export interface PlainCredential {
  name: string;
  url?: string;
  username?: string;
  email?: string;
  password?: string;
  fields?: CredentialField[];
  notes?: string;
  category?: string;
}

export interface EncryptedCredentialFields {
  encrypted: true;
  cipher: VaultCipher;
  wrappedKeys: Record<string, string>;
}

function toB64(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromB64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function derivePinKey(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PIN_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function keyFromSecret(secret: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", secret);
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptWithKey(key: CryptoKey, plaintext: string): Promise<VaultCipher> {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  return { iv: toB64(iv), data: toB64(cipher) };
}

async function decryptWithKey(key: CryptoKey, cipher: VaultCipher) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(cipher.iv) },
    key,
    fromB64(cipher.data),
  );
  return decoder.decode(plaintext);
}

async function importPublicKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
}

export async function importPrivateKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}

export async function createPasswordVault(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error("Passcode must be exactly 4 digits");
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey("jwk", pair.publicKey),
    crypto.subtle.exportKey("jwk", pair.privateKey),
  ]);
  const pinSalt = randomBytes(16);
  const pinKey = await derivePinKey(pin, pinSalt);
  const encryptedPrivateKeyPin = await encryptWithKey(pinKey, JSON.stringify(privateKey));
  return {
    config: {
      version: 1,
      pinSalt: toB64(pinSalt),
      encryptedPrivateKeyPin,
    } satisfies PasswordVaultConfig,
    publicProfile: { version: 1, publicKey } satisfies VaultPublicKey,
    privateKey,
  };
}

export async function unlockPasswordVaultWithPin(pin: string, config: PasswordVaultConfig) {
  if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit passcode");
  try {
    const key = await derivePinKey(pin, fromB64(config.pinSalt));
    return JSON.parse(await decryptWithKey(key, config.encryptedPrivateKeyPin)) as JsonWebKey;
  } catch {
    throw new Error("Incorrect passcode");
  }
}

/** Re-wrap the vault private key with a new 4-digit PIN (keeps Face ID unlock if enrolled). */
export async function changePasswordVaultPin(
  currentPin: string,
  newPin: string,
  config: PasswordVaultConfig,
): Promise<PasswordVaultConfig> {
  if (!/^\d{4}$/.test(newPin)) throw new Error("New passcode must be exactly 4 digits");
  if (currentPin === newPin) throw new Error("Choose a different passcode");
  const privateKey = await unlockPasswordVaultWithPin(currentPin, config);
  const pinSalt = randomBytes(16);
  const pinKey = await derivePinKey(newPin, pinSalt);
  const encryptedPrivateKeyPin = await encryptWithKey(pinKey, JSON.stringify(privateKey));
  return {
    ...config,
    pinSalt: toB64(pinSalt),
    encryptedPrivateKeyPin,
  };
}

type PrfExtensionResult = {
  prf?: {
    enabled?: boolean;
    results?: { first?: ArrayBuffer };
  };
};

async function getPrfSecret(credentialId: Uint8Array, salt: Uint8Array) {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: credentialId, type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null;
  const extension = credential?.getClientExtensionResults() as PrfExtensionResult | undefined;
  const secret = extension?.prf?.results?.first;
  if (!secret) throw new Error("This browser’s biometric unlock cannot protect a vault key. Use your passcode instead.");
  return new Uint8Array(secret);
}

export async function enrollVaultBiometrics(
  userId: string,
  displayName: string,
  privateKey: JsonWebKey,
) {
  if (!passwordVaultBiometricsAvailable()) throw new Error("Face ID or fingerprint unlock is not available on this device");
  const prfSalt = randomBytes(32);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
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
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60_000,
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Biometric setup was cancelled");
  const secret = await getPrfSecret(new Uint8Array(credential.rawId), prfSalt);
  const key = await keyFromSecret(secret);
  return {
    credentialId: toB64(credential.rawId),
    prfSalt: toB64(prfSalt),
    encryptedPrivateKey: await encryptWithKey(key, JSON.stringify(privateKey)),
  };
}

export async function unlockPasswordVaultWithBiometrics(config: PasswordVaultConfig) {
  if (!config.biometric) {
    throw new Error("Face ID / fingerprint unlock is not set up for this vault. Use your 4-digit passcode.");
  }
  try {
    const secret = await getPrfSecret(
      fromB64(config.biometric.credentialId),
      fromB64(config.biometric.prfSalt),
    );
    const key = await keyFromSecret(secret);
    return JSON.parse(await decryptWithKey(key, config.biometric.encryptedPrivateKey)) as JsonWebKey;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not allowed|cancel|abort/i.test(message)) {
      throw new Error("Biometric unlock was cancelled. You can use your 4-digit passcode instead.");
    }
    throw new Error(
      "Face ID / fingerprint unlock failed on this device. Use your 4-digit passcode, or re-enable biometrics when you next set up the vault.",
    );
  }
}

export function passwordVaultBiometricsAvailable() {
  return typeof window !== "undefined" &&
    window.isSecureContext &&
    "PublicKeyCredential" in window &&
    !!navigator.credentials;
}

export async function wrapCredentialKey(itemKey: Uint8Array, publicKey: JsonWebKey) {
  return toB64(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, await importPublicKey(publicKey), itemKey));
}

export async function unwrapCredentialKey(wrappedKey: string, privateKey: CryptoKey) {
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, fromB64(wrappedKey)),
  );
}

export async function encryptCredential(
  credential: PlainCredential,
  ownerId: string,
  ownerPublicKey: JsonWebKey,
): Promise<EncryptedCredentialFields> {
  const itemKey = randomBytes(32);
  return {
    encrypted: true,
    cipher: await encryptCredentialWithItemKey(credential, itemKey),
    wrappedKeys: { [ownerId]: await wrapCredentialKey(itemKey, ownerPublicKey) },
  };
}

export async function encryptCredentialWithItemKey(
  credential: PlainCredential,
  itemKey: Uint8Array,
) {
  const dataKey = await crypto.subtle.importKey("raw", itemKey, { name: "AES-GCM" }, false, ["encrypt"]);
  return encryptWithKey(dataKey, JSON.stringify(credential));
}

export async function decryptCredential(
  cipher: VaultCipher,
  wrappedKey: string,
  privateKey: CryptoKey,
) {
  const itemKey = await unwrapCredentialKey(wrappedKey, privateKey);
  const dataKey = await crypto.subtle.importKey("raw", itemKey, { name: "AES-GCM" }, false, ["decrypt"]);
  return {
    credential: JSON.parse(await decryptWithKey(dataKey, cipher)) as PlainCredential,
    itemKey,
  };
}
