import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wholewealth.terminal',
  appName: 'WholeWealth',
  webDir: 'dist/public',
  server: {
    // In production or live mode, Capacitor can point to your live hosted terminal or bundle local static files
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#0c0c0e',
  },
};

export default config;
