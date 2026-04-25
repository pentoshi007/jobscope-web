import { JobFeedSkeleton } from "./job-feed-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <JobFeedSkeleton />
    </div>
  );
}
