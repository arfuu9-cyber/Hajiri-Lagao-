import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.workers.attendance',
  appName: 'Hajiri Lagao',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      backgroundColor: '#0A6B4B',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      android: {
        backgroundColor: '#0A6B4B',
      },
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0A6B4B',
    },
  },
};

export default config;
