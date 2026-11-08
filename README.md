# Quiet

Quiet is a private, local-first daily reset app for people who want a calm way to check in without creating an account.

## Product features
- Mood, energy, and stress check-ins stored by local calendar date
- Persistent check-in history, current streaks, and real trend summaries (no seeded/fabricated stats)
- Daily reset checklist and gentle breathing guide
- Configurable 5-, 10-, and 25-minute focus sessions with pause/resume and completion tracking
- Daily private journal notes with history
- Explicit JSON backup export and destructive local-data deletion controls
- First-run onboarding and migration of data from earlier MVP versions
- No authentication, analytics SDK, ads, or network service

## Run

```bash
npm install
npm start
```

Run the pure data-logic tests with Node.js 18 or newer:

```bash
npm run test:data
```

## Privacy notes
Quiet persists app data in AsyncStorage on this device. Exported backups are shared through the operating system and are outside the app's local protection. Removing the app may remove local data, depending on platform behavior. Quiet is a wellbeing aid, not a substitute for professional care.
