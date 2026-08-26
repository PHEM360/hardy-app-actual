import { useState } from "react";
import { Mail, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAppUsers } from "@/hooks/useAppUsers";
import { useAuth } from "@/auth/AuthContext";
import type { DogTagNotifyRecipient } from "@/lib/dogTagApi";
import { normalizeNotifyEmail } from "../../../functions/src/dogTagNotify";

export function DogTagNotifyExtras({
  petName,
  accessRecipients,
  notifyUids,
  notifyEmails,
  onChange,
}: {
  petName: string;
  accessRecipients: DogTagNotifyRecipient[] | null;
  notifyUids: string[];
  notifyEmails: string[];
  onChange: (patch: { notifyUids?: string[]; notifyEmails?: string[] }) => void;
}) {
  const { user } = useAuth();
  const appUsers = useAppUsers();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const accessIds = new Set((accessRecipients || []).map((item) => item.uid));
  const extraPeople = appUsers.filter((item) => item.id !== user?.uid && !accessIds.has(item.id));

  const addEmail = () => {
    const normalised = normalizeNotifyEmail(email);
    if (!normalised) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (notifyEmails.includes(normalised) || (accessRecipients || []).some((item) => item.email?.toLowerCase() === normalised)) {
      setEmailError("That address is already on the list.");
      return;
    }
    onChange({ notifyEmails: [...notifyEmails, normalised] });
    setEmail("");
    setEmailError("");
  };

  return (
    <div className="space-y-3">
      {accessRecipients && accessRecipients.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Alerts go to people with access to {petName}:{" "}
          <span className="font-medium text-foreground">{accessRecipients.map((item) => item.name).join(", ")}</span>
        </p>
      )}
      <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Extra people
        </p>
        {extraPeople.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No other app users to add.</p>
        ) : (
          extraPeople.map((item) => {
            const on = notifyUids.includes(item.id);
            return (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={on}
                  onCheckedChange={(value) => onChange({
                    notifyUids: value === true
                      ? [...notifyUids, item.id]
                      : notifyUids.filter((id) => id !== item.id),
                  })}
                />
                <span className="min-w-0 truncate">{item.name}</span>
              </label>
            );
          })
        )}
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Extra emails
        </p>
        {notifyEmails.map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-lg border border-border/50 bg-[color-mix(in_srgb,hsl(32_92%_50%)_10%,hsl(var(--card)))] px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{item}</span>
            <button
              type="button"
              aria-label={`Remove ${item}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange({ notifyEmails: notifyEmails.filter((value) => value !== item) })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-1.5">
          <Input
            type="email"
            value={email}
            onChange={(event) => { setEmail(event.target.value); setEmailError(""); }}
            onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addEmail())}
            placeholder="neighbour@email.com"
            className="h-9 rounded-lg text-xs"
            aria-label="Extra scan alert email"
          />
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg px-2.5" onClick={addEmail}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {emailError && <p className="text-[11px] text-destructive">{emailError}</p>}
      </div>
    </div>
  );
}
