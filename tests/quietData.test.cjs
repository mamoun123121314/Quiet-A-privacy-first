const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateStreak,
  emptyState,
  lastSevenDays,
  localDateKey,
  normalizeState,
  summarize,
} = require('../src/quietData.cjs');

function dateKey(offset, now = new Date(2025, 0, 10, 12)) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return localDateKey(date);
}

test('new state starts empty rather than showing fabricated check-ins', () => {
  const state = emptyState();
  assert.deepEqual(state.entries, {});
  assert.equal(calculateStreak(state.entries), 0);
});

test('migration preserves the first MVP check-in as a dated entry', () => {
  const state = normalizeState({
    onboardingSeen: true,
    mood: 'stressed',
    energy: 35,
    stress: 80,
    journal: 'Taking a break.',
    lastCheckin: '2025-01-08',
    routineCompleted: ['breathe'],
  });
  assert.equal(state.entries['2025-01-08'].mood, 'stressed');
  assert.equal(state.entries['2025-01-08'].note, 'Taking a break.');
  assert.deepEqual(state.entries['2025-01-08'].routineCompleted, ['breathe']);
});

test('streak handles today, yesterday, gaps, and consecutive days', () => {
  const now = new Date(2025, 0, 10, 12);
  assert.equal(calculateStreak({ [dateKey(0, now)]: {} }, now), 1);
  assert.equal(calculateStreak({ [dateKey(-1, now)]: {}, [dateKey(-2, now)]: {} }, now), 2);
  assert.equal(calculateStreak({ [dateKey(-2, now)]: {}, [dateKey(-3, now)]: {} }, now), 0);
});

test('seven-day history is ordered oldest to newest and includes empty days', () => {
  const now = new Date(2025, 0, 10, 12);
  const days = lastSevenDays({ [dateKey(0, now)]: { energy: 80 } }, now);
  assert.equal(days.length, 7);
  assert.equal(days[0].key, dateKey(-6, now));
  assert.equal(days[6].key, dateKey(0, now));
  assert.equal(days[5].entry, null);
});

test('summary calculates actual aggregates from saved entries', () => {
  const result = summarize({
    a: { energy: 20, stress: 80, focusSessions: 1 },
    b: { energy: 60, stress: 40, focusSessions: 2 },
  });
  assert.deepEqual(result, { total: 2, averageEnergy: 40, averageStress: 60, focusSessions: 3 });
});
