// @vitest-environment node
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const projectId = "hardy-hub-display-rules-test";
let environment: RulesTestEnvironment;

function context(uid: string, claims: Record<string, unknown> = {}) {
  return environment.authenticatedContext(uid, { email: `${uid}@example.com`, ...claims }).firestore();
}

describe("remote display Firestore enforcement", () => {
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: { rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (admin) => {
      await Promise.all([
        setDoc(doc(admin.firestore(), "users", "owner"), { passkeyEnrolled: true }),
        setDoc(doc(admin.firestore(), "users", "other"), { passkeyEnrolled: true }),
        setDoc(doc(admin.firestore(), "devices", "kitchen"), { uid: "owner", revoked: false, label: "Kitchen" }),
        setDoc(doc(admin.firestore(), "displayPhotos", "owner", "items", "photo"), { url: "https://example.com/photo.jpg" }),
        setDoc(doc(admin.firestore(), "tasks", "owner", "items", "task"), { title: "Put bins out" }),
        setDoc(doc(admin.firestore(), "calendar", "owner", "events", "event"), { title: "Dentist" }),
        setDoc(doc(admin.firestore(), "finance", "owner", "accounts", "main"), { name: "Current account" }),
      ]);
    });
  });

  afterAll(async () => environment.cleanup());

  it("only lets an owner manage their display", async () => {
    await assertSucceeds(updateDoc(doc(context("owner"), "devices", "kitchen"), { label: "Kitchen screen" }));
    await assertFails(getDoc(doc(context("other"), "devices", "kitchen")));
  });

  it("lets a paired device read account-safe photos", async () => {
    const display = context("owner", { deviceId: "kitchen" });
    await assertSucceeds(getDoc(doc(display, "displayPhotos", "owner", "items", "photo")));
    await assertSucceeds(getDoc(doc(display, "tasks", "owner", "items", "task")));
    await assertSucceeds(getDoc(doc(display, "calendar", "owner", "events", "event")));
    await assertFails(getDoc(doc(display, "displayPhotos", "other", "items", "photo")));
  });

  it("denies a display all non-safe account modules and writes", async () => {
    const display = context("owner", { deviceId: "kitchen" });
    await assertFails(getDoc(doc(display, "finance", "owner", "accounts", "main")));
    await assertFails(updateDoc(doc(display, "tasks", "owner", "items", "task"), { title: "Changed" }));
    await assertFails(updateDoc(doc(display, "devices", "kitchen"), { label: "Changed at the screen" }));
  });

  it("cuts off the complete display session after revocation", async () => {
    await environment.withSecurityRulesDisabled(async (admin) => {
      await updateDoc(doc(admin.firestore(), "devices", "kitchen"), { revoked: true });
    });
    const revoked = context("owner", { deviceId: "kitchen" });
    await assertFails(getDoc(doc(revoked, "devices", "kitchen")));
    await assertFails(getDoc(doc(revoked, "displayPhotos", "owner", "items", "photo")));
  });
});
