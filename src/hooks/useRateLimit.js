import { useRef, useState, useCallback } from "react";

const MAX_ATTEMPTS   = 5;      // lockout after this many failures
const WINDOW_MS      = 15 * 60 * 1000; // 15-minute sliding window
const LOCKOUT_MS     = 10 * 60 * 1000; // 10-minute lockout

// Progressive delay per failure count (ms)
const DELAYS = [0, 1000, 2000, 5000, 10000];

/**
 * In-memory (not persisted) rate limiter.
 * State resets on page reload, which is acceptable —
 * Firebase Auth itself has server-side brute-force protection.
 */
export function useRateLimit() {
  const attempts    = useRef([]);   // timestamps of failures in the current window
  const lockedUntil = useRef(null); // Date of lockout expiry

  const [blocked, setBlocked]   = useState(false);
  const [remaining, setRemaining] = useState(0); // seconds until unlocked

  // Call before each attempt — returns { allowed, delay }
  const check = useCallback(() => {
    const now = Date.now();

    // Purge attempts outside the sliding window
    attempts.current = attempts.current.filter(t => now - t < WINDOW_MS);

    // Locked out?
    if (lockedUntil.current && now < lockedUntil.current) {
      const secs = Math.ceil((lockedUntil.current - now) / 1000);
      setBlocked(true);
      setRemaining(secs);
      return { allowed: false, delay: 0 };
    }

    // Clear any expired lockout
    if (lockedUntil.current && now >= lockedUntil.current) {
      lockedUntil.current = null;
      attempts.current    = [];
      setBlocked(false);
    }

    const count = attempts.current.length;
    const delay = DELAYS[Math.min(count, DELAYS.length - 1)];
    return { allowed: true, delay };
  }, []);

  // Call on each failed attempt
  const recordFailure = useCallback(() => {
    const now = Date.now();
    attempts.current.push(now);

    if (attempts.current.length >= MAX_ATTEMPTS) {
      lockedUntil.current = now + LOCKOUT_MS;
      setBlocked(true);
      setRemaining(Math.ceil(LOCKOUT_MS / 1000));

      // Count down the remaining timer
      const interval = setInterval(() => {
        const secs = Math.ceil((lockedUntil.current - Date.now()) / 1000);
        if (secs <= 0) {
          clearInterval(interval);
          attempts.current    = [];
          lockedUntil.current = null;
          setBlocked(false);
          setRemaining(0);
        } else {
          setRemaining(secs);
        }
      }, 1000);
    }
  }, []);

  // Call on successful login to clear the window
  const recordSuccess = useCallback(() => {
    attempts.current    = [];
    lockedUntil.current = null;
    setBlocked(false);
    setRemaining(0);
  }, []);

  return { check, recordFailure, recordSuccess, blocked, remaining };
}
