import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { YogaPose } from '../../types';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
export default function PoseHeader({pose}:{pose:YogaPose}){
 const navigation=useNavigation(); const {language}=useApp();
 return <View style={styles.container}>
   <TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()}><Ionicons name="arrow-back" size={27} color="#222"/></TouchableOpacity>
   <View style={styles.imageContainer}><Image source={pose.image} style={styles.image}/></View>
   <Text style={styles.title}>{pose.title}</Text>
   <Text style={styles.subtitle}>{pose.category} • {pose.difficulty}</Text>
   <Text style={styles.duration}>⏱ {pose.duration.replace('min',t(language,'minute'))}</Text>
   {pose.description ? <Text style={styles.description}>{pose.description}</Text> : null}
 </View>
}
const styles=StyleSheet.create({container:{alignItems:'center',paddingTop:15,paddingBottom:12},back:{alignSelf:'flex-start',marginLeft:20,marginBottom:16,padding:4},imageContainer:{width:'90%',height:270,backgroundColor:'#F2FAF5',borderRadius:28,alignItems:'center',justifyContent:'center',marginBottom:20,elevation:2},image:{width:'96%',height:'96%',resizeMode:'contain'},title:{fontSize:30,fontWeight:'800',color:'#222',marginTop:5,textAlign:'center'},subtitle:{marginTop:6,fontSize:16,color:'#666',fontWeight:'600'},duration:{marginTop:10,fontSize:16,color:'#2DBE60',fontWeight:'800'},description:{marginTop:10,paddingHorizontal:26,textAlign:'center',fontSize:12,color:'#6D7D76',lineHeight:18}});
