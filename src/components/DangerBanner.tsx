// [OWNER: UI] Persistent red banner for live danger: an active alert, or a group member asking for help.
// Danger must follow the user out of the alert screen; this is the only red banner in the app.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  action: string;
  onPress: () => void;
};

export function DangerBanner({ icon, title, action, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${action}`}
      accessibilityLiveRegion="assertive"
      onPress={onPress}
      style={({ pressed }) => [styles.banner, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name={icon} size={26} color={colors.onDanger} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.action}>{action}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.onDanger} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, backgroundColor: colors.danger, borderRadius: radius, paddingVertical: 10, paddingHorizontal: 14 },
  text: { flex: 1 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.onDanger },
  action: { fontSize: 15, lineHeight: 20, color: colors.onDanger },
});
