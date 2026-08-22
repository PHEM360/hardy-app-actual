import { describe, expect, it } from "vitest";
import {
  createPasswordVault,
  decryptCredential,
  encryptCredential,
  importPrivateKey,
  unlockPasswordVaultWithPin,
} from "@/lib/passwordVaultCrypto";

describe("password vault encryption", () => {
  it("only unlocks the private key with the correct four-digit passcode", async () => {
    const vault = await createPasswordVault("2468");

    await expect(unlockPasswordVaultWithPin("2468", vault.config)).resolves.toMatchObject({
      kty: "RSA",
    });
    await expect(unlockPasswordVaultWithPin("1357", vault.config)).rejects.toThrow("Incorrect passcode");
  });

  it("encrypts credential contents and decrypts them for the wrapped owner key", async () => {
    const vault = await createPasswordVault("2468");
    const credential = {
      name: "Tesco",
      email: "family@example.com",
      password: "not-in-firestore",
    };
    const encrypted = await encryptCredential(credential, "owner-uid", vault.publicProfile.publicKey);

    expect(JSON.stringify(encrypted)).not.toContain(credential.password);
    const privateKey = await importPrivateKey(vault.privateKey);
    const decrypted = await decryptCredential(
      encrypted.cipher,
      encrypted.wrappedKeys["owner-uid"],
      privateKey,
    );
    expect(decrypted.credential).toEqual(credential);
  });

  it("round-trips a login with custom, repeatable fields", async () => {
    const vault = await createPasswordVault("2468");
    const credential = {
      name: "HMRC",
      fields: [
        { id: "one", type: "userId" as const, label: "User ID", value: "123456789012" },
        { id: "two", type: "password" as const, label: "Password", value: "very-secret" },
        { id: "three", type: "other" as const, label: "Recovery phrase", value: "private phrase" },
      ],
      notes: "Use for Self Assessment",
    };
    const encrypted = await encryptCredential(credential, "owner-uid", vault.publicProfile.publicKey);

    expect(JSON.stringify(encrypted)).not.toContain("very-secret");
    expect(JSON.stringify(encrypted)).not.toContain("private phrase");
    const decrypted = await decryptCredential(
      encrypted.cipher,
      encrypted.wrappedKeys["owner-uid"],
      await importPrivateKey(vault.privateKey),
    );
    expect(decrypted.credential).toEqual(credential);
  });
});
