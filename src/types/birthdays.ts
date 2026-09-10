import type { ReminderConfig } from "./notifications";

export const MAX_BIRTHDAY_REMINDERS = 3;

export type BirthdaySharing =
  | { mode: "all" }
  | { mode: "some"; uids: string[] }
  | { mode: "none" };

export interface Birthday {
  id: string;
  name: string;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  /** Year of birth, if known — used to show an age, not required for the reminder. */
  birthYear?: number | null;
  createdBy: string;
  /** The households/{id} doc this birthday was created against, used to resolve "all" sharing. */
  householdId?: string | null;
  sharedWith: BirthdaySharing;
  /** Up to MAX_BIRTHDAY_REMINDERS reminders, each fired via one or more channels. */
  reminders: ReminderConfig[];
  createdAt?: unknown;
  updatedAt?: unknown;
}
