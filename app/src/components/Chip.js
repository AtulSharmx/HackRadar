import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text } from 'react-native';

import { select } from '../lib/haptics';
import { CHROME_MAX_SCALE, radius, space, type, useAppTheme } from '../theme';
import PressableScale from './PressableScale';

// Filter chip. Off: border only. On: brand fill + small x (the whole chip toggles; x is a visual cue).
// Visual height 36, touch area stretched to 48 with hitSlop.
// role: checkbox (multi-select, filters) or radio (pick one)
export default function Chip({ label, selected = false, onPress, showRemove = selected, role = 'checkbox' }) {
  const { colors } = useAppTheme();
  return (
    <PressableScale
      onPress={() => {
        select();
        onPress?.();
      }}
      hitSlop={6}
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.brand, borderColor: colors.brand }
          : { backgroundColor: 'transparent', borderColor: colors.border },
      ]}
    >
      <Text
        style={[type.label, { color: selected ? colors.onBrand : colors.textPrimary }]}
        maxFontSizeMultiplier={CHROME_MAX_SCALE}
        numberOfLines={1}
      >
        {label}
      </Text>
      {showRemove ? <MaterialCommunityIcons name="close" size={16} color={colors.onBrand} /> : null}
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
