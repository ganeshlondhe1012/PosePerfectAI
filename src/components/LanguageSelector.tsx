import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Language, LANGUAGE_OPTIONS, t } from '../i18n';
import { speakText } from '../services/speech';
import { Ionicons } from '@expo/vector-icons';

export default function LanguageSelector({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  const [testing, setTesting] = useState(false);
  const testVoice = async () => {
    if (testing) return;
    setTesting(true);
    try { await speakText(t(language, 'voiceTest'), language, { rate: language === 'hi' ? 0.9 : 0.95, volume: 0.92 }); } finally { setTesting(false); }
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t(language, 'language')}</Text>
        <Text style={styles.hint}>{t(language, 'languageSaved')}</Text>
      </View>
      <View style={styles.segment}>
        {LANGUAGE_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, language === option.value && styles.active]}
            activeOpacity={0.8}
          >
            <Text style={[styles.text, language === option.value && styles.activeText]}>{option.nativeLabel}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.testButton} onPress={testVoice} disabled={testing} activeOpacity={0.82}>
        <Ionicons name={testing ? 'volume-high' : 'volume-medium-outline'} size={15} color="#218950" />
        <Text style={styles.testText}>{testing ? '…' : t(language, 'testVoice')}</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles=StyleSheet.create({
  wrap:{marginTop:18},
  labelRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},
  label:{fontSize:14,fontWeight:'900',color:'#22332C'},
  hint:{fontSize:9,color:'#8A9B94',maxWidth:'58%',textAlign:'right'},
  segment:{height:46,borderRadius:14,backgroundColor:'#EAF3EE',padding:4,flexDirection:'row'},
  option:{flex:1,borderRadius:11,alignItems:'center',justifyContent:'center'},
  testButton:{height:38,borderRadius:12,backgroundColor:'#F0F8F3',marginTop:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderWidth:1,borderColor:'#D9EBDD'},
  testText:{fontSize:11,fontWeight:'900',color:'#218950'},
  active:{backgroundColor:'#fff',shadowColor:'#000',shadowOpacity:.06,shadowRadius:6,elevation:2},
  text:{fontSize:13,fontWeight:'800',color:'#71817A'},
  activeText:{color:'#218950'},
});
