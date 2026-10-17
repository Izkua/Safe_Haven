// [OWNER: MAP/OFFLINE] Zero-network guidance: arrow + distance to target using GPS + compass only.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OfflineBanner } from '@/components/OfflineBanner';
import { bearingDeg, distanceM, formatDistance, nearestPlace } from '@/lib/geo';
import { startHeadingWatch } from '@/services/location';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';

export default function CompassScreen() {
  const { group, route, myLocation } = useApp().state;
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    let stop: (() => void) | undefined;
    startHeadingWatch(setHeading).then((s) => (stop = s)).catch(() => {});
    return () => stop?.();
  }, []);

  const target =
    (route && { name: route.targetName, coord: route.to }) ??
    group?.meetingPlace ??
    (myLocation && group ? nearestPlace(myLocation, group.safeAreas) : null);

  if (!target || !myLocation) {
    return (
      <View style={styles.screen}>
        <Text style={styles.sub}>{!myLocation ? 'Waiting for GPS…' : 'Set a meeting place on the map first.'}</Text>
      </View>
    );
  }

  const rotation = (bearingDeg(myLocation, target.coord) - heading + 360) % 360;
  const dist = distanceM(myLocation, target.coord);

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <Text style={styles.sub}>Heading to</Text>
      <Text style={styles.target}>{target.name}</Text>
      <View style={{ transform: [{ rotate: `${rotation}deg` }], marginVertical: 40 }}>
        <Ionicons name="arrow-up-circle" size={220} color={dist < 30 ? colors.safe : colors.primary} />
      </View>
      <Text style={styles.distance}>{dist < 30 ? 'You have arrived' : formatDistance(dist)}</Text>
      <Text style={styles.sub}>Straight-line distance · works without signal</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.bg, gap: 6 },
  target: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  distance: { color: colors.text, fontSize: 40, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 15, textAlign: 'center' },
});
