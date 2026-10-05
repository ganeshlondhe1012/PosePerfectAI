# v16 realtime implementation notes

The web coach intentionally does not depend on `@mediapipe/tasks-vision` inside Metro. MediaPipe Pose JS is loaded at runtime in the browser from the same jsDelivr pattern used by the supplied reference project.

Key performance rules:

1. Live `getUserMedia()` stream; no JPEG/base64 capture for browser inference.
2. MediaPipe Pose JS `modelComplexity: 1` and `smoothLandmarks: true`.
3. Exactly one in-flight `send({image: video})` call.
4. Prefer `requestVideoFrameCallback` for camera-frame scheduling, with `requestAnimationFrame` fallback; no artificial 24 FPS cap.
5. Draw skeleton immediately when MediaPipe invokes `onResults`.
6. React state is throttled; canvas drawing is not.
7. Score uses an 8-result moving average.
8. Correct state requires 1.2 seconds of continuous correct results.
9. Voice feedback is rate-limited so speech never blocks the inference loop.
10. FastAPI is optional/non-blocking for web inference.

Coordinate strategy:

- The `<video>` and `<canvas>` use identical layout and `object-fit: cover`.
- The canvas internal dimensions match the source camera dimensions.
- Mirrored front-camera coordinates use `1 - x` before drawing.
- This avoids an extra cover/crop transform layer that can cause overlay drift.
