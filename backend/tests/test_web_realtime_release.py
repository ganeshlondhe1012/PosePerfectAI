import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT.parent


def read(rel):
    return (APP_ROOT / rel).read_text(encoding='utf-8')


def test_web_realtime_component_uses_reference_style_direct_video():
    text = read('src/web/WebCameraCoach.web.tsx')
    for required in [
        '@mediapipe/pose@0.5.1675469404',
        'modelComplexity: 1',
        'smoothLandmarks: true',
        'minDetectionConfidence: 0.45',
        'minTrackingConfidence: 0.40',
        'detector.send({ image: video })',
        'navigator.mediaDevices.getUserMedia',
        'requestVideoFrameCallback',
        'scoreHistoryRef.current.length > 3',
        'smoothScore > GREEN_SCORE_THRESHOLD',
        'width: { ideal: 960, max: 1280 }',
        'const confirmed = smoothScore > GREEN_SCORE_THRESHOLD;',
    ]:
        assert required in text, required
    assert 'held >= 1.2' not in text
    assert 'takePictureAsync' not in text
    assert '@mediapipe/tasks-vision' not in text


def test_web_rules_cover_all_five_poses():
    text = read('src/web/yogaPoseRules.ts')
    for required in [
        "'tree'", "'mountain'", "'warrior2'", "'triangle'", "'cobra'",
        'export function comparePose',
        'function tree', 'function warrior2', 'function mountain',
        'function triangle', 'function cobra',
    ]:
        assert required in text, required


def test_web_camera_screen_routes_web_to_local_engine():
    text = read('src/screens/Camera/CameraScreen.tsx')
    assert "Platform.OS === 'web'" in text
    assert '<WebCameraCoach' in text


def test_backend_supports_lightweight_landmark_sync():
    text = (ROOT / 'app' / 'main.py').read_text(encoding='utf-8')
    assert 'packet_type == "landmarks"' in text
    assert 'server_landmark_result' in text
    assert 'analyzer=PoseAnalyzer(pose_name)' in text


def test_package_does_not_force_tasks_vision_through_metro():
    pkg = json.loads((APP_ROOT / 'package.json').read_text(encoding='utf-8'))
    assert '@mediapipe/tasks-vision' not in pkg.get('dependencies', {})
    assert '@mediapipe/pose' not in pkg.get('dependencies', {})
