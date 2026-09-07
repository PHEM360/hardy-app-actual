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
    calendar?: EventPrefs;
    household?: EventPrefs;
    pets?: EventPrefs;
    medications?: EventPrefs;
  };
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
  },
};
