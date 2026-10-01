import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CHROME_MAX_SCALE, layout, space, type, useAppTheme } from '../theme';

// Full-width strip under the header for offline / permission / source issues. One action at most.
export default function Banner({ icon, text, action }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.surfaceSoft, borderColor: colors.border }]}
      accessibilityRole="alert"
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.textSecondary} />
      <Text style={[type.body, styles.text, { color: colors.textPrimary }]}>{text}</Text>
      {action ? (
        <Pressable onPress={action.onPress} android_ripple={{ color: colors.border }} style={styles.action} accessibilityRole="button" accessibilityLabel={action.label}>
          <Text style={[type.label, { color: colors.brand }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: layout.screenPadding,
    paddingRight: space.xs,
    minHeight: layout.minTouch,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, paddingVertical: space.sm },
  action: { minHeight: layout.minTouch, minWidth: layout.minTouch, paddingHorizontal: space.md, justifyContent: 'center' },
});
