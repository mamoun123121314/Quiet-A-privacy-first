import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';

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

const storageKey = 'quiet-state-v1';

const defaultState = {
  mood: 'calm',
  energy: 72,
  stress: 28,
  journal: '',
  routineCompleted: [],
  streak: 3,
  lastCheckin: null,
  totalCheckins: 12,
};

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadState = async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          setState({ ...defaultState, ...parsed });
        }
      } catch (error) {
        console.warn('Quiet load failed:', error);
      } finally {
        setReady(true);
      }
    };

    loadState();
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const activeMood = moodOptions.find((option) => option.key === state.mood) || moodOptions[0];

  const insightText = useMemo(() => {
    if (state.stress > 65) return 'Your day feels crowded. The next step is only one small action.';
    if (state.energy < 35) return 'Low energy today. Ease the pace and protect your attention.';
    if (state.mood === 'happy') return 'Good momentum. Stay gentle and keep the rhythm light.';
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Private note</Text>
          <TextInput
            value={state.journal}
            onChangeText={(text) => setState((current) => ({ ...current, journal: text }))}
            placeholder="What needs less weight today?"
            placeholderTextColor="#8A8F8D"
            multiline
            numberOfLines={5}
            style={styles.input}
          />
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
    paddingBottom: 90,
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
  input: {
    minHeight: 120,
    backgroundColor: '#F7F2EF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7DDD5',
    padding: 14,
    color: '#1E2A28',
    fontSize: 15,
    textAlignVertical: 'top',
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
});

