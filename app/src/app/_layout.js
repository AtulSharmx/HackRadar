import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ToastProvider } from '../components/Toast';
import { useAppTheme } from '../theme';

// Navigation chrome takes our tokens too, so dark mode never flashes white between screens.
export default function RootLayout() {
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
    <ThemeProvider value={theme}>
      <ToastProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ToastProvider>
    </ThemeProvider>
  );
}
