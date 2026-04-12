package com.laundrify.laundry.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * BootReceiver — restarts the rider app after a phone reboot so that
 * background location tracking resumes automatically without the rider
 * having to manually open the app.
 *
 * Requires: android.permission.RECEIVE_BOOT_COMPLETED (declared in manifest)
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        boolean isBoot = Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action);

        if (isBoot) {
            // Launch the app so RiderLocationContext auto-starts background tracking.
            // FLAG_ACTIVITY_NEW_TASK is required when starting from a non-Activity context.
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            launchIntent.putExtra("autostart", true);
            context.startActivity(launchIntent);
        }
    }
}
