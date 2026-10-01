import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';

import { select } from '../../lib/haptics';
import { useAppTheme } from '../../theme';

// Outline icon at rest, filled when the tab is active (one icon family app-wide).
const ICONS = {
  index: ['radar', 'radar'],
  saved: ['bookmark-outline', 'bookmark'],
  settings: ['cog-outline', 'cog'],
};

export default function TabLayout() {
  const { colors } = useAppTheme();
  // Saved and Settings are built in the background once the Feed is up, so the first tap on them
  // switches at once instead of waiting for the whole screen to render (Settings took the longest).
  useEffect(() => {
    const t = setTimeout(() => {
      router.prefetch('/saved');
      router.prefetch('/settings');
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <Tabs
      screenListeners={{ tabPress: () => select() }}
      screenOptions={({ route }) => ({
        animation: 'shift', // a short slide between tabs instead of a hard cut
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleAlign: 'center', // user preference (29 Sep): title centered, sync indicator stays right
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontSize: 22, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
        tabBarIcon: ({ focused, color }) => (
          <MaterialCommunityIcons name={ICONS[route.name][focused ? 1 : 0]} size={24} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', headerTitle: 'HackRadar' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
