import { Stack } from 'expo-router';

import { DraftProvider } from '../../lib/draft';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function OnboardingLayout() {
  return (
    <DraftProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="interests" />
        <Stack.Screen name="join" />
        <Stack.Screen name="location" />
        <Stack.Screen name="notifications" />
      </Stack>
    </DraftProvider>
  );
}
