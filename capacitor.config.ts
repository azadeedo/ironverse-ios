import type { CapacitorConfig } from '@capacitor/cli'

// Ironverse iOS (App Store build). See docs/IOS.md.
//
// NEVER change `appId`, `server.iosScheme` or `server.hostname` after the first
// TestFlight/App Store release: the app's IndexedDB (every workout, meal and
// weigh-in) belongs to the capacitor://localhost origin. Changing it would make
// an update open an empty database.
const config: CapacitorConfig = {
  appId: 'com.nouriapps.ironverse',
  appName: 'Ironverse',
  webDir: 'dist',
  // everything is bundled in the app — no remote website is loaded
  server: {
    iosScheme: 'capacitor',
    hostname: 'localhost',
  },
  ios: {
    // the web app already pads for the notch / home indicator with env(safe-area-inset-*)
    contentInset: 'never',
    backgroundColor: '#0c111c',
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0c111c',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      iconColor: '#f59e0b',
    },
  },
}

export default config
