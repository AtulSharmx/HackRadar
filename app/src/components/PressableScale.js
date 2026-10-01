import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { motion } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// The one press feedback used app-wide, on the UI thread: it shrinks at once when the finger lands
// (a short timing, so a tap never feels mushy) and springs back on release.
// Reanimated's default ReduceMotion.System makes it instant when the phone says "remove animations".
export default function PressableScale({ style, onPressIn, onPressOut, scaleTo = motion.pressScale, ...rest }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, motion.spring);
        onPressOut?.(e);
      }}
    />
  );
}
