// [OWNER: MAP/OFFLINE] Zero-network guidance: arrow + distance to target using GPS + compass only.
// Design: "No signal · heading to" + name, a north-marked dial with one ink arrow, huge distance.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigNumber } from '@/components/BigNumber';
import { bearingDeg, distanceM, nearestPlace } from '@/lib/geo';
import { startHeadingWatch } from '@/services/location';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';

const DIAL = 280;
const WALK_MPS = 1.3;
const ARRIVED_M = 30;

export default function CompassScreen() {
  const { group, personalMeetingPlace, route, myLocation, isOnline } = useApp().state;
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    startHeadingWatch(setHeading)
      .then((s) => (cancelled ? s() : (stop = s)))
      .catch(() => {});
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const target =
    (route && { name: route.targetName, coord: route.to }) ??
    (group ? group.meetingPlace : personalMeetingPlace) ??
    (myLocation && group ? nearestPlace(myLocation, group.safeAreas) : null);

  if (!target || !myLocation) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.screen, { justifyContent: 'center' }]}>
        <Text style={styles.name}>{!myLocation ? 'Waiting for GPS…' : 'No meeting place yet'}</Text>
        <Text style={styles.label}>{!myLocation ? 'Step outside or near a window. GPS works without signal.' : 'Long-press the map to set one.'}</Text>
      </SafeAreaView>
    );
  }

  const bearing = bearingDeg(myLocation, target.coord);
  const arrow = (bearing - heading + 360) % 360; // arrow relative to where the phone points
  const north = (360 - heading) % 360; // N marker stays on true north
  const dist = distanceM(myLocation, target.coord);
  const arrived = dist < ARRIVED_M;
  const mins = Math.max(1, Math.round(dist / WALK_MPS / 60));

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <Text style={styles.label}>{isOnline ? 'Heading to' : 'No signal · heading to'}</Text>
      <Text style={styles.name} numberOfLines={2}>{target.name}</Text>

      <View style={styles.dialWrap}>
        <View style={styles.dial} accessible accessibilityRole="image" accessibilityLabel={`Arrow pointing to ${target.name}, ${Math.round(arrow)} degrees ${arrow <= 180 ? 'right' : 'left'}`}>
          <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${north}deg` }] }]}>
            <Text style={styles.north}>N</Text>
          </View>
          <View style={{ transform: [{ rotate: `${arrow}deg` }] }}>
            {/* Ionicons "navigate" points up-right (45°); rotate it back so 0° = straight ahead. */}
            <Ionicons name="navigate" size={150} color={arrived ? colors.safe : colors.text} style={{ transform: [{ rotate: '-45deg' }] }} />
          </View>
        </View>
      </View>

      <View style={styles.bottom}>
        {arrived ? (
          <Text style={[styles.arrived]}>You have arrived</Text>
        ) : (
          <BigNumber meters={dist} size={88} />
        )}
        {!arrived && <Text style={styles.mins}>About {mins} min</Text>}
      </View>
      <Text style={styles.fine}>Straight-line distance · works without signal</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: colors.muted },
  name: { marginTop: 6, fontSize: 30, lineHeight: 33, fontWeight: '700', color: colors.text },
  dialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dial: { width: DIAL, height: DIAL, borderRadius: DIAL / 2, borderWidth: 1, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  north: { position: 'absolute', top: 10, alignSelf: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  mins: { fontSize: 18, fontWeight: '600', color: colors.muted, marginBottom: 8 },
  arrived: { fontSize: 40, fontWeight: '700', color: colors.safe },
  fine: { marginTop: 12, fontSize: 13, color: colors.muted },
});
