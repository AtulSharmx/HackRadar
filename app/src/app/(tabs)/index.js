import { StyleSheet, Text, View } from 'react-native';

import { layout, type, useAppTheme } from '../../theme';

// Step 21 placeholder. The real Feed (FlashList, pull to refresh, offline cache) is step 25.
export default function FeedScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[type.body, { color: colors.textSecondary }]}>Feed comes in step 25.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: layout.screenPadding },
});
