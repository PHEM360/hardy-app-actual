import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Hardy Hub buttons are tactile blocks, not floating pills: a squared corner,
// a lit top edge and a darker bottom edge (`btn-edge`), and a press that
// pushes the button down instead of a hover that lifts it. A leading icon
// sits in its own inset chip (`btn-icon`, see wrapLeadingIcon). See AGENTS.md.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-[0.01em] ring-offset-background transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px active:scale-[0.985] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "btn-edge bg-primary text-primary-foreground hover:brightness-110 [&_.btn-icon]:bg-black/20",
        gradient: "btn-edge bg-gradient-primary text-primary-foreground hover:brightness-110 [&_.btn-icon]:bg-black/20",
        gold: "btn-edge bg-gold text-gold-foreground hover:brightness-105 [&_.btn-icon]:bg-black/15",
        destructive:
          "btn-edge bg-destructive text-destructive-foreground hover:brightness-110 [&_.btn-icon]:bg-black/20",
        outline:
          "border border-foreground/30 bg-card text-foreground shadow-soft hover:border-primary hover:bg-accent hover:text-accent-foreground [&_.btn-icon]:bg-primary/15 [&_.btn-icon]:text-primary",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-muted [&_.btn-icon]:bg-primary/15 [&_.btn-icon]:text-primary",
        ghost: "hover:bg-accent hover:text-accent-foreground [&_.btn-icon]:bg-foreground/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/**
 * When a button is "icon then label", the icon is wrapped in a chip so every
 * such button in the app gets the same branded treatment without each caller
 * styling it. Icon-only buttons and label-only buttons are left untouched.
 */
function wrapLeadingIcon(children: React.ReactNode): React.ReactNode {
  const items = React.Children.toArray(children);
  if (items.length < 2) return children;
  const [first, ...rest] = items;
  const isLeafElement = React.isValidElement(first) && (first.props as { children?: unknown }).children === undefined;
  const hasLabel = rest.some((item) => (typeof item === "string" ? item.trim() !== "" : typeof item === "number" || React.isValidElement(item)));
  if (!isLeafElement || !hasLabel) return children;
  return [<span key="btn-icon" className="btn-icon">{first}</span>, ...rest];
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {asChild || variant === "link" ? children : wrapLeadingIcon(children)}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
