// [OWNER: UI] Big bold distance with a smaller unit: "340 m", "1.2 km" (design: numbers · bold).
import { StyleSheet, Text, type ColorValue, type TextStyle } from 'react-native';
import { colors } from '@/theme';

function splitDistance(m: number): { value: string; unit: string } {
  if (m < 1000) return { value: String(Math.round(m)), unit: 'm' };
  return { value: (m / 1000).toFixed(m < 10_000 ? 1 : 0), unit: 'km' };
}

export function BigNumber({ meters, size = 56, color = colors.text, style }: { meters: number | null; size?: number; color?: ColorValue; style?: TextStyle }) {
  if (meters === null || !Number.isFinite(meters)) {
    return <Text style={[styles.num, { fontSize: size, lineHeight: size * 0.95, color: colors.muted }, style]}>—</Text>;
  }
  const { value, unit } = splitDistance(meters);
  return (
    <Text style={[styles.num, { fontSize: size, lineHeight: size * 0.95, color }, style]} accessibilityLabel={`${value} ${unit === 'm' ? 'meters' : 'kilometers'}`}>
      {value}
      <Text style={{ fontSize: Math.round(size * 0.42) }}> {unit}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  num: { fontWeight: '600', fontVariant: ['tabular-nums'] },
});
