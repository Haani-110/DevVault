import Skeleton from '@/components/ui/Skeleton';

/**
 * What a page area shows while its chunk downloads.
 *
 * Shaped like the pages it replaces — a heading, then a grid of cards — so the
 * layout does not jump when the real content arrives. It renders inside the
 * dashboard shell, so the sidebar and navbar stay put during the swap.
 */
export default function RouteFallback() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
      <span className="sr-only">Loading this page…</span>
    </div>
  );
}
