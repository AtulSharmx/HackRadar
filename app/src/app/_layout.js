import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '../components/Toast';
import { PrefsProvider, usePrefs } from '../lib/prefs';
import { SavedProvider } from '../lib/saved';
import { SessionProvider } from '../lib/session';
import { ThemeChoiceProvider, useAppTheme } from '../theme';

// Onboarding until my preferences exist, then the app. Protected routes swap them; no conditional renders in screens.
function Routes() {
  const { colors } = useAppTheme();
  const { onboarded } = usePrefs();
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
      </Stack.Protected>
    </Stack>
  );
}

// Navigation chrome takes our tokens too, so the theme never flashes the other colour between screens.
function ThemedApp() {
  const { scheme, colors } = useAppTheme();
  const nav = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...nav,
    colors: {
      ...nav.colors,
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
                <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
                <Routes />
              </ToastProvider>
            </SavedProvider>
          </PrefsProvider>
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeChoiceProvider>
      <ThemedApp />
    </ThemeChoiceProvider>
  );
}
