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
  { key: 'calm', label: 'Calm', emoji: '◌', tone: '#A5D6A7' },
  { key: 'happy', label: 'Happy', emoji: '☺', tone: '#FFD166' },
  { key: 'tired', label: 'Tired', emoji: '☾', tone: '#B0BEC5' },
  { key: 'stressed', label: 'Stressed', emoji: '⚡', tone: '#FF8A80' },
  { key: 'overwhelmed', label: 'Overwhelmed', emoji: '✦', tone: '#CE93D8' },
];

const routineSteps = [
  'Breathe in for 4',
  'Hold for 2',
  'Exhale for 6',
  'Stretch shoulders',
  'Put your phone down for 2 minutes',
];

const storageKey = 'quiet-daily-state';

const defaultState = {
  mood: 'calm',
  energy: 72,
  stress: 28,
  journal: '',
  routineCompleted: [],
  streak: 3,
  lastCheckin: null,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function App() {
  const [state, setState] = useState(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadState = async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          setState({ ...defaultState, ...parsed });
        }
      } catch (error) {
        console.warn('Failed to read local Quiet state', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadState();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {});
  }, [state, isLoaded]);

  const summaryText = useMemo(() => {
    if (state.stress > 60) return 'Your day feels full. Keep the next step small.';
    if (state.energy < 40) return 'Low energy today — protect your attention and rest.';
    if (state.mood === 'happy') return 'Good momentum. Keep the calm going.';
    return 'Steady pace. One gentle win is enough.';
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

  const updateMetric = (type, direction) => {
    setState((current) => {
      const delta = direction === 'up' ? 5 : -5;
      const value = clamp(current[type] + delta, 0, 100);
      return { ...current, [type]: value };
    });
  };

  const completeCheckin = () => {
    const today = new Date().toISOString().slice(0, 10);
    setState((current) => ({
      ...current,
      lastCheckin: today,
      streak: current.streak + 1,
    }));
  };

  const activeMood = moodOptions.find((option) => option.key === state.mood) || moodOptions[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <Text style={styles.kicker}>quiet</Text>
          <Text style={styles.title}>Your day, your pace.</Text>
          <Text style={styles.subtitle}>Private. Calm. No sign-in required.</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.moodBubble}>
            <Text style={styles.moodEmoji}>{activeMood.emoji}</Text>
          </View>
          <View style={styles.heroMeta}>
            <Text style={styles.heroLabel}>Current mood</Text>
            <Text style={styles.heroMood}>{activeMood.label}</Text>
            <Text style={styles.heroSummary}>{summaryText}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How are you feeling?</Text>
          <View style={styles.moodsGrid}>
            {moodOptions.map((option) => {
              const isSelected = state.mood === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setState((current) => ({ ...current, mood: option.key }))}
                  style={[styles.moodOption, isSelected && { backgroundColor: option.tone }]}
                >
                  <Text style={styles.moodChoiceEmoji}>{option.emoji}</Text>
                  <Text style={styles.moodChoiceLabel}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Energy check</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Energy</Text>
            <View style={styles.metricControls}>
              <Pressable onPress={() => updateMetric('energy', 'down')} style={styles.stepButton}><Text>-</Text></Pressable>
              <Text style={styles.metricValue}>{state.energy}%</Text>
              <Pressable onPress={() => updateMetric('energy', 'up')} style={styles.stepButton}><Text>+</Text></Pressable>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${state.energy}%`, backgroundColor: '#7DBEA8' }]} />
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
            <View style={[styles.progressFill, { width: `${state.stress}%`, backgroundColor: '#F3B29D' }]} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Reset routine</Text>
            <Text style={styles.streakText}>{state.streak} day streak</Text>
          </View>
          {routineSteps.map((step) => {
            const done = state.routineCompleted.includes(step);
            return (
              <Pressable
                key={step}
                onPress={() => toggleRoutineStep(step)}
                style={[styles.routineItem, done && styles.routineCompleted]}
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
            style={styles.input}
            placeholder="What needs less weight today?"
            multiline
            numberOfLines={4}
            placeholderTextColor="#8E8A86"
          />
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
    backgroundColor: '#F4EFEA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  headerWrap: {
    marginBottom: 18,
  },
  kicker: {
    color: '#6E8A7A',
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2A2B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6866',
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F8F5F2',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E7DFD8',
  },
  moodBubble: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#DDEBE3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 28,
  },
  heroMeta: {
    flex: 1,
  },
  heroLabel: {
    color: '#6F726D',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroMood: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2A2B',
    marginTop: 4,
  },
  heroSummary: {
    fontSize: 14,
    color: '#5E6765',
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFDFB',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDE4DC',
    padding: 16,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2A2B',
    marginBottom: 12,
  },
  moodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moodOption: {
    width: '30%',
    minWidth: 90,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F2EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9DFD8',
  },
  moodChoiceEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  moodChoiceLabel: {
    fontSize: 13,
    color: '#2D3635',
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 15,
    color: '#46504E',
    fontWeight: '600',
  },
  metricControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EFE5DE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    minWidth: 48,
    textAlign: 'center',
    color: '#1F2A2B',
    fontWeight: '700',
  },
  progressTrack: {
    height: 12,
    backgroundColor: '#EEE7E0',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakText: {
    fontSize: 12,
    color: '#6A796F',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  routineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F7F1EB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9DFD7',
  },
  routineCompleted: {
    backgroundColor: '#E8F3EE',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#A9A29B',
  },
  checkCircleDone: {
    backgroundColor: '#6BAA91',
    borderColor: '#6BAA91',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  routineText: {
    fontSize: 15,
    color: '#2E312F',
  },
  routineTextDone: {
    textDecorationLine: 'line-through',
    color: '#6E7E79',
  },
  input: {
    minHeight: 110,
    backgroundColor: '#F7F2EF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7DBD2',
    padding: 14,
    textAlignVertical: 'top',
    color: '#1F2A2B',
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#304B43',
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
    fontWeight: '700',
    fontSize: 16,
  },
});

