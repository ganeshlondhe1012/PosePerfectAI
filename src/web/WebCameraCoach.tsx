import React from 'react';
import { View } from 'react-native';
import type { PoseName } from './yogaPoseRules';

type Props = {
  pose: PoseName;
  backendUrl: string;
  sessionId: string;
  onStop: () => void;
};

/**
 * Native fallback. The real browser implementation lives in
 * WebCameraCoach.web.tsx and is selected automatically by Metro/Expo Web.
 */
export default function WebCameraCoach(_: Props) {
  return <View />;
}
