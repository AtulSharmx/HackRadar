import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';

import { useAppTheme } from '../../theme';

// Outline icon at rest, filled when the tab is active (one icon family app-wide).
const ICONS = {
  index: ['radar', 'radar'],
  saved: ['bookmark-outline', 'bookmark'],
  settings: ['cog-outline', 'cog'],
};

export default function TabLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleAlign: 'center', // user preference (29 Sep): title centered, sync indicator stays right
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontSize: 22, fontWeight: '600' },
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
