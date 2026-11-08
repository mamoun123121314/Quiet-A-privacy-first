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
} from 'react-native';

const storageKey = 'quiet-state-v2';
const tabs = [
  { key: 'home', label: 'Home' },
  { key: 'breathe', label: 'Breathe' },
  { key: 'journal', label: 'Journal' },
  { key: 'settings', label: 'Privacy' },
];

const moodOptions = [
  { key: 'calm', label: 'Calm', emoji: '◌', tone: '#A9D5C2' },
  { key: 'happy', label: 'Happy', emoji: '☺', tone: '#FFD7A8' },
  { key: 'tired', label: 'Tired', emoji: '☾', tone: '#D8E1F0' },
  { key: 'stressed', label: 'Stressed', emoji: '⚡', tone: '#F7B3A8' },
  { key: 'overwhelmed', label: 'Overwhelmed', emoji: '✦', tone: '#D9C4E8' },
];

const routineSteps = [
  'Breathe in for 4',
  'Hold for 2',
  'Exhale for 6',
  'Stretch shoulders',
  'Put your phone down for 2 minutes',
];

const defaultState = {
  mood: 'calm',
  energy: 72,
  stress: 28,
  journal: '',
  routineCompleted: [],
  streak: 3,
  lastCheckin: null,
  totalCheckins: 12,
  onboardingSeen: false,
};

