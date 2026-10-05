# PosePerfect AI — FastAPI backend

This backend provides low-latency pose landmarks and yoga-specific coaching for the five poses currently in the app:

- Tree
- Mountain
- Warrior II
- Triangle
- Cobra

It uses MediaPipe Pose Landmarker in VIDEO mode so the tracker can reuse temporal information between frames. The backend keeps one analyzer per WebSocket session, performs lightweight geometric scoring, smooths scores across 8 frames, and requires a stable correct pose before reporting `is_correct=true`.

## Windows setup

Use the v10 installer:

```powershell
.\setup_windows.bat
```

The installer uses `tools/setup_backend.py`; it does not use PowerShell setup scripts. It reuses an existing `.venv`, installs dependencies in four small stages, retries interrupted child commands, validates imports after every stage, runs `pip check`, and downloads the MediaPipe model.

Then:

```powershell
.\run_tests.bat
.\start_windows.bat
```

Health: `http://localhost:8000/health`
Swagger: `http://localhost:8000/docs`

The first setup downloads the selected MediaPipe `.task` model to `backend/models/`. Change `POSE_MODEL` to `full` in `backend/.env` when you want a more accuracy-oriented model at the cost of more compute.

The Expo client can connect automatically to the Metro host IP during development; you can also set `EXPO_PUBLIC_API_URL` explicitly.

## Test suite

The project test suite covers pose-rule separation, analyzer stability/wrong-pose gates, API/WebSocket contracts, critical visibility handling, and the v10 installer path.

## Dependency note

The analyzer decodes camera JPEGs with Pillow and passes RGB arrays to MediaPipe. MediaPipe's Windows wheel brings its required native OpenCV dependency; the application code does not call `cv2` directly.
