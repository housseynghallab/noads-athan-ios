import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.housseyn.noadsathan',
  appName: 'NoAds Athan',
  webDir: 'www',
  ios: {
    // The UI is a TV-style landscape-friendly layout; allow the web view
    // to use the full screen on notched devices.
    contentInset: 'never',
  },
  plugins: {
    LocalNotifications: {
      // Small icon used by Android notifications (unused on iOS, kept for
      // config parity with the Android build).
      smallIcon: 'ic_launcher',
      iconColor: '#0b1e3a',
    },
  },
};

export default config;
