import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOutLeft, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import CodeInput from '../components/CodeInput';
import IconButton from '../components/IconButton';
import PressableScale from '../components/PressableScale';
import RadarPing from '../components/RadarPing';
import {
  CODE_LENGTH, explain, getProviders, isEmail, RESEND_AFTER,
  detailOf, savedPrefsOf, sendCode, signInWithProvider, verifyCode, waitSeconds,
} from '../lib/account';
import { select, success, tap, warn } from '../lib/haptics';
import { usePrefs } from '../lib/prefs';
import { useSession } from '../lib/session';
import { CHROME_MAX_SCALE, layout, motion, radius, space, type, useAppTheme } from '../theme';

// the plain message, and the server's own words small under it (so a failure can be traced)
function ErrorText({ error, detail, colors, center }) {
  if (!error) return null;
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <Text style={[type.body, center && styles.center, { color: colors.urgent }]}>{error}</Text>
      {detail ? <Text style={[type.meta, center && styles.center, { color: colors.textSecondary }]}>Details: {detail}</Text> : null}
    </View>
  );
}

const enter = FadeInRight.duration(motion.max);
const leave = FadeOutLeft.duration(motion.fast);

// One way in, drawn like the rest of the app: outline icon, label, and "Soon" when the server hasn't
// switched that method on yet (they appear by themselves once it is: lib/account.getProviders)
function Method({ icon, label, onPress, dark, ready, busy, colors, delay }) {
  const bg = dark ? colors.textPrimary : colors.surface;
  const fg = dark ? colors.surface : colors.textPrimary;
  return (
    <Animated.View entering={FadeInDown.duration(motion.max).delay(delay)}>
      <PressableScale
        onPress={onPress}
        disabled={busy}
        style={[styles.method, { backgroundColor: bg, borderColor: dark ? bg : colors.border }, !ready && styles.methodSoon]}
        accessibilityRole="button"
        accessibilityLabel={ready ? label : `${label}, coming soon`}
      >
        {busy ? <ActivityIndicator color={fg} /> : <MaterialCommunityIcons name={icon} size={22} color={fg} />}
        <Text style={[type.label, styles.methodLabel, { color: fg }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>{label}</Text>
        {ready ? <View style={styles.methodEnd} /> : (
          <View style={[styles.soon, { backgroundColor: dark ? colors.textSecondary : colors.surfaceSoft }]}>
            <Text style={[type.meta, { color: fg }]}>Soon</Text>
          </View>
        )}
      </PressableScale>
    </Animated.View>
  );
}

// Sign in or create an account: no passwords. Google, GitHub or a code by email.
export default function AccountScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { onboarded, save } = usePrefs();
  const { mustSignIn } = useSession(); // logged out of an account: signing in is the only way back in
  const [step, setStep] = useState('choose'); // choose | email | code | done
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeState, setCodeState] = useState('idle'); // idle | error | done
  const [mode, setMode] = useState(null); // 'link' | 'signin' (lib/account.sendCode)
  const [busy, setBusy] = useState(null); // what is working: 'google' | 'github' | 'send' | 'verify'
  const [error, setErrorText] = useState(null);
  const [detail, setDetail] = useState(null);
  const setError = (text, raw = null) => {
    setErrorText(text);
    setDetail(text ? detailOf(raw) : null);
  };
  const working = useRef(false); // one sign-in at a time, however fast the taps
  const [note, setNote] = useState(null);
  const [wait, setWait] = useState(0);
  const [providers, setProviders] = useState({ email: true });
  const [who, setWho] = useState(null);
  const codeRef = useRef(null);

  useEffect(() => {
    getProviders().then((p) => setProviders({ email: true, ...p }));
  }, []);
  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const go = (next) => {
    setError(null);
    setNote(null);
    setStep(next);
  };
  // Android back walks the steps before it leaves the screen
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'choose' || step === 'done') return false;
      go(step === 'code' ? 'email' : 'choose');
      return true;
    });
    return () => sub.remove();
  }, [step]));

  // signed in: a quick tick, then where this person needs to be
  const finish = async (user) => {
    success();
    setWho(user?.email || null);
    setStep('done');
    let restored = false;
    if (!onboarded) {
      const prefs = await savedPrefsOf(user).catch(() => null); // a new phone: bring the account's setup
      if (prefs) {
        save(prefs);
        restored = true;
      }
    }
    setTimeout(() => {
      if (restored) router.replace('/');
      else if (!onboarded) router.replace('/interests'); // signed in, now set up the feed
      else if (router.canGoBack()) router.back();
      else router.replace('/'); // came from the lock after log out: nothing behind this screen
    }, 1100);
  };

  const oauth = async (provider, name) => {
    if (working.current) return;
    if (!providers[provider]) {
      warn();
      setNote(`${name} sign-in is almost ready. Use email for now.`);
      return;
    }
    working.current = true;
    setBusy(provider);
    setError(null);
    try {
      const user = await signInWithProvider(provider);
      if (user) await finish(user);
    } catch (e) {
      warn();
      setError(explain(e, name), e);
    } finally {
      working.current = false;
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy('send');
    setError(null);
    try {
      setMode(await sendCode(email));
      setCode('');
      setCodeState('idle');
      setWait(RESEND_AFTER);
      go('code');
    } catch (e) {
      warn();
      const secs = waitSeconds(e);
      if (secs) setWait(secs);
      setError(secs ? `Wait ${secs} seconds, then ask for a new code.` : explain(e, 'Email'), e);
    } finally {
      setBusy(null);
    }
  };

  const verify = async (value = code) => {
    if (value.length < CODE_LENGTH || busy) return;
    setBusy('verify');
    setError(null);
    try {
      const user = await verifyCode(email, value, mode);
      setCodeState('done');
      await finish(user);
    } catch (e) {
      warn();
      setCodeState('error');
      codeRef.current?.shake();
      setError(explain(e), e);
    } finally {
      setBusy(null);
    }
  };

  const field = [type.body, styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }];
  const sentTo = email.trim();

  let body;
  if (step === 'choose') {
    body = (
      <Animated.View key="choose" entering={FadeIn.duration(motion.max)} exiting={leave} style={styles.step}>
        <View style={styles.hero}>
          <RadarPing />
        </View>
        <Text style={[type.screenTitle, styles.title, { color: colors.textPrimary }]} accessibilityRole="header">
          Sign in to HackRadar
        </Text>
        <Text style={[type.body, styles.center, { color: colors.textSecondary }]}>
          {mustSignIn
            ? 'You logged out. Sign in to keep using HackRadar; your saved hackathons come back with your account.'
            : 'Keep your saved hackathons and preferences on any phone. New here? The same steps create your account.'}
        </Text>
        <View style={styles.methods}>
          <Method icon="google" label="Continue with Google" onPress={() => oauth('google', 'Google')} ready={!!providers.google} busy={busy === 'google'} colors={colors} delay={60} />
          <Method icon="github" label="Continue with GitHub" onPress={() => oauth('github', 'GitHub')} ready={!!providers.github} busy={busy === 'github'} colors={colors} delay={110} dark />
          <Method icon="email-outline" label="Continue with email" onPress={() => { tap(); go('email'); }} ready colors={colors} delay={160} />
        </View>
        {note ? <Animated.Text entering={FadeIn} style={[type.body, styles.center, { color: colors.soon }]}>{note}</Animated.Text> : null}
        <ErrorText error={error} detail={detail} colors={colors} center />
        <Text style={[type.meta, styles.center, { color: colors.textSecondary }]}>
          No password needed. We use your email only to sign you in.
        </Text>
      </Animated.View>
    );
  } else if (step === 'email') {
    body = (
      <Animated.View key="email" entering={enter} exiting={leave} style={styles.step}>
        <Text style={[type.screenTitle, { color: colors.textPrimary }]} accessibilityRole="header">What's your email?</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>We'll send a 6-digit code to it.</Text>
        <TextInput
          value={email}
          onChangeText={(t) => { setEmail(t); setError(null); }}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={() => isEmail(email) && !busy && send()}
          placeholder="you@college.edu"
          placeholderTextColor={colors.textSecondary}
          style={field}
          accessibilityLabel="Email"
        />
        <ErrorText error={error} detail={detail} colors={colors} />
        <Button label={busy === 'send' ? 'Sending…' : 'Send code'} onPress={() => send()} disabled={!!busy || !isEmail(email)} />
      </Animated.View>
    );
  } else if (step === 'code') {
    body = (
      <Animated.View key="code" entering={enter} exiting={leave} style={styles.step}>
        <Text style={[type.screenTitle, { color: colors.textPrimary }]} accessibilityRole="header">Enter the code</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          Sent to <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{sentTo}</Text>
          . It can take a minute; check spam too.
        </Text>
        <CodeInput
          ref={codeRef}
          value={code}
          onChange={(v) => { setCode(v); if (codeState !== 'idle') setCodeState('idle'); setError(null); }}
          onComplete={verify}
          length={CODE_LENGTH}
          state={codeState}
        />
        <ErrorText error={error} detail={detail} colors={colors} />
        <Button label={busy === 'verify' ? 'Checking…' : 'Verify'} onPress={() => verify()} disabled={!!busy || code.length < CODE_LENGTH} />
        <View style={styles.links}>
          <Button label="Change email" variant="text" onPress={() => go('email')} />
          <Button
            label={wait ? `Resend in 0:${String(wait).padStart(2, '0')}` : 'Resend code'}
            variant="text"
            onPress={() => send()}
            disabled={!!wait || !!busy}
          />
        </View>
      </Animated.View>
    );
  } else {
    body = (
      <View key="done" style={[styles.step, styles.done]}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.tick, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="check" size={44} color={colors.onBrand} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.duration(motion.max).delay(120)} style={[type.screenTitle, styles.center, { color: colors.textPrimary }]}>
          You're signed in
        </Animated.Text>
        {who ? (
          <Animated.Text entering={FadeInDown.duration(motion.max).delay(180)} style={[type.body, styles.center, { color: colors.textSecondary }]}>
            {who}
          </Animated.Text>
        ) : null}
      </View>
    );
  }

  const canStepBack = step === 'email' || step === 'code';
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {step !== 'done' && !(mustSignIn && !canStepBack) ? ( // locked: no way out but signing in
          <IconButton
            icon={canStepBack ? 'arrow-left' : 'close'}
            label={canStepBack ? 'Back' : 'Close'}
            onPress={() => {
              select();
              if (canStepBack) go(step === 'code' ? 'email' : 'choose');
              else router.back();
            }}
          />
        ) : null}
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { height: layout.minTouch + space.xs, justifyContent: 'center', paddingHorizontal: space.xs },
  barBtn: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: layout.screenPadding + space.xs, paddingTop: space.sm, flexGrow: 1 },
  step: { gap: space.md },
  hero: { alignItems: 'center', marginBottom: space.sm },
  title: { textAlign: 'center', fontSize: 26, lineHeight: 32 },
  center: { textAlign: 'center' },
  methods: { gap: space.sm, marginTop: space.md, marginBottom: space.sm },
  method: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52,
    borderRadius: radius.button, borderWidth: 1, paddingHorizontal: space.lg,
  },
  methodSoon: { opacity: 0.55 },
  methodLabel: { flex: 1, textAlign: 'center' },
  methodEnd: { width: 22 },
  soon: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  input: { borderWidth: 1, borderRadius: radius.button, minHeight: 52, paddingHorizontal: space.md },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  errorBox: { gap: 2 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingBottom: 80 },
  tick: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
