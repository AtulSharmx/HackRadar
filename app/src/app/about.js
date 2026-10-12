import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CHROME_MAX_SCALE, layout, motion, radius, space, type, useAppTheme } from '../theme';

// Only facts that are true of the running app. SOURCES must match .github/workflows/collect.yml.
const POINTS = [
  {
    icon: 'database-search-outline',
    title: 'Where hackathons come from',
    text: 'Unstop, Devfolio, Hack2Skill and HackerEarth, plus hackathons people submit (checked by us first), every 6 hours. You always register on the event’s own page.',
  },
  {
    icon: 'shield-check-outline',
    title: 'How we check them',
    text: 'Duplicates are merged into one. Labels show what we could verify: Trusted source, Check details or Warning.',
  },
  {
    icon: 'lock-outline',
    title: 'Your data',
    text: 'No password. Your city is kept to about 1 km and your saves stay with you. We never sell your data.',
  },
];

// One page, no scrolling at normal text sizes (it scrolls only if the phone's text is set very large)
export default function About() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.lg }]}
      scrollEnabled={content > box + 1}
      onLayout={(e) => setBox(e.nativeEvent.layout.height)}
      onContentSizeChange={(_, h) => setContent(h)}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(motion.max)} style={styles.hero}>
        <View style={[styles.mark, { backgroundColor: colors.brandSoft }]}>
          <MaterialCommunityIcons name="radar" size={36} color={colors.brand} />
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]} accessibilityRole="header">HackRadar</Text>
        <Text style={[type.body, styles.tagline, { color: colors.textSecondary }]}>
          Every hackathon you can join, near you or online.
        </Text>
      </Animated.View>

      <View style={styles.points}>
        {POINTS.map((p, i) => (
          <Animated.View
            key={p.title}
            entering={FadeInDown.duration(motion.max).delay(80 + i * 60)}
            style={[styles.point, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.pointIcon, { backgroundColor: colors.brandSoft }]}>
              <MaterialCommunityIcons name={p.icon} size={20} color={colors.brand} />
            </View>
            <View style={styles.pointText}>
              <Text style={[type.label, { color: colors.textPrimary }]}>{p.title}</Text>
              <Text style={[type.body, { color: colors.textSecondary }]}>{p.text}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeInDown.duration(motion.max).delay(280)} style={styles.foot}>
        <Text style={[type.label, { color: colors.textPrimary }]}>Made for students in India</Text>
        <Text style={[type.meta, styles.center, { color: colors.textSecondary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
          Version {Constants.expoConfig?.version || '1.0.0'}
        </Text>
        <Text style={[type.meta, styles.center, { color: colors.textSecondary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
          Place search by Photon (komoot) · City data © OpenStreetMap contributors
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: layout.screenPadding, paddingTop: space.md, gap: space.xl },
  hero: { alignItems: 'center', gap: space.sm },
  mark: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  name: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  tagline: { textAlign: 'center', maxWidth: 280 },
  points: { gap: space.md },
  point: {
    flexDirection: 'row', gap: space.md, padding: layout.cardPadding, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pointIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, gap: 2 },
  foot: { alignItems: 'center', gap: space.xs },
  center: { textAlign: 'center' },
});
