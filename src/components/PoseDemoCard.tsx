import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { YogaPose } from '../types';
import { Language, localizePose, t } from '../i18n';

type Props = {
  pose: YogaPose;
  language: Language;
  onStart: () => void;
  compact?: boolean;
};

export default function PoseDemoCard({ pose, language, onStart, compact = false }: Props) {
  const localized = localizePose(pose, language);
  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    timer.current = setInterval(() => setStep(current => (current + 1) % Math.min(4, localized.steps.length)), 2600);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [localized.steps.length]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{t(language, 'posePreview')}</Text>
          <Text style={styles.title}>{t(language, 'livePosePreview')}</Text>
        </View>
        <View style={styles.livePill}><View style={styles.dot} /><Text style={styles.liveText}>{t(language, 'demo')}</Text></View>
      </View>

      <View style={styles.preview}>
        <Animated.Image source={localized.image} style={[styles.image, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }]} resizeMode="contain" />
        <View style={styles.scanLine} />
        <View style={styles.poseLabel}>
          <Ionicons name="body-outline" size={17} color="#2DBE60" />
          <Text style={styles.poseLabelText}>{localized.title}</Text>
        </View>
      </View>

      <Text style={styles.description}>{t(language, 'previewText')}</Text>
      <View style={styles.stepRow}>
        {localized.steps.slice(0, 4).map((item, index) => (
          <View key={`${localized.id}-${index}`} style={[styles.step, index === step && styles.activeStep]}>
            <Text style={[styles.stepNumber, index === step && styles.activeStepNumber]}>{index + 1}</Text>
            <Text style={[styles.stepText, index === step && styles.activeStepText]} numberOfLines={2}>{item}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.button} onPress={onStart} activeOpacity={0.88}>
        <Ionicons name="camera-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>{t(language, 'startCoaching')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card:{marginHorizontal:20,marginTop:18,backgroundColor:'#0D1B16',borderRadius:26,padding:18,borderWidth:1,borderColor:'#1A362C',overflow:'hidden',shadowColor:'#000',shadowOpacity:.12,shadowRadius:18,elevation:4},
  compactCard:{marginHorizontal:0},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:13},
  eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.8,color:'#64D99A'},
  title:{fontSize:20,fontWeight:'900',color:'#F3FFF8',marginTop:4},
  livePill:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:7,borderRadius:99,backgroundColor:'#12291F'},
  dot:{width:7,height:7,borderRadius:4,backgroundColor:'#2DBE60'},
  liveText:{fontSize:9,fontWeight:'900',color:'#8EE8B8',textTransform:'uppercase'},
  preview:{height:300,borderRadius:20,backgroundColor:'#F4FBF7',overflow:'hidden',alignItems:'center',justifyContent:'center',position:'relative'},
  image:{width:'90%',height:'90%'},
  scanLine:{position:'absolute',left:0,right:0,height:2,backgroundColor:'#2DBE60',opacity:.16,top:'42%'},
  poseLabel:{position:'absolute',left:12,bottom:12,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:11,paddingVertical:8,borderRadius:14,backgroundColor:'#07140FEF'},
  poseLabelText:{fontSize:11,fontWeight:'800',color:'#F4FFF8'},
  description:{fontSize:12,color:'#A6BDB3',lineHeight:18,marginTop:12},
  stepRow:{marginTop:13,gap:8},
  step:{flexDirection:'row',alignItems:'flex-start',gap:8,paddingVertical:7,paddingHorizontal:9,borderRadius:12,backgroundColor:'#0A1712'},
  activeStep:{backgroundColor:'#123324'},
  stepNumber:{width:22,height:22,borderRadius:11,backgroundColor:'#173D2D',color:'#85BDA2',textAlign:'center',lineHeight:22,fontSize:10,fontWeight:'900'},
  activeStepNumber:{backgroundColor:'#2DBE60',color:'#fff'},
  stepText:{flex:1,fontSize:11,color:'#91A99F',lineHeight:17},
  activeStepText:{color:'#DDF8E9'},
  button:{height:50,borderRadius:15,backgroundColor:'#2DBE60',marginTop:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  buttonText:{color:'#fff',fontWeight:'900',fontSize:14},
});
