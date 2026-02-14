/*
  Firebase cleanup script (TypeScript)

  WARNING: This script will permanently delete data and auth users in the
  configured Firebase project. Do NOT run it unless you have a full backup
  and you've read and understood what it does.

  Usage (recommended from a secure environment):
    1) Create a Firebase service account key JSON with `roles/owner` or the
       narrower set of roles required for deleting resources (Firestore Admin,
       Firebase Auth Admin, Storage Admin). Save it locally (never commit it).
    2) Set GOOGLE_APPLICATION_CREDENTIALS to the path of the JSON file, and
       set FIREBASE_PROJECT_ID to your project id (e.g. hardyhub-7b30d).

       Example:
         export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
         export FIREBASE_PROJECT_ID="hardyhub-7b30d"

    3) Install dependencies and run:
         npm install
         npx ts-node scripts/clean-firebase.ts

  The script below is intentionally conservative and requires you to list
  EXACT collection/document names you want to keep. The example keeps a
  single user email and will delete other test users and Firestore collections
  not whitelisted. Modify the WHITELIST_* constants before running.
*/

import admin from "firebase-admin";

// === CONFIGURE ===
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
if (!FIREBASE_PROJECT_ID) {
  console.error("FIREBASE_PROJECT_ID (or GCLOUD_PROJECT) must be set. Aborting.");
  process.exit(1);
}

// Emails to KEEP in Auth
const WHITELISTED_USER_EMAILS = ["chris.hardy.googlemail.com", "chris.hardy@gmail.com", "chris.hardy@googlemail.com"].map((s) => s.toLowerCase());

// Firestore collection names to KEEP (exact match)
const WHITELISTED_COLLECTIONS = [
  // add collection ids you want to preserve
];

// Storage buckets/prefixes to KEEP (none by default)
const WHITELISTED_STORAGE_PREFIXES: string[] = [];

// ------------------

admin.initializeApp({
  projectId: FIREBASE_PROJECT_ID,
});

const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage();

async function deleteNonWhitelistedUsers() {
  console.log("Listing users...");
  const batchSize = 1000;
  let nextPageToken: string | undefined;
  const toDelete: string[] = [];

  do {
    const result = await auth.listUsers(batchSize, nextPageToken);
    result.users.forEach((u) => {
      const email = (u.email || "").toLowerCase();
      if (!WHITELISTED_USER_EMAILS.includes(email)) {
        toDelete.push(u.uid);
      }
    });
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  console.log(`Deleting ${toDelete.length} users...`);
  for (const uid of toDelete) {
    try {
      await auth.deleteUser(uid);
      console.log(`Deleted user ${uid}`);
    } catch (err) {
      console.error(`Failed to delete ${uid}:`, err);
    }
  }
}

async function deleteFirestoreCollections() {
  console.log("Listing collections...");
  const collections = await db.listCollections();
  for (const col of collections) {
    const id = col.id;
    if (WHITELISTED_COLLECTIONS.includes(id)) {
      console.log(`Skipping collection ${id}`);
      continue;
    }
    console.log(`Deleting collection ${id} (all documents)`);
    // Delete documents in batches
    const query = db.collection(id).limit(500);
    while (true) {
      const snapshot = await query.get();
      if (snapshot.empty) break;
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`Deleted ${snapshot.docs.length} docs from ${id}`);
    }
  }
}

async function deleteStorageObjects() {
  console.log("Deleting storage objects except whitelisted prefixes (if any)...");
  const bucket = storage.bucket();
  const [files] = await bucket.getFiles();
  for (const file of files) {
    const keep = WHITELISTED_STORAGE_PREFIXES.some((p) => file.name.startsWith(p));
    if (keep) continue;
    try {
      await file.delete();
      console.log(`Deleted storage object ${file.name}`);
    } catch (err) {
      console.error(`Failed to delete ${file.name}:`, err);
    }
  }
}

async function main() {
  console.log("Firebase cleanup starting for project:", FIREBASE_PROJECT_ID);
  console.log("WHITELISTED_USER_EMAILS:", WHITELISTED_USER_EMAILS);
  console.log("WHITELISTED_COLLECTIONS:", WHITELISTED_COLLECTIONS);

  const doIt = process.env.REALLY_I_UNDERSTAND_THIS_IS_PERMANENT;
  if (doIt !== "1") {
    console.error("Safety check failed: set REALLY_I_UNDERSTAND_THIS_IS_PERMANENT=1 to run the destructive steps.");
    process.exit(2);
  }

  await deleteNonWhitelistedUsers();
  await deleteFirestoreCollections();
  await deleteStorageObjects();

  console.log("Cleanup finished.");
}

main().catch((err) => {
  console.error("Error during cleanup:", err);
  process.exit(1);
});
