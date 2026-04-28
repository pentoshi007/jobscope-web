import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <Skeleton className="h-4 w-24" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="mt-6 h-9 w-32" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-2 py-6 sm:grid-cols-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 py-6">
              <Skeleton className="h-5 w-36" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                  key={i}
                  className="h-3 w-full"
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
