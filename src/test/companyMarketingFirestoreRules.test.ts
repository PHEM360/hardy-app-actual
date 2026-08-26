// @vitest-environment node
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const projectId = "hardy-hub-company-marketing-rules-test";
let environment: RulesTestEnvironment;

function context(uid: string, claims: Record<string, unknown> = {}) {
  return environment.authenticatedContext(uid, { email: `${uid}@example.com`, ...claims }).firestore();
}

function content(status: string, approvalVersion = 1, approvedVersion = 0) {
  return {
    type: "social_post",
    platform: "instagram",
    topic: "A post",
    draft: "Useful content",
    status,
    approvalVersion,
    approvedVersion,
  };
}

describe("company marketing Firestore enforcement", () => {
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
        setDoc(doc(admin.firestore(), "users", "editor"), { passkeyEnrolled: true }),
        setDoc(doc(admin.firestore(), "users", "stranger"), { passkeyEnrolled: true }),
        setDoc(doc(admin.firestore(), "companies", "company"), {
          name: "Company",
          ownerId: "owner",
          sharedWith: ["editor"],
        }),
        setDoc(doc(admin.firestore(), "companies", "company", "content", "awaiting"), content("awaiting_approval", 3)),
        setDoc(doc(admin.firestore(), "companies", "company", "content", "scheduled"), content("scheduled", 4, 4)),
        setDoc(doc(admin.firestore(), "companies", "company", "platformConnections", "instagram"), {
          platform: "instagram",
          status: "connected",
          accountName: "Company",
        }),
        setDoc(doc(admin.firestore(), "companies", "company", "marketingAudits", "weekly"), {
          headline: "Weekly PR audit",
        }),
      ]);
    });
  });

  afterAll(async () => environment.cleanup());

  it("lets company owners and editors use the marketing workspace", async () => {
    await assertSucceeds(setDoc(
      doc(context("owner"), "companies", "company", "marketing", "profile"),
      { brandVoice: "Warm", targetAudience: "Owners" },
    ));
    await assertSucceeds(setDoc(
      doc(context("editor"), "companies", "company", "campaigns", "campaign"),
      { name: "Autumn" },
    ));
    await assertSucceeds(getDoc(
      doc(context("editor"), "companies", "company", "platformConnections", "instagram"),
    ));
  });

  it("keeps unrelated users and remote displays out", async () => {
    await assertFails(getDoc(
      doc(context("stranger"), "companies", "company", "content", "awaiting"),
    ));
    await assertFails(getDoc(
      doc(context("owner", { deviceId: "screen" }), "companies", "company", "content", "awaiting"),
    ));
  });

  it("does not let a browser approve or forge published content", async () => {
    await assertFails(setDoc(
      doc(context("owner"), "companies", "company", "content", "forged"),
      content("published", 1, 1),
    ));
    await assertFails(updateDoc(
      doc(context("owner"), "companies", "company", "content", "awaiting"),
      { status: "approved", approvedVersion: 3 },
    ));
    await assertFails(updateDoc(
      doc(context("owner"), "companies", "company", "content", "scheduled"),
      { status: "published", externalPostId: "fake" },
    ));
  });

  it("requires each edited draft to become a new review version", async () => {
    await assertFails(updateDoc(
      doc(context("owner"), "companies", "company", "content", "awaiting"),
      { draft: "Changed without a version", status: "awaiting_approval" },
    ));
    await assertSucceeds(updateDoc(
      doc(context("owner"), "companies", "company", "content", "awaiting"),
      {
        draft: "Changed and ready for a fresh review",
        status: "awaiting_approval",
        approvalVersion: 4,
        approvedVersion: 0,
      },
    ));
  });

  it("keeps connection metadata and publish jobs server-controlled", async () => {
    await assertFails(setDoc(
      doc(context("owner"), "companies", "company", "platformConnections", "linkedin"),
      { platform: "linkedin", status: "connected" },
    ));
    await assertFails(setDoc(
      doc(context("owner"), "marketingPublishJobs", "job"),
      { status: "published" },
    ));
    await assertFails(getDoc(
      doc(context("owner"), "marketingPlatformCredentials", "company_instagram"),
    ));
  });

  it("lets editors read and delete audits but not write them from the browser", async () => {
    await assertSucceeds(getDoc(
      doc(context("editor"), "companies", "company", "marketingAudits", "weekly"),
    ));
    await assertFails(setDoc(
      doc(context("owner"), "companies", "company", "marketingAudits", "forged"),
      { headline: "Fake ranking report" },
    ));
    await assertSucceeds(deleteDoc(
      doc(context("owner"), "companies", "company", "marketingAudits", "weekly"),
    ));
  });
});
