// Extends app.json at build time. Keeps secrets out of git: the Google Maps key for Android
// comes from the GOOGLE_MAPS_ANDROID_API_KEY environment variable (an EAS secret for cloud
// builds, or your shell for local builds). Only development/production builds use it; Expo Go
// ignores it and keeps using Expo's own key.
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      ['react-native-maps', androidKey ? { androidGoogleMapsApiKey: androidKey } : {}],
    ],
  };
};
