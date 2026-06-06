package com.laundrify.laundry.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.Granularity;
import com.google.android.gms.location.LocationAvailability;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * LocationForegroundService
 *
 * Android Foreground Service that uses Google's Fused Location Provider
 * to get the best possible GPS fixes (GPS + network + WiFi fused).
 * Raw fixes are fed through a Kalman filter before being forwarded to
 * the Capacitor plugin.
 *
 * Update rate  : 2 s preferred, 1 s fastest, 4 s max batch delay
 * Priority     : PRIORITY_HIGH_ACCURACY (forces GPS hardware on)
 * Kalman noise : 25 m/s process noise (handles riding speed)
 *
 * HTTP fallback:
 *   When the WebView/JS is not running (app killed or deeply backgrounded),
 *   the service posts location via HTTP directly using auth stored in
 *   SharedPreferences by LocationPlugin.saveAuth().
 *   This guarantees continuous tracking as long as the rider is logged in.
 */
public class LocationForegroundService extends Service {

    private static final String TAG        = "LaundrifyLocation";
    static final String CHANNEL_ID         = "laundrify_live_location";
    static final String ACTION_START       = "com.laundrify.laundry.app.ACTION_START";
    static final String ACTION_STOP        = "com.laundrify.laundry.app.ACTION_STOP";
    private static final int NOTIF_ID      = 7331;

    // How long since the last JS consumption before we consider JS dead
    private static final long JS_STALE_MS       = 15_000;  // 15 s
    // Minimum gap between HTTP fallback POSTs
    private static final long HTTP_MIN_INTERVAL = 8_000;   // 8 s

    // Shared state — LocationPlugin reads this to forward events to JS
    static volatile double lastLat      = 0;
    static volatile double lastLng      = 0;
    static volatile float  lastAccuracy = 0;
    static volatile float  lastHeading  = 0;
    static volatile long   lastTimeMs   = 0;

    // Updated by LocationPlugin.onLocationReceived() whenever JS is alive
    static volatile long lastJsCallMs   = 0;

    // Weak ref to plugin so we can push events without leaking it
    static WeakReference<LocationPlugin> pluginRef = new WeakReference<>(null);

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private KalmanLatLng kalman;

    // Track last HTTP POST time (instance-level, not static — one service at a time)
    private long lastHttpPostMs = 0;

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        fusedClient = LocationServices.getFusedLocationProviderClient(this);
        kalman      = new KalmanLatLng();
        createNotificationChannel();
        Log.i(TAG, "Service created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();

        if (ACTION_STOP.equals(action)) {
            Log.i(TAG, "Stop requested");
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Start foreground with persistent notification (survives screen-off)
        startForeground(NOTIF_ID, buildNotification());
        startLocationUpdates();

        // Restart automatically if killed by OS
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopLocationUpdates();
        Log.i(TAG, "Service destroyed");
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Location updates ───────────────────────────────────────────────────────

    private void startLocationUpdates() {
        LocationRequest request = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 2000L)        // preferred interval: 2 s
            .setMinUpdateIntervalMillis(1000L)                  // fastest: 1 s
            .setMaxUpdateDelayMillis(4000L)                     // batch delay: 4 s max
            .setGranularity(Granularity.GRANULARITY_FINE)       // fine-grained (GPS)
            .setWaitForAccurateLocation(false)                  // don't wait for perfect fix
            .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                for (Location loc : result.getLocations()) {
                    handleRawFix(loc);
                }
            }

            @Override
            public void onLocationAvailability(LocationAvailability availability) {
                Log.d(TAG, "Location available: " + availability.isLocationAvailable());
            }
        };

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
            Log.i(TAG, "Location updates started");
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission not granted", e);
        }
    }

    private void stopLocationUpdates() {
        if (fusedClient != null && locationCallback != null) {
            fusedClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
        }
    }

    private void handleRawFix(Location loc) {
        // Feed raw fix through Kalman filter
        kalman.process(loc.getLatitude(), loc.getLongitude(),
                       loc.getAccuracy(), loc.getTime());

        double smoothLat = kalman.getLat();
        double smoothLng = kalman.getLng();
        float  accuracy  = loc.getAccuracy();
        float  heading   = loc.hasBearing() ? loc.getBearing() : 0f;

        // Update shared volatile state
        lastLat      = smoothLat;
        lastLng      = smoothLng;
        lastAccuracy = accuracy;
        lastHeading  = heading;
        lastTimeMs   = System.currentTimeMillis();

        Log.v(TAG, String.format("Fix: %.6f, %.6f  acc=%.1fm  hdg=%.0f°", smoothLat, smoothLng, accuracy, heading));

        // ── Path 1: Push to JS via plugin ────────────────────────────────────
        LocationPlugin plugin = pluginRef.get();
        if (plugin != null) {
            plugin.onLocationReceived(smoothLat, smoothLng, accuracy, heading);
        }

        // ── Path 2: HTTP fallback when JS/WebView is dead ────────────────────
        // If JS hasn't consumed a fix in JS_STALE_MS, post directly via HTTP.
        // This keeps tracking alive when the app is killed/deeply backgrounded.
        long now       = System.currentTimeMillis();
        boolean jsAlive = lastJsCallMs > 0 && (now - lastJsCallMs) < JS_STALE_MS;
        boolean throttleOk = (now - lastHttpPostMs) >= HTTP_MIN_INTERVAL;

        if (!jsAlive && throttleOk) {
            lastHttpPostMs = now;
            postLocationViaHttp(smoothLat, smoothLng);
        }
    }

    /**
     * Fire-and-forget HTTP POST to the rider location endpoint.
     * Auth is read from SharedPreferences (saved by LocationPlugin.saveAuth).
     */
    private void postLocationViaHttp(double lat, double lng) {
        SharedPreferences prefs = getSharedPreferences(LocationPlugin.PREFS_NAME, MODE_PRIVATE);
        String riderId = prefs.getString("riderId", "");
        String token   = prefs.getString("token",   "");
        String apiUrl  = prefs.getString("apiUrl",  "");  // e.g. https://api.laundrify.online/api/riders/location

        if (riderId.isEmpty() || token.isEmpty() || apiUrl.isEmpty()) {
            Log.d(TAG, "HTTP fallback skipped — no auth saved");
            return;
        }

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        String ts = sdf.format(new Date());

        // Build JSON body matching the existing /riders/location endpoint
        String json = "{\"riderId\":\"" + riderId + "\","
                    + "\"location\":{\"lat\":" + lat + ",\"lng\":" + lng + ",\"heading\":" + lastHeading + "},"
                    + "\"timestamp\":\"" + ts + "\"}";

        final String finalToken = token;
        final String finalApiUrl = apiUrl;
        final String finalJson   = json;

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(finalApiUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + finalToken);
                conn.setDoOutput(true);
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);

                byte[] body = finalJson.getBytes("UTF-8");
                OutputStream os = conn.getOutputStream();
                os.write(body);
                os.flush();

                int code = conn.getResponseCode();
                Log.d(TAG, "HTTP fallback POST → " + code + "  lat=" + lat + " lng=" + lng);
            } catch (Exception e) {
                Log.w(TAG, "HTTP fallback POST failed: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    // ── Notification ───────────────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Live Location Tracking",
                NotificationManager.IMPORTANCE_LOW   // low = no sound, no pop-up
            );
            channel.setDescription("Keeps rider location visible to the desk");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        // Tapping the notification opens the app
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openIntent = PendingIntent.getActivity(
            this, 0, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Laundrify — Live Tracking ON")
            .setContentText("Your location is being shared with the desk")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(openIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)           // cannot be swiped away
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }
}
