import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useApp} from '../../context/AppContext';
import {t} from '../../i18n';
export default function BenefitsCard({benefits}:{benefits:string[]}){
 const {language}=useApp();
 return <View style={styles.card}><Text style={styles.heading}>💚 {t(language,'whyPractice')}</Text>{benefits.map((b,i)=><View key={`${b}-${i}`} style={styles.row}><Ionicons name="checkmark-circle" size={22} color="#2DBE60"/><Text style={styles.text}>{b}</Text></View>)}</View>
}
const styles=StyleSheet.create({card:{backgroundColor:'#fff',marginHorizontal:20,marginTop:16,padding:20,borderRadius:24,elevation:2,shadowColor:'#000',shadowOpacity:.05,shadowRadius:10},heading:{fontSize:21,fontWeight:'800',color:'#222',marginBottom:16},row:{flexDirection:'row',alignItems:'center',marginBottom:12},text:{marginLeft:12,fontSize:16,color:'#555',flex:1}});
