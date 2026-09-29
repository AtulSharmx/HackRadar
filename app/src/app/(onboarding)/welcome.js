import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import { layout, space, type, useAppTheme } from '../../theme';

// Step 1. The guest sign-in already started at app launch (SessionProvider), so it's ready by step 5.
export default function Welcome() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.middle}>
        <MaterialCommunityIcons name="radar" size={56} color={colors.brand} />
        <Text style={[type.screenTitle, styles.name, { color: colors.textPrimary }]} accessibilityRole="header">
          HackRadar
        </Text>
        <Text style={[type.body, styles.line, { color: colors.textSecondary }]}>
          Every hackathon you can join, near you or online.
        </Text>
      </View>
      <Button label="Get started" onPress={() => router.push('/interests')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: layout.screenPadding },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  name: { fontSize: 32, lineHeight: 38 },
  line: { textAlign: 'center', fontSize: 16, lineHeight: 22, maxWidth: 280 },
});
