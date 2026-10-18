import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { OnboardingGate, useOnboarding } from '@/components/OnboardingGate';
import { AppProvider } from '@/state/AppContext';

export default function RootLayout() {
  return (
    <AppProvider>
      <OnboardingGate>
        <StatusBar style="auto" />
        <RootStack />
      </OnboardingGate>
    </AppProvider>
  );
}

// [UI] Until onboarding is finished only the onboarding screen is reachable; after, only the app.
function RootStack() {
  const { onboarded } = useOnboarding();
  return (
    <Stack>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="alert" options={{ presentation: 'modal', title: 'Emergency Alert' }} />
        <Stack.Screen name="offline-readiness" options={{ title: 'Offline Readiness' }} />
        <Stack.Screen name="compass" options={{ title: 'Offline Compass' }} />
        <Stack.Screen name="simulate" options={{ presentation: 'modal', title: 'Simulate a Disaster' }} />
      </Stack.Protected>
    </Stack>
  );
}
