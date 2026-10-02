/**
 * LibraryOS Motion Utilities
 * Reusable hooks and helpers for the animation system.
 * No external animation library needed — pure CSS + React.
 */
import { useEffect, useRef, useState } from 'react';

/* ─── REDUCED MOTION DETECTION ─────────────────────────────────── */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/* ─── INTERSECTION OBSERVER HOOK ───────────────────────────────── */
/**
 * Returns [ref, isVisible]. Element animates once when it enters viewport.
 * @param {number} threshold - 0–1, default 0.12
 */
export function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect(); // animate once only
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}

/* ─── ANIMATED NUMBER HOOK ─────────────────────────────────────── */
/**
 * Animates a number from 0 → target when `active` becomes true.
 * Returns the current display value.
 *
 * @param {number} target  - final value
 * @param {boolean} active - start animating when true
 * @param {number} duration - ms, default 800
 */
export function useAnimatedNumber(target, active, duration = 800) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!active) return;

    // Respect reduced motion — just jump to target
    if (reduced) {
      setCurrent(target);
      return;
    }

    const startTime = performance.now();
    const startValue = 0;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(startValue + (target - startValue) * eased);
      setCurrent(value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, active, duration, reduced]);

  return current;
}

/* ─── STAGGER CHILDREN CLASSES ─────────────────────────────────── */
/**
 * Returns the CSS class for staggered animation on a child item.
 * @param {number} index - 0-based child index
 * @param {string} baseClass - e.g. 'anim-fade-up'
 */
export function staggerClass(index, baseClass = 'anim-fade-up') {
  const delayClass = `anim-delay-${Math.min(index + 1, 8)}`;
  return `${baseClass} ${delayClass}`;
}

/* ─── PAGE KEY ─────────────────────────────────────────────────── */
/**
 * Returns a key that forces re-mount (and re-animation) on page change.
 */
export function usePageKey(activePage) {
  return activePage;
}
