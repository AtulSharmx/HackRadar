import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import EventCard from '../../components/EventCard';
import { useToast } from '../../components/Toast';
import { dateShort } from '../../lib/format';
import { distanceKm } from '../../lib/geo';
import { layout, space, type, useAppTheme } from '../../theme';

// STEP 23 PREVIEW, dev builds only: real events copied from Supabase to show the components.
// Step 25 replaces this whole file with the live feed.
const snapshot = __DEV__ ? require('../../dev/preview-events.json') : null;
const GURUGRAM = { lat: 28.46, lng: 77.03 }; // my device row's rounded location

export default function FeedScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [saved, setSaved] = useState({});

  if (!snapshot) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  }
  const taken = new Date(snapshot.snapshot_taken);

  const toggle = (e) => {
    const was = !!saved[e.id];
    setSaved((s) => ({ ...s, [e.id]: !was }));
    if (!was) {
      toast('Saved. Reminders set for 7 days, 48 h and 24 h before the deadline.', {
        action: { label: 'Undo', onPress: () => setSaved((s) => ({ ...s, [e.id]: false })) },
      });
    }
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={snapshot.events}
      keyExtractor={(e) => e.id}
      ItemSeparatorComponent={() => <View style={{ height: layout.cardGap }} />}
      ListHeaderComponent={
        <Text style={[type.meta, styles.note, { color: colors.textSecondary }]}>
          Component preview: {snapshot.events.length} real events as of {dateShort(taken)}, distances from Gurugram.
          The live feed arrives in step 25.
        </Text>
      }
      renderItem={({ item }) => (
        <EventCard
          event={item}
          km={distanceKm(item, GURUGRAM)}
          saved={!!saved[item.id]}
          onToggleSave={() => toggle(item)}
          now={taken}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: layout.screenPadding, paddingBottom: space.xxl * 3 },
  note: { marginBottom: space.md },
});
