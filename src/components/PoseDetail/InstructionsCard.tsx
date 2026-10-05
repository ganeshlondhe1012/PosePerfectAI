import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {useApp} from '../../context/AppContext';
import {t} from '../../i18n';
export default function InstructionsCard({steps}:{steps:string[]}){
 const {language}=useApp();
 return <View style={styles.card}><Text style={styles.heading}>🧘 {t(language,'howToPerform')}</Text>{steps.map((s,i)=><View key={`${s}-${i}`} style={styles.row}><View style={styles.number}><Text style={styles.numberText}>{i+1}</Text></View><Text style={styles.step}>{s}</Text></View>)}</View>
}
const styles=StyleSheet.create({card:{backgroundColor:'#fff',marginHorizontal:20,marginTop:16,padding:20,borderRadius:24,elevation:2,shadowColor:'#000',shadowOpacity:.05,shadowRadius:10},heading:{fontSize:21,fontWeight:'800',color:'#222',marginBottom:17},row:{flexDirection:'row',alignItems:'flex-start',marginBottom:15},number:{width:30,height:30,borderRadius:15,backgroundColor:'#EAF8EF',alignItems:'center',justifyContent:'center'},numberText:{color:'#2DBE60',fontWeight:'800'},step:{flex:1,marginLeft:12,fontSize:15.5,color:'#555',lineHeight:23}});
