// [OWNER: UI] The app's one button. Rounded, ≥56pt tall, icon + label, centered.
//   primary   – filled, the main action on a screen
//   secondary – tonal fill, everything else
//   danger    – red fill, danger only
//   plain     – text only (cancel, leave, small links); pass `tone="danger"` for red text
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { colors, minTarget, radius } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'plain';
  tone?: 'default' | 'danger';
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const BG: Record<NonNullable<Props['variant']>, ColorValue> = {
  primary: colors.primary,
  secondary: colors.card,
  danger: colors.danger,
  plain: 'transparent',
};

export function BigButton({ label, onPress, variant = 'primary', tone = 'default', icon, disabled, loading, accessibilityHint, style }: Props) {
  const fg =
    variant === 'primary' ? colors.onPrimary
    : variant === 'danger' ? colors.onDanger
    : tone === 'danger' ? colors.dangerText
    : colors.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        variant === 'plain' && styles.plain,
        { backgroundColor: BG[variant], opacity: inactive ? 0.45 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={22} color={fg} />}
          <Text style={[styles.label, { color: fg }]} numberOfLines={2}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: minTarget,
    borderRadius: radius,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  plain: { minHeight: 48 },
  label: { fontSize: 17, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
});
