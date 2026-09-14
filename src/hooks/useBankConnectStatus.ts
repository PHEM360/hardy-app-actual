import { useEffect, useState } from "react";
import { getBankConnectStatus } from "@/lib/truelayerApi";

export function useBankConnectStatus() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [sandbox, setSandbox] = useState(true);
  const [mismatch, setMismatch] = useState(false);
  const [using, setUsing] = useState<"sandbox" | "live">("sandbox");

  useEffect(() => {
    void getBankConnectStatus().then((status) => {
      setConfigured(status.configured);
      setSandbox(status.sandbox);
      setMismatch(status.mismatch === true);
      setUsing(status.using === "live" ? "live" : "sandbox");
    });
  }, []);

  return { configured, sandbox, mismatch, using };
}
