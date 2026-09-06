export type MailProvider = "gmail" | "imap";
export type MailFolder = "inbox" | "sent" | "drafts" | "trash";
export type MailAiCategory = "personal" | "list" | "receipt" | "promo" | "social" | "work" | "other";
export type MailAccountStatus = "ok" | "needs_reauth" | "error" | "syncing";
export type MailAiActionType = "unsubscribe" | "label" | "draft";

export interface MailAccount {
  id: string;
  email: string;
  displayName: string;
  provider: MailProvider;
  status: MailAccountStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  host?: string;
}

export interface MailMessage {
  id: string;
  accountId: string;
  providerMessageId: string;
  threadId: string;
  folder: MailFolder;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  bodyText: string;
  date: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
  aiCategory: MailAiCategory | "";
  aiSummary: string;
  isMailingList: boolean;
  listUnsubscribe: string;
  listUnsubscribePost: string;
}

export interface MailSettings {
  instructions: string;
  autoClassify: boolean;
}

export interface MailAiAction {
  id: string;
  type: MailAiActionType;
  messageIds: string[];
  to?: string;
  subject?: string;
  body?: string;
  label?: string;
  reason: string;
}

export interface MailAiResult {
  summary: string;
  classified: number;
  actions: MailAiAction[];
  ranAt: string;
}

export interface MailCompose {
  accountId: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}

export type MailRail = "inbox" | "unread" | "starred" | "sent" | "lists" | "ai" | "accounts";
