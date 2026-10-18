// [OWNER: UI] "No signal" banner. Being offline isn't danger, so it stays neutral.
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { formatAge } from '@/lib/geo';
import { useApp } from '@/state/AppContext';
import { colors, radius } from '@/theme';

export function OfflineBanner() {
  const { isOnline, lastSyncedAt } = useApp().state;
  if (isOnline) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={20} color={colors.text} />
      <Text style={styles.text}>
        No signal · last updated {lastSyncedAt ? formatAge(Date.now() - lastSyncedAt) : 'never'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius, paddingVertical: 10, paddingHorizontal: 14 },
  text: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
});
