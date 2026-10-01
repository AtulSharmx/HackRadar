import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { layout, useAppTheme } from '../theme';

// Icon-only button (back, close, share, clear): 48 dp target, and the platform's own round ripple on
// Android the moment it's pressed; elsewhere it dims while held.
export default function IconButton({ icon, label, onPress, color, size = 24, disabled, hitSlop = 4, style }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      android_ripple={{ color: colors.border, borderless: true, radius: layout.minTouch / 2 }}
      style={({ pressed }) => [styles.button, pressed && Platform.OS !== 'android' && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <MaterialCommunityIcons name={icon} size={size} color={color || colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
});
