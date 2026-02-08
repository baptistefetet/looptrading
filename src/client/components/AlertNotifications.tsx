import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface AlertItem {
  id: string;
  symbol: string;
  strategy: string;
  score: number | null;
}

interface AlertsResponse {
  data: AlertItem[];
}

interface AlertSettings {
  strategies: {
    pullback: boolean;
    breakout: boolean;
    macdCross: boolean;
  };
  minScore: number;
  pushNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string | null;
    end: string | null;
  };
}

interface AlertSettingsResponse {
  data: AlertSettings;
}

const PROMPTED_STORAGE_KEY = 'looptrading.notifications.prompted';

function strategyLabel(strategy: string): string {
  if (strategy === 'PULLBACK') return 'Pullback';
  if (strategy === 'BREAKOUT') return 'Breakout';
  if (strategy === 'MACD_CROSS') return 'MACD Cross';
  if (strategy === 'SCORE_THRESHOLD') return 'Score';
  return strategy;
}

function isInQuietHours(quietHours: AlertSettings['quietHours']): boolean {
  if (!quietHours.enabled || !quietHours.start || !quietHours.end) return false;

  const [startHour, startMinute] = quietHours.start.split(':').map(Number);
  const [endHour, endMinute] = quietHours.end.split(':').map(Number);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

function showAlertNotification(
  registration: ServiceWorkerRegistration | null,
  alert: AlertItem,
): void {
  const title = `Alerte: ${alert.symbol}`;
  const body = `${strategyLabel(alert.strategy)}${alert.score != null ? ` - Score ${alert.score}` : ''}`;
  const url = `/stocks/${encodeURIComponent(alert.symbol)}`;

  const worker = registration?.active ?? registration?.installing ?? registration?.waiting;
  if (worker) {
    worker.postMessage({
      type: 'SHOW_ALERT_NOTIFICATION',
      payload: {
        title,
        body,
        url,
        symbol: alert.symbol,
      },
    });
    return;
  }

  if ('Notification' in window) {
    const notification = new Notification(title, {
      body,
      data: { url },
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = url;
    };
  }
}

export function AlertNotifications() {
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const initializedRef = useRef(false);
  const seenAlertIdsRef = useRef(new Set<string>());

  const settingsQuery = useQuery({
    queryKey: ['settings', 'alerts'],
    queryFn: () => api.get<AlertSettingsResponse>('/settings/alerts'),
    refetchInterval: 30_000,
  });

  const alertsQuery = useQuery({
    queryKey: ['alerts', 'notifications'],
    queryFn: () => api.get<AlertsResponse>('/alerts?acknowledged=false&limit=20'),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    registerServiceWorker().then(setRegistration);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (!settingsQuery.data?.data.pushNotifications) return;
    if (Notification.permission !== 'default') return;

    const alreadyPrompted = localStorage.getItem(PROMPTED_STORAGE_KEY) === 'true';
    if (!alreadyPrompted) setShowPermissionPrompt(true);
  }, [settingsQuery.data]);

  useEffect(() => {
    const alertSettings = settingsQuery.data?.data;
    const alerts = alertsQuery.data?.data ?? [];
    if (alerts.length === 0) return;

    if (!initializedRef.current) {
      alerts.forEach((alert) => seenAlertIdsRef.current.add(alert.id));
      initializedRef.current = true;
      return;
    }

    const newAlerts: AlertItem[] = [];
    for (const alert of alerts) {
      if (seenAlertIdsRef.current.has(alert.id)) continue;
      seenAlertIdsRef.current.add(alert.id);
      newAlerts.push(alert);
    }

    if (newAlerts.length === 0) return;
    if (!alertSettings?.pushNotifications) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (isInQuietHours(alertSettings.quietHours)) return;

    newAlerts.forEach((alert) => showAlertNotification(registration, alert));
  }, [alertsQuery.data, settingsQuery.data, registration]);

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    try {
      await Notification.requestPermission();
    } finally {
      localStorage.setItem(PROMPTED_STORAGE_KEY, 'true');
      setShowPermissionPrompt(false);
    }
  };

  const handleDismissPrompt = () => {
    localStorage.setItem(PROMPTED_STORAGE_KEY, 'true');
    setShowPermissionPrompt(false);
  };

  if (!showPermissionPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[22rem] rounded-lg border border-dark-600 bg-dark-800 p-4 shadow-lg">
      <h3 className="text-sm font-semibold text-gray-100">
        Activer les notifications
      </h3>
      <p className="mt-2 text-sm text-gray-400">
        Recevez instantanement les nouvelles alertes de trading.
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={handleEnableNotifications} className="btn-primary text-sm">
          Activer
        </button>
        <button
          onClick={handleDismissPrompt}
          className="rounded-md border border-dark-600 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
