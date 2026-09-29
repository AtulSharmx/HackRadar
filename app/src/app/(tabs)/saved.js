import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import Button from '../../components/Button';
import EventCard from '../../components/EventCard';
import Sheet from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { distanceKm } from '../../lib/geo';
import { usePrefs } from '../../lib/prefs';
import { useSaved } from '../../lib/saved';
import { CHROME_MAX_SCALE, layout, radius, space, type, useAppTheme } from '../../theme';

function Segments({ value, onChange, counts, colors }) {
  const seg = (key, label) => {
    const on = value === key;
    return (
      <Pressable
        key={key}
        onPress={() => onChange(key)}
        style={[styles.seg, on && { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}, ${counts[key]}`}
      >
        <Text style={[type.label, { color: on ? colors.textPrimary : colors.textSecondary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
          {label} · {counts[key]}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={[styles.segments, { backgroundColor: colors.surfaceSoft }]} accessibilityRole="tablist">
      {seg('interested', 'Interested')}
      {seg('registered', 'Registered')}
    </View>
  );
}

// Swipe left reveals Remove (App Flow: Saved tab)
function RemoveAction({ onPress, colors }) {
  return (
    <Pressable onPress={onPress} style={[styles.removeAction, { backgroundColor: colors.urgent }]} accessibilityRole="button" accessibilityLabel="Remove">
      <MaterialCommunityIcons name="bookmark-remove-outline" size={24} color={colors.onBrand} />
      <Text style={[type.label, { color: colors.onBrand }]}>Remove</Text>
    </Pressable>
  );
}

export default function SavedScreen() {
  const { colors } = useAppTheme();
  const saved = useSaved();
  const toast = useToast();
  const { prefs } = usePrefs();
  const [tab, setTab] = useState('interested');
  const [showPast, setShowPast] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // entry whose action sheet is open
  const me = prefs?.lat != null ? { lat: prefs.lat, lng: prefs.lng } : null;
  const s = saved.sections();

  const remove = (id) => {
    const before = saved.remove(id);
    toast('Removed from Saved.', { action: { label: 'Undo', onPress: () => saved.restore(id, before) } });
  };

  const row = (entry, { swipe = true } = {}) => {
    const card = (
      <EventCard
        event={entry.event || { id: entry.id, title: 'Event no longer listed', status: 'stale' }}
        km={entry.event ? distanceKm(entry.event, me) : null}
        saved
        onToggleSave={() => remove(entry.id)}
        onPress={() => entry.event && router.push(`/event/${entry.id}`)}
        onLongPress={() => setMenuFor(entry)}
      />
    );
    return (
      <View key={entry.id} style={styles.rowGap}>
        {swipe ? (
          <ReanimatedSwipeable
            friction={2}
            rightThreshold={60}
            overshootRight={false}
            renderRightActions={() => <RemoveAction onPress={() => remove(entry.id)} colors={colors} />}
          >
            {card}
          </ReanimatedSwipeable>
        ) : card}
      </View>
    );
  };

  const list = s[tab];
  const empty = tab === 'interested'
    ? { text: 'Nothing saved yet. Tap the bookmark on any hackathon to keep it here.', action: 'Browse hackathons' }
    : { text: 'After you sign up for an event, mark it Registered and it moves here.', action: null };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Segments value={tab} onChange={setTab} counts={{ interested: s.interested.length, registered: s.registered.length }} colors={colors} />
      </View>
      {/* a ScrollView is fine here: saved lists are short (a person saves tens, not thousands) */}
      <ScrollView contentContainerStyle={styles.list}>
        {list.length ? list.map((e) => row(e)) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name={tab === 'interested' ? 'bookmark-outline' : 'check-circle-outline'} size={32} color={colors.textSecondary} />
            <Text style={[type.body, styles.emptyText, { color: colors.textPrimary }]}>{empty.text}</Text>
            {empty.action ? <Button label={empty.action} variant="secondary" onPress={() => router.navigate('/')} /> : null}
          </View>
        )}

        {s.past.length ? (
          <View style={styles.past}>
            <Pressable
              onPress={() => setShowPast((v) => !v)}
              style={styles.pastHeader}
              accessibilityRole="button"
              accessibilityState={{ expanded: showPast }}
              accessibilityLabel={`Past, ${s.past.length}`}
            >
              <Text style={[type.label, { color: colors.textSecondary }]}>Past · {s.past.length}</Text>
              <MaterialCommunityIcons name={showPast ? 'chevron-up' : 'chevron-down'} size={24} color={colors.textSecondary} />
            </Pressable>
            {showPast ? s.past.map((e) => row(e)) : null}
          </View>
        ) : null}
      </ScrollView>

      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.event?.title || 'Saved event'}>
        <View>
          {menuFor?.status === 'interested' ? (
            <Button label="Mark as Registered" variant="text" onPress={() => { saved.setStatus(menuFor.id, 'registered'); setMenuFor(null); toast('Moved to Registered.'); }} />
          ) : (
            <Button label="Move back to Interested" variant="text" onPress={() => { saved.setStatus(menuFor.id, 'interested'); setMenuFor(null); toast('Moved to Interested.'); }} />
          )}
          <Button label="Remove" variant="text" onPress={() => { const id = menuFor.id; setMenuFor(null); remove(id); }} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: layout.screenPadding, paddingTop: space.sm },
  segments: { flexDirection: 'row', borderRadius: radius.button, padding: space.xs, gap: space.xs },
  seg: {
    flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.button - 2, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent',
  },
  list: { padding: layout.screenPadding, paddingBottom: space.xxl * 2 },
  rowGap: { marginBottom: layout.cardGap },
  removeAction: {
    width: 104, alignItems: 'center', justifyContent: 'center', gap: space.xs,
    borderRadius: radius.card, marginLeft: space.sm,
  },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl * 2, paddingHorizontal: space.xl },
  emptyText: { textAlign: 'center' },
  past: { marginTop: space.lg },
  pastHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: layout.minTouch },
});
