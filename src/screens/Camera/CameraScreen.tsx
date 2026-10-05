import React, { useEffect, useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { localizeCoachText, localizePose, t } from '../../i18n';
import { speakText } from '../../services/speech';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Line } from 'react-native-svg';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useApp } from '../../context/AppContext';
import { AIResult, PoseLandmark } from '../../types';
import { createPoseWebSocket, startSession, stopSession } from '../../services/api';
import WebCameraCoach from '../../web/WebCameraCoach';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Camera'>;

type Connection = [number, number];
const CONNECTIONS: Connection[] = [
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32], [0, 11], [0, 12], [0, 7], [0, 8], [7, 11], [8, 12],
];


function drawSkeleton(landmarks: PoseLandmark[] | undefined, mirror: boolean, correct: boolean) {
  if (!landmarks || landmarks.length < 33) return null;
  const color = correct ? '#00ff8a' : '#ff5d5d';
  const point = (index: number) => {
    const p = landmarks[index];
    if (!p) return null;
    const visibility = p.visibility ?? 1;
    if (visibility < 0.35) return null;
    return { x: mirror ? 1 - p.x : p.x, y: p.y };
  };
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      {CONNECTIONS.map(([a, b], i) => {
        const p1 = point(a);
        const p2 = point(b);
        if (!p1 || !p2) return null;
        return (
          <Line
            key={`l${i}`}
            x1={`${p1.x * 100}%`} y1={`${p1.y * 100}%`}
            x2={`${p2.x * 100}%`} y2={`${p2.y * 100}%`}
            stroke={color} strokeWidth="4" strokeLinecap="round" opacity={0.92}
          />
        );
      })}
      {landmarks.map((_, i) => {
        const p = point(i);
        if (!p) return null;
        return <Circle key={`p${i}`} cx={`${p.x * 100}%`} cy={`${p.y * 100}%`} r="4.5" fill="#fff" stroke={color} strokeWidth="2" />;
      })}
    </Svg>
  );
}

function NativeCameraScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { pose } = route.params;
  const { addSession, language } = useApp();
  const localizedPose = localizePose(pose, language);
  const lastSpeechRef = useRef({ text: '', at: 0 });
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [cameraReady, setCameraReady] = useState(false);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<AIResult | null>(null);
  const [sound, setSound] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [backendLabel, setBackendLabel] = useState('Connecting to AI backend…');
  const [analysisFps, setAnalysisFps] = useState(0);

  useEffect(() => {
    if (!sound || !result?.message) return;
    const text = localizeCoachText(result.message, language, localizedPose.title);
    const now = Date.now();
    if (text === lastSpeechRef.current.text && now - lastSpeechRef.current.at < 3200) return;
    if (now - lastSpeechRef.current.at < 1800) return;
    lastSpeechRef.current = { text, at: now };
    void speakText(text, language);
  }, [language, localizedPose.title, result?.message, sound]);

  const cameraRef = useRef<CameraView>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const loopRunningRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const startAt = useRef<number | null>(null);
  const activeRef = useRef(false);
  const frameDelayMsRef = useRef(165);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    return () => {
      loopRunningRef.current = false;
      socketRef.current?.close();
      socketRef.current = null;
      stopSession().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!active || paused) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [active, paused]);

  const connectBackend = (sessionId: string) => new Promise<boolean>((resolve) => {
    try {
      const socket = createPoseWebSocket(pose.id, sessionId);
      socketRef.current = socket;
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.close();
          resolve(false);
        }
      }, 8000);

      const fail = (message: string) => {
        setBackendOnline(false);
        setBackendLabel(language === 'hi' ? localizeCoachText(message, language, localizedPose.title) : message);
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(false);
        }
      };

      socket.onopen = () => {
        setBackendLabel(language === 'hi' ? 'कनेक्ट हो गया — मुद्रा मॉडल की प्रतीक्षा…' : 'Connected — waiting for pose model…');
      };

      socket.onmessage = (event) => {
        try {
          const incoming = JSON.parse(event.data) as AIResult;
          if (incoming.type === 'ready') {
            setBackendOnline(true);
            setBackendLabel(language === 'hi' ? 'लाइव MediaPipe कोच' : 'Live MediaPipe coach');
            if (incoming.target_fps && incoming.target_fps > 0) {
              frameDelayMsRef.current = Math.max(120, Math.round(1000 / incoming.target_fps));
            }
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              resolve(true);
            }
            return;
          }
          if (incoming.type === 'error') {
            if (!settled) {
              fail(incoming.message || 'AI backend could not start');
            } else {
              setBackendLabel(language === 'hi' ? localizeCoachText(incoming.message || 'AI analysis error', language, localizedPose.title) : (incoming.message || 'AI analysis error'));
            }
            return;
          }
          setResult(incoming);
          if (incoming.server_fps != null) setAnalysisFps(incoming.server_fps);
        } catch {
          fail(language === 'hi' ? 'एआई से अमान्य प्रतिक्रिया मिली।' : 'Invalid AI response from backend');
        }
      };

      socket.onclose = () => {
        setBackendOnline(false);
        if (activeRef.current) setBackendLabel(language === 'hi' ? 'बैकएंड डिस्कनेक्ट हो गया' : 'Backend disconnected');
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(false);
        }
      };

      socket.onerror = () => fail('Could not connect to the AI backend');
    } catch {
      setBackendLabel(language === 'hi' ? 'एआई कनेक्शन नहीं बन सका' : 'Could not create AI connection');
      resolve(false);
    }
  });

  const sendFrames = async () => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;
    try {
      while (loopRunningRef.current && active && !paused) {
        const socket = socketRef.current;
        if (!cameraRef.current || !cameraReady || !socket || socket.readyState !== WebSocket.OPEN) break;
        try {
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.3,
            skipProcessing: false,
            shutterSound: false,
          });
          if (photo.base64 && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: 'frame',
              image_b64: photo.base64,
              timestamp_ms: Date.now(),
              width: photo.width,
              height: photo.height,
            }));
          }
        } catch {
          // Camera capture failures are transient; don't kill the live session.
        }
        await new Promise((resolve) => setTimeout(resolve, frameDelayMsRef.current));
      }
    } finally {
      loopRunningRef.current = false;
    }
  };

  useEffect(() => {
    if (active && !paused && backendOnline) sendFrames();
  }, [active, paused, backendOnline, cameraReady]);

  const start = async () => {
    if (active) return;
    if (!permission?.granted) {
      const response = await requestPermission().catch(() => null);
      if (!response?.granted) return;
    }
    if (!cameraReady) {
      Alert.alert(language === 'hi' ? 'कैमरा तैयार नहीं है' : 'Camera is not ready', language === 'hi' ? 'एक क्षण बाद फिर कोशिश करें।' : 'Please try again once the camera is ready.');
      return;
    }
    startAt.current = Date.now();
    setElapsed(0);
    setPaused(false);
    setBackendLabel(language === 'hi' ? 'एआई सेशन शुरू हो रहा है…' : 'Starting AI session…');
    setResult({ score: 0, message: language === 'hi' ? 'मुद्रा ट्रैकर तैयार हो रहा है…' : 'Preparing the posture tracker…' });
    void speakText(`${localizedPose.title}. ${localizedPose.steps.slice(0,3).join('. ')}`, language);

    try {
      const session = await startSession(pose.id);
      sessionIdRef.current = session.session_id;
      const connected = await connectBackend(session.session_id);
      if (!connected) {
        sessionIdRef.current = null;
        try { await stopSession(); } catch { /* ignore cleanup failure */ }
        setActive(false);
        setBackendOnline(false);
        setBackendLabel(language === 'hi' ? 'एआई बैकएंड उपलब्ध नहीं है' : 'AI backend unavailable');
        setResult({ score: 0, message: language === 'hi' ? 'FastAPI शुरू करें और फिर प्रयास करें।' : 'Start FastAPI and try again.' });
        Alert.alert(language === 'hi' ? 'एआई बैकएंड उपलब्ध नहीं है' : 'AI backend unavailable', language === 'hi' ? 'PosePerfect FastAPI बैकएंड शुरू करके फिर से सेशन शुरू करें।' : 'Start the PosePerfect FastAPI backend, then start the session again.');
        return;
      }
      setActive(true);
    } catch (error) {
      setActive(false);
      setBackendOnline(false);
      setBackendLabel(language === 'hi' ? 'एआई सेशन शुरू नहीं हो सका' : 'Could not start AI session');
      setResult({ score: 0, message: error instanceof Error ? error.message : (language === 'hi' ? 'एआई सेशन शुरू नहीं हो सका।' : 'Could not start AI session.') });
      Alert.alert(language === 'hi' ? 'एआई सेशन शुरू नहीं हो सका' : 'Could not start AI session', language === 'hi' ? 'जाँचें कि FastAPI चल रहा है और चुनी गई मुद्रा समर्थित है।' : 'Check that FastAPI is running and the selected pose is supported.');
    }
  };

  const stop = async () => {
    const duration = startAt.current ? Math.max(1, Math.round((Date.now() - startAt.current) / 1000)) : elapsed;
    const finalScore = result?.score ?? 0;
    loopRunningRef.current = false;
    setActive(false);
    setPaused(false);
    socketRef.current?.close();
    socketRef.current = null;
    sessionIdRef.current = null;
    setBackendOnline(false);
    setBackendLabel(language === 'hi' ? 'सेशन पूरा हो गया' : 'Session complete');
    try { await stopSession(); } catch { /* backend may already be offline */ }
    if (duration >= 1) {
      addSession({
        id: `${Date.now()}`,
        poseId: pose.id,
        poseTitle: pose.title,
        durationSeconds: duration,
        score: Math.round(finalScore),
        createdAt: new Date().toISOString(),
        language,
      });
    }
  };

  const togglePause = () => {
    setPaused((current) => !current);
    loopRunningRef.current = false;
  };

  const capture = async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      await cameraRef.current.takePictureAsync({ quality: 0.5, shutterSound: false });
      Alert.alert(language === 'hi' ? 'स्नैपशॉट सेव हो गया' : 'Snapshot saved', language === 'hi' ? 'कैमरा सही तरीके से काम कर रहा है।' : 'The camera is working correctly.');
    } catch {
      Alert.alert(language === 'hi' ? 'कैमरा त्रुटि' : 'Camera error', language === 'hi' ? 'स्नैपशॉट कैप्चर नहीं हो सका।' : 'Could not capture a snapshot.');
    }
  };

  const format = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!permission) return <View style={styles.center}><Text style={styles.centerText}>{t(language,'ready')}…</Text></View>;
  if (!permission.granted) return (
    <View style={styles.center}>
      <Ionicons name="camera-outline" size={54} color="#2DBE60" />
      <Text style={styles.centerTitle}>Camera access is required</Text>
      <Text style={styles.centerText}>PosePerfect uses the camera for real-time posture coaching.</Text>
      <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}><Text style={styles.buttonText}>{language === 'hi' ? 'कैमरा अनुमति दें' : 'Allow Camera'}</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.cancel}>Go Back</Text></TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        active={active && !paused}
        mirror={facing === 'front'}
        mode="picture"
        onCameraReady={() => setCameraReady(true)}
      />
      <View style={styles.shade} />
      {drawSkeleton(result?.landmarks, facing === 'front', Boolean(result?.is_correct))}

      {!active && <View style={styles.demoOverlay}>
        <View style={styles.demoCard}>
          <Text style={styles.demoEyebrow}>{t(language,'posePreview')}</Text>
          <Text style={styles.demoTitle}>{localizedPose.title}</Text>
          <View style={styles.demoImageWrap}><Image source={localizedPose.image} style={styles.demoImage} resizeMode="contain" /><View style={styles.demoScan}/></View>
          <Text style={styles.demoDescription}>{t(language,'previewText')}</Text>
          {localizedPose.steps.slice(0,3).map((step,index)=><View key={step} style={styles.demoStep}><Text style={styles.demoNumber}>{index+1}</Text><Text style={styles.demoStepText}>{step}</Text></View>)}
          <Text style={styles.demoReady}>{language === 'hi' ? 'डेमो पूरा होने के बाद ही एआई विश्लेषण शुरू होगा।' : 'AI analysis starts only after you press the button below.'}</Text>
          <TouchableOpacity style={styles.demoStart} onPress={start}><Ionicons name="play" size={18} color="#fff"/><Text style={styles.demoStartText}>{t(language,'startAI')}</Text></TouchableOpacity>
        </View>
      </View>}

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={25} color="#fff" /></TouchableOpacity>
        <View style={styles.titlePill}><Text style={styles.poseTitle}>{localizedPose.title}</Text></View>
        <TouchableOpacity style={styles.iconButton} onPress={() => setSound((s) => !s)}><Ionicons name={sound ? 'volume-high' : 'volume-mute'} size={23} color="#fff" /></TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.live}><View style={[styles.dot, { backgroundColor: active && !paused ? '#00ff78' : '#aaa' }]} /><Text style={styles.liveText}>{active && !paused ? t(language,'live') : t(language,'ready')}</Text></View>
        <View style={styles.timer}><Ionicons name="time-outline" size={20} color="#fff" /><Text style={styles.timerText}>{format(elapsed)}</Text></View>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>{active ? (paused ? (language === 'hi' ? 'सेशन रुका है' : 'Session Paused') : backendOnline ? (language === 'hi' ? 'एआई कोच सक्रिय' : 'AI Coach Active') : (language === 'hi' ? 'एआई ऑफलाइन' : 'AI Offline')) : (language === 'hi' ? 'अभ्यास के लिए तैयार' : 'Ready to Practice')}</Text>
        <Text style={styles.infoText}>{backendLabel}{analysisFps > 0 && backendOnline ? ` • ~${analysisFps} FPS` : ''}</Text>
        <Text style={styles.poseHint}>{localizedPose.title}</Text>
      </View>

      {result && (
        <View style={styles.feedback}>
          <View style={styles.score}><Text style={styles.label}>{t(language,'match')}</Text><Text style={styles.scoreValue}>{Math.round(result.score)}</Text></View>
          <View style={styles.divider} />
          <View style={styles.feedbackText}>
            <Text style={[styles.feedbackTitle, { color: result.is_correct ? '#00ff9d' : '#fff' }]}>{result.is_correct ? (language === 'hi' ? 'बहुत अच्छा' : 'Excellent') : result.score >= 80 ? t(language,'almost') : t(language,'adjust')}</Text>
            <Text style={styles.feedbackSub}>{localizeCoachText(result.message || '', language, localizedPose.title)}</Text>
            {result.latency_ms != null && backendOnline ? <Text style={styles.latency}>Inference {Math.round(result.latency_ms)} ms</Text> : null}
          </View>
        </View>
      )}

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.smallControl} onPress={() => setFacing((f) => f === 'front' ? 'back' : 'front')}><Ionicons name="camera-reverse-outline" size={23} color="#fff" /></TouchableOpacity>
        <TouchableOpacity style={styles.smallControl} onPress={capture}><Ionicons name="camera-outline" size={23} color="#fff" /></TouchableOpacity>
        {!active ? (
          <TouchableOpacity style={styles.start} onPress={start}><Ionicons name="play" size={19} color="#fff" /><Text style={styles.controlText}>{t(language,'startAI')}</Text></TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.pause} onPress={togglePause}><Ionicons name={paused ? 'play' : 'pause'} size={20} color="#fff" /><Text style={styles.controlText}>{paused ? (language === 'hi' ? 'जारी रखें' : 'Resume') : (language === 'hi' ? 'रोकें' : 'Pause')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.stop} onPress={stop}><Ionicons name="stop" size={18} color="#fff" /><Text style={styles.controlText}>{t(language,'stopSession')}</Text></TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function CameraScreen() {
  const route = useRoute<Route>();
  if (Platform.OS === 'web') return <WebCameraCoach pose={route.params.pose} />;
  return <NativeCameraScreen />;
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#000'},center:{flex:1,backgroundColor:'#F7FAF8',alignItems:'center',justifyContent:'center',padding:30},centerTitle:{fontSize:22,fontWeight:'800',marginTop:15,color:'#222'},centerText:{fontSize:16,color:'#666',textAlign:'center',marginTop:8,lineHeight:23},permissionButton:{backgroundColor:'#2DBE60',paddingHorizontal:30,paddingVertical:15,borderRadius:28,marginTop:22},buttonText:{color:'#fff',fontWeight:'800',fontSize:16},cancel:{marginTop:20,color:'#555',fontWeight:'700'},shade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.08)'},header:{position:'absolute',top:40,left:16,right:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},iconButton:{width:48,height:48,borderRadius:24,backgroundColor:'rgba(15,25,25,.48)',alignItems:'center',justifyContent:'center'},titlePill:{backgroundColor:'rgba(15,25,25,.55)',paddingHorizontal:18,paddingVertical:10,borderRadius:22},poseTitle:{color:'#fff',fontSize:18,fontWeight:'800'},statusRow:{position:'absolute',top:105,left:18,right:18,flexDirection:'row',justifyContent:'space-between'},live:{height:44,paddingHorizontal:15,borderRadius:22,backgroundColor:'rgba(15,25,25,.55)',flexDirection:'row',alignItems:'center'},dot:{width:10,height:10,borderRadius:5,marginRight:8},liveText:{color:'#fff',fontWeight:'800',letterSpacing:1},timer:{height:44,paddingHorizontal:15,borderRadius:22,backgroundColor:'rgba(15,25,25,.55)',flexDirection:'row',alignItems:'center',gap:7},timerText:{color:'#fff',fontWeight:'800'},info:{position:'absolute',top:185,left:25,right:25,alignItems:'center'},infoTitle:{color:'#fff',fontSize:25,fontWeight:'900'},infoText:{color:'#d9fff0',marginTop:5,fontWeight:'700'},poseHint:{color:'#00ffc2',marginTop:5,fontSize:16,fontWeight:'800'},feedback:{position:'absolute',left:18,right:18,bottom:125,minHeight:110,borderRadius:26,backgroundColor:'rgba(20,30,35,.72)',borderWidth:1,borderColor:'rgba(255,255,255,.18)',flexDirection:'row',alignItems:'center',paddingHorizontal:18},score:{width:85,alignItems:'center'},label:{color:'#ddd',fontSize:11,fontWeight:'800'},scoreValue:{color:'#fff',fontSize:34,fontWeight:'900',marginTop:2},divider:{width:1,height:65,backgroundColor:'rgba(255,255,255,.2)'},feedbackText:{flex:1,paddingLeft:15},feedbackTitle:{fontSize:20,fontWeight:'900'},feedbackSub:{color:'#b8ffe8',fontSize:13.5,fontWeight:'600',marginTop:4,lineHeight:19},latency:{color:'#9aa9a4',fontSize:10,marginTop:5},bottom:{position:'absolute',left:18,right:18,bottom:25,flexDirection:'row',gap:9,alignItems:'center'},smallControl:{width:50,height:52,borderRadius:26,backgroundColor:'rgba(20,30,35,.65)',alignItems:'center',justifyContent:'center'},start:{flex:1,height:56,borderRadius:28,backgroundColor:'#00c878',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},pause:{flex:1,height:56,borderRadius:28,backgroundColor:'#00b96b',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},stop:{flex:1,height:56,borderRadius:28,backgroundColor:'#ef4444',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},controlText:{color:'#fff',fontSize:16,fontWeight:'900'}
,demoOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.84)',alignItems:'center',justifyContent:'center',padding:18,zIndex:20},demoCard:{width:'100%',maxWidth:560,maxHeight:'88%',backgroundColor:'#0D1915',borderRadius:28,borderWidth:1,borderColor:'rgba(255,255,255,.12)',padding:18},demoEyebrow:{color:'#65E89B',fontSize:10,fontWeight:'900',letterSpacing:1.8},demoTitle:{color:'#fff',fontSize:25,fontWeight:'900',marginTop:5},demoImageWrap:{height:205,borderRadius:20,marginTop:12,backgroundColor:'#F4FBF7',overflow:'hidden',alignItems:'center',justifyContent:'center',position:'relative'},demoImage:{width:'85%',height:'90%'},demoScan:{position:'absolute',left:0,right:0,top:'45%',height:2,backgroundColor:'#2DBE60',opacity:.18},demoDescription:{color:'#A7BBB2',fontSize:11.5,lineHeight:17,marginTop:10},demoStep:{flexDirection:'row',alignItems:'flex-start',gap:9,marginTop:8},demoNumber:{width:22,height:22,borderRadius:11,backgroundColor:'#173D2C',color:'#85E1AA',textAlign:'center',lineHeight:22,fontSize:10,fontWeight:'900'},demoStepText:{flex:1,color:'#DDF4E7',fontSize:11.5,lineHeight:17},demoReady:{color:'#789188',fontSize:9.5,lineHeight:14,marginTop:10},demoStart:{height:50,borderRadius:15,backgroundColor:'#2DBE60',marginTop:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},demoStartText:{color:'#fff',fontSize:14,fontWeight:'900'},});
