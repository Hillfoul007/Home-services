package com.laundrify.laundry.app;

/**
 * 1-D Kalman filter applied independently to latitude and longitude.
 *
 * Smooths raw GPS noise while staying responsive to real movement.
 * Process noise is modelled as ~3 m/s max drift (walking / riding speed).
 */
public class KalmanLatLng {

    /** Minimum GPS accuracy floor in metres to avoid divide-by-near-zero. */
    private static final float MIN_ACCURACY = 1f;

    /** Speed estimate used for process noise (m/s). 25 m/s ≈ 90 km/h — fast enough for riders. */
    private static final double PROCESS_NOISE_MS = 25.0;

    private long  timestampMs;
    private double lat;
    private double lng;

    /**
     * P — variance of the estimate in metres².
     * Negative means "not yet initialised".
     */
    private double variance = -1;

    /** @return true once at least one GPS fix has been processed. */
    public boolean hasEstimate() { return variance >= 0; }

    /**
     * Feed a new raw GPS measurement into the filter.
     *
     * @param lat         raw latitude
     * @param lng         raw longitude
     * @param accuracyM   horizontal accuracy reported by GPS (metres, 1-sigma)
     * @param timeMs      epoch millis of the fix
     */
    public void process(double lat, double lng, float accuracyM, long timeMs) {
        if (accuracyM < MIN_ACCURACY) accuracyM = MIN_ACCURACY;

        if (variance < 0) {
            // First fix — initialise state directly from measurement
            this.timestampMs = timeMs;
            this.lat = lat;
            this.lng = lng;
            this.variance = (double) accuracyM * accuracyM;
            return;
        }

        // ── Predict step ──
        long dtMs = timeMs - this.timestampMs;
        if (dtMs > 0) {
            // Grow uncertainty by (speed * time)^2 to account for movement
            double dtSec = dtMs / 1000.0;
            variance += dtSec * PROCESS_NOISE_MS * PROCESS_NOISE_MS;
            this.timestampMs = timeMs;
        }

        // ── Update step ──
        double measurementVariance = (double) accuracyM * accuracyM;
        double K = variance / (variance + measurementVariance); // Kalman gain

        this.lat     += K * (lat - this.lat);
        this.lng     += K * (lng - this.lng);
        this.variance = (1.0 - K) * variance;
    }

    public double getLat() { return lat; }
    public double getLng() { return lng; }
}
