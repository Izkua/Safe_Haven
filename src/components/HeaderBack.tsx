// [OWNER: UI] Themed "‹ Map" back button for pushed screens. iOS 26 draws its own glass bubble
// behind the system back button that ignores our light / dark theme, so we draw this one ourselves
// (with the shared glass background hidden). Swipe-back still works as normal.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

/** Pass plain colors from headerColors(useColorScheme()): dynamic colors render as light mode in the header. */
export function HeaderBack({ label = 'Back', color, background }: { label?: string; color: string; background: string }) {
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.btn, { backgroundColor: background, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name="chevron-back" size={20} color={color} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 36, paddingLeft: 8, paddingRight: 14, borderRadius: 18 },
  text: { fontSize: 17, fontWeight: '500' },
});
