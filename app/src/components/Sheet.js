import { useLayoutEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { SlideInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { layout, motion, radius, space, type, useAppTheme } from '../theme';

const CLOSE_DRAG = 80; // px dragged down, or a quick flick, closes the sheet

// Bottom sheet (brief: drag handle, title, scrollable options, sticky bottom bar).
// Closes by: dragging the handle/title down, tapping outside, or Android back (Modal's onRequestClose).
export default function Sheet({ visible, onClose, title, children, footer }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const drag = useSharedValue(0);
  useLayoutEffect(() => {
    if (visible) drag.value = 0; // a sheet closed by dragging opens at the top again
  }, [visible, drag]);

  // only the handle and title drag, so the options list keeps its own scrolling
  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DRAG || e.velocityY > 900) scheduleOnRN(onClose);
      else drag.value = withSpring(0, motion.spring);
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* Android: gestures inside a Modal need their own root */}
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <Animated.View entering={SlideInDown.duration(motion.max)} style={styles.place}>
          <Animated.View
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }, dragStyle]}
            accessibilityViewIsModal
          >
            <GestureDetector gesture={pan}>
              <View style={styles.grab}>
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
                <Text style={[type.cardTitle, styles.title, { color: colors.textPrimary }]} accessibilityRole="header">
                  {title}
                </Text>
              </View>
            </GestureDetector>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
            {footer ? (
              <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, borderTopColor: colors.border }]}>
                {footer}
              </View>
            ) : (
              <View style={{ height: insets.bottom + space.md }} />
            )}
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  place: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%' },
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: StyleSheet.hairlineWidth,
  },
  grab: { paddingTop: space.sm },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  title: { paddingHorizontal: layout.screenPadding, paddingTop: space.md, paddingBottom: space.sm },
  body: { paddingHorizontal: layout.screenPadding, paddingBottom: space.lg, gap: space.xl },
  footer: { paddingHorizontal: layout.screenPadding, paddingTop: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
