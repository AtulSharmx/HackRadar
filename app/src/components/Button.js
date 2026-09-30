import { StyleSheet, Text } from 'react-native';

import { select, tap } from '../lib/haptics';
import { CHROME_MAX_SCALE, layout, radius, space, type, useAppTheme } from '../theme';
import PressableScale from './PressableScale';

// variant: primary (brand fill), secondary (brand outline), text (low priority: Skip, Not yet)
// Every press gets a light tap (a selection tick for text buttons); haptic={false} when the caller does its own.
export default function Button({ label, onPress, variant = 'primary', disabled = false, style, accessibilityHint, haptic = true }) {
  const { colors } = useAppTheme();
  const look = {
    primary: { box: { backgroundColor: colors.brand }, text: colors.onBrand },
    secondary: { box: { borderWidth: 1.5, borderColor: colors.brand }, text: colors.brand },
    text: { box: {}, text: colors.brand },
  }[variant];
  return (
    <PressableScale
      onPress={(e) => {
        if (haptic) (variant === 'text' ? select : tap)();
        onPress?.(e);
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[styles.base, variant !== 'text' && styles.boxed, look.box, disabled && styles.disabled, style]}
    >
      <Text style={[type.label, { color: look.text }]} maxFontSizeMultiplier={CHROME_MAX_SCALE} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouch,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
  },
  boxed: { paddingHorizontal: space.xl },
  disabled: { opacity: 0.45 },
});
