import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor wraps the same dist/ bundle the website serves. The app ships its own files instead of
// loading workingartist.app, so it opens with no network and the studio stays on the phone.
// `npm run ios` builds and copies dist/ into the iOS project.
const config: CapacitorConfig = {
  appId: 'app.workingartist',
  appName: 'Working Artist',
  webDir: 'dist',
  plugins: {
    // Shrink the view above the keyboard instead of pushing the page up under the status bar.
    Keyboard: { resize: 'native' as never },
  },
  ios: {
    // The light page colour, so a rubber-band scroll shows no white gap.
    backgroundColor: '#F5F5F5',
    // The pages have no safe-area padding of their own yet: iOS keeps them clear of the notch and home bar.
    contentInset: 'always',
  },
}

export default config
