import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabs from './BottomTabs';
import WelcomeScreen from '../screens/Welcome/WelcomeScreen';
import AuthScreen from '../screens/Auth/AuthScreen';
import PoseDetailScreen from '../screens/PoseDetail/PoseDetailScreen';
import CameraScreen from '../screens/Camera/CameraScreen';
import ProgressScreen from '../screens/Progress/ProgressScreen';
import { YogaPose } from '../types';
import { useApp } from '../context/AppContext';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';

export type RootStackParamList = {
  Welcome: undefined;
  Auth: { mode?: 'login' | 'register' } | undefined;
  Main: undefined;
  PoseDetail: { pose: YogaPose };
  Camera: { pose: YogaPose };
  Progress: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { currentUser, hydrated } = useApp();
  if (!hydrated) return <SafeAreaView style={styles.loading}><View><ActivityIndicator size="large" color="#2DBE60" /></View></SafeAreaView>;
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={currentUser ? 'Main' : 'Welcome'} screenOptions={{ headerShown: false, animation: 'fade' }}>
        {currentUser ? (
          <>
            <Stack.Screen name="Main" component={BottomTabs} />
            <Stack.Screen name="PoseDetail" component={PoseDetailScreen} />
            <Stack.Screen name="Camera" component={CameraScreen} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({ loading:{flex:1,backgroundColor:'#F7FAF8',alignItems:'center',justifyContent:'center'} });
