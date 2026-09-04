import React from 'react';

export function SkeletonCard(): React.JSX.Element {
  return (
    <div className="animate-pulse flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm">
      <div className="w-8 h-8 bg-gray-200 rounded grid grid-cols-3 grid-rows-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="w-2 h-2 bg-gray-300 rounded-sm" />
        ))}
      </div>
      <div className="flex-1 space-y-1">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/4" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-10 bg-gray-200 rounded" />
        <div className="h-5 w-10 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export function SkeletonLoaders({ count = 3 }: { count?: number }): React.JSX.Element {
  return (
    <div className="space-y-2" role="status" aria-label="Loading drawers">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
