import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/Home/HomeScreen';
import PracticeScreen from '../screens/Practice/PracticeScreen';
import LibraryScreen from '../screens/Library/LibraryScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import {useApp} from '../context/AppContext';
import {t} from '../i18n';

export type MainTabParamList = { Home: undefined; Practice: undefined; Library: undefined; Profile: undefined; };
const Tab = createBottomTabNavigator<MainTabParamList>();

export default function BottomTabs() {
  const {language}=useApp();
  const labels={Home:language==='hi'?'होम':'Home',Practice:t(language,'practice'),Library:t(language,'library'),Profile:t(language,'yourProfile')};
  return <Tab.Navigator screenOptions={({ route }) => ({
    headerShown:false,tabBarActiveTintColor:'#2DBE60',tabBarInactiveTintColor:'#999',
    tabBarStyle:{height:68,paddingBottom:8,paddingTop:7},tabBarLabelStyle:{fontSize:11,fontWeight:'600'},
    tabBarIcon:({color,size})=>{const icons:Record<keyof MainTabParamList,keyof typeof Ionicons.glyphMap>={Home:'home-outline',Practice:'play-circle-outline',Library:'book-outline',Profile:'person-outline'};return <Ionicons name={icons[route.name]} size={size} color={color}/>;},
  })}><Tab.Screen name="Home" component={HomeScreen} options={{tabBarLabel:labels.Home}}/><Tab.Screen name="Practice" component={PracticeScreen} options={{tabBarLabel:labels.Practice}}/><Tab.Screen name="Library" component={LibraryScreen} options={{tabBarLabel:labels.Library}}/><Tab.Screen name="Profile" component={ProfileScreen} options={{tabBarLabel:labels.Profile}}/></Tab.Navigator>;
}
