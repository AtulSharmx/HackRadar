import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '../components/Toast';
import { PrefsProvider, usePrefs } from '../lib/prefs';
import { useReminders } from '../lib/reminders';
import { SavedProvider } from '../lib/saved';
import { SessionProvider } from '../lib/session';
import { useAppTheme } from '../theme';

// Onboarding until my preferences exist, then the app. Protected routes swap them; no conditional renders in screens.
function Routes() {
  const { colors } = useAppTheme();
  const { onboarded } = usePrefs();
  useReminders();
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="event/[id]"
          options={{
            title: '',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTintColor: colors.textPrimary,
          }}
        />
        <Stack.Screen
          name="about"
          options={{
            title: 'About',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTintColor: colors.textPrimary,
          }}
        />
      </Stack.Protected>
      {/* reachable before and after onboarding: Welcome's "I already have an account" and Settings */}
      <Stack.Screen name="account" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false, animation: 'none' }} />
    </Stack>
  );
}

// Navigation chrome takes our tokens too, so no screen flashes a different colour.
export default function RootLayout() {
  const { colors } = useAppTheme();
  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.brand,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.urgent,
    },
  };
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemeProvider value={theme}>
        <SessionProvider>
          <PrefsProvider>
            <SavedProvider>
              <ToastProvider>
                <StatusBar style="dark" />
                <Routes />
              </ToastProvider>
            </SavedProvider>
          </PrefsProvider>
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
