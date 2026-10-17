// [OWNER: UI] Remembers whether this device finished onboarding (AsyncStorage flag) and
// shares it with app/_layout.tsx, which only shows the onboarding screen until it's done.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DevSettings } from 'react-native';
import { DEMO_MODE, useApp } from '@/state/AppContext';

const KEY = 'safehaven.onboarded.v1';

type Onboarding = {
  onboarded: boolean;
  finishOnboarding(): Promise<void>;
  /** Dev helper: wipe all saved app data (snapshot, sign-in, flag) and reload, like a fresh install. */
  resetOnboarding(): Promise<void>;
};

const Ctx = createContext<Onboarding | null>(null);

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { hydrated, group, myName } = useApp().state;
  const [stored, setStored] = useState<string | null | undefined>(undefined);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(setStored, () => setStored(null));
  }, []);

  // Decide once, after both the flag and the offline snapshot have loaded. People who were
  // already named and in a group before onboarding existed skip it.
  useEffect(() => {
    if (onboarded !== null || stored === undefined || !hydrated) return;
    const existingUser = !DEMO_MODE && !!group && myName !== 'Me';
    if (stored === '1' || existingUser) {
      setOnboarded(true);
      if (stored !== '1') AsyncStorage.setItem(KEY, '1').catch(() => {});
    } else {
      setOnboarded(false);
    }
  }, [onboarded, stored, hydrated, group, myName]);

  const finishOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(KEY, '1').catch(() => {});
    setOnboarded(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await AsyncStorage.clear().catch(() => {});
    DevSettings.reload();
  }, []);

  const value = useMemo(
    () => ({ onboarded: !!onboarded, finishOnboarding, resetOnboarding }),
    [onboarded, finishOnboarding, resetOnboarding],
  );

  // Render nothing until we know, so the map doesn't flash before onboarding.
  if (onboarded === null) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOnboarding must be used inside <OnboardingGate>');
  return v;
}
