import { useEffect, useRef } from 'react';

/**
 * Repeatedly calls `fn` every `intervalMs` milliseconds.
 * Stops when the component unmounts or `enabled` becomes false.
 */
export function usePolling(fn: () => void, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  
  // Keep the latest callback in a ref without resetting the interval.
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
