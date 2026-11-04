import React from 'react';

export type SwapVariant = 'view' | 'next' | 'prev';

/**
 * Plays an entrance animation every time it mounts. Give it a `key` that changes
 * when the content should animate (view or period changes).
 */
export const Swap: React.FC<{ variant?: SwapVariant; children: React.ReactNode }> = ({ variant = 'view', children }) => (
  <div className={`swap swap-${variant} swap-fill`}>{children}</div>
);
