# PosePerfect AI v20 — Cobra Real-Video Fix

## Why v20 exists

The supplied real Cobra recording showed the full body and landmarks tracking correctly at realtime FPS, but the app stayed around 78–79% and never reached the green stable-correct state. The repeated visible correction was wrist/hand placement.

The previous Cobra identity rule made hand placement a hard gate. That is too brittle for a side/profile webcam view because MediaPipe can project the far wrist poorly or shift the visible wrist under perspective even when the actual Cobra geometry is correct.

## v20 behavior

Cobra correctness is now driven by core body geometry:

- body axis is broadly horizontal;
- chest is lifted;
- head/chest line is lifted;
- the lower body is long/grounded;
- hips remain grounded.

Hand placement and exact elbow placement remain low-weight coaching metrics and can still generate correction guidance when the core pose is not yet correct, but they cannot block a genuinely correct profile Cobra from becoming green.

The same policy is applied to the Python backend evaluator for consistency.

## Realtime behavior

The v16/v17/v18/v19 realtime browser architecture is preserved: local browser pose inference, one inference in flight, score smoothing, and the stable-correct hold. v20 only changes Cobra classification/scoring.
