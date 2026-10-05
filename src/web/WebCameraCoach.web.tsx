import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import { speakText, getSpeechAvailability } from '../services/speech';
import { localizeCoachText, localizePose, t } from '../i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { YogaPose } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useApp } from '../context/AppContext';
import { CONNECTIONS, TRACKED, GREEN_SCORE_THRESHOLD, Point, PoseName, bodyIsUsable, comparePose, pointConfidence, usablePoint } from './yogaPoseRules';
const yogaPoseNames: Record<string, {en:string;hi:string}> = { tree:{en:'Tree Pose',hi:'वृक्षासन'}, warrior2:{en:'Warrior II',hi:'वीरभद्रासन II'}, mountain:{en:'Mountain Pose',hi:'ताड़ासन'}, triangle:{en:'Triangle Pose',hi:'त्रिकोणासन'}, cobra:{en:'Cobra Pose',hi:'भुजंगासन'} };
import './webCameraCoach.css';

declare global {
  interface Window {
    Pose?: any;
  }
}

type Props = { pose: YogaPose };
type Nav = NativeStackNavigationProp<RootStackParamList>;
type State = 'idle' | 'no-body' | 'almost' | 'correct';

type Attempt = { pose: PoseName; score: number; at: string };
type VideoWithFrameCallbacks = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const MEDIAPIPE_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';
const HISTORY_KEY = 'poseperfect-realtime-attempts-v6';
let mediaPipePromise: Promise<void> | null = null;

