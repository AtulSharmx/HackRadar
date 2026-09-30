import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { motion, radius, space, useAppTheme } from '../theme';

function Box({ char, active, state, colors }) {
  const pop = useSharedValue(1);
  useEffect(() => {
    if (char) pop.value = withSequence(withTiming(1.12, { duration: 80 }), withSpring(1, motion.spring));
  }, [char, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  let border = colors.border;
  if (state === 'error') border = colors.urgent;
  else if (state === 'done' || active) border = colors.brand;
  return (
    <Animated.View
      style={[
        styles.box,
        { borderColor: border, backgroundColor: state === 'done' ? colors.brandSoft : colors.surface },
        active && styles.boxActive,
        style,
      ]}
    >
      <Text style={[styles.char, { color: state === 'error' ? colors.urgent : colors.textPrimary }]}>{char}</Text>
    </Animated.View>
  );
}

// Six boxes for the code (one hidden field underneath, so paste and SMS autofill work).
// state: 'idle' | 'error' (red, shakes) | 'done' (green). ref.shake() for a wrong code.
const CodeInput = forwardRef(function CodeInput({ value, onChange, length = 6, state = 'idle', onComplete }, ref) {
  const { colors } = useAppTheme();
  const input = useRef(null);
  const [focused, setFocused] = useState(true);
  const x = useSharedValue(0);
  useImperativeHandle(ref, () => ({
    shake: () => {
      x.value = withSequence(
        withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }),
        withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }), withTiming(0, { duration: 50 }),
      );
    },
    focus: () => input.current?.focus(),
  }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel={`Code, ${value.length} of ${length} digits entered`}>
      <Animated.View style={[styles.row, shakeStyle]}>
        {Array.from({ length }, (_, i) => (
          <Box key={i} char={value[i] || ''} active={focused && i === Math.min(value.length, length - 1)} state={state} colors={colors} />
        ))}
      </Animated.View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '').slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={length}
        caretHidden
        style={styles.hidden}
        accessibilityLabel="Code"
      />
    </Pressable>
  );
});

export default CodeInput;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  box: {
    flex: 1, maxWidth: 52, aspectRatio: 0.86, borderWidth: 1.5, borderRadius: radius.button,
    alignItems: 'center', justifyContent: 'center',
  },
  boxActive: { borderWidth: 2 },
  char: { fontSize: 24, lineHeight: 30, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hidden: { ...StyleSheet.absoluteFillObject, opacity: 0, color: 'transparent' }, // over the boxes: tap, paste and autofill land here
});
