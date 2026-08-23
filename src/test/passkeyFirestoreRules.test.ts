// @vitest-environment node
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const projectId = "hardy-hub-passkey-rules-test";
let environment: RulesTestEnvironment;

function context(uid: string, claims: Record<string, unknown> = {}) {
  return environment.authenticatedContext(uid, {
    email: `${uid}@example.com`,
    ...claims,
  }).firestore();
}

describe("passkey Firestore enforcement", () => {
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
      },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (admin) => {
      await Promise.all([
        setDoc(doc(admin.firestore(), "users", "unenrolled"), {
          email: "unenrolled@example.com",
          enabled: true,
          passkeyEnrolled: false,
        }),
        setDoc(doc(admin.firestore(), "users", "owner"), {
          email: "owner@example.com",
          enabled: true,
          passkeyEnrolled: true,
        }),
        setDoc(doc(admin.firestore(), "finance", "owner", "accounts", "main"), {
          name: "Current account",
        }),
        setDoc(doc(admin.firestore(), "users", "owner", "credentials", "tesco"), {
          ownerId: "owner",
          encrypted: true,
          cipher: { iv: "iv", data: "ciphertext" },
          wrappedKeys: { owner: "wrapped" },
          sharedWith: [],
          editors: [],
          individualShares: [],
          individualAccess: [],
          individualEditors: [],
        }),
      ]);
    });
  });

  afterAll(async () => {
    await environment.cleanup();
  });

  it("allows bootstrap profile access but denies normal data before passkey enrollment", async () => {
    const db = context("unenrolled");
    await assertSucceeds(getDoc(doc(db, "users", "unenrolled")));
    await assertFails(getDoc(doc(db, "finance", "owner", "accounts", "main")));
  });

  it("requires a recent passkey for Finance and Passwords by default", async () => {
    const withoutStepUp = context("owner");
    await assertFails(getDoc(doc(withoutStepUp, "finance", "owner", "accounts", "main")));
    await assertFails(getDoc(doc(withoutStepUp, "users", "owner", "credentials", "tesco")));

    const recentPasskey = context("owner", {
      passkeyVerifiedAt: Math.floor(Date.now() / 1000),
      authMethod: "passkey",
    });
    await assertSucceeds(getDoc(doc(recentPasskey, "finance", "owner", "accounts", "main")));
    await assertSucceeds(getDoc(doc(recentPasskey, "users", "owner", "credentials", "tesco")));

    const sixDayOldPasskey = context("owner", {
      passkeyVerifiedAt: Math.floor((Date.now() - 6 * 24 * 60 * 60 * 1000) / 1000),
      authMethod: "passkey",
    });
    await assertSucceeds(getDoc(doc(sixDayOldPasskey, "finance", "owner", "accounts", "main")));

    const eightDayOldPasskey = context("owner", {
      passkeyVerifiedAt: Math.floor((Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000),
      authMethod: "passkey",
    });
    await assertFails(getDoc(doc(eightDayOldPasskey, "finance", "owner", "accounts", "main")));
  });

  it("honours a user's no-extra-security choice", async () => {
    await environment.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), "users", "owner", "security", "settings"), {
        moduleRequirements: { personal_finance: "none", passwords: "none" },
      });
    });
    const db = context("owner");
    await assertSucceeds(getDoc(doc(db, "finance", "owner", "accounts", "main")));
    await assertSucceeds(getDoc(doc(db, "users", "owner", "credentials", "tesco")));
  });

  it("honours a shorter passkey freshness period chosen by the user", async () => {
    await environment.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), "users", "owner", "security", "settings"), {
        appUnlockIntervalDays: 1,
        moduleRequirements: { personal_finance: "passkey" },
      });
    });
    const twoDayOldPasskey = context("owner", {
      passkeyVerifiedAt: Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000),
    });
    await assertFails(getDoc(doc(twoDayOldPasskey, "finance", "owner", "accounts", "main")));
  });

  it("migrates the old monthly default to seven days", async () => {
    await environment.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), "users", "owner", "security", "settings"), {
        version: 1,
        appUnlockIntervalDays: 30,
        moduleRequirements: { personal_finance: "passkey" },
      });
    });
    const eightDayOldPasskey = context("owner", {
      passkeyVerifiedAt: Math.floor((Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000),
    });
    await assertFails(getDoc(doc(eightDayOldPasskey, "finance", "owner", "accounts", "main")));
  });

  it("requires a recent passkey before security settings can be weakened", async () => {
    const settingsPath = ["users", "owner", "security", "settings"] as const;
    await assertFails(setDoc(doc(context("owner"), ...settingsPath), {
      moduleRequirements: { personal_finance: "none" },
    }));
    await assertSucceeds(setDoc(doc(context("owner", {
      passkeyVerifiedAt: Math.floor(Date.now() / 1000),
    }), ...settingsPath), {
      moduleRequirements: { personal_finance: "none" },
    }));
  });
});
