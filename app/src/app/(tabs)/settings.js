import { StyleSheet, Text, View } from 'react-native';

import { layout, type, useAppTheme } from '../../theme';

// Step 21 placeholder. The real Settings screen is step 31.
export default function SettingsScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[type.body, { color: colors.textSecondary }]}>Settings comes in step 31.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: layout.screenPadding },
});
