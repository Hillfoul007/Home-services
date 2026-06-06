import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface Permission {
  key: string;
  icon: string;
  title: string;
  reason: string;
  status: 'pending' | 'granted' | 'denied';
}

interface Props {
  onDone: () => void;
}

export default function RiderPermissionSetup({ onDone }: Props) {
  const [permissions, setPermissions] = useState<Permission[]>([
    {
      key: 'location',
      icon: '📍',
      title: 'Precise Location',
      reason: 'Required to show your position to the desk so orders can be assigned near you.',
      status: 'pending',
    },
    {
      key: 'background_location',
      icon: '🗺️',
      title: 'Background Location',
      reason: 'Keeps tracking your location even when your phone screen is off or app is minimized.',
      status: 'pending',
    },
    {
      key: 'notifications',
      icon: '🔔',
      title: 'Notifications',
      reason: 'Alerts you instantly when a new order is assigned so you never miss a pickup.',
      status: 'pending',
    },
  ]);
  const [step, setStep] = useState<'intro' | 'requesting' | 'done'>('intro');
  const [current, setCurrent] = useState(0);
  const [requesting, setRequesting] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  const requestLocationPermission = async (): Promise<'granted' | 'denied'> => {
    if (!navigator.geolocation) return 'denied';
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (err) => resolve(err.code === 1 ? 'denied' : 'granted'), // code 1 = PERMISSION_DENIED
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const requestNotificationPermission = async (): Promise<'granted' | 'denied'> => {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  };

  const requestPermission = async (key: string): Promise<'granted' | 'denied'> => {
    try {
      if (key === 'notifications') {
        if (isNative) {
          // On native, try Capacitor push notifications plugin
          try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            const result = await PushNotifications.requestPermissions();
            return result.receive === 'granted' ? 'granted' : 'denied';
          } catch {
            return await requestNotificationPermission();
          }
        }
        return await requestNotificationPermission();
      }

      if (key === 'location' || key === 'background_location') {
        // Background geolocation plugin handles both when it starts
        // We just need to confirm the user grants the prompt
        const result = await requestLocationPermission();
        if (key === 'background_location' && result === 'granted') {
          // On Android 10+, background location is a separate step
          // The BackgroundGeolocation plugin will request it when tracking starts
          // We mark it granted here if foreground location is granted
          return 'granted';
        }
        return result;
      }
    } catch {
      return 'denied';
    }
    return 'granted';
  };

  const runPermissions = async () => {
    setStep('requesting');
    const updated = [...permissions];

    for (let i = 0; i < updated.length; i++) {
      setCurrent(i);
      setRequesting(true);
      const status = await requestPermission(updated[i].key);
      updated[i] = { ...updated[i], status };
      setPermissions([...updated]);
      setRequesting(false);
      // Small pause so user sees each permission resolve
      await new Promise((r) => setTimeout(r, 400));
    }

    setStep('done');
  };

  const statusIcon = (s: Permission['status'], isCurrent: boolean, idx: number) => {
    if (s === 'granted') return '✅';
    if (s === 'denied') return '❌';
    if (isCurrent && requesting) return '⏳';
    return idx < current ? '⏳' : '⬜';
  };

  if (step === 'intro') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="text-6xl mb-4">🛵</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">One-time Setup</h1>
          <p className="text-gray-500 text-sm mb-8">
            Laundrify needs a few permissions to work properly. We'll ask them all now — you won't need to touch any settings manually.
          </p>

          <div className="w-full space-y-3 mb-8">
            {permissions.map((p) => (
              <div key={p.key} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 text-left">
                <span className="text-2xl shrink-0">{p.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.reason}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 rounded-xl p-3 w-full text-left mb-8">
            <p className="text-xs text-blue-700 font-medium">🔋 Battery optimization</p>
            <p className="text-xs text-blue-600 mt-1">
              Android will also ask you to allow Laundrify to run in the background. Tap <strong>"Allow"</strong> — this keeps your location active when the screen is off.
            </p>
          </div>
        </div>

        <div className="px-6 pb-8">
          <button
            onClick={runPermissions}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-base active:bg-blue-700"
          >
            Grant All Permissions
          </button>
        </div>
      </div>
    );
  }

  if (step === 'requesting') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6">
        <div className="text-5xl mb-6">🔐</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Requesting Permissions</h2>
        <p className="text-sm text-gray-500 mb-8 text-center">Please tap "Allow" on each system dialog.</p>

        <div className="w-full space-y-3">
          {permissions.map((p, idx) => (
            <div
              key={p.key}
              className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${
                idx === current && requesting ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
              }`}
            >
              <span className="text-xl shrink-0">{p.icon}</span>
              <p className="flex-1 text-sm font-medium text-gray-800">{p.title}</p>
              <span className="text-lg">{statusIcon(p.status, idx === current, idx)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // done
  const allGranted = permissions.every((p) => p.status === 'granted');
  const anyDenied = permissions.some((p) => p.status === 'denied');

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-4">{allGranted ? '🎉' : '⚠️'}</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {allGranted ? "You're all set!" : 'Some permissions missing'}
      </h2>

      <div className="w-full space-y-2 my-6">
        {permissions.map((p) => (
          <div key={p.key} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 text-left">
            <span className="text-xl">{p.icon}</span>
            <p className="flex-1 text-sm font-medium text-gray-800">{p.title}</p>
            <span>{p.status === 'granted' ? '✅' : '❌'}</span>
          </div>
        ))}
      </div>

      {anyDenied && (
        <p className="text-xs text-red-500 mb-4">
          Some permissions were denied. Location tracking may not work correctly. You can enable them in Phone Settings → Apps → Laundrify → Permissions.
        </p>
      )}

      <button
        onClick={() => {
          localStorage.setItem('riderPermissionsSetupDone', '1');
          onDone();
        }}
        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-base active:bg-blue-700"
      >
        {allGranted ? 'Start Riding' : 'Continue Anyway'}
      </button>
    </div>
  );
}
