import { describe, expect, it } from "vitest";
import {
  changePasswordVaultPin,
  createPasswordVault,
  unlockPasswordVaultWithPin,
} from "@/lib/passwordVaultCrypto";

describe("changePasswordVaultPin", () => {
  it("re-wraps the private key so the new PIN unlocks and the old PIN fails", async () => {
    const created = await createPasswordVault("2468");
    const next = await changePasswordVaultPin("2468", "1357", created.config);
    const unlocked = await unlockPasswordVaultWithPin("1357", next);
    expect(unlocked.kty).toBe("RSA");
    await expect(unlockPasswordVaultWithPin("2468", next)).rejects.toThrow(/Incorrect passcode/i);
  }, 30_000);
});
