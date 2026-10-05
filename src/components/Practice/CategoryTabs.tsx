import React from 'react';
import {ScrollView,StyleSheet,Text,TouchableOpacity} from 'react-native';
import {useApp} from '../../context/AppContext';
import {t} from '../../i18n';

export default function CategoryTabs({selectedCategory,onSelectCategory}:{selectedCategory:string;onSelectCategory:(s:string)=>void}){
  const {language}=useApp();
  const tabs=[['All','all'],['Balance','balance'],['Standing','standing'],['Stretch','stretch'],['Relax','relax']] as const;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
    {tabs.map(([value,key])=><TouchableOpacity key={value} style={[styles.tab,selectedCategory===value&&styles.active]} onPress={()=>onSelectCategory(value)}>
      <Text style={[styles.text,selectedCategory===value&&styles.activeText]}>{t(language,key)}</Text>
    </TouchableOpacity>)}
  </ScrollView>
}
const styles=StyleSheet.create({container:{paddingHorizontal:20,paddingVertical:14,gap:9},tab:{paddingHorizontal:16,height:40,borderRadius:20,backgroundColor:'#fff',justifyContent:'center',borderWidth:1,borderColor:'#E3ECE7'},active:{backgroundColor:'#2DBE60',borderColor:'#2DBE60'},text:{fontSize:12,fontWeight:'800',color:'#6F8078'},activeText:{color:'#fff'}});
