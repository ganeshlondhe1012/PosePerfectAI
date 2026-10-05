export type YogaPose = {
  id: string;
  title: string;
  benefits: string[];
  steps: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  category: 'Balance' | 'Standing' | 'Stretch' | 'Relax';
  image: any;
  description?: string;
};

export type SessionRecord = {
  id: string;
  poseId: string;
  poseTitle: string;
  durationSeconds: number;
  score: number;
  createdAt: string;
  language?: 'en' | 'hi';
  feedback?: string;
};

export type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type AIResult = {
  type?: 'ready' | 'result' | 'error';
  score: number;
  raw_score?: number;
  message_key?: string;
  message?: string;
  landmarks?: PoseLandmark[];
  pose_detected?: boolean;
  body_visible?: boolean;
  is_correct?: boolean;
  stable_seconds?: number;
  target_pose?: string;
  matched_pose?: string;
  pose_identity?: number;
  quality?: number;
  critical_visibility?: number;
  latency_ms?: number;
  session_id?: string;
  target_fps?: number;
  server_fps?: number;
};
