// Browser push notification support for price alerts
// Uses the native Notifications API (no service worker required for in-tab notifications).
// For background push (when app is closed), a service worker + VAPID server would be needed.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'predx_push_permission';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

function readStoredPermission(): PushPermission {
  if (!('Notification' in window)) return 'unsupported';
  // Always reflect the live browser permission — localStorage is just a hint for UI
  return Notification.permission as PushPermission;
}

export interface PushNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;       // Deduplicate: same tag replaces previous notification
  silent?: boolean;
}

/**
 * Hook for requesting and sending browser push notifications.
 *
 * Usage:
 *   const { permission, requestPermission, notify, isSupported } = usePushNotifications();
 */
export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>(readStoredPermission);

  // Sync with actual browser permission on mount (user might have changed it in browser settings)
  useEffect(() => {
    setPermission(readStoredPermission());
  }, []);

  const isSupported = 'Notification' in window;

  /** Ask the user for notification permission. Returns the resulting permission state. */
  const requestPermission = useCallback(async (): Promise<PushPermission> => {
    if (!isSupported) return 'unsupported';
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return 'granted';
    }
    if (Notification.permission === 'denied') {
      setPermission('denied');
      return 'denied';
    }

    const result = await Notification.requestPermission();
    const next = result as PushPermission;
    setPermission(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
    return next;
  }, [isSupported]);

  /**
   * Fire a browser notification. Only works when permission is 'granted'.
   * Does nothing silently if permission is not granted.
   */
  const notify = useCallback(
    (title: string, options?: PushNotificationOptions): Notification | null => {
      if (!isSupported || Notification.permission !== 'granted') return null;
      try {
        return new Notification(title, {
          icon: options?.icon ?? '/favicon.ico',
          badge: options?.badge ?? '/favicon.ico',
          body: options?.body,
          tag: options?.tag,
          silent: options?.silent ?? false,
        });
      } catch {
        return null;
      }
    },
    [isSupported]
  );

  return {
    permission,
    isSupported,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    requestPermission,
    notify,
  };
}
