import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

import { CHROME_MAX_SCALE, radius, space, type, useAppTheme } from '../theme';

// Always icon + word, never color alone (brief: Accessibility rules)
export const TRUST = {
  trusted_source: { icon: 'shield-check-outline', word: 'Trusted source', tone: 'brand' },
  check_details: { icon: 'information-outline', word: 'Check details', tone: 'soon' },
  warning: { icon: 'alert-outline', word: 'Warning', tone: 'urgent' },
  stale: { icon: 'clock-alert-outline', word: 'Outdated', tone: 'muted' },
};

export default function TrustLabel({ label }) {
  const { colors } = useAppTheme();
  const t = TRUST[label] || TRUST.check_details;
  return (
    <View style={[styles.pill, { borderColor: colors.border }]} accessible accessibilityLabel={t.word}>
      <MaterialCommunityIcons name={t.icon} size={16} color={colors[t.tone]} />
      <Text style={[type.meta, styles.word, { color: colors[t.tone] }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
        {t.word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  word: { fontWeight: '600' },
});
