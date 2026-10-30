import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import IconButton from '../../components/IconButton';
import PressableScale from '../../components/PressableScale';
import RegisterPrompt from '../../components/RegisterPrompt';
import ReportSheet from '../../components/ReportSheet';
import Sheet from '../../components/Sheet';
import { useToast, useToastLift } from '../../components/Toast';
import TrustLabel from '../../components/TrustLabel';
import { loadCache } from '../../lib/feed';
import {
  ago, countdown, dateRange, dateTime, feeLong, hostOf, joinAnd, prizeLong, safeUrl, teamSize, whereShort,
} from '../../lib/format';
import { distanceKm } from '../../lib/geo';
import { success } from '../../lib/haptics';
import { PLATFORM_NAMES, MODE_NAMES, THEME_NAMES } from '../../lib/labels';
import { appFor, openInApp, openStore } from '../../lib/openRegistration';
import { usePrefs } from '../../lib/prefs';
import { useSaved } from '../../lib/saved';
import { supabase } from '../../lib/supabase';
import { useSaveToggle } from '../../lib/useSaveToggle';
import { CHROME_MAX_SCALE, layout, radius, space, type, useAppTheme } from '../../theme';

const AWAY_TO_ASK = 15000; // back sooner than 15 s from the registration page: they didn't register, don't ask

// Feed cache first (instant, offline), then my saved copy (a saved event that already left the feed),
// then the server (links, notifications). A failed request says "can't load", never "no longer listed".
function useEvent(id, savedCopy) {
  const [state, setState] = useState(() => ({ event: loadCache().events[id] || savedCopy || null, status: 'ok' }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (state.event) return undefined;
    let live = true;
    supabase.from('events').select('*').eq('id', id).maybeSingle()
      .then(({ data, error }) => live && setState({ event: data || null, status: error ? 'error' : data ? 'ok' : 'missing' }))
      .catch(() => live && setState({ event: null, status: 'error' }));
    return () => {
      live = false;
    };
  }, [id, state.event, attempt]);
  const retry = () => {
    setState({ event: null, status: 'ok' });
    setAttempt((n) => n + 1);
  };
  return { ...state, retry };
}

