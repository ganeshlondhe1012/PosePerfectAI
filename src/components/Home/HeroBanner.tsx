
import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';

export default function HeroBanner({
  onPress,
}: {
  onPress: () => void;
}) {
  const { language } = useApp();
  const { width } = useWindowDimensions();

  const isMobile = width < 600;

  return (
    <ImageBackground
      source={require('../../assets/images/heroBanner.jpg')}
      resizeMode="cover"
      imageStyle={[
        styles.image,
        isMobile ? styles.mobileImage : styles.desktopImage,
      ]}
      style={[
        styles.container,
        isMobile ? styles.mobileContainer : styles.desktopContainer,
      ]}
    >
      <View
        style={[
          styles.overlay,
          isMobile ? styles.mobileOverlay : styles.desktopOverlay,
        ]}
      >
        <Text
          style={[
            styles.title,
            isMobile ? styles.mobileTitle : styles.desktopTitle,
          ]}
        >
          {language === 'hi' ? (
            <>
              अपनी{'\n'}योग यात्रा शुरू करें
            </>
          ) : (
            <>
              Start Your{'\n'}Yoga Journey
            </>
          )}
        </Text>

        <Text style={styles.subtitle}>
          {language === 'hi'
            ? 'एआई गाइडेंस के साथ'
            : 'with AI Guidance'}
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={16} color="#fff" />

          <Text style={styles.buttonText}>
            {t(language, 'startSession')}
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 25,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#D6D6D6',
  },

  desktopContainer: {
    height: 380,
  },

  mobileContainer: {
    height: 300,
  },

  image: {
    borderRadius: 25,
  },

  desktopImage: {
    resizeMode: 'cover',
  },

  mobileImage: {
    resizeMode: 'cover',
  },

  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  desktopOverlay: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  mobileOverlay: {
    backgroundColor: 'rgba(0,0,0,0.30)',
  },

  title: {
    color: '#fff',
    fontWeight: '800',
  },

  desktopTitle: {
    fontSize: 32,
    width: '55%',
  },

  mobileTitle: {
    fontSize: 25,
    width: '72%',
  },

  subtitle: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
  },

  button: {
    marginTop: 22,
    backgroundColor: '#2DBE60',
    width: 165,
    minHeight: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },

  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
