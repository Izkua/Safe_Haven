// [OWNER: UI] Tap a person on the Group tab: their photo, name, status, phone number and location,
// with one-tap call / text / show on map / directions.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { BigButton } from '@/components/BigButton';
import { distanceM, formatAge, formatDistance } from '@/lib/geo';
import { reverseGeocode } from '@/services/location';
import { colors, radius, statusColor } from '@/theme';
import type { LatLng, Member } from '@/types';

type Props = {
  member: Member | null;
  color: ColorValue;
  me: LatLng | null;
  isOnline: boolean;
  onClose: () => void;
  onShowOnMap: (m: Member) => void;
  onDirections: (m: Member) => void;
};

/** Digits and a leading + only, for tel:/sms: links. */
const dialable = (phone: string) => phone.replace(/(?!^\+)[^\d]/g, '');

export function MemberSheet({ member: m, color, me, isOnline, onClose, onShowOnMap, onDirections }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  // Look up a street address for their last location (needs signal; skipped offline).
  const lat = m?.location?.latitude;
  const lng = m?.location?.longitude;
  useEffect(() => {
    setAddress(null);
    if (lat === undefined || lng === undefined || !isOnline) return;
    let live = true;
    setLooking(true);
    reverseGeocode({ latitude: lat, longitude: lng })
      .then((a) => live && setAddress(a))
      .finally(() => live && setLooking(false));
    return () => {
      live = false;
    };
  }, [lat, lng, isOnline]);

  if (!m) return null;
  const age = m.locationTs ? Date.now() - m.locationTs : null;
  const help = m.status === 'need_help';
  const statusText = help ? 'Needs help' : m.status === 'safe' ? 'Marked safe' : 'No check-in yet';
  const dist = me && m.location ? formatDistance(distanceM(me, m.location)) : null;
  const phone = m.phone ? dialable(m.phone) : null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.pad}>
          <View style={styles.head}>
            <Avatar name={m.name} photo={m.photo} color={color} size={112} />
            <Text style={styles.name} accessibilityRole="header">{m.name}</Text>
            <View style={[styles.pill, { borderColor: statusColor[m.status] }]}>
              <Ionicons name={help ? 'alert-circle' : m.status === 'safe' ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={statusColor[m.status]} />
              <Text style={[styles.pillText, { color: help ? colors.dangerText : colors.text }]}>{statusText}</Text>
            </View>
          </View>

          <Text style={styles.heading}>Phone</Text>
          <View style={styles.card}>
            {m.phone ? (
              <>
                <Text style={styles.big} selectable>{m.phone}</Text>
                <View style={styles.row2}>
                  <BigButton label="Call" icon="call" style={styles.half} onPress={() => void Linking.openURL(`tel:${phone}`)} />
                  <BigButton label="Text" icon="chatbubble" variant="secondary" style={styles.half} onPress={() => void Linking.openURL(`sms:${phone}`)} />
                </View>
              </>
            ) : (
              <Text style={styles.muted}>{m.name} hasn’t shared a phone number.</Text>
            )}
          </View>

          <Text style={styles.heading}>Location</Text>
          <View style={styles.card}>
            {m.location ? (
              <>
                <Text style={styles.big}>{address ?? (looking ? 'Finding address…' : `${m.location.latitude.toFixed(5)}, ${m.location.longitude.toFixed(5)}`)}</Text>
                <Text style={styles.muted}>
                  {dist ? `${dist} away` : 'Distance unknown'}
                  {age !== null ? ` · updated ${formatAge(age)}` : ''}
                </Text>
                <View style={styles.row2}>
                  <BigButton label="Show on map" icon="map-outline" variant="secondary" style={styles.half} onPress={() => onShowOnMap(m)} />
                  <BigButton label="Directions" icon="navigate" style={styles.half} onPress={() => onDirections(m)} />
                </View>
              </>
            ) : (
              <Text style={styles.muted}>{m.name}’s location isn’t shared yet.</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 4 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: 20, paddingBottom: 40 },
  head: { alignItems: 'center', gap: 10, marginBottom: 8 },
  name: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.text, textAlign: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { fontSize: 15, fontWeight: '600' },
  heading: { marginTop: 24, marginBottom: 10, fontSize: 20, lineHeight: 25, fontWeight: '600', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 16, gap: 8 },
  big: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: colors.text },
  muted: { fontSize: 15, lineHeight: 20, color: colors.muted },
  row2: { flexDirection: 'row', gap: 10, marginTop: 6 },
  half: { flex: 1 },
});
