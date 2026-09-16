import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[rgba(26,43,74,0.06)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
