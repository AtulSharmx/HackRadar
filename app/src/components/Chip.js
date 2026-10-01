import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text } from 'react-native';

import { select } from '../lib/haptics';
import { CHROME_MAX_SCALE, radius, space, type, useAppTheme } from '../theme';
import PressableScale from './PressableScale';

// Filter chip. Off: border only. On: brand fill + small x (the whole chip toggles; x is a visual cue).
// soft: a quieter "on" (tinted, brand text) for chips that only report state, like the Feed's active
// filters, so they never shout louder than a red "closes soon".
// icon / endIcon: the Feed's action chips (Filters, Sort, City) that open something instead of toggling.
// Visual height 36, touch area stretched to 48 with hitSlop.
// role: checkbox (multi-select, filters), radio (pick one) or button (opens something)
export default function Chip({
  label, selected = false, onPress, showRemove = selected, role = 'checkbox', soft = false, icon, endIcon, accessibilityLabel,
}) {
  const { colors } = useAppTheme();
  const on = selected && !soft;
  const fg = on ? colors.onBrand : selected ? colors.brand : colors.textPrimary;
  const trailing = showRemove ? 'close' : endIcon;
  return (
    <PressableScale
      onPress={() => {
        select();
        onPress?.();
      }}
      hitSlop={6}
      accessibilityRole={role}
      accessibilityState={role === 'button' ? undefined : { checked: selected }}
      accessibilityLabel={accessibilityLabel || label}
      style={[
        styles.chip,
        on
          ? { backgroundColor: colors.brand, borderColor: colors.brand }
          : selected
            ? { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft }
            : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={selected ? fg : colors.brand} /> : null}
      <Text style={[type.label, { color: fg }]} maxFontSizeMultiplier={CHROME_MAX_SCALE} numberOfLines={1}>
        {label}
      </Text>
      {trailing ? <MaterialCommunityIcons name={trailing} size={16} color={selected ? fg : colors.textSecondary} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
