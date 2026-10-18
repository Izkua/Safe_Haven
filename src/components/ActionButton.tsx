// [OWNER: UI] Compact outline tool button for secondary map actions (≥56pt).
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, minTarget, radius } from '@/theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  /** Border + text color; defaults to ink. Use colors.danger only for danger actions. */
  color?: string;
};

export function ActionButton({ icon, label, onPress, color = colors.text }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { borderColor: color, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flex: 1, minHeight: minTarget, borderWidth: 1, borderRadius: radius, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 4 },
  label: { fontSize: 14, fontWeight: '600' },
});
