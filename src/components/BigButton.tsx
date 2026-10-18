// [OWNER: UI] Full-width, emergency-sized button (≥56pt tall). Use for primary actions.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, minTarget, radius } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  loading?: boolean;
};

export function BigButton({ label, onPress, variant = 'primary', icon, disabled, loading }: Props) {
  const filled = variant !== 'secondary';
  const bg = variant === 'danger' ? colors.danger : variant === 'primary' ? colors.primary : 'transparent';
  const fg = variant === 'danger' ? colors.onDanger : filled ? colors.onPrimary : colors.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: filled ? bg : colors.text, opacity: inactive ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={22} color={fg} />}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: minTarget,
    borderRadius: radius,
    borderWidth: 1,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  label: { fontSize: 19, fontWeight: '700' },
});
