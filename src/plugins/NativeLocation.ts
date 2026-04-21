import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number; // degrees 0-360, 0 if unavailable
  ts: number;
}

export interface NativeLocationPlugin {
  startTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  /** Save rider auth so the foreground service can HTTP-POST when the WebView is paused. */
  saveAuth(opts: { riderId: string; token: string; apiUrl: string }): Promise<void>;
  /** Clear saved auth on logout. */
  clearAuth(): Promise<void>;
  /** Prompt the system dialog to exclude this app from battery optimisation (Doze/OEM killers). */
  requestBatteryExemption(): Promise<void>;
  addListener(
    eventName: 'location',
    listenerFunc: (update: LocationUpdate) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

// On web the plugin is a no-op stub — actual tracking uses navigator.geolocation
const webStub: NativeLocationPlugin = {
  startTracking:          async () => {},
  stopTracking:           async () => {},
  saveAuth:               async () => {},
  clearAuth:              async () => {},
  requestBatteryExemption: async () => {},
  addListener:            async () => ({ remove: async () => {} }),
  removeAllListeners:     async () => {},
};

const NativeLocation = registerPlugin<NativeLocationPlugin>('NativeLocation', {
  web: webStub,
});

export default NativeLocation;
