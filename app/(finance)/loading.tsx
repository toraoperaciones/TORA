import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-16" />
      <Skeleton className="h-72" />
    </div>
  );
}
