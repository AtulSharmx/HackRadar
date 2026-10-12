import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import Button from '../../components/Button';
import Chip from '../../components/Chip';
import CitySearch from '../../components/CitySearch';
import Segmented from '../../components/Segmented';
import SwitchRow from '../../components/SwitchRow';
import { useToast } from '../../components/Toast';
import { deleteAccount, explain, logOut, PRIVACY_URL } from '../../lib/account';
import { versionLine } from '../../lib/appUpdates';
import { select, success } from '../../lib/haptics';
import { DEGREES, THEMES } from '../../lib/labels';
import { turnOnNotifications } from '../../lib/notificationPermission';
import { usePrefs } from '../../lib/prefs';
import { registerPush, usePushStatus } from '../../lib/push';
import { useSaved } from '../../lib/saved';
import { useSession } from '../../lib/session';
import { CHROME_MAX_SCALE, layout, motion, radius, space, type, useAppTheme } from '../../theme';

// Same choices as onboarding, shown in place: nothing opens from the bottom any more (user's ask, 30 Sep)
const MODES = [['online', 'Online'], ['offline', 'Offline'], ['both', 'Both']];
const MODE_LISTS = { online: ['online'], offline: ['offline', 'hybrid'], both: ['online', 'offline', 'hybrid'] };
const FEES = [['free', 'Free only'], ['any', 'Free and paid']];
const DISTANCES = [[10, '10'], [25, '25'], [50, '50'], [100, '100'], [null, 'Any']];
const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

