package com.laundrify.laundry.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Register our native location plugin BEFORE super.onCreate so Capacitor
        // picks it up when the bridge initialises.
        registerPlugin(LocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
