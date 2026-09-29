import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Banner from '../../components/Banner';
import Button from '../../components/Button';
import EventCard from '../../components/EventCard';
import SkeletonCard from '../../components/SkeletonCard';
import { ago } from '../../lib/format';
import { useFeed } from '../../lib/useFeed';
import { layout, space, type, useAppTheme } from '../../theme';

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
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { events, fetchedAt, hasCache, syncing, error, refresh } = useFeed();

  // brief: sync indicator on the right of the header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        syncing ? (
          <ActivityIndicator style={styles.sync} color={colors.brand} accessibilityLabel="Updating hackathons" />
        ) : null,
    });
  }, [navigation, syncing, colors.brand]);

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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {error ? <Banner icon="wifi-off" text={`Offline. Showing events from ${ago(fetchedAt)}.`} /> : null}
      <FlashList
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EventCard event={item} />}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{ ...styles.list, paddingBottom: insets.bottom + space.xxl }}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={refresh} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
        }
        ListEmptyComponent={
          // never pretend there are simply no hackathons (App Flow, edge case 5)
          <Centered icon="radar" text="No new events found recently. We're checking the sources." colors={colors} />
        }
        ListFooterComponent={
          events.length ? (
            <Text style={[type.meta, styles.footer, { color: colors.textSecondary }]}>
              {events.length} open hackathons · Updated {ago(fetchedAt)}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: layout.screenPadding },
  sync: { marginRight: layout.screenPadding },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md },
  centerText: { textAlign: 'center' },
  centerAction: { marginTop: space.sm },
  footer: { textAlign: 'center', marginTop: space.xl },
});
