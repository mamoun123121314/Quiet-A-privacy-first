import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  FOCUS_MODES,
  MOODS,
  ROUTINE_STEPS,
  calculateStreak,
  emptyState,
  getInsight,
  lastSevenDays,
  localDateKey,
  makeEntry,
  normalizeState,
  summarize,
} from './src/quietData.cjs';

const STORAGE_KEY = 'quiet-state-v4';
const LEGACY_KEYS = ['quiet-state-v3', 'quiet-state-v2', 'quiet-daily-state'];
const NAV_ITEMS = [
  { key: 'today', label: 'Today', icon: '◒' },
  { key: 'insights', label: 'Trends', icon: '⌁' },
  { key: 'reset', label: 'Reset', icon: '○' },
  { key: 'journal', label: 'Notes', icon: '✎' },
  { key: 'privacy', label: 'Privacy', icon: '◇' },
];
const BREATH_PHASES = [
  { name: 'Breathe in', seconds: 4, scale: 1.24 },
  { name: 'Hold gently', seconds: 2, scale: 1.24 },
  { name: 'Breathe out', seconds: 6, scale: 0.9 },
  { name: 'Rest', seconds: 2, scale: 0.96 },
];

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatLongDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export default function App() {
  const [data, setData] = useState(() => emptyState());
  const [screen, setScreen] = useState('today');
  const [todayKey, setTodayKey] = useState(localDateKey());
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [breathRunning, setBreathRunning] = useState(false);
  const [breathPhase, setBreathPhase] = useState(0);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusRemaining, setFocusRemaining] = useState(0);
  const [focusComplete, setFocusComplete] = useState(false);
  const breathTimer = useRef(null);
  const focusTimer = useRef(null);
  const activeEntry = data.entries[todayKey] || makeEntry(todayKey, data.entries[todayKey] || {});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        let raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          for (const key of LEGACY_KEYS) {
            raw = await AsyncStorage.getItem(key);
            if (raw) break;
          }
        }
        const parsed = raw ? normalizeState(JSON.parse(raw)) : emptyState();
        if (!mounted) return;
        setData(parsed);
        setShowOnboarding(!parsed.onboardingSeen);
      } catch (error) {
        if (mounted) {
          setData(emptyState());
          setShowOnboarding(true);
        }
        console.warn('Quiet could not load local data:', error);
      } finally {
        if (mounted) setReady(true);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((error) => {
      console.warn('Quiet could not save local data:', error);
    });
  }, [data, ready]);

  useEffect(() => {
    const refreshDate = () => setTodayKey(localDateKey());
    const timer = setInterval(refreshDate, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!breathRunning) return undefined;
    breathTimer.current = setTimeout(() => {
      setBreathPhase((current) => (current + 1) % BREATH_PHASES.length);
    }, BREATH_PHASES[breathPhase].seconds * 1000);
    return () => clearTimeout(breathTimer.current);
  }, [breathRunning, breathPhase]);

  useEffect(() => {
    if (!focusRunning) return undefined;
    focusTimer.current = setInterval(() => {
      setFocusRemaining((seconds) => {
        if (seconds <= 1) {
          clearInterval(focusTimer.current);
          setFocusRunning(false);
          setFocusComplete(true);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(focusTimer.current);
  }, [focusRunning]);

  const streak = useMemo(() => calculateStreak(data.entries), [data.entries]);
  const week = useMemo(() => lastSevenDays(data.entries), [data.entries, todayKey]);
  const stats = useMemo(() => summarize(data.entries), [data.entries]);
  const selectedMood = MOODS.find((mood) => mood.key === activeEntry.mood) || MOODS[0];
  const selectedFocus = FOCUS_MODES.find((mode) => mode.key === data.focusMode) || FOCUS_MODES[1];

  const updateToday = (patch) => {
    setData((current) => {
      const safeEntries = current.entries || {};
      const existing = safeEntries[todayKey] || makeEntry(todayKey, safeEntries[todayKey] || {});
      return {
        ...current,
        entries: {
          ...safeEntries,
          [todayKey]: { ...existing, ...patch, date: todayKey, updatedAt: new Date().toISOString() },
        },
      };
    });
  };

  const saveCheckin = () => {
    const nextEntry = activeEntry || makeEntry(todayKey);
    updateToday({
      mood: nextEntry.mood || 'calm',
      energy: Number.isFinite(nextEntry.energy) ? nextEntry.energy : 50,
      stress: Number.isFinite(nextEntry.stress) ? nextEntry.stress : 50,
    });
    Alert.alert('Check-in saved', 'Today’s check-in is stored on this device.');
  };

  const finishOnboarding = () => {
    setData((current) => ({ ...current, onboardingSeen: true }));
    setShowOnboarding(false);
  };

  const startFocus = () => {
    setFocusRemaining(selectedFocus.seconds);
    setFocusComplete(false);
    setFocusRunning(true);
  };

  const resetFocus = () => {
    setFocusRunning(false);
    setFocusComplete(false);
    setFocusRemaining(0);
  };

  const recordFocusCompletion = () => {
    const currentFocusSessions = Number.isFinite(activeEntry?.focusSessions) ? activeEntry.focusSessions : 0;
    updateToday({ focusSessions: currentFocusSessions + 1 });
    setFocusComplete(false);
    Alert.alert('Session complete', 'Nice work making space for one thing.');
  };

  const exportBackup = async () => {
    try {
      await Share.share({
        title: 'Quiet private backup',
        message: JSON.stringify({ app: 'Quiet', exportedAt: new Date().toISOString(), data }, null, 2),
      });
    } catch (error) {
      Alert.alert('Export unavailable', 'Your device could not open the share sheet.');
    }
  };

  const clearData = () => {
    Alert.alert('Delete local data?', 'This permanently removes all Quiet check-ins and notes from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything', style: 'destructive', onPress: async () => {
          const fresh = { ...emptyState(), onboardingSeen: true };
          setData(fresh);
          setScreen('today');
          try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            await AsyncStorage.multiRemove(LEGACY_KEYS);
          } catch (error) {
            Alert.alert('Could not clear storage', 'Please try again.');
          }
        },
      },
    ]);
  };

  const renderToday = () => {
    const routine = activeEntry?.routineCompleted || [];
    return (
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <View>
            <Text style={styles.brand}>quiet</Text>
            <Text style={styles.overline}>{formatLongDate(todayKey)}</Text>
          </View>
          <View style={styles.localBadge}><Text style={styles.localBadgeText}>ON DEVICE</Text></View>
        </View>

        <View style={styles.hero}>
          <View style={[styles.moodOrb, { backgroundColor: selectedMood.tone }]}>
            <Text style={styles.moodEmoji}>{selectedMood.emoji}</Text>
          </View>
          <Text style={styles.eyebrow}>A moment for you</Text>
          <Text style={styles.heroTitle}>{streak > 1 ? `${streak} days of showing up.` : 'How are you, really?'}</Text>
          <Text style={styles.heroCopy}>{getInsight(activeEntry)}</Text>
          <Pressable onPress={() => setScreen('reset')} style={styles.heroLink}>
            <Text style={styles.heroLinkText}>Take a gentle reset  →</Text>
          </Pressable>
        </View>

        <SectionHeading title="Check in" caption="There is no wrong answer." />
        <View style={styles.moodGrid}>
          {MOODS.map((mood) => {
            const selected = activeEntry.mood === mood.key;
            return (
              <Pressable
                key={mood.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => updateToday({ mood: mood.key })}
                style={[styles.moodTile, selected && { backgroundColor: mood.tone, borderColor: mood.tone }]}
              >
                <Text style={styles.moodTileEmoji}>{mood.emoji}</Text>
                <Text style={styles.moodTileLabel}>{mood.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <SectionHeading title="Your inner weather" caption="A quick estimate, not a score." />
          <Metric label="Energy" value={activeEntry.energy} color="#76A990" onChange={(energy) => updateToday({ energy })} />
          <Metric label="Stress" value={activeEntry.stress} color="#E6A28C" onChange={(stress) => updateToday({ stress })} />
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <SectionHeading title="Small reset" caption="Choose what feels doable." />
            <Text style={styles.countBadge}>{routine.length}/{ROUTINE_STEPS.length}</Text>
          </View>
          {ROUTINE_STEPS.map((step) => {
            const done = routine.includes(step.id);
            return (
              <Pressable
                key={step.id}
                onPress={() => {
                  const next = done
                    ? routine.filter((item) => item !== step.id)
                    : [...routine, step.id];
                  updateToday({ routineCompleted: next });
                }}
                style={styles.routineRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
              >
                <View style={[styles.checkbox, done && styles.checkboxDone]}>{done && <Text style={styles.checkmark}>✓</Text>}</View>
                <Text style={[styles.routineLabel, done && styles.routineComplete]}>{step.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.primaryButton} onPress={saveCheckin}>
          <Text style={styles.primaryButtonText}>Save today’s check-in</Text>
        </Pressable>
        <Text style={styles.footnote}>Your check-ins are private and stay on this device.</Text>
      </ScrollView>
    );
  };

  const renderInsights = () => {
    const maxValue = Math.max(100, ...week.map((day) => day.entry?.energy || 0));
    const sortedEntries = Object.values(data.entries || {}).sort((a, b) => b.date.localeCompare(a.date));
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.screenTitle}>Your patterns</Text>
        <Text style={styles.screenSubtitle}>A private look back, without grades or pressure.</Text>

        <View style={styles.card}>
          <SectionHeading title="Energy · last 7 days" caption="Only days you checked in are shown." />
          <View style={styles.chart}>
            {week.map((day) => {
              const value = day.entry?.energy || 0;
              return (
                <View key={day.key} style={styles.chartColumn}>
                  <Text style={styles.chartValue}>{day.entry ? value : '·'}</Text>
                  <View style={styles.chartTrack}>
                    {day.entry ? <View style={[styles.chartBar, { height: `${Math.max(8, value / maxValue * 100)}%` }]} /> : null}
                  </View>
                  <Text style={styles.chartLabel}>{day.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatCard label="Check-in days" value={stats.total} />
          <StatCard label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
          <StatCard label="Avg. energy" value={stats.averageEnergy === null ? '—' : `${stats.averageEnergy}%`} />
          <StatCard label="Focus sessions" value={stats.focusSessions} />
        </View>

        <View style={styles.card}>
          <SectionHeading title="Recent check-ins" caption="Your history stays on this device." />
          {sortedEntries.length === 0 ? (
            <Text style={styles.emptyText}>Your first check-in will appear here. No streaks to keep up with—just a record for you.</Text>
          ) : sortedEntries.slice(0, 7).map((entry) => {
            const mood = MOODS.find((item) => item.key === entry.mood) || MOODS[0];
            return (
              <View key={entry.date} style={styles.historyRow}>
                <View style={[styles.historyMood, { backgroundColor: mood.tone }]}><Text>{mood.emoji}</Text></View>
                <View style={styles.historyMain}>
                  <Text style={styles.historyDate}>{formatLongDate(entry.date)}</Text>
                  <Text style={styles.historyMeta}>{mood.label} · Energy {entry.energy}% · Stress {entry.stress}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderReset = () => (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.screenTitle}>Make a little space</Text>
      <Text style={styles.screenSubtitle}>Choose a short breathing pause or focus on one thing.</Text>

      <View style={styles.card}>
        <SectionHeading title="Breathing pause" caption="Follow the circle at a comfortable pace. Stop if it feels uncomfortable." />
        <View style={styles.breathStage}>
          <View style={[styles.breathOuter, { transform: [{ scale: BREATH_PHASES[breathPhase].scale }] }]}>
            <View style={styles.breathInner}><Text style={styles.breathCount}>{BREATH_PHASES[breathPhase].seconds}</Text></View>
          </View>
        </View>
        <Text style={styles.breathPhase}>{breathRunning ? BREATH_PHASES[breathPhase].name : 'Ready when you are'}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (breathRunning) { setBreathRunning(false); setBreathPhase(0); }
            else setBreathRunning(true);
          }}
        >
          <Text style={styles.primaryButtonText}>{breathRunning ? 'End breathing pause' : 'Begin breathing pause'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <SectionHeading title="One thing at a time" caption="A quiet focus timer. No notifications or data leave your device." />
        <View style={styles.focusModes}>
          {FOCUS_MODES.map((mode) => (
            <Pressable
              key={mode.key}
              onPress={() => { setData((current) => ({ ...current, focusMode: mode.key })); resetFocus(); }}
              style={[styles.focusChoice, data.focusMode === mode.key && styles.focusChoiceActive]}
            >
              <Text style={[styles.focusChoiceTitle, data.focusMode === mode.key && styles.focusChoiceTitleActive]}>{mode.label}</Text>
              <Text style={styles.focusChoiceSub}>{mode.seconds / 60} min</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.timer}>{formatDuration(focusRemaining || selectedFocus.seconds)}</Text>
        {focusComplete ? (
          <Pressable style={styles.primaryButton} onPress={recordFocusCompletion}>
            <Text style={styles.primaryButtonText}>Save completed session</Text>
          </Pressable>
        ) : (
          <View style={styles.timerActions}>
            <Pressable
              style={[styles.primaryButton, styles.timerButton]}
              onPress={() => {
                if (focusRunning) setFocusRunning(false);
                else if (focusRemaining > 0) setFocusRunning(true);
                else startFocus();
              }}
            >
              <Text style={styles.primaryButtonText}>{focusRunning ? 'Pause' : focusRemaining > 0 ? 'Resume' : 'Start focus'}</Text>
            </Pressable>
            {focusRemaining > 0 && <Pressable onPress={resetFocus} style={styles.cancelTimer}><Text style={styles.cancelTimerText}>End</Text></Pressable>}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderJournal = () => {
    const notes = Object.values(data.entries || {})
      .filter((entry) => entry.note && entry.note.trim())
      .sort((a, b) => b.date.localeCompare(a.date));
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Text style={styles.screenTitle}>Your notes</Text>
          <Text style={styles.screenSubtitle}>A private space to put thoughts down. Saved automatically on this device.</Text>
          <TextInput
            value={activeEntry.note || ''}
            onChangeText={(note) => updateToday({ note })}
            placeholder="What is taking up space in your mind?"
            placeholderTextColor="#8A8F8D"
            multiline
            textAlignVertical="top"
            style={styles.noteInput}
            accessibilityLabel="Private journal note for today"
          />
          <Text style={styles.savedLabel}>Today · autosaved locally</Text>
          <View style={styles.card}>
            <SectionHeading title="Past notes" caption="Only notes you have written are shown." />
            {notes.length === 0 ? <Text style={styles.emptyText}>Your past notes will live here. No one else can see them.</Text> : notes.map((entry) => (
              <View key={entry.date} style={styles.noteHistory}>
                <Text style={styles.historyDate}>{formatLongDate(entry.date)}</Text>
                <Text style={styles.noteHistoryText}>{entry.note}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  const renderPrivacy = () => (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.screenTitle}>Your privacy</Text>
      <Text style={styles.screenSubtitle}>Quiet is designed to work without an account.</Text>
      <View style={styles.privacyBanner}>
        <Text style={styles.privacyIcon}>◇</Text>
        <Text style={styles.privacyBannerTitle}>Your data stays here.</Text>
        <Text style={styles.privacyBannerCopy}>Check-ins and notes are stored in local app storage. Quiet does not send them to a server.</Text>
      </View>
      <View style={styles.card}>
        <SectionHeading title="You are in control" />
        <Text style={styles.settingCopy}>Export a copy when you want, or permanently delete the app’s local data. Exported files are no longer protected by Quiet, so store them carefully.</Text>
        <Pressable style={styles.secondaryButton} onPress={exportBackup}><Text style={styles.secondaryButtonText}>Export my data</Text></Pressable>
        <Pressable style={styles.destructiveButton} onPress={clearData}><Text style={styles.destructiveText}>Delete all local data</Text></Pressable>
      </View>
      <Text style={styles.versionLabel}>QUIET · PRIVATE BY DESIGN</Text>
    </ScrollView>
  );

  if (!ready) {
    return <SafeAreaView style={styles.loading}><StatusBar style="dark" /><ActivityIndicator color="#44695A" /><Text style={styles.loadingText}>Opening your quiet space…</Text></SafeAreaView>;
  }

  if (showOnboarding) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.onboarding}>
          <View style={styles.onboardingMark}><Text style={styles.onboardingMarkText}>q</Text></View>
          <Text style={styles.brand}>quiet</Text>
          <Text style={styles.onboardingTitle}>A softer way to check in.</Text>
          <Text style={styles.onboardingCopy}>Notice your mood, make a little space, and move through the day at your own pace.</Text>
          <View style={styles.onboardingPrivacy}><Text style={styles.onboardingPrivacyTitle}>Private from the start</Text><Text style={styles.onboardingPrivacyCopy}>No account. No ads. Your notes stay on this device. Export or erase your data whenever you choose.</Text></View>
          <Pressable style={styles.primaryButton} onPress={finishOnboarding}><Text style={styles.primaryButtonText}>Begin, gently</Text></Pressable>
          <Text style={styles.footnote}>Quiet is a wellbeing aid, not medical care.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const screens = { today: renderToday, insights: renderInsights, reset: renderReset, journal: renderJournal, privacy: renderPrivacy };
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.flex}>{screens[screen]()}</View>
      <View style={styles.tabBar}>
        {NAV_ITEMS.map((item) => {
          const active = screen === item.key;
          return (
            <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setScreen(item.key)} style={styles.tab}>
              <Text style={[styles.tabIcon, active && styles.tabActive]}>{item.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function SectionHeading({ title, caption }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}</View>;
}

function Metric({ label, value, color, onChange }) {
  return (
    <View style={styles.metricBlock}>
      <View style={styles.rowBetween}>
        <Text style={styles.metricLabel}>{label}</Text>
        <View style={styles.metricControls}>
          <Pressable accessibilityLabel={`Lower ${label}`} onPress={() => onChange(Math.max(0, value - 5))} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable>
          <Text style={styles.metricValue}>{value}</Text>
          <Pressable accessibilityLabel={`Raise ${label}`} onPress={() => onChange(Math.min(100, value + 5))} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable>
        </View>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

function StatCard({ label, value }) {
  return <View style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F0EB' },
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: '#F4F0EB', alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#66746E', fontSize: 14 },
  page: { padding: 22, paddingBottom: 112 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  brand: { fontSize: 32, fontWeight: '700', color: '#23352E', letterSpacing: -1.5 },
  overline: { color: '#78817A', fontSize: 12, marginTop: 3 },
  localBadge: { backgroundColor: '#E5EFE9', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  localBadgeText: { color: '#426553', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  hero: { borderRadius: 28, padding: 22, backgroundColor: '#E5EEE7', marginBottom: 28 },
  moodOrb: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  moodEmoji: { fontSize: 25, color: '#314A3F' },
  eyebrow: { color: '#597566', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700' },
  heroTitle: { color: '#20352C', fontSize: 26, lineHeight: 32, fontWeight: '700', marginTop: 7 },
  heroCopy: { color: '#51665C', fontSize: 15, lineHeight: 22, marginTop: 8 },
  heroLink: { alignSelf: 'flex-start', marginTop: 15 },
  heroLinkText: { color: '#315B48', fontSize: 14, fontWeight: '700' },
  sectionHeading: { marginBottom: 13 },
  sectionTitle: { color: '#26372F', fontSize: 18, fontWeight: '700' },
  sectionCaption: { color: '#7A817B', fontSize: 13, marginTop: 4, lineHeight: 18 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  moodTile: { width: '31.5%', minHeight: 82, borderRadius: 19, backgroundColor: '#FBF9F6', borderColor: '#E9E2DA', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  moodTileEmoji: { fontSize: 22, marginBottom: 5, color: '#34483E' },
  moodTileLabel: { color: '#39473F', fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: '#FFFEFC', borderRadius: 23, padding: 18, borderWidth: 1, borderColor: '#EBE5DE', marginBottom: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metricBlock: { marginTop: 4 },
  metricLabel: { color: '#405148', fontSize: 14, fontWeight: '600' },
  metricControls: { flexDirection: 'row', alignItems: 'center' },
  stepButton: { width: 30, height: 30, borderRadius: 11, backgroundColor: '#F1ECE6', justifyContent: 'center', alignItems: 'center' },
  stepText: { color: '#42564B', fontSize: 18, fontWeight: '600' },
  metricValue: { minWidth: 44, textAlign: 'center', color: '#26372F', fontWeight: '700', fontSize: 14 },
  progressTrack: { height: 8, backgroundColor: '#F0ECE7', borderRadius: 9, overflow: 'hidden', marginTop: 9, marginBottom: 14 },
  progressFill: { height: '100%', borderRadius: 9 },
  countBadge: { backgroundColor: '#E9F1EB', color: '#426553', borderRadius: 99, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  routineRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0ECE7' },
  checkbox: { width: 21, height: 21, borderRadius: 8, borderWidth: 1.5, borderColor: '#B9C1BA', marginRight: 11, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: '#639078', borderColor: '#639078' },
  checkmark: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  routineLabel: { color: '#39473F', fontSize: 14, flex: 1 },
  routineComplete: { color: '#858D86', textDecorationLine: 'line-through' },
  primaryButton: { backgroundColor: '#315747', borderRadius: 17, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  footnote: { textAlign: 'center', color: '#858B85', fontSize: 11, lineHeight: 16, marginTop: 12 },
  screenTitle: { color: '#24352E', fontSize: 30, fontWeight: '700', letterSpacing: -0.8, marginTop: 5 },
  screenSubtitle: { color: '#727A74', fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 21 },
  chart: { flexDirection: 'row', height: 170, alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 14 },
  chartColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  chartValue: { color: '#728078', fontSize: 10, marginBottom: 5 },
  chartTrack: { height: 112, width: 19, borderRadius: 99, backgroundColor: '#F0EEE9', justifyContent: 'flex-end', overflow: 'hidden' },
  chartBar: { width: '100%', minHeight: 8, backgroundColor: '#82B19A', borderRadius: 99 },
  chartLabel: { color: '#818780', fontSize: 10, marginTop: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { width: '48%', borderRadius: 19, backgroundColor: '#E9F0EA', padding: 16, marginBottom: 10 },
  statValue: { color: '#2F5141', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#68776D', fontSize: 12, marginTop: 5 },
  historyRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0ECE7' },
  historyMood: { width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  historyMain: { flex: 1 },
  historyDate: { color: '#35443B', fontSize: 13, fontWeight: '700' },
  historyMeta: { color: '#818780', fontSize: 11, marginTop: 4 },
  emptyText: { color: '#78817A', fontSize: 14, lineHeight: 21 },
  breathStage: { height: 210, alignItems: 'center', justifyContent: 'center' },
  breathOuter: { width: 154, height: 154, borderRadius: 77, backgroundColor: '#E6F0E9', alignItems: 'center', justifyContent: 'center' },
  breathInner: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#C8DFD0', alignItems: 'center', justifyContent: 'center' },
  breathCount: { color: '#345A46', fontSize: 30, fontWeight: '600' },
  breathPhase: { color: '#3A5949', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 17 },
  focusModes: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  focusChoice: { flex: 1, borderWidth: 1, borderColor: '#E9E3DC', backgroundColor: '#F8F6F2', borderRadius: 15, padding: 11, marginRight: 7 },
  focusChoiceActive: { backgroundColor: '#E5EFE8', borderColor: '#C8DCCE' },
  focusChoiceTitle: { color: '#536158', fontSize: 12, fontWeight: '700' },
  focusChoiceTitleActive: { color: '#315747' },
  focusChoiceSub: { color: '#858B85', fontSize: 11, marginTop: 4 },
  timer: { textAlign: 'center', color: '#2D483A', fontSize: 48, fontWeight: '300', letterSpacing: 2, marginBottom: 19 },
  timerActions: { flexDirection: 'row', alignItems: 'center' },
  timerButton: { flex: 1 },
  cancelTimer: { padding: 15, marginLeft: 8 },
  cancelTimerText: { color: '#7B807A', fontWeight: '600' },
  noteInput: { minHeight: 190, borderRadius: 20, borderWidth: 1, borderColor: '#E8E2DA', backgroundColor: '#FFFEFC', padding: 17, color: '#33443A', fontSize: 15, lineHeight: 23 },
  savedLabel: { color: '#838A83', fontSize: 11, marginTop: 9, marginBottom: 22 },
  noteHistory: { paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#F0ECE7' },
  noteHistoryText: { color: '#56635B', fontSize: 13, lineHeight: 20, marginTop: 7 },
  privacyBanner: { backgroundColor: '#E4EFE7', borderRadius: 24, padding: 21, marginBottom: 18 },
  privacyIcon: { color: '#47715B', fontSize: 24, marginBottom: 10 },
  privacyBannerTitle: { color: '#294636', fontSize: 20, fontWeight: '700' },
  privacyBannerCopy: { color: '#5E7165', fontSize: 14, lineHeight: 21, marginTop: 7 },
  settingCopy: { color: '#647169', fontSize: 14, lineHeight: 21 },
  secondaryButton: { borderWidth: 1, borderColor: '#D9E3DB', borderRadius: 15, padding: 14, alignItems: 'center', marginTop: 15 },
  secondaryButtonText: { color: '#315747', fontSize: 14, fontWeight: '700' },
  destructiveButton: { borderRadius: 15, padding: 14, alignItems: 'center', backgroundColor: '#FAEFEC', marginTop: 10 },
  destructiveText: { color: '#A55047', fontSize: 14, fontWeight: '700' },
  versionLabel: { color: '#929790', textAlign: 'center', fontSize: 10, letterSpacing: 1.5, marginTop: 7 },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFDFB', borderTopWidth: 1, borderTopColor: '#EAE5DE', paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 8 : 10 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  tabIcon: { fontSize: 18, color: '#929890', marginBottom: 3 },
  tabLabel: { color: '#858B85', fontSize: 9, fontWeight: '600' },
  tabActive: { color: '#315747' },
  onboarding: { flex: 1, justifyContent: 'center', padding: 26 },
  onboardingMark: { width: 55, height: 55, borderRadius: 20, backgroundColor: '#DDEBE1', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  onboardingMarkText: { color: '#315747', fontSize: 32, fontWeight: '700' },
  onboardingTitle: { color: '#24352E', fontSize: 34, lineHeight: 40, fontWeight: '700', marginTop: 22 },
  onboardingCopy: { color: '#68756D', fontSize: 16, lineHeight: 24, marginTop: 12 },
  onboardingPrivacy: { backgroundColor: '#E8F0E9', borderRadius: 20, padding: 17, marginTop: 24, marginBottom: 23 },
  onboardingPrivacyTitle: { color: '#315747', fontSize: 14, fontWeight: '700' },
  onboardingPrivacyCopy: { color: '#63736A', fontSize: 13, lineHeight: 19, marginTop: 6 },
});

