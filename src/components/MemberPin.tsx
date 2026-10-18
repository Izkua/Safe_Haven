// [OWNER: UI] Map marker for a group member: a colored circle with their initial.
// "Need help" gets a thick red ring and a "!" badge so it can't be missed; "safe" gets a green check.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import type { MemberStatus } from '@/types';

type Props = { name: string; color: string; status: MemberStatus; /** Profile picture data URI, shown instead of the initial. */ photo?: string | null };

export function memberInitial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

export function MemberPin({ name, color, status, photo }: Props) {
  const needsHelp = status === 'need_help';
  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { backgroundColor: color }, needsHelp && styles.helpRing]}>
        {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <Text style={styles.initial}>{memberInitial(name)}</Text>}
      </View>
      {needsHelp && (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={styles.badgeText}>!</Text>
        </View>
      )}
      {status === 'safe' && (
        <View style={[styles.badge, { backgroundColor: colors.safeFill }]}>
          <Ionicons name="checkmark" size={12} color={colors.onSafe} />
        </View>
      )}
    </View>
  );
}

const SIZE = 40;

const styles = StyleSheet.create({
  // Padding leaves room for the badge, which sits over the top-right edge.
  wrap: { padding: 6 },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  helpRing: { borderColor: colors.danger, borderWidth: 4 },
  initial: { color: colors.onDanger, fontSize: 18, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onDanger, fontSize: 12, fontWeight: '800' },
});
