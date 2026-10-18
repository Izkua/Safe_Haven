// [OWNER: UI] Map marker for a group member: a colored circle with their initial.
// "Need help" gets a thick red ring and a "!" badge so it can't be missed; "safe" gets a green check.
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import type { MemberStatus } from '@/types';

type Props = { name: string; color: string; status: MemberStatus };

export function memberInitial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

export function MemberPin({ name, color, status }: Props) {
  const needsHelp = status === 'need_help';
  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { backgroundColor: color }, needsHelp && styles.helpRing]}>
        <Text style={styles.initial}>{memberInitial(name)}</Text>
      </View>
      {needsHelp && (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={styles.badgeText}>!</Text>
        </View>
      )}
      {status === 'safe' && (
        <View style={[styles.badge, { backgroundColor: colors.safe }]}>
          <Ionicons name="checkmark" size={12} color="#fff" />
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
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  helpRing: { borderColor: colors.danger, borderWidth: 4 },
  initial: { color: '#fff', fontSize: 18, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
});
