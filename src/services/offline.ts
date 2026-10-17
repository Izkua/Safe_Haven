// [OWNER: MAP/OFFLINE] Persist everything needed to keep guiding the user with no network.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflineSnapshot } from '@/types';

const KEY = 'safehaven.snapshot.v1';

export async function loadSnapshot(): Promise<OfflineSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as OfflineSnapshot;
    return snap.version === 1 ? snap : null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(snap: Omit<OfflineSnapshot, 'version' | 'savedAt'>): Promise<void> {
  const full: OfflineSnapshot = { ...snap, version: 1, savedAt: Date.now() };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(full));
  } catch (e) {
    console.warn('saveSnapshot failed', e);
  }
}
