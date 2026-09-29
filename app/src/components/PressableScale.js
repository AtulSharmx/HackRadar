import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// The one press feedback used app-wide: a small spring scale on the UI thread.
// Reanimated's default ReduceMotion.System makes it instant when the phone says "remove animations".
export default function PressableScale({ style, onPressIn, onPressOut, scaleTo = motion.pressScale, ...rest }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, motion.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, motion.spring);
        onPressOut?.(e);
      }}
    />
  );
}
