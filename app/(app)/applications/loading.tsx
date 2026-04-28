import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            key={i}
          >
            <CardContent className="flex items-baseline justify-between p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            key={i}
            className="space-y-3 p-3"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
