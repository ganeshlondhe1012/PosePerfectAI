from __future__ import annotations

import time
from collections import deque

import numpy as np
import mediapipe as mp
from PIL import Image

from .config import settings
from .landmarks import (
    Point, as_dict, avg_visibility,
    NOSE, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW,
    LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE,
    LEFT_ANKLE, RIGHT_ANKLE,
)
from .model_downloader import ensure_model
from .pose_rules import EVALUATORS, evaluate_all, normalize_pose_name

class PoseAnalyzer:
    def __init__(self, pose_name: str):
        self.pose_name = normalize_pose_name(pose_name)
        if self.pose_name not in EVALUATORS:
            raise ValueError(f"Unsupported pose: {pose_name}")
        model_path = ensure_model()
        base_options = mp.tasks.BaseOptions(model_asset_path=str(model_path))
        options = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=settings.min_detection_confidence,
            min_pose_presence_confidence=settings.min_presence_confidence,
            min_tracking_confidence=settings.min_tracking_confidence,
            output_segmentation_masks=False,
        )
        self.landmarker = mp.tasks.vision.PoseLandmarker.create_from_options(options)
        self.frame_index=0
        self.score_history: deque[float] = deque(maxlen=settings.score_smoothing_window)
        self.stable_since: float|None=None
        self.previous_points: list[Point]|None=None
        self.last_timestamp=0
        self.last_process_time: float|None=None
        self.fps_ema=0.0

    def close(self):
        try:
            self.landmarker.close()
        except Exception:
            pass

    def _smooth(self, points:list[Point])->list[Point]:
        if not self.previous_points:
            self.previous_points=points
            return points
        alpha=0.72
        smoothed=[]
        for old,new in zip(self.previous_points,points):
            smoothed.append(Point(
                x=old.x*(1-alpha)+new.x*alpha,
                y=old.y*(1-alpha)+new.y*alpha,
                z=old.z*(1-alpha)+new.z*alpha,
                visibility=new.visibility,
            ))
        self.previous_points=smoothed
        return smoothed

    def analyze_jpeg(self, jpeg: bytes) -> dict:
        started=time.perf_counter()
        try:
            with Image.open(__import__("io").BytesIO(jpeg)) as pil_image:
                rgb = np.asarray(pil_image.convert("RGB"), dtype=np.uint8)
        except Exception as exc:
            raise ValueError("Invalid JPEG frame") from exc
        mp_image=mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb)
        now_ms=int(time.time()*1000)
        if now_ms<=self.last_timestamp:
            now_ms=self.last_timestamp+1
        self.last_timestamp=now_ms
        result=self.landmarker.detect_for_video(mp_image,now_ms)
        if not result.pose_landmarks:
            self.score_history.clear(); self.stable_since=None; self.previous_points=None
            return {"type":"result","pose_detected":False,"body_visible":False,"score":0,"message_key":"move_into_frame","message":"Move your full body into the camera frame.","landmarks":[],"latency_ms":round((time.perf_counter()-started)*1000,1),"is_correct":False}
        raw=[]
        for lm in result.pose_landmarks[0]:
            raw.append(Point(float(lm.x),float(lm.y),float(getattr(lm,'z',0.0)),float(getattr(lm,'visibility',1.0))))
        points=self._smooth(raw)
        visibility=avg_visibility(points[11:33])
        required_indices = [
            NOSE, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW,
            LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE,
            LEFT_ANKLE, RIGHT_ANKLE,
        ]
        critical_visibility = min(points[i].visibility for i in required_indices)
        evaluations=evaluate_all(points)
        target=evaluations[self.pose_name]
        ranked=sorted(evaluations.items(),key=lambda kv:kv[1].score,reverse=True)
        matched_pose, best=ranked[0]
        pose_identity=max(0.0,min(1.0,target.identity))
        score=target.score
        wrong_pose = matched_pose != self.pose_name and best.score > score + 7
        if wrong_pose:
            score=min(score,55.0)
        self.score_history.append(score)
        smooth_score=sum(self.score_history)/len(self.score_history)
        now=time.perf_counter()
        if smooth_score>=80 and pose_identity>=0.72 and not wrong_pose:
            if self.stable_since is None: self.stable_since=now
        else:
            self.stable_since=None
        stable_seconds=(now-self.stable_since) if self.stable_since is not None else 0
        correct=stable_seconds>=settings.correct_stable_seconds
        violations=target.violations[:]
        if wrong_pose:
            violations=[("wrong_pose",f"You are closer to {matched_pose.replace('warrior2','Warrior II').title()}. Adjust toward {self.pose_name.replace('warrior2','Warrior II').title()}.")]
        message_key=violations[0][0] if violations else "hold"
        message=violations[0][1] if violations else "Great alignment — hold the pose and breathe steadily."
        body_visible=visibility>=0.52 and critical_visibility>=0.35
        if not body_visible:
            message_key="visibility"; message="Keep your whole body visible and make sure your arms, knees, and ankles are clearly visible."
            correct=False
        elif not violations and (pose_identity < 0.72 or smooth_score < 80):
            message_key="alignment"; message="Refine your alignment and hold steady until the pose becomes stable."
        now_wall=time.perf_counter()
        if self.last_process_time is not None:
            dt=max(1e-3, now_wall-self.last_process_time)
            instant_fps=min(30.0,1.0/dt)
            self.fps_ema=instant_fps if self.fps_ema<=0 else self.fps_ema*0.75+instant_fps*0.25
        self.last_process_time=now_wall
        inference_ms=(now_wall-started)*1000
        return {
            "type":"result","pose_detected":True,"body_visible":body_visible,
            "target_pose":self.pose_name,"matched_pose":matched_pose,
            "pose_identity":round(pose_identity,3),"score":round(max(0,min(100,smooth_score)),1),
            "raw_score":round(score,1),"message_key":message_key,"message":message,
            "is_correct":correct,"stable_seconds":round(stable_seconds,2),
            "landmarks":as_dict(points),"latency_ms":round(inference_ms,1),
            "quality":round(min(visibility, critical_visibility),3),
            "critical_visibility":round(critical_visibility,3),
            "server_fps":round(self.fps_ema,1),
        }
