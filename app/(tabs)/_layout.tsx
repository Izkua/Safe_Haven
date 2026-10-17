import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: 'Map', headerShown: false, tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="group"
        options={{ title: 'Group', tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="info"
        options={{ title: 'First Aid', tabBarIcon: ({ color, size }) => <Ionicons name="medkit" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
