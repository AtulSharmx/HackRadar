import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, space, type, useAppTheme } from '../theme';
import Button from './Button';

const TOTAL = 5;

// One onboarding step (brief: progress dots top, big question, options middle, Next + Skip at the bottom).
export default function OnboardingStep({ step, title, subtitle, children, next, skip }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]}>
        {/* steps 2-5 can go back; Android's back button does the same */}
        {step > 1 ? (
          <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <View style={styles.dots} accessible accessibilityLabel={`Step ${step} of ${TOTAL}`}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i < step ? colors.brand : colors.border }, i === step - 1 && styles.dotNow]}
            />
          ))}
        </View>
        {/* same width as the back button so the dots stay centred */}
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.screenTitle, styles.title, { color: colors.textPrimary }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[type.body, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        <View style={styles.body}>{children}</View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md, borderTopColor: colors.border }]}>
        <Button label={next.label} onPress={next.onPress} disabled={next.disabled} />
        {skip ? <Button label="Skip" variant="text" onPress={skip} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// A labelled group of options inside a step ("Fee", "Degree", ...)
export function Group({ label, children }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.group}>
      <Text style={[type.label, { color: colors.textPrimary }]}>{label}</Text>
      <View style={styles.options}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs },
  back: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotNow: { width: 20 },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: space.xl, paddingBottom: space.xl, gap: space.sm },
  title: { fontSize: 26, lineHeight: 32 },
  body: { marginTop: space.lg, gap: space.xl },
  group: { gap: space.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  bottom: { paddingHorizontal: layout.screenPadding, paddingTop: space.md, gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
});
