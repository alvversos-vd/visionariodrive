import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // CTA principal — gradiente da marca + glow sutil no hover
        default:
          "bg-gradient-brand text-primary-foreground shadow-glow-sm hover:shadow-glow hover:brightness-105",
        // Ação destrutiva
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-elevated",
        // Outline hairline — para ações secundárias
        outline:
          "border border-border bg-card/40 text-foreground hover:bg-card hover:border-border",
        // Superfície secundária
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // Sem fundo — para toolbar e icon buttons
        ghost: "text-foreground/80 hover:bg-secondary hover:text-foreground",
        // Link inline
        link: "text-primary underline-offset-4 hover:underline hover:text-primary-glow",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-6 text-base",
        icon: "h-10 w-10",
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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
