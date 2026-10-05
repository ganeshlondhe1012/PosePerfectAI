# PosePerfect AI — replacement for Yoga-pose-coach

This repository root is the current PosePerfect AI Expo/React Native project, prepared to replace the previous Vite app in the `ganeshlondhe1012/Yoga-pose-coach` repository.

## Vercel

The browser app is a static Expo web export. Vercel should use:
- Build Command: `npx expo export --platform web`
- Output Directory: `dist`
- Install Command: `npm install`

The realtime browser pose engine runs locally in the browser; FastAPI is retained under `backend/` for local/native/backend use and is not required for the browser skeleton loop.

## Local web

```bash
npm install
npx expo start --web
```

## Production web build

```bash
npm run build:web
```

The build output is `dist/`.
