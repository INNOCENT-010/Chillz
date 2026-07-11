import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} />;
}

export function VenueCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-64 space-y-3">
      <Skeleton className="w-full h-40 rounded-3xl" />
      <Skeleton className="w-3/4 h-4" />
      <Skeleton className="w-1/2 h-3" />
    </div>
  );
}
