export type NotifChannel = "email" | "sms" | "push";
export type ReminderUnit = "minutes" | "hours" | "days" | "weeks" | "months" | "years";

export interface ReminderConfig {
  id: string;
  mode: "relative" | "onDayAt";
  timeOfDay: string; // "HH:MM"
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

/** Morning push/email/SMS brief with optional section toggles. */
export interface DailyDigestPrefs {
  enabled: boolean;
  channels: NotifChannel[];
  time: string; // "HH:MM" Europe/London
  /** Include open tasks due today (default true). */
  includeTasks?: boolean;
  /** Include today's calendar events (default true). */
  includeCalendar?: boolean;
  /** Include birthdays in the next 7 days (default true). */
  includeBirthdays?: boolean;
  /** Include pets with treatments due soon (default false). */
  includePets?: boolean;
}

export interface QuietHoursPrefs {
  enabled: boolean;
  /** Local London start HH:MM (inclusive). */
  start: string;
  /** Local London end HH:MM (exclusive). Spans midnight when start > end. */
  end: string;
}

export interface NotificationPrefs {
  email: { enabled: boolean; address: string };
  sms: { enabled: boolean; phone: string };
  push: { enabled: boolean };
  quietHours?: QuietHoursPrefs;
  events: {
    taskDue: TaskDuePrefs;
    taskCompleted: EventPrefs;
    taskAdded: EventPrefs;
    dailyDigest: DailyDigestPrefs;
    calendar?: EventPrefs;
    household?: EventPrefs;
    pets?: EventPrefs;
    medications?: EventPrefs;
    birthdays?: EventPrefs;
  };
}

export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  email: { enabled: false, address: "" },
  sms: { enabled: false, phone: "" },
  push: { enabled: false },
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
  events: {
    taskDue: {
      enabled: true,
      reminders: [
        { id: "default-1", mode: "onDayAt", timeOfDay: "09:00", channels: ["email", "push"] },
      ],
    },
    taskCompleted: { enabled: false, channels: ["push"] },
    taskAdded: { enabled: false, channels: ["push"] },
    dailyDigest: {
      enabled: false,
      channels: ["push"],
      time: "08:00",
      includeTasks: true,
      includeCalendar: true,
      includeBirthdays: true,
      includePets: false,
    },
    calendar: { enabled: true, channels: ["push", "email", "sms"] },
    household: { enabled: true, channels: ["push", "email", "sms"] },
    pets: { enabled: true, channels: ["push", "email", "sms"] },
    medications: { enabled: true, channels: ["push"] },
    birthdays: { enabled: true, channels: ["push", "email", "sms"] },
  },
};
