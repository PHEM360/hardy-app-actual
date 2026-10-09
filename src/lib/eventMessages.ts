export type EventMessageVia = "sms" | "whatsapp" | "email" | "imessage";

export interface CalendarMessagePlan {
  id: string;
  via: EventMessageVia;
  to: string;
  body: string;
  sendAt: string;
  sentAt?: string;
}

export function newMessagePlanId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg_${Date.now()}`;
}

export function emptyMessagePlan(sendAt: string): CalendarMessagePlan {
  return { id: newMessagePlanId(), via: "sms", to: "", body: "", sendAt };
}

function digits(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function composerUrl(plan: Pick<CalendarMessagePlan, "via" | "to" | "body">) {
  const text = encodeURIComponent(plan.body || "");
  const to = plan.to.trim();
  if (plan.via === "email") {
    return `mailto:${encodeURIComponent(to)}?body=${text}`;
  }
  if (plan.via === "whatsapp") {
    const phone = digits(to).replace(/^\+/, "");
    return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  }
  const phone = digits(to);
  return `sms:${phone}?&body=${text}`;
}

export function messageViaLabel(via: EventMessageVia) {
  if (via === "whatsapp") return "WhatsApp";
  if (via === "email") return "Email";
  if (via === "imessage") return "iMessage";
  return "Text";
}
