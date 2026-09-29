import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import TrustLabel from '../../components/TrustLabel';
import { loadCache } from '../../lib/feed';
import { MODE_NAMES, THEME_NAMES } from '../../lib/labels';
import {
  ago, countdown, dateRange, dateTime, feeLong, hostOf, prizeShort, safeUrl, teamSize,
} from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { CHROME_MAX_SCALE, layout, radius, space, type, useAppTheme } from '../../theme';


// Cache first (instant, works offline); fall back to the server for events opened from a link or notification.
function useEvent(id) {
  const [state, setState] = useState(() => ({ event: loadCache().events[id] || null, missing: false }));
  useEffect(() => {
    if (state.event) return;
    supabase.from('events').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => setState({ event: data, missing: !data }))
      .catch(() => setState({ event: null, missing: true }));
  }, [id, state.event]);
  return state;
}

function HeaderIcon({ icon, label, onPress, color }) {
  return (
    <Pressable onPress={onPress} style={styles.headerIcon} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
    </Pressable>
  );
}

function Row({ label, value, colors }) {
  if (!value) return null;
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[type.meta, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[type.body, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

export default function EventDetail() {
  const { id } = useLocalSearchParams();
  const { colors, elevation } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { event, missing } = useEvent(id);

  if (!event) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: '' }} />
        {missing ? (
          <Text style={[type.body, { color: colors.textPrimary }]}>That event is no longer listed.</Text>
        ) : (
          <ActivityIndicator color={colors.brand} />
        )}
      </View>
    );
  }

  const cd = countdown(event);
  const closed = cd.tone === 'muted';
  const toneColor = cd.tone === 'neutral' ? colors.textSecondary : colors[cd.tone];
  const linkOk = safeUrl(event.registration_url);
  const host = hostOf(event.registration_url);
  const inPerson = event.mode === 'offline' || event.mode === 'hybrid';
  const prize = [prizeShort(event.prize_amount_inr, event.prize_approximate), event.prize_text]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' · ');
  const team = teamSize(event.team_min, event.team_max);
  const themes = (event.themes || []).filter((t) => t !== 'other');
  const summary = [
    feeLong(event.fee_amount),
    MODE_NAMES[event.mode],
    team,
    themes.map((t) => THEME_NAMES[t]).slice(0, 2).join(', ') || null,
  ].filter(Boolean).join(' · ');

  const apply = () => WebBrowser.openBrowserAsync(event.registration_url, {
    toolbarColor: colors.surface,
    controlsColor: colors.brand,
  });
  const share = () => Share.share({
    message: [
      event.title,
      event.registration_deadline ? `Registration closes ${dateTime(event.registration_deadline)}` : null,
      event.registration_url,
    ].filter(Boolean).join('\n'),
  });
  const openMaps = () => {
    const q = event.lat != null && !event.location_approximate
      ? `${event.lat},${event.lng}`
      : [event.venue_address, event.city, event.state].filter(Boolean).join(', ');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
  };

  const place = [event.venue_address, event.city].filter(Boolean).join(', ');
  const venue = inPerson ? place && place + (event.location_approximate ? ' (approx. location)' : '') : 'Online';

  let applyLabel = 'Apply';
  if (closed) applyLabel = 'Registration closed';
  else if (!linkOk) applyLabel = 'Link looks unsafe';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={styles.headerActions}>
              {linkOk ? <HeaderIcon icon="share-variant-outline" label="Share" onPress={share} color={colors.textPrimary} /> : null}
              {inPerson ? <HeaderIcon icon="map-outline" label="Open in Maps" onPress={openMaps} color={colors.textPrimary} /> : null}
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}>
        <View style={styles.badges}>
          <View style={styles.countdown}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={toneColor} />
            <Text style={[type.countdown, { color: toneColor }]}>{cd.text}</Text>
          </View>
          <TrustLabel label={event.status === 'stale' ? 'stale' : event.trust_label} />
        </View>

        <Text style={[type.screenTitle, { color: colors.textPrimary }]} accessibilityRole="header">
          {event.title}
        </Text>
        {event.organizer ? (
          <Text style={[type.body, styles.organizer, { color: colors.textSecondary }]}>{event.organizer}</Text>
        ) : null}

        <View style={[styles.summary, { backgroundColor: colors.surfaceSoft }]}>
          <Text style={[type.label, { color: colors.textPrimary }]}>{summary}</Text>
        </View>

        {event.warnings?.length ? (
          <View style={[styles.warning, { borderColor: colors.urgent, backgroundColor: colors.urgentSoft }]} accessibilityRole="alert">
            <View style={styles.warningHead}>
              <MaterialCommunityIcons name="alert-outline" size={20} color={colors.urgent} />
              <Text style={[type.label, { color: colors.urgent }]}>Check before you register</Text>
            </View>
            {event.warnings.map((w) => (
              <Text key={w.code} style={[type.body, { color: colors.textPrimary }]}>{w.text}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.details}>
          <Row label="Registration closes" value={event.registration_deadline ? dateTime(event.registration_deadline) : 'Deadline not listed'} colors={colors} />
          <Row label="Event dates" value={dateRange(event.start_date, event.end_date)} colors={colors} />
          <Row label="Venue" value={venue || 'Venue not listed'} colors={colors} />
          <Row label="Team" value={team || (event.solo_allowed ? 'Solo allowed' : null)} colors={colors} />
          <Row label="Fee" value={feeLong(event.fee_amount)} colors={colors} />
          <Row label="Prizes" value={prize || null} colors={colors} />
          <Row label="Eligibility" value={event.eligibility_text} colors={colors} />
          <Row label="About" value={event.description_short} colors={colors} />
        </View>

        {themes.length ? (
          <View style={styles.tags}>
            {themes.map((t) => (
              <View key={t} style={[styles.tag, { borderColor: colors.border }]}>
                <Text style={[type.meta, { color: colors.textPrimary }]}>{THEME_NAMES[t]}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[type.meta, styles.source, { color: colors.textSecondary }]}>
          Listed on {host || 'the organizer site'} · Checked {ago(event.last_checked_at)}
        </Text>
      </ScrollView>

      {/* sticky bottom bar: the one main action on this screen */}
      <View
        style={[
          styles.bottomBar,
          elevation.card,
          { paddingBottom: insets.bottom + space.md, backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        {linkOk && !closed ? (
          <Text style={[type.meta, styles.opens, { color: colors.textSecondary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
            Opens {host}
          </Text>
        ) : null}
        <Button label={applyLabel} onPress={apply} disabled={closed || !linkOk} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  content: { padding: layout.screenPadding, gap: space.md },
  headerActions: { flexDirection: 'row' },
  headerIcon: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  organizer: { marginTop: -space.sm },
  summary: { borderRadius: radius.button, padding: space.md },
  warning: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: space.xs },
  warningHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  details: { marginTop: space.xs },
  row: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  source: { marginTop: space.sm },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: space.sm, paddingHorizontal: layout.screenPadding, borderTopWidth: StyleSheet.hairlineWidth,
  },
  opens: { textAlign: 'center', marginBottom: space.xs },
});
