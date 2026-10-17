import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  color?: string;
};

export function ActionButton({ icon, label, onPress, color = colors.primary }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, { backgroundColor: color, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={22} color="#fff" />
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14, gap: 2 },
  label: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
