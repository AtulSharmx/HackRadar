import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '../theme';

const PINGS = 3; // a few pings when the screen opens, then still (the brief rules out endless motion)

function Ring({ delay, size, color }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), PINGS, false));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 || t.value === 1 ? 0 : 0.45 * (1 - t.value),
    transform: [{ scale: 0.55 + t.value * 0.9 }],
  }));
  return <Animated.View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]} />;
}

// The HackRadar mark with radar pings going out from it: the sign-in screen's one bit of personality
export default function RadarPing({ size = 120, icon = 'radar' }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.wrap, { width: size, height: size }]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Ring delay={0} size={size} color={colors.brand} />
      <Ring delay={460} size={size} color={colors.brand} />
      <View style={[styles.core, { width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, backgroundColor: colors.brandSoft }]}>
        <MaterialCommunityIcons name={icon} size={size * 0.28} color={colors.brand} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  core: { alignItems: 'center', justifyContent: 'center' },
});
