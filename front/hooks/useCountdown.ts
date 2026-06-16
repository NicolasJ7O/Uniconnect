import { useState, useEffect, useRef } from 'react';

interface CountdownResult {
  minutes: number;
  seconds: number;
  expired: boolean;
  totalSeconds: number;
}

/**
 * Calculates a countdown from now to `targetDate`.
 * Updates every second. Returns `expired = true` when the date is reached.
 */
export function useCountdown(targetDate: string | Date | null | undefined): CountdownResult {
  const getRemaining = () => {
    if (!targetDate) return 0;
    const diff = new Date(targetDate).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  };

  const [totalSeconds, setTotalSeconds] = useState(getRemaining);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!targetDate) {
      setTotalSeconds(0);
      return;
    }

    // Recalculate immediately when targetDate changes
    setTotalSeconds(getRemaining());

    intervalRef.current = setInterval(() => {
      const remaining = getRemaining();
      setTotalSeconds(remaining);
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return { minutes, seconds, expired: totalSeconds <= 0, totalSeconds };
}
