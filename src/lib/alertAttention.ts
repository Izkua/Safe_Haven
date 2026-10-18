/** Per-warning gates survive screen navigation. Sound and haptics each get one first delivery. */
export function createAlertAttentionGate() {
  const seen = { sound: new Set<string>(), haptics: new Set<string>() };
  return (id: string, channel: keyof typeof seen): boolean => {
    if (seen[channel].has(id)) return false;
    seen[channel].add(id);
    return true;
  };
}
export const claimAlertAttention = createAlertAttentionGate();
