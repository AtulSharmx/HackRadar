import { StyleSheet, View } from 'react-native';

import { layout, radius, space, useAppTheme } from '../theme';

// Grey placeholder shaped like EventCard, only while the very first sync loads.
// Static on purpose: the brief rules out infinite animations.
export default function SkeletonCard() {
  const { colors } = useAppTheme();
  const bar = (width, height = 12) => (
    <View style={{ width, height, borderRadius: 4, backgroundColor: colors.surfaceSoft }} />
  );
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {bar(90)}
      <View style={styles.gapLg} />
      {bar('85%', 16)}
      <View style={styles.gapSm} />
      {bar('55%')}
      <View style={styles.gapLg} />
      <View style={styles.row}>
        {bar(60)}
        {bar(50)}
        {bar(45)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: layout.cardPadding },
  row: { flexDirection: 'row', gap: space.lg },
  gapSm: { height: space.sm },
  gapLg: { height: space.lg },
});
