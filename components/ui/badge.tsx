import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "purple" | "green" | "muted" | "white";
  className?: string;
}

export function Badge({ children, variant = "purple", className }: BadgeProps) {
  const variants = {
    purple: "bg-brand-purple-muted text-brand-purple",
    green: "bg-brand-green-muted text-brand-green",
    muted: "bg-chillz-card text-chillz-muted",
    white: "bg-white/20 text-white",
  };
  return (
    <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold", variants[variant], className)}>
      {children}
    </span>
  );
}
