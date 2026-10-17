import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '@/state/AppContext';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="alert" options={{ presentation: 'modal', title: 'Emergency Alert' }} />
        <Stack.Screen name="compass" options={{ title: 'Offline Compass' }} />
      </Stack>
    </AppProvider>
  );
}
