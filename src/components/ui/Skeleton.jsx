export default function Skeleton({ className = '' }) {
  return (
    <span
      className={['skeleton-shimmer rounded inline-block', className].join(' ')}
    />
  );
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Card-style skeleton for dashboard stat cards */
export function SkeletonCard({ className = '' }) {
  return (
    <div className={['bg-[#131720] border border-[#1e2330] rounded-xl p-4 flex-1 min-w-0 space-y-3', className].join(' ')}>
      <div className="flex items-start justify-between">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-2.5 w-28" />
    </div>
  );
}
