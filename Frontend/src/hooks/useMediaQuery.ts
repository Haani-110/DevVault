import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * Needed where behaviour, not just styling, depends on the breakpoint. The
 * sidebar is the case that forced the question: on desktop it is a permanent
 * panel, on mobile an off-canvas drawer — and "is it currently the drawer?" is
 * something the component has to know, not guess from CSS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => read(query));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Environments without matchMedia simply get the unmatched answer. */
function read(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;
}
