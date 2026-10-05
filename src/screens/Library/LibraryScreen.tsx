import React from 'react';
import {SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../navigation/AppNavigator';
import {useApp} from '../../context/AppContext';
import {yogaPoses} from '../../data/yogaPoses';
import PoseCard from '../../components/Practice/PoseCard';
import {localizePose,t} from '../../i18n';
export default function LibraryScreen(){const navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>();const {favoriteIds,language}=useApp();const saved=yogaPoses.filter(p=>favoriteIds.includes(p.id)).map(p=>localizePose(p,language));return <SafeAreaView style={styles.container}><ScrollView showsVerticalScrollIndicator={false}><View style={styles.header}><Text style={styles.title}>{t(language,'yourLibrary')} ❤️</Text><Text style={styles.subtitle}>{t(language,'savedPoses')}</Text></View>{saved.length?saved.map(p=><PoseCard key={p.id} pose={p} onPress={()=>navigation.navigate('PoseDetail',{pose:p})}/>):<View style={styles.empty}><Text style={styles.emoji}>📚</Text><Text style={styles.emptyTitle}>{t(language,'libraryEmpty')}</Text><Text style={styles.emptyText}>{t(language,'libraryEmptyText')}</Text></View>}</ScrollView></SafeAreaView>}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#F7FAF8'},header:{padding:20,paddingTop:18},title:{fontSize:29,fontWeight:'800',color:'#222'},subtitle:{fontSize:15,color:'#777',marginTop:6},empty:{margin:25,padding:30,borderRadius:24,backgroundColor:'#fff',alignItems:'center'},emoji:{fontSize:44},emptyTitle:{fontSize:20,fontWeight:'800',marginTop:12},emptyText:{textAlign:'center',color:'#777',lineHeight:22,marginTop:7}});
