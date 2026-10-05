import Constants from 'expo-constants';

type SessionResponse = {
  ok: boolean;
  session_id: string;
  pose: string;
};

type HostConfig = {
  apiUrl: string;
  source: 'env' | 'metro-host' | 'localhost';
};

function resolveHost(): HostConfig {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (envUrl) return { apiUrl: envUrl, source: 'env' };

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return { apiUrl: `http://${host}:8000`, source: 'metro-host' };

  // Browser development fallback.
  if (typeof location !== 'undefined' && location.hostname) {
    return { apiUrl: `http://${location.hostname}:8000`, source: 'metro-host' };
  }

  return { apiUrl: 'http://127.0.0.1:8000', source: 'localhost' };
}

const config = resolveHost();
export const API_URL = config.apiUrl;
export const API_URL_SOURCE = config.source;
export const isBackendConfigured = true;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) {
    const message = await response.text().catch(() => 'Request failed');
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const getHealth = () => request<{
  ok: boolean;
  model_ready: boolean;
  pose_model: string;
  poses: string[];
}>('/health');

export const startSession = (poseId: string) =>
  request<SessionResponse>('/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pose_name: poseId }),
  });

export const stopSession = () => request<{ ok: boolean }>('/session/stop', { method: 'POST' });

export const createPoseWebSocket = (poseId: string, sessionId?: string) => {
  const wsUrl = API_URL.replace(/^http/, 'ws') + `/ws/pose?pose=${encodeURIComponent(poseId)}${sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : ''}`;
  return new WebSocket(wsUrl);
};
