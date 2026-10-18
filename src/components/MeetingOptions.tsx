import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { HAZARDS } from '@/lib/hazards';
import { HAVEN_HAZARDS, savedHaven, usualMeetingPoint } from '@/lib/havens';
import { requestMapFocus } from '@/lib/mapFocus';
import { useApp } from '@/state/AppContext';
import { colors, radius } from '@/theme';
import type { Group, HazardType, Place } from '@/types';

/** One compact entry point; the destination choices only appear when needed. */
export function MeetingOptions({ group, onChanged, style }: { group: Group; onChanged?: () => void; style?: StyleProp<ViewStyle> }) {
  const { state, actions } = useApp();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = state.groups.find(g => g.id === group.id);
  if (!current) return null;
  const usual = usualMeetingPoint(current);
  const choices: { key: string; label: string; place: Place | null; hazard: HazardType | null }[] = [
    { key: 'usual', label: 'Usual meeting point', place: usual, hazard: null },
    ...HAVEN_HAZARDS.flatMap(hazard => {
      const place = savedHaven(current, hazard);
      return place ? [{ key: hazard, label: `${HAZARDS[hazard].label} haven`, place, hazard }] : [];
    }),
  ];
  if (choices.length === 1 && !current.activeHaven) return null;
  const switchTo = async (hazard: HazardType | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const place = hazard ? await actions.adoptDisasterHaven(current.id, hazard) : await actions.restoreUsualMeetingPoint(current.id);
      if (place) {
        void actions.routeTo(place);
        requestMapFocus({ place, label: place.name, showMe: true });
        setOpen(false);
        onChanged?.();
      }
    } finally { setBusy(false); }
  };
  return <>
    <BigButton label="Meeting options" icon="swap-horizontal-outline" variant="secondary" style={style} onPress={() => setOpen(true)}
      accessibilityHint="Switch your group between its usual meeting point and saved disaster havens" />
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close meeting options" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => { if (!busy) setOpen(false); }} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.heading}>
            <Text style={styles.title}>Meeting options</Text>
            {busy ? <ActivityIndicator color={colors.primary} /> : <Pressable accessibilityRole="button" accessibilityLabel="Close meeting options" onPress={() => setOpen(false)} style={styles.close}><Ionicons name="close" size={26} color={colors.text} /></Pressable>}
          </View>
          <Text style={styles.hint}>Changes the shared meeting point for {current.name}. Your usual point stays saved.</Text>
          {!state.isOnline && <Text style={styles.hint}>Reconnect to switch destinations.</Text>}
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {choices.map(choice => {
              const selected = (current.activeHaven ?? null) === choice.hazard && !!choice.place && current.meetingPlace?.coord.latitude === choice.place.coord.latitude && current.meetingPlace?.coord.longitude === choice.place.coord.longitude;
              return <Pressable key={choice.key} accessibilityRole="button" accessibilityState={{ selected, disabled: busy || !state.isOnline || !choice.place }}
                disabled={busy || !state.isOnline || !choice.place} onPress={() => { if (selected) setOpen(false); else void switchTo(choice.hazard); }}
                style={[styles.choice, { opacity: !choice.place || !state.isOnline ? 0.5 : 1 }]}>
                <Ionicons name={choice.hazard ? HAZARDS[choice.hazard].icon : 'flag-outline'} size={23} color={colors.primary} />
                <View style={{ flex: 1, gap: 4 }}><Text style={styles.label}>{choice.label}</Text><Text style={styles.hint}>{choice.place?.name ?? 'Set a usual point on the map first'}</Text></View>
                {selected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
              </Pressable>;
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '80%', backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 23, fontWeight: '700' }, close: { padding: 10 },
  hint: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  choice: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.card, borderRadius: radius },
  label: { color: colors.text, fontSize: 17, fontWeight: '600' },
});
