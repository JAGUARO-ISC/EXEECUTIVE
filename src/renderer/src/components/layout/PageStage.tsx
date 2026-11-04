import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@mantine/hooks';

const EXIT_MS = 120;

interface Props<P extends string> {
  page: P;
  render: (page: P) => React.ReactNode;
}

/**
 * Section transitions: the old page fades up and out (120ms), then the new page fades in
 * with a short cascade (see motion.css). Rapid navigation never queues: only the latest
 * target is shown. Reduced motion swaps instantly with a plain fade.
 */
export function PageStage<P extends string>({ page, render }: Props<P>) {
  const [shown, setShown] = useState<P>(page);
  const [leaving, setLeaving] = useState(false);
  const latest = useRef(page);
  latest.current = page;
  const reduced = useReducedMotion();
  const scroller = useRef<HTMLElement>(null);

  useEffect(() => {
    if (page === shown) {
      setLeaving(false);
      return;
    }
    if (reduced) {
      setShown(page);
      return;
    }
    setLeaving(true);
    const t = setTimeout(() => {
      setShown(latest.current);
      setLeaving(false);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [page, shown, reduced]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [shown]);

  return (
    <main className="content" ref={scroller}>
      <div key={shown} className={`swap swap-page${leaving ? ' stage-leave' : ''}`}>
        {render(shown)}
      </div>
    </main>
  );
}
