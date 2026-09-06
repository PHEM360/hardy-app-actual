import { useEffect, useState } from "react";
import { getBankConnectStatus } from "@/lib/truelayerApi";

export function useBankConnectStatus() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [sandbox, setSandbox] = useState(true);

  useEffect(() => {
    void getBankConnectStatus().then((status) => {
      setConfigured(status.configured);
      setSandbox(status.sandbox);
    });
  }, []);

  return { configured, sandbox };
}
