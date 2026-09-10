import * as React from "react";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";

/**
 * A Textarea that grows to fit its content instead of scrolling inside a
 * fixed-size box — resizes on every value change by measuring scrollHeight,
 * the standard React auto-grow-textarea recipe (reset height to "auto" so
 * the browser recalculates scrollHeight, then apply it).
 */
export const AutoGrowTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ style, onChange, value, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const resize = React.useCallback((el: HTMLTextAreaElement | null) => {
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    const setRefs = React.useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el;
        if (typeof forwardedRef === "function") forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
      },
      [forwardedRef],
    );

    React.useLayoutEffect(() => {
      resize(innerRef.current);
    }, [resize, value]);

    return (
      <Textarea
        ref={setRefs}
        value={value}
        onChange={(event) => {
          resize(event.target);
          onChange?.(event);
        }}
        style={{ resize: "none", overflow: "hidden", ...style }}
        {...props}
      />
    );
  },
);
AutoGrowTextarea.displayName = "AutoGrowTextarea";
