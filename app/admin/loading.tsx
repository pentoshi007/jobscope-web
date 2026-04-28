import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            key={i}
            className="p-4"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-8 w-16" />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-3 p-4 sm:p-5">
          <Skeleton className="h-5 w-48" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
              key={i}
              className="h-28 w-full"
            />
          ))}
        </Card>
        <Card className="space-y-3 p-4 sm:p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-36 w-full" />
        </Card>
      </div>
    </div>
  );
}
