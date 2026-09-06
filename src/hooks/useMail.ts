import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_MAIL_INSTRUCTIONS } from "@/lib/mailLogic";
import type { MailAccount, MailAiResult, MailMessage, MailSettings } from "@/types/mail";

function asString(value: unknown) {
  return String(value || "");
}

function accountFromDoc(id: string, data: Record<string, unknown>): MailAccount {
  return {
    id,
    email: asString(data.email),
    displayName: asString(data.displayName) || asString(data.email),
    provider: data.provider === "gmail" ? "gmail" : "imap",
    status: (asString(data.status) as MailAccount["status"]) || "ok",
    lastSyncAt: data.lastSyncAt ? asString(data.lastSyncAt) : null,
    lastError: data.lastError ? asString(data.lastError) : null,
    host: data.host ? asString(data.host) : undefined,
  };
}

function messageFromDoc(id: string, data: Record<string, unknown>): MailMessage {
  return {
    id,
    accountId: asString(data.accountId),
    providerMessageId: asString(data.providerMessageId),
    threadId: asString(data.threadId),
    folder: (asString(data.folder) as MailMessage["folder"]) || "inbox",
    from: asString(data.from),
    fromName: asString(data.fromName) || asString(data.from),
    to: Array.isArray(data.to) ? data.to.map(asString) : [],
    cc: Array.isArray(data.cc) ? data.cc.map(asString) : [],
    subject: asString(data.subject),
    snippet: asString(data.snippet),
    bodyText: asString(data.bodyText),
    date: asString(data.date),
    unread: data.unread !== false,
    starred: Boolean(data.starred),
    labels: Array.isArray(data.labels) ? data.labels.map(asString) : [],
    aiCategory: (asString(data.aiCategory) as MailMessage["aiCategory"]) || "",
    aiSummary: asString(data.aiSummary),
    isMailingList: Boolean(data.isMailingList),
    listUnsubscribe: asString(data.listUnsubscribe),
    listUnsubscribePost: asString(data.listUnsubscribePost),
  };
}

export function useMail(scopeUserId?: string | null) {
  const uid = scopeUserId || null;
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [settings, setSettings] = useState<MailSettings>({
    instructions: DEFAULT_MAIL_INSTRUCTIONS,
    autoClassify: true,
  });
  const [aiResult, setAiResult] = useState<MailAiResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setAccounts([]);
      setMessages([]);
      setAiResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubAccounts = onSnapshot(collection(db, "mail", uid, "accounts"), (snap) => {
      setAccounts(snap.docs.map((item) => accountFromDoc(item.id, item.data())));
    });
    const unsubMessages = onSnapshot(collection(db, "mail", uid, "messages"), (snap) => {
      const rows = snap.docs.map((item) => messageFromDoc(item.id, item.data()));
      rows.sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || ""));
      setMessages(rows);
      setLoading(false);
    });
    const unsubSettings = onSnapshot(doc(db, "mail", uid, "settings", "ai"), (snap) => {
      const data = snap.data() || {};
      setSettings({
        instructions: asString(data.instructions) || DEFAULT_MAIL_INSTRUCTIONS,
        autoClassify: data.autoClassify !== false,
      });
    });
    const unsubAi = onSnapshot(doc(db, "mail", uid, "settings", "aiLast"), (snap) => {
      const data = snap.data();
      if (!data) {
        setAiResult(null);
        return;
      }
      setAiResult({
        summary: asString(data.summary),
        classified: Number(data.classified || 0),
        actions: Array.isArray(data.actions) ? data.actions : [],
        ranAt: asString(data.ranAt),
      });
    });
    return () => {
      unsubAccounts();
      unsubMessages();
      unsubSettings();
      unsubAi();
    };
  }, [uid]);

  const saveInstructions = useCallback(async (instructions: string) => {
    if (!uid) return;
    await setDoc(doc(db, "mail", uid, "settings", "ai"), {
      instructions,
      autoClassify: settings.autoClassify,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [uid, settings.autoClassify]);

  const patchMessage = useCallback(async (messageId: string, patch: Partial<MailMessage>) => {
    if (!uid) return;
    await updateDoc(doc(db, "mail", uid, "messages", messageId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const unreadCount = useMemo(
    () => messages.filter((message) => message.unread && message.folder !== "trash").length,
    [messages],
  );

  return {
    accounts,
    messages,
    settings,
    aiResult,
    loading,
    unreadCount,
    saveInstructions,
    patchMessage,
  };
}