function Section({ title, children, colors }) {
  return (
    <View style={styles.section}>
      <Text style={[type.meta, styles.sectionTitle, { color: colors.textSecondary }]} accessibilityRole="header">
        {title}
      </Text>
      <Animated.View layout={LinearTransition.duration(motion.base)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </Animated.View>
    </View>
  );
}

// A setting with its control right under the label
function Item({ label, hint, children, colors, last }) {
  return (
    <View style={[styles.item, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={styles.itemHead}>
        <Text style={[type.label, { color: colors.textPrimary }]}>{label}</Text>
        {hint ? <Text style={[type.meta, { color: colors.textSecondary }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// Under "New hackathon alerts": says so when this phone can't receive them, with the one fix that helps
function AlertsNote({ colors, onAllow, onRetry }) {
  const s = usePushStatus();
  if (s.state !== 'blocked' && s.state !== 'error') return null;
  const blocked = s.state === 'blocked';
  return (
    <Animated.View entering={FadeIn.duration(motion.base)} style={styles.alertsNote} accessibilityLiveRegion="polite">
      <Text style={[type.meta, { color: colors.urgent }]}>
        {blocked ? "Notifications aren't allowed for HackRadar on this phone, so alerts can't arrive." : s.message}
      </Text>
      <Button label={blocked ? 'Allow notifications' : 'Try again'} variant="text" onPress={blocked ? onAllow : onRetry} style={styles.alertsAction} />
    </Animated.View>
  );
}

// One row in MORE: icon, label, chevron (none for the destructive one, which is red and last)
function LinkRow({ icon, label, onPress, danger = false, last = false, colors }) {
  const tint = danger ? colors.urgent : colors.brand;
  return (
    <Pressable
      onPress={() => {
        select();
        onPress();
      }}
      android_ripple={{ color: colors.border }}
      style={[styles.linkRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={icon} size={22} color={tint} />
      <Text style={[type.body, styles.linkText, { color: danger ? colors.urgent : colors.textPrimary }]}>{label}</Text>
      {danger ? null : <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />}
    </Pressable>
  );
}

function AccountCard({ colors, onLogOut, leaving }) {
  const { user, error, retry, isGuest, email, phone, name, avatar } = useSession();
  const handle = email || phone; // how they sign in
  if (!user) {
    return (
      <View style={[styles.account, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[type.body, { color: colors.textPrimary }]}>{error ? "Can't reach HackRadar. Check your connection." : 'Connecting…'}</Text>
        {error ? <Button label="Retry" variant="secondary" onPress={retry} /> : null}
      </View>
    );
  }
  return (
    <View style={[styles.account, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.accountHead}>
        <View style={[styles.avatar, { backgroundColor: colors.brandSoft }]}>
          {isGuest ? (
            <MaterialCommunityIcons name="account-outline" size={26} color={colors.brand} />
          ) : (
            avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} accessibilityIgnoresInvertColors />
            ) : (
              <Text style={[type.cardTitle, { color: colors.brand }]}>{(name || handle || '?')[0].toUpperCase()}</Text>
            )
          )}
        </View>
        <View style={styles.accountText}>
          <Text style={[type.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{isGuest ? 'Guest' : name || handle}</Text>
          <Text style={[type.meta, { color: colors.textSecondary }]}>
            {isGuest ? 'Sign in to keep your saved hackathons on any phone.' : `${name && handle ? `${handle} · ` : ''}Your saves and preferences sync to this account.`}
          </Text>
        </View>
      </View>
      {isGuest ? (
        <Button label="Sign in or create account" onPress={() => router.push('/account')} />
      ) : (
        <Button label={leaving ? 'Logging out…' : 'Log out'} variant="secondary" onPress={onLogOut} disabled={leaving} />
      )}
    </View>
  );
}

// App Flow "Settings flows": one scrolling list; every change saves at once (phone first, then the devices row).
export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const { prefs, save, update: patchPrefs, clear: clearPrefs } = usePrefs();
  const { user } = useSession();
  const saved = useSaved();
  const toast = useToast();
  const [cityOpen, setCityOpen] = useState(false);
  const [lastThemeNote, setLastThemeNote] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!prefs) return null; // onboarding not finished: this tab isn't reachable then
  const update = (patch) => save({ ...prefs, ...patch });

  const themes = prefs.themes || [];
  const toggleTheme = (k) => {
    if (themes.includes(k) && themes.length === 1) return setLastThemeNote(true); // at least one, as in onboarding
    setLastThemeNote(false);
    update({ themes: themes.includes(k) ? themes.filter((t) => t !== k) : [...themes, k] });
  };
  const modeKey = Object.keys(MODE_LISTS).find((k) => same(prefs.modes || [], MODE_LISTS[k])) || 'both';
  const pickDegree = (key) => update({ degree: prefs.degree === key ? null : key });

  const setNotifications = (on) => (on ? turnOnNotifications(patchPrefs, toast) : update({ notifications: false }));
  const setMatchAlerts = (on) => (on ? turnOnNotifications(patchPrefs, toast, 'match_alerts') : update({ match_alerts: false }));

  // Play Store requirement: delete the account and everything tied to it, from the app itself
  const confirmDelete = () => Alert.alert(
    'Delete your account?',
    'This deletes your account, preferences, saved hackathons and alerts, and cancels reminders on this phone. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteAccount();
            saved.clearLocal();
            clearPrefs(); // back to onboarding; reminders are cancelled as Saved and alerts empty out
            success();
            toast('Your account and data are deleted.');
          } catch (e) {
            setDeleting(false);
            toast(explain(e));
          }
        },
      },
    ],
  );

  const confirmLogOut = () => Alert.alert(
    'Log out?',
    'Your saved hackathons stay in your account. To use HackRadar on this phone again, you will sign in.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          try {
            await saved.flush(); // unsent changes go to the account first
            saved.clearLocal();
            await logOut();
            success();
            toast('Logged out.'); // the app now shows only sign-in until they sign in again (session.mustSignIn)
          } catch (e) {
            toast(explain(e));
          } finally {
            setLeaving(false);
          }
        },
      },
    ],
  );

  const chip = (selected, label, onPress, role = 'radio') => (
    <Chip key={label} label={label} selected={selected} showRemove={false} role={role} onPress={onPress} />
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AccountCard colors={colors} onLogOut={confirmLogOut} leaving={leaving} />

        <Section title="YOUR FEED" colors={colors}>
          <Item
            label="Interests"
            hint={lastThemeNote ? 'Keep at least one. Pick another before removing this one.' : 'These come first in your Feed and decide your alerts.'}
            colors={colors}
          >
            <View style={styles.chips}>
              {THEMES.map(([k, label]) => chip(themes.includes(k), label, () => toggleTheme(k), 'checkbox'))}
            </View>
          </Item>
          <Item label="How you want to join" hint={prefs.lat == null ? 'Set your city so nearby offline events rank higher.' : 'Used for your alerts.'} colors={colors}>
            <Segmented options={MODES} value={modeKey} onChange={(k) => update({ modes: MODE_LISTS[k] })} accessibilityLabel="How you want to join" />
          </Item>
          <Item label="Fee" colors={colors} last>
            <Segmented options={FEES} value={prefs.fee_max === 0 ? 'free' : 'any'} onChange={(k) => update({ fee_max: k === 'free' ? 0 : null })} accessibilityLabel="Fee" />
          </Item>
        </Section>

        <Section title="LOCATION" colors={colors}>
          <Pressable
            onPress={() => {
              select();
              setCityOpen(true);
            }}
            android_ripple={{ color: colors.border }}
            style={[styles.cityRow, { borderBottomColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={prefs.city ? `City, ${prefs.city}. Change` : 'Set your city'}
          >
            <MaterialCommunityIcons name={prefs.city ? 'map-marker' : 'map-marker-plus-outline'} size={22} color={colors.brand} />
            <View style={styles.cityText}>
              <Text style={[type.body, { color: colors.textPrimary }]} numberOfLines={1}>{prefs.city || 'Set your city'}</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                {prefs.city ? prefs.state || 'India' : 'To see how far offline hackathons are'}
              </Text>
            </View>
            <Text style={[type.label, { color: colors.brand }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>{prefs.city ? 'Change' : 'Set'}</Text>
          </Pressable>
          <Item label="How far you can travel (km)" hint={prefs.lat == null ? 'Applies once your city is set.' : 'Closer events rank higher; alerts stay within this.'} colors={colors} last>
            <Segmented options={DISTANCES} value={prefs.max_km ?? null} onChange={(km) => update({ max_km: km })} accessibilityLabel="How far you can travel" />
          </Item>
        </Section>

        <Section title="YOUR STUDIES" colors={colors}>
          <Item label="Degree" hint="Hackathons not open to your degree (like school-only ones) stay hidden." colors={colors} last>
            <View style={styles.chips}>{DEGREES.map((d) => chip(prefs.degree === d.key, d.label, () => pickDegree(d.key)))}</View>
          </Item>
        </Section>

        <Section title="NOTIFICATIONS AND FEED" colors={colors}>
          <View style={styles.switches}>
            <SwitchRow
              label="New hackathon alerts"
              hint="Ones that match your interests. At most twice a day, never 11 pm to 8 am"
              value={!!(prefs.match_alerts ?? prefs.notifications)}
              onChange={setMatchAlerts}
            />
            {prefs.match_alerts ?? prefs.notifications ? (
              <AlertsNote
                colors={colors}
                onAllow={() => turnOnNotifications(patchPrefs, toast, 'match_alerts').then((ok) => ok && user && registerPush(user.id))}
                onRetry={() => user && registerPush(user.id)}
              />
            ) : null}
            <SwitchRow label="Deadline reminders" hint="7 days, 48 h and 24 h before a saved deadline" value={!!prefs.notifications} onChange={setNotifications} />
            <SwitchRow
              label="Hide events with warnings"
              hint="Flagged for a high fee with no prize, no organizer or odd dates"
              value={!!prefs.hide_warnings}
              onChange={(v) => update({ hide_warnings: v })}
            />
          </View>
        </Section>

        <Section title="MORE" colors={colors}>
          <LinkRow icon="plus-circle-outline" label="Submit a hackathon" onPress={() => router.push('/submit')} colors={colors} />
          <LinkRow icon="information-outline" label="About HackRadar" onPress={() => router.push('/about')} colors={colors} />
          <LinkRow
            icon="shield-lock-outline"
            label="Privacy policy"
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL, { toolbarColor: colors.surface, controlsColor: colors.brand }).catch(() => {})}
            colors={colors}
          />
          <LinkRow icon="delete-outline" label={deleting ? 'Deleting…' : 'Delete my account'} onPress={confirmDelete} danger last colors={colors} />
        </Section>
        {/* which version this phone runs: shows when an update has arrived */}
        <Text style={[type.meta, styles.version, { color: colors.textSecondary }]}>{versionLine()}</Text>
      </ScrollView>

      <CitySearch
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        onPick={(p) => {
          update(p);
          setCityOpen(false);
          toast(p.city ? `Location set to ${p.city}.` : 'Location set.');
        }}
        onRemove={prefs.city ? () => {
          update({ city: null, state: null, lat: null, lng: null });
          setCityOpen(false);
          toast('Location removed. The Feed shows online events.');
        } : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: layout.screenPadding, paddingBottom: space.xxl, gap: space.xl },
  section: { gap: space.sm },
  sectionTitle: { letterSpacing: 0.5, paddingHorizontal: space.xs },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: layout.cardPadding, overflow: 'hidden' },
  item: { paddingVertical: space.lg, gap: space.md },
  itemHead: { gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cityRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cityText: { flex: 1 },
  switches: { paddingVertical: space.sm },
  alertsNote: { paddingBottom: space.sm, gap: space.xs },
  version: { textAlign: 'center' },
  alertsAction: { alignSelf: 'flex-start' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  linkText: { flex: 1 },
  account: {
    borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: layout.cardPadding, gap: space.lg,
  },
  accountHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 48, height: 48 },
  accountText: { flex: 1, gap: 2 },
});
