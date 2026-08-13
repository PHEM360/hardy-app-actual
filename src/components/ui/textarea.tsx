import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border-2 border-border bg-input px-3.5 py-2.5 text-sm text-foreground shadow-xs transition-all duration-200 ease-out placeholder:text-muted-foreground/70 hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
