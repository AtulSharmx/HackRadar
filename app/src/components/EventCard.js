import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { countdown, feeShort, prizeShort, whereShort } from '../lib/format';
import { layout, motion, radius, space, type, useAppTheme } from '../theme';
import PressableScale from './PressableScale';
import { TRUST } from './TrustLabel';

const TONE_ICON = { urgent: 'clock-alert-outline', soon: 'clock-outline', neutral: 'clock-outline', muted: 'clock-remove-outline' };
const MODE_ICON = { online: 'web', offline: 'map-marker-outline', hybrid: 'map-marker-radius-outline' };

function Meta({ icon, text, color }) {
  return (
    <View style={styles.metaItem}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={[type.meta, { color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function Bookmark({ saved, onToggle, title, colors }) {
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Pressable
      onPress={() => {
        if (!saved) {
          // a small "pop" confirms the save; instant when animations are off (ReduceMotion.System)
          pop.value = withSequence(withSpring(1.25, motion.spring), withSpring(1, motion.spring));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onToggle?.();
      }}
      style={styles.bookmark}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${title} from saved` : `Save ${title}`}
      accessibilityState={{ selected: saved }}
    >
      <Animated.View style={style}>
        <MaterialCommunityIcons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={24}
          color={saved ? colors.brand : colors.textSecondary}
        />
      </Animated.View>
    </Pressable>
  );
}

// event: a row from the events table. km: distance from me (null when unknown).
function EventCard({ event, km = null, saved = false, onPress, onLongPress, onToggleSave, now }) {
  const { colors, elevation } = useAppTheme();
  const cd = countdown(event, now);
  const inactive = cd.tone === 'muted';
  const trust = TRUST[event.status === 'stale' ? 'stale' : event.trust_label] || TRUST.check_details;
  const toneColor = cd.tone === 'neutral' ? colors.textSecondary : colors[cd.tone];
  const where = whereShort(event, km);
  const fee = feeShort(event.fee_amount);
  const prize = prizeShort(event.prize_amount_inr, event.prize_approximate);
  const warning = event.trust_label === 'warning';

  // TalkBack reads the card as one sentence (brief: Accessibility rules)
  const spoken = [
    event.title + (event.organizer ? ` by ${event.organizer}` : ''),
    cd.text,
    event.mode,
    where !== 'Online' ? where.replace('km', 'kilometres') : null,
    fee,
    prize ? `${prize} prize` : null,
    trust.word,
  ].filter(Boolean).join(', ');

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens details"
      style={[
        styles.card,
        elevation.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        warning && { borderLeftWidth: 3, borderLeftColor: colors.urgent },
      ]}
    >
      <View style={styles.row1}>
        <View style={styles.countdown}>
          <MaterialCommunityIcons name={TONE_ICON[cd.tone]} size={16} color={toneColor} />
          <Text style={[type.countdown, { color: toneColor }]}>{cd.text}</Text>
        </View>
        <View style={styles.row1Right}>
          <MaterialCommunityIcons name={trust.icon} size={20} color={colors[trust.tone]} />
          {onToggleSave ? <Bookmark saved={saved} onToggle={onToggleSave} title={event.title} colors={colors} /> : null}
        </View>
      </View>

      {/* brief: closed/stale cards fade to 60%, but the "Closed"/"Outdated" word above stays readable */}
      <View style={inactive && styles.faded}>
        <Text style={[type.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {event.title}
        </Text>
        {event.organizer ? (
          <Text style={[type.meta, styles.organizer, { color: colors.textSecondary }]} numberOfLines={1}>
            {event.organizer}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Meta icon={MODE_ICON[event.mode] || 'map-marker-outline'} text={where} color={colors.textSecondary} />
          <Meta icon="currency-inr" text={fee} color={colors.textSecondary} />
          {prize ? <Meta icon="trophy-outline" text={prize} color={colors.textSecondary} /> : null}
        </View>
      </View>
    </PressableScale>
  );
}

export default memo(EventCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: layout.cardPadding,
    paddingBottom: layout.cardPadding,
    paddingTop: space.xs,
  },
  row1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: layout.minTouch },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  row1Right: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginRight: -space.md }, // bookmark's 48dp target reaches the card edge
  bookmark: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  organizer: { marginTop: space.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs, marginTop: space.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs, maxWidth: '100%' },
  faded: { opacity: 0.6 },
});
