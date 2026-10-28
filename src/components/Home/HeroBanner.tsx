
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
  const isTablet = width >= 600 && width < 1024;

  const heroHeight = isMobile
    ? 360
    : isTablet
    ? 400
    : 460;

  const titleFontSize = isMobile
    ? 25
    : isTablet
    ? 29
    : 34;

  const titleLineHeight = isMobile
    ? 36
    : isTablet
    ? 40
    : 46;

  return (
    <ImageBackground
      source={require('../../assets/images/heroBanner.jpg')}
      style={[
        styles.container,
        {
          height: heroHeight,
        },
      ]}
      imageStyle={styles.image}
      resizeMode="contain"
    >
      {/* Hero content */}
      <View
        style={[
          styles.overlay,
          {
            paddingHorizontal: isMobile ? 18 : 28,
            backgroundColor: isMobile
              ? 'rgba(0,0,0,0.28)'
              : 'rgba(0,0,0,0.22)',
          },
        ]}
      >
        {/* Main heading */}
        <Text
          style={[
            styles.title,
            {
              fontSize: titleFontSize,
              lineHeight: titleLineHeight,
              width: isMobile ? '78%' : '55%',
            },
          ]}
        >
          {language === 'hi' ? (
            <>
              अपनी
              {'\n'}
              योग यात्रा शुरू करें
            </>
          ) : (
            <>
              Start Your
              {'\n'}
              Yoga Journey
            </>
          )}
        </Text>

        {/* Subtitle */}
        <Text
          style={[
            styles.subtitle,
            {
              fontSize: isMobile ? 15 : 17,
              lineHeight: isMobile ? 24 : 27,
            },
          ]}
        >
          {language === 'hi'
            ? 'एआई गाइडेंस के साथ'
            : 'with AI Guidance'}
        </Text>

        {/* Start session button */}
        <TouchableOpacity
          style={[
            styles.button,
            {
              width: isMobile ? 165 : 180,
              height: isMobile ? 46 : 50,
            },
          ]}
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t(language, 'startSession')}
        >
          <Ionicons
            name="play"
            size={16}
            color="#FFFFFF"
          />

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

  image: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    resizeMode: 'contain',
  },

  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  title: {
    color: '#FFFFFF',
    fontWeight: '800',
    includeFontPadding: true,
  },

  subtitle: {
    color: '#FFFFFF',
    marginTop: 12,
    fontWeight: '500',
    includeFontPadding: true,
  },

  button: {
    marginTop: 22,
    backgroundColor: '#2DBE60',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
