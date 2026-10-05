import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import LanguageSelector from '../../components/LanguageSelector';

type Props=NativeStackScreenProps<RootStackParamList,'Welcome'>;

export default function WelcomeScreen({navigation}:Props){
  const { hydrated, currentUser, language, setLanguage } = useApp();

  useEffect(() => {
    if (hydrated && currentUser) navigation.replace('Main');
  }, [currentUser, hydrated, navigation]);

  if (!hydrated) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#2DBE60"/><Text style={styles.loadingText}>PosePerfect AI</Text></View>;
  }

  return <View style={styles.container}>
    <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain"/>
    <Text style={styles.title}>PosePerfect <Text style={styles.ai}>AI</Text></Text>
    <Text style={styles.subtitle}>{t(language,'welcomeSubtitle')}</Text>
    <View style={styles.languageWrap}><LanguageSelector language={language} onChange={setLanguage}/></View>
    <TouchableOpacity style={styles.button} onPress={()=>navigation.navigate('Auth',{mode:'login'})}><Text style={styles.buttonText}>{t(language,'signIn')}</Text></TouchableOpacity>
    <TouchableOpacity style={styles.outlineButton} onPress={()=>navigation.navigate('Auth',{mode:'register'})}><Text style={styles.outlineText}>{t(language,'createAccount')}</Text></TouchableOpacity>
    <Text style={styles.bottom}>{t(language,'stayFit')}</Text>
  </View>;
}
const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:'#F5FBF8',justifyContent:'center',alignItems:'center',paddingHorizontal:25},
  loading:{flex:1,backgroundColor:'#F5FBF8',justifyContent:'center',alignItems:'center'},
  loadingText:{marginTop:10,color:'#557067',fontWeight:'800'},
  logo:{width:190,height:190,marginBottom:18},
  title:{fontSize:38,fontWeight:'800',color:'#202020'},ai:{color:'#2DBE60'},
  subtitle:{marginTop:10,textAlign:'center',color:'#666',fontSize:18,lineHeight:28,marginBottom:30},
  button:{width:'92%',height:58,backgroundColor:'#2DBE60',borderRadius:30,justifyContent:'center',alignItems:'center',elevation:6},
  buttonText:{color:'#fff',fontSize:19,fontWeight:'800'},
  outlineButton:{width:'92%',height:54,borderRadius:27,borderWidth:1.5,borderColor:'#BFD9C9',justifyContent:'center',alignItems:'center',marginTop:12,backgroundColor:'#fff'},
  outlineText:{color:'#218950',fontSize:17,fontWeight:'800'},
  bottom:{marginTop:24,color:'#7A7A7A',fontSize:16,fontWeight:'600'},
  languageWrap:{width:'92%',marginBottom:6}
});
