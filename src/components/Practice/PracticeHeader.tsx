import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {useApp} from '../../context/AppContext';
import {t} from '../../i18n';
export default function PracticeHeader(){const {language}=useApp();return <View style={styles.container}><Text style={styles.title}>{t(language,'practice')} 🧘</Text><Text style={styles.subtitle}>{language==='hi'?'मुद्रा चुनें और पोस्टचर विश्लेषण शुरू करें':'Choose a pose to begin posture analysis'}</Text></View>}
const styles=StyleSheet.create({container:{paddingHorizontal:20,paddingTop:12,paddingBottom:8,backgroundColor:'#F7FAF8'},title:{fontSize:28,fontWeight:'800',color:'#111'},subtitle:{marginTop:6,fontSize:15,color:'#666',lineHeight:22}});