const breathSequence = [
  { phase: 'Inhale', duration: 4000, scale: 1.25 },
  { phase: 'Hold', duration: 2000, scale: 1.25 },
  { phase: 'Exhale', duration: 6000, scale: 0.9 },
  { phase: 'Rest', duration: 2000, scale: 0.95 },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatDateLabel(dateString) {
  if (!dateString) return 'No check-in yet';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function App() {
  const [state, setState] = useState(defaultState);
  const [screen, setScreen] = useState('home');
  const [ready, setReady] = useState(false);
  const [breathIndex, setBreathIndex] = useState(0);
  const [breathScale, setBreathScale] = useState(1);
  const [breathStarted, setBreathStarted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          setState({ ...defaultState, ...parsed });
          setShowOnboarding(!parsed.onboardingSeen);
        } else {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.warn('Quiet load failed:', error);
        setShowOnboarding(true);
      } finally {
        setReady(true);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  useEffect(() => {
    if (!breathStarted) return;
    const step = breathSequence[breathIndex];
    setBreathScale(step.scale);
    intervalRef.current = setTimeout(() => {
      setBreathIndex((previous) => (previous + 1) % breathSequence.length);
    }, step.duration);

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [breathStarted, breathIndex]);

  const activeMood = moodOptions.find((option) => option.key === state.mood) || moodOptions[0];

  const insightText = useMemo(() => {
    if (state.stress > 65) return 'Your day feels crowded. Keep the next step small and simple.';
    if (state.energy < 35) return 'Low energy today. Protect your attention and keep the rhythm soft.';
    if (state.mood === 'happy') return 'Good momentum. Stay gentle and keep the calm going.';
    return 'Steady pace. One calm win is enough for today.';
  }, [state.energy, state.mood, state.stress]);

  const toggleRoutineStep = (stepText) => {
    setState((current) => {
      const exists = current.routineCompleted.includes(stepText);
      return {
        ...current,
        routineCompleted: exists
          ? current.routineCompleted.filter((item) => item !== stepText)
          : [...current.routineCompleted, stepText],
      };
    });
  };

  const updateMetric = (field, direction) => {
    setState((current) => {
      const delta = direction === 'up' ? 5 : -5;
      return {
        ...current,
        [field]: clamp(current[field] + delta, 0, 100),
      };
    });
  };

  const completeCheckin = () => {
    const today = new Date().toISOString().slice(0, 10);
    setState((current) => ({
      ...current,
      lastCheckin: today,
      totalCheckins: current.totalCheckins + 1,
      streak: current.lastCheckin === today ? current.streak : current.streak + 1,
    }));
  };

  const resetData = () => {
    setState({ ...defaultState, onboardingSeen: true });
    setScreen('home');
  };

  const finishOnboarding = () => {
    setState((current) => ({ ...current, onboardingSeen: true }));
    setShowOnboarding(false);
    setScreen('home');
  };

  const currentBreath = breathSequence[breathIndex];

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.brand}>quiet</Text>
          <Text style={styles.subBrand}>private reset</Text>
        </View>
        <View style={styles.privatePill}>
          <Text style={styles.privateText}>local only</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={[styles.moodCircle, { backgroundColor: activeMood.tone }]}>
          <Text style={styles.moodEmoji}>{activeMood.emoji}</Text>
        </View>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroLabel}>current mood</Text>
          <Text style={styles.heroMood}>{activeMood.label}</Text>
          <Text style={styles.heroSummary}>{insightText}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>How are you feeling?</Text>
        <View style={styles.moodGrid}>
          {moodOptions.map((option) => {
            const selected = state.mood === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setState((current) => ({ ...current, mood: option.key }))}
                style={[styles.moodOption, selected && { backgroundColor: option.tone }]}
              >
                <Text style={styles.moodChoiceEmoji}>{option.emoji}</Text>
                <Text style={styles.moodChoiceLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Energy check</Text>
          <Text style={styles.metaBadge}>{state.streak} day streak</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Energy</Text>
          <View style={styles.metricControls}>
            <Pressable onPress={() => updateMetric('energy', 'down')} style={styles.stepButton}><Text>-</Text></Pressable>
            <Text style={styles.metricValue}>{state.energy}%</Text>
            <Pressable onPress={() => updateMetric('energy', 'up')} style={styles.stepButton}><Text>+</Text></Pressable>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${state.energy}%`, backgroundColor: '#7FB69B' }]} />
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Stress</Text>
          <View style={styles.metricControls}>
            <Pressable onPress={() => updateMetric('stress', 'down')} style={styles.stepButton}><Text>-</Text></Pressable>
            <Text style={styles.metricValue}>{state.stress}%</Text>
            <Pressable onPress={() => updateMetric('stress', 'up')} style={styles.stepButton}><Text>+</Text></Pressable>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${state.stress}%`, backgroundColor: '#F0B29B' }]} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Reset routine</Text>
          <Text style={styles.metaBadge}>{state.routineCompleted.length}/{routineSteps.length}</Text>
        </View>

        {routineSteps.map((step) => {
          const done = state.routineCompleted.includes(step);
          return (
            <Pressable
              key={step}
              onPress={() => toggleRoutineStep(step)}
              style={[styles.routineItem, done && styles.routineDoneItem]}
            >
              <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
                {done ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={[styles.routineText, done && styles.routineTextDone]}>{step}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>last check-in</Text>
          <Text style={styles.statValue}>{formatDateLabel(state.lastCheckin)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>total check-ins</Text>
          <Text style={styles.statValue}>{state.totalCheckins}</Text>
        </View>
      </View>

      <Pressable style={styles.primaryButton} onPress={completeCheckin}>
        <Text style={styles.primaryButtonText}>Complete quiet check-in</Text>
      </Pressable>
    </ScrollView>
  );

  const renderBreathe = () => (
    <View style={styles.screenContent}>
      <Text style={styles.screenTitle}>Breathe</Text>
      <Text style={styles.screenSubtitle}>Take a reset before the next task.</Text>

      <View style={styles.breatheStage}>
        <View
          style={[
            styles.breatheOrb,
            { transform: [{ scale: breathScale }], backgroundColor: '#D8E8DF' },
          ]}
        />
      </View>

      <Text style={styles.phaseText}>{currentBreath.phase}</Text>

      <View style={styles.breatheButtons}>
        <Pressable style={styles.primaryButton} onPress={() => setBreathStarted(true)}>
          <Text style={styles.primaryButtonText}>Start breathing</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => { setBreathStarted(false); setBreathIndex(0); setBreathScale(1); }}>
          <Text style={styles.secondaryButtonText}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderJournal = () => (
    <KeyboardAvoidingView
      style={styles.screenContent}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.screenTitle}>Private note</Text>
      <Text style={styles.screenSubtitle}>Keep what matters without sharing it.</Text>

      <TextInput
        value={state.journal}
        onChangeText={(text) => setState((current) => ({ ...current, journal: text }))}
        placeholder="What needs less weight today?"
        placeholderTextColor="#8A8F8D"
        multiline
        numberOfLines={8}
        style={styles.textArea}
      />
    </KeyboardAvoidingView>
  );

  const renderSettings = () => (
    <View style={styles.screenContent}>
      <Text style={styles.screenTitle}>Privacy</Text>
      <Text style={styles.screenSubtitle}>Quiet stores your data locally and keeps it private.</Text>

      <View style={styles.card}>
        <Text style={styles.settingTitle}>Local-first</Text>
        <Text style={styles.settingText}>Your notes, mood, and routine stay on your device unless you export them yourself.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.settingTitle}>No account needed</Text>
        <Text style={styles.settingText}>There is no signup flow, tracking profile, or social pressure.</Text>
      </View>

      <Pressable style={styles.secondaryButton} onPress={resetData}>
        <Text style={styles.secondaryButtonText}>Reset local data</Text>
      </Pressable>
    </View>
  );

  if (showOnboarding) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.onboardingWrap}>
          <Text style={styles.brand}>quiet</Text>
          <Text style={styles.onboardingTitle}>Your day, your pace.</Text>
          <Text style={styles.onboardingText}>
            Quiet is a private daily reset for stress, energy, and focus. No account. No tracking. Just one gentle place to check in.
          </Text>

          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingFeature}>✓ Mood check-in</Text>
            <Text style={styles.onboardingFeature}>✓ Energy + stress tracking</Text>
            <Text style={styles.onboardingFeature}>✓ Quiet reset routine</Text>
            <Text style={styles.onboardingFeature}>✓ Private local journal</Text>
          </View>

          <Pressable style={styles.primaryButton} onPress={finishOnboarding}>
            <Text style={styles.primaryButtonText}>Start</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {screen === 'home' && renderHome()}
      {screen === 'breathe' && renderBreathe()}
      {screen === 'journal' && renderJournal()}
      {screen === 'settings' && renderSettings()}

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.key === screen;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setScreen(tab.key)}
              style={[styles.tab, active && styles.activeTab]}
            >
              <Text style={[styles.tabText, active && styles.activeTabText]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3EEE8',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  screenContent: {
    flex: 1,
    padding: 20,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  brand: {
    fontSize: 30,
    fontWeight: '700',
    color: '#243229',
    letterSpacing: -1,
  },
  subBrand: {
    fontSize: 13,
    color: '#6B7B74',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  privatePill: {
    backgroundColor: '#E7F1EC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D3E4D8',
  },
  privateText: {
    color: '#385F4C',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F6F3',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4DCD3',
    marginBottom: 18,
  },
  moodCircle: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  moodEmoji: {
    fontSize: 30,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroLabel: {
    color: '#69756F',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 11,
  },
  heroMood: {
    fontSize: 26,
    fontWeight: '700',
    color: '#243229',
    marginTop: 4,
  },
  heroSummary: {
    marginTop: 6,
    color: '#53615D',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fffdfb',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7DFD8',
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#243229',
    marginBottom: 12,
  },
  metaBadge: {
    fontSize: 11,
    color: '#48675D',
    backgroundColor: '#EAF3EF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '700',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moodOption: {
    width: '31%',
    minWidth: 96,
    paddingVertical: 14,
    backgroundColor: '#F4F0ED',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E3D9D1',
    marginBottom: 10,
  },
  moodChoiceEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  moodChoiceLabel: {
    color: '#2C3532',
    fontWeight: '600',
    fontSize: 13,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metricLabel: {
    color: '#45524D',
    fontWeight: '600',
    fontSize: 15,
  },
  metricControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#EFE5DE',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  metricValue: {
    fontWeight: '700',
    color: '#1E2A28',
    minWidth: 52,
    textAlign: 'center',
  },
  progressTrack: {
    height: 12,
    backgroundColor: '#F0EAE3',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  routineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F1EC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EADFD6',
  },
  routineDoneItem: {
    backgroundColor: '#E7F3EE',
    borderColor: '#D4E7DD',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#B0A59D',
    marginRight: 12,
  },
  checkCircleDone: {
    borderColor: '#5F8E7A',
    backgroundColor: '#5F8E7A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  routineText: {
    color: '#2B342F',
    fontSize: 15,
  },
  routineTextDone: {
    color: '#6F7C76',
    textDecorationLine: 'line-through',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F9F4F1',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EADFD7',
    marginRight: 10,
  },
  statLabel: {
    color: '#68756F',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#243229',
  },
  primaryButton: {
    backgroundColor: '#2F4D45',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#F2EAE5',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1D5CE',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#2E453E',
    fontWeight: '700',
    fontSize: 15,
  },
  tabBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#fffdfb',
    borderRadius: 18,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E7DFD8',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#EAF3EF',
  },
  tabText: {
    color: '#626F69',
    fontWeight: '600',
    fontSize: 12,
  },
  activeTabText: {
    color: '#2E4B45',
    fontWeight: '700',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#243229',
  },
  screenSubtitle: {
    marginTop: 6,
    marginBottom: 20,
    color: '#5F6965',
    fontSize: 15,
  },
  breatheStage: {
    flex: 1,
    minHeight: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breatheOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#D8E8DF',
  },
  phaseText: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#2F4D45',
    marginTop: 20,
  },
  breatheButtons: {
    marginTop: 20,
  },
  textArea: {
    minHeight: 220,
    backgroundColor: '#F7F2EF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7DDD5',
    padding: 14,
    fontSize: 15,
    color: '#1E2A28',
    textAlignVertical: 'top',
  },
  settingTitle: {
    fontWeight: '700',
    color: '#243229',
    fontSize: 17,
    marginBottom: 8,
  },
  settingText: {
    color: '#53615D',
    fontSize: 14,
    lineHeight: 20,
  },
  onboardingWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  onboardingTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#243229',
    marginTop: 12,
  },
  onboardingText: {
    color: '#53615D',
    fontSize: 17,
    lineHeight: 26,
    marginTop: 14,
  },
  onboardingCard: {
    backgroundColor: '#fffdfb',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7DFD8',
    padding: 18,
    marginTop: 22,
    marginBottom: 22,
  },
  onboardingFeature: {
    color: '#2C3532',
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '600',
  },
});