function loadMediaPipe(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('MediaPipe Pose is available only on web.'));
  if (window.Pose) return Promise.resolve();
  if (mediaPipePromise) return mediaPipePromise;
  mediaPipePromise = new Promise((resolve, reject) => {
    const old = document.querySelector('script[data-poseperfect-mediapipe]') as HTMLScriptElement | null;
    if (old) {
      old.addEventListener('load', () => resolve(), { once: true });
      old.addEventListener('error', () => reject(new Error('Could not load MediaPipe Pose.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `${MEDIAPIPE_BASE}pose.js`;
    script.async = true;
    script.dataset.poseperfectMediapipe = 'true';
    script.onload = () => window.Pose ? resolve() : reject(new Error('MediaPipe Pose loaded without window.Pose.'));
    script.onerror = () => reject(new Error('Could not download MediaPipe Pose from jsDelivr.'));
    document.head.appendChild(script);
  });
  return mediaPipePromise;
}

function drawSkeleton(ctx: CanvasRenderingContext2D, points: Point[], correct: boolean, canvasWidth: number, canvasHeight: number) {
  if (!points || points.length < 33) return;
  const main = correct ? '#20e07a' : '#ff5361';
  const glow = correct ? 'rgba(32,224,122,.42)' : 'rgba(255,83,97,.30)';
  const sx = canvasWidth;
  const sy = canvasHeight;
  // The video is mirrored with CSS, so mirror the landmark X coordinate in the
  // canvas rather than applying a second CSS transform to the overlay. This
  // keeps the skeleton attached to the user's body in both mirrored and
  // object-fit-cover layouts.
  const map = (p: Point) => ({ x: (1 - p.x) * sx, y: p.y * sy });
  const confidenceFor = (p: Point) => pointConfidence(p);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'source-over';
  CONNECTIONS.forEach(([a, b]) => {
    const pa = points[a], pb = points[b];
    if (!usablePoint(pa) || !usablePoint(pb)) return;
    // Use a slightly stronger visibility gate for lines than the body-usable
    // gate. This avoids drawing unstable floating segments from low-confidence
    // joints while still allowing partially occluded limbs to remain visible.
    if (confidenceFor(pa) < 0.18 || confidenceFor(pb) < 0.18) return;
    const A = map(pa), B = map(pb);
    ctx.strokeStyle = main;
    ctx.lineWidth = Math.max(3.5, sx / 285);
    ctx.shadowBlur = correct ? 10 : 7;
    ctx.shadowColor = glow;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  });
  TRACKED.forEach(i => {
    const p = points[i];
    if (!usablePoint(p) || confidenceFor(p) < 0.18) return;
    const P = map(p);
    ctx.shadowBlur = correct ? 9 : 7;
    ctx.shadowColor = glow;
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.arc(P.x, P.y, Math.max(4, sx / 135), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.86;
    ctx.beginPath();
    ctx.arc(P.x, P.y, Math.max(1.3, sx / 430), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function WebCameraCoach({ pose }: Props) {
  const navigation = useNavigation<Nav>();
  const { addSession, language, currentUser } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseEngineRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const videoFrameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const inFlightRef = useRef(false);
  const selectedPoseRef = useRef<PoseName>(pose.id as PoseName);
  const scoreHistoryRef = useRef<number[]>([]);
  const liveScoreRef = useRef(0);
  const bestScoreRef = useRef(0);
  const detectedFrameCountRef = useRef(0);
  const recordedRef = useRef(false);
  const attemptHistoryRef = useRef<Attempt[]>([]);
  const lastSpeechRef = useRef({ text: '', at: 0 });
  const fpsTimesRef = useRef<number[]>([]);
  const startAtRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef(0);
  const frameResultsRef = useRef(0);
  const inferenceStartedAtRef = useRef<number | null>(null);
  const voiceRef = useRef(true);
  const languageRef = useRef(language);

  const medianScore = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };

  const [modelReady, setModelReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [detected, setDetected] = useState(false);
  const [score, setScore] = useState(0);
  const [good, setGood] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState(`Ready for ${pose.title}.`);
  const [correction, setCorrection] = useState('');
  const [error, setError] = useState('');
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [voice, setVoice] = useState(true);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const historyKey = currentUser ? `${HISTORY_KEY}:${currentUser.id}` : HISTORY_KEY;

  useEffect(() => { selectedPoseRef.current = pose.id as PoseName; }, [pose.id]);
  useEffect(() => { voiceRef.current = voice; }, [voice]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => {
    getSpeechAvailability(language).then(status => setSpeechAvailable(status.supported && (language === 'en' || status.exactVoice))).catch(() => setSpeechAvailable(false));
  }, [language]);

  const speak = useCallback((text: string) => {
    if (!voiceRef.current || !text) return;
    const now = performance.now();
    const last = lastSpeechRef.current;
    if (last.text === text && now - last.at < 3200) return;
    if (now - last.at < 1800) return;
    lastSpeechRef.current = { text, at: now };
    const localized = localizeCoachText(text, languageRef.current, pose.title);
    void speakText(localized, languageRef.current, { rate: languageRef.current === 'hi' ? 0.92 : 0.96, volume: 0.92 });
  }, [pose.title]);

  const drawFrame = useCallback((points: Point[] | undefined, isCorrect: boolean) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (points) drawSkeleton(ctx, points, isCorrect, width, height);
  }, []);

  const stopCamera = useCallback((save = false) => {
    runningRef.current = false;
    inFlightRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const activeVideo = videoRef.current as VideoWithFrameCallbacks | null;
    if (activeVideo && videoFrameRef.current !== null && typeof activeVideo.cancelVideoFrameCallback === 'function') {
      try { activeVideo.cancelVideoFrameCallback(videoFrameRef.current); } catch {}
    }
    videoFrameRef.current = null;
    streamRef.current?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    if (poseEngineRef.current) {
      try { poseEngineRef.current.close?.(); } catch {}
    }
    poseEngineRef.current = null;
    setRunning(false);
    setDetected(false);
    setGood(false);
    setState('idle');
    setScore(0);
    setCorrection('');
    setFps(0);
    inferenceStartedAtRef.current = null;
    setLatencyMs(0);
    if (!save) setMessage(t(languageRef.current, 'cameraStopped'));
    else setMessage(t(languageRef.current, 'sessionSaved'));
  }, []);

  const loadModel = useCallback(async () => {
    if (poseEngineRef.current) { setModelReady(true); return; }
    try {
      setError('');
      setMessage(t(languageRef.current, 'loadingModel'));
      await loadMediaPipe();
      const detector = new window.Pose({ locateFile: (file: string) => `${MEDIAPIPE_BASE}${file}` });
      detector.setOptions({
        modelComplexity: 1, // Full model for landmark accuracy; camera input is capped at 960x540 for latency.
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.45,
        minTrackingConfidence: 0.40,
      });
      detector.onResults((results: any) => {
        inFlightRef.current = false;
        frameResultsRef.current += 1;
        const now = performance.now();
        if (inferenceStartedAtRef.current !== null) {
          const measured = Math.round(now - inferenceStartedAtRef.current);
          if (now - lastUiUpdateRef.current >= 100) setLatencyMs(measured);
        }
        inferenceStartedAtRef.current = null;
        fpsTimesRef.current.push(now);
        while (fpsTimesRef.current.length && now - fpsTimesRef.current[0] > 1000) fpsTimesRef.current.shift();
        if (now - lastUiUpdateRef.current >= 100) {
          lastUiUpdateRef.current = now;
          setFps(fpsTimesRef.current.length);
        }
        if (!runningRef.current) return;
        const points = Array.isArray(results?.poseLandmarks) ? results.poseLandmarks as Point[] : undefined;
        if (!points || points.length < 33 || !bodyIsUsable(points)) {
          setDetected(false);
          setGood(false);
          setState('no-body');
          setScore(0);
          setCorrection('');
          setMessage(localizeCoachText('Step back until your head, hands, knees and feet are visible.', languageRef.current));
          drawFrame(points, false);
          return;
        }
        setDetected(true);
        detectedFrameCountRef.current += 1;
        const evaluation = comparePose(selectedPoseRef.current, points);
        // Three-sample median filtering removes single-frame landmark/score
        // spikes without the large 8-frame averaging delay of the old pipeline.
        scoreHistoryRef.current.push(evaluation.score);
        if (scoreHistoryRef.current.length > 3) scoreHistoryRef.current.shift();
        const smoothScore = medianScore(scoreHistoryRef.current);
        liveScoreRef.current = smoothScore;
        bestScoreRef.current = Math.max(bestScoreRef.current, smoothScore);
        const topCorrection = evaluation.corrections[0] || `Adjust your ${pose.title}.`;
        setCorrection(topCorrection);

        // Green is intentionally immediate once the displayed score is >78.
        // Do not add a separate identity gate or 1.2 s hold timer: those created
        // the exact user-visible bug where 90–95% stayed red.
        const confirmed = smoothScore > GREEN_SCORE_THRESHOLD;
        setScore(smoothScore);
        setGood(confirmed);
        setState(confirmed ? 'correct' : 'almost');
        setMessage(localizeCoachText(confirmed ? '✓ Correct pose. Hold steady.' : evaluation.identity ? 'Almost correct. Make the final adjustment.' : topCorrection, languageRef.current, pose.title));
        drawFrame(points, confirmed);

        if (confirmed && !recordedRef.current) {
          recordedRef.current = true;
          const attempt = { pose: selectedPoseRef.current, score: smoothScore, at: new Date().toLocaleTimeString() };
          attemptHistoryRef.current = [attempt, ...attemptHistoryRef.current].slice(0, 20);
          setHistory(attemptHistoryRef.current);
          try { localStorage.setItem(historyKey, JSON.stringify(attemptHistoryRef.current)); } catch {}
          speak('Correct pose. Hold steady.');
        } else if (!confirmed) {
          recordedRef.current = false;
          speak(topCorrection);
        }
      });
      poseEngineRef.current = detector;
      setModelReady(true);
      setMessage(t(languageRef.current, 'ready'));
    } catch (e) {
      setModelReady(false);
      setError(`Pose model failed to load: ${e instanceof Error ? e.message : String(e)}`);
      setMessage(languageRef.current === 'hi' ? 'रीयलटाइम मुद्रा मॉडल लोड नहीं हो सका।' : 'Could not load the realtime pose model.');
    }
  }, [drawFrame, pose.title, speak]);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const detector = poseEngineRef.current;
    if (!runningRef.current || !video || !detector) return;

    if (video.readyState >= 2 && video.videoWidth > 0 && !inFlightRef.current) {
      inFlightRef.current = true;
      inferenceStartedAtRef.current = performance.now();
      try {
        const maybePromise = detector.send({ image: video });
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch((e: unknown) => {
            inFlightRef.current = false;
            inferenceStartedAtRef.current = null;
            setError(`Pose inference error: ${e instanceof Error ? e.message : String(e)}`);
          });
        }
      } catch (e) {
        inFlightRef.current = false;
        inferenceStartedAtRef.current = null;
        setError(`Pose inference error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Prefer requestVideoFrameCallback so inference is scheduled from the actual
    // camera frame cadence instead of waiting for a display repaint. Fall back
    // to requestAnimationFrame for older browsers.
    const frameVideo = video as VideoWithFrameCallbacks;
    if (typeof frameVideo.requestVideoFrameCallback === 'function') {
      videoFrameRef.current = frameVideo.requestVideoFrameCallback(() => {
        processFrame();
      });
    } else {
      rafRef.current = requestAnimationFrame(() => processFrame());
    }
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    setError('');
    await loadModel();
    if (!poseEngineRef.current) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable. Use localhost or HTTPS.');
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960, max: 1280 }, height: { ideal: 540, max: 720 }, frameRate: { ideal: 30, max: 30 } },
        audio: false,
      }).catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
      const video = videoRef.current;
      if (!video) throw new Error('Camera preview is unavailable.');
      streamRef.current = stream;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      if (!video.videoWidth || !video.videoHeight) throw new Error('Camera opened without video dimensions.');
      runningRef.current = true;
      inFlightRef.current = false;
      scoreHistoryRef.current = [];
        recordedRef.current = false;
      fpsTimesRef.current = [];
      lastUiUpdateRef.current = 0;
      startAtRef.current = Date.now();
      setRunning(true);
      setDetected(false);
      setGood(false);
      setScore(0);
      liveScoreRef.current = 0;
      bestScoreRef.current = 0;
      detectedFrameCountRef.current = 0;
      setFps(0);
      setLatencyMs(0);
      setElapsed(0);
      setState('no-body');
      setCorrection('');
      setMessage(languageRef.current === 'hi' ? `${pose.title} की स्थिति में आएँ।` : `Get into ${pose.title}.`);
      speak(`${pose.title}. ${pose.steps.slice(0, 3).join('. ')}`);

      // Session telemetry is deliberately non-blocking. The browser never waits for FastAPI
      // before starting local inference.
      try { await import('../services/api').then(({ startSession }) => startSession(pose.id)); } catch {}
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      processFrame();
    } catch (e) {
      stopCamera(false);
      setError(`Camera error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [loadModel, pose.id, pose.steps, pose.title, processFrame, speak, stopCamera, language]);

  const stop = useCallback(async () => {
    const duration = startAtRef.current ? Math.max(1, Math.round((Date.now() - startAtRef.current) / 1000)) : elapsed;
    const finalScore = Math.max(liveScoreRef.current, bestScoreRef.current, score);
    if (duration >= 1 && detectedFrameCountRef.current > 0) addSession({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      poseId: pose.id,
      poseTitle: pose.title,
      score: Math.round(finalScore),
      durationSeconds: duration,
      feedback: message,
      createdAt: new Date().toISOString(),
      language,
    });
    try { const { stopSession } = await import('../services/api'); await stopSession(); } catch {}
    stopCamera(true);
  }, [addSession, elapsed, language, message, pose.id, pose.title, score, stopCamera]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(historyKey) || '[]');
      if (Array.isArray(stored)) { attemptHistoryRef.current = stored; setHistory(stored); }
    } catch {}
    loadModel();
    return () => stopCamera(false);
  }, [currentUser?.id, historyKey, loadModel, stopCamera]);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setElapsed(v => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const recent = history.slice(0, 5);
  const icon = pose.id === 'tree' ? '🌿' : pose.id === 'warrior2' ? '🧘' : pose.id === 'cobra' ? '🐍' : '🧍';
  const localizedPose = localizePose(pose, language);
  const demoImage = (() => { try { return Image.resolveAssetSource(localizedPose.image)?.uri; } catch { return undefined; } })();
  const status = good ? t(language, 'correct') : state === 'almost' ? t(language, 'almost') : detected ? t(language, 'adjust') : t(language, 'waiting');

  return (
    <div className="coach-app">
      <header className="coach-header">
        <button className="back-btn" onClick={() => navigation.goBack()} aria-label="Back">←</button>
        <div><strong>PosePerfect AI</strong><span>{t(language,'realtimeLocal')}</span></div>
        <span className={`ready-pill ${modelReady ? 'ready' : ''}`}>{modelReady ? t(language,'ready').toUpperCase() : t(language,'loadingModel').replace('…','').toUpperCase()}</span>
      </header>

      <main className="coach-main">
        <section className="coach-side">
          <span className="eyebrow">{t(language,'currentPose')}</span>
          <h1>{icon} {pose.title}</h1>
          <p>{localizedPose.description}</p>
          <div className="step-list">{pose.steps.slice(0, 4).map((s, i) => <div className="step" key={s}><b>{i + 1}</b><span>{s}</span></div>)}</div>
          <label className={`voice-toggle ${!speechAvailable ? 'voice-unavailable' : ''}`}><input type="checkbox" checked={voice} disabled={!speechAvailable} onChange={e => setVoice(e.target.checked)} /><span>{t(language,'voiceCoaching')}</span><em>{!speechAvailable ? t(language,'voiceUnavailable') : voice ? t(language,'on') : t(language,'off')}</em></label>
          {error && <div className="error-box">{error}</div>}
          <button className={`start-btn ${running ? 'stop-btn' : ''}`} onClick={running ? stop : start} disabled={!modelReady && !running}>
            {running ? t(language,'stopSession') : t(language,'startAI')}
          </button>
          <div className="telemetry">
            <span>{t(language,'camera')}</span><b>{running ? t(language,'live') : t(language,'off')}</b>
            <span>{t(language,'tracking')}</span><b>{detected ? t(language,'bodyTracked') : t(language,'searching')}</b>
            <span>{t(language,'inference')}</span><b>{fps > 0 ? `${fps} FPS` : '—'}</b>
            <span>Latency</span><b>{latencyMs > 0 ? `${latencyMs} ms` : '—'}</b>
            <span>{t(language,'time')}</span><b>{formatTime(elapsed)}</b>
          </div>
          {recent.length > 0 && <div className="history"><h3>{t(language,'recentSessions')}</h3>{recent.map((item, i) => <div key={i} className="history-row"><span>{yogaPoseNames[item.pose]?.[language] ?? item.pose}</span><b>{item.score}%</b><small>{item.at}</small></div>)}</div>}
        </section>

        <section className="coach-stage">
          <div className="video-frame">
            <video ref={videoRef} muted playsInline autoPlay />
            <canvas ref={canvasRef} />
            {running && <div className={`live-badge ${detected ? 'tracked' : ''} ${good ? 'correct' : ''}`}><i />{t(language,'live')} • {detected ? t(language,'bodyTracked') : t(language,'searching')}</div>}
            <div className="score-badge"><span>MATCH</span><strong className={good ? 'good' : ''}>{score}%</strong></div>
            <div className={`pose-badge ${good ? 'good' : ''}`}><span>{icon}</span><div><b>{pose.title}</b><small>{status}</small></div></div>
            <div className="coach-message"><b>{good ? t(language,'correctAlignment') : message}</b>{!good && correction && <span>{correction}</span>}</div>
            {!running && <div className="start-overlay"><div className="demo-stage">{demoImage && <img className="demo-pose-image" src={demoImage} alt={localizedPose.title} />}<span className="demo-tag">{t(language,'livePosePreview')}</span><strong>{t(language,'readyFor')} {localizedPose.title}</strong><p>{t(language,'previewText')} {t(language,'startLocalText')}</p><div className="demo-steps">{localizedPose.steps.slice(0,4).map((step,index)=><div key={`${localizedPose.id}-${index}`}><b>{index+1}</b><span>{step}</span></div>)}</div><button onClick={start} disabled={!modelReady}>{modelReady ? t(language,'startAI') : t(language,'loadingModel')}</button></div></div>}
          </div>
          <div className="status-strip"><div><span>{t(language,'currentPose')}</span><b>{localizedPose.title}</b></div><div><span>{t(language,'match')}</span><b className={good ? 'green' : 'red'}>{score}%</b></div><div><span>{t(language,'status')}</span><b className={good ? 'green' : ''}>{good ? t(language,'correct') : state === 'almost' ? t(language,'almost') : detected ? t(language,'adjust') : t(language,'waiting')}</b></div></div>
        </section>
      </main>
    </div>
  );
}
