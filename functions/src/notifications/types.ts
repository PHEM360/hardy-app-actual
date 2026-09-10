export type NotifChannel = "email" | "sms" | "push";
export type ReminderUnit = "minutes" | "hours" | "days" | "weeks" | "months" | "years";

export interface ReminderConfig {
  id: string;
  mode: "relative" | "onDayAt";
  // onDayAt: send at this time on the due date
  // relative: send at this time on the offset date (for days/weeks/months/years)
  //           or subtract from dueDate+timeOfDay (for minutes/hours)
  timeOfDay: string; // "HH:MM", default "09:00"
  relativeAmount?: number;
  relativeUnit?: ReminderUnit;
  relativeDirection?: "before" | "after";
  channels: NotifChannel[];
}

export interface EventPrefs {
  enabled: boolean;
  channels: NotifChannel[];
}

export interface TaskDuePrefs {
  enabled: boolean;
  reminders: ReminderConfig[];
}

export interface DailyDigestPrefs {
  enabled: boolean;
  channels: NotifChannel[];
  time: string; // "HH:MM"
}

export interface NotificationPrefs {
  email: { enabled: boolean; address: string };
  sms: { enabled: boolean; phone: string };
  push: { enabled: boolean };
  events: {
    taskDue: TaskDuePrefs;
    taskCompleted: EventPrefs;
    taskAdded: EventPrefs;
    dailyDigest: DailyDigestPrefs;
    /** Calendar / household / pets / meds use per-item channels; these master switches gate delivery. */
    calendar?: EventPrefs;
    household?: EventPrefs;
    pets?: EventPrefs;
    medications?: EventPrefs;
    birthdays?: EventPrefs;
  };
}

export type ScheduledNotifType =
  | "taskDue"
  | "taskCompleted"
  | "taskAdded"
  | "dailyDigest"
  | "calendarEvent"
  | "householdRenewal"
  | "petTreatment"
  | "medication"
  | "birthday"
  | "expenseReview";

export interface ScheduledNotification {
  uid: string;
  taskId?: string;
  eventId?: string;
  itemId?: string;
  petId?: string;
  medId?: string;
  householdId?: string;
  birthdayId?: string;
  /** Stable key for cancel/reschedule, e.g. calendar:{eventId}:{reminderId} */
  sourceKey?: string;
  taskTitle?: string;
  type: ScheduledNotifType;
  reminderId?: string;
  scheduledFor: FirebaseFirestore.Timestamp;
  channels: NotifChannel[];
  sent: boolean;
  sentAt?: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
}

export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  email: { enabled: false, address: "" },
  sms: { enabled: false, phone: "" },
  push: { enabled: false },
  events: {
    taskDue: {
      enabled: true,
      reminders: [
        { id: "default-1", mode: "onDayAt", timeOfDay: "09:00", channels: ["email", "push"] },
      ],
    },
    taskCompleted: { enabled: false, channels: ["push"] },
    taskAdded: { enabled: false, channels: ["push"] },
    dailyDigest: { enabled: false, channels: ["email"], time: "09:00" },
    calendar: { enabled: true, channels: ["push", "email", "sms"] },
    household: { enabled: true, channels: ["push", "email", "sms"] },
    pets: { enabled: true, channels: ["push", "email", "sms"] },
    medications: { enabled: true, channels: ["push"] },
    birthdays: { enabled: true, channels: ["push", "email", "sms"] },
  },
};
