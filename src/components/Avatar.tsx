// [OWNER: UI] Round profile picture, or the person's initial on their color when they haven't set one.
import { Image, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { memberInitial } from '@/components/MemberPin';

type Props = { name: string; photo?: string | null; color: ColorValue; size?: number };

export function Avatar({ name, photo, color, size = 44 }: Props) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (photo) return <Image source={{ uri: photo }} style={[styles.img, box]} accessibilityIgnoresInvertColors />;
  return (
    <View style={[styles.circle, box, { backgroundColor: color }]}>
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>{memberInitial(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: '#00000022' },
  circle: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFFFFF', fontWeight: '700' },
});
