import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {useApp} from '../../context/AppContext';
import {t} from '../../i18n';
export default function HomeHeader() { const {language}=useApp(); return <View style={styles.container}><View style={styles.row}><Ionicons name="leaf-outline" size={27} color="#2DBE60" /><Ionicons name="notifications-outline" size={26} color="#222" /></View><Text style={styles.title}>{t(language,'homeTitle')}</Text><Text style={styles.subtitle}>{t(language,'homeSubtitle')}</Text></View>; }
const styles = StyleSheet.create({container:{marginTop:10},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{fontSize:32,fontWeight:'800',marginTop:25,color:'#1D1D1D'},subtitle:{marginTop:7,fontSize:16,color:'#666'}});
