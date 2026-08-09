import * as admin from "firebase-admin";

/**
 * Every uid that should count as "this user's household" — unions every
 * households/{id} doc the user belongs to (a user can be in more than one),
 * plus the legacy householdId/householdIds fields on their user doc, plus
 * the user themself. No access check: this is for server-side fan-out only
 * (e.g. "who should be notified"), not for deciding what a caller may read —
 * see resolveHouseholdMemberIds in display.ts for the access-checked version
 * used when a caller is asking about a specific household.
 */
export async function resolveAllHouseholdMemberIds(uid: string): Promise<string[]> {
  const members = new Set<string>([uid]);

  const householdsSnap = await admin
    .firestore()
    .collection("households")
    .where("memberIds", "array-contains", uid)
    .get();
  householdsSnap.docs.forEach((doc) => {
    const ids: string[] = doc.data()?.memberIds || [];
    ids.forEach((id) => members.add(id));
  });

  const userSnap = await admin.firestore().doc(`users/${uid}`).get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const legacyIds: string[] = [
    ...(Array.isArray(userData.householdIds) ? userData.householdIds : []),
    ...(userData.householdId ? [String(userData.householdId)] : []),
  ].filter((id) => id && id !== uid);

  if (legacyIds.length > 0) {
    const legacySnaps = await admin
      .firestore()
      .getAll(...legacyIds.map((id) => admin.firestore().doc(`households/${id}`)));
    legacySnaps.forEach((snap) => {
      if (snap.exists) {
        const ids: string[] = snap.data()?.memberIds || [];
        ids.forEach((id) => members.add(id));
      }
    });
  }

  return Array.from(members);
}
