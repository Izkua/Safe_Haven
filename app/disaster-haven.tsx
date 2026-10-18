import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { BigButton } from '@/components/BigButton';
import { HavenGroups } from '@/components/HavenGroups';
import { HAZARDS } from '@/lib/hazards';
import { isHazard, savedHaven } from '@/lib/havens';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';
export default function DisasterHavenScreen() {
  const params = useLocalSearchParams<{ hazard: string; groupId: string }>();
  const { state, actions } = useApp();
  const [selected, select] = useState(params.groupId ?? state.activeGroupId ?? '');
  const group = state.groups.find(g => g.id === selected) ?? state.groups[0];
  if (!isHazard(params.hazard)) return <Text style={{ color: colors.text }}>Choose a disaster from Disaster Havens.</Text>;
  const hazard = params.hazard;
  const place = savedHaven(group, hazard);
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, gap: 20 }}>
    <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>{HAZARDS[hazard].label} haven</Text>
    <Text style={{ fontSize: 17, color: colors.muted }}>Choose which group this saved location belongs to.</Text>
    <HavenGroups groups={state.groups} selected={group?.id ?? ''} onSelect={select} />
    <Text style={{ fontSize: 20, color: colors.text }}>{place ? `${group?.name}: ${place.name}` : 'No haven saved for this group and disaster.'}</Text>
    {place && <Text style={{ color: colors.muted }}>{place.coord.latitude.toFixed(5)}, {place.coord.longitude.toFixed(5)}</Text>}
    <BigButton label="Save a meeting point" icon="map-outline" disabled={!group || !state.isOnline}
      onPress={() => { if (group) router.push({ pathname: '/haven-map', params: { hazard, groupId: group.id } }); }} />
    <Text style={{ fontSize: 16, lineHeight: 23, color: colors.muted }}>{!group ? 'Create or join a group first.' : !state.isOnline ? 'Reconnect to save or change a haven.' : 'Tap the map to choose a location. Saving here prepares a suggestion; it does not move the current meeting point.'}</Text>
    <BigButton label="Simulate disaster" variant="alarm" icon="warning-outline" onPress={() => {
      if (router.canDismiss()) router.dismissAll();
      router.navigate('/');
      void actions.startDrill(hazard, group?.id);
    }} />
    <Text style={{ fontSize: 16, lineHeight: 23, color: colors.muted }}>A saved haven is your group’s choice, not a verified safe area. Check current conditions and official instructions before using it.</Text>
  </ScrollView>;
}
