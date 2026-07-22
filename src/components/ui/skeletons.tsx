/**
 * Skeleton bundles — Sprint 7.5.
 * Substitui spinners genéricos nas telas principais.
 */
import { Skeleton } from '@/components/ui/skeleton';

function Row({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <Skeleton className={`${w} ${h}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-2 px-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="rounded-2xl p-6 card-premium space-y-4">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-2 w-full" />
      </div>
      <div className="rounded-2xl p-4 card-premium space-y-3">
        <Row w="w-24" h="h-3" />
        <Row />
        <Row w="w-3/4" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-2xl p-6 card-premium flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0,1,2,3].map(i => (
          <div key={i} className="rounded-xl p-4 card-premium space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-fade-in">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl p-4 card-premium flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export const HistorySkeleton = () => <ListSkeleton rows={6} />;
export const FinancialSkeleton = () => <ListSkeleton rows={5} />;
export const GoalsSkeleton = () => <ListSkeleton rows={3} />;
export const AchievementsSkeleton = () => (
  <div className="grid grid-cols-2 gap-3 animate-fade-in">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="rounded-xl p-4 card-premium space-y-2">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
);
