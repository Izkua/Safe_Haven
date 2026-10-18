// [OWNER: UI] Bottom tabs: standard iOS icon + label, so anyone recognizes them.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ focused, size }: { focused: boolean; size: number }) {
    return <Ionicons name={focused ? on : off} size={size} color={focused ? (colors.text as string) : (colors.muted as string)} />;
  };

export default function TabsLayout() {
  // Someone asking for help is the one thing the tab bar must shout about, from any screen.
  const helpCount = useApp().state.members.filter((m) => m.status === 'need_help').length;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text as string,
        tabBarInactiveTintColor: colors.muted as string,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.rule, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0, shadowOpacity: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Map', tabBarIcon: icon('map', 'map-outline') }} />
      <Tabs.Screen
        name="group"
        options={{
          title: 'Group',
          tabBarIcon: icon('people', 'people-outline'),
          tabBarBadge: helpCount > 0 ? '!' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger as string, color: colors.onDanger as string, fontWeight: '700' },
          tabBarAccessibilityLabel: helpCount > 0 ? `Group, ${helpCount} ${helpCount === 1 ? 'person needs' : 'people need'} help` : 'Group',
        }}
      />
      <Tabs.Screen name="announcements" options={{ title: 'Announcements', tabBarIcon: icon('megaphone', 'megaphone-outline') }} />
    </Tabs>
  );
}
