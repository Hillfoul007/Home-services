import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.laundrify.rider.app',
  appName: 'Laundrify Rider',
  webDir: 'dist-rider',
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
