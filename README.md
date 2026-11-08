# Quiet

Quiet is a privacy-first wellbeing check-in app built with Expo and React Native. It helps you record how you feel, make space for a short reset, and review your own patterns. Your check-ins and notes are stored locally on your device; the app does not require an account or send them to a server.

> Quiet is a wellbeing aid, not medical care.

## Features

- Daily mood, energy, and stress check-ins
- A small reset checklist and guided breathing pause
- Focus timer with selectable session lengths
- Private journal notes saved locally
- Seven-day energy view, check-in history, and streaks
- Export and delete controls for local data
- Migration of older saved check-in formats

## Run the app

Requirements: Node.js and npm, plus the Expo Go app or an iOS/Android development environment.

```sh
npm install
npm start
```

Then use the Expo CLI prompts to open the app on a device, emulator, or web browser. Platform-specific commands are also available:

```sh
npm run ios
npm run android
npm run web
```

## Tests

Run the data and migration tests with:

```sh
npm run test:data
```

## Privacy and data

Quiet saves app state in on-device AsyncStorage. The **Privacy** screen lets you share a JSON backup or delete Quiet's saved state. Backups shared outside the app are no longer covered by Quiet's local-storage protections; store them carefully.

## Project structure

- `App.js` — Expo application and screens
- `src/quietData.cjs` — local data model, normalization, date helpers, and summaries
- `tests/quietData.test.cjs` — tests for data behavior and migration
