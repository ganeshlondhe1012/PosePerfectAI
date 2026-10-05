# v20 validation report

## Real-video diagnosis

The supplied yoga4.mp4 recording shows a stable full-body Cobra tracking session. Multiple frames around the stable pose display approximately 78–79% with the repeated feedback about palm placement. The body skeleton remains aligned, so the failure is classification rather than landmark acquisition.

## Rule fix

Cobra profile/front identity no longer requires hand placement as a hard correctness gate. Hand placement remains a low-weight quality metric. Core Cobra geometry gates are preserved.

## Automated validation

- Python backend tests: 31 passed
- TypeScript Cobra rule strict compile: passed
- Browser-style profile Cobra fixture with deliberately distorted/far hands: 89 / good=true / identity=true
- Canonical backend rules: passed
- Tree/Mountain/Warrior II/Triangle regression tests: passed
- ZIP hygiene: passed

## Expected user-visible behavior

A physically correct Cobra should now enter the existing 1.2-second stable-correct window even when the webcam projection makes the wrists look farther from the shoulders than a textbook side-view projection.
