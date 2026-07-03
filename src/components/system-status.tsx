'use client';

import { useEffect, useState } from 'react';

/**
 * A client-side component to display the current system time.
 * Prevents hydration mismatch by using a mounted check.
 */
export function SystemStatus() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState<string>('--:--');

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return <span>--:--</span>;

  return <span>{time}</span>;
}
