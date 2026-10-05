import React from 'react';
import {StyleSheet,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useApp} from '../../context/AppContext';
import {t} from '../../i18n';
export default function SearchBar({value,onChange}:{value:string;onChange:(v:string)=>void}){
 const {language}=useApp();
 return <View style={styles.wrap}><Ionicons name="search-outline" size={20} color="#8A9A93"/><TextInput value={value} onChangeText={onChange} placeholder={t(language,'searchPoses')} placeholderTextColor="#9AA8A2" style={styles.input}/></View>
}
const styles=StyleSheet.create({wrap:{marginHorizontal:20,backgroundColor:'#fff',height:52,borderRadius:16,flexDirection:'row',alignItems:'center',paddingHorizontal:14,borderWidth:1,borderColor:'#E6EEE9'},input:{flex:1,marginLeft:9,color:'#26352F',fontSize:14}});
