from __future__ import annotations

import uuid
import time

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .analyzer import PoseAnalyzer
from .config import settings
from .model_downloader import ensure_model
from .pose_rules import normalize_pose_name, EVALUATORS, evaluate_all
from .landmarks import Point

@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _model_ready
    try:
        ensure_model(); _model_ready=True
    except Exception as exc:
        print(f"[PosePerfect] Model download unavailable at startup: {exc}")
    yield

app=FastAPI(title="PosePerfect AI Coach Backend",version="1.0.0",lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=False,allow_methods=["*"],allow_headers=["*"])
_model_ready=False

class StartSessionRequest(BaseModel):
    pose_name:str

@app.get("/health")
def health():
    return {"ok":True,"model_ready":settings.model_path.exists(),"pose_model":settings.pose_model,"poses":list(EVALUATORS.keys())}

@app.post("/session/start")
def session_start(body:StartSessionRequest):
    pose=normalize_pose_name(body.pose_name)
    if pose not in EVALUATORS:
        raise HTTPException(status_code=400, detail=f"Unsupported pose: {body.pose_name}")
    return {"ok":True,"session_id":uuid.uuid4().hex,"pose":pose}

@app.post("/session/stop")
def session_stop():
    return {"ok":True}

@app.websocket("/ws/pose")
async def pose_socket(ws:WebSocket):
    await ws.accept()
    analyzer=None
    session_id=ws.query_params.get("session_id") or uuid.uuid4().hex
    pose_name=ws.query_params.get("pose") or "tree"
    try:
        pose_name=normalize_pose_name(pose_name)
        if pose_name not in EVALUATORS:
            await ws.send_json({"type":"error","message":f"Unsupported pose: {pose_name}"})
            await ws.close(code=1008); return
        await ws.send_json({"type":"ready","session_id":session_id,"pose":pose_name,"target_fps":settings.frame_target_fps})
        landmark_history=[]
        last_server_landmark_ts=0
        stable_since=None
        while True:
            packet=await ws.receive_json()
            packet_type=packet.get("type")
            if packet_type == "landmarks":
                raw_points=packet.get("landmarks") or []
                if len(raw_points) < 29:
                    continue
                now=time.perf_counter()
                if packet.get("timestamp_ms") and packet.get("timestamp_ms") <= last_server_landmark_ts:
                    continue
                last_server_landmark_ts=packet.get("timestamp_ms") or last_server_landmark_ts
                points=[Point(float(p.get("x",0)),float(p.get("y",0)),float(p.get("z",0)),float(p.get("visibility",1))) for p in raw_points[:33]]
                evaluations=evaluate_all(points)
                target=evaluations[pose_name]
                ranked=sorted(evaluations.items(), key=lambda kv: kv[1].score, reverse=True)
                matched_pose=ranked[0][0]
                wrong_pose=matched_pose != pose_name and ranked[0][1].score > target.score + 7
                score=min(target.score,55.0) if wrong_pose else target.score
                landmark_history.append(score)
                if len(landmark_history)>8: landmark_history.pop(0)
                smooth=sum(landmark_history)/len(landmark_history)
                identity=target.identity >= 0.72 and not wrong_pose
                if identity and smooth>=80:
                    if stable_since is None: stable_since=now
                else:
                    stable_since=None
                stable_seconds=now-stable_since if stable_since is not None else 0
                violations=target.violations[:]
                if wrong_pose:
                    display=matched_pose.replace('warrior2','Warrior II').title()
                    violations=[("wrong_pose",f"You are closer to {display}. Adjust toward {pose_name.replace('warrior2','Warrior II').title()}.")]
                await ws.send_json({
                    "type":"server_landmark_result", "session_id":session_id, "target_pose":pose_name,
                    "matched_pose":matched_pose, "score":round(max(0,min(100,smooth)),1),
                    "is_correct":stable_seconds>=settings.correct_stable_seconds,
                    "stable_seconds":round(stable_seconds,2), "message":violations[0][1] if violations else "Server-side pose rules agree.",
                    "client_ts":packet.get("timestamp_ms"),
                })
                continue
            if packet_type != "frame":
                continue
            image_b64=packet.get("image_b64")
            if not image_b64:
                continue
            if "," in image_b64 and image_b64.startswith("data:"):
                image_b64=image_b64.split(",",1)[1]
            import base64
            try:
                if analyzer is None:
                    analyzer=PoseAnalyzer(pose_name)
                jpeg=base64.b64decode(image_b64,validate=False)
                result=analyzer.analyze_jpeg(jpeg)
                result["session_id"]=session_id
                result["client_ts"]=packet.get("timestamp_ms")
                await ws.send_json(result)
            except Exception as exc:
                await ws.send_json({"type":"error","message":"Frame analysis failed. Please keep the whole body visible and try again.","detail":str(exc)[:240]})
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await ws.send_json({"type":"error","message":str(exc)[:300]})
            await ws.close(code=1011)
        except Exception:
            pass
    finally:
        if analyzer is not None:
            analyzer.close()

@app.get("/")
def root():
    return {"service":"PosePerfect AI Coach","docs":"/docs","health":"/health"}
