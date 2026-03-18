'use client';

import { useEffect } from 'react';

/**
 * Dev 场景下清理同源历史 Service Worker 与 Cache，避免端口复用导致旧应用资源污染。
 */
export default function ServiceWorkerReset() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'development') return;
    if (!('serviceWorker' in navigator)) return;

    const clear = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      } catch {
        // no-op: 清理失败不影响主流程
      }
    };

    clear();
  }, []);

  return null;
}
