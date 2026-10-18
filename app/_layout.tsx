import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { OnboardingGate, useOnboarding } from '@/components/OnboardingGate';
import { AppProvider } from '@/state/AppContext';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <AppProvider>
      <OnboardingGate>
        <StatusBar style="dark" />
        <RootStack />
      </OnboardingGate>
    </AppProvider>
  );
}

// [UI] Until onboarding is finished only the onboarding screen is reachable; after, only the app.
function RootStack() {
  const { onboarded } = useOnboarding();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* [UI] Alert is a full-screen takeover (no header, no swipe-away); dismiss is inside the screen. */}
        <Stack.Screen name="alert" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="compass" options={{ title: '', headerBackTitle: 'Map' }} />
        <Stack.Screen name="simulate" options={{ presentation: 'modal', title: 'Simulate a disaster' }} />
      </Stack.Protected>
    </Stack>
  );
}
