import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useApp } from '../../context/AppContext';
import { Language, t } from '../../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Mode = 'login' | 'register';

export default function AuthScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Auth'>>();
  const { language, currentUser, login, register } = useApp();
  const mode: Mode = route.params?.mode ?? 'login';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentUser) navigation.replace('Main');
  }, [currentUser, navigation]);

  const copy = useMemo(() => ({
    title: mode === 'login' ? t(language, 'loginTitle') : t(language, 'registerTitle'),
    subtitle: mode === 'login' ? t(language, 'loginSubtitle') : t(language, 'registerSubtitle'),
    action: mode === 'login' ? t(language, 'login') : t(language, 'register'),
  }), [language, mode]);

  const submit = async () => {
    setError('');
    const clean = username.trim().toLowerCase();
    if (!clean) return setError(t(language, 'usernameRequired'));
    if (clean.length < 3) return setError(t(language, 'usernameShort'));
    if (!password) return setError(t(language, 'passwordRequired'));
    if (mode === 'register' && password.length < 6) return setError(t(language, 'passwordShort'));
    if (mode === 'register' && password !== confirm) return setError(t(language, 'passwordMismatch'));
    setBusy(true);
    try {
      const result = mode === 'login'
        ? await login(clean, password)
        : await register(clean, password);
      if (!result.ok) {
        setError(result.error === 'exists' ? t(language, 'userExists') : result.error === 'storage' ? t(language, 'storageError') : t(language, 'invalidCredentials'));
        return;
      }
      navigation.replace('Main');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={25} color="#17342A" />
          </TouchableOpacity>
          <View style={styles.logo}><Ionicons name="leaf" size={25} color="#2DBE60" /></View>
          <Text style={styles.brand}>PosePerfect <Text style={styles.ai}>AI</Text></Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>

          <View style={styles.form}>
            <Field icon="person-outline" placeholder={t(language, 'username')} value={username} onChangeText={setUsername} autoCapitalize="none" />
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color="#779084" />
              <TextInput
                style={styles.input}
                placeholder={t(language, 'password')}
                placeholderTextColor="#93A59D"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#779084" />
              </TouchableOpacity>
            </View>
            {mode === 'register' && (
              <Field icon="checkmark-circle-outline" placeholder={t(language, 'confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry={!showPassword} autoCapitalize="none" />
            )}
            {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color="#C73B49" /><Text style={styles.errorText}>{error}</Text></View> : null}

            <TouchableOpacity style={[styles.button, busy && styles.disabled]} onPress={submit} disabled={busy}>
              <Text style={styles.buttonText}>{busy ? '…' : copy.action}</Text>
            </TouchableOpacity>

            <Text style={styles.note}>{t(language, 'localAuthNote')}</Text>
            {mode === 'login' ? (
              <TouchableOpacity onPress={() => navigation.replace('Auth', { mode: 'register' })}>
                <Text style={styles.switch}>{t(language, 'noAccount')} <Text style={styles.switchStrong}>{t(language, 'createAccount')}</Text></Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => navigation.replace('Auth', { mode: 'login' })}>
                <Text style={styles.switch}>{t(language, 'haveAccount')} <Text style={styles.switchStrong}>{t(language, 'signIn')}</Text></Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: { icon: keyof typeof Ionicons.glyphMap; placeholder: string; value: string; onChangeText: (v:string)=>void; secureTextEntry?: boolean; autoCapitalize?: 'none'|'sentences'|'words'|'characters'; }) {
  const { icon, ...inputProps } = props;
  return <View style={styles.inputWrap}>
    <Ionicons name={icon} size={20} color="#779084" />
    <TextInput {...inputProps} style={styles.input} placeholderTextColor="#93A59D" />
  </View>;
}

const styles = StyleSheet.create({
  flex:{flex:1},container:{flex:1,backgroundColor:'#F5FBF8'},
  content:{flex:1,justifyContent:'center',paddingHorizontal:24},
  back:{position:'absolute',top:12,left:18,width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'#fff',elevation:2},
  logo:{width:58,height:58,borderRadius:20,backgroundColor:'#EAF8EF',alignItems:'center',justifyContent:'center',alignSelf:'center'},
  brand:{textAlign:'center',fontSize:24,fontWeight:'900',color:'#202522',marginTop:10},ai:{color:'#2DBE60'},
  title:{textAlign:'center',fontSize:30,fontWeight:'900',color:'#17342A',marginTop:30},
  subtitle:{textAlign:'center',fontSize:14,color:'#6D8177',lineHeight:20,marginTop:7,marginBottom:22},
  form:{backgroundColor:'#fff',borderRadius:24,padding:18,elevation:3,shadowColor:'#000',shadowOpacity:.05,shadowRadius:14},
  inputWrap:{height:54,borderRadius:15,backgroundColor:'#F6FAF8',borderWidth:1,borderColor:'#E3ECE7',flexDirection:'row',alignItems:'center',paddingHorizontal:14,marginBottom:11,gap:10},
  input:{flex:1,fontSize:15,color:'#17342A',paddingVertical:0},
  error:{backgroundColor:'#FFF0F1',borderRadius:12,padding:11,flexDirection:'row',alignItems:'center',gap:8,marginBottom:11},
  errorText:{flex:1,color:'#A8323E',fontSize:12,lineHeight:17},
  button:{height:54,borderRadius:16,backgroundColor:'#2DBE60',alignItems:'center',justifyContent:'center',marginTop:2},
  disabled:{opacity:.55},buttonText:{color:'#fff',fontSize:16,fontWeight:'900'},
  note:{textAlign:'center',fontSize:10,color:'#83948D',marginTop:12},
  switch:{textAlign:'center',fontSize:13,color:'#6F8178',marginTop:18},
  switchStrong:{fontWeight:'900',color:'#238B55'},
});
