import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { YogaPose } from '../../types';
import PoseCard from './PoseCard';
import {useApp} from '../../context/AppContext';
import {t} from '../../i18n';
export default function PoseList({poses,onSelect}:{poses:YogaPose[];onSelect:(pose:YogaPose)=>void}){const {language}=useApp();return <View><View style={styles.header}><Text style={styles.heading}>{poses.length ? (language==='hi'?'आपके लिए सुझाई गई मुद्राएँ ✨':'Recommended For You ✨') : t(language,'noPoses')}</Text><Text style={styles.sub}>{language==='hi'?'आज के अभ्यास के लिए सुझाई गई मुद्राएँ':'Today’s recommended practice'}</Text></View>{poses.map(p=><PoseCard key={p.id} pose={p} onPress={()=>onSelect(p)}/>)}</View>}
const styles=StyleSheet.create({header:{marginHorizontal:20,marginBottom:18,marginTop:6},heading:{fontSize:23,fontWeight:'800',color:'#222'},sub:{marginTop:4,fontSize:14,color:'#777'}});
