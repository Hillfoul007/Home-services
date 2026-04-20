package com.laundrify.laundry.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * LocationPlugin — Capacitor bridge to LocationForegroundService.
 *
 * JavaScript API:
 *   NativeLocation.startTracking()                          — starts the foreground service
 *   NativeLocation.stopTracking()                           — stops it
 *   NativeLocation.saveAuth({ riderId, token, apiUrl })     — persists auth for HTTP fallback
 *   NativeLocation.clearAuth()                              — clears auth on logout
 *   NativeLocation.addListener('location', cb)              — receives { lat, lng, accuracy }
 */
@CapacitorPlugin(name = "NativeLocation")
public class LocationPlugin extends Plugin {

    private static final String TAG   = "NativeLocationPlugin";
    static final String PREFS_NAME    = "laundrify_rider_prefs";

    /** Called once by Capacitor when the plugin is loaded. */
    @Override
    public void load() {
        LocationForegroundService.pluginRef = new java.lang.ref.WeakReference<>(this);
        Log.i(TAG, "Plugin loaded");
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        // On targetSDK 34+ (Android 14+), starting a foreground service with
        // foregroundServiceType="location" throws SecurityException if the app
        // doesn't already hold ACCESS_FINE_LOCATION or ACCESS_COARSE_LOCATION
        // at runtime. Guard here so JS falls back to watchPosition gracefully.
        boolean hasFine = ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean hasCoarse = ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;

        if (!hasFine && !hasCoarse) {
            Log.w(TAG, "startTracking skipped — location permission not yet granted");
            call.resolve(); // JS watchPosition fallback will handle tracking
            return;
        }

        LocationForegroundService.pluginRef = new java.lang.ref.WeakReference<>(this);

        Intent intent = new Intent(getContext(), LocationForegroundService.class);
        intent.setAction(LocationForegroundService.ACTION_START);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        Log.i(TAG, "startTracking called — Fused Location service started");
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Intent intent = new Intent(getContext(), LocationForegroundService.class);
        intent.setAction(LocationForegroundService.ACTION_STOP);
        getContext().startService(intent);

        Log.i(TAG, "stopTracking called");
        call.resolve();
    }

    /**
     * Persist rider auth (riderId + JWT token + API base URL) in SharedPreferences so the
     * foreground service can HTTP-POST location when the WebView/JS is not running.
     */
    @PluginMethod
    public void saveAuth(PluginCall call) {
        String riderId = call.getString("riderId", "");
        String token   = call.getString("token",   "");
        String apiUrl  = call.getString("apiUrl",  "");

        getContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("riderId", riderId)
            .putString("token",   token)
            .putString("apiUrl",  apiUrl)
            .apply();

        Log.i(TAG, "Auth saved — rider: " + riderId);
        call.resolve();
    }

    /**
     * Clear saved auth on rider logout.
     */
    @PluginMethod
    public void clearAuth(PluginCall call) {
        getContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove("riderId")
            .remove("token")
            .remove("apiUrl")
            .apply();

        Log.i(TAG, "Auth cleared");
        call.resolve();
    }

    /**
     * Called by LocationForegroundService on every smoothed GPS fix.
     * Runs on the main thread (same Looper as location callback).
     */
    public void onLocationReceived(double lat, double lng, float accuracy) {
        // Mark JS as alive — service uses this to decide if HTTP fallback is needed
        LocationForegroundService.lastJsCallMs = System.currentTimeMillis();

        JSObject data = new JSObject();
        data.put("lat",      lat);
        data.put("lng",      lng);
        data.put("accuracy", accuracy);
        data.put("ts",       System.currentTimeMillis());
        notifyListeners("location", data);
    }
}
