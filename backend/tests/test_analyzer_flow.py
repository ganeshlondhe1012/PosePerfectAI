import sys, types, io
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[1]))
# Minimal MediaPipe stub: analyzer construction is bypassed with __new__.
mp_stub=types.ModuleType('mediapipe'); sys.modules['mediapipe']=mp_stub
import numpy as np
from PIL import Image
import app.analyzer as az
from app.analyzer import PoseAnalyzer
from app.landmarks import Point, RIGHT_ANKLE
from .fixtures_rules import poses

class FakeImage:
    def __init__(self,*args,**kwargs): pass
class FakeMP:
    Image=FakeImage
    ImageFormat=types.SimpleNamespace(SRGB=1)
az.mp=FakeMP

class LM:
    def __init__(self,p): self.x=p.x; self.y=p.y; self.z=p.z; self.visibility=p.visibility
class Res:
    def __init__(self,p): self.pose_landmarks=[[LM(x) for x in p]]
class EmptyRes:
    pose_landmarks=[]
class FakeLandmarker:
    def __init__(self,p): self.p=p; self.calls=0
    def detect_for_video(self,*args): self.calls+=1; return Res(self.p)
    def close(self): pass



def test_analyzer_end_to_end_logic():
    img=Image.fromarray(np.zeros((240,320,3),dtype=np.uint8), "RGB")
    buf=io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    jpeg=buf.getvalue()
    PASS=FAIL=0
    def check(c,m):
     nonlocal PASS,FAIL
     if c: PASS+=1
     else: FAIL+=1; print('FAIL',m)

    class Clock:
     def __init__(self): self.t=1000.0; self.ms=1000000.0
     def perf_counter(self): self.t += .2; return self.t
     def time(self): self.ms += .2; return self.ms

    for name,p in poses.items():
     a=PoseAnalyzer.__new__(PoseAnalyzer)
     a.pose_name=name; a.landmarker=FakeLandmarker(p); a.frame_index=0; a.score_history=__import__('collections').deque(maxlen=8); a.stable_since=None; a.previous_points=None; a.last_timestamp=0; a.last_process_time=None; a.fps_ema=0.0
     old_time=az.time; az.time=Clock()
     try:
      results=[a.analyze_jpeg(jpeg) for _ in range(8)]
     finally:
      az.time=old_time
     final=results[-1]
     check(final['pose_detected'] is True,f'{name} pose detected')
     check(len(final['landmarks'])==33,f'{name} 33 landmarks')
     check(final['target_pose']==name,f'{name} target pose')
     check(final['matched_pose']==name,f'{name} matched pose {final["matched_pose"]}')
     check(final['score']>=80,f'{name} score {final["score"]}')
     check(final['pose_identity']>=.72,f'{name} identity {final["pose_identity"]}')
     check(final['is_correct'] is True,f'{name} stable correctness {final["stable_seconds"]}')
     check(final['critical_visibility']>=.35,f'{name} critical visibility')
     check(a.landmarker.calls==8,f'{name} landmarker call count')

    # no body
    b=PoseAnalyzer.__new__(PoseAnalyzer); b.pose_name='tree'; b.landmarker=type('L',(),{'detect_for_video':lambda self,*args:EmptyRes(),'close':lambda self:None})(); b.frame_index=0; b.score_history=__import__('collections').deque(maxlen=8); b.stable_since=None; b.previous_points=None; b.last_timestamp=0; b.last_process_time=None; b.fps_ema=0.0
    r=b.analyze_jpeg(jpeg)
    check(r['pose_detected'] is False,'no-body pose detection')
    check(r['score']==0,'no-body score')
    check(r['message_key']=='move_into_frame','no-body message')

    # malformed JPEG
    try:
     b.analyze_jpeg(b'not-jpeg')
     check(False,'malformed jpeg should raise')
    except ValueError:
     PASS+=1

    # visibility gate
    low=list(poses['tree']); low[RIGHT_ANKLE]=Point(low[RIGHT_ANKLE].x,low[RIGHT_ANKLE].y,low[RIGHT_ANKLE].z,0.1)
    b=PoseAnalyzer.__new__(PoseAnalyzer); b.pose_name='tree'; b.landmarker=FakeLandmarker(low); b.frame_index=0; b.score_history=__import__('collections').deque(maxlen=8); b.stable_since=None; b.previous_points=None; b.last_timestamp=0; b.last_process_time=None; b.fps_ema=0.0
    r=b.analyze_jpeg(jpeg)
    check(r['body_visible'] is False,'critical visibility should gate body')
    check(r['is_correct'] is False,'critical visibility should block correctness')


    # Wrong-pose guard: target tree, feed canonical mountain pose.
    w=PoseAnalyzer.__new__(PoseAnalyzer); w.pose_name='tree'; w.landmarker=FakeLandmarker(poses['mountain']); w.frame_index=0; w.score_history=__import__('collections').deque(maxlen=8); w.stable_since=None; w.previous_points=None; w.last_timestamp=0; w.last_process_time=None; w.fps_ema=0.0
    old_time=az.time; az.time=Clock()
    try:
        wrong_results=[w.analyze_jpeg(jpeg) for _ in range(3)]
    finally:
        az.time=old_time
    check(wrong_results[-1]['matched_pose']=='mountain','wrong-pose matched identity')
    check(wrong_results[-1]['is_correct'] is False,'wrong-pose cannot become correct')
    check(wrong_results[-1]['score'] <= 55,'wrong-pose score cap')
    check(wrong_results[-1]['message_key']=='wrong_pose','wrong-pose feedback key')

    # Stability reset: a correct sequence followed by a clear wrong pose must lose correctness.
    r=PoseAnalyzer.__new__(PoseAnalyzer); r.pose_name='tree'; r.landmarker=FakeLandmarker(poses['tree']); r.frame_index=0; r.score_history=__import__('collections').deque(maxlen=8); r.stable_since=None; r.previous_points=None; r.last_timestamp=0; r.last_process_time=None; r.fps_ema=0.0
    old_time=az.time; az.time=Clock()
    try:
        good=[r.analyze_jpeg(jpeg) for _ in range(8)]
    finally:
        az.time=old_time
    check(good[-1]['is_correct'] is True,'stability gate becomes correct')
    r.landmarker=FakeLandmarker(poses['mountain'])
    old_time=az.time; az.time=Clock()
    try:
        bad=r.analyze_jpeg(jpeg)
    finally:
        az.time=old_time
    check(bad['is_correct'] is False,'wrong pose resets stable correctness')
