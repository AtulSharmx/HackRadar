import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, motion, radius, space, type, useAppTheme } from '../theme';

// Bottom sheet (brief: drag handle, title, scrollable options, sticky bottom bar).
// Modal's onRequestClose makes Android back close the sheet first.
export default function Sheet({ visible, onClose, title, children, footer }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View
        entering={SlideInDown.duration(motion.max)}
        style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityViewIsModal
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[type.cardTitle, styles.title, { color: colors.textPrimary }]} accessibilityRole="header">
          {title}
        </Text>
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, borderTopColor: colors.border }]}>
            {footer}
          </View>
        ) : (
          <View style={{ height: insets.bottom + space.md }} />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%',
    borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: StyleSheet.hairlineWidth,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: space.sm },
  title: { paddingHorizontal: layout.screenPadding, paddingTop: space.md, paddingBottom: space.sm },
  body: { paddingHorizontal: layout.screenPadding, paddingBottom: space.lg, gap: space.xl },
  footer: { paddingHorizontal: layout.screenPadding, paddingTop: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
