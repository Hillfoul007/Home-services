import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.laundrify.laundry.app',
  appName: 'Laundrify',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['home-services-5alb.onrender.com']
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
