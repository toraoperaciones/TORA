import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-64 bg-layer-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg bg-layer-2" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg bg-layer-2" />
    </div>
  );
}
