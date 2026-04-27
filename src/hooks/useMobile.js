import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport is ≤ 768px.
 * Components use this to switch between desktop and mobile inline styles,
 * keeping desktop layouts exactly as designed while collapsing on mobile.
 */
export function useMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    setMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

/**
 * Helper: returns mobile value when on mobile, desktop value otherwise.
 * Usage: g(isMobile, '1fr', '1fr 1fr 1fr')
 */
export const g = (isMobile, mobileVal, desktopVal) => isMobile ? mobileVal : desktopVal;
