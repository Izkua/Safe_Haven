import NetInfo from '@react-native-community/netinfo';

/** Calls back with true/false whenever internet reachability changes. Returns unsubscribe. */
export function subscribeOnline(cb: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((s) => cb(!!s.isConnected && s.isInternetReachable !== false));
}

/** Unknown reachability is not enough to authorize a shared meeting-place change. */
export async function canChangeMeetingPlace(online: boolean): Promise<boolean> {
  if (!online) return false;
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch { return false; }
}
