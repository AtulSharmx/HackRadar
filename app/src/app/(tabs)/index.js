import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { startTransition, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import Banner from '../../components/Banner';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import CitySearch from '../../components/CitySearch';
import EventCard from '../../components/EventCard';
import FilterSheet from '../../components/FilterSheet';
import IconButton from '../../components/IconButton';
import PressableScale from '../../components/PressableScale';
import SkeletonCard from '../../components/SkeletonCard';
import SortSheet from '../../components/SortSheet';
import { useToast } from '../../components/Toast';
import { activeChips, applyView, clearedFilters, defaultFilters, pageOf, SORTS } from '../../lib/feedView';
import { ago } from '../../lib/format';
import { distanceKm } from '../../lib/geo';
import { select, tap } from '../../lib/haptics';
import { usePrefs } from '../../lib/prefs';
import { useSaved } from '../../lib/saved';
import { useSaveToggle } from '../../lib/useSaveToggle';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { useFeed } from '../../lib/useFeed';
import { CHROME_MAX_SCALE, layout, motion, radius, space, type, useAppTheme } from '../../theme';

// built once, not on every render: cards of a new page fade up in a quick stagger, kept ones glide
const ENTER = [0, 1, 2, 3, 4, 5].map((i) => FadeInDown.duration(motion.base).delay(i * 18));
const GLIDE = LinearTransition.duration(motion.base);
const CHIP_IN = FadeIn.duration(motion.fast);
const CHIP_OUT = FadeOut.duration(motion.fast);
const openEvent = (event) => router.push(`/event/${event.id}`);

function Centered({ icon, text, action, colors }) {
  return (
    <View style={styles.centered}>
      <MaterialCommunityIcons name={icon} size={32} color={colors.textSecondary} />
      <Text style={[type.body, styles.centerText, { color: colors.textPrimary }]}>{text}</Text>
      {action}
    </View>
  );
}

function PageButton({ icon, label, disabled, onPress, colors }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={[styles.pageBtn, { borderColor: colors.border, backgroundColor: colors.surface }, disabled && styles.pageBtnOff]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <MaterialCommunityIcons name={icon} size={24} color={colors.textPrimary} />
    </PressableScale>
  );
}

// 10 hackathons a page (user's choice, 30 Sep): "<  Page 2 of 25  >"
function Pager({ page, pages, onGo, colors }) {
  return (
    <View style={styles.pager} accessibilityRole="toolbar">
      <PageButton icon="chevron-left" label="Previous page" disabled={page <= 1} onPress={() => onGo(page - 1)} colors={colors} />
      <Text style={[type.meta, styles.pageText, { color: colors.textSecondary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
        Page {page} of {pages}
      </Text>
      <PageButton icon="chevron-right" label="Next page" disabled={page >= pages} onPress={() => onGo(page + 1)} colors={colors} />
    </View>
  );
}

export default function FeedScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useSession();
  const { events, fetchedAt, hasCache, syncing, error, refresh } = useFeed();
  const { prefs, update } = usePrefs();
  const saved = useSaved();
  const toggleSave = useSaveToggle();
  const me = prefs?.lat != null ? { lat: prefs.lat, lng: prefs.lng } : null;

  const defaults = useMemo(() => defaultFilters(prefs), [prefs]);
  const [filters, setFilters] = useState(defaults);
  const [sort, setSort] = useState('best');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState(null); // 'filters' | 'sort' | 'city' | null
  useEffect(() => setFilters(defaults), [defaults]); // prefs changed in Settings -> new defaults

  // A tapped "3 new hackathons match" push opens the Feed with ?from=<ids>: only those show until the
  // "From notification" chip is removed (App Flow "Notification flows")
  const { from } = useLocalSearchParams();
  const only = useMemo(() => (from ? new Set(String(from).split(',')) : null), [from]);
  const clearFrom = () => router.setParams({ from: undefined });

  // typing stays instant: the list catches up with the search box a moment later
  const search = useDeferredValue(query);
  const shown = useMemo(
    () => applyView(events, { query: search, filters, sort, prefs, only }),
    [events, search, filters, sort, prefs, only],
  );
  const { items, page: current, pages } = pageOf(shown, page);
  const chips = activeChips(filters, !!me);
  const openCity = () => setSheet('city'); // one sheet at a time: this also closes Filters or Sort

  const listRef = useRef(null);
  const toTop = (animated) => listRef.current?.scrollTo({ y: 0, animated });

  // A new sort, filter or search starts again at page 1, at the top
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    setPage(1);
    toTop(false);
  }, [sort, filters, query, only]); // eslint-disable-line react-hooks/exhaustive-deps

  // cards are on screen at once when the app opens; only a new page or order fades them in
  const shownOnce = useRef(false);
  useEffect(() => {
    if (hasCache) shownOnce.current = true;
  });

  const goPage = (n) => {
    select();
    setPage(n);
    toTop(true);
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

  let empty = null;
  if (!shown.length && only) {
    // the events from the push closed or were removed since (App Flow: "That event is no longer listed")
    empty = (
      <Centered
        icon="calendar-remove-outline"
        text="Those hackathons are no longer listed."
        colors={colors}
        action={<Button label="Show all hackathons" variant="secondary" onPress={clearFrom} style={styles.centerAction} />}
      />
    );
  } else if (!shown.length) {
    empty = nothingOpen ? (
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
            {!query ? <Button label="Clear filters" variant="text" onPress={() => setFilters(clearedFilters())} /> : null}
          </View>
        }
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {error ? <Banner icon="wifi-off" text={`Offline. Showing events from ${ago(fetchedAt)}.`} /> : null}

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
            <IconButton
              icon="close-circle"
              size={18}
              color={colors.textSecondary}
              label="Clear search"
              onPress={() => {
                select();
                setQuery('');
              }}
            />
          ) : null}
        </View>
      </View>

      {/* One row, the way shopping and food apps do it: what opens something first (Filters, Sort, City),
          then the filters that are on, each removable with one tap */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chipsBar}
        contentContainerStyle={styles.chips}
      >
        {only ? ( // first, so it is clear why only a few events show
          <Chip label="From notification" selected soft accessibilityLabel="From notification. Show all hackathons" onPress={clearFrom} />
        ) : null}
        <Chip
          role="button"
          icon="tune-variant"
          label={chips.length ? `Filters · ${chips.length}` : 'Filters'}
          accessibilityLabel={`Filters, ${chips.length} on`}
          onPress={() => setSheet('filters')}
        />
        <Chip role="button" icon="sort" endIcon="chevron-down" label={sortLabel} accessibilityLabel={`Sort, ${sortLabel}`} onPress={() => setSheet('sort')} />
        <Chip
          role="button"
          icon={me ? 'map-marker-outline' : 'map-marker-plus-outline'}
          endIcon={me ? 'chevron-down' : undefined}
          label={me ? prefs.city || 'Your location' : 'Set city'}
          accessibilityLabel={me ? `City, ${prefs.city || 'set'}. Change` : 'Set your city to see offline hackathons near you'}
          onPress={openCity}
        />
        {only ? null : chips.map((c) => (
          <Animated.View key={c.key} entering={CHIP_IN} exiting={CHIP_OUT} layout={GLIDE}>
            <Chip label={c.label} selected soft accessibilityLabel={`${c.label}. Remove filter`} onPress={() => setFilters(c.clear(filters))} />
          </Animated.View>
        ))}
      </ScrollView>

      <ScrollView
        ref={listRef}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, !shown.length && styles.grow]}
        refreshControl={(
          <RefreshControl
            refreshing={syncing}
            onRefresh={() => {
              tap();
              refresh();
            }}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        )}
      >
        {empty}
        {items.map((item, i) => (
          // cards of a new page (or a new order) fade up in a quick stagger; kept ones glide to their new place
          <Animated.View
            key={item.id}
            entering={shownOnce.current ? ENTER[Math.min(i, 5)] : undefined}
            layout={GLIDE}
            style={i ? styles.gap : null}
          >
            <EventCard
              event={item}
              km={distanceKm(item, me)}
              saved={saved.isSaved(item.id)}
              onToggleSave={toggleSave}
              onPress={openEvent}
              posted={sort === 'newest' ? item.posted_at || item.first_seen_at : null}
            />
          </Animated.View>
        ))}
        {shown.length ? (
          <>
            {pages > 1 ? <Pager page={current} pages={pages} onGo={goPage} colors={colors} /> : null}
            <Text style={[type.meta, styles.footer, { color: colors.textSecondary }]}>
              {shown.length} of {events.length} open hackathons · Updated {ago(fetchedAt)}
            </Text>
          </>
        ) : null}
      </ScrollView>

      <FilterSheet
        visible={sheet === 'filters'}
        onClose={() => setSheet(null)}
        filters={filters}
        onApply={(f) => {
          setSheet(null);
          startTransition(() => setFilters(f));
        }}
        onSaveAlert={saveAlert}
        onSetCity={openCity}
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
        onSetCity={openCity}
        onPick={(s) => {
          setSheet(null); // the sheet answers the tap at once; the re-sorted list follows right after
          startTransition(() => setSort(s));
        }}
      />
      <CitySearch
        visible={sheet === 'city'}
        onClose={() => setSheet(null)}
        onPick={(p) => {
          update(p);
          setSheet(null);
          toast(p.city ? `Location set to ${p.city}.` : 'Location set.');
        }}
        onRemove={prefs?.city ? () => {
          update({ city: null, state: null, lat: null, lng: null });
          setSheet(null);
          toast('Location removed. The Feed shows online events.');
        } : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: layout.screenPadding, paddingBottom: space.xxl },
  grow: { flexGrow: 1 },
  gap: { marginTop: layout.cardGap },
  sync: { marginRight: layout.screenPadding },
  searchWrap: { paddingHorizontal: layout.screenPadding, paddingTop: space.sm },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTouch,
    borderWidth: 1, borderRadius: radius.button, paddingLeft: space.md,
  },
  searchInput: { flex: 1, paddingVertical: space.sm },
  // a horizontal ScrollView grows to fill free height by default, which pushed the list half down the screen
  chipsBar: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: layout.screenPadding, paddingTop: space.md, gap: space.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md },
  centerText: { textAlign: 'center' },
  centerAction: { marginTop: space.sm },
  emptyActions: { alignItems: 'center', gap: space.xs, marginTop: space.sm },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl },
  pageBtn: {
    width: layout.minTouch, height: layout.minTouch, borderRadius: radius.pill, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  pageBtnOff: { opacity: 0.35 },
  pageText: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  footer: { textAlign: 'center', marginTop: space.lg },
});
