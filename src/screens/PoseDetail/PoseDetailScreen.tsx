import React from 'react';
import {SafeAreaView,ScrollView,StyleSheet,TouchableOpacity,View,Text} from 'react-native';
import {RouteProp,useNavigation,useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import PoseHeader from '../../components/PoseDetail/PoseHeader';
import BenefitsCard from '../../components/PoseDetail/BenefitsCard';
import InstructionsCard from '../../components/PoseDetail/InstructionsCard';
import PoseDemoCard from '../../components/PoseDemoCard';
import {RootStackParamList} from '../../navigation/AppNavigator';
import {useApp} from '../../context/AppContext';
import {Ionicons} from '@expo/vector-icons';
import {localizePose,t} from '../../i18n';
import LanguageSelector from '../../components/LanguageSelector';

type Nav=NativeStackNavigationProp<RootStackParamList>;

export default function PoseDetailScreen(){
  const route=useRoute<RouteProp<RootStackParamList,'PoseDetail'>>();
  const navigation=useNavigation<Nav>();
  const {pose}=route.params;
  const {isFavorite,toggleFavorite,language,setLanguage}=useApp();
  const localized=localizePose(pose,language);
  const favorite=isFavorite(pose.id);

  return <SafeAreaView style={styles.container}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.favorite}>
        <TouchableOpacity onPress={()=>toggleFavorite(pose.id)} accessibilityLabel={favorite ? 'Remove from library' : 'Save to library'}>
          <Ionicons name={favorite?'heart':'heart-outline'} size={27} color={favorite?'#ef4444':'#222'}/>
        </TouchableOpacity>
      </View>
      <PoseHeader pose={localized}/>
      <View style={styles.languageCard}>
        <LanguageSelector language={language} onChange={setLanguage}/>
      </View>
      <PoseDemoCard pose={localized} language={language} onStart={()=>navigation.navigate('Camera',{pose:localized})}/>
      <BenefitsCard benefits={localized.benefits}/>
      <InstructionsCard steps={localized.steps}/>
      <TouchableOpacity style={styles.secondary} onPress={()=>toggleFavorite(pose.id)}>
        <Ionicons name={favorite?'heart':'heart-outline'} size={20} color="#2DBE60"/>
        <Text style={styles.secondaryText}>{favorite?t(language,'saved'):t(language,'saveToLibrary')}</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>
}

const styles=StyleSheet.create({
 container:{flex:1,backgroundColor:'#F7FAF8'},
 content:{paddingBottom:35},
 favorite:{position:'absolute',right:20,top:18,zIndex:5,width:48,height:48,borderRadius:24,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',elevation:3},
 languageCard:{marginHorizontal:20,backgroundColor:'#fff',paddingHorizontal:15,paddingBottom:14,borderRadius:20,elevation:2},
 secondary:{marginHorizontal:20,marginTop:18,backgroundColor:'#fff',height:52,borderRadius:18,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,elevation:2},
 secondaryText:{color:'#2DBE60',fontWeight:'800',fontSize:16}
});
