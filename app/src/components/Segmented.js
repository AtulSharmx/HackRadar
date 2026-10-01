import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { select } from '../lib/haptics';
import { CHROME_MAX_SCALE, motion, radius, space, type, useAppTheme } from '../theme';

const PAD = 4;

// Pick one of 2-5 short options in place (Online | Offline | Both). The white pill slides to the choice.
// options: [[key, label], ...]; value: the selected key (a key not in options selects nothing).
export default function Segmented({ options, value, onChange, accessibilityLabel }) {
  const { colors, elevation } = useAppTheme();
  const [width, setWidth] = useState(0);
  const index = options.findIndex(([k]) => k === value);
  const seg = width ? (width - PAD * 2) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    if (index >= 0 && seg) x.value = withTiming(index * seg, { duration: motion.base });
  }, [index, seg, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w !== width) {
          if (index >= 0) x.value = index * ((w - PAD * 2) / options.length); // first layout: no slide
          setWidth(w);
        }
      }}
      style={[styles.track, { backgroundColor: colors.surfaceSoft }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {seg && index >= 0 ? (
        <Animated.View style={[styles.thumb, elevation.card, { width: seg, backgroundColor: colors.surface }, thumb]} />
      ) : null}
      {options.map(([key, label]) => {
        const on = key === value;
        return (
          <Pressable
            key={String(key)}
            onPress={() => {
              if (on) return;
              select();
              onChange(key);
            }}
            style={({ pressed }) => [styles.segment, pressed && !on && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={label}
          >
            <Text
              style={[type.label, { color: on ? colors.textPrimary : colors.textSecondary, fontWeight: on ? '600' : '500' }]}
              maxFontSizeMultiplier={CHROME_MAX_SCALE}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.button, padding: PAD, width: '100%' }, // full width even inside a wrapping row
  thumb: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radius.button - 3 },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  pressed: { opacity: 0.55 },
});
