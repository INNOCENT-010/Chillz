"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "green" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base = "relative inline-flex items-center justify-center font-semibold rounded-2xl transition-all tap-effect focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      primary: "bg-brand-purple text-white hover:bg-brand-purple-light active:bg-brand-purple-deep",
      secondary: "bg-chillz-card text-brand-purple hover:bg-brand-purple-muted",
      ghost: "bg-transparent text-brand-purple hover:bg-chillz-card",
      green: "bg-brand-green text-white hover:bg-brand-green-light glow-green",
      outline: "border-2 border-brand-purple text-brand-purple bg-transparent hover:bg-brand-purple-muted",
    };
    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    };
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...(props as any)}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Loading...
          </span>
        ) : children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
