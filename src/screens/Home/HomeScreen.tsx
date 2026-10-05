import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import HomeHeader from '../../components/Home/HomeHeader';
import HeroBanner from '../../components/Home/HeroBanner';
import QuickActionGrid from '../../components/Home/QuickActionGrid';
import { yogaPoses } from '../../data/yogaPoses';
import { useApp } from '../../context/AppContext';
import { localizePose } from '../../i18n';

export default function HomeScreen(){const navigation=useNavigation<any>();const {language}=useApp();const openPose=(index=0)=>navigation.getParent()?.navigate('PoseDetail',{pose:localizePose(yogaPoses[index],language)});return <SafeAreaView style={styles.container}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><HomeHeader/><HeroBanner onPress={()=>openPose(0)}/><QuickActionGrid onPractice={()=>navigation.navigate('Practice')} onLibrary={()=>navigation.navigate('Library')} onProgress={()=>navigation.getParent()?.navigate('Progress')} onCoach={()=>openPose(0)}/></ScrollView></SafeAreaView>}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#F7FAF8',paddingHorizontal:20},content:{paddingBottom:25}});