// Where the collector found this event and when it last saw it there (event_sources.last_seen_at is
// written every run). Offline or failed: null, and the screen falls back to the link's domain.
function useSources(id) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    supabase.from('event_sources').select('source,last_seen_at').eq('event_id', id)
      .then(({ data }) => live && data?.length && setRows(data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return rows;
}

function HeaderIcon({ icon, label, onPress, color }) {
  return <IconButton icon={icon} label={label} onPress={onPress} color={color} />;
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
  const saved = useSaved();
  const { event, status, retry } = useEvent(id, saved.entries[id]?.event);
  const sources = useSources(id);
  const { prefs } = usePrefs();
  const toggleSave = useSaveToggle();
  const toast = useToast();
  useToastLift(36); // above the Apply bar
  const askLater = useRef(null); // "Did you register?" waits for the return from the browser or app
  useEffect(() => () => askLater.current?.remove(), []);
  const [needsApp, setNeedsApp] = useState(null); // the platform app, when it isn't on this phone
  const [reporting, setReporting] = useState(false);
  const [prompt, setPrompt] = useState(null); // { where, minutes } while "Did you register?" is up

  if (!event) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: '' }} />
        {status === 'ok' ? <ActivityIndicator color={colors.brand} /> : null}
        {status === 'missing' ? (
          <Text style={[type.body, styles.centerText, { color: colors.textPrimary }]}>That event is no longer listed.</Text>
        ) : null}
        {status === 'error' ? (
          <>
            <MaterialCommunityIcons name="wifi-off" size={32} color={colors.textSecondary} />
            <Text style={[type.body, styles.centerText, { color: colors.textPrimary }]}>
              Can't load this event. Check your connection.
            </Text>
            <Button label="Retry" variant="secondary" onPress={retry} />
          </>
        ) : null}
      </View>
    );
  }

  const cd = countdown(event);
  const closed = cd.tone === 'muted';
  const toneColor = cd.tone === 'neutral' ? colors.textSecondary : colors[cd.tone];
  const linkOk = safeUrl(event.registration_url);
  const host = hostOf(event.registration_url);
  const inPerson = event.mode === 'offline' || event.mode === 'hybrid';
  const me = prefs?.lat != null ? { lat: prefs.lat, lng: prefs.lng } : null;
  const km = inPerson ? distanceKm(event, me) : null;
  const far = km != null ? whereShort({ ...event, mode: 'offline' }, km) : null; // "45 km", "about 20 km (approx.)"
  const team = teamSize(event.team_min, event.team_max);
  const themes = (event.themes || []).filter((t) => t !== 'other');
  // Unstop only, from its detail API. "No" is never invented: Unstop's 0 means the certificate
  // feature wasn't enabled, not that the organizer gives none. Confirmed = Yes, else Not listed.
  const perks = event.perks || [];
  const goodies = perks.length ? (perks.includes('goodies') ? 'Yes' : 'Not listed') : null;
  const certificate = perks.length ? (perks.includes('certificate') ? 'Yes' : 'Not listed') : null;
  const summary = [
    feeLong(event.fee_amount, event.is_paid),
    MODE_NAMES[event.mode],
    far,
    team,
    themes.map((t) => THEME_NAMES[t]).slice(0, 2).join(', ') || null,
  ].filter(Boolean).join(' · ');

  const myStatus = saved.statusOf(event.id); // 'interested' | 'registered' | null
  const setMyStatus = (next) => {
    saved.setStatus(event.id, next);
    if (next === 'registered') success();
    toast(next === 'registered' ? 'Moved to Registered.' : 'Moved to Interested.');
  };

  // App Flow: back from the registration page (browser or app) after a real stay, ask with a popup
  const ask = (awayMs, where) => {
    if (awayMs < AWAY_TO_ASK || saved.statusOf(event.id) === 'registered') return;
    setPrompt({ where, minutes: Math.floor(awayMs / 60000) });
  };
  const markRegistered = () => {
    success();
    if (saved.isSaved(event.id)) saved.setStatus(event.id, 'registered');
    else saved.save(event, 'registered');
    setPrompt(null);
    toast('Moved to Registered.');
  };
  // Android hands the page to another task and returns at once, so time the stay with the app's own state:
  // it goes to the background (recent apps) while the page is open, and comes back when the user does
  const askWhenBack = (where) => {
    askLater.current?.remove();
    let leftAt = AppState.currentState !== 'active' ? Date.now() : null;
    askLater.current = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        leftAt = leftAt ?? Date.now();
        return;
      }
      if (leftAt == null) return;
      askLater.current?.remove();
      askLater.current = null;
      ask(Date.now() - leftAt, where);
    });
  };
  const openWebsite = async () => {
    const started = Date.now();
    const res = await WebBrowser.openBrowserAsync(event.registration_url, { toolbarColor: colors.surface, controlsColor: colors.brand });
    if (res.type !== 'opened') ask(Date.now() - started, host); // iOS: resolves when the browser closes
    else askWhenBack(host);
  };
  // Unstop events open in the Unstop app when it's installed (straight to this event's page);
  // without the app: get it from the Play Store, or register on the website
  const app = appFor(event.registration_url);
  const apply = async () => {
    if (!app) return openWebsite();
    const started = Date.now();
    const result = await openInApp(event.registration_url, app);
    if (result === 'missing') return setNeedsApp(app);
    const where = `the ${app.name} app`;
    if (Date.now() - started > 3000) ask(Date.now() - started, where); // the call waited until the user came back
    else askWhenBack(where);
  };
  const isSaved = !!myStatus;
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

  // venue text often ends with the city already ("..., Sonipat, Haryana 131028")
  const addr = event.venue_address;
  const place = addr && event.city && addr.toLowerCase().includes(event.city.toLowerCase())
    ? addr
    : [addr, event.city].filter(Boolean).join(', ');
  const venue = inPerson
    ? [
      (place || 'Venue not listed') + (place && event.location_approximate ? ' (approx. location)' : ''),
      far ? `${far} from you` : null,
    ].filter(Boolean).join('\n')
    : 'Online';

  const checked = sources ? sources.map((s) => s.last_seen_at).filter(Boolean).sort().pop() : null;
  const listedOn = sources
    ? joinAnd([...new Set(sources.map((s) => PLATFORM_NAMES[s.source] || s.source))])
    : host || 'the organizer site';

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
              {inPerson ? <HeaderIcon icon="map-marker-outline" label="Open in Maps" onPress={openMaps} color={colors.textPrimary} /> : null}
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

        {/* status of a saved event, changeable here (the Saved tab's long press is easy to miss) */}
        {myStatus ? (
          <View style={[styles.status, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name={myStatus === 'registered' ? 'check-circle-outline' : 'bookmark-outline'} size={20} color={colors.brand} />
            <Text style={[type.body, styles.statusText, { color: colors.textPrimary }]}>
              {myStatus === 'registered' ? 'You registered' : 'Saved in Interested'}
            </Text>
            <Button
              label={myStatus === 'registered' ? 'Move to Interested' : 'I registered'}
              variant="text"
              onPress={() => setMyStatus(myStatus === 'registered' ? 'interested' : 'registered')}
            />
          </View>
        ) : null}

        {event.warnings?.length ? (
          <View style={[styles.warning, { borderColor: colors.urgent, backgroundColor: colors.urgentSoft }]} accessibilityRole="alert">
            <View style={styles.warningHead}>
              <MaterialCommunityIcons name="alert-outline" size={20} color={colors.urgent} />
              <Text style={[type.label, { color: colors.urgent }]}>Check before you register</Text>
            </View>
            {event.warnings.map((w, i) => (
              <Text key={`${w.code}-${i}`} style={[type.body, { color: colors.textPrimary }]}>{w.text}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.details}>
          <Row label="Registration closes" value={event.registration_deadline ? dateTime(event.registration_deadline) : 'Deadline not listed'} colors={colors} />
          <Row
            label="Event dates"
            value={
              event.start_date
                ? dateRange(event.start_date, event.end_date)
                : event.end_date ? `Start date not listed, ends ${dateRange(null, event.end_date)}` : 'Not listed'
            }
            colors={colors}
          />
          <Row
            label="Rounds"
            value={(event.rounds || []).map((r) => `${r.title} · ${dateRange(r.start, r.end)}`).join('\n') || null}
            colors={colors}
          />
          <Row label="Venue" value={venue} colors={colors} />
          <Row label="Prizes" value={prizeLong(event)} colors={colors} />
          <Row label="Goodies" value={goodies} colors={colors} />
          <Row label="Certificate" value={certificate} colors={colors} />
          <Row label="Team" value={team || (event.solo_allowed ? 'Solo allowed' : null)} colors={colors} />
          <Row label="Fee" value={feeLong(event.fee_amount, event.is_paid)} colors={colors} />
          <Row label="Who can join" value={event.eligibility_text === 'All' ? 'Anyone' : event.eligibility_text} colors={colors} />
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
          Listed on {listedOn}{checked ? ` · Checked ${ago(checked)}` : ''}
        </Text>
        <Pressable
          onPress={() => setReporting(true)}
          android_ripple={{ color: colors.border }}
          style={styles.report}
          accessibilityRole="button"
          accessibilityLabel="Report wrong info"
        >
          <MaterialCommunityIcons name="flag-outline" size={18} color={colors.textSecondary} />
          <Text style={[type.label, { color: colors.textSecondary }]}>Report wrong info</Text>
        </Pressable>
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
            {app ? `Opens the ${app.name} app or ${host}` : `Opens ${host}`}
          </Text>
        ) : null}
        <View style={styles.barRow}>
          <PressableScale
            onPress={() => toggleSave(event)}
            style={[styles.saveBtn, { borderColor: colors.brand }]}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved' : 'Save'}
            accessibilityState={{ selected: isSaved }}
          >
            <MaterialCommunityIcons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={colors.brand} />
          </PressableScale>
          <Button label={applyLabel} onPress={apply} disabled={closed || !linkOk} style={styles.applyBtn} />
        </View>
      </View>

      <RegisterPrompt
        visible={!!prompt}
        title={event.title}
        where={prompt?.where || host}
        minutes={prompt?.minutes ?? 0}
        onRegistered={markRegistered}
        onClose={() => setPrompt(null)}
      />
      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        eventId={event.id}
        onSent={(message) => {
          setReporting(false);
          toast(message);
        }}
      />
      <Sheet visible={!!needsApp} onClose={() => setNeedsApp(null)} title={`Register with the ${app?.name || ''} app`}>
        <Text style={[type.body, { color: colors.textPrimary }]}>
          The {app?.name} app isn't on this phone. Get it from the Play Store to register in the app, or
          register on the website instead.
        </Text>
        <View style={styles.appChoices}>
          <Button
            label={`Get the ${app?.name || ''} app`}
            onPress={() => {
              const target = needsApp;
              setNeedsApp(null);
              openStore(target);
            }}
          />
          <Button
            label="Continue on the website"
            variant="secondary"
            onPress={() => {
              setNeedsApp(null);
              openWebsite();
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md },
  centerText: { textAlign: 'center' },
  content: { padding: layout.screenPadding, gap: space.md },
  headerActions: { flexDirection: 'row' },
  headerIcon: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  organizer: { marginTop: -space.sm },
  summary: { borderRadius: radius.button, padding: space.md },
  status: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.button,
    paddingLeft: space.md, minHeight: layout.minTouch,
  },
  statusText: { flex: 1 },
  warning: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: space.xs },
  warningHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  details: { marginTop: space.xs },
  row: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  source: { marginTop: space.sm },
  report: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: layout.minTouch, marginTop: space.xs },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: space.sm, paddingHorizontal: layout.screenPadding, borderTopWidth: StyleSheet.hairlineWidth,
  },
  opens: { textAlign: 'center', marginBottom: space.xs },
  barRow: { flexDirection: 'row', gap: space.sm },
  saveBtn: { width: 56, minHeight: layout.minTouch, borderWidth: 1.5, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  applyBtn: { flex: 1 },
  appChoices: { gap: space.sm },
});
