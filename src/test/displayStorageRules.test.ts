// @vitest-environment node
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";

// Cross-service Storage -> Firestore rule lookups are evaluated in the
// emulator's configured Firebase project, so this must match .firebaserc.
const projectId = "hardyhub-7b30d";
let environment: RulesTestEnvironment;

describe("remote display Storage enforcement", () => {
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: { rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") },
      storage: { rules: await readFile(new URL("../../storage.rules", import.meta.url), "utf8") },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.clearStorage();
    await environment.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), "devices", "kitchen"), { uid: "owner", revoked: false });
      await uploadBytes(ref(admin.storage(), "displayPhotos/owner/photo.jpg"), new Uint8Array([1, 2, 3]), { contentType: "image/jpeg" });
      await uploadBytes(ref(admin.storage(), "documents/owner/private.pdf"), new Uint8Array([4, 5, 6]), { contentType: "application/pdf" });
    });
  });

  afterAll(async () => environment.cleanup());

  it("allows an active display to read only its photo-frame library", async () => {
    const display = environment.authenticatedContext("owner", { deviceId: "kitchen" }).storage();
    await assertSucceeds(getBytes(ref(display, "displayPhotos/owner/photo.jpg")));
    await assertFails(getBytes(ref(display, "documents/owner/private.pdf")));
  });

  it("prevents displays from uploading and revokes photo access immediately", async () => {
    const display = environment.authenticatedContext("owner", { deviceId: "kitchen" }).storage();
    await assertFails(uploadBytes(ref(display, "displayPhotos/owner/new.jpg"), new Uint8Array([1]), { contentType: "image/jpeg" }));
    await environment.withSecurityRulesDisabled(async (admin) => {
      await updateDoc(doc(admin.firestore(), "devices", "kitchen"), { revoked: true });
    });
    await assertFails(getBytes(ref(display, "displayPhotos/owner/photo.jpg")));
  });
});
