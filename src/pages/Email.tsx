import { Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";

export default function Email() {
  const navigate = useNavigate();

  return (
    <FeaturePageShell
      title="Email"
      subtitle="Family inbox"
      icon={<Mail className="h-5 w-5" />}
    >
      <div
        className="rounded-2xl border border-border/40 px-6 py-12 text-center shadow-card"
        style={{
          background: "color-mix(in srgb, hsl(239, 70%, 58%) 12%, hsl(var(--card)))",
          borderLeftWidth: 4,
          borderLeftColor: "hsl(239, 70%, 58%)",
        }}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
          <Mail className="h-6 w-6" />
        </div>
        <p className="font-display text-xl font-bold">Not just yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Email isn’t built here yet. This shortcut is ready for when it is.
        </p>
        <Button className="mt-5 rounded-xl bg-gradient-primary" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    </FeaturePageShell>
  );
}
