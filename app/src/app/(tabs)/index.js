import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { router, useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Banner from '../../components/Banner';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import EventCard from '../../components/EventCard';
import FilterSheet from '../../components/FilterSheet';
import SkeletonCard from '../../components/SkeletonCard';
import SortSheet from '../../components/SortSheet';
import { useToast } from '../../components/Toast';
import { activeChips, applyView, defaultFilters, SORTS } from '../../lib/feedView';
import { ago } from '../../lib/format';
import { distanceKm } from '../../lib/geo';
import { usePrefs } from '../../lib/prefs';
import { useSaved } from '../../lib/saved';
import { useSaveToggle } from '../../lib/useSaveToggle';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { useFeed } from '../../lib/useFeed';
import { CHROME_MAX_SCALE, layout, motion, radius, space, type, useAppTheme } from '../../theme';

const BAR_SPACE = 88; // list bottom padding so the last card clears the floating bar

function Separator() {
  return <View style={{ height: layout.cardGap }} />;
}

function Centered({ icon, text, action, colors }) {
  return (
    <View style={styles.centered}>
      <MaterialCommunityIcons name={icon} size={32} color={colors.textSecondary} />
      <Text style={[type.body, styles.centerText, { color: colors.textPrimary }]}>{text}</Text>
      {action}
    </View>
  );
}

export default function FeedScreen() {
  const { colors, elevation } = useAppTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useSession();
  const { events, fetchedAt, hasCache, syncing, error, refresh } = useFeed();
  const { prefs } = usePrefs();
  const saved = useSaved();
  const toggleSave = useSaveToggle();
  const me = prefs?.lat != null ? { lat: prefs.lat, lng: prefs.lng } : null;

  const defaults = useMemo(() => defaultFilters(prefs), [prefs]);
  const [filters, setFilters] = useState(defaults);
  const [sort, setSort] = useState('best');
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null); // 'filters' | 'sort' | null
  useEffect(() => setFilters(defaults), [defaults]); // prefs changed in Settings -> new defaults

  const shown = useMemo(() => applyView(events, { query, filters, sort, prefs }), [events, query, filters, sort, prefs]);
  const chips = activeChips(filters, !!me);

  // Floating "Filters · Sort" bar hides while scrolling down, returns on scroll up (animated on the UI thread)
  const hidden = useSharedValue(0);
  const lastY = useRef(0);
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden.value * 120 }],
    opacity: 1 - hidden.value,
  }));
  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > lastY.current + 8 && y > 80) hidden.value = withTiming(1, { duration: motion.base });
    else if (y < lastY.current - 8 || y < 80) hidden.value = withTiming(0, { duration: motion.base });
    lastY.current = y;
  };

  // brief: sync indicator on the right of the header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        syncing ? <ActivityIndicator style={styles.sync} color={colors.brand} accessibilityLabel="Updating hackathons" /> : null,
    });
  }, [navigation, syncing, colors.brand]);

  const saveAlert = async (f) => {
    if (!user) return toast("Couldn't save. Check your connection.");
    const { error: e } = await supabase.from('devices').update({ alert_filter: f }).eq('id', user.id);
    toast(e ? "Couldn't save. Check your connection." : 'Saved as your alert filter.');
  };

  // First open, nothing cached yet
  if (!hasCache) {
    if (error) {
      return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <Centered
            icon="wifi-off"
            text="Can't load hackathons. Check your connection."
            action={<Button label="Retry" variant="secondary" onPress={refresh} style={styles.centerAction} />}
            colors={colors}
          />
        </View>
      );
    }
    return (
      <View style={[styles.screen, styles.list, { backgroundColor: colors.background }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={i ? { marginTop: layout.cardGap } : null}>
            <SkeletonCard />
          </View>
        ))}
      </View>
    );
  }

  const sortLabel = SORTS.find(([k]) => k === sort)?.[1];
  const nothingOpen = events.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {error ? <Banner icon="wifi-off" text={`Offline. Showing events from ${ago(fetchedAt)}.`} /> : null}
      {!me && !error ? <Banner icon="map-marker-off-outline" text="Set your city to see how far offline hackathons are." /> : null}

      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search hackathons or organizers"
            placeholderTextColor={colors.textSecondary}
            style={[type.body, styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            autoCorrect={false}
            autoComplete="off"
            accessibilityLabel="Search hackathons or organizers"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear search">
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {chips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map((c) => (
            <Chip key={c.key} label={c.label} selected onPress={() => setFilters(c.clear(filters))} />
          ))}
        </ScrollView>
      ) : null}

      <FlashList
        data={shown}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            km={distanceKm(item, me)}
            saved={saved.isSaved(item.id)}
            onToggleSave={() => toggleSave(item)}
            onPress={() => router.push(`/event/${item.id}`)}
          />
        )}
        extraData={[me, saved.entries]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{ ...styles.list, paddingBottom: BAR_SPACE }}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={refresh} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
        }
        ListEmptyComponent={
          nothingOpen ? (
            // never pretend there are simply no hackathons (App Flow, edge case 5)
            <Centered icon="radar" text="No new events found recently. We're checking the sources." colors={colors} />
          ) : (
            <Centered
              icon="filter-off-outline"
              text={query ? `No hackathons match "${query.trim()}".` : 'No hackathons match these filters.'}
              colors={colors}
              action={
                <View style={styles.emptyActions}>
                  {query ? <Button label="Clear search" variant="secondary" onPress={() => setQuery('')} /> : null}
                  {!query && chips.length ? (
                    <Button label="Remove last filter" variant="secondary" onPress={() => setFilters(chips[chips.length - 1].clear(filters))} />
                  ) : null}
                  {!query ? <Button label="Reset filters" variant="text" onPress={() => setFilters(defaults)} /> : null}
                </View>
              }
            />
          )
        }
        ListFooterComponent={
          shown.length ? (
            <Text style={[type.meta, styles.footer, { color: colors.textSecondary }]}>
              {shown.length} of {events.length} open hackathons · Updated {ago(fetchedAt)}
            </Text>
          ) : null
        }
      />

      <Animated.View style={[styles.barWrap, barStyle]} pointerEvents="box-none">
        <View style={[styles.bar, elevation.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable onPress={() => setSheet('filters')} style={styles.barHalf} accessibilityRole="button" accessibilityLabel={`Filters, ${chips.length} active`}>
            <MaterialCommunityIcons name="tune-variant" size={20} color={colors.brand} />
            <Text style={[type.label, { color: colors.textPrimary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
              {chips.length ? `Filters · ${chips.length}` : 'Filters'}
            </Text>
          </Pressable>
          <View style={[styles.barDivider, { backgroundColor: colors.border }]} />
          <Pressable onPress={() => setSheet('sort')} style={styles.barHalf} accessibilityRole="button" accessibilityLabel={`Sort, ${sortLabel}`}>
            <MaterialCommunityIcons name="sort" size={20} color={colors.brand} />
            <Text style={[type.label, { color: colors.textPrimary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>{sortLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>

      <FilterSheet
        visible={sheet === 'filters'}
        onClose={() => setSheet(null)}
        filters={filters}
        defaults={defaults}
        onApply={(f) => {
          setFilters(f);
          setSheet(null);
        }}
        onSaveAlert={saveAlert}
        events={events}
        query={query}
        sort={sort}
        prefs={prefs}
      />
      <SortSheet
        visible={sheet === 'sort'}
        onClose={() => setSheet(null)}
        sort={sort}
        hasLocation={!!me}
        onPick={(s) => {
          setSort(s);
          setSheet(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: layout.screenPadding },
  sync: { marginRight: layout.screenPadding },
  searchWrap: { paddingHorizontal: layout.screenPadding, paddingTop: space.sm },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTouch,
    borderWidth: 1, borderRadius: radius.button, paddingLeft: space.md,
  },
  searchInput: { flex: 1, paddingVertical: space.sm },
  clear: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: layout.screenPadding, paddingTop: space.md, gap: space.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md },
  centerText: { textAlign: 'center' },
  centerAction: { marginTop: space.sm },
  emptyActions: { alignItems: 'center', gap: space.xs, marginTop: space.sm },
  footer: { textAlign: 'center', marginTop: space.xl },
  barWrap: { position: 'absolute', left: 0, right: 0, bottom: space.lg, alignItems: 'center' },
  bar: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },
  barHalf: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTouch, paddingHorizontal: space.lg },
  barDivider: { width: StyleSheet.hairlineWidth, height: 24 },
});
