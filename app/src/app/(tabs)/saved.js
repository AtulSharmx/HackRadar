import { StyleSheet, Text, View } from 'react-native';

import { layout, type, useAppTheme } from '../../theme';

// Step 21 placeholder. The real Saved tab (Interested, Registered, swipe to remove) is step 29.
export default function SavedScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[type.body, { color: colors.textSecondary }]}>Saved comes in step 29.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: layout.screenPadding },
});
