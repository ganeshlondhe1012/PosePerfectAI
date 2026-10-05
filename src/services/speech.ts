import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { Language, LANGUAGE_OPTIONS } from '../i18n';

export type SpeechAvailability = {
  supported: boolean;
  exactVoice: boolean;
  voiceName?: string;
};

let cachedVoices: Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>> | null = null;

function chooseVoice(list: Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>, wanted: string) {
  const exact = list.filter((voice) => voice.language.toLowerCase() === wanted.toLowerCase());
  const family = list.filter((voice) => voice.language.toLowerCase().startsWith(wanted.slice(0, 2).toLowerCase()));
  const rank = (voice: (typeof list)[number]) => voice.quality === 'Enhanced' ? 0 : 1;
  return [...exact.sort((a,b) => rank(a) - rank(b)), ...family.filter(v => !exact.includes(v)).sort((a,b) => rank(a) - rank(b))][0];
}

async function voices() {
  try {
    if (!cachedVoices) cachedVoices = await Speech.getAvailableVoicesAsync();
    return cachedVoices;
  } catch {
    return [];
  }
}

export async function getSpeechAvailability(language: Language): Promise<SpeechAvailability> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !('speechSynthesis' in window)) {
    return { supported: false, exactVoice: false };
  }
  const list = await voices();
  const wanted = LANGUAGE_OPTIONS.find(item => item.value === language)?.voiceCode ?? 'en-IN';
  const selected = chooseVoice(list, wanted);
  return {
    supported: true,
    exactVoice: Boolean(selected),
    voiceName: selected?.name,
  };
}

export async function speakText(text: string, language: Language, options?: { rate?: number; volume?: number }) {
  if (!text) return;
  try {
    await Speech.stop();
  } catch {
    // Stop is best-effort; never block coaching.
  }
  const wanted = LANGUAGE_OPTIONS.find(item => item.value === language)?.voiceCode ?? 'en-IN';
  const list = await voices();
  const selected = chooseVoice(list, wanted);

  Speech.speak(text, {
    language: wanted,
    rate: options?.rate ?? (language === 'hi' ? 0.92 : 0.96),
    volume: options?.volume ?? 0.92,
    ...(selected?.identifier ? { voice: selected.identifier } : {}),
  });
}
