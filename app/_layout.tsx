import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { HeaderBack } from '@/components/HeaderBack';
import { OnboardingGate, useOnboarding } from '@/components/OnboardingGate';
import { AppProvider } from '@/state/AppContext';
import { useColorScheme } from 'react-native';
import { colors, headerColors } from '@/theme';

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
  const header = headerColors(useColorScheme());
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: header.bg },
        headerTintColor: header.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600' },
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
        <Stack.Screen
          name="offline-readiness"
          options={{
            title: 'Offline Readiness',
            headerBackTitle: 'Back',
            // [UI] Themed back button (the iOS 26 glass one ignores light / dark mode).
            headerLeft: () => <HeaderBack label="Back" color={header.text} background={header.card} />,
            unstable_headerLeftItems: () => [{ type: 'custom', element: <HeaderBack label="Back" color={header.text} background={header.card} />, hidesSharedBackground: true }],
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerBackTitle: 'First aid',
            // [UI] Themed back button (the iOS 26 glass one ignores light / dark mode).
            headerLeft: () => <HeaderBack label="First aid" color={header.text} background={header.card} />,
            unstable_headerLeftItems: () => [{ type: 'custom', element: <HeaderBack label="First aid" color={header.text} background={header.card} />, hidesSharedBackground: true }],
          }}
        />
        <Stack.Screen name="compass" options={{ title: '', headerBackTitle: 'Map' }} />
        <Stack.Screen name="simulate" options={{ presentation: 'modal', title: 'Practice a drill' }} />
      </Stack.Protected>
    </Stack>
  );
}
