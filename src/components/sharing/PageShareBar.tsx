import type { ReactNode } from "react";
import SharedScopeSwitcher from "@/components/sharing/SharedScopeSwitcher";
import ShareAccessButton from "@/components/sharing/ShareAccessButton";
import { useSharedScope } from "@/hooks/useSharedScope";

export default function PageShareBar({
  page,
  extra,
  access,
}: {
  page: string;
  extra?: ReactNode;
  access?: ReactNode;
}) {
  const { isOwnScope } = useSharedScope(page);

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <SharedScopeSwitcher page={page} />
      {isOwnScope && (access ?? <ShareAccessButton page={page} />)}
      {extra}
    </div>
  );
}
