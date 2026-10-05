import React,{useMemo,useState} from 'react';
import {SafeAreaView,ScrollView,StyleSheet,Text} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import PracticeHeader from '../../components/Practice/PracticeHeader';
import SearchBar from '../../components/Practice/SearchBar';
import CategoryTabs from '../../components/Practice/CategoryTabs';
import PoseList from '../../components/Practice/PoseList';
import {yogaPoses} from '../../data/yogaPoses';
import {YogaPose} from '../../types';
import {RootStackParamList} from '../../navigation/AppNavigator';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useApp} from '../../context/AppContext';
import {localizePose, t} from '../../i18n';

type Nav=NativeStackNavigationProp<RootStackParamList>;
const categoryMap:any={All:'all',Balance:'balance',Standing:'standing',Stretch:'stretch',Relax:'relax'};
export default function PracticeScreen(){
  const [category,setCategory]=useState('All');
  const [query,setQuery]=useState('');
  const navigation=useNavigation<Nav>();
  const {language}=useApp();
  const poses=useMemo(()=>yogaPoses.filter(p=>
    category==='All' || p.category===category
  ).map(p=>localizePose(p,language)).filter(p=>
    p.title.toLowerCase().includes(query.trim().toLowerCase()) ||
    p.benefits.some(item => item.toLowerCase().includes(query.trim().toLowerCase()))
  ),[category,query,language]);
  return <SafeAreaView style={styles.container}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <PracticeHeader />
      <Text style={styles.hint}>{t(language,'practiceTitle')} • {poses.length}</Text>
      <SearchBar value={query} onChange={setQuery}/>
      <CategoryTabs selectedCategory={category} onSelectCategory={setCategory}/>
      <PoseList poses={poses as YogaPose[]} onSelect={(pose:YogaPose)=>navigation.navigate('PoseDetail',{pose})}/>
    </ScrollView>
  </SafeAreaView>
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#F7FAF8'},hint:{marginHorizontal:20,marginTop:6,color:'#7A8B83',fontSize:11,fontWeight:'700'}});
