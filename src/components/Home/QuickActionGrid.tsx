import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QuickActionCard from './QuickActionCard';
import {useApp} from '../../context/AppContext';
import {t} from '../../i18n';

export default function QuickActionGrid({onPractice,onLibrary,onProgress,onCoach}:{onPractice:()=>void;onLibrary:()=>void;onProgress:()=>void;onCoach:()=>void}){const {language}=useApp();return <View style={styles.container}><Text style={styles.heading}>{t(language,'quickActions')}</Text><View style={styles.row}><QuickActionCard icon="play-circle-outline" title={t(language,'practice')} subtitle={t(language,'startSession')} onPress={onPractice}/><QuickActionCard icon="book-outline" title={t(language,'library')} subtitle={t(language,'explorePoses')} onPress={onLibrary}/></View><View style={styles.row}><QuickActionCard icon="stats-chart-outline" title={t(language,'progress')} subtitle={t(language,'viewStats')} onPress={onProgress}/><QuickActionCard icon="sparkles-outline" title={t(language,'aiCoach')} subtitle={t(language,'liveCoaching')} onPress={onCoach}/></View></View>}
const styles=StyleSheet.create({container:{marginTop:25},heading:{fontSize:22,fontWeight:'800',color:'#222',marginBottom:18},row:{flexDirection:'row',justifyContent:'space-between'}});
