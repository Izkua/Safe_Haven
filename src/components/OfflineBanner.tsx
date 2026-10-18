// [OWNER: UI] "No signal" band. Being offline isn't danger, so it's ink, not red or amber.
import { StyleSheet, Text } from 'react-native';
import { formatAge } from '@/lib/geo';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';

export function OfflineBanner() {
  const { isOnline, lastSyncedAt } = useApp().state;
  if (isOnline) return null;
  return (
    <Text style={styles.banner} accessibilityRole="alert">
      No signal · last synced {lastSyncedAt ? formatAge(Date.now() - lastSyncedAt) : 'never'}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.text, color: colors.bg, fontSize: 15, fontWeight: '700', paddingVertical: 8, paddingHorizontal: 12 },
});
