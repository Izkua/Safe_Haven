// [UI] Announcement banner. Shows the newest announcement you haven't dismissed, over every
// screen, and stays until you tap ✕. Tapping the banner opens the Announcements tab.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnnouncementCard } from '@/components/AnnouncementCard';
import { bannerAnnouncement } from '@/lib/announcements';
import { tap } from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import { colors, radius } from '@/theme';

export function AnnouncementBanner() {
  const { state, actions } = useApp();
  const a = bannerAnnouncement(state.announcements);
  const waiting = state.announcements.filter((x) => !x.dismissed).length;
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-220)).current;

  useEffect(() => {
    if (!a) return;
    y.setValue(-220);
    // JS driver on purpose (see the map panel): avoids a stale-position flash on re-render.
    Animated.spring(y, { toValue: 0, useNativeDriver: false, bounciness: 0, speed: 16 }).start();
  }, [a?.id]);

  if (!a) return null;
  const dismiss = () => {
    tap();
    actions.dismissAnnouncement(a.id);
  };
  return (
    <Animated.View style={[styles.wrap, { top: insets.top + 6, transform: [{ translateY: y }] }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Pressable
          style={styles.body}
          accessibilityRole="button"
          accessibilityHint="Opens the Announcements tab"
          accessibilityLiveRegion="polite"
          onPress={() => router.navigate('/announcements')}
        >
          <AnnouncementCard a={a} />
          {waiting > 1 && <Text style={styles.more}>{waiting - 1} more waiting</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss announcement" hitSlop={10} onPress={dismiss} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, zIndex: 100, elevation: 10 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.rule, paddingVertical: 12, paddingLeft: 14, paddingRight: 6 },
  body: { flex: 1, gap: 8 },
  more: { marginLeft: 56, fontSize: 13, fontWeight: '600', color: colors.muted },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
