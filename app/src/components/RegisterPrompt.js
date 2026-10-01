import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, Keyframe } from 'react-native-reanimated';

import { layout, motion, radius, space, type, useAppTheme } from '../theme';
import Button from './Button';
import IconButton from './IconButton';

// the card rises a little and settles, under the 250 ms the brief allows; instant with "remove animations"
const rise = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.94 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(motion.max);

// "Did you register?" after the user spent a while on the registration page (browser or the platform's app).
// One action, Registered; the x (or back, or a tap outside) closes it. Every fact in it is measured, not assumed.
export default function RegisterPrompt({ visible, title, where, minutes, onRegistered, onClose }) {
  const { colors } = useAppTheme();
  // keep the last words while the popup fades out, instead of flashing the empty state
  const last = useRef({ title, where, minutes });
  if (visible) last.current = { title, where, minutes };
  const shown = last.current;
  const away = shown.minutes < 1 ? 'less than a minute' : shown.minutes === 1 ? '1 minute' : `${shown.minutes} minutes`;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Animated.View entering={FadeIn.duration(motion.base)} style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <Animated.View entering={rise} style={[styles.card, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          <IconButton icon="close" size={22} color={colors.textSecondary} label="Close" onPress={onClose} style={styles.close} />
          <View style={[styles.badge, { backgroundColor: colors.brandSoft }]}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={30} color={colors.brand} />
          </View>
          <Text style={[type.screenTitle, styles.center, { color: colors.textPrimary }]} accessibilityRole="header">
            Did you register?
          </Text>
          <Text style={[type.body, styles.center, { color: colors.textSecondary }]}>
            You spent {away} on {shown.where}. If you signed up for{' '}
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{shown.title}</Text>, mark it and it moves to Registered.
          </Text>
          <Button label="Registered" onPress={onRegistered} haptic={false} style={styles.action} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.screenPadding + space.sm },
  card: {
    width: '100%', maxWidth: 400, borderRadius: radius.sheet, alignItems: 'center', gap: space.md,
    paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl,
  },
  close: {
    position: 'absolute', top: space.xs, right: space.xs, width: layout.minTouch, height: layout.minTouch,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: space.sm },
});
