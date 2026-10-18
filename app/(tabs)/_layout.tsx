// [OWNER: UI] Bottom tabs. Design: text-only tabs on bone, ink rule on top, active tab underlined.
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme';

const label = (text: string) =>
  function TabLabel({ focused }: { focused: boolean }) {
    return (
      <Text
        style={{
          fontSize: 15,
          fontWeight: focused ? '700' : '600',
          color: focused ? colors.text : colors.muted,
          textDecorationLine: focused ? 'underline' : 'none',
        }}
      >
        {text}
      </Text>
    );
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.text, borderTopWidth: 1, elevation: 0, shadowOpacity: 0 },
        tabBarItemStyle: { justifyContent: 'center' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Map', tabBarLabel: label('Map') }} />
      <Tabs.Screen name="group" options={{ title: 'Group', tabBarLabel: label('Group') }} />
      <Tabs.Screen name="info" options={{ title: 'First aid', tabBarLabel: label('First aid') }} />
    </Tabs>
  );
}
