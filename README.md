# PosePerfect AI — v21 Bilingual Local-First Yoga Coach

This release keeps the existing Expo/React Native app and FastAPI backend, but the **browser coaching path is rebuilt around the same core runtime pattern as the supplied Yoga Pose Coach reference**: direct `getUserMedia()` video, MediaPipe Pose JS loaded in the browser, one in-flight inference at a time, `requestAnimationFrame`, an 3-frame median score smoothing with an immediate >78 correct threshold.

The reference project uses MediaPipe Pose JS with `modelComplexity: 1`, `smoothLandmarks: true`, confidence thresholds around 0.45, and a single in-flight animation-frame loop. The browser path now uses a 3-result median score filter and immediately shows the correct/green state once the displayed score exceeds 78, eliminating the previous 1.2-second gate and reducing feedback latency.

## Run

### Backend

```powershell
cd backend
.\setup_windows.bat
.\run_tests.bat
.\start_windows.bat
```

Backend health: `http://127.0.0.1:8000/health`
Swagger: `http://127.0.0.1:8000/docs`

### Browser frontend

Open a second terminal at the project root:

```powershell
npm install
npx expo start --web
```

Use the `http://localhost:<port>` address printed by Expo and allow camera permission.

## v21 enhancements

This build adds the requested product-level features without changing the pose-rule engine or the browser realtime inference architecture:

- **English + Hindi coaching:** the selected language changes UI strings and realtime TTS. Hindi uses `hi-IN` and the runtime selects an installed Hindi voice when available. Voice availability is checked at runtime rather than hardcoding a device voice.
- **Per-pose language selection:** choose English or हिन्दी on the pose detail page before starting the session. The choice is saved locally on the device.
- **Pose preview before analysis:** every pose opens a themed live visual preview with the pose image and alignment steps. AI analysis starts only after the user presses Start Coaching. The browser model can load in the background while the preview is shown, avoiding an extra model-loading wait at the start.
- **Real local accounts:** register/login, username updates, sign-out, saved favorites and practice sessions are scoped to the signed-in local profile. Passwords are stored as salted SHA-256 hashes rather than plaintext passwords.
- **Real progress/profile data:** Profile, Library and Progress screens read the same persisted local data produced by coaching sessions.

### Local account storage note

The app is intentionally server-free for authentication. The local credential record is kept in AsyncStorage and contains the username plus a salted password hash; the raw password is not persisted. AsyncStorage itself is an unencrypted key-value store, so this should be treated as a local convenience account system, not as production identity/security infrastructure.

### Hindi voice note

Hindi TTS is selected using the `hi-IN` BCP 47 language code and the device/browser's available speech voices. The application detects whether a Hindi voice is available. Actual voice quality remains dependent on the installed operating-system/browser TTS engine and voice package.

## Supported poses

- Tree
- Mountain
- Warrior II
- Triangle
- Cobra

## Browser inference pipeline

```text
Browser webcam
      ↓
HTML <video> / getUserMedia
      ↓
MediaPipe Pose JS
(modelComplexity 1 + smoothLandmarks)
      ↓
one in-flight detector.send({ image: video })
      ↓
requestAnimationFrame loop
      ↓
33 normalized landmarks
      ↓
pose-specific geometry rules
      ↓
8-frame score smoothing
      ↓
1.2-second stable-correct confirmation
      ↓
canvas skeleton + immediate correction
```

**FastAPI is not placed in the per-frame browser inference path.** It remains available for session management, server-side validation, and future model/analytics work. This prevents camera coaching from waiting on a network round-trip for every frame.

## Rule design

Tree, Mountain, and Warrior II follow the structural rule style used by the supplied reference: pose identity comes from a set of geometric conditions, the score reflects quality, and a recognizable pose is allowed to tolerate normal few-pixel landmark variation.

Triangle and Cobra use the same architecture with pose-specific structural checks.

The engine provides immediate correction messages such as:

- Straighten your standing leg.
- Bend your knee and lift that foot.
- Bring both arms to shoulder height.
- Bring your feet closer together.
- Raise your upper arm.
- Keep your pelvis grounded.

## Why the browser path is local

The previous browser implementation sent captured JPEG/base64 frames through WebSocket to Python. That created unnecessary capture/encoding/network/decode/inference/response latency. v20 removes that dependency from the live skeleton path. The browser now receives camera frames directly and runs MediaPipe locally, so the skeleton and correction loop can operate at the pace the camera and CPU/GPU can sustain.

## Validation performed in this release

- Python backend test suite: 31 passed
- 30 TS/TSX source files parsed with TypeScript: 0 syntax diagnostics
- Web rule engine sanity fixtures: canonical Tree/Mountain/Warrior II/Triangle/Cobra tests passing; profile Cobra with distorted hand placement remains correct
- No `@mediapipe/tasks-vision` dependency
- No `takePictureAsync()` in the web inference component
- Release ZIP excludes `node_modules`, `.venv`, `__pycache__`, and `.pyc`

## Reference

The browser architecture was derived from the supplied GitHub project:
`https://github.com/ganeshlondhe1012/Yoga-pose-coach`

This project deliberately keeps the existing PosePerfect AI pages and navigation rather than replacing the application with the reference UI.


## v20 Cobra calibration

Cobra detection is intentionally lighter than Tree/Warrior II/Mountain because the pose has larger natural variation in chest lift, elbow bend, wrist placement and camera perspective. Core identity is driven by the body-defining geometry: broadly horizontal body, chest/head lift, long grounded lower body, and grounded pelvis. Hand and elbow placement are low-weight quality cues in webcam profile views so wrist projection/occlusion cannot block a physically correct Cobra. The existing 8-frame score smoothing and 1.2-second stable-correct confirmation are preserved.


### Realtime responsiveness update
The browser coach now schedules inference from `requestVideoFrameCallback` when available, uses a 960×540 target camera stream at up to 30 FPS, keeps MediaPipe Pose model complexity 1 for landmark quality, uses MediaPipe landmark smoothing, and reduces score smoothing to a 3-result median. The green state is immediate at scores above 78. The visible overlay draws the complete major-body skeleton, including shoulders, torso, arms, hips, knees, ankles, heels and feet.
