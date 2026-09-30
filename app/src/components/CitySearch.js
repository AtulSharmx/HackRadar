import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { select, success, warn } from '../lib/haptics';
import { localPlaces, locateMe, searchPlaces } from '../lib/places';
import { CHROME_MAX_SCALE, layout, motion, space, type, useAppTheme } from '../theme';

function Row({ icon, title, detail, onPress, colors, busy, tone }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      android_ripple={{ color: colors.border }}
      style={[styles.row, { borderBottomColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
    >
      {busy ? <ActivityIndicator color={colors.brand} style={styles.rowIcon} /> : (
        <MaterialCommunityIcons name={icon} size={22} color={tone || colors.textSecondary} style={styles.rowIcon} />
      )}
      <View style={styles.rowText}>
        <Text style={[type.body, { color: tone || colors.textPrimary }]} numberOfLines={1}>{title}</Text>
        {detail ? <Text style={[type.meta, { color: colors.textSecondary }]} numberOfLines={1}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

// Full screen, search box at the top and suggestions right under it, so the keyboard never hides them
// (the old in-sheet list sat behind the keyboard). onPick({ city, state, lat, lng }); onRemove optional.
export default function CitySearch({ visible, onClose, onPick, onRemove }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState(null); // Photon's latest answer
  const [status, setStatus] = useState('idle'); // idle | loading | done | failed
  const [gps, setGps] = useState({ busy: false, note: null });

  useEffect(() => {
    if (visible) return;
    setQuery('');
    setOnline(null);
    setStatus('idle');
    setGps({ busy: false, note: null });
  }, [visible]);

  // search as you type: 250 ms after the last key, older requests cancelled
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOnline(null);
      setStatus('idle');
      return undefined;
    }
    const ctrl = new AbortController();
    setStatus('loading');
    const timer = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((found) => {
          setOnline(found);
          setStatus('done');
        })
        .catch((e) => {
          if (e?.name !== 'AbortError') setStatus('failed');
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const pick = (place) => {
    select();
    onPick({ city: place.city, state: place.state, lat: place.lat, lng: place.lng });
  };

  const useGps = async () => {
    setGps({ busy: true, note: null });
    try {
      const found = await locateMe();
      if (found.denied) {
        warn();
        setGps({
          busy: false,
          note: found.canAskAgain
            ? { text: 'No problem, search for your city instead.' }
            : { text: 'Location is off for HackRadar. You can still search for your city.', openSettings: true },
        });
        return;
      }
      success();
      setGps({ busy: false, note: null });
      onPick(found);
    } catch {
      warn();
      setGps({ busy: false, note: { text: "Couldn't get your location. Search for your city instead." } });
    }
  };

  const local = localPlaces(query);
  const list = online?.length ? online : local;
  const q = query.trim();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.bar, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back" hitSlop={4}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            autoCapitalize="words"
            autoComplete="postal-address-locality"
            textContentType="addressCity"
            returnKeyType="search"
            placeholder="Search your city or area"
            placeholderTextColor={colors.textSecondary}
            style={[type.body, styles.input, { color: colors.textPrimary }]}
            accessibilityLabel="Search your city or area"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Clear search">
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}>
          <Row
            icon="crosshairs-gps"
            title={gps.busy ? 'Finding you…' : 'Use my current location'}
            detail="Most accurate: uses GPS once, stored to about 1 km"
            onPress={useGps}
            busy={gps.busy}
            tone={colors.brand}
            colors={colors}
          />
          {gps.note ? (
            <View style={styles.note}>
              <Text style={[type.body, { color: colors.textPrimary }]}>{gps.note.text}</Text>
              {gps.note.openSettings ? (
                <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button">
                  <Text style={[type.label, { color: colors.brand }]}>Open settings</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {list.map((p) => (
            <Animated.View key={p.key} entering={FadeIn.duration(motion.fast)}>
              <Row icon="map-marker-outline" title={p.name} detail={p.detail} onPress={() => pick(p)} colors={colors} />
            </Animated.View>
          ))}

          {q.length >= 2 ? (
            <Text style={[type.meta, styles.status, { color: colors.textSecondary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
              {status === 'loading' ? 'Searching…' : null}
              {status === 'failed' ? "Can't reach place search. Showing cities saved on your phone." : null}
              {status === 'done' && !list.length ? `No place called "${q}". Check the spelling or try a nearby city.` : null}
            </Text>
          ) : (
            <Text style={[type.meta, styles.status, { color: colors.textSecondary }]}>Type at least 2 letters, for example Gurugram or Sector 45.</Text>
          )}

          {onRemove ? (
            <Row icon="map-marker-remove-outline" title="Remove my location" onPress={onRemove} colors={colors} />
          ) : null}

          <Text style={[type.meta, styles.credit, { color: colors.textSecondary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
            Place search by Photon (komoot) · © OpenStreetMap contributors
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 56, paddingHorizontal: space.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60,
    paddingHorizontal: layout.screenPadding, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: { width: 24 },
  rowText: { flex: 1, paddingVertical: space.sm },
  note: { paddingHorizontal: layout.screenPadding, paddingVertical: space.md, gap: space.xs },
  status: { paddingHorizontal: layout.screenPadding, paddingTop: space.md },
  credit: { paddingHorizontal: layout.screenPadding, paddingTop: space.xl, textAlign: 'center' },
});
