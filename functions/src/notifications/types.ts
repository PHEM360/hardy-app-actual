export type NotifChannel = "email" | "sms" | "push";
export type ReminderUnit = "minutes" | "hours" | "days" | "weeks" | "months" | "years";

export interface ReminderConfig {
  id: string;
  mode: "relative" | "onDayAt";
  timeOfDay: string;
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
  time: string;
  includeTasks?: boolean;
  includeCalendar?: boolean;
  includeBirthdays?: boolean;
  includePets?: boolean;
}

export interface QuietHoursPrefs {
  enabled: boolean;
  start: string;
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
