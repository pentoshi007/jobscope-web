import { Skeleton } from "@/components/ui/skeleton";
import { JobFeedSkeleton } from "../dashboard/job-feed-skeleton";

export default function Loading() {
  return (
    <div className="space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Skeleton className="h-9 w-full sm:w-64" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
      <JobFeedSkeleton />
    </div>
  );
}
