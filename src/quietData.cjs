const SCHEMA_VERSION = 1;

const MOODS = [
  { key: 'calm', label: 'Calm', emoji: '◌', tone: '#A9D5C2' },
  { key: 'good', label: 'Good', emoji: '☺', tone: '#FFD7A8' },
  { key: 'low', label: 'Low', emoji: '☾', tone: '#D8E1F0' },
  { key: 'stressed', label: 'Stressed', emoji: '↗', tone: '#F7B3A8' },
  { key: 'overwhelmed', label: 'Overwhelmed', emoji: '✦', tone: '#D9C4E8' },
];

const ROUTINE_STEPS = [
  { id: 'breathe', label: 'Take three slow breaths' },
  { id: 'shoulders', label: 'Release your shoulders' },
  { id: 'water', label: 'Have a glass of water' },
  { id: 'one-thing', label: 'Choose one next step' },
];

const FOCUS_MODES = [
  { key: 'reset', label: 'Reset', seconds: 5 * 60 },
  { key: 'steady', label: 'Steady', seconds: 10 * 60 },
  { key: 'deep', label: 'Deep focus', seconds: 25 * 60 },
];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    onboardingSeen: false,
    focusMode: 'steady',
    entries: {},
  };
}

function normalizeState(input) {
  const base = emptyState();
  if (!input || typeof input !== 'object') return base;

  // Migrate the first MVP's single-day fields into a real date-keyed history.
  const entries = input.entries && typeof input.entries === 'object' ? { ...input.entries } : {};
  if (input.lastCheckin && !entries[input.lastCheckin]) {
    entries[input.lastCheckin] = {
      date: input.lastCheckin,
      mood: input.mood || 'calm',
      energy: Number.isFinite(input.energy) ? input.energy : 50,
      stress: Number.isFinite(input.stress) ? input.stress : 50,
      note: typeof input.journal === 'string' ? input.journal : '',
      routineCompleted: Array.isArray(input.routineCompleted) ? input.routineCompleted : [],
      focusSessions: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  Object.keys(entries).forEach((date) => {
    const entry = entries[date];
    if (!entry || typeof entry !== 'object') {
      delete entries[date];
      return;
    }
    entries[date] = {
      date,
      mood: MOODS.some((item) => item.key === entry.mood) ? entry.mood : 'calm',
      energy: Math.max(0, Math.min(100, Number.isFinite(entry.energy) ? entry.energy : 50)),
      stress: Math.max(0, Math.min(100, Number.isFinite(entry.stress) ? entry.stress : 50)),
      note: typeof entry.note === 'string' ? entry.note : '',
      routineCompleted: Array.isArray(entry.routineCompleted)
        ? entry.routineCompleted.filter((id) => ROUTINE_STEPS.some((step) => step.id === id))
        : [],
      focusSessions: Number.isFinite(entry.focusSessions) ? Math.max(0, entry.focusSessions) : 0,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString(),
    };
  });

  return {
    ...base,
    onboardingSeen: Boolean(input.onboardingSeen),
    focusMode: FOCUS_MODES.some((mode) => mode.key === input.focusMode) ? input.focusMode : base.focusMode,
    entries,
  };
}

function makeEntry(date, prior = {}) {
  return {
    date,
    mood: prior.mood || 'calm',
    energy: Number.isFinite(prior.energy) ? prior.energy : 50,
    stress: Number.isFinite(prior.stress) ? prior.stress : 50,
    note: typeof prior.note === 'string' ? prior.note : '',
    routineCompleted: Array.isArray(prior.routineCompleted) ? prior.routineCompleted : [],
    focusSessions: Number.isFinite(prior.focusSessions) ? prior.focusSessions : 0,
    updatedAt: new Date().toISOString(),
  };
}

function calculateStreak(entries, now = new Date()) {
  const dates = new Set(Object.keys(entries || {}));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (dates.has(localDateKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function lastSevenDays(entries, now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      entry: entries[key] || null,
    };
  });
}

function getInsight(entry) {
  if (!entry) return 'A check-in is a small moment to notice what you need.';
  if (entry.stress >= 70) return 'It may help to make the next step smaller, not push harder.';
  if (entry.energy <= 30) return 'Your energy is asking for a gentler pace. Rest is a valid next step.';
  if (entry.mood === 'good') return 'Notice what is helping today, and give yourself room to enjoy it.';
  if (entry.mood === 'overwhelmed') return 'You do not have to solve everything at once. Pick one thing to set down.';
  return 'You checked in with yourself. Let that be enough for this moment.';
}

function summarize(entries) {
  const values = Object.values(entries || {});
  const total = values.length;
  if (!total) return { total: 0, averageEnergy: null, averageStress: null, focusSessions: 0 };
  return {
    total,
    averageEnergy: Math.round(values.reduce((sum, item) => sum + item.energy, 0) / total),
    averageStress: Math.round(values.reduce((sum, item) => sum + item.stress, 0) / total),
    focusSessions: values.reduce((sum, item) => sum + item.focusSessions, 0),
  };
}

module.exports = {
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
};
