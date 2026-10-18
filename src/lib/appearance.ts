// [OWNER: UI] Appearance preference: Dark (default), Light, or Match phone.
// Must not import '@/theme': the entry point (index.tsx) calls prepareAppearance() BEFORE the theme
// loads, so theme.ts can resolve colors from the saved choice (Android resolves colors only once).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Appearance, DevSettings, Platform } from 'react-native';

export type AppearancePref = 'dark' | 'light' | 'system';

const KEY = 'safehaven.appearance.v1';
export const DEFAULT_APPEARANCE: AppearancePref = 'dark';

let startupPref: AppearancePref = DEFAULT_APPEARANCE;

/** The preference loaded at startup (what theme.ts resolved colors with). */
export function getStartupPref(): AppearancePref {
  return startupPref;
}

function apply(pref: AppearancePref) {
  try {
    Appearance.setColorScheme?.(pref === 'system' ? 'unspecified' : pref);
  } catch {}
}

export async function loadAppearancePref(): Promise<AppearancePref> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === 'light' || v === 'system' || v === 'dark' ? v : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Called once by index.tsx before any screen (or the theme) loads. Never throws. */
export async function prepareAppearance(): Promise<void> {
  startupPref = await loadAppearancePref();
  apply(startupPref);
}

export async function setAppearancePref(pref: AppearancePref): Promise<void> {
  apply(pref);
  await AsyncStorage.setItem(KEY, pref).catch(() => {});
  // iOS swaps colors live. Android resolved them at launch, so it needs a restart to repaint.
  if (Platform.OS === 'android' && pref !== startupPref) {
    Alert.alert(
      'Restart to apply',
      'SafeHaven needs to restart to change its colors.',
      __DEV__
        ? [{ text: 'Later', style: 'cancel' }, { text: 'Restart now', onPress: () => DevSettings.reload() }]
        : [{ text: 'OK' }],
    );
  }
}
