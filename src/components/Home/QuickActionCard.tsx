import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props={icon:keyof typeof Ionicons.glyphMap;title:string;subtitle:string;onPress:()=>void};
export default function QuickActionCard({icon,title,subtitle,onPress}:Props){return <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}><View style={styles.icon}><Ionicons name={icon} size={26} color="#2DBE60"/></View><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></TouchableOpacity>}
const styles=StyleSheet.create({card:{width:'48%',backgroundColor:'#fff',borderRadius:20,padding:18,marginBottom:15,elevation:3,shadowColor:'#000',shadowOpacity:.07,shadowRadius:8,shadowOffset:{width:0,height:4}},icon:{width:50,height:50,borderRadius:25,backgroundColor:'#EAF8EF',justifyContent:'center',alignItems:'center',marginBottom:14},title:{fontSize:18,fontWeight:'800',color:'#222'},subtitle:{marginTop:5,color:'#777',fontSize:14}});
