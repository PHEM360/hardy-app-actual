import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Landmark, Loader2 } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { completeBankConnect } from "@/lib/truelayerApi";

export default function FinanceBankCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    if (oauthError) {
      setError("Bank connection was cancelled.");
      return;
    }
    if (!code || !state) {
      setError("Missing bank connection details.");
      return;
    }
    completeBankConnect(code, state)
      .then(() => navigate("/finance?bank=connected", { replace: true }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not finish connecting the bank.";
        setError(message.replace(/^FirebaseError:\s*/i, ""));
      });
  }, [params, navigate]);

  return (
    <FeaturePageShell title="Connecting bank" subtitle="Finishing TrueLayer authorisation" icon={<Landmark className="w-5 h-5" />}>
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        {error ? (
          <>
            <p className="text-sm text-destructive text-center max-w-sm">{error}</p>
            <button className="text-sm text-primary font-semibold" onClick={() => navigate("/finance", { replace: true })}>
              Back to My Finance
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Connecting your bank…</p>
          </>
        )}
      </div>
    </FeaturePageShell>
  );
}
