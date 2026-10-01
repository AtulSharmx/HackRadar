import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CHROME_MAX_SCALE, layout, motion, radius, space, type, useAppTheme } from '../theme';

const ToastContext = createContext(() => {});
const LiftContext = createContext(() => {});
const TAB_BAR_CLEARANCE = 64; // sits above the bottom tab bar

// Usage: const toast = useToast(); toast('Saved. Reminders set for ...', { action: { label: 'Undo', onPress } })
export function useToast() {
  return useContext(ToastContext);
}

// A screen with its own bottom bar (Feed's Filters bar, Event detail's Apply bar) lifts the toast
// above it while focused, so the toast never covers those buttons.
export function useToastLift(px) {
  const setLift = useContext(LiftContext);
  useFocusEffect(
    useCallback(() => {
      setLift(px);
      // the next screen may have set its own lift already: only undo ours
      return () => setLift((cur) => (cur === px ? 0 : cur));
    }, [setLift, px]),
  );
}

export function ToastProvider({ children }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const [lift, setLift] = useState(0);
  const timer = useRef(null);

  const show = useCallback((message, { action, duration = 3000 } = {}) => {
    clearTimeout(timer.current);
    setToast({ message, action, key: Date.now() });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), action ? Math.max(duration, 5000) : duration);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      <LiftContext.Provider value={setLift}>{children}</LiftContext.Provider>
      {toast ? (
        <Animated.View
          key={toast.key}
          entering={FadeInDown.duration(motion.base)}
          exiting={FadeOutDown.duration(motion.fast)}
          pointerEvents="box-none"
          style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_CLEARANCE + lift }]}
        >
          <View style={[styles.toast, { backgroundColor: colors.inverseSurface }]} accessibilityLiveRegion="polite">
            <Text style={[type.body, styles.message, { color: colors.inverseText }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
              {toast.message}
            </Text>
            {toast.action ? (
              <Pressable
                onPress={() => {
                  setToast(null);
                  toast.action.onPress();
                }}
                android_ripple={{ color: colors.textSecondary }}
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel={toast.action.label}
              >
                <Text style={[type.label, { color: colors.inverseBrand }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
                  {toast.action.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: layout.screenPadding, right: layout.screenPadding },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.button,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    minHeight: layout.minTouch,
  },
  message: { flex: 1, paddingVertical: space.md },
  action: { minWidth: layout.minTouch, minHeight: layout.minTouch, paddingHorizontal: space.md, justifyContent: 'center' },
});
