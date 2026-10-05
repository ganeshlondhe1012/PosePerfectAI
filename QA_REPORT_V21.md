# PosePerfect AI v21 — QA Report

## Scope

This release upgrades the existing PosePerfect AI application without changing the FastAPI pose-analysis code or the existing browser pose-rule engine.

## Implemented

- English/Hindi UI and realtime TTS with per-pose language selection.
- Runtime Hindi voice availability detection and preferred device voice selection.
- One-tap TTS test on language controls.
- Pre-analysis pose preview using the actual pose asset, animated visual treatment, and alignment steps on both the pose page and camera start stage.
- Local account registration/login using AsyncStorage, with salted SHA-256 password hashes (raw passwords are not persisted).
- User-scoped favorites and session history.
- Real Profile/Library/Progress views backed by persisted local data.
- Existing browser MediaPipe realtime inference path preserved.
- Existing FastAPI backend preserved unchanged.
- Removed an unused legacy AI Coach component that explicitly described itself as demo-only.

## Automated checks

- Backend pytest suite: **31 passed**.
- Backend pytest suite repeated after final modifications: **31 passed**.
- TypeScript/TSX parser + binder: **0 diagnostics across 35 files**.
- `src/i18n.ts` + `src/types.ts` compiled independently with TypeScript.
- English/Hindi translation runtime sanity checks passed for Tree Pose, Start AI, profile fallback, and representative coaching corrections.
- Package JSON parses successfully; Expo Speech and Expo Crypto are pinned to SDK-57-compatible versions.
- Backend source diff against the supplied ZIP: **no backend files changed**.

## Full Expo build limitation in this environment

The sandbox could not complete `npm install` because external package registry access was unavailable/time-limited. Therefore a real Expo Metro/web production bundle could not be produced here. The project was validated with source parsing, targeted TypeScript compilation, package consistency checks, and the full backend test suite. After extracting the ZIP on the target Windows machine, run `npm install` and `npm run typecheck` before launching.

## Device/runtime notes

Hindi TTS quality depends on the speech voices exposed by the target browser/OS. The app requests `hi-IN` and selects a matching installed voice when available. If a Hindi voice is not available, the web coach visibly marks voice coaching as unavailable rather than silently pretending that English is Hindi.

The local account is intentionally not a production identity system: AsyncStorage is unencrypted local key-value storage. The stored credential is a salted password hash, not the plaintext password.
