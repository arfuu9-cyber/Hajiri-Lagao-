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
      backgroundColor: '#061736',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      android: {
        backgroundColor: '#061736',
      },
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#061736',
    },
  },
};

export default config;
