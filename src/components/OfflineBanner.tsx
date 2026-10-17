import { StyleSheet, Text } from 'react-native';
import { formatAge } from '@/lib/geo';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';

export function OfflineBanner() {
  const { isOnline, lastSyncedAt } = useApp().state;
  if (isOnline) return null;
  return (
    <Text style={styles.banner}>
      Offline · last synced {lastSyncedAt ? formatAge(Date.now() - lastSyncedAt) : 'never'}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.warn, color: '#000', fontWeight: '700', textAlign: 'center', paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
});
