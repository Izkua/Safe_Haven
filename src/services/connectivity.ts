import NetInfo from '@react-native-community/netinfo';

/** Calls back with true/false whenever internet reachability changes. Returns unsubscribe. */
export function subscribeOnline(cb: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((s) => cb(!!s.isConnected && s.isInternetReachable !== false));
}
