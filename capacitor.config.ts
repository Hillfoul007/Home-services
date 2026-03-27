import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.laundrify.laundry.app',
  appName: 'Laundrify',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://home-services-5alb.onrender.com',
    cleartext: true
  }
};

export default config;
