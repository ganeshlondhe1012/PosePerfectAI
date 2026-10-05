import sys, types
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[1]))

# Avoid requiring the model during API contract tests.
sys.modules['mediapipe'] = types.ModuleType('mediapipe')

from fastapi.testclient import TestClient
import app.main as main

main.ensure_model = lambda: main.settings.model_path

class FakeAnalyzer:
    def __init__(self, pose): self.pose = pose
    def analyze_jpeg(self, jpeg):
        if jpeg == b'bad': raise ValueError('bad frame')
        return {
            'type':'result','pose_detected':True,'body_visible':True,
            'target_pose':self.pose,'matched_pose':self.pose,'pose_identity':0.95,
            'score':92,'raw_score':93,'message_key':'hold','message':'Great alignment',
            'is_correct':True,'stable_seconds':1.5,
            'landmarks':[{'x':0.5,'y':0.5,'z':0,'visibility':1}]*33,
            'latency_ms':5.0,'quality':0.99,'critical_visibility':0.99,'server_fps':6.0,
        }
    def close(self): pass

main.PoseAnalyzer = FakeAnalyzer
client = TestClient(main.app)


def test_rest_contract():
    r = client.get('/')
    assert r.status_code == 200 and r.json()['service'] == 'PosePerfect AI Coach'
    r = client.get('/health')
    assert r.status_code == 200
    assert set(r.json()['poses']) == {'tree','mountain','warrior2','triangle','cobra'}
    r = client.post('/session/start', json={'pose_name':'Tree Pose'})
    assert r.status_code == 200 and r.json()['ok'] is True and r.json()['pose'] == 'tree'
    assert len(r.json()['session_id']) == 32
    r = client.post('/session/start', json={'pose_name':'does_not_exist'})
    assert r.status_code == 400
    assert r.json()['detail'].startswith('Unsupported pose')
    r = client.post('/session/stop')
    assert r.status_code == 200 and r.json()['ok'] is True


def test_websocket_ready_result_and_errors():
    with client.websocket_connect('/ws/pose?pose=tree&session_id=test123') as ws:
        ready = ws.receive_json()
        assert ready['type'] == 'ready'
        assert ready['pose'] == 'tree'
        assert ready['target_fps'] > 0
        ws.send_json({'type':'frame','image_b64':'aGVsbG8=','timestamp_ms':123})
        result = ws.receive_json()
        assert result['type'] == 'result'
        assert result['session_id'] == 'test123'
        assert result['score'] == 92
        assert len(result['landmarks']) == 33

    with client.websocket_connect('/ws/pose?pose=tree') as ws:
        ws.receive_json()
        ws.send_json({'type':'frame','image_b64':'YmFk','timestamp_ms':124})
        err = ws.receive_json()
        assert err['type'] == 'error'


def test_websocket_rejects_unknown_pose():
    with client.websocket_connect('/ws/pose?pose=badpose') as ws:
        msg = ws.receive_json()
        assert msg['type'] == 'error'


def test_websocket_reports_fatal_analyzer_start_failure():
    class FailingAnalyzer(FakeAnalyzer):
        def __init__(self, pose): raise RuntimeError('model unavailable')
    main.PoseAnalyzer = FailingAnalyzer
    try:
        with client.websocket_connect('/ws/pose?pose=tree') as ws:
            ready = ws.receive_json()
            assert ready['type'] == 'ready'
            ws.send_json({'type':'frame','image_b64':'aGVsbG8=','timestamp_ms':125})
            msg = ws.receive_json()
            assert msg['type'] == 'error'
    finally:
        main.PoseAnalyzer = FakeAnalyzer


def test_websocket_accepts_landmark_telemetry_without_starting_model():
    from app.landmarks import Point
    from tests.fixtures_rules import poses
    original = main.PoseAnalyzer
    class ExplodingAnalyzer(FakeAnalyzer):
        def __init__(self, pose): raise AssertionError('server image model should stay idle for landmark telemetry')
    main.PoseAnalyzer = ExplodingAnalyzer
    try:
        with client.websocket_connect('/ws/pose?pose=tree&session_id=landmarktest') as ws:
            ready = ws.receive_json()
            assert ready['type'] == 'ready'
            points = [{'x':p.x,'y':p.y,'z':p.z,'visibility':p.visibility} for p in poses['tree']]
            ws.send_json({'type':'landmarks','landmarks':points,'timestamp_ms':999})
            result = ws.receive_json()
            assert result['type'] == 'server_landmark_result'
            assert result['target_pose'] == 'tree'
            assert result['matched_pose'] == 'tree'
            assert result['score'] >= 80
    finally:
        main.PoseAnalyzer = original
